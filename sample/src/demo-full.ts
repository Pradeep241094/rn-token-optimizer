/**
 * demo-full.ts
 *
 * End-to-end demo — runs BOTH prompt optimization and terminal compression
 * using Anthropic Claude Haiku, then prints a combined savings summary.
 *
 * Requires ANTHROPIC_API_KEY environment variable.
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-ant-... npm run demo
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { optimizePrompt, aiTokenOptimizer } from 'rn-token-optimizer';
import { VERBOSE_PROMPTS } from '../data/verbose-prompts.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('\n❌  ANTHROPIC_API_KEY not set.');
  console.error('    Run: ANTHROPIC_API_KEY=sk-ant-... npm run demo');
  console.error('    No API key? Try: npm run demo:mock\n');
  process.exit(1);
}

function divider(char = '─', len = 70): string {
  return char.repeat(len);
}

function bar(pct: number, width = 30): string {
  const filled = Math.round((pct / 100) * width);
  return '[' + '█'.repeat(filled) + '░'.repeat(width - filled) + ']';
}

interface DemoResult {
  label: string;
  mode: 'prompt' | 'terminal';
  tokensBefore: number;
  tokensAfter: number;
  savedPct: number;
}

const results: DemoResult[] = [];

// ─── Part 1: Prompt Optimization ─────────────────────────────────────────────

console.log('\n' + divider('═'));
console.log('  🔥  rn-token-optimizer — Full Demo');
console.log('  Running both modes against a real React Native project');
console.log(divider('═'));

console.log('\n' + divider());
console.log('  PART 1 — Prompt Optimization (3 examples)');
console.log(divider());

const promptExamples = VERBOSE_PROMPTS.slice(0, 3);

for (const example of promptExamples) {
  process.stdout.write(`\n  [Prompt] ${example.category} — optimizing... `);

  try {
    const result = await optimizePrompt(example.verbose, { apiKey });
    console.log('✓');
    console.log(`\n  Verbose : "${example.verbose.slice(0, 70)}..."`);
    console.log(`  Compact : "${result.optimizedPrompt}"`);
    console.log(`  Saved   : ${result.savedPct}% (${result.savings.before.tokens}→${result.savings.after.tokens} tokens)`);

    results.push({
      label: `Prompt: ${example.category}`,
      mode: 'prompt',
      tokensBefore: result.savings.before.tokens,
      tokensAfter: result.savings.after.tokens,
      savedPct: result.savedPct,
    });
  } catch (err) {
    console.log('✗');
    console.error(`  Error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ─── Part 2: Terminal Output Compression ─────────────────────────────────────

console.log('\n' + divider());
console.log('  PART 2 — Terminal Output Compression (3 command outputs)');
console.log(divider());

const terminalDemos = [
  { label: 'Jest results', file: 'jest-output.txt', question: 'Which tests failed and why?' },
  { label: 'Metro error', file: 'metro-output.txt', question: 'Did Metro bundle succeed? What is the error?' },
  { label: 'Android build', file: 'android-build.txt', question: 'Did the build succeed? How do I fix the failure?' },
];

for (const demo of terminalDemos) {
  const rawOutput = readFileSync(join(dataDir, demo.file), 'utf8');
  process.stdout.write(`\n  [Terminal] ${demo.label} — compressing... `);

  try {
    const result = await aiTokenOptimizer(rawOutput, demo.question, { apiKey });
    console.log('✓');
    console.log(`\n  Question : "${demo.question}"`);
    console.log('  Answer   :');
    for (const line of result.output.split('\n')) {
      console.log(`    ${line}`);
    }
    console.log(`  Saved    : ${result.savedPct}% (${result.savings.before.tokens}→${result.savings.after.tokens} tokens)`);

    results.push({
      label: `Terminal: ${demo.label}`,
      mode: 'terminal',
      tokensBefore: result.savings.before.tokens,
      tokensAfter: result.savings.after.tokens,
      savedPct: result.savedPct,
    });
  } catch (err) {
    console.log('✗');
    console.error(`  Error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

const totalBefore = results.reduce((s, r) => s + r.tokensBefore, 0);
const totalAfter = results.reduce((s, r) => s + r.tokensAfter, 0);
const totalSaved = totalBefore - totalAfter;
const overallPct = totalBefore > 0 ? ((totalSaved / totalBefore) * 100).toFixed(1) : '0';

console.log('\n' + divider('═'));
console.log('  SAVINGS SUMMARY');
console.log(divider('═'));

console.log('');
for (const r of results) {
  const mode = r.mode === 'prompt' ? '🔤 Prompt  ' : '💻 Terminal';
  console.log(
    `  ${mode}  ${r.label.padEnd(28)}  ${bar(r.savedPct, 20)} ${r.savedPct.toFixed(1)}%  (${r.tokensBefore}→${r.tokensAfter})`,
  );
}

console.log('\n' + divider());
console.log(`  Total tokens before  : ${totalBefore}`);
console.log(`  Total tokens after   : ${totalAfter}`);
console.log(`  Total tokens saved   : ${totalSaved}  (${overallPct}%)`);
console.log(divider());
console.log(`\n  🔥 ${totalSaved} tokens saved across ${results.length} operations`);
console.log(`     That's ${overallPct}% of token usage eliminated.\n`);

console.log(divider('═'));
console.log('  Next steps:');
console.log('    rn-token-optimizer slash --project "YourApp"  →  enable DSL mode in your agent');
console.log('    rn-token-optimizer dsl show                   →  see learned project terms');
console.log('    rn-token-optimizer dsl promote                →  promote candidates to memory');
console.log(divider('═') + '\n');
