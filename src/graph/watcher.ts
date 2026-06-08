/**
 * watcher.ts — Zero-dependency recursive file watcher
 *
 * Uses Node.js native fs.watch for real-time incremental re-indexing of modified files.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { openGraphStore } from './store.js';
import { parseFile, edgeId } from './parser.js';
import { isDotNetProject } from './dotnet/detector.js';
import { resolveAnalyzerDll, analyzeFiles } from './dotnet/analyzer.js';
import type { GraphNode, GraphEdge } from './types.js';

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage',
  '.expo', '__pycache__', '.gradle', 'Pods', 'DerivedData',
  '.turbo', '.next', 'out', '.cache', 'tmp', '.rn-token-optimizer',
]);

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.cs']);

function deriveProjectId(rootDir: string): string {
  return crypto.createHash('md5').update(rootDir).digest('hex').slice(0, 12);
}

function shouldIgnore(relPath: string): boolean {
  const parts = relPath.split(/[/\\]/);
  return parts.some(part => SKIP_DIRS.has(part) || (part.startsWith('.') && part !== '.kiro'));
}

/** Lightweight helper to determine language from file extension */
function langFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.ts':  return 'typescript';
    case '.tsx': return 'tsx';
    case '.js':  return 'javascript';
    case '.jsx': return 'jsx';
    case '.cs':  return 'csharp';
    default:     return 'typescript';
  }
}

/** Starts the recursive file watcher daemon */
export function startWatcher(rootDir = process.cwd(), callback?: (relPath: string, action: 'added_or_modified' | 'deleted') => void): fs.FSWatcher {
  const projectId = deriveProjectId(rootDir);
  const isDotNet = isDotNetProject(rootDir);
  
  let dllPath = '';
  if (isDotNet) {
    resolveAnalyzerDll(rootDir, { quiet: true }).then(resolved => {
      dllPath = resolved;
    }).catch(err => {
      console.error('[Watcher] Failed to resolve Roslyn analyzer DLL:', err.message);
    });
  }

  const debounceMap = new Map<string, NodeJS.Timeout>();

  console.log(`[Watcher] Starting native file watcher in: ${rootDir}`);
  console.log(`[Watcher] Project stack: ${isDotNet ? '.NET / C#' : 'React Native / TypeScript'}`);

  const watcher = fs.watch(rootDir, { recursive: true }, (_, filename) => {
    if (!filename) return;

    const relPath = filename.replace(/\\/g, '/');
    if (shouldIgnore(relPath)) return;

    const ext = path.extname(relPath).toLowerCase();
    if (!SOURCE_EXTENSIONS.has(ext)) return;

    const fullPath = path.join(rootDir, relPath);

    // Debounce to prevent double updates during rapid editor saves
    if (debounceMap.has(fullPath)) {
      clearTimeout(debounceMap.get(fullPath)!);
    }

    debounceMap.set(fullPath, setTimeout(async () => {
      debounceMap.delete(fullPath);
      
      const exists = fs.existsSync(fullPath);
      const store = openGraphStore(rootDir, projectId);
      
      try {
        if (!exists) {
          // File was deleted
          console.log(`[Watcher] Detected deletion: ${relPath}`);
          store.deleteFileNodesAndEdges(relPath);
          callback?.(relPath, 'deleted');
        } else {
          // File was added or modified
          console.log(`[Watcher] Detected change/addition: ${relPath}`);
          store.deleteFileNodesAndEdges(relPath);

          if (ext === '.cs') {
            await handleCSharpChange(store, relPath, fullPath, rootDir, dllPath);
          } else {
            handleTypeScriptChange(store, relPath, fullPath, rootDir);
          }
          callback?.(relPath, 'added_or_modified');
        }
      } catch (err) {
        console.error(`[Watcher] Error updating ${relPath}:`, err instanceof Error ? err.message : String(err));
      } finally {
        store.close();
      }
    }, 250));
  });

  return watcher;
}

