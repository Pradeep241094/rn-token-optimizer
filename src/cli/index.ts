import { Command } from 'commander';
import chalk from 'chalk';
import { runOnboarding } from './commands/onboard.js';
import { runDistillCommand } from './commands/distill.js';
import { runOptimizeCommand } from './commands/optimize.js';
import { runSlashCommand } from './commands/slash.js';
import { registerDslCommand } from './commands/dsl.js';
import { runInstallCommand } from './commands/install.js';
import { runStatsCommand } from './commands/stats.js';
import { runIndexCommand } from './commands/index.js';
import { registerGraphCommand } from './commands/graph.js';
import { runSetupCommand } from './commands/setup.js';

const program = new Command();

program
  .name('rn-token-optimizer')
  .description(
    'React Native Token Optimizer — compress prompts and terminal output for AI coding agents.\n\n' +
    '  PROMPT mode:   rn-token-optimizer optimize "Your verbose prompt"\n' +
    '  TERMINAL mode: command 2>&1 | rn-token-optimizer "Your question"',
  )
  .version('1.0.0');

// ── Smart default action ─────────────────────────────────────────────────────
// - No args + TTY       → onboarding
// - No stdin + arg      → optimize mode (prompt compression)
// - Stdin present + arg → distill mode (terminal output compression)
program
  .argument('[question]', 'Question to answer about piped output, or prompt to optimize')
  .action(async (question: string | undefined) => {
    if (!question) {
      if (process.stdin.isTTY) {
        // No args, no stdin — run onboarding
        await runOnboarding();
        return;
      }
      // Stdin but no question
      console.error(
        chalk.yellow('Please provide a question: … | rn-token-optimizer "Did tests pass?"'),
      );
      process.exit(1);
    }

    if (process.stdin.isTTY) {
      // No stdin piped — treat the argument as a prompt to optimize
      await runOptimizeCommand(question);
    } else {
      // Stdin present — treat as terminal output compression
      await runDistillCommand(question);
    }
  });

// ── optimize ─────────────────────────────────────────────────────────────────
program
  .command('optimize <prompt>')
  .description(
    'Compress a verbose prompt into a lean token-efficient version before sending to an AI agent.\n\n' +
    'Examples:\n' +
    '  rn-token-optimizer optimize "I need you to fix the auth issue where Google login fails on Android 12"\n' +
    '  → D=fix A Google login fail AND v12+\n\n' +
    '  rn-token-optimizer optimize "Can you help me understand why navigation is broken on iOS?"\n' +
    '  → D=debug NAV broken IOS',
  )
  .action(async (prompt: string) => {
    await runOptimizeCommand(prompt);
  });

// ── distill (explicit terminal compression) ───────────────────────────────────
program
  .command('distill <question>')
  .description(
    'Compress terminal output (Metro, Jest, stack traces) piped via stdin.\n\n' +
    'Examples:\n' +
    '  npx jest 2>&1 | rn-token-optimizer distill "Which tests failed?"\n' +
    '  npx react-native run-android 2>&1 | rn-token-optimizer distill "Did the build succeed?"',
  )
  .action(async (question: string) => {
    await runDistillCommand(question);
  });

// ── slash ─────────────────────────────────────────────────────────────────────
program
  .command('slash')
  .description('Print the /rn-token-optimizer system prompt for pasting into your AI agent thread')
  .option('--project <name>', 'Project name to include in the prompt')
  .action((opts: { project?: string }) => {
    runSlashCommand(opts.project);
  });

// ── dsl ───────────────────────────────────────────────────────────────────────
registerDslCommand(program);

// ── onboard ───────────────────────────────────────────────────────────────────
program
  .command('onboard')
  .description('Re-run the onboarding wizard')
  .action(async () => {
    await runOnboarding();
  });

