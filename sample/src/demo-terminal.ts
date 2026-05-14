/**
 * demo-terminal.ts
 *
 * Runs REAL terminal output compression using Anthropic Claude.
 * Shows how Jest results, Metro errors, and Android build failures
 * are compressed into compact DSL answers.
 *
 * Requires ANTHROPIC_API_KEY environment variable.
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-ant-... npm run demo:terminal
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { aiTokenOptimizer } from 'rn-token-optimizer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('\n❌  ANTHROPIC_API_KEY not set.');
  console.error('    Run: ANTHROPIC_API_KEY=sk-ant-... npm run demo:terminal');
  console.error('    Or try the mock demo first: npm run demo:mock\n');
  process.exit(1);
}

function divider(char = '─', len = 70): string {
  return char.repeat(len);
}

const TERMINAL_DEMOS = [
  {
    name: 'Jest Test Results',
    file: 'jest-output.txt',
    command: 'npx jest --coverage',
    question: 'Which tests failed and why? What do I need to fix?',
  },
  {
    name: 'Metro Bundler Error',
    file: 'metro-output.txt',
    command: 'npx react-native start',
    question: 'Did Metro bundle successfully? What is the error?',
  },
  {
    name: 'Android Build Failure',
    file: 'android-build.txt',
    command: 'npx react-native run-android',
    question: 'Did the Android build succeed? What caused the failure and how do I fix it?',
  },
];

console.log('\n' + divider('═'));
console.log('  🔥  rn-token-optimizer — Terminal Output Compression Demo');
console.log(divider('═'));
console.log('  Compressing real RN command outputs via Claude Haiku...\n');

for (const demo of TERMINAL_DEMOS) {
  const rawOutput = readFileSync(join(dataDir, demo.file), 'utf8');
  const lineCount = rawOutput.split('\n').length;
  const wordCount = rawOutput.split(/\s+/).filter(Boolean).length;

  console.log(divider());
  console.log(`  ${demo.name}`);
  console.log(divider());
  console.log(`\n  Command  : ${demo.command}`);
  console.log(`  Question : "${demo.question}"`);
  console.log(`\n  Raw output: ${lineCount} lines  ${wordCount} words  (first 5 lines shown)`);

  const preview = rawOutput.split('\n').slice(0, 5);
  for (const line of preview) {
    if (line.trim()) console.log(`    ${line}`);
  }
  console.log('    ...');

  process.stdout.write('\n  Compressing... ');

  try {
    const result = await aiTokenOptimizer(rawOutput, demo.question, { apiKey });

    console.log('done\n');
    console.log('  COMPRESSED ANSWER (DSL output → paste directly to your AI agent):');
    for (const line of result.output.split('\n')) {
      console.log(`    ${line}`);
    }

    console.log(`\n  Before : ${result.savings.before.tokens} tokens`);
    console.log(`  After  : ${result.savings.after.tokens} tokens`);
    console.log(`  Saved  : ${result.savedPct}%  🔥`);
  } catch (err) {
    console.log('failed');
    console.error(`  Error: ${err instanceof Error ? err.message : String(err)}`);
  }

  console.log('');
}

console.log(divider('═'));
console.log('  Done. Your AI agent gets the signal without the noise.');
console.log(divider('═') + '\n');
