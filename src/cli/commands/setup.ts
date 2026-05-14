/**
 * setup — Zero-friction one-shot project setup
 *
 * Detects which IDE(s) the user has, writes all config files,
 * indexes the project context AND builds the code graph in one run.
 *
 * Designed to be the first command a new user runs:
 *
 *   npx rn-token-optimizer setup          # via npx (no global install)
 *   rn-token-optimizer setup              # after global install
 *   rn-token-optimizer setup --cursor     # force Cursor
 *   rn-token-optimizer setup --kiro       # force Kiro
 *   rn-token-optimizer setup --all-ides   # configure every detected IDE
 *   rn-token-optimizer setup --ci         # non-interactive (index only, skip IDE config)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import {
  CURSOR_RULE_CONTENT,
  KIRO_STEERING_CONTENT,
} from '../../mcp/cursorRule.js';
import { runProjectIndex, saveProjectIndex } from '../../core/projectIndexer.js';
import { indexProject } from '../../graph/indexer.js';

// ─── IDE detection ────────────────────────────────────────────────────────────

interface DetectedIDE {
  name: 'cursor' | 'kiro' | 'claude-desktop';
  label: string;
  mcpPath: string;
  hasProjectDir: boolean;
}

function detectIDEs(projectRoot: string): DetectedIDE[] {
  const found: DetectedIDE[] = [];

  // Cursor — project level preferred, fall back to global
  const cursorProject = path.join(projectRoot, '.cursor');
  const cursorGlobal  = path.join(os.homedir(), '.cursor');
  if (fs.existsSync(cursorProject) || fs.existsSync(cursorGlobal)) {
    found.push({
      name:           'cursor',
      label:          'Cursor',
      mcpPath:        path.join(cursorProject, 'mcp.json'),
      hasProjectDir:  fs.existsSync(cursorProject),
    });
  }

  // Kiro
  const kiroProject = path.join(projectRoot, '.kiro');
  const kiroGlobal  = path.join(os.homedir(), '.kiro');
  if (fs.existsSync(kiroProject) || fs.existsSync(kiroGlobal)) {
    found.push({
      name:           'kiro',
      label:          'Kiro',
      mcpPath:        path.join(kiroProject, 'settings', 'mcp.json'),
      hasProjectDir:  fs.existsSync(kiroProject),
    });
  }

  // Claude Desktop
  const claudePath = claudeDesktopConfigPath();
  if (claudePath && fs.existsSync(path.dirname(claudePath))) {
    found.push({
      name:           'claude-desktop',
      label:          'Claude Desktop',
      mcpPath:        claudePath,
      hasProjectDir:  false,
    });
  }

  return found;
}

function claudeDesktopConfigPath(): string {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  }
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA ?? '', 'Claude', 'claude_desktop_config.json');
  }
  return path.join(os.homedir(), '.config', 'claude', 'claude_desktop_config.json');
}

// ─── MCP config writer ────────────────────────────────────────────────────────

function writeMCPConfig(ide: DetectedIDE, apiKey = ''): void {
  const dir = path.dirname(ide.mcpPath);
  fs.mkdirSync(dir, { recursive: true });

  let existing: Record<string, unknown> = {};
  if (fs.existsSync(ide.mcpPath)) {
    try { existing = JSON.parse(fs.readFileSync(ide.mcpPath, 'utf8')) as Record<string, unknown>; }
    catch { /* start fresh */ }
  }

  const servers = (existing.mcpServers ?? {}) as Record<string, unknown>;
  const entry: Record<string, unknown> = { command: 'rn-token-optimizer-mcp' };
  if (apiKey) entry['env'] = { ANTHROPIC_API_KEY: apiKey };
  servers['rn-token-optimizer'] = entry;
  existing.mcpServers = servers;

  fs.writeFileSync(ide.mcpPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');
}

// ─── Rule / steering writers ──────────────────────────────────────────────────

function writeCursorRule(projectRoot: string): void {
  const dir  = path.join(projectRoot, '.cursor', 'rules');
  const file = path.join(dir, 'rn-token-optimizer.mdc');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, CURSOR_RULE_CONTENT, 'utf8');
}

function writeKiroSteering(projectRoot: string): void {
  const dir  = path.join(projectRoot, '.kiro', 'steering');
  const file = path.join(dir, 'rn-token-optimizer.md');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, KIRO_STEERING_CONTENT, 'utf8');
}

