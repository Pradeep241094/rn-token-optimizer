/**
 * analyzer.ts — Roslyn analyzer binary manager + invocation bridge
 *
 * Lifecycle:
 *   1. Look for a pre-built DLL in the npm package's roslyn-analyzer/ folder.
 *   2. If not found, check the per-project cache at
 *      <rootDir>/.rn-token-optimizer/dotnet-analyzer/
 *   3. If still not found, auto-build from source using `dotnet publish`.
 *   4. Invoke: `dotnet <dll> <rootDir>` with file paths on stdin, JSON on stdout.
 *
 * The subprocess protocol:
 *   stdin  — JSON array of absolute *.cs file paths
 *   stdout — AnalysisOutput JSON  { files: ParsedFileResult[], errors: ErrorResult[] }
 *   args[0]— project root directory (for computing relative paths inside C#)
 */

import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import type { ParsedFile } from '../types.js';

const execFileAsync = promisify(execFile);

// ─── Types that mirror the C# Models.cs output ───────────────────────────────

interface RoslynGraphNode {
  id: string;
  label: string;
  name: string;
  qualifiedName: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  signature: string;
  exported: boolean;
  async: boolean;
  language: string;
  properties: Record<string, unknown>;
}

interface RoslynRawCallRef {
  callerQualifiedName: string;
  calleeName: string;
  line: number;
}

interface RoslynParsedFile {
  filePath: string;
  nodes: RoslynGraphNode[];
  importedFiles: string[];
  rawCalls: RoslynRawCallRef[];
  rawNavigates: unknown[];
  rawRenders: unknown[];
}

interface RoslynOutput {
  files: RoslynParsedFile[];
  errors: Array<{ filePath: string; error: string }>;
}

// ─── Binary resolution ────────────────────────────────────────────────────────

const DLL_NAME = 'rn-token-optimizer-roslyn.dll';
const CACHE_SUBDIR = path.join('.rn-token-optimizer', 'dotnet-analyzer');

/**
 * Resolves (and if necessary builds) the Roslyn analyzer DLL path.
 * Returns the absolute path to the DLL to pass to `dotnet`.
 */
export async function resolveAnalyzerDll(
  rootDir: string,
  opts: { quiet?: boolean } = {},
): Promise<string> {
  // 1. Explicit env override
  const envPath = process.env['RN_ROSLYN_ANALYZER_PATH'];
  if (envPath && fs.existsSync(envPath)) return envPath;

  // 2. Pre-built alongside this package (after `dotnet publish` at publish time)
  const pkgDir    = packageRootDir();
  const pkgBuilt  = path.join(pkgDir, 'roslyn-analyzer', 'publish', DLL_NAME);
  if (fs.existsSync(pkgBuilt)) return pkgBuilt;

  // 3. Per-project cache
  const cacheDir  = path.join(rootDir, CACHE_SUBDIR);
  const cacheDll  = path.join(cacheDir, DLL_NAME);
  if (fs.existsSync(cacheDll)) return cacheDll;

  // 4. Auto-build from source
  const sourceDir = path.join(pkgDir, 'roslyn-analyzer');
  if (!fs.existsSync(path.join(sourceDir, 'RoslynAnalyzer.csproj'))) {
    throw new Error(
      'Roslyn analyzer source not found. ' +
      'Ensure the rn-token-optimizer package is fully installed.',
    );
  }

  await assertDotnetAvailable();

  if (!opts.quiet) {
    process.stderr.write(
      '[rn-token-optimizer] Building Roslyn analyzer (first run — one-time setup)…\n',
    );
  }

  fs.mkdirSync(cacheDir, { recursive: true });

  await execFileAsync('dotnet', [
    'publish',
    sourceDir,
    '-c', 'Release',
    '-o', cacheDir,
    '--nologo',
    '-v', 'quiet',
  ]);

  if (!fs.existsSync(cacheDll)) {
    throw new Error(
      `dotnet publish succeeded but DLL not found at: ${cacheDll}\n` +
      'Check that the project builds cleanly with: dotnet build roslyn-analyzer/',
    );
  }

  if (!opts.quiet) {
    process.stderr.write('[rn-token-optimizer] Roslyn analyzer ready.\n');
  }

  return cacheDll;
}

// ─── Invocation ───────────────────────────────────────────────────────────────

/**
 * Runs the Roslyn analyzer against the given absolute file paths and returns
 * `ParsedFile[]` in the same format the TypeScript indexer produces.
 */
export async function analyzeFiles(
  dllPath: string,
  rootDir: string,
  absoluteFilePaths: string[],
): Promise<ParsedFile[]> {
  if (absoluteFilePaths.length === 0) return [];

  const stdinPayload = JSON.stringify(absoluteFilePaths);

  const output = await runDotnet(dllPath, rootDir, stdinPayload);

  let parsed: RoslynOutput;
  try {
    parsed = JSON.parse(output) as RoslynOutput;
  } catch (err) {
    throw new Error(
      `Roslyn analyzer produced invalid JSON.\n` +
      `Raw output (first 500 chars):\n${output.slice(0, 500)}\n` +
      `Parse error: ${String(err)}`,
    );
  }

  if (parsed.errors?.length > 0) {
    for (const e of parsed.errors) {
      process.stderr.write(
        `[rn-token-optimizer] Roslyn: skipped ${e.filePath}: ${e.error}\n`,
      );
    }
  }

  return parsed.files.map(toParseFile);
}

// ─── Format conversion ────────────────────────────────────────────────────────

function toParseFile(r: RoslynParsedFile): ParsedFile {
  return {
    filePath: r.filePath,
    nodes: r.nodes as ParsedFile['nodes'],   // same shape; C# already emits correct fields
    importedFiles: r.importedFiles,
    rawCalls: r.rawCalls,
    rawNavigates: [],
    rawRenders: [],
  };
}

// ─── Process helpers ──────────────────────────────────────────────────────────

function runDotnet(
  dllPath: string,
  rootDir: string,
  stdinData: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('dotnet', [dllPath, rootDir], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    proc.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    proc.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));

    proc.on('error', (err) => reject(
      new Error(`Failed to spawn dotnet: ${err.message}. Is the .NET runtime installed?`),
    ));

    proc.on('close', (code) => {
      if (code !== 0) {
        const errMsg = Buffer.concat(stderr).toString('utf8');
        reject(new Error(
          `Roslyn analyzer exited with code ${code}.\nstderr:\n${errMsg}`,
        ));
        return;
      }
      resolve(Buffer.concat(stdout).toString('utf8'));
    });

    proc.stdin.write(stdinData, 'utf8');
    proc.stdin.end();
  });
}

async function assertDotnetAvailable(): Promise<void> {
  try {
    await execFileAsync('dotnet', ['--version']);
  } catch {
    throw new Error(
      'The .NET SDK is required to index .NET projects.\n' +
      'Install it from https://dot.net and re-run `rn-token-optimizer graph index`.',
    );
  }
}

function packageRootDir(): string {
  // Works whether the package is installed from npm or run from source
  const here = fileURLToPath(import.meta.url);   // …/src/graph/dotnet/analyzer.js
  return path.resolve(here, '../../../../');       // up 4 levels → package root
}
