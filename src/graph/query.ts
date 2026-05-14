/**
 * query.ts — High-level query API over the knowledge graph
 *
 * All functions open and close a GraphStore themselves (cheap, SQLite is fast).
 *
 * Functions:
 *   searchGraph        — search nodes by name/label/file
 *   traceCallPath      — BFS call chain (inbound / outbound / both)
 *   getArchitecture    — one-call codebase overview
 *   detectChanges      — git diff text → affected symbols + blast radius
 *   findDeadCode       — zero-callers detection
 *   getCodeSnippet     — read source lines for a qualified name
 *   simpleQueryGraph   — tiny Cypher-lite executor
 */

import fs from 'node:fs';
import path from 'node:path';
import { openGraphStore } from './store.js';
import type {
  SearchOptions,
  SearchResult,
  TraceResult,
  TraceNode,
  ArchitectureReport,
  ChangeImpact,
  DeadCodeEntry,
  GraphNode,
  EdgeType,
} from './types.js';
import crypto from 'node:crypto';

// ─── Shared helper ────────────────────────────────────────────────────────────

function projectId(rootDir: string): string {
  return crypto.createHash('md5').update(rootDir).digest('hex').slice(0, 12);
}

// ─── searchGraph ──────────────────────────────────────────────────────────────

export function searchGraph(opts: SearchOptions, rootDir = process.cwd()): SearchResult[] {
  const store = openGraphStore(rootDir, projectId(rootDir));
  try {
    return store.searchNodes({
      namePattern: opts.namePattern,
      label:       opts.label,
      filePattern: opts.filePattern,
      exported:    opts.exported,
      limit:       opts.limit ?? 20,
      offset:      opts.offset ?? 0,
    });
  } finally {
    store.close();
  }
}

// ─── traceCallPath ────────────────────────────────────────────────────────────

export function traceCallPath(
  functionName: string,
  direction: 'inbound' | 'outbound' | 'both',
  depth: number,
  rootDir = process.cwd(),
): TraceResult | null {
  depth = Math.min(Math.max(depth, 1), 5);
  const store = openGraphStore(rootDir, projectId(rootDir));
  try {
    // Find root node
    const candidates = store.findNodesByName(functionName, undefined, 5);
    if (candidates.length === 0) return null;
    const root = candidates[0];

    const inbound: TraceNode[]  = [];
    const outbound: TraceNode[] = [];

    if (direction === 'inbound' || direction === 'both') {
      bfsInbound(root.id, depth, store, inbound, new Set([root.id]));
    }
    if (direction === 'outbound' || direction === 'both') {
      bfsOutbound(root.id, depth, store, outbound, new Set([root.id]));
    }

    return { root, inbound, outbound };
  } finally {
    store.close();
  }
}

function bfsInbound(
  nodeId: string,
  remainingDepth: number,
  store: ReturnType<typeof openGraphStore>,
  result: TraceNode[],
  visited: Set<string>,
): void {
  if (remainingDepth <= 0) return;
  const callers = store.getDirectCallers(nodeId);
  for (const caller of callers) {
    if (visited.has(caller.id)) continue;
    visited.add(caller.id);
    const tn: TraceNode = { node: caller, depth: 0, edgeType: 'CALLS', children: [] };
    result.push(tn);
    bfsInbound(caller.id, remainingDepth - 1, store, tn.children, visited);
  }
}

function bfsOutbound(
  nodeId: string,
  remainingDepth: number,
  store: ReturnType<typeof openGraphStore>,
  result: TraceNode[],
  visited: Set<string>,
): void {
  if (remainingDepth <= 0) return;
  const callees = store.getDirectCallees(nodeId);
  for (const { node: callee, edgeType } of callees) {
    if (visited.has(callee.id)) continue;
    visited.add(callee.id);
    const tn: TraceNode = { node: callee, depth: 0, edgeType, children: [] };
    result.push(tn);
    bfsOutbound(callee.id, remainingDepth - 1, store, tn.children, visited);
  }
}

// ─── getArchitecture ─────────────────────────────────────────────────────────

