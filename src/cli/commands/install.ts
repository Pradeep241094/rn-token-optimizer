import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { confirm, select, input } from '@inquirer/prompts';
import chalk from 'chalk';
import {
  CURSOR_RULE_CONTENT,
  MCP_CONFIG_CURSOR,
  MCP_CONFIG_CLAUDE_DESKTOP,
  MCP_CONFIG_KIRO,
  KIRO_STEERING_CONTENT,
  KIRO_HOOK_CONTENT,
} from '../../mcp/cursorRule.js';
import { loadConfig } from './onboard.js';

const CURSOR_RULES_DIR = path.join(process.cwd(), '.cursor', 'rules');
const CURSOR_RULE_FILE = path.join(CURSOR_RULES_DIR, 'rn-token-optimizer.mdc');

const CURSOR_MCP_PATHS = [
  path.join(process.cwd(), '.cursor', 'mcp.json'),           // project-level
  path.join(os.homedir(), '.cursor', 'mcp.json'),            // global Cursor
];

const KIRO_MCP_PATHS = [
  path.join(process.cwd(), '.kiro', 'settings', 'mcp.json'),  // workspace-level
  path.join(os.homedir(), '.kiro', 'settings', 'mcp.json'),   // user-level
];
const KIRO_STEERING_DIR = path.join(process.cwd(), '.kiro', 'steering');
const KIRO_STEERING_FILE = path.join(KIRO_STEERING_DIR, 'rn-token-optimizer.md');
const KIRO_HOOKS_DIR = path.join(process.cwd(), '.kiro', 'hooks');
const KIRO_HOOK_FILE = path.join(KIRO_HOOKS_DIR, 'rn-token-optimizer.kiro.hook');

const CLAUDE_DESKTOP_MCP_PATH =
  process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
    : process.platform === 'win32'
    ? path.join(process.env.APPDATA ?? '', 'Claude', 'claude_desktop_config.json')
    : path.join(os.homedir(), '.config', 'claude', 'claude_desktop_config.json');

function divider(): string {
  return chalk.dim('─'.repeat(60));
}

export async function runInstallCommand(): Promise<void> {
  console.log(chalk.bold.cyan('\n🔌 rn-token-optimizer MCP Setup\n'));
  console.log('This installs the MCP server so Cursor / Kiro / Claude Desktop');
  console.log('can call rn-token-optimizer tools automatically.\n');

  const config = loadConfig();
  const existingKey = config?.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY ?? '';

  // ── API key mode selection ───────────────────────────────────────────────────
  console.log(chalk.bold('\n📋 API Key Mode\n'));
  console.log('  Passthrough mode  — uses your Cursor/Kiro subscription (no extra cost, no API key needed)');
  console.log('  Direct mode       — uses your own Anthropic API key (faster, works in Claude Desktop too)\n');

  const useDirectMode = await confirm({
    message: 'Use your own Anthropic API key (direct mode)? No = use IDE subscription (passthrough)',
    default: Boolean(existingKey),
  });

  let apiKey = '';
  if (useDirectMode) {
    if (existingKey) {
      const useExisting = await confirm({
        message: `Use existing key from config? (${existingKey.slice(0, 12)}…)`,
        default: true,
      });
      apiKey = useExisting ? existingKey : '';
    }
    if (!apiKey) {
      apiKey = await input({
        message: 'Anthropic API key (sk-ant-…):',
        validate: (v) => v.startsWith('sk-') ? true : 'Key should start with sk-',
      });
    }
  } else {
    console.log(chalk.green(
      '\n✓ Passthrough mode selected — the MCP server will use your IDE\'s built-in AI\n' +
      '  (Cursor subscription / Kiro subscription). No API key required.\n',
    ));
  }

  const target = await select({
    message: 'Where do you want to install?',
    choices: [
      { value: 'cursor-project', name: 'Cursor — this project only  (.cursor/mcp.json)' },
      { value: 'cursor-global',  name: 'Cursor — all projects       (~/.cursor/mcp.json)' },
      { value: 'kiro-project',   name: 'Kiro   — this workspace     (.kiro/settings/mcp.json)' },
      { value: 'kiro-global',    name: 'Kiro   — all workspaces     (~/.kiro/settings/mcp.json)' },
      { value: 'claude-desktop', name: 'Claude Desktop              (claude_desktop_config.json)' },
      { value: 'manual',         name: 'Show me the config — I will add it manually' },
    ],
  });

  const isKiro = target === 'kiro-project' || target === 'kiro-global';

  // ── IDE-specific extra files ─────────────────────────────────────────────────
  if (isKiro) {
    const installSteering = await confirm({
      message: 'Also install the Kiro steering file? (auto-triggers on "rn-token-optimizer" keyword)',
      default: true,
    });
    const installHook = await confirm({
      message: 'Also install the Kiro agent hook? (fires on every prompt submission)',
      default: false,
    });
    if (installSteering) writeKiroSteering();
    if (installHook) writeKiroHook();
  } else if (!isKiro && target !== 'claude-desktop' && target !== 'manual') {
    const installRule = await confirm({
      message: 'Also install the Cursor rule? (auto-triggers on "rn-token-optimizer" keyword)',
      default: true,
    });
    if (installRule) writeCursorRule();
  }

  // ── MCP config ──────────────────────────────────────────────────────────────
  if (target === 'manual') {
    printManualInstructions(apiKey);
    return;
  }

  const mcpPath =
    target === 'cursor-project' ? CURSOR_MCP_PATHS[0]
    : target === 'cursor-global'  ? CURSOR_MCP_PATHS[1]
    : target === 'kiro-project'   ? KIRO_MCP_PATHS[0]
    : target === 'kiro-global'    ? KIRO_MCP_PATHS[1]
    : CLAUDE_DESKTOP_MCP_PATH;

  writeMCPConfig(mcpPath, apiKey, target);
  printNextSteps(target, apiKey);
}