function handleTypeScriptChange(store: any, relPath: string, fullPath: string, rootDir: string): void {
  const parsed = parseFile(fullPath, rootDir);
  if (!parsed) return;

  const fileNodeId = crypto.createHash('md5').update(`file:${relPath}`).digest('hex').slice(0, 16);

  // Re-insert File Node
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
    language:      langFromExt(path.extname(relPath)),
    properties:    {},
  };

  store.batchUpsertNodes([fileNode, ...parsed.nodes]);

  const newEdges: GraphEdge[] = [];

  // DEFINES edges
  for (const sym of parsed.nodes) {
    newEdges.push({
      id: edgeId(fileNodeId, sym.id, 'DEFINES'),
      sourceId: fileNodeId,
      targetId: sym.id,
      edgeType: 'DEFINES',
      weight: 1,
      properties: {},
    });
  }

  // IMPORTS edges
  for (const importedFile of parsed.importedFiles) {
    const targetFileId = crypto.createHash('md5').update(`file:${importedFile}`).digest('hex').slice(0, 16);
    // Only link if the target file node actually exists in SQLite
    const exists = store.getNodeById(targetFileId);
    if (exists) {
      newEdges.push({
        id: edgeId(fileNodeId, targetFileId, 'IMPORTS'),
        sourceId: fileNodeId,
        targetId: targetFileId,
        edgeType: 'IMPORTS',
        weight: 1,
        properties: {},
      });
    }
  }

  // CALLS edges
  for (const raw of parsed.rawCalls) {
    const callerNode = store.getNodeByQualifiedName(raw.callerQualifiedName);
    if (!callerNode) continue;
    const calleeNode = store.findNodeByExactName(raw.calleeName);
    if (!calleeNode) continue;
    newEdges.push({
      id: edgeId(callerNode.id, calleeNode.id, 'CALLS'),
      sourceId: callerNode.id,
      targetId: calleeNode.id,
      edgeType: 'CALLS',
      weight: 1,
      properties: { line: raw.line },
    });
  }

  // RENDERS edges
  for (const raw of parsed.rawRenders) {
    const callerNode = store.getNodeByQualifiedName(raw.callerQualifiedName);
    if (!callerNode) continue;
    const targetNode = store.findNodeByExactName(raw.renderedComponentName);
    if (!targetNode) continue;
    newEdges.push({
      id: edgeId(callerNode.id, targetNode.id, 'RENDERS'),
      sourceId: callerNode.id,
      targetId: targetNode.id,
      edgeType: 'RENDERS',
      weight: 1,
      properties: { line: raw.line },
    });
  }

  // NAVIGATES_TO edges
  for (const raw of parsed.rawNavigates) {
    const callerNode = store.getNodeByQualifiedName(raw.callerQualifiedName);
    if (!callerNode) continue;
    const targetNode =
      store.findNodeByExactName(raw.targetScreenName, 'Screen') ??
      store.findNodeByExactName(raw.targetScreenName + 'Screen', 'Screen') ??
      store.findNodeByExactName(raw.targetScreenName);
    if (!targetNode) continue;
    newEdges.push({
      id: edgeId(callerNode.id, targetNode.id, 'NAVIGATES_TO'),
      sourceId: callerNode.id,
      targetId: targetNode.id,
      edgeType: 'NAVIGATES_TO',
      weight: 1,
      properties: { line: raw.line, screenName: raw.targetScreenName },
    });
  }

  store.batchUpsertEdges(newEdges);
  console.log(`[Watcher] Successfully re-indexed ${relPath} (${parsed.nodes.length} symbols, ${newEdges.length} edges).`);
}

