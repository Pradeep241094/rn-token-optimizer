/**
 * demo-prompt-optimizer.ts
 *
 * Runs REAL prompt optimization using Anthropic Claude.
 * Requires ANTHROPIC_API_KEY environment variable.
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-ant-... npm run demo:prompts
 */

import { optimizePrompt, analyzePromptContext } from 'rn-token-optimizer';
import { VERBOSE_PROMPTS } from '../data/verbose-prompts.js';

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('\n❌  ANTHROPIC_API_KEY not set.');
  console.error('    Run: ANTHROPIC_API_KEY=sk-ant-... npm run demo:prompts');
  console.error('    Or try the mock demo first: npm run demo:mock\n');
  process.exit(1);
}

function divider(char = '─', len = 70): string {
  return char.repeat(len);
}

console.log('\n' + divider('═'));
console.log('  🔥  rn-token-optimizer — Prompt Optimization Demo');
console.log(divider('═'));
console.log('  Optimizing', VERBOSE_PROMPTS.length, 'real RN developer prompts via Claude Haiku...\n');

let totalTokensBefore = 0;
let totalTokensAfter = 0;

for (let i = 0; i < VERBOSE_PROMPTS.length; i++) {
  const example = VERBOSE_PROMPTS[i];

  console.log(divider());
  console.log(`  [${i + 1}/${VERBOSE_PROMPTS.length}] Category: ${example.category}`);
  console.log(divider());

  // Show context analysis (no API call needed)
  const context = analyzePromptContext(example.verbose);
  console.log(`\n  Context detected:`);
  console.log(`    Domains    : ${context.domains.join(', ')}`);
  console.log(`    Entities   : ${context.entities.slice(0, 4).join(', ') || 'none'}`);
  console.log(`    Verbosity  : ${context.verbosityScore}/10  ${context.verbosityScore >= 6 ? '← high, good candidate' : ''}`);
  console.log(`    Is action  : ${context.isActionRequest}`);

  console.log('\n  VERBOSE (original):');
  const verboseLines = example.verbose.match(/.{1,65}/g) ?? [example.verbose];
  for (const line of verboseLines) console.log(`    ${line}`);

  process.stdout.write('\n  Optimizing... ');

  try {
    const result = await optimizePrompt(example.verbose, { apiKey });

    console.log('done\n');
    console.log('  OPTIMIZED (send this to your AI agent):');
    console.log(`    ${result.optimizedPrompt}`);

    console.log(`\n  Before : ${result.savings.before.tokens} tokens  ${result.savings.before.chars} chars`);
    console.log(`  After  : ${result.savings.after.tokens} tokens  ${result.savings.after.chars} chars`);
    console.log(`  Saved  : ${result.savedPct}%  🔥`);

    totalTokensBefore += result.savings.before.tokens;
    totalTokensAfter += result.savings.after.tokens;
  } catch (err) {
    console.log('failed');
    console.error(`  Error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

const totalSaved = totalTokensBefore - totalTokensAfter;
const totalPct = ((totalSaved / totalTokensBefore) * 100).toFixed(1);

console.log('\n' + divider('═'));
console.log('  SUMMARY');
console.log(divider('═'));
console.log(`  Total tokens before : ${totalTokensBefore}`);
console.log(`  Total tokens after  : ${totalTokensAfter}`);
console.log(`  Total saved         : ${totalSaved} tokens  (${totalPct}%)`);
console.log(`\n  That's ${totalSaved} fewer tokens sent to your AI agent across ${VERBOSE_PROMPTS.length} prompts.`);
console.log(divider('═') + '\n');
