/**
 * graph — CLI subcommand for the code intelligence engine
 *
 * Subcommands:
 *   graph index      — full AST index of the project
 *   graph search     — search nodes by name / label / file
 *   graph trace      — BFS call chain for a function
 *   graph architecture — codebase overview
 *   graph dead-code  — zero-callers detection
 *   graph changes    — git diff → affected symbols + blast radius
 *   graph snippet    — print source for a qualified name
 *   graph query      — Cypher-lite structural query
 */

import path from 'node:path';
import { execSync } from 'node:child_process';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { indexProject } from '../../graph/indexer.js';
import { searchGraph, traceCallPath, getArchitecture, detectChanges, findDeadCode, getCodeSnippet, simpleQueryGraph } from '../../graph/query.js';
import type { NodeLabel } from '../../graph/types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const div = chalk.dim('─'.repeat(60));

function resolveRoot(dirOpt?: string): string {
  return dirOpt ? path.resolve(dirOpt) : process.cwd();
}

// ─── graph index ─────────────────────────────────────────────────────────────

async function cmdIndex(opts: { dir?: string; force?: boolean }): Promise<void> {
  const rootDir = resolveRoot(opts.dir);
  const spinner = ora({ text: `Indexing ${chalk.cyan(rootDir)} …`, stream: process.stderr }).start();

  let lastFile = '';
  const result = await indexProject({
    rootDir,
    force: opts.force,
    onProgress: (file, cur, total) => {
      lastFile = file;
      spinner.text = `[${cur}/${total}] ${chalk.dim(file)}`;
    },
  });

  spinner.succeed(chalk.green(`Indexed in ${result.durationMs}ms`));
  void lastFile; // suppress unused

  // Detect language from the first indexed node's language field
  const isDotNet = result.screens.length > 0 && result.screens[0].language === 'csharp';

  console.log('\n' + div);
  console.log(chalk.bold.cyan(`  🔍 Code Intelligence — ${result.name}`));
  console.log(div);
  console.log(`  Files indexed : ${chalk.yellow(result.fileCount)}`);
  const nodeDesc = isDotNet
    ? '(classes, methods, controllers, services…)'
    : '(functions, classes, screens, hooks…)';
  const edgeDesc = isDotNet
    ? '(calls, defines, injects, implements)'
    : '(calls, imports, renders, navigates)';
  console.log(`  Nodes         : ${chalk.yellow(result.nodeCount)}  ${chalk.dim(nodeDesc)}`);
  console.log(`  Edges         : ${chalk.yellow(result.edgeCount)}  ${chalk.dim(edgeDesc)}`);
  console.log(`  Duration      : ${chalk.dim(result.durationMs + 'ms')}`);

  // .NET: show Controllers; RN: show Screens
  if (result.screens.length > 0) {
    const sectionLabel = isDotNet ? 'Controllers found' : 'Screens found';
    console.log(chalk.bold.cyan(`\n  ${sectionLabel}:`));
    for (const s of result.screens.slice(0, 8)) {
      console.log(`    ${chalk.white(s.name)}  ${chalk.dim(s.filePath + ':' + s.lineStart)}`);
    }
    if (result.screens.length > 8) console.log(chalk.dim(`    …+${result.screens.length - 8} more`));
  }

  if (result.hotspots.length > 0) {
    console.log(chalk.bold.cyan('\n  Hotspots (most-called):'));
    for (const h of result.hotspots) {
      console.log(`    ${chalk.white(h.node.name)}  ${chalk.dim(`(${h.inDegree} callers)`)}  ${chalk.dim(h.node.filePath)}`);
    }
  }

  console.log('\n' + div);
  console.log(chalk.bold(`  ✅ Graph stored at: ${chalk.green(`.rn-token-optimizer/graph.db`)}`));
  console.log(div + '\n');
  console.log(chalk.bold.cyan('  Next:'));
  console.log(`    rn-token-optimizer graph architecture`);
  if (isDotNet) {
    console.log(`    rn-token-optimizer graph search "" --label Controller`);
    console.log(`    rn-token-optimizer graph trace GetById --direction inbound`);
  } else {
    console.log(`    rn-token-optimizer graph search LoginScreen`);
    console.log(`    rn-token-optimizer graph trace handleGoogleLogin --direction inbound`);
  }
  console.log('');
}