export function getArchitecture(rootDir = process.cwd()): ArchitectureReport | null {
  const store = openGraphStore(rootDir, projectId(rootDir));
  try {
    const project = store.getProject();
    if (!project) return null;

    const counts     = store.countByLabel();
    const screens    = store.getNodesByLabel('Screen', 50);
    const navigators = store.getNodesByLabel('Navigator', 20);
    const hotspots   = store.getHotspots(10);
    const deadCount  = store.getDeadCode(['App.', 'index.']).length;

    // Entry points: exported nodes from App.tsx / index.ts
    const entryPoints = store.searchNodes({
      filePattern: 'App',
      exported: true,
      limit: 10,
    }).map(r => r.node)
    .concat(
      store.searchNodes({ filePattern: 'index', exported: true, limit: 10 }).map(r => r.node)
    ).slice(0, 15);

    // RN stack from package.json
    let rnStack: string[] = [];
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')) as {
        dependencies?: Record<string, string>;
      };
      const known: Record<string, string> = {
        '@react-navigation/native': 'NAV',
        '@reduxjs/toolkit': 'REDUX',
        'zustand': 'ZUSTAND',
        '@tanstack/react-query': 'QUERY',
        'react-native-firebase': 'FIRE',
        '@react-native-google-signin/google-signin': 'GSIGN',
        'react-native-reanimated': 'ANIM',
      };
      for (const [dep, alias] of Object.entries(known)) {
        if (pkg.dependencies?.[dep]) rnStack.push(`${alias}=${dep}`);
      }
    } catch { /* no package.json */ }

    return {
      projectName: project.name,
      indexedAt:   project.indexedAt,
      stats: {
        totalNodes:    project.nodeCount,
        totalEdges:    project.edgeCount,
        fileCount:     counts['File']      ?? 0,
        functionCount: counts['Function']  ?? 0,
        classCount:    counts['Class']     ?? 0,
        screenCount:   counts['Screen']    ?? 0,
        hookCount:     counts['Hook']      ?? 0,
        navigatorCount: counts['Navigator'] ?? 0,
      },
      entryPoints,
      screens,
      navigators,
      hotspots: hotspots.map(h => ({ node: h.node, inDegree: h.inDegree, outDegree: h.outDegree })),
      deadCodeCount: deadCount,
      rnStack,
    };
  } finally {
    store.close();
  }
}

// ─── detectChanges ────────────────────────────────────────────────────────────

export function detectChanges(diffText: string, rootDir = process.cwd()): ChangeImpact[] {
  const store = openGraphStore(rootDir, projectId(rootDir));
  try {
    // Parse diff to extract changed file paths and line numbers
    const changedLines = parseDiff(diffText);
    if (changedLines.size === 0) return [];

    const impacts: ChangeImpact[] = [];
    const seen = new Set<string>();

    for (const [filePath, lines] of changedLines.entries()) {
      // Get all nodes in this file
      const fileNodes = store.getNodesByFile(filePath);
      for (const node of fileNodes) {
        if (node.label === 'File') continue;
        // Check if any changed line overlaps this node's range
        const isAffected = lines.some(l => l >= node.lineStart && l <= node.lineEnd);
        if (!isAffected) continue;
        if (seen.has(node.id)) continue;
        seen.add(node.id);

        // Get callers (blast radius = direct callers + their callers)
        const directCallers = store.getDirectCallers(node.id);
        const allCallers    = new Set<string>(directCallers.map(c => c.id));

        for (const caller of directCallers) {
          const grandCallers = store.getDirectCallers(caller.id);
          for (const gc of grandCallers) allCallers.add(gc.id);
        }

        const affectedNodes = directCallers;

        const risk: ChangeImpact['risk'] =
          allCallers.size > 10 ? 'high'
          : allCallers.size > 3 ? 'medium'
          : 'low';

        impacts.push({
          changedSymbol:   node,
          risk,
          affectedCallers: affectedNodes,
          blastRadius:     allCallers.size,
        });
      }
    }

    // Sort by blast radius descending
    return impacts.sort((a, b) => b.blastRadius - a.blastRadius);
  } finally {
    store.close();
  }
}

