/**
 * indexer.ts — Two-pass project indexer
 *
 * Pass 1: Walk all TS/TSX/JS/JSX files → parse AST → collect nodes + raw refs
 * Pass 2: Resolve cross-file edges (CALLS, RENDERS, NAVIGATES_TO, IMPORTS)
 *         by matching raw call/render/navigate names to the stored node table
 *
 * Stores everything in SQLite via GraphStore.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseFile, edgeId } from './parser.js';
import { openGraphStore } from './store.js';
import type { GraphEdge, GraphNode, ParsedFile, RawCallRef, RawNavigateRef, RawRenderRef, IndexOptions, IndexResult } from './types.js';
import { isDotNetProject } from './dotnet/detector.js';
import { indexDotNetProject } from './dotnet/indexer.js';

// ─── Constants ─────────────────────────────────────────────────────────────────

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage',
  '.expo', '__pycache__', '.gradle', 'Pods', 'DerivedData',
  '.turbo', '.next', 'out', '.cache', 'tmp', '.rn-token-optimizer',
]);

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

// ─── Indexer options / result (re-exported from types for backward compat) ─────

export type { IndexOptions, IndexResult } from './types.js';

// ─── File walker ───────────────────────────────────────────────────────────────

function walkSourceFiles(rootDir: string): string[] {
  const results: string[] = [];

  function walk(dir: string, depth = 0): void {
    if (depth > 8) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }

    for (const e of entries) {
      if (e.name.startsWith('.') && e.name !== '.kiro') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(full, depth + 1);
      } else if (SOURCE_EXTENSIONS.has(path.extname(e.name).toLowerCase())) {
        results.push(full);
      }
    }
  }

  walk(rootDir);
  return results;
}

// ─── Project ID derivation ────────────────────────────────────────────────────

function deriveProjectId(rootDir: string): string {
  return crypto.createHash('md5').update(rootDir).digest('hex').slice(0, 12);
}

// ─── Edge builders ─────────────────────────────────────────────────────────────

function makeDefinesEdge(fileNodeId: string, symbolNodeId: string): GraphEdge {
  return {
    id:         edgeId(fileNodeId, symbolNodeId, 'DEFINES'),
    sourceId:   fileNodeId,
    targetId:   symbolNodeId,
    edgeType:   'DEFINES',
    weight:     1,
    properties: {},
  };
}

function makeImportsEdge(sourceFileNodeId: string, targetFileNodeId: string): GraphEdge {
  return {
    id:         edgeId(sourceFileNodeId, targetFileNodeId, 'IMPORTS'),
    sourceId:   sourceFileNodeId,
    targetId:   targetFileNodeId,
    edgeType:   'IMPORTS',
    weight:     1,
    properties: {},
  };
}

// ─── Main indexer ──────────────────────────────────────────────────────────────

export async function indexProject(opts: IndexOptions = {}): Promise<IndexResult> {
  const rootDir = opts.rootDir ?? process.cwd();

  // Route .NET projects to the Roslyn-backed indexer
  if (isDotNetProject(rootDir)) {
    if (!opts.quiet) {
      process.stderr.write(
        '[rn-token-optimizer] .NET project detected — using Roslyn graph indexer.\n',
      );
    }
    return indexDotNetProject(opts);
  }

  const startTime = Date.now();

  // Derive project metadata
  const projectId = deriveProjectId(rootDir);
  let projectName = path.basename(rootDir);
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')) as { name?: string };
    if (pkg.name) projectName = pkg.name;
  } catch { /* use basename */ }

  const store = openGraphStore(rootDir, projectId);

  // Clear previous index
  store.clearProject();

  // ── Pass 1: Walk and parse all source files ───────────────────────────────

  const sourceFiles = walkSourceFiles(rootDir);
  const total       = sourceFiles.length;

  const allParsed: ParsedFile[]  = [];
  const allNodes:  GraphNode[]   = [];
  const allEdges:  GraphEdge[]   = [];

  // File node id map: filePath → nodeId
  const fileNodeIdMap = new Map<string, string>();

  for (let i = 0; i < sourceFiles.length; i++) {
    const absPath  = sourceFiles[i];
    const relPath  = path.relative(rootDir, absPath).replace(/\\/g, '/');

    opts.onProgress?.(relPath, i + 1, total);

    // Create a File node for this source file
    const fileNodeId = crypto.createHash('md5').update(`file:${relPath}`).digest('hex').slice(0, 16);
    fileNodeIdMap.set(relPath, fileNodeId);

    const fileNode: GraphNode = {
      id:            fileNodeId,
      label:         'File',
      name:          path.basename(relPath),
      qualifiedName: relPath,
      filePath:      relPath,
      lineStart:     1,
      lineEnd:       1,
      signature:     relPath,
      exported:      false,
      async:         false,
      language:      langFromExt(path.extname(absPath)),
      properties:    {},
    };
    allNodes.push(fileNode);

    // Parse the file
    const parsed = parseFile(absPath, rootDir);
    if (!parsed) continue;

    allParsed.push(parsed);

    // Add symbol nodes + DEFINES edges
    for (const sym of parsed.nodes) {
      allNodes.push(sym);
      allEdges.push(makeDefinesEdge(fileNodeId, sym.id));
    }
  }

  // Batch write all nodes
  store.batchUpsertNodes(allNodes);

  // ── Pass 2: Resolve cross-file edges ─────────────────────────────────────

  const allCalls:     RawCallRef[]     = [];
  const allNavigates: RawNavigateRef[] = [];
  const allRenders:   RawRenderRef[]   = [];
  const fileImports:  Array<{ sourceFile: string; targetFile: string }> = [];

  for (const parsed of allParsed) {
    allCalls.push(...parsed.rawCalls);
    allNavigates.push(...parsed.rawNavigates);
    allRenders.push(...parsed.rawRenders);

    for (const importedFile of parsed.importedFiles) {
      fileImports.push({ sourceFile: parsed.filePath, targetFile: importedFile });
    }
  }

  // IMPORTS edges
  for (const { sourceFile, targetFile } of fileImports) {
    const srcId  = fileNodeIdMap.get(sourceFile);
    const tgtId  = fileNodeIdMap.get(targetFile) ?? fileNodeIdMap.get(targetFile + '.ts') ?? fileNodeIdMap.get(targetFile + '.tsx');
    if (srcId && tgtId) {
      allEdges.push(makeImportsEdge(srcId, tgtId));
    }
  }

  // CALLS edges
  for (const raw of allCalls) {
    const callerNode = store.getNodeByQualifiedName(raw.callerQualifiedName);
    if (!callerNode) continue;
    const calleeNode = store.findNodeByExactName(raw.calleeName);
    if (!calleeNode) continue;
    allEdges.push({
      id:         edgeId(callerNode.id, calleeNode.id, 'CALLS'),
      sourceId:   callerNode.id,
      targetId:   calleeNode.id,
      edgeType:   'CALLS',
      weight:     1,
      properties: { line: raw.line },
    });
  }

  // RENDERS edges
  for (const raw of allRenders) {
    const callerNode = store.getNodeByQualifiedName(raw.callerQualifiedName);
    if (!callerNode) continue;
    const targetNode = store.findNodeByExactName(raw.renderedComponentName);
    if (!targetNode) continue;
    allEdges.push({
      id:         edgeId(callerNode.id, targetNode.id, 'RENDERS'),
      sourceId:   callerNode.id,
      targetId:   targetNode.id,
      edgeType:   'RENDERS',
      weight:     1,
      properties: { line: raw.line },
    });
  }

  // NAVIGATES_TO edges
  for (const raw of allNavigates) {
    const callerNode = store.getNodeByQualifiedName(raw.callerQualifiedName);
    if (!callerNode) continue;
    // Match by screen name (exact or with 'Screen' suffix)
    const targetNode =
      store.findNodeByExactName(raw.targetScreenName, 'Screen') ??
      store.findNodeByExactName(raw.targetScreenName + 'Screen', 'Screen') ??
      store.findNodeByExactName(raw.targetScreenName);
    if (!targetNode) continue;
    allEdges.push({
      id:         edgeId(callerNode.id, targetNode.id, 'NAVIGATES_TO'),
      sourceId:   callerNode.id,
      targetId:   targetNode.id,
      edgeType:   'NAVIGATES_TO',
      weight:     1,
      properties: { line: raw.line, screenName: raw.targetScreenName },
    });
  }

  // Deduplicate edges by id before writing
  const edgeMap = new Map<string, GraphEdge>();
  for (const e of allEdges) edgeMap.set(e.id, e);
  const uniqueEdges = [...edgeMap.values()];

  store.batchUpsertEdges(uniqueEdges);

  // ── Persist project metadata ──────────────────────────────────────────────

  const indexedAt = new Date().toISOString();
  const nodeCount = allNodes.length;
  const edgeCount = uniqueEdges.length;

  store.upsertProject({
    id:        projectId,
    name:      projectName,
    rootPath:  rootDir,
    indexedAt,
    nodeCount,
    edgeCount,
  });

  // Gather summary info before closing
  const screens  = store.getNodesByLabel('Screen', 50);
  const hotspots = store.getHotspots(5).map(h => ({ node: h.node, inDegree: h.inDegree }));

  store.close();

  return {
    projectId,
    name: projectName,
    rootDir,
    nodeCount,
    edgeCount,
    fileCount: sourceFiles.length,
    durationMs: Date.now() - startTime,
    screens,
    hotspots,
    indexedAt,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function langFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.ts':  return 'typescript';
    case '.tsx': return 'tsx';
    case '.js':  return 'javascript';
    case '.jsx': return 'jsx';
    default:     return 'typescript';
  }
}
