/**
 * indexer.ts — Two-pass .NET project indexer
 *
 * Mirrors the structure of graph/indexer.ts but uses the Roslyn analyzer
 * subprocess instead of the TypeScript AST parser.
 *
 * Pass 1 — Walk all *.cs files → invoke Roslyn → collect GraphNodes + raw refs
 * Pass 2 — Resolve cross-symbol edges:
 *           CALLS        (raw method invocations)
 *           INHERITS     (class.properties.baseClass → parent class node)
 *           IMPLEMENTS   (class.properties.interfaces[] → interface nodes)
 *           INJECTS      (class.properties.injectedTypes[] → service/repo nodes)
 *           HANDLES_ROUTE(apiEndpoint.properties.route → string edge property)
 *           DEFINES      (File → symbol)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { openGraphStore } from '../store.js';
import { edgeId } from '../parser.js';
import type { GraphEdge, GraphNode, IndexOptions, IndexResult } from '../types.js';
import { walkSourceFiles, langFromExt } from './detector.js';
import { resolveAnalyzerDll, analyzeFiles } from './analyzer.js';

// ─── Project ID derivation (identical to the TS indexer) ─────────────────────

function deriveProjectId(rootDir: string): string {
  return crypto.createHash('md5').update(rootDir).digest('hex').slice(0, 12);
}

// ─── Edge factory helpers ─────────────────────────────────────────────────────

function definesEdge(fileNodeId: string, symbolNodeId: string): GraphEdge {
  return {
    id: edgeId(fileNodeId, symbolNodeId, 'DEFINES'),
    sourceId: fileNodeId,
    targetId: symbolNodeId,
    edgeType: 'DEFINES',
    weight: 1,
    properties: {},
  };
}

function callsEdge(callerId: string, calleeId: string, line: number): GraphEdge {
  return {
    id: edgeId(callerId, calleeId, 'CALLS'),
    sourceId: callerId,
    targetId: calleeId,
    edgeType: 'CALLS',
    weight: 1,
    properties: { line },
  };
}

function inheritsEdge(childId: string, parentId: string): GraphEdge {
  return {
    id: edgeId(childId, parentId, 'INHERITS'),
    sourceId: childId,
    targetId: parentId,
    edgeType: 'INHERITS',
    weight: 1,
    properties: {},
  };
}

function implementsEdge(classId: string, ifaceId: string): GraphEdge {
  return {
    id: edgeId(classId, ifaceId, 'IMPLEMENTS'),
    sourceId: classId,
    targetId: ifaceId,
    edgeType: 'IMPLEMENTS',
    weight: 1,
    properties: {},
  };
}

function injectsEdge(classId: string, serviceId: string, typeName: string): GraphEdge {
  return {
    id: edgeId(classId, serviceId, 'INJECTS'),
    sourceId: classId,
    targetId: serviceId,
    edgeType: 'INJECTS',
    weight: 1,
    properties: { typeName },
  };
}

function handlesRouteEdge(controllerId: string, endpointId: string, route: string): GraphEdge {
  // Controller → ApiEndpoint with the resolved HTTP route in properties.
  // This replaces the previous self-referencing (source === target) design.
  return {
    id: edgeId(controllerId, endpointId, 'HANDLES_ROUTE'),
    sourceId: controllerId,
    targetId: endpointId,
    edgeType: 'HANDLES_ROUTE',
    weight: 1,
    properties: { route },
  };
}

// ─── Main indexer ─────────────────────────────────────────────────────────────

export async function indexDotNetProject(opts: IndexOptions = {}): Promise<IndexResult> {
  const rootDir   = opts.rootDir ?? process.cwd();
  const startTime = Date.now();

  // Derive project metadata
  const projectId   = deriveProjectId(rootDir);
  let   projectName = path.basename(rootDir);

  // Try reading the project name from the first *.csproj
  try {
    const csproj = findFirstCsproj(rootDir);
    if (csproj) {
      projectName = path.basename(csproj, '.csproj');
    }
  } catch { /* use basename */ }

  const store = openGraphStore(rootDir, projectId);
  store.clearProject();

  // ── Locate / build the Roslyn analyzer DLL ──────────────────────────────────

  const dllPath = await resolveAnalyzerDll(rootDir, { quiet: opts.quiet });

  // ── Pass 1: Walk source files → invoke Roslyn → collect nodes ───────────────

  const csFiles = walkSourceFiles(rootDir);
  const total   = csFiles.length;

  const allNodes:  GraphNode[] = [];
  const allEdges:  GraphEdge[] = [];
  const fileNodeIdMap = new Map<string, string>();  // relPath → fileNodeId

  // Create File nodes before calling Roslyn
  for (let i = 0; i < csFiles.length; i++) {
    const absPath = csFiles[i];
    const relPath = path.relative(rootDir, absPath).replace(/\\/g, '/');

    opts.onProgress?.(relPath, i + 1, total);

    const fileNodeId = crypto
      .createHash('md5').update(`file:${relPath}`).digest('hex').slice(0, 16);
    fileNodeIdMap.set(relPath, fileNodeId);

    const ext = path.extname(absPath);
    allNodes.push({
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
      language:      langFromExt(ext),
      properties:    {},
    });
  }

  // Invoke the Roslyn analyzer (chunked to avoid huge argv)
  const CHUNK = 200;
  const parsedFiles = [];
  for (let i = 0; i < csFiles.length; i += CHUNK) {
    const chunk = csFiles.slice(i, i + CHUNK);
    const results = await analyzeFiles(dllPath, rootDir, chunk);
    parsedFiles.push(...results);
  }

  // Collect all symbol nodes and DEFINES edges
  const allRawCalls: Array<{ callerQualifiedName: string; calleeName: string; line: number }> = [];

  for (const parsed of parsedFiles) {
    const fileNodeId = fileNodeIdMap.get(parsed.filePath);

    for (const sym of parsed.nodes) {
      // Ensure the language field is populated
      const node: GraphNode = {
        ...sym,
        language: sym.language || 'csharp',
      };
      allNodes.push(node);
      if (fileNodeId) allEdges.push(definesEdge(fileNodeId, sym.id));
    }

    allRawCalls.push(...parsed.rawCalls);
  }

  // Batch-write all nodes to SQLite before edge resolution
  store.batchUpsertNodes(allNodes);

  // ── Pass 2: Resolve cross-symbol edges ──────────────────────────────────────

  // CALLS edges
  for (const raw of allRawCalls) {
    const callerNode = store.getNodeByQualifiedName(raw.callerQualifiedName);
    if (!callerNode) continue;
    const calleeNode = store.findNodeByExactName(raw.calleeName);
    if (!calleeNode) continue;
    allEdges.push(callsEdge(callerNode.id, calleeNode.id, raw.line));
  }

  // INHERITS, IMPLEMENTS, INJECTS, HANDLES_ROUTE edges
  // (derived from node.properties set by the Roslyn parser)
  for (const node of allNodes) {
    const props = node.properties ?? {};

    // INHERITS
    const baseClass = props['baseClass'] as string | undefined;
    if (baseClass) {
      const parentNode = store.findNodeByExactName(baseClass, 'Class') ??
                         store.findNodeByExactName(baseClass);
      if (parentNode) allEdges.push(inheritsEdge(node.id, parentNode.id));
    }

    // IMPLEMENTS
    const interfaces = props['interfaces'] as string[] | undefined;
    if (Array.isArray(interfaces)) {
      for (const iface of interfaces) {
        // Strip generic type params: IRepository<Foo> → IRepository
        const baseName = iface.replace(/<.*>/, '').trim();
        const ifaceNode = store.findNodeByExactName(baseName, 'Interface') ??
                          store.findNodeByExactName(baseName);
        if (ifaceNode) allEdges.push(implementsEdge(node.id, ifaceNode.id));
      }
    }

    // INJECTS (constructor DI)
    const injectedTypes = props['injectedTypes'] as string[] | undefined;
    if (Array.isArray(injectedTypes)) {
      for (const typeName of injectedTypes) {
        const baseName = typeName.replace(/<.*>/, '').trim();
        const serviceNode = store.findNodeByExactName(baseName);
        if (serviceNode && serviceNode.id !== node.id) {
          allEdges.push(injectsEdge(node.id, serviceNode.id, typeName));
        }
      }
    }

    // HANDLES_ROUTE (Controller → ApiEndpoint carrying the HTTP route string)
    // The route is already stored in node.properties.route for property queries.
    // The edge connects the owning Controller to this endpoint so callers can
    // traverse: Controller → [HANDLES_ROUTE] → ApiEndpoint → [CALLS] → Service.
    const route = props['route'] as string | undefined;
    if (route && node.label === 'ApiEndpoint') {
      // Derive the controller name from the qualified name:
      // "Controllers/TodoController.cs:TodoApp:TodoController:GetById" → "TodoController"
      const parts = node.qualifiedName.split(':');
      const controllerName = parts.find(p => p.endsWith('Controller'));
      if (controllerName) {
        const controllerNode = store.findNodeByExactName(controllerName, 'Controller');
        if (controllerNode) {
          allEdges.push(handlesRouteEdge(controllerNode.id, node.id, route));
        }
      }
    }
  }

  // Dedup edges by id
  const edgeMap = new Map<string, GraphEdge>();
  for (const e of allEdges) edgeMap.set(e.id, e);
  const uniqueEdges = [...edgeMap.values()];

  store.batchUpsertEdges(uniqueEdges);

  // ── Persist project metadata ─────────────────────────────────────────────────

  const indexedAt  = new Date().toISOString();
  const nodeCount  = allNodes.length;
  const edgeCount  = uniqueEdges.length;

  store.upsertProject({
    id:        projectId,
    name:      projectName,
    rootPath:  rootDir,
    indexedAt,
    nodeCount,
    edgeCount,
  });

  // Summary info
  const controllers = store.getNodesByLabel('Controller', 50);
  const hotspots    = store.getHotspots(5).map(h => ({ node: h.node, inDegree: h.inDegree }));

  store.close();

  return {
    projectId,
    name:      projectName,
    rootDir,
    nodeCount,
    edgeCount,
    fileCount: csFiles.length,
    durationMs: Date.now() - startTime,
    screens:   controllers,   // repurpose `screens` slot for controllers in the shared result type
    hotspots,
    indexedAt,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findFirstCsproj(rootDir: string): string | null {
  try {
    const entries = fs.readdirSync(rootDir);
    const csproj  = entries.find(e => e.endsWith('.csproj'));
    if (csproj) return path.join(rootDir, csproj);
    // One level deep
    for (const e of entries) {
      const sub = path.join(rootDir, e);
      if (fs.statSync(sub).isDirectory()) {
        const inner = fs.readdirSync(sub).find(f => f.endsWith('.csproj'));
        if (inner) return path.join(sub, inner);
      }
    }
  } catch { /* ignore */ }
  return null;
}
