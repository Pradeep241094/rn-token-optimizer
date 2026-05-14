/**
 * projectIndexer.ts
 *
 * Scans a React Native project and builds a compact steering document that
 * is stored at .rn-token-optimizer/project-context.md.
 *
 * The document is injected into every subsequent optimize_prompt /
 * compress_output call so the LLM gets project-aware, pinpoint answers
 * instead of generic React Native advice.
 *
 * What it extracts (all deterministic, no API key needed):
 *   • Package name + RN version
 *   • Key dependencies mapped to DSL aliases
 *   • Compact directory tree (skips node_modules/dist/build)
 *   • Requirement files  (.kiro/specs, docs/, *.requirements.md, *.stories.*)
 *   • Key architectural files (navigators, store, entry points)
 *   • Custom alias candidates derived from component/screen/hook names
 *   • Token + file statistics
 */

import fs from 'node:fs';
import path from 'node:path';
import { countTokensSync } from './tokenCounter.js';
import type { ProjectIndex, ProjectDep, RequirementFile } from '../types/index.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage',
  '.expo', '__pycache__', '.gradle', 'Pods', 'DerivedData',
  '.turbo', '.next', 'out', '.cache', 'tmp',
]);

const TREE_MAX_DEPTH   = 4;
const TREE_MAX_FILES   = 8;   // max files shown per directory
const CONTEXT_FILE     = '.rn-token-optimizer/project-context.md';

// DSL alias map for well-known React Native dependencies
const DEP_DSL_MAP: Record<string, string> = {
  '@react-navigation/native':           'NAV',
  '@react-navigation/native-stack':     'NAV',
  '@react-navigation/stack':            'NAV',
  '@react-navigation/bottom-tabs':      'NAV',
  '@react-navigation/drawer':           'NAV',
  'redux':                              'REDUX',
  '@reduxjs/toolkit':                   'REDUX',
  'zustand':                            'STATE',
  'recoil':                             'STATE',
  'mobx':                               'STATE',
  'mobx-react-lite':                    'STATE',
  '@tanstack/react-query':              'QUERY',
  'react-query':                        'QUERY',
  'axios':                              'HTTP',
  'react-native-mmkv':                  'STORE',
  '@react-native-async-storage/async-storage': 'STORE',
  'react-native-reanimated':            'ANIM',
  'react-native-gesture-handler':       'GESTURE',
  'react-native-screens':               'SCREENS',
  'react-native-safe-area-context':     'SAFE',
  'react-native-firebase':              'FIRE',
  '@react-native-firebase/app':         'FIRE',
  '@react-native-firebase/auth':        'FIREAUTH',
  '@react-native-google-signin/google-signin': 'GSIGN',
  'react-native-google-signin':         'GSIGN',
  '@react-native-community/netinfo':    'NET',
  'react-native-push-notification':     'PUSH',
  '@notifee/react-native':              'PUSH',
  'react-native-image-picker':          'IMG',
  'react-native-camera':                'CAM',
  'react-native-maps':                  'MAPS',
  'react-native-permissions':           'PERM',
  '@react-native-community/datetimepicker': 'DTP',
  'react-native-svg':                   'SVG',
  'react-native-paper':                 'UI',
  '@shopify/restyle':                   'UI',
  'native-base':                        'UI',
  'react-native-elements':              'UI',
  'react-native-vector-icons':          'ICONS',
  '@expo/vector-icons':                 'ICONS',
  'jest':                               'JEST',
  '@testing-library/react-native':      'RNTL',
  'detox':                              'E2E',
  'typescript':                         'TS',
  'eslint':                             'LINT',
  'prettier':                           'FMT',
};

// Requirement file patterns (relative path fragments or glob-like)
const REQUIREMENT_PATTERNS: { pattern: RegExp; type: RequirementFile['type'] }[] = [
  { pattern: /\.kiro[/\\]specs/i,                      type: 'spec'         },
  { pattern: /requirements?\.md$/i,                    type: 'requirements' },
  { pattern: /requirements?\.txt$/i,                   type: 'requirements' },
  { pattern: /\.requirements\./i,                      type: 'requirements' },
  { pattern: /stories?\.(tsx?|jsx?|md)$/i,             type: 'story'        },
  { pattern: /\.stories\./i,                           type: 'story'        },
  { pattern: /design\.md$/i,                           type: 'design'       },
  { pattern: /spec(s)?\/.*\.(md|txt)$/i,               type: 'spec'         },
  { pattern: /tasks?\.md$/i,                           type: 'spec'         },
  { pattern: /acceptance[_-]criteria/i,                type: 'spec'         },
  { pattern: /user[_-]stor(y|ies)/i,                   type: 'story'        },
  { pattern: /^readme\.md$/i,                          type: 'readme'       },
  { pattern: /changelog\.md$/i,                        type: 'changelog'    },
  { pattern: /architecture\.md$/i,                     type: 'design'       },
  { pattern: /docs?\/.*\.md$/i,                        type: 'requirements' },
];

