/**
 * ui/server.ts — Zero-dependency graph visualization server
 *
 * Serves the interactive graph dashboard via a pure node:http server.
 *
 * Routes:
 *   GET /               → embedded dashboard HTML
 *   GET /api/graph      → { nodes, edges, project } from SQLite
 *   GET /api/search?q=  → TF-IDF semantic search results
 *   GET /api/node/:id   → single node detail + callers/callees + code snippet
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import { openGraphStore } from '../store.js';
import { searchGraphTfIdf } from '../query.js';
import { getDashboardHtml } from './dashboard.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function projectId(rootDir: string): string {
  return crypto.createHash('md5').update(rootDir).digest('hex').slice(0, 12);
}

function json(res: http.ServerResponse, data: unknown, status = 200): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

function html(res: http.ServerResponse, body: string): void {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body);
}

function notFound(res: http.ServerResponse, msg = 'Not found'): void {
  json(res, { error: msg }, 404);
}

/** Read N lines of source around a given line range */
function readSourceSnippet(
  filePath: string,
  lineStart: number,
  lineEnd: number,
  context = 4,
): string {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const lines = text.split('\n');
    const from  = Math.max(0, lineStart - 1 - context);
    const to    = Math.min(lines.length - 1, lineEnd + context);
    return lines.slice(from, to + 1).join('\n');
  } catch {
    return '// source not available';
  }
}

/** Open a URL in the default browser (cross-platform) */
function openBrowser(url: string): void {
  try {
    const platform = process.platform;
    if (platform === 'darwin') execSync(`open "${url}"`, { stdio: 'ignore' });
    else if (platform === 'win32') execSync(`start "${url}"`, { stdio: 'ignore' });
    else execSync(`xdg-open "${url}"`, { stdio: 'ignore' });
  } catch {
    // silently ignore — browser may not be available in headless envs
  }
}

// ─── API handlers ─────────────────────────────────────────────────────────────

function handleGetGraph(
  rootDir: string,
  res: http.ServerResponse,
): void {
  const pid   = projectId(rootDir);
  const store = openGraphStore(rootDir, pid);
  try {
    const project = store.getProject();
    if (!project) {
      json(res, { error: 'No graph index found. Run: rn-token-optimizer graph index' }, 404);
      return;
    }

    const { nodes: nodeRows, edges: edgeRows } = store.getAllNodesAndEdges();
    const labelCounts = store.countByLabel();

    json(res, {
      project,
      labelCounts,
      nodes: nodeRows.map(r => ({
        id:            r['id'],
        label:         r['label'],
        name:          r['name'],
        qualifiedName: r['qualified_name'],
        filePath:      r['file_path'],
        lineStart:     r['line_start'],
        lineEnd:       r['line_end'],
        signature:     r['signature'],
        exported:      Boolean(r['exported']),
        async:         Boolean(r['async']),
        language:      r['language'],
      })),
      edges: edgeRows.map(r => ({
        id:       r['id'],
        sourceId: r['source_id'],
        targetId: r['target_id'],
        type:     r['edge_type'],
        weight:   r['weight'],
      })),
    });
  } finally {
    store.close();
  }
}

async function handleSearch(
  rootDir: string,
  query: string,
  limit: number,
  res: http.ServerResponse,
): Promise<void> {
  if (!query.trim()) {
    json(res, { results: [] });
    return;
  }
  const results = await searchGraphTfIdf(query, limit, rootDir);
  json(res, {
    results: results.map(r => ({
      id:        r.node.id,
      name:      r.node.name,
      label:     r.node.label,
      filePath:  r.node.filePath,
      lineStart: r.node.lineStart,
      signature: r.node.signature,
      score:     r.score,
    })),
  });
}

function handleGetNode(
  rootDir: string,
  nodeId: string,
  res: http.ServerResponse,
): void {
  const pid   = projectId(rootDir);
  const store = openGraphStore(rootDir, pid);
  try {
    const node = store.getNodeById(nodeId);
    if (!node) {
      notFound(res, `Node ${nodeId} not found`);
      return;
    }

    const callers = store.getDirectCallers(nodeId);
    const callees = store.getDirectCallees(nodeId);

    const absPath  = path.isAbsolute(node.filePath)
      ? node.filePath
      : path.join(rootDir, node.filePath);
    const snippet  = readSourceSnippet(absPath, node.lineStart, node.lineEnd);

    json(res, {
      node,
      callers:  callers.map(n => ({ id: n.id, name: n.name, label: n.label, filePath: n.filePath })),
      callees:  callees.map(({ node: n, edgeType }) => ({ id: n.id, name: n.name, label: n.label, filePath: n.filePath, edgeType })),
      snippet,
    });
  } finally {
    store.close();
  }
}

// ─── Request router ───────────────────────────────────────────────────────────

function createRouter(rootDir: string) {
  return async (req: http.IncomingMessage, res: http.ServerResponse): Promise<void> => {
    const url     = new URL(req.url ?? '/', `http://localhost`);
    const pathname = url.pathname;

    // CORS pre-flight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' });
      res.end();
      return;
    }

    if (req.method !== 'GET') {
      json(res, { error: 'Method not allowed' }, 405);
      return;
    }

    try {
      // ── API routes ──────────────────────────────────────────────────────────
      if (pathname === '/api/graph') {
        handleGetGraph(rootDir, res);
        return;
      }

      if (pathname === '/api/search') {
        const q     = url.searchParams.get('q') ?? '';
        const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '10', 10), 50);
        await handleSearch(rootDir, q, limit, res);
        return;
      }

      const nodeMatch = pathname.match(/^\/api\/node\/(.+)$/);
      if (nodeMatch) {
        handleGetNode(rootDir, decodeURIComponent(nodeMatch[1]), res);
        return;
      }

      // ── Dashboard (catch-all) ───────────────────────────────────────────────
      html(res, getDashboardHtml());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      json(res, { error: msg }, 500);
    }
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface UiServerOptions {
  rootDir:   string;
  port:      number;
  autoOpen:  boolean;
}

export function startUiServer(opts: UiServerOptions): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(createRouter(opts.rootDir));

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${opts.port} is already in use. Try --port <other>`));
      } else {
        reject(err);
      }
    });

    server.listen(opts.port, '127.0.0.1', () => {
      const url = `http://localhost:${opts.port}`;
      if (opts.autoOpen) openBrowser(url);
      resolve(server);
    });
  });
}