// ─── Banner ───────────────────────────────────────────────────────────────────

function banner(): void {
  const W = 62;
  const line = (s: string) => console.log(chalk.cyan('  ' + s));
  console.log('');
  console.log(chalk.bold.cyan('  ' + '━'.repeat(W)));
  line('🚀  rn-token-optimizer — Project Setup');
  line('    AST code graph  ·  prompt optimizer  ·  MCP integration');
  console.log(chalk.bold.cyan('  ' + '━'.repeat(W)));
  console.log('');
}

// ─── Step printer ─────────────────────────────────────────────────────────────

let stepNum = 0;
function step(label: string): void {
  stepNum++;
  console.log(chalk.bold.cyan(`\n  ━━ Step ${stepNum}: ${label} ━━`));
}

function ok(msg: string):  void { console.log(chalk.green   (`    ✅  ${msg}`)); }
function info(msg: string): void { console.log(chalk.dim    (`    ℹ   ${msg}`)); }
function warn(msg: string): void { console.log(chalk.yellow (`    ⚠   ${msg}`)); }

// ─── Main setup command ───────────────────────────────────────────────────────

export interface SetupOptions {
  cursor?:   boolean;
  kiro?:     boolean;
  allIdes?:  boolean;
  ci?:       boolean;        // non-interactive, index only
  apiKey?:   string;
  dir?:      string;
}

