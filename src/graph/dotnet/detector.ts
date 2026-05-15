/**
 * detector.ts — .NET project detection and C# source-file walker
 *
 * A directory is treated as a .NET project when it contains at least one
 * *.csproj / *.fsproj / *.vbproj or *.sln file within the first two levels,
 * AND has at least one *.cs source file anywhere in the tree.
 */

import fs from 'node:fs';
import path from 'node:path';

// ─── Constants ────────────────────────────────────────────────────────────────

const DOTNET_PROJECT_EXTENSIONS = new Set([
  '.csproj', '.fsproj', '.vbproj', '.sln',
]);

const DOTNET_SOURCE_EXTENSIONS = new Set(['.cs', '.vb', '.fs']);

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage',
  'obj', 'bin', '.vs', '.idea', 'packages',
  '__pycache__', '.gradle', 'Pods', 'DerivedData',
  '.turbo', '.next', 'out', '.cache', 'tmp',
  '.rn-token-optimizer',
]);

// ─── Project detection ────────────────────────────────────────────────────────

/**
 * Returns true when the directory looks like a .NET project.
 * Checks two levels deep for a project/solution file.
 */
export function isDotNetProject(rootDir: string): boolean {
  return (
    hasProjectFile(rootDir, 0) &&
    walkSourceFiles(rootDir).length > 0
  );
}

function hasProjectFile(dir: string, depth: number): boolean {
  if (depth > 2) return false;
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return false; }

  for (const e of entries) {
    if (e.isFile() && DOTNET_PROJECT_EXTENSIONS.has(path.extname(e.name).toLowerCase())) {
      return true;
    }
    if (e.isDirectory() && !SKIP_DIRS.has(e.name)) {
      if (hasProjectFile(path.join(dir, e.name), depth + 1)) return true;
    }
  }
  return false;
}

// ─── Source-file walker ───────────────────────────────────────────────────────

/**
 * Recursively collects all *.cs (and *.vb, *.fs) files under `rootDir`,
 * skipping known non-source directories.
 */
export function walkSourceFiles(rootDir: string): string[] {
  const results: string[] = [];

  function walk(dir: string, depth: number): void {
    if (depth > 10) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }

    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);

      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(full, depth + 1);
      } else if (DOTNET_SOURCE_EXTENSIONS.has(path.extname(e.name).toLowerCase())) {
        results.push(full);
      }
    }
  }

  walk(rootDir, 0);
  return results;
}

// ─── Language helper ──────────────────────────────────────────────────────────

export function langFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.cs':  return 'csharp';
    case '.vb':  return 'vb.net';
    case '.fs':  return 'fsharp';
    default:     return 'csharp';
  }
}