// Key architectural file patterns — navigator roots, store, entry points
const KEY_FILE_PATTERNS: RegExp[] = [
  /App\.(tsx?|jsx?)$/,
  /index\.(tsx?|jsx?)$/,
  /RootNavigator\.(tsx?|jsx?)$/,
  /AppNavigator\.(tsx?|jsx?)$/,
  /Navigation\.(tsx?|jsx?)$/,
  /store\.(tsx?|jsx?)$/,
  /store\/index\.(tsx?|jsx?)$/,
  /redux\/index\.(tsx?|jsx?)$/,
  /main\.(tsx?|jsx?)$/,
  /routes?\.(tsx?|jsx?)$/,
  /router\.(tsx?|jsx?)$/,
  /android\/app\/build\.gradle$/,
  /ios\/.*\.xcodeproj\/project\.pbxproj$/,
];

// Component/screen name pattern for custom alias extraction
const COMPONENT_NAME_RE = /([A-Z][a-zA-Z0-9]+(?:Screen|Component|Navigator|Stack|Provider|Context|Hook|Store|Slice|Service|Manager|Controller))/g;

// ─── Directory tree builder ───────────────────────────────────────────────────

interface TreeNode {
  name: string;
  isDir: boolean;
  children?: TreeNode[];
}

function buildTree(dir: string, depth = 0, maxDepth = TREE_MAX_DEPTH): TreeNode | null {
  if (depth > maxDepth) return null;
  const name = path.basename(dir);
  if (SKIP_DIRS.has(name)) return null;

  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return null; }

  const dirs: TreeNode[]  = [];
  const files: TreeNode[] = [];

  for (const e of entries) {
    if (e.name.startsWith('.') && !e.name.startsWith('.kiro') && !e.name.startsWith('.env')) continue;
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      const child = buildTree(path.join(dir, e.name), depth + 1, maxDepth);
      if (child) dirs.push(child);
    } else {
      files.push({ name: e.name, isDir: false });
    }
  }

  const shownFiles = files.slice(0, TREE_MAX_FILES);
  const hiddenCount = files.length - shownFiles.length;
  const children = [
    ...dirs,
    ...shownFiles,
    ...(hiddenCount > 0 ? [{ name: `…+${hiddenCount} more`, isDir: false }] : []),
  ];

  return { name, isDir: true, children };
}

function renderTree(node: TreeNode, prefix = '', isLast = true): string {
  const connector = isLast ? '└─ ' : '├─ ';
  const childPrefix = isLast ? '   ' : '│  ';
  let out = prefix + connector + node.name + (node.isDir ? '/' : '') + '\n';
  if (node.children) {
    node.children.forEach((child, i) => {
      out += renderTree(child, prefix + childPrefix, i === (node.children!.length - 1));
    });
  }
  return out;
}

function buildCompactTree(rootDir: string): string {
  const tree = buildTree(rootDir);
  if (!tree) return '(could not read directory)';
  let out = path.basename(rootDir) + '/\n';
  if (tree.children) {
    tree.children.forEach((child, i) => {
      out += renderTree(child, '', i === (tree.children!.length - 1));
    });
  }
  return out;
}

// ─── Package.json reader ──────────────────────────────────────────────────────

interface PkgJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

function readPackageJson(rootDir: string): PkgJson | null {
  try {
    const raw = fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8');
    return JSON.parse(raw) as PkgJson;
  } catch {
    return null;
  }
}

function extractRNVersion(pkg: PkgJson): string | undefined {
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  const raw = allDeps['react-native'];
  if (!raw) return undefined;
  return raw.replace(/^[^~]?[~^]/, '');
}

function extractKeyDeps(pkg: PkgJson): ProjectDep[] {
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  const deps: ProjectDep[] = [];
  for (const [name, version] of Object.entries(allDeps)) {
    const dslAlias = DEP_DSL_MAP[name];
    if (dslAlias || name.startsWith('react-native-') || name.startsWith('@react-native')) {
      deps.push({ name, version: version.replace(/^[^~]?[~^]/, ''), dslAlias });
    }
  }
  return deps;
}