export async function runSetupCommand(opts: SetupOptions = {}): Promise<void> {
  const projectRoot = opts.dir ? path.resolve(opts.dir) : process.cwd();

  banner();

  // ── Detect project ──────────────────────────────────────────────────────────
  let projectName = path.basename(projectRoot);
  let rnVersion: string | undefined;
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')) as {
      name?: string;
      dependencies?: Record<string, string>;
    };
    if (pkg.name) projectName = pkg.name;
    rnVersion = pkg.dependencies?.['react-native']?.replace(/^[^0-9]*/, '');
  } catch { /* no package.json */ }

  console.log(`  Project  : ${chalk.white.bold(projectName)}`);
  console.log(`  Location : ${chalk.dim(projectRoot)}`);
  if (rnVersion) console.log(`  RN       : ${chalk.yellow(rnVersion)}`);

  // ── Step 1: Configure IDE(s) ────────────────────────────────────────────────
  if (!opts.ci) {
    step('Configure IDE');

    const allIDEs = detectIDEs(projectRoot);

    // Which IDEs to configure
    let targets: DetectedIDE[] = [];
    if (opts.cursor) {
      targets = allIDEs.filter(i => i.name === 'cursor');
      if (targets.length === 0) {
        // Create Cursor project dir even if not detected
        targets = [{
          name: 'cursor', label: 'Cursor',
          mcpPath: path.join(projectRoot, '.cursor', 'mcp.json'),
          hasProjectDir: false,
        }];
      }
    } else if (opts.kiro) {
      targets = allIDEs.filter(i => i.name === 'kiro');
      if (targets.length === 0) {
        targets = [{
          name: 'kiro', label: 'Kiro',
          mcpPath: path.join(projectRoot, '.kiro', 'settings', 'mcp.json'),
          hasProjectDir: false,
        }];
      }
    } else if (opts.allIdes) {
      targets = allIDEs;
    } else {
      // Auto-detect: prefer project-scoped, pick the first one found
      if (allIDEs.length > 0) {
        // Prefer Cursor if present, then Kiro, then Claude Desktop
        targets = [allIDEs.find(i => i.name === 'cursor') ?? allIDEs[0]];
      }
    }

    if (targets.length === 0) {
      warn('No IDE detected. Falling back to Cursor project config.');
      targets = [{
        name: 'cursor', label: 'Cursor',
        mcpPath: path.join(projectRoot, '.cursor', 'mcp.json'),
        hasProjectDir: false,
      }];
    }

    const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY ?? '';
    const modeLabel = apiKey
      ? chalk.green('direct mode (Anthropic API key)')
      : chalk.cyan('passthrough mode (IDE subscription — no API key needed)');
    info(`Mode: ${modeLabel}`);

    for (const ide of targets) {
      try {
        writeMCPConfig(ide, apiKey);
        ok(`${ide.label} MCP config → ${chalk.dim(ide.mcpPath)}`);
      } catch (e) {
        warn(`Could not write ${ide.label} MCP config: ${e instanceof Error ? e.message : String(e)}`);
      }

      // Write IDE-specific rule / steering file
      try {
        if (ide.name === 'cursor') {
          writeCursorRule(projectRoot);
          ok(`Cursor rule    → ${chalk.dim(path.join('.cursor', 'rules', 'rn-token-optimizer.mdc'))}`);
        }
        if (ide.name === 'kiro') {
          writeKiroSteering(projectRoot);
          ok(`Kiro steering  → ${chalk.dim(path.join('.kiro', 'steering', 'rn-token-optimizer.md'))}`);
        }
      } catch (e) {
        warn(`Could not write rule/steering: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Print what needs to happen next in the IDE
    printIDERestartInstructions(targets);
  }

  // ── Step 2: Project context (package analysis, requirements scan) ───────────
  step('Analyse project context');

  const ctxSpinner = ora({ text: 'Scanning packages, files, requirement docs…', stream: process.stderr }).start();
  let ctxResult: ReturnType<typeof runProjectIndex> | null = null;
  try {
    ctxResult = runProjectIndex({ rootDir: projectRoot });
    saveProjectIndex(ctxResult, projectRoot);
    ctxSpinner.succeed(chalk.green('Project context built'));
  } catch (e) {
    ctxSpinner.fail(chalk.yellow('Project context scan failed (non-fatal)'));
    warn(e instanceof Error ? e.message : String(e));
  }

  if (ctxResult) {
    if (ctxResult.rnVersion) info(`React Native ${ctxResult.rnVersion}`);
    const aliases = ctxResult.stack.filter(d => d.dslAlias).map(d => `${d.dslAlias}`);
    if (aliases.length > 0) info(`Stack aliases: ${aliases.join('  ')}`);
    info(`${ctxResult.stats.totalFiles} source files  ~${ctxResult.stats.totalTokens.toLocaleString()} tokens`);
    if (ctxResult.requirementFiles.length > 0) {
      ok(`${ctxResult.requirementFiles.length} requirement/spec files found`);
      for (const r of ctxResult.requirementFiles.slice(0, 4)) {
        console.log(chalk.dim(`       [${r.type}] ${r.path}`));
      }
      if (ctxResult.requirementFiles.length > 4) {
        console.log(chalk.dim(`       …+${ctxResult.requirementFiles.length - 4} more`));
      }
    }
  }

  // ── Step 3: Code graph ───────────────────────────────────────────────────────
  step('Build code intelligence graph');

  let fileCount = 0;
  const graphSpinner = ora({ text: 'Parsing AST, building knowledge graph…', stream: process.stderr }).start();

  try {
    const graphResult = await indexProject({
      rootDir:    projectRoot,
      onProgress: (file, cur, total) => {
        fileCount = total;
        graphSpinner.text = `[${cur}/${total}] ${chalk.dim(path.basename(file))}`;
      },
    });

    graphSpinner.succeed(chalk.green(
      `Code graph built — ${graphResult.fileCount} files, ${graphResult.nodeCount} nodes, ${graphResult.edgeCount} edges in ${graphResult.durationMs}ms`
    ));

    // Screens
    if (graphResult.screens.length > 0) {
      ok(`${graphResult.screens.length} screens detected`);
      const names = graphResult.screens.slice(0, 6).map(s => chalk.white(s.name)).join('  ');
      console.log(`       ${names}${graphResult.screens.length > 6 ? chalk.dim(` +${graphResult.screens.length - 6} more`) : ''}`);
    }

    // Hotspots
    if (graphResult.hotspots.length > 0) {
      ok('Top hotspots (most-called):');
      for (const h of graphResult.hotspots.slice(0, 4)) {
        console.log(`       ${chalk.white(h.node.name.padEnd(28))} ${chalk.dim(`${h.inDegree} callers`)}`);
      }
    }

  } catch (e) {
    graphSpinner.fail(chalk.yellow('Code graph build failed (non-fatal)'));
    warn(e instanceof Error ? e.message : String(e));
  }

  // ── Final report ─────────────────────────────────────────────────────────────
  void fileCount;
  printFinalReport(projectName ?? path.basename(projectRoot), projectRoot, opts.ci);
}

// ─── IDE restart instructions ─────────────────────────────────────────────────

function printIDERestartInstructions(ides: DetectedIDE[]): void {
  console.log('');
  for (const ide of ides) {
    if (ide.name === 'cursor') {
      info('Reload Cursor window to activate MCP  (Cmd+Shift+P → "Reload Window")');
    } else if (ide.name === 'kiro') {
      info('Kiro detects config changes automatically — MCP server will start shortly');
    } else if (ide.name === 'claude-desktop') {
      info('Restart Claude Desktop to activate MCP');
    }
  }
}


// ─── Final report ─────────────────────────────────────────────────────────────

function printFinalReport(_projectName: string, projectRoot: string, ci?: boolean): void {
  const W = 62;
  console.log('');
  console.log(chalk.bold.cyan('  ' + '━'.repeat(W)));
  console.log(chalk.bold.green('  ✅  Setup complete!'));
  console.log(chalk.bold.cyan('  ' + '━'.repeat(W)));

  if (!ci) {
    console.log(chalk.bold('\n  HOW TO USE IN YOUR IDE (Agent / Chat mode):\n'));

    console.log(chalk.bold.white('  1. Prompt optimization — start any message with the keyword:'));
    console.log(chalk.dim(`\n     rn-token-optimizer Fix Google login failure on Android 12`));
    console.log(chalk.dim(`     → IDE calls optimize_prompt, shows token savings, answers\n`));

    console.log(chalk.bold.white('  2. Code graph queries — ask the agent to:'));
    console.log(chalk.dim(`\n     "Index my project"                 → index_repository`));
    console.log(chalk.dim(`     "Show my app architecture"          → get_architecture`));
    console.log(chalk.dim(`     "Find all screens"                  → search_graph (label: Screen)`));
    console.log(chalk.dim(`     "Who calls handleGoogleLogin?"      → trace_call_path (inbound)`));
    console.log(chalk.dim(`     "Show dead code"                    → find_dead_code`));
    console.log(chalk.dim(`     "Impact of my current git changes"  → detect_changes\n`));

    console.log(chalk.bold.white('  3. Terminal (MCP CLI mode):'));
    console.log(chalk.dim(`\n     rn-token-optimizer-mcp list`));
    console.log(chalk.dim(`     rn-token-optimizer-mcp get_architecture`));
    console.log(chalk.dim(`     rn-token-optimizer-mcp search_graph '{"label":"Screen"}'`));
    console.log(chalk.dim(`     rn-token-optimizer-mcp trace_call_path '{"function_name":"handleAuth"}'`));

    console.log(chalk.bold.white('\n  4. CLI commands:'));
    console.log(chalk.dim(`\n     rn-token-optimizer graph architecture`));
    console.log(chalk.dim(`     rn-token-optimizer graph search LoginScreen`));
    console.log(chalk.dim(`     rn-token-optimizer graph trace handleGoogleLogin`));
    console.log(chalk.dim(`     rn-token-optimizer graph changes`));
    console.log(chalk.dim(`     rn-token-optimizer stats          (offline token savings estimate)`));
  }

  console.log('');
  console.log(chalk.bold.white('  Files written to your project:'));
  console.log(chalk.dim(`    .rn-token-optimizer/project-context.md  (steering doc)`));
  console.log(chalk.dim(`    .rn-token-optimizer/project-index.json  (dep/structure index)`));
  console.log(chalk.dim(`    .rn-token-optimizer/graph.db            (code intelligence graph)`));
  const cursorRule = path.join(projectRoot, '.cursor', 'rules', 'rn-token-optimizer.mdc');
  const kiroSteer  = path.join(projectRoot, '.kiro', 'steering', 'rn-token-optimizer.md');
  if (fs.existsSync(cursorRule)) console.log(chalk.dim(`    .cursor/rules/rn-token-optimizer.mdc   (Cursor auto-trigger rule)`));
  if (fs.existsSync(kiroSteer))  console.log(chalk.dim(`    .kiro/steering/rn-token-optimizer.md   (Kiro steering file)`));

  console.log('');
  console.log(chalk.bold.cyan('  ' + '━'.repeat(W)));
  console.log(chalk.dim(`  Re-run anytime: rn-token-optimizer setup`));
  console.log(chalk.dim(`  Re-index only:  rn-token-optimizer graph index`));
  console.log(chalk.bold.cyan('  ' + '━'.repeat(W)));
  console.log('');
}