// ─── graph search ─────────────────────────────────────────────────────────────

function cmdSearch(pattern: string, opts: { label?: string; file?: string; limit?: number; dir?: string }): void {
  const rootDir = resolveRoot(opts.dir);
  const results = searchGraph(
    {
      namePattern: pattern,
      label:       opts.label as NodeLabel | undefined,
      filePattern: opts.file,
      limit:       opts.limit ?? 20,
    },
    rootDir,
  );

  if (results.length === 0) {
    console.log(chalk.yellow(`No nodes matching "${pattern}"`));
    return;
  }

  console.log('\n' + div);
  console.log(chalk.bold.cyan(`  Search: "${pattern}"  (${results.length} results)`));
  console.log(div);

  for (const r of results) {
    const labelColor = labelChalk(r.node.label);
    console.log(
      `  ${labelColor}  ${chalk.white(r.node.name)}` +
      `  ${chalk.dim(`[${r.callerCount} callers, ${r.calleeCount} callees]`)}` +
      `\n     ${chalk.dim(r.node.filePath + ':' + r.node.lineStart)}` +
      `  ${chalk.dim(r.node.signature)}`,
    );
  }
  console.log('');
}

// ─── graph trace ──────────────────────────────────────────────────────────────

function cmdTrace(name: string, opts: { depth?: number; direction?: string; dir?: string }): void {
  const rootDir   = resolveRoot(opts.dir);
  const direction = (opts.direction ?? 'both') as 'inbound' | 'outbound' | 'both';
  const depth     = opts.depth ?? 3;
  const result    = traceCallPath(name, direction, depth, rootDir);

  if (!result) {
    console.log(chalk.yellow(`Function "${name}" not found in the graph. Run: rn-token-optimizer graph index`));
    return;
  }

  console.log('\n' + div);
  console.log(chalk.bold.cyan(`  Call trace: ${result.root.name}  ${chalk.dim(`[${result.root.label}]`)}`));
  console.log(chalk.dim(`  ${result.root.filePath}:${result.root.lineStart}`));
  console.log(div);

  if (direction !== 'outbound' && result.inbound.length > 0) {
    console.log(chalk.bold('\n  ← Callers (who calls this):'));
    printTraceTree(result.inbound, '    ');
  } else if (direction !== 'outbound') {
    console.log(chalk.dim('  ← No callers found'));
  }

  if (direction !== 'inbound' && result.outbound.length > 0) {
    console.log(chalk.bold('\n  → Callees (what this calls):'));
    printTraceTree(result.outbound, '    ');
  } else if (direction !== 'inbound') {
    console.log(chalk.dim('  → No callees found'));
  }
  console.log('');
}

function printTraceTree(nodes: import('../../graph/types.js').TraceNode[], indent: string): void {
  for (const tn of nodes) {
    const label = labelChalk(tn.node.label);
    console.log(
      `${indent}${chalk.dim('↳')} ${label} ${chalk.white(tn.node.name)}` +
      `  ${chalk.dim(tn.node.filePath + ':' + tn.node.lineStart)}`,
    );
    if (tn.children.length > 0) {
      printTraceTree(tn.children, indent + '  ');
    }
  }
}

// ─── graph architecture ───────────────────────────────────────────────────────