// ─── Requirement file finder ──────────────────────────────────────────────────

function findRequirementFiles(rootDir: string): RequirementFile[] {
  const results: RequirementFile[] = [];
  const skipDirs = new Set([...SKIP_DIRS, 'android', 'ios']);

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }

    for (const e of entries) {
      const fullPath = path.join(dir, e.name);
      const relPath  = path.relative(rootDir, fullPath);

      if (e.isDirectory()) {
        if (!skipDirs.has(e.name)) walk(fullPath);
        continue;
      }

      for (const { pattern, type } of REQUIREMENT_PATTERNS) {
        if (pattern.test(relPath) || pattern.test(e.name)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines   = content.split('\n').length;
            const tokens  = countTokensSync(content).tokens;
            // Extract first meaningful heading or sentence as summary
            const headingMatch = content.match(/^#{1,3}\s+(.+)$/m);
            const summary = headingMatch
              ? headingMatch[1].trim()
              : content.split('\n').find(l => l.trim().length > 10)?.trim().slice(0, 80);
            results.push({ path: relPath, type, lines, tokens, summary });
          } catch {
            results.push({ path: relPath, type, lines: 0, tokens: 0 });
          }
          break;
        }
      }
    }
  }

  walk(rootDir);
  return results.sort((a, b) => b.tokens - a.tokens);
}

// ─── Key file finder ──────────────────────────────────────────────────────────

function findKeyFiles(rootDir: string): string[] {
  const results: string[] = [];
  const skipDirs = new Set([...SKIP_DIRS]);

  function walk(dir: string, depth = 0): void {
    if (depth > 5) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }

    for (const e of entries) {
      const fullPath = path.join(dir, e.name);
      const relPath  = path.relative(rootDir, fullPath);
      if (e.isDirectory()) {
        if (!skipDirs.has(e.name)) walk(fullPath, depth + 1);
      } else {
        for (const pattern of KEY_FILE_PATTERNS) {
          if (pattern.test(relPath)) {
            results.push(relPath);
            break;
          }
        }
      }
    }
  }

  walk(rootDir);
  return results.slice(0, 20);
}

// ─── Custom alias extractor ───────────────────────────────────────────────────

function extractCustomAliases(rootDir: string): string[] {
  const counts = new Map<string, number>();
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];
  const skipDirs = new Set([...SKIP_DIRS, 'android', 'ios']);

  function walk(dir: string, depth = 0): void {
    if (depth > 4) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }

    for (const e of entries) {
      const fullPath = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!skipDirs.has(e.name)) walk(fullPath, depth + 1);
      } else if (extensions.includes(path.extname(e.name))) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const matches = content.match(COMPONENT_NAME_RE) ?? [];
          for (const m of matches) {
            counts.set(m, (counts.get(m) ?? 0) + 1);
          }
        } catch { /* skip */ }
      }
    }
  }

  walk(rootDir);

  // Return names that appear 3+ times — they're central enough to alias
  return [...counts.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name]) => name);
}

// ─── File statistics ──────────────────────────────────────────────────────────

function collectStats(rootDir: string): { totalFiles: number; totalTokens: number; tsFiles: number; testFiles: number } {
  let totalFiles = 0, totalTokens = 0, tsFiles = 0, testFiles = 0;
  const skipDirs = new Set([...SKIP_DIRS, 'android', 'ios']);

  function walk(dir: string, depth = 0): void {
    if (depth > 6) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }

    for (const e of entries) {
      if (e.isDirectory()) {
        if (!skipDirs.has(e.name)) walk(path.join(dir, e.name), depth + 1);
      } else if (['.ts', '.tsx', '.js', '.jsx'].includes(path.extname(e.name))) {
        totalFiles++;
        if (['.ts', '.tsx'].includes(path.extname(e.name))) tsFiles++;
        if (e.name.includes('.test.') || e.name.includes('.spec.')) testFiles++;
        try {
          const content = fs.readFileSync(path.join(dir, e.name), 'utf8');
          totalTokens += countTokensSync(content).tokens;
        } catch { /* skip */ }
      }
    }
  }

  walk(rootDir);
  return { totalFiles, totalTokens, tsFiles, testFiles };
}

// ─── Context document builder ─────────────────────────────────────────────────