function writeKiroSteering(): void {
  try {
    if (!fs.existsSync(KIRO_STEERING_DIR)) {
      fs.mkdirSync(KIRO_STEERING_DIR, { recursive: true });
    }
    fs.writeFileSync(KIRO_STEERING_FILE, KIRO_STEERING_CONTENT, 'utf8');
    console.log(chalk.green(`\n✓ Kiro steering file written to ${KIRO_STEERING_FILE}`));
  } catch (err) {
    console.error(chalk.red(`✗ Could not write Kiro steering file: ${err instanceof Error ? err.message : String(err)}`));
  }
}

function writeKiroHook(): void {
  try {
    if (!fs.existsSync(KIRO_HOOKS_DIR)) {
      fs.mkdirSync(KIRO_HOOKS_DIR, { recursive: true });
    }
    fs.writeFileSync(KIRO_HOOK_FILE, KIRO_HOOK_CONTENT, 'utf8');
    console.log(chalk.green(`\n✓ Kiro hook file written to ${KIRO_HOOK_FILE}`));
  } catch (err) {
    console.error(chalk.red(`✗ Could not write Kiro hook: ${err instanceof Error ? err.message : String(err)}`));
  }
}

function writeCursorRule(): void {
  try {
    if (!fs.existsSync(CURSOR_RULES_DIR)) {
      fs.mkdirSync(CURSOR_RULES_DIR, { recursive: true });
    }
    fs.writeFileSync(CURSOR_RULE_FILE, CURSOR_RULE_CONTENT, 'utf8');
    console.log(chalk.green(`\n✓ Cursor rule written to ${CURSOR_RULE_FILE}`));
  } catch (err) {
    console.error(chalk.red(`✗ Could not write Cursor rule: ${err instanceof Error ? err.message : String(err)}`));
  }
}