// ── index ─────────────────────────────────────────────────────────────────────
program
  .command('index')
  .description(
    'Scan a React Native project and build a compact steering document.\n\n' +
    'The document is saved to .rn-token-optimizer/project-context.md and\n' +
    'automatically injected into every subsequent optimize and distill call.\n\n' +
    'Examples:\n' +
    '  rn-token-optimizer index                     # index current directory\n' +
    '  rn-token-optimizer index --dir /path/to/app  # index another project\n' +
    '  rn-token-optimizer index --show              # print current context doc\n' +
    '  rn-token-optimizer index --json              # print raw JSON index',
  )
  .option('--dir <path>', 'Project root directory (default: current directory)')
  .option('--show', 'Print the current context document without re-indexing')
  .option('--json', 'Print the raw JSON index without re-indexing')
  .action(async (opts: { dir?: string; show?: boolean; json?: boolean }) => {
    await runIndexCommand(opts);
  });

// ── stats ─────────────────────────────────────────────────────────────────────
program
  .command('stats')
  .description(
    'Analyse token usage of real project content — no API key needed.\n\n' +
    'Reads from stdin, a file, or scans a folder. Shows token count, verbosity\n' +
    'score, domain detection, applicable DSL aliases, and projected savings.\n\n' +
    'Examples:\n' +
    '  echo "your verbose prompt" | rn-token-optimizer stats\n' +
    '  rn-token-optimizer stats --file my-prompt.txt\n' +
    '  rn-token-optimizer stats --scan ./src --ext ts,tsx\n' +
    '  rn-token-optimizer stats --scan . --top 20\n' +
    '  npx jest 2>&1 | rn-token-optimizer stats --type terminal',
  )
  .option('--file <path>', 'Analyse a single file')
  .option('--scan <dir>', 'Scan a folder recursively')
  .option('--ext <list>', 'Comma-separated file extensions to scan (default: ts,tsx,js,jsx,md,txt)')
  .option('--top <n>', 'Max files to analyse in scan mode (default: 50)', parseInt)
  .option('--type <type>', 'Force content type: prompt | terminal (default: auto-detect)')
  .action(async (opts: { file?: string; scan?: string; ext?: string; top?: number; type?: string }) => {
    await runStatsCommand(opts);
  });

// ── install ───────────────────────────────────────────────────────────────────
program
  .command('install')
  .description(
    'Install the rn-token-optimizer MCP server into Cursor or Claude Desktop.\n' +
    'Also writes the Cursor rule that auto-triggers on the "rn-token-optimizer" keyword.',
  )
  .action(async () => {
    await runInstallCommand();
  });

// ── setup ─────────────────────────────────────────────────────────────────────
program
  .command('setup')
  .description(
    'One-shot project setup — auto-detects IDE, writes MCP config, builds code graph.\n\n' +
    'The fastest way to get started:\n' +
    '  rn-token-optimizer setup              # auto-detect IDE\n' +
    '  rn-token-optimizer setup --cursor     # force Cursor\n' +
    '  rn-token-optimizer setup --kiro       # force Kiro\n' +
    '  rn-token-optimizer setup --all-ides   # configure every detected IDE\n' +
    '  rn-token-optimizer setup --ci         # non-interactive (CI/CD)\n' +
    '  rn-token-optimizer setup --api-key sk-ant-...  # with Anthropic API key',
  )
  .option('--cursor',          'Configure Cursor IDE (auto-detected by default)')
  .option('--kiro',            'Configure Kiro IDE')
  .option('--all-ides',        'Configure every detected IDE')
  .option('--ci',              'Non-interactive mode: skip IDE config, index only')
  .option('--api-key <key>',   'Anthropic API key (optional — passthrough mode works without it)')
  .option('--dir <path>',      'Project root directory (default: current directory)')
  .action(async (opts: { cursor?: boolean; kiro?: boolean; allIdes?: boolean; ci?: boolean; apiKey?: string; dir?: string }) => {
    await runSetupCommand(opts);
  });

// ── graph ─────────────────────────────────────────────────────────────────────
registerGraphCommand(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(chalk.red(`Error: ${msg}`));
  process.exit(1);
});