function cmdArchitecture(opts: { dir?: string }): void {
  const rootDir = resolveRoot(opts.dir);
  const report  = getArchitecture(rootDir);

  if (!report) {
    console.log(chalk.yellow('No graph index found. Run: rn-token-optimizer graph index'));
    return;
  }

  console.log('\n' + div);
  const langBadge = report.projectLanguage === 'csharp'
    ? chalk.magenta('[.NET/C#]')
    : chalk.blue('[TypeScript]');
  console.log(chalk.bold.cyan(`  Architecture — ${report.projectName}  ${langBadge}`));
  console.log(chalk.dim(`  Indexed: ${report.indexedAt.slice(0, 16)}`));
  console.log(div);

  const s = report.stats;
  console.log(`\n  ${chalk.bold('Stats')}`);
  console.log(`  Nodes ${chalk.yellow(s.totalNodes)}   Edges ${chalk.yellow(s.totalEdges)}   Files ${s.fileCount}`);

  if (report.projectLanguage === 'csharp') {
    // ── .NET / C# display ──────────────────────────────────────────────────────
    console.log(
      `  Controllers ${chalk.cyan(s.controllerCount)}` +
      `  Services ${chalk.cyan(s.serviceCount)}` +
      `  Repositories ${chalk.cyan(s.repositoryCount)}` +
      `  Endpoints ${chalk.cyan(s.apiEndpointCount)}` +
      `  Classes ${s.classCount}  Functions ${s.functionCount}`,
    );

    if (report.techStack.length > 0) {
      console.log(`\n  ${chalk.bold('.NET Stack')}: ${report.techStack.join('  ')}`);
    }

    if (report.controllers.length > 0) {
      console.log(chalk.bold.cyan(`\n  Controllers (${report.controllers.length}):`));
      for (const c of report.controllers.slice(0, 10)) {
        console.log(`    ${labelChalk('Controller')}  ${chalk.white(c.name)}  ${chalk.dim(c.filePath)}`);
      }
      if (report.controllers.length > 10) console.log(chalk.dim(`    …+${report.controllers.length - 10} more`));
    }

    if (report.services.length > 0) {
      console.log(chalk.bold.cyan(`\n  Services (${report.services.length}):`));
      for (const svc of report.services.slice(0, 8)) {
        console.log(`    ${labelChalk('Service')}  ${chalk.white(svc.name)}  ${chalk.dim(svc.filePath)}`);
      }
      if (report.services.length > 8) console.log(chalk.dim(`    …+${report.services.length - 8} more`));
    }

    if (report.repositories.length > 0) {
      console.log(chalk.bold.cyan(`\n  Repositories (${report.repositories.length}):`));
      for (const repo of report.repositories) {
        console.log(`    ${labelChalk('Repository')}  ${chalk.white(repo.name)}  ${chalk.dim(repo.filePath)}`);
      }
    }

  } else {
    // ── TypeScript / React Native display ─────────────────────────────────────
    console.log(
      `  Screens ${chalk.cyan(s.screenCount)}` +
      `  Hooks ${chalk.cyan(s.hookCount)}` +
      `  Navigators ${chalk.cyan(s.navigatorCount)}` +
      `  Classes ${s.classCount}  Functions ${s.functionCount}`,
    );

    if (report.techStack.length > 0) {
      console.log(`\n  ${chalk.bold('RN Stack')}: ${report.techStack.join('  ')}`);
    }

    if (report.screens.length > 0) {
      console.log(chalk.bold.cyan(`\n  Screens (${report.screens.length}):`));
      for (const sc of report.screens.slice(0, 10)) {
        console.log(`    ${chalk.white(sc.name)}  ${chalk.dim(sc.filePath)}`);
      }
      if (report.screens.length > 10) console.log(chalk.dim(`    …+${report.screens.length - 10} more`));
    }

    if (report.navigators.length > 0) {
      console.log(chalk.bold.cyan(`\n  Navigators:`));
      for (const nav of report.navigators) {
        console.log(`    ${chalk.white(nav.name)}  ${chalk.dim(nav.filePath)}`);
      }
    }
  }

  // ── Hotspots — shared ────────────────────────────────────────────────────────
  if (report.hotspots.length > 0) {
    console.log(chalk.bold.cyan('\n  Hotspots (most-called):'));
    for (const h of report.hotspots.slice(0, 8)) {
      const bar = '█'.repeat(Math.min(h.inDegree, 20));
      console.log(
        `    ${labelChalk(h.node.label)}  ${chalk.white(h.node.name.padEnd(28))}` +
        `  ${chalk.yellow(bar)} ${chalk.dim(h.inDegree)}`,
      );
    }
  }

  if (report.deadCodeCount > 0) {
    console.log(
      `\n  ${chalk.bold('Dead code')}: ${chalk.yellow(report.deadCodeCount)} symbols with zero callers` +
      `  ${chalk.dim('(run: graph dead-code)')}`,
    );
  }

  console.log('');
}