function writeMCPConfig(mcpPath: string, apiKey: string, target: string): void {
  try {
    fs.mkdirSync(path.dirname(mcpPath), { recursive: true });

    // Read existing config or start fresh
    let existing: Record<string, unknown> = {};
    if (fs.existsSync(mcpPath)) {
      try {
        existing = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
      } catch {
        existing = {};
      }
    }

    const servers = (existing.mcpServers ?? {}) as Record<string, unknown>;
    servers['rn-token-optimizer'] = {
      command: 'rn-token-optimizer-mcp',
      env: { ANTHROPIC_API_KEY: apiKey || 'YOUR_ANTHROPIC_API_KEY' },
    };
    existing.mcpServers = servers;

    fs.writeFileSync(mcpPath, JSON.stringify(existing, null, 2), 'utf8');
    console.log(chalk.green(`\n✓ MCP server added to ${mcpPath}`));

    if (!apiKey) {
      console.log(
        chalk.yellow(
          `  ⚠  ANTHROPIC_API_KEY is not set.\n` +
          `     Edit ${mcpPath} and replace "YOUR_ANTHROPIC_API_KEY" with your key.\n` +
          `     Or run: rn-token-optimizer onboard`,
        ),
      );
    }
  } catch (err) {
    console.error(chalk.red(`✗ Could not write MCP config: ${err instanceof Error ? err.message : String(err)}`));
    console.log('\nAdd this manually:');
    const configFn =
      target === 'claude-desktop'              ? MCP_CONFIG_CLAUDE_DESKTOP
      : (target === 'kiro-project' || target === 'kiro-global') ? MCP_CONFIG_KIRO
      : MCP_CONFIG_CURSOR;
    console.log(configFn(apiKey));
  }
}

function printManualInstructions(apiKey: string): void {
  console.log('\n' + divider());
  console.log(chalk.bold('Cursor (.cursor/mcp.json or ~/.cursor/mcp.json):'));
  console.log(divider());
  console.log(MCP_CONFIG_CURSOR(apiKey));

  console.log('\n' + divider());
  console.log(chalk.bold('Kiro (.kiro/settings/mcp.json or ~/.kiro/settings/mcp.json):'));
  console.log(divider());
  console.log(MCP_CONFIG_KIRO(apiKey));

  console.log('\n' + divider());
  console.log(chalk.bold('Claude Desktop (claude_desktop_config.json):'));
  console.log(divider());
  console.log(MCP_CONFIG_CLAUDE_DESKTOP(apiKey));

  console.log('\n' + divider());
  console.log(chalk.bold('Cursor Rule (.cursor/rules/rn-token-optimizer.mdc):'));
  console.log(divider());
  console.log(CURSOR_RULE_CONTENT);

  console.log('\n' + divider());
  console.log(chalk.bold('Kiro Steering (.kiro/steering/rn-token-optimizer.md):'));
  console.log(divider());
  console.log(KIRO_STEERING_CONTENT);
}

function printNextSteps(target: string, apiKey: string): void {
  const isDesktop = target === 'claude-desktop';
  const isKiro = target === 'kiro-project' || target === 'kiro-global';
  const mode = apiKey ? chalk.green('direct (Anthropic API)') : chalk.cyan('passthrough (IDE subscription)');

  console.log('\n' + divider());
  console.log(chalk.bold('\n✅ Installation complete. Next steps:\n'));
  console.log(`  Mode: ${mode}\n`);

  if (isDesktop) {
    console.log('  1. Restart Claude Desktop');
    console.log('  2. You should see "rn-token-optimizer" in the tools list\n');
  } else if (isKiro) {
    console.log('  1. Save the config file — Kiro reloads MCP servers automatically');
    console.log('  2. Open the Kiro panel → MCP section and verify the server is connected');
    console.log('  3. If the steering file was installed, the keyword trigger is now active\n');
    console.log(chalk.cyan('  Auto-trigger: type this in Kiro chat:'));
    console.log('    rn-token-optimizer Fix the auth issue where Google login fails on Android 12');
    console.log('    → Kiro will call optimize_prompt, show the token report, then answer\n');
  } else {
    console.log('  1. Reload Cursor window  (Cmd+Shift+P → "Reload Window")');
    console.log('  2. Cursor will detect the MCP server automatically\n');
    console.log(chalk.cyan('  Auto-trigger: type this in Cursor chat:'));
    console.log('    rn-token-optimizer Fix the auth issue where Google login fails on Android 12');
    console.log('    → Cursor will call optimize_prompt and respond to the compressed version\n');
  }

  console.log(chalk.cyan('  Manual tool calls (works in any MCP-compatible agent):'));
  console.log('    "Use rn-token-optimizer to optimize: Fix the FlatList perf issue on Android"');
  console.log('    "Show my rn-token-optimizer DSL memory"');
  console.log('    "Add AUTHSVC as an alias for AuthenticationService"\n');

  console.log(divider());
}