function parseDiff(diffText: string): Map<string, number[]> {
  const result   = new Map<string, number[]>();
  let currentFile: string | null = null;
  let lineNum = 0;

  for (const line of diffText.split('\n')) {
    // +++ b/src/screens/Login.tsx
    const fileMatch = line.match(/^\+{3}\s+b\/(.+)$/);
    if (fileMatch) {
      currentFile = fileMatch[1];
      if (!result.has(currentFile)) result.set(currentFile, []);
      continue;
    }
    // @@ -10,5 +10,7 @@
    const hunkMatch = line.match(/^@@\s+[-+]\d+(?:,\d+)?\s+\+(\d+)/);
    if (hunkMatch) {
      lineNum = parseInt(hunkMatch[1], 10) - 1;
      continue;
    }
    if (!currentFile) continue;
    if (line.startsWith('+') && !line.startsWith('+++')) {
      lineNum++;
      result.get(currentFile)!.push(lineNum);
    } else if (!line.startsWith('-')) {
      lineNum++;
    }
  }
  return result;
}

// ─── findDeadCode ─────────────────────────────────────────────────────────────

export function findDeadCode(rootDir = process.cwd()): DeadCodeEntry[] {
  const store = openGraphStore(rootDir, projectId(rootDir));
  try {
    const entryPatterns = ['App.', 'index.', 'main.', 'Root'];
    const dead = store.getDeadCode(entryPatterns.map(p => `%${p}%`));
    return dead.map(node => ({
      node,
      reason: `No callers found for ${node.label} "${node.name}" in ${node.filePath}`,
    }));
  } finally {
    store.close();
  }
}

// ─── getCodeSnippet ───────────────────────────────────────────────────────────

export interface CodeSnippet {
  qualifiedName: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  source: string;
  language: string;
}

export function getCodeSnippet(qualifiedName: string, rootDir = process.cwd()): CodeSnippet | null {
  const store = openGraphStore(rootDir, projectId(rootDir));
  let node: GraphNode | undefined;
  try {
    node = store.getNodeByQualifiedName(qualifiedName);
    if (!node) {
      // Try fuzzy: search by name part
      const parts = qualifiedName.split(':');
      const name  = parts[parts.length - 1];
      const found = store.findNodesByName(name, undefined, 3);
      node = found[0];
    }
  } finally {
    store.close();
  }
  if (!node) return null;

  const absPath = path.join(rootDir, node.filePath);
  let source: string;
  try {
    const lines = fs.readFileSync(absPath, 'utf8').split('\n');
    const start = Math.max(0, node.lineStart - 1);
    const end   = Math.min(lines.length - 1, node.lineEnd + 2);
    source = lines.slice(start, end).join('\n');
  } catch {
    return null;
  }

  return {
    qualifiedName: node.qualifiedName,
    filePath:      node.filePath,
    lineStart:     node.lineStart,
    lineEnd:       node.lineEnd,
    source,
    language:      node.language,
  };
}

// ─── simpleQueryGraph (Cypher-lite) ───────────────────────────────────────────

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
}

/**
 * Supports a tiny subset of Cypher-inspired syntax:
 *
 *   MATCH (n:Function) RETURN n.name LIMIT 10
 *   MATCH (f:Function)-[:CALLS]->(g) WHERE f.name = 'login' RETURN g.name, g.file_path
 *   MATCH (n:Screen) RETURN n.name, n.file_path, n.signature ORDER BY n.name
 */
export function simpleQueryGraph(query: string, rootDir = process.cwd()): QueryResult {
  const store = openGraphStore(rootDir, projectId(rootDir));
  try {
    return executeQuery(query, store);
  } finally {
    store.close();
  }
}