function buildContextDoc(idx: Omit<ProjectIndex, 'contextDoc'>): string {
  const lines: string[] = [];

  lines.push(`# Project Context — ${idx.name}`);
  lines.push(`_Indexed: ${idx.indexedAt.slice(0, 10)}_`);
  lines.push('');

  // Stack
  lines.push('## Stack');
  if (idx.rnVersion) lines.push(`- RN: ${idx.rnVersion}`);
  for (const dep of idx.stack.filter(d => d.dslAlias)) {
    lines.push(`- ${dep.dslAlias}=${dep.name}@${dep.version}`);
  }
  const unlabelled = idx.stack.filter(d => !d.dslAlias).slice(0, 6);
  if (unlabelled.length > 0) {
    lines.push('- Other: ' + unlabelled.map(d => `${d.name}@${d.version}`).join(', '));
  }
  lines.push('');

  // File tree
  lines.push('## Structure');
  lines.push('```');
  lines.push(idx.tree);
  lines.push('```');
  lines.push('');

  // Stats
  lines.push('## Stats');
  lines.push(`- ${idx.stats.totalFiles} src files  ${idx.stats.tsFiles} TS  ${idx.stats.testFiles} tests  ~${idx.stats.totalTokens.toLocaleString()} tokens`);
  lines.push('');

  // Key architectural files
  if (idx.keyFiles.length > 0) {
    lines.push('## Key Files');
    for (const f of idx.keyFiles) lines.push(`- ${f}`);
    lines.push('');
  }

  // Custom aliases worth learning
  if (idx.customAliases.length > 0) {
    lines.push('## Frequent Components (alias candidates)');
    lines.push(idx.customAliases.slice(0, 12).join('  '));
    lines.push('');
  }

  // Requirement / spec files
  if (idx.requirementFiles.length > 0) {
    lines.push('## Requirements & Specs');
    for (const r of idx.requirementFiles.slice(0, 15)) {
      const summary = r.summary ? `  — ${r.summary}` : '';
      lines.push(`- [${r.type}] ${r.path}  (${r.tokens} tokens)${summary}`);
    }
    lines.push('');
    lines.push('> To include a requirement file in a prompt, reference it by path.');
  }

  return lines.join('\n');
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface IndexOptions {
  rootDir?: string;         // default: process.cwd()
  quiet?: boolean;
  includeRequirementContent?: boolean;  // embed content of small req files
}

export function runProjectIndex(opts: IndexOptions = {}): ProjectIndex {
  const rootDir = opts.rootDir ?? process.cwd();
  const pkg     = readPackageJson(rootDir);
  const name    = pkg?.name ?? path.basename(rootDir);

  const stack          = pkg ? extractKeyDeps(pkg) : [];
  const rnVersion      = pkg ? extractRNVersion(pkg) : undefined;
  const tree           = buildCompactTree(rootDir);
  const requirementFiles = findRequirementFiles(rootDir);
  const keyFiles       = findKeyFiles(rootDir);
  const customAliases  = extractCustomAliases(rootDir);
  const stats          = collectStats(rootDir);

  const base: Omit<ProjectIndex, 'contextDoc'> = {
    name,
    root: rootDir,
    indexedAt: new Date().toISOString(),
    rnVersion,
    stack,
    tree,
    requirementFiles,
    keyFiles,
    customAliases,
    stats,
  };

  const contextDoc = buildContextDoc(base);

  return { ...base, contextDoc };
}

// ─── Persistence ──────────────────────────────────────────────────────────────

export function saveProjectIndex(idx: ProjectIndex, rootDir = process.cwd()): string {
  const dir      = path.join(rootDir, '.rn-token-optimizer');
  const filePath = path.join(rootDir, CONTEXT_FILE);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, idx.contextDoc, 'utf8');

  // Also save full JSON for programmatic use
  const jsonPath = path.join(dir, 'project-index.json');
  const { contextDoc: _, ...rest } = idx;   // don't duplicate the doc in JSON
  fs.writeFileSync(jsonPath, JSON.stringify({ ...rest, contextDocPath: CONTEXT_FILE }, null, 2), 'utf8');

  return filePath;
}

export function loadProjectContext(rootDir = process.cwd()): string | null {
  const filePath = path.join(rootDir, CONTEXT_FILE);
  try {
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  } catch {
    return null;
  }
}

export function loadProjectIndex(rootDir = process.cwd()): Omit<ProjectIndex, 'contextDoc'> | null {
  const jsonPath = path.join(rootDir, '.rn-token-optimizer', 'project-index.json');
  try {
    if (!fs.existsSync(jsonPath)) return null;
    return JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as Omit<ProjectIndex, 'contextDoc'>;
  } catch {
    return null;
  }
}
