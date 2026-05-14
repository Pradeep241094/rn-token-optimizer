import { defineConfig } from 'tsup';

const isDev = process.env.NODE_ENV === 'development';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: isDev,
    clean: true,
    splitting: false,
    treeshake: true,
    outDir: 'dist',
    external: ['tiktoken', 'better-sqlite3', '@typescript-eslint/typescript-estree'],
  },
  {
    entry: { 'cli/index': 'src/cli/index.ts' },
    format: ['esm'],
    dts: false,
    sourcemap: isDev,
    splitting: false,
    treeshake: true,
    outDir: 'dist',
    banner: { js: '#!/usr/bin/env node' },
    // Mark ALL npm packages as external — chalk v5 is pure ESM (breaks CJS),
    // @inquirer/prompts uses yoctocolors-cjs (breaks when bundled into ESM).
    // Keeping them external lets Node load each from node_modules in its own
    // native format, avoiding the ESM↔CJS bundling conflict entirely.
    external: [/^[^./]/],
    platform: 'node',
  },
  {
    entry: { 'mcp/index': 'src/mcp/index.ts' },
    format: ['esm'],
    dts: false,
    sourcemap: isDev,
    splitting: false,
    treeshake: true,
    outDir: 'dist',
    banner: { js: '#!/usr/bin/env node' },
    external: [
      'tiktoken',
      'better-sqlite3',
      '@typescript-eslint/typescript-estree',
      'tty', 'os', 'fs', 'path', 'readline', 'stream', 'events',
      'util', 'net', 'dns', 'http', 'https', 'crypto', 'url',
      'assert', 'buffer', 'process', 'child_process',
    ],
    platform: 'node',
  },
]);
