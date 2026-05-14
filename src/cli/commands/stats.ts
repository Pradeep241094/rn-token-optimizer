/**
 * stats command — 100% offline token analysis on real project content.
 *
 * No API key needed. Reads from stdin, a file, or scans a folder.
 * Shows real token counts, verbosity score, domain detection, applicable
 * DSL aliases, and projected savings if the content were compressed.
 *
 * Usage:
 *   echo "verbose prompt" | rn-token-optimizer stats
 *   rn-token-optimizer stats --file path/to/prompt.txt
 *   rn-token-optimizer stats --file jest-output.log --type terminal
 *   rn-token-optimizer stats --scan ./src --ext ts,tsx       # batch scan
 *   rn-token-optimizer stats --scan . --top 10               # worst offenders
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import chalk from 'chalk';
import { countTokensSync } from '../../core/tokenCounter.js';
import { analyzePromptContext } from '../../rn/promptContext.js';
import { BUILTINS } from '../../dsl/builtins.js';
import { loadActiveMemory } from '../../dsl/memory.js';

// Compression ratio estimates by content type + verbosity score
// Based on observed averages from the mock demo runs
const COMPRESSION_ESTIMATES: Record<string, { lo: number; hi: number }> = {
  prompt:   { lo: 0.60, hi: 0.85 },  // 60–85% of tokens removed
  terminal: { lo: 0.85, hi: 0.97 },  // 85–97% removed (logs are very noisy)
  mixed:    { lo: 0.70, hi: 0.90 },
};

// Verbosity penalty scale applied on top of compression range
function verbosityMultiplier(score: number): number {
  // score 0–10: higher = more verbose = more compressible
  return 0.8 + (score / 10) * 0.2;   // 0.80 – 1.00
}

// ─── Alias applicability ──────────────────────────────────────────────────────
function matchingAliases(text: string): { key: string; value: string }[] {
  const lower = text.toLowerCase();
  const memory = loadActiveMemory();
  const matches: { key: string; value: string }[] = [];

  // Check builtins
  for (const [key, value] of Object.entries(BUILTINS.aliases)) {
    if (lower.includes(value.toLowerCase()) || lower.includes(key.toLowerCase())) {
      matches.push({ key, value });
    }
  }
  // Check project aliases
  for (const [key, entry] of Object.entries(memory.aliases)) {
    if (lower.includes(entry.value.toLowerCase()) || lower.includes(key.toLowerCase())) {
      matches.push({ key, value: entry.value });
    }
  }
  // Deduplicate
  return matches.filter((m, i, arr) => arr.findIndex(x => x.key === m.key) === i);
}

// ─── Terminal output detector ─────────────────────────────────────────────────
function detectContentType(text: string): 'prompt' | 'terminal' | 'mixed' {
  const terminalSignals = [
    /\bFAIL\b|\bPASS\b|\bERROR\b/,
    /at\s+\w+\s+\(.*:\d+:\d+\)/,          // stack trace
    /^\s*(info|warn|error)\s+/m,           // Metro/RN log prefixes
    /BUILD (FAILED|SUCCESSFUL)/i,
    /Tests:.*passed|Test Suites:/i,
    /\d+\.\d+s$/m,                         // timing lines
    /^> Task :/m,                           // Gradle
  ];
  const hits = terminalSignals.filter(p => p.test(text)).length;
  if (hits >= 3) return 'terminal';
  if (hits >= 1) return 'mixed';
  return 'prompt';
}

// ─── Single analysis block ────────────────────────────────────────────────────
interface AnalysisResult {
  file: string;
  tokens: number;
  chars: number;
  words: number;
  lines: number;
  type: 'prompt' | 'terminal' | 'mixed';
  verbosityScore: number;
  domains: string[];
  aliases: { key: string; value: string }[];
  estTokensAfter: number;
  estSavedPct: number;
  estCostBefore: number;
  estCostSaved: number;
}

function analyse(text: string, label: string, forceType?: 'prompt' | 'terminal'): AnalysisResult {
  const count     = countTokensSync(text);
  const type      = forceType ?? detectContentType(text);
  const context   = analyzePromptContext(text);
  const aliases   = matchingAliases(text);
  const range     = COMPRESSION_ESTIMATES[type];
  const mult      = verbosityMultiplier(context.verbosityScore);
  const midRate   = (range.lo + range.hi) / 2 * mult;
  const estAfter  = Math.max(1, Math.round(count.tokens * (1 - midRate)));
  const estPct    = Math.round(midRate * 100);
  const pricing   = 0.80 / 1_000_000;   // Haiku input rate
  const costBefore = count.tokens * pricing;
  const costSaved  = (count.tokens - estAfter) * pricing;

  return {
    file: label,
    tokens: count.tokens,
    chars: count.chars,
    words: count.words,
    lines: text.split('\n').length,
    type,
    verbosityScore: context.verbosityScore,
    domains: context.domains,
    aliases,
    estTokensAfter: estAfter,
    estSavedPct: estPct,
    estCostBefore: costBefore,
    estCostSaved: costSaved,
  };
}

// ─── Rendering ────────────────────────────────────────────────────────────────
function bar(pct: number, width = 24): string {
  const filled = Math.round((pct / 100) * width);
  return '[' + chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(width - filled)) + ']';
}

function fmtCost(n: number): string {
  if (n < 0.000001) return `$${(n * 1_000_000).toFixed(2)}µ`;
  if (n < 0.001)    return `$${(n * 1_000).toFixed(3)}m`;
  return `$${n.toFixed(6)}`;
}

function printResult(r: AnalysisResult, index?: number): void {
  const label = index !== undefined
    ? chalk.bold(`\n[${index + 1}] ${r.file}`)
    : chalk.bold(`\n📄 ${r.file}`);
  console.log(label);

  // Token bar
  console.log(
    chalk.dim('  Tokens    : ') + chalk.yellow(r.tokens.toLocaleString()) +
    chalk.dim(`  ${r.chars.toLocaleString()} chars  ${r.words.toLocaleString()} words  ${r.lines.toLocaleString()} lines`),
  );

  // Type + verbosity
  const typeColor = r.type === 'terminal' ? chalk.magenta : r.type === 'mixed' ? chalk.cyan : chalk.blue;
  const verbColor = r.verbosityScore >= 7 ? chalk.red : r.verbosityScore >= 4 ? chalk.yellow : chalk.green;
  console.log(
    chalk.dim('  Type       : ') + typeColor(r.type) +
    chalk.dim('   Verbosity : ') + verbColor(`${r.verbosityScore}/10`),
  );

  // Domains
  if (r.domains.length > 0 && r.domains[0] !== 'generic') {
    console.log(chalk.dim('  Domains    : ') + r.domains.map(d => chalk.cyan(d)).join(', '));
  }

  // DSL aliases that apply
  if (r.aliases.length > 0) {
    const aliasStr = r.aliases.slice(0, 8).map(a => chalk.bold(a.key)).join(' ');
    console.log(chalk.dim('  DSL aliases: ') + aliasStr +
      (r.aliases.length > 8 ? chalk.dim(` +${r.aliases.length - 8} more`) : ''));
  }

  // Savings estimate
  console.log(
    chalk.dim('  Est. after : ') + chalk.green(`~${r.estTokensAfter} tokens`) +
    chalk.dim('  ') + bar(r.estSavedPct) + chalk.green(` ~${r.estSavedPct}% saved`),
  );

  // Cost
  console.log(
    chalk.dim('  Cost now   : ') + fmtCost(r.estCostBefore) + chalk.dim(' (Haiku)') +
    chalk.dim('   Est. saved: ') + chalk.green(fmtCost(r.estCostSaved)) + chalk.dim(' per call'),
  );
}

function printSummary(results: AnalysisResult[]): void {
  const totalTokens   = results.reduce((s, r) => s + r.tokens, 0);
  const totalAfter    = results.reduce((s, r) => s + r.estTokensAfter, 0);
  const totalSaved    = totalTokens - totalAfter;
  const avgPct        = totalTokens > 0 ? Math.round((totalSaved / totalTokens) * 100) : 0;
  const totalCost     = results.reduce((s, r) => s + r.estCostBefore, 0);
  const totalCostSave = results.reduce((s, r) => s + r.estCostSaved, 0);
  const perDay100     = totalCostSave * 100;

  const div = chalk.dim('─'.repeat(56));
  console.log('\n' + div);
  console.log(chalk.bold.cyan('  📊 Aggregate Statistics'));
  console.log(div);
  console.log(`  Files analysed   : ${chalk.yellow(results.length)}`);
  console.log(`  Total tokens now : ${chalk.yellow(totalTokens.toLocaleString())}`);
  console.log(`  Est. after opt.  : ${chalk.green(totalAfter.toLocaleString())} tokens`);
  console.log(`  Est. total saved : ${chalk.green(totalSaved.toLocaleString())} tokens  ${bar(avgPct, 20)} ${chalk.green(`~${avgPct}%`)}`);
  console.log(div);
  console.log(`  Cost per batch now   : ${fmtCost(totalCost)}  (Haiku)`);
  console.log(`  Est. cost per batch  : ${fmtCost(totalCost - totalCostSave)}`);
  console.log(`  Est. saved / batch   : ${chalk.green(fmtCost(totalCostSave))}`);
  console.log(`  Est. saved / 100/day : ${chalk.green(fmtCost(perDay100))}`);
  console.log(div);

  // Top 3 savings opportunities
  const sorted = [...results].sort((a, b) => b.tokens - a.tokens).slice(0, 3);
  if (sorted.length > 0) {
    console.log(chalk.bold('\n  🔥 Top savings opportunities:'));
    for (const r of sorted) {
      const short = r.file.length > 40 ? '…' + r.file.slice(-38) : r.file;
      console.log(`     ${chalk.yellow(r.tokens)} → ${chalk.green(r.estTokensAfter)} tokens  (${r.estSavedPct}%)  ${chalk.dim(short)}`);
    }
  }
  console.log('');
}

// ─── Folder scanner ───────────────────────────────────────────────────────────
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.expo', 'android', 'ios', '.kiro', '.cursor']);

function scanFolder(dir: string, exts: string[], maxFiles: number): string[] {
  const results: string[] = [];

  function walk(current: string): void {
    if (results.length >= maxFiles) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { return; }

    for (const e of entries) {
      if (results.length >= maxFiles) return;
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(path.join(current, e.name));
      } else if (e.isFile()) {
        const ext = path.extname(e.name).slice(1);
        if (exts.includes(ext)) results.push(path.join(current, e.name));
      }
    }
  }

  walk(dir);
  return results;
}

// ─── Stdin reader ─────────────────────────────────────────────────────────────
function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) { resolve(''); return; }
    const chunks: string[] = [];
    const rl = readline.createInterface({ input: process.stdin });
    rl.on('line', l => chunks.push(l));
    rl.on('close', () => resolve(chunks.join('\n')));
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export interface StatsOptions {
  file?: string;
  scan?: string;
  ext?: string;
  top?: number;
  type?: string;
}

export async function runStatsCommand(opts: StatsOptions): Promise<void> {
  const forceType = (opts.type === 'terminal' || opts.type === 'prompt') ? opts.type : undefined;

  // ── Folder scan mode ────────────────────────────────────────────────────────
  if (opts.scan) {
    const exts = (opts.ext ?? 'ts,tsx,js,jsx,md,txt').split(',').map(e => e.trim());
    const maxFiles = opts.top ?? 50;
    const dir = path.resolve(opts.scan);

    if (!fs.existsSync(dir)) {
      console.error(chalk.red(`Directory not found: ${dir}`));
      process.exit(1);
    }

    console.log(chalk.bold.cyan(`\n🔍 Scanning: ${dir}`));
    console.log(chalk.dim(`   Extensions: ${exts.join(', ')}   Max files: ${maxFiles}\n`));

    const files = scanFolder(dir, exts, maxFiles);
    if (files.length === 0) {
      console.log(chalk.yellow('No matching files found.'));
      return;
    }

    const results: AnalysisResult[] = [];
    for (const f of files) {
      try {
        const text = fs.readFileSync(f, 'utf8');
        if (text.trim().length === 0) continue;
        const rel = path.relative(dir, f);
        results.push(analyse(text, rel, forceType));
      } catch { /* skip unreadable */ }
    }

    // Sort by token count descending for output
    results.sort((a, b) => b.tokens - a.tokens);
    results.forEach((r, i) => printResult(r, i));
    printSummary(results);
    return;
  }

  // ── Single file mode ────────────────────────────────────────────────────────
  if (opts.file) {
    const filePath = path.resolve(opts.file);
    if (!fs.existsSync(filePath)) {
      console.error(chalk.red(`File not found: ${filePath}`));
      process.exit(1);
    }
    const text = fs.readFileSync(filePath, 'utf8');
    const result = analyse(text, path.basename(filePath), forceType);
    console.log(chalk.bold.cyan('\n🔍 Token Stats Analysis'));
    printResult(result);
    printSummary([result]);
    return;
  }

  // ── Stdin mode ──────────────────────────────────────────────────────────────
  const text = await readStdin();
  if (!text.trim()) {
    console.error(chalk.yellow(
      'Provide text via stdin, --file, or --scan:\n' +
      '  echo "your prompt" | rn-token-optimizer stats\n' +
      '  rn-token-optimizer stats --file my-prompt.txt\n' +
      '  rn-token-optimizer stats --scan ./src\n' +
      '  npx jest 2>&1 | rn-token-optimizer stats --type terminal',
    ));
    process.exit(1);
  }
  const result = analyse(text, 'stdin', forceType);
  console.log(chalk.bold.cyan('\n🔍 Token Stats Analysis'));
  printResult(result);
  printSummary([result]);
}