// ─── graph dead-code ──────────────────────────────────────────────────────────

function cmdDeadCode(opts: { dir?: string }): void {
  const rootDir = resolveRoot(opts.dir);
  const entries = findDeadCode(rootDir);

  if (entries.length === 0) {
    console.log(chalk.green('No dead code detected.'));
    return;
  }

  console.log('\n' + div);
  console.log(chalk.bold.cyan(`  Dead Code — ${entries.length} symbols with zero callers`));
  console.log(div);

  for (const entry of entries.slice(0, 30)) {
    const label = labelChalk(entry.node.label);
    console.log(`  ${label} ${chalk.white(entry.node.name)}  ${chalk.dim(entry.node.filePath + ':' + entry.node.lineStart)}`);
  }
  if (entries.length > 30) {
    console.log(chalk.dim(`  …+${entries.length - 30} more`));
  }
  console.log('');
}

// ─── graph changes ────────────────────────────────────────────────────────────

function cmdChanges(opts: { since?: string; dir?: string }): void {
  const rootDir = resolveRoot(opts.dir);
  const ref     = opts.since ?? 'HEAD';

  let diffText: string;
  try {
    diffText = execSync(`git diff ${ref}`, { cwd: rootDir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch {
    console.log(chalk.yellow('Could not run git diff. Ensure this is a git repository.'));
    return;
  }

  if (!diffText.trim()) {
    console.log(chalk.green('No changes detected since ' + ref));
    return;
  }

  const impacts = detectChanges(diffText, rootDir);

  if (impacts.length === 0) {
    console.log(chalk.green('Changes detected but no indexed symbols were affected.'));
    return;
  }

  console.log('\n' + div);
  console.log(chalk.bold.cyan(`  Change Impact Analysis — ${impacts.length} symbols affected`));
  console.log(div);

  for (const impact of impacts) {
    const riskColor = impact.risk === 'high' ? chalk.red : impact.risk === 'medium' ? chalk.yellow : chalk.green;
    console.log(
      `\n  ${riskColor(`[${impact.risk.toUpperCase()}]`)} ${chalk.white(impact.changedSymbol.name)}` +
      `  ${chalk.dim(impact.changedSymbol.filePath + ':' + impact.changedSymbol.lineStart)}` +
      `  blast-radius: ${chalk.yellow(impact.blastRadius)}`,
    );
    if (impact.affectedCallers.length > 0) {
      console.log('    Callers: ' + impact.affectedCallers.slice(0, 5).map(n => chalk.white(n.name)).join(', '));
    }
  }
  console.log('');
}

// ─── graph snippet ────────────────────────────────────────────────────────────

function cmdSnippet(qualifiedName: string, opts: { dir?: string }): void {
  const rootDir = resolveRoot(opts.dir);
  const snippet = getCodeSnippet(qualifiedName, rootDir);

  if (!snippet) {
    console.log(chalk.yellow(`No node found for "${qualifiedName}". Use: rn-token-optimizer graph search <name>`));
    return;
  }

  console.log(chalk.bold.cyan(`\n  ${snippet.qualifiedName}`));
  console.log(chalk.dim(`  ${snippet.filePath}  lines ${snippet.lineStart}-${snippet.lineEnd}\n`));
  console.log(snippet.source);
  console.log('');
}

// ─── graph query ─────────────────────────────────────────────────────────────

function cmdQuery(query: string, opts: { dir?: string }): void {
  const rootDir = resolveRoot(opts.dir);
  const result  = simpleQueryGraph(query, rootDir);

  if (result.rows.length === 0) {
    console.log(chalk.yellow('No results.'));
    return;
  }

  // Table output
  console.log('\n' + result.columns.join('\t'));
  console.log(chalk.dim('─'.repeat(40)));
  for (const row of result.rows) {
    console.log(result.columns.map(c => String(row[c] ?? '')).join('\t'));
  }
  console.log(chalk.dim(`\n${result.rows.length} rows`));
}

// ─── Label colour helper ──────────────────────────────────────────────────────

function labelChalk(label: NodeLabel): string {
  const map: Record<NodeLabel, (s: string) => string> = {
    // React Native
    Screen:      chalk.cyan,
    Hook:        chalk.magenta,
    Navigator:   chalk.blue,
    Provider:    chalk.yellow,
    Slice:       chalk.green,
    Component:   chalk.cyan,
    // Shared
    Function:    chalk.white,
    Class:       chalk.yellow,
    Interface:   chalk.dim,
    Type:        chalk.dim,
    File:        chalk.dim,
    // .NET / C#
    Controller:  chalk.cyan,
    Service:     chalk.green,
    Repository:  chalk.blue,
    Middleware:  chalk.magenta,
    ApiEndpoint: chalk.white,
    ViewModel:   chalk.yellow,
    Namespace:   chalk.dim,
  };
  return (map[label] ?? chalk.white)(`[${label}]`);
}

// ─── Register subcommand with Commander ───────────────────────────────────────

export function registerGraphCommand(program: Command): void {
  const graph = program
    .command('graph')
    .description('Code intelligence graph — index, search, trace call paths, analyse architecture');

  graph
    .command('index')
    .description('Full AST index of the project — builds the knowledge graph')
    .option('--dir <path>', 'Project root directory')
    .option('--force', 'Re-index even if a fresh graph exists')
    .action(async (opts: { dir?: string; force?: boolean }) => {
      await cmdIndex(opts);
    });

  graph
    .command('search <pattern>')
    .description('Search nodes by name pattern')
    .option('--label <label>', 'Filter by label: Function|Screen|Hook|Class|Navigator|…')
    .option('--file <pattern>', 'Filter by file path substring')
    .option('--limit <n>', 'Max results (default 20)', '20')
    .option('--dir <path>', 'Project root directory')
    .action((pattern: string, opts: { label?: string; file?: string; limit?: string; dir?: string }) => {
      cmdSearch(pattern, { ...opts, limit: opts.limit ? parseInt(opts.limit, 10) : undefined });
    });

  graph
    .command('trace <name>')
    .description('Trace call path for a function (who calls it / what it calls)')
    .option('--depth <n>', 'BFS depth 1-5 (default 3)', '3')
    .option('--direction <dir>', 'inbound | outbound | both (default: both)', 'both')
    .option('--dir <path>', 'Project root directory')
    .action((name: string, opts: { depth?: string; direction?: string; dir?: string }) => {
      cmdTrace(name, { ...opts, depth: opts.depth ? parseInt(opts.depth, 10) : undefined });
    });

  graph
    .command('architecture')
    .alias('arch')
    .description('Codebase overview: screens, navigators, hotspots, dead code count')
    .option('--dir <path>', 'Project root directory')
    .action((opts: { dir?: string }) => {
      cmdArchitecture(opts);
    });

  graph
    .command('dead-code')
    .description('List functions/components with zero callers')
    .option('--dir <path>', 'Project root directory')
    .action((opts: { dir?: string }) => {
      cmdDeadCode(opts);
    });

  graph
    .command('changes')
    .description('Map git diff to affected symbols + blast radius')
    .option('--since <ref>', 'Git ref to diff against (default: HEAD)', 'HEAD')
    .option('--dir <path>', 'Project root directory')
    .action((opts: { since?: string; dir?: string }) => {
      cmdChanges(opts);
    });

  graph
    .command('snippet <qualifiedName>')
    .description('Print source code for a qualified name (e.g. src/screens/Login.tsx:handleAuth)')
    .option('--dir <path>', 'Project root directory')
    .action((name: string, opts: { dir?: string }) => {
      cmdSnippet(name, opts);
    });

  graph
    .command('query <query>')
    .description('Cypher-lite query: e.g. "MATCH (n:Screen) RETURN n.name LIMIT 10"')
    .option('--dir <path>', 'Project root directory')
    .action((query: string, opts: { dir?: string }) => {
      cmdQuery(query, opts);
    });
}