async function handleCSharpChange(store: any, relPath: string, fullPath: string, rootDir: string, dllPath: string): Promise<void> {
  if (!dllPath) {
    console.error('[Watcher] Cannot index C# change because Roslyn analyzer DLL is not resolved.');
    return;
  }

  const results = await analyzeFiles(dllPath, rootDir, [fullPath]);
  const parsed = results[0];
  if (!parsed) return;

  const fileNodeId = crypto.createHash('md5').update(`file:${relPath}`).digest('hex').slice(0, 16);

  // Re-insert File Node
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
    language:      'csharp',
    properties:    {},
  };

  const newNodes = parsed.nodes.map(n => ({ ...n, language: n.language || 'csharp' }));
  store.batchUpsertNodes([fileNode, ...newNodes]);

  const newEdges: GraphEdge[] = [];

  // DEFINES edges
  for (const sym of parsed.nodes) {
    newEdges.push({
      id: edgeId(fileNodeId, sym.id, 'DEFINES'),
      sourceId: fileNodeId,
      targetId: sym.id,
      edgeType: 'DEFINES',
      weight: 1,
      properties: {},
    });
  }

  // CALLS edges
  for (const raw of parsed.rawCalls) {
    const callerNode = store.getNodeByQualifiedName(raw.callerQualifiedName);
    if (!callerNode) continue;
    const calleeNode = store.findNodeByExactName(raw.calleeName);
    if (!calleeNode) continue;
    newEdges.push({
      id: edgeId(callerNode.id, calleeNode.id, 'CALLS'),
      sourceId: callerNode.id,
      targetId: calleeNode.id,
      edgeType: 'CALLS',
      weight: 1,
      properties: { line: raw.line },
    });
  }

  // Resolve OOP & routing properties
  for (const node of newNodes) {
    const props = node.properties ?? {};

    // INHERITS
    const baseClass = props['baseClass'] as string | undefined;
    if (baseClass) {
      const parentNode = store.findNodeByExactName(baseClass, 'Class') ?? store.findNodeByExactName(baseClass);
      if (parentNode) {
        newEdges.push({
          id: edgeId(node.id, parentNode.id, 'INHERITS'),
          sourceId: node.id,
          targetId: parentNode.id,
          edgeType: 'INHERITS',
          weight: 1,
          properties: {},
        });
      }
    }

    // IMPLEMENTS
    const interfaces = props['interfaces'] as string[] | undefined;
    if (Array.isArray(interfaces)) {
      for (const iface of interfaces) {
        const baseName = iface.replace(/<.*>/, '').trim();
        const ifaceNode = store.findNodeByExactName(baseName, 'Interface') ?? store.findNodeByExactName(baseName);
        if (ifaceNode) {
          newEdges.push({
            id: edgeId(node.id, ifaceNode.id, 'IMPLEMENTS'),
            sourceId: node.id,
            targetId: ifaceNode.id,
            edgeType: 'IMPLEMENTS',
            weight: 1,
            properties: {},
          });
        }
      }
    }

    // INJECTS
    const injectedTypes = props['injectedTypes'] as string[] | undefined;
    if (Array.isArray(injectedTypes)) {
      for (const typeName of injectedTypes) {
        const baseName = typeName.replace(/<.*>/, '').trim();
        const serviceNode = store.findNodeByExactName(baseName);
        if (serviceNode && serviceNode.id !== node.id) {
          newEdges.push({
            id: edgeId(node.id, serviceNode.id, 'INJECTS'),
            sourceId: node.id,
            targetId: serviceNode.id,
            edgeType: 'INJECTS',
            weight: 1,
            properties: { typeName },
          });
        }
      }
    }

    // HANDLES_ROUTE
    const route = props['route'] as string | undefined;
    if (route && node.label === 'ApiEndpoint') {
      const parts = node.qualifiedName.split(':');
      const controllerName = parts.find(p => p.endsWith('Controller'));
      if (controllerName) {
        const controllerNode = store.findNodeByExactName(controllerName, 'Controller');
        if (controllerNode) {
          newEdges.push({
            id: edgeId(controllerNode.id, node.id, 'HANDLES_ROUTE'),
            sourceId: controllerNode.id,
            targetId: node.id,
            edgeType: 'HANDLES_ROUTE',
            weight: 1,
            properties: { route },
          });
        }
      }
    }
  }

  store.batchUpsertEdges(newEdges);
  console.log(`[Watcher] Successfully re-indexed C# ${relPath} (${newNodes.length} symbols, ${newEdges.length} edges).`);
}
