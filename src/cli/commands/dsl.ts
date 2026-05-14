import { createInterface } from 'node:readline';
import chalk from 'chalk';
import ora from 'ora';
import type { Command } from 'commander';
import {
  loadActiveMemory,
  addAlias,
  addMacro,
  pinAlias,
  pruneStale,
} from '../../dsl/memory.js';
import { BUILTINS } from '../../dsl/builtins.js';
import {
  learnFromDictPlus,
  learnFromThread,
  promoteEligibleCandidates,
} from '../../dsl/learner.js';
import { requireConfig } from './onboard.js';
import { createAnthropicProvider } from '../../llm/anthropic.js';
import type { DSLScope } from '../../types/index.js';

export function registerDslCommand(program: Command): void {
  const dsl = program
    .command('dsl')
    .description('Manage DSL memory (aliases, macros, learned terms)');

  // ── show ──────────────────────────────────────────────────────────────────
  dsl
    .command('show')
    .description('Show active DSL memory')
    .option('--candidates', 'Also show candidate entries')
    .option('--builtins', 'Also show built-in aliases/macros')
    .action((opts: { candidates?: boolean; builtins?: boolean }) => {
      const mem = loadActiveMemory();

      if (opts.builtins) {
        console.log(chalk.bold.cyan('\n── Built-in Prefixes ──'));
        for (const [k, v] of Object.entries(BUILTINS.prefixes)) {
          console.log(`  ${chalk.bold(k.padEnd(10))} ${v}`);
        }
        console.log(chalk.bold.cyan('\n── Built-in Aliases ──'));
        for (const [k, v] of Object.entries(BUILTINS.aliases)) {
          console.log(`  ${chalk.bold(k.padEnd(10))} ${v}`);
        }
        console.log(chalk.bold.cyan('\n── Built-in Macros ──'));
        for (const [k, v] of Object.entries(BUILTINS.macros)) {
          console.log(`  ${chalk.bold(k.padEnd(10))} ${v}`);
        }
        console.log(chalk.bold.cyan('\n── Built-in Defaults ──'));
        for (const [k, v] of Object.entries(BUILTINS.defaults)) {
          console.log(`  ${chalk.bold(k.padEnd(10))} ${v}`);
        }
      }

      const aliasKeys = Object.keys(mem.aliases);
      const learnedKeys = Object.keys(mem.learned);
      const macroKeys = Object.keys(mem.macros);

      if (aliasKeys.length > 0) {
        console.log(chalk.bold.cyan('\n── Project Aliases ──'));
        for (const [k, v] of Object.entries(mem.aliases)) {
          const pin = v.pinned ? chalk.yellow(' 📌') : '';
          console.log(`  ${chalk.bold(k.padEnd(10))} ${v.value}  [${v.scope}]${pin}  uses:${v.uses}`);
        }
      }

      if (learnedKeys.length > 0) {
        console.log(chalk.bold.cyan('\n── Learned Terms ──'));
        for (const [k, v] of Object.entries(mem.learned)) {
          console.log(`  ${chalk.bold(k.padEnd(10))} ${v.value}  promoted:${v.promoted}`);
        }
      }

      if (macroKeys.length > 0) {
        console.log(chalk.bold.cyan('\n── Project Macros ──'));
        for (const [k, v] of Object.entries(mem.macros)) {
          console.log(`  ${chalk.bold(k.padEnd(10))} ${v}`);
        }
      }

      if (opts.candidates) {
        const candidateKeys = Object.keys(mem.candidates);
        if (candidateKeys.length > 0) {
          console.log(chalk.bold.cyan('\n── Candidates (not yet promoted) ──'));
          for (const [k, v] of Object.entries(mem.candidates)) {
            console.log(`  ${chalk.bold(k.padEnd(10))} ${v.value}  uses:${v.uses}  first:${v.firstSeen}`);
          }
        } else {
          console.log(chalk.gray('\n  (no candidates)'));
        }
      }

      if (aliasKeys.length + learnedKeys.length + macroKeys.length === 0 && !opts.builtins) {
        console.log(chalk.gray('\n  (no custom DSL memory — run `dsl show --builtins` to see built-ins)'));
      }

      console.log('');
    });

  // ── learn ─────────────────────────────────────────────────────────────────
  dsl
    .command('learn <dict>')
    .description('Learn a Dict+ entry, e.g. "Dict+: A1=authentication fix"')
    .option('--dry-run', 'Preview without saving')
    .option('--scope <scope>', 'Scope: global or project', 'project')
    .action((dict: string, opts: { dryRun?: boolean; scope?: string }) => {
      const scope = (opts.scope ?? 'project') as DSLScope;
      const result = learnFromDictPlus(dict, scope, opts.dryRun ?? false);

      if (result.added.length === 0 && result.rejected.length === 0) {
        console.log(chalk.yellow('No Dict+ entries found. Format: "Dict+: KEY=value"'));
        return;
      }

      for (const entry of result.added) {
        const label = opts.dryRun ? chalk.gray('[dry-run] would add') : chalk.green('✓ added candidate');
        console.log(`${label}: ${chalk.bold(entry.key)} = ${entry.value}`);
      }
      for (const entry of result.rejected) {
        console.log(chalk.red(`✗ rejected: ${entry.key} — ${entry.reason}`));
      }
    });

  // ── learn-thread ──────────────────────────────────────────────────────────
  dsl
    .command('learn-thread')
    .description('Extract DSL candidates from a conversation transcript via stdin')
    .option('--stdin', 'Read transcript from stdin')
    .option('--dry-run', 'Preview without saving')
    .option('--scope <scope>', 'Scope: global or project', 'project')
    .action(async (opts: { stdin?: boolean; dryRun?: boolean; scope?: string }) => {
      if (!opts.stdin) {
        console.error(chalk.red('Use --stdin: rn-token-optimizer dsl learn-thread --stdin < transcript.txt'));
        process.exit(1);
      }

      const transcript = await readStdin();
      if (!transcript.trim()) {
        console.error(chalk.yellow('Empty transcript received.'));
        process.exit(1);
      }

      const config = requireConfig();
      const scope = (opts.scope ?? 'project') as DSLScope;
      const provider = createAnthropicProvider(config.anthropicApiKey, config.model);

      const spinner = ora({ text: 'Analyzing transcript…', stream: process.stderr }).start();

      const result = await learnFromThread(
        transcript,
        provider,
        { learnThreadMinUses: config.learnThreadMinUses, defaultScope: scope },
        opts.dryRun ?? false,
      );

      spinner.stop();

      for (const entry of result.added) {
        const label = opts.dryRun ? chalk.gray('[dry-run] would add') : chalk.green('✓ candidate');
        console.log(`${label}: ${chalk.bold(entry.key)} = ${entry.value}`);
      }
      for (const entry of result.rejected) {
        console.log(chalk.dim(`  skip: ${entry.key} — ${entry.reason}`));
      }

      if (result.added.length === 0) {
        console.log(chalk.gray('No new candidates found.'));
      }
    });

  // ── promote ───────────────────────────────────────────────────────────────
  dsl
    .command('promote')
    .description('Promote eligible candidates to learned entries')
    .option('--dry-run', 'Preview without saving')
    .option('--scope <scope>', 'Scope: global or project', 'project')
    .action((opts: { dryRun?: boolean; scope?: string }) => {
      const config = requireConfig();
      const scope = (opts.scope ?? 'project') as DSLScope;
      const result = promoteEligibleCandidates(
        config.promotionThreshold,
        scope,
        opts.dryRun ?? false,
      );

      for (const entry of result.promoted) {
        const label = opts.dryRun ? chalk.gray('[dry-run] would promote') : chalk.green('✓ promoted');
        console.log(`${label}: ${chalk.bold(entry.key)} = ${entry.value}`);
      }
      for (const entry of result.skipped) {
        console.log(chalk.dim(`  skip: ${entry.key}  (${entry.uses}/${entry.needed} uses)`));
      }

      if (result.promoted.length === 0 && result.skipped.length === 0) {
        console.log(chalk.gray('No candidates to promote.'));
      }
    });

  // ── add ───────────────────────────────────────────────────────────────────
  const add = dsl.command('add').description('Add an alias or macro');

  add
    .command('alias <key> <value>')
    .description('Add a DSL alias')
    .option('--scope <scope>', 'Scope: global or project', 'project')
    .option('--pin', 'Pin this alias (never prune)')
    .action((key: string, value: string, opts: { scope?: string; pin?: boolean }) => {
      const scope = (opts.scope ?? 'project') as DSLScope;
      addAlias(key.toUpperCase(), value, scope, opts.pin ?? false);
      console.log(chalk.green(`✓ alias added: ${chalk.bold(key.toUpperCase())} = ${value}  [${scope}]`));
    });

  add
    .command('macro <key> <value>')
    .description('Add a DSL macro')
    .option('--scope <scope>', 'Scope: global or project', 'project')
    .action((key: string, value: string, opts: { scope?: string }) => {
      const scope = (opts.scope ?? 'project') as DSLScope;
      addMacro(key, value, scope);
      console.log(chalk.green(`✓ macro added: ${chalk.bold(key)} = ${value}  [${scope}]`));
    });

  // ── pin ───────────────────────────────────────────────────────────────────
  dsl
    .command('pin <key>')
    .description('Pin an alias so it is never pruned')
    .option('--scope <scope>', 'Scope: global or project', 'project')
    .action((key: string, opts: { scope?: string }) => {
      const scope = (opts.scope ?? 'project') as DSLScope;
      const ok = pinAlias(key.toUpperCase(), scope);
      if (ok) {
        console.log(chalk.green(`✓ pinned: ${chalk.bold(key.toUpperCase())}  [${scope}]`));
      } else {
        console.log(chalk.yellow(`Alias "${key.toUpperCase()}" not found in ${scope} scope.`));
      }
    });

  // ── prune ─────────────────────────────────────────────────────────────────
  dsl
    .command('prune')
    .description('Remove stale unpinned aliases and expired candidates')
    .option('--dry-run', 'Preview without deleting')
    .option('--scope <scope>', 'Scope: global or project', 'project')
    .option('--days <n>', 'Prune entries unused for N days', '30')
    .action((opts: { dryRun?: boolean; scope?: string; days?: string }) => {
      const config = requireConfig();
      const scope = (opts.scope ?? 'project') as DSLScope;
      const days = opts.days ? parseInt(opts.days, 10) : config.pruneAfterDays;
      const pruned = pruneStale(days, scope, opts.dryRun ?? false);

      if (pruned.length === 0) {
        console.log(chalk.gray(`Nothing to prune (threshold: ${days} days, scope: ${scope}).`));
        return;
      }

      for (const key of pruned) {
        const label = opts.dryRun ? chalk.gray('[dry-run] would prune') : chalk.yellow('✓ pruned');
        console.log(`${label}: ${key}`);
      }
    });
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    const chunks: string[] = [];
    const rl = createInterface({ input: process.stdin });
    rl.on('line', (line) => chunks.push(line));
    rl.on('close', () => resolve(chunks.join('\n')));
  });
}
