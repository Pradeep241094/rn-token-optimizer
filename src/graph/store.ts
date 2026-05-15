/**
 * store.ts — SQLite-backed knowledge graph storage
 *
 * Uses better-sqlite3 (synchronous API) for fast, embedded persistence.
 * Database lives at .rn-token-optimizer/graph.db relative to the project root.
 */

import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { GraphNode, GraphEdge, GraphProject, NodeLabel, EdgeType } from './types.js';

export const GRAPH_DB_NAME = 'graph.db';

// ─── Schema ───────────────────────────────────────────────────────────────────

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  root_path   TEXT NOT NULL,
  indexed_at  TEXT NOT NULL,
  node_count  INTEGER DEFAULT 0,
  edge_count  INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS nodes (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL,
  label           TEXT NOT NULL,
  name            TEXT NOT NULL,
  qualified_name  TEXT NOT NULL,
  file_path       TEXT NOT NULL,
  line_start      INTEGER NOT NULL DEFAULT 0,
  line_end        INTEGER NOT NULL DEFAULT 0,
  signature       TEXT NOT NULL DEFAULT '',
  exported        INTEGER NOT NULL DEFAULT 0,
  async           INTEGER NOT NULL DEFAULT 0,
  language        TEXT NOT NULL DEFAULT 'typescript',
  properties_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_nodes_project   ON nodes(project_id);
CREATE INDEX IF NOT EXISTS idx_nodes_label     ON nodes(project_id, label);
CREATE INDEX IF NOT EXISTS idx_nodes_name      ON nodes(project_id, name);
CREATE INDEX IF NOT EXISTS idx_nodes_qname     ON nodes(project_id, qualified_name);
CREATE INDEX IF NOT EXISTS idx_nodes_file      ON nodes(project_id, file_path);

CREATE TABLE IF NOT EXISTS edges (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL,
  source_id       TEXT NOT NULL,
  target_id       TEXT NOT NULL,
  edge_type       TEXT NOT NULL,
  weight          REAL NOT NULL DEFAULT 1.0,
  properties_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_edges_project  ON edges(project_id);
CREATE INDEX IF NOT EXISTS idx_edges_source   ON edges(project_id, source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target   ON edges(project_id, target_id);
CREATE INDEX IF NOT EXISTS idx_edges_type     ON edges(project_id, edge_type);
`;

// ─── GraphStore class ─────────────────────────────────────────────────────────

export class GraphStore {
  private db: Database.Database;
  private projectId: string;

  constructor(dbPath: string, projectId: string) {
    const dir = path.dirname(dbPath);
    fs.mkdirSync(dir, { recursive: true });
    this.db = new Database(dbPath);
    this.projectId = projectId;
    this.db.exec(SCHEMA);
  }

  close(): void {
    this.db.close();
  }

  // ── Project ────────────────────────────────────────────────────────────────

  upsertProject(proj: GraphProject): void {
    this.db.prepare(`
      INSERT INTO projects(id, name, root_path, indexed_at, node_count, edge_count)
      VALUES(?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name, root_path=excluded.root_path,
        indexed_at=excluded.indexed_at,
        node_count=excluded.node_count, edge_count=excluded.edge_count
    `).run(proj.id, proj.name, proj.rootPath, proj.indexedAt, proj.nodeCount, proj.edgeCount);
  }

  getProject(): GraphProject | undefined {
    const row = this.db.prepare(
      'SELECT * FROM projects WHERE id = ?'
    ).get(this.projectId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      id: row['id'] as string,
      name: row['name'] as string,
      rootPath: row['root_path'] as string,
      indexedAt: row['indexed_at'] as string,
      nodeCount: row['node_count'] as number,
      edgeCount: row['edge_count'] as number,
    };
  }

  // ── Nodes ──────────────────────────────────────────────────────────────────

  clearProject(): void {
    this.db.prepare('DELETE FROM nodes WHERE project_id = ?').run(this.projectId);
    this.db.prepare('DELETE FROM edges WHERE project_id = ?').run(this.projectId);
  }

  batchUpsertNodes(nodes: GraphNode[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO nodes(id, project_id, label, name, qualified_name, file_path,
        line_start, line_end, signature, exported, async, language, properties_json)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        label=excluded.label, name=excluded.name,
        qualified_name=excluded.qualified_name,
        file_path=excluded.file_path,
        line_start=excluded.line_start, line_end=excluded.line_end,
        signature=excluded.signature, exported=excluded.exported,
        async=excluded.async, properties_json=excluded.properties_json
    `);
    const run = this.db.transaction((batch: GraphNode[]) => {
      for (const n of batch) {
        stmt.run(
          n.id, this.projectId, n.label, n.name, n.qualifiedName, n.filePath,
          n.lineStart, n.lineEnd, n.signature,
          n.exported ? 1 : 0, n.async ? 1 : 0, n.language,
          JSON.stringify(n.properties),
        );
      }
    });
    run(nodes);
  }

  batchUpsertEdges(edges: GraphEdge[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO edges(id, project_id, source_id, target_id, edge_type, weight, properties_json)
      VALUES(?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `);
    const run = this.db.transaction((batch: GraphEdge[]) => {
      for (const e of batch) {
        stmt.run(e.id, this.projectId, e.sourceId, e.targetId, e.edgeType, e.weight, JSON.stringify(e.properties));
      }
    });
    run(edges);
  }

  // ── Lookup ──────────────────────────────────────────────────────────────────

  getNodeById(id: string): GraphNode | undefined {
    const row = this.db.prepare(
      'SELECT * FROM nodes WHERE project_id = ? AND id = ?'
    ).get(this.projectId, id) as Record<string, unknown> | undefined;
    return row ? rowToNode(row) : undefined;
  }

  getNodeByQualifiedName(qname: string): GraphNode | undefined {
    const row = this.db.prepare(
      'SELECT * FROM nodes WHERE project_id = ? AND qualified_name = ?'
    ).get(this.projectId, qname) as Record<string, unknown> | undefined;
    return row ? rowToNode(row) : undefined;
  }

  /** Find nodes whose name matches the given substring (case-insensitive) */
  findNodesByName(name: string, label?: NodeLabel, limit = 20): GraphNode[] {
    const rows = label
      ? this.db.prepare(
          'SELECT * FROM nodes WHERE project_id = ? AND label = ? AND name LIKE ? LIMIT ?'
        ).all(this.projectId, label, `%${name}%`, limit)
      : this.db.prepare(
          'SELECT * FROM nodes WHERE project_id = ? AND name LIKE ? LIMIT ?'
        ).all(this.projectId, `%${name}%`, limit);
    return (rows as Record<string, unknown>[]).map(rowToNode);
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  searchNodes(opts: {
    namePattern?: string;
    label?: NodeLabel;
    filePattern?: string;
    exported?: boolean;
    limit?: number;
    offset?: number;
  }): Array<{ node: GraphNode; callerCount: number; calleeCount: number }> {
    const conditions: string[] = ['n.project_id = ?'];
    const params: unknown[]    = [this.projectId];

    if (opts.namePattern) {
      conditions.push('n.name LIKE ?');
      params.push(`%${opts.namePattern}%`);
    }
    if (opts.label) {
      conditions.push('n.label = ?');
      params.push(opts.label);
    }
    if (opts.filePattern) {
      conditions.push('n.file_path LIKE ?');
      params.push(`%${opts.filePattern}%`);
    }
    if (opts.exported !== undefined) {
      conditions.push('n.exported = ?');
      params.push(opts.exported ? 1 : 0);
    }

    const limit  = opts.limit  ?? 20;
    const offset = opts.offset ?? 0;
    params.push(limit, offset);

    const sql = `
      SELECT n.*,
        (SELECT COUNT(*) FROM edges e WHERE e.project_id = n.project_id AND e.target_id = n.id AND e.edge_type IN ('CALLS','RENDERS','NAVIGATES_TO','INJECTS')) AS caller_count,
        (SELECT COUNT(*) FROM edges e WHERE e.project_id = n.project_id AND e.source_id = n.id AND e.edge_type IN ('CALLS','RENDERS','NAVIGATES_TO','INJECTS')) AS callee_count
      FROM nodes n
      WHERE ${conditions.join(' AND ')}
      ORDER BY caller_count DESC
      LIMIT ? OFFSET ?
    `;
    const rows = this.db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
    return rows.map(r => ({
      node: rowToNode(r),
      callerCount: r['caller_count'] as number,
      calleeCount: r['callee_count'] as number,
    }));
  }

  // ── BFS call tracing ───────────────────────────────────────────────────────

  getDirectCallers(nodeId: string): GraphNode[] {
    // INJECTS is included so "who uses this Service?" returns its consumers
    const rows = this.db.prepare(`
      SELECT n.* FROM nodes n
      JOIN edges e ON e.source_id = n.id
      WHERE e.project_id = ? AND e.target_id = ?
        AND e.edge_type IN ('CALLS','RENDERS','NAVIGATES_TO','INJECTS')
    `).all(this.projectId, nodeId) as Record<string, unknown>[];
    return rows.map(rowToNode);
  }

  getDirectCallees(nodeId: string): Array<{ node: GraphNode; edgeType: EdgeType }> {
    // INJECTS is included so "what does this Controller depend on?" shows injected services
    const rows = this.db.prepare(`
      SELECT n.*, e.edge_type AS _edge_type FROM nodes n
      JOIN edges e ON e.target_id = n.id
      WHERE e.project_id = ? AND e.source_id = ?
        AND e.edge_type IN ('CALLS','RENDERS','NAVIGATES_TO','INJECTS')
    `).all(this.projectId, nodeId) as Array<Record<string, unknown>>;
    return rows.map(r => ({
      node: rowToNode(r),
      edgeType: r['_edge_type'] as EdgeType,
    }));
  }

  // ── Degree queries ─────────────────────────────────────────────────────────

  getHotspots(topN = 10): Array<{ node: GraphNode; inDegree: number; outDegree: number }> {
    const rows = this.db.prepare(`
      SELECT n.*,
        (SELECT COUNT(*) FROM edges e WHERE e.project_id = n.project_id AND e.target_id = n.id) AS in_degree,
        (SELECT COUNT(*) FROM edges e WHERE e.project_id = n.project_id AND e.source_id = n.id) AS out_degree
      FROM nodes n
      WHERE n.project_id = ? AND n.label NOT IN ('File')
      ORDER BY in_degree DESC
      LIMIT ?
    `).all(this.projectId, topN) as Array<Record<string, unknown>>;
    return rows.map(r => ({
      node: rowToNode(r),
      inDegree: r['in_degree'] as number,
      outDegree: r['out_degree'] as number,
    }));
  }

  /** Functions/components with zero callers and not an entry-point file */
  getDeadCode(entryFilePatterns: string[] = []): GraphNode[] {
    const excludeParts = entryFilePatterns.length > 0
      ? 'AND ' + entryFilePatterns.map(() => 'n.file_path NOT LIKE ?').join(' AND ')
      : '';

    const rows = this.db.prepare(`
      SELECT n.* FROM nodes n
      WHERE n.project_id = ?
        AND n.label IN (
          -- TypeScript / React Native
          'Function','Screen','Hook','Component','Provider','Slice',
          -- .NET / C# (Controllers are HTTP entry points so excluded)
          'Service','Repository','Middleware','ApiEndpoint'
        )
        AND (SELECT COUNT(*) FROM edges e
             WHERE e.project_id = n.project_id
               AND e.target_id = n.id
               AND e.edge_type IN ('CALLS','RENDERS','NAVIGATES_TO','INJECTS')) = 0
        ${excludeParts}
      ORDER BY n.file_path, n.line_start
    `).all(this.projectId, ...entryFilePatterns) as Record<string, unknown>[];
    return rows.map(rowToNode);
  }

  /**
   * Detects the primary language of the indexed project by checking for
   * .NET-specific node labels. Falls back to 'typescript'.
   */
  detectLanguage(): 'csharp' | 'typescript' {
    const counts = this.countByLabel();
    const dotNetLabels: string[] = ['Controller', 'Service', 'Repository', 'ApiEndpoint', 'Middleware'];
    return dotNetLabels.some(l => (counts[l] ?? 0) > 0) ? 'csharp' : 'typescript';
  }

  // ── Label queries ──────────────────────────────────────────────────────────

  getNodesByLabel(label: NodeLabel, limit = 100): GraphNode[] {
    const rows = this.db.prepare(
      'SELECT * FROM nodes WHERE project_id = ? AND label = ? ORDER BY name LIMIT ?'
    ).all(this.projectId, label, limit) as Record<string, unknown>[];
    return rows.map(rowToNode);
  }

  getNodesByFile(filePath: string): GraphNode[] {
    const rows = this.db.prepare(
      'SELECT * FROM nodes WHERE project_id = ? AND file_path = ? ORDER BY line_start'
    ).all(this.projectId, filePath) as Record<string, unknown>[];
    return rows.map(rowToNode);
  }

  countByLabel(): Record<string, number> {
    const rows = this.db.prepare(`
      SELECT label, COUNT(*) AS cnt FROM nodes WHERE project_id = ? GROUP BY label
    `).all(this.projectId) as Array<{ label: string; cnt: number }>;
    return Object.fromEntries(rows.map(r => [r.label, r.cnt]));
  }

  countEdges(): number {
    const row = this.db.prepare(
      'SELECT COUNT(*) AS cnt FROM edges WHERE project_id = ?'
    ).get(this.projectId) as { cnt: number };
    return row.cnt;
  }

  // ── File-scoped node resolution ────────────────────────────────────────────

  /** Find node by short name within a specific file (for cross-file edge resolution) */
  findNodeByNameInFile(name: string, filePath: string): GraphNode | undefined {
    const row = this.db.prepare(`
      SELECT * FROM nodes WHERE project_id = ? AND name = ? AND file_path = ? LIMIT 1
    `).get(this.projectId, name, filePath) as Record<string, unknown> | undefined;
    return row ? rowToNode(row) : undefined;
  }

  /** Find node by exact name across all files (returns first match, prefers exported) */
  findNodeByExactName(name: string, label?: NodeLabel): GraphNode | undefined {
    const row = label
      ? this.db.prepare(`
          SELECT * FROM nodes WHERE project_id = ? AND name = ? AND label = ?
          ORDER BY exported DESC LIMIT 1
        `).get(this.projectId, name, label)
      : this.db.prepare(`
          SELECT * FROM nodes WHERE project_id = ? AND name = ?
          ORDER BY exported DESC LIMIT 1
        `).get(this.projectId, name);
    return row ? rowToNode(row as Record<string, unknown>) : undefined;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function openGraphStore(rootDir: string, projectId: string): GraphStore {
  const dbPath = path.join(rootDir, '.rn-token-optimizer', GRAPH_DB_NAME);
  return new GraphStore(dbPath, projectId);
}

// ─── Row → domain helpers ─────────────────────────────────────────────────────

function rowToNode(r: Record<string, unknown>): GraphNode {
  return {
    id:            r['id'] as string,
    label:         r['label'] as NodeLabel,
    name:          r['name'] as string,
    qualifiedName: r['qualified_name'] as string,
    filePath:      r['file_path'] as string,
    lineStart:     r['line_start'] as number,
    lineEnd:       r['line_end'] as number,
    signature:     r['signature'] as string,
    exported:      Boolean(r['exported']),
    async:         Boolean(r['async']),
    language:      (r['language'] as string) ?? 'typescript',
    properties:    parseJson(r['properties_json'] as string),
  };
}

function parseJson(s: string): Record<string, unknown> {
  try { return JSON.parse(s) as Record<string, unknown>; }
  catch { return {}; }
}