function executeQuery(query: string, store: ReturnType<typeof openGraphStore>): QueryResult {
  const q = query.trim();

  // Pattern: MATCH (n:Label) [WHERE n.prop = 'val'] RETURN props [ORDER BY] [LIMIT]
  const simpleMatch = q.match(
    /MATCH\s+\(\w+(?::(\w+))?\)\s*(?:WHERE\s+(.+?)\s+)?RETURN\s+(.+?)(?:\s+ORDER BY\s+(.+?))?(?:\s+LIMIT\s+(\d+))?$/i
  );

  if (simpleMatch) {
    const label     = simpleMatch[1] as import('./types.js').NodeLabel | undefined;
    const where     = simpleMatch[2];
    const returnStr = simpleMatch[3];
    const limitN    = simpleMatch[5] ? parseInt(simpleMatch[5], 10) : 50;

    const propMap: Record<string, keyof GraphNode> = {
      'n.name': 'name', 'n.label': 'label', 'n.file_path': 'filePath',
      'n.qualified_name': 'qualifiedName', 'n.signature': 'signature',
      'n.line_start': 'lineStart', 'n.line_end': 'lineEnd',
      'n.exported': 'exported', 'n.async': 'async',
    };

    let nodes = label ? store.getNodesByLabel(label, 500) : store.searchNodes({ limit: 500 }).map(r => r.node);

    // Apply WHERE
    if (where) {
      const whereMatch = where.match(/\w+\.(\w+)\s*=\s*['"]?([^'"]+)['"]?/);
      if (whereMatch) {
        const prop  = `n.${whereMatch[1]}`;
        const value = whereMatch[2];
        const key   = propMap[prop];
        if (key) {
          nodes = nodes.filter(n => String(n[key]).toLowerCase() === value.toLowerCase());
        }
      }
    }

    nodes = nodes.slice(0, limitN);

    const columns = returnStr.split(',').map(s => s.trim());
    const rows    = nodes.map(n => {
      const row: Record<string, unknown> = {};
      for (const col of columns) {
        const key = propMap[col];
        if (key) row[col] = n[key];
        else row[col] = undefined;
      }
      return row;
    });

    return { columns, rows };
  }

  // Pattern: MATCH (f:Label)-[:EDGE]->(g) WHERE f.prop = 'val' RETURN g.prop
  const relMatch = q.match(
    /MATCH\s+\(\w+(?::(\w+))?\)-\[:(\w+)\]->\(\w+\)\s*(?:WHERE\s+(.+?)\s+)?RETURN\s+(.+?)(?:\s+LIMIT\s+(\d+))?$/i
  );

  if (relMatch) {
    const sourceLabel = relMatch[1] as import('./types.js').NodeLabel | undefined;
    const edgeType    = relMatch[2] as EdgeType;
    const where       = relMatch[3];
    const returnStr   = relMatch[4];
    const limitN      = relMatch[5] ? parseInt(relMatch[5], 10) : 30;

    let sources = sourceLabel ? store.getNodesByLabel(sourceLabel, 200) : store.searchNodes({ limit: 200 }).map(r => r.node);

    // Apply WHERE on source
    if (where) {
      const wm = where.match(/[fg]\.(\w+)\s*=\s*['"]?([^'"]+)['"]?/);
      if (wm) {
        const prop = wm[1] as keyof GraphNode;
        const val  = wm[2];
        sources = sources.filter(n => String(n[prop]).toLowerCase() === val.toLowerCase());
      }
    }

    const rows: Record<string, unknown>[] = [];
    const returnCols = returnStr.split(',').map(s => s.trim());

    for (const src of sources) {
      const targets = store.getDirectCallees(src.id)
        .filter(({ edgeType: et }) => !edgeType || et === edgeType)
        .map(t => t.node);

      for (const tgt of targets.slice(0, 5)) {
        const row: Record<string, unknown> = {};
        for (const col of returnCols) {
          if (col.startsWith('f.')) {
            const key = col.slice(2) as keyof GraphNode;
            row[col]  = src[key];
          } else if (col.startsWith('g.')) {
            const key = col.slice(2) as keyof GraphNode;
            row[col]  = tgt[key];
          }
        }
        rows.push(row);
        if (rows.length >= limitN) break;
      }
      if (rows.length >= limitN) break;
    }

    return { columns: returnCols, rows };
  }

  return { columns: ['error'], rows: [{ error: 'Unsupported query syntax. Use: MATCH (n:Label) RETURN n.name LIMIT 10' }] };
}
