/**
 * index command — scan a React Native project and build a compact steering
 * document stored at .rn-token-optimizer/project-context.md.
 *
 * This document is automatically injected into every subsequent
 * optimize_prompt and compress_output call so the LLM gives project-aware,
 * pinpoint answers instead of generic React Native advice.
 *
 * Usage:
 *   rn-token-optimizer index                       # index current directory
 *   rn-token-optimizer index --dir /path/to/project
 *   rn-token-optimizer index --show                # print the context doc
 *   rn-token-optimizer index --json                # print JSON index
 */

import path from 'node:path';
import fs from 'node:fs';
import chalk from 'chalk';
import ora from 'ora';
import { runProjectIndex, saveProjectIndex, loadProjectIndex } from '../../core/projectIndexer.js';
import { countTokensSync } from '../../core/tokenCounter.js';

export interface IndexCommandOptions {
  dir?: string;
  show?: boolean;
  json?: boolean;
  quiet?: boolean;
}

export async function runIndexCommand(opts: IndexCommandOptions = {}): Promise<void> {
  const rootDir = opts.dir ? path.resolve(opts.dir) : process.cwd();

  // ── --show / --json modes ────────────────────────────────────────────────────
  if (opts.show || opts.json) {
    const existing = loadProjectIndex(rootDir);
    if (!existing) {
      console.log(chalk.yellow('No project index found. Run: rn-token-optimizer index'));
      process.exit(1);
    }

    if (opts.json) {
      console.log(JSON.stringify(existing, null, 2));
      return;
    }

    // --show: print the context document
    const contextPath = path.join(rootDir, '.rn-token-optimizer', 'project-context.md');
    if (fs.existsSync(contextPath)) {
      console.log(fs.readFileSync(contextPath, 'utf8'));
    } else {
      console.log(chalk.yellow('Context document not found. Re-run: rn-token-optimizer index'));
    }
    return;
  }

  // ── Indexing mode ────────────────────────────────────────────────────────────
  const spinner = ora({
    text: `Indexing project at ${chalk.cyan(rootDir)} …`,
    stream: process.stderr,
  }).start();

  const idx = runProjectIndex({ rootDir });

  spinner.succeed(chalk.green('Project indexed'));

  const savedPath = saveProjectIndex(idx, rootDir);
  const docTokens = countTokensSync(idx.contextDoc).tokens;

  // ── Summary output ───────────────────────────────────────────────────────────
  const div = chalk.dim('─'.repeat(60));
  console.log('\n' + div);
  console.log(chalk.bold.cyan('  📁 Project Index — ' + idx.name));
  console.log(div);

  if (idx.rnVersion) {
    console.log(`  React Native  : ${chalk.yellow(idx.rnVersion)}`);
  }

  // Stack with DSL aliases
  const aliasedDeps = idx.stack.filter(d => d.dslAlias);
  if (aliasedDeps.length > 0) {
    const dslStr = aliasedDeps.map(d => `${chalk.bold(d.dslAlias)}=${d.name.split('/').pop()}`).join('  ');
    console.log(`  Stack aliases : ${dslStr}`);
  }

  // File stats
  console.log(
    `  Files         : ${chalk.yellow(idx.stats.totalFiles)} src  ` +
    `${chalk.cyan(idx.stats.tsFiles)} TS  ` +
    `${chalk.cyan(idx.stats.testFiles)} tests  ` +
    `~${chalk.yellow(idx.stats.totalTokens.toLocaleString())} tokens`,
  );

  // Key files
  if (idx.keyFiles.length > 0) {
    console.log(`  Key files     : ${idx.keyFiles.slice(0, 4).join('  ')}${idx.keyFiles.length > 4 ? chalk.dim(` +${idx.keyFiles.length - 4} more`) : ''}`);
  }

  // Requirement files
  if (idx.requirementFiles.length > 0) {
    console.log(chalk.bold.cyan('\n  📋 Requirement / Spec files found:'));
    for (const r of idx.requirementFiles.slice(0, 8)) {
      const label = chalk.dim(`[${r.type}]`);
      const tokens = chalk.dim(`(${r.tokens} tokens)`);
      const summary = r.summary ? chalk.dim(` — ${r.summary.slice(0, 60)}`) : '';
      console.log(`     ${label} ${chalk.white(r.path)} ${tokens}${summary}`);
    }
    if (idx.requirementFiles.length > 8) {
      console.log(chalk.dim(`     …+${idx.requirementFiles.length - 8} more`));
    }
  }

  // Custom aliases found
  if (idx.customAliases.length > 0) {
    console.log(chalk.bold.cyan('\n  🔤 Frequent component names (alias candidates):'));
    console.log('     ' + idx.customAliases.slice(0, 10).join('  '));
    console.log(chalk.dim('     Run: rn-token-optimizer dsl add alias <SHORT> <FullName> to save them'));
  }

  // Context document saved
  console.log('\n' + div);
  console.log(chalk.bold(`  ✅ Context document saved: ${chalk.green(savedPath)}`));
  console.log(`     ${docTokens} tokens — injected into every optimize/compress call automatically`);
  console.log(div);

  // Next steps
  console.log(chalk.bold.cyan('\n  Next steps:'));
  console.log('   1. Run prompts — project context is now injected automatically:');
  console.log(chalk.dim('        rn-token-optimizer optimize "Fix the auth issue…"'));
  console.log('   2. View the steering doc any time:');
  console.log(chalk.dim('        rn-token-optimizer index --show'));
  console.log('   3. Re-index after major changes (new deps, new screens):');
  console.log(chalk.dim('        rn-token-optimizer index'));
  if (idx.requirementFiles.length > 0) {
    console.log('   4. Reference a spec file in your prompt for context-aware answers:');
    const exampleSpec = idx.requirementFiles[0].path;
    console.log(chalk.dim(`        rn-token-optimizer optimize "Implement the flow in ${exampleSpec}"`));
  }
  console.log('');
}
