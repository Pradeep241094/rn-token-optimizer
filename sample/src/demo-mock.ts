/**
 * demo-mock.ts
 *
 * Demonstrates rn-token-optimizer WITHOUT an API key.
 * Uses pre-canned compressed outputs so you can see exactly what the tool
 * produces in a real React Native project — no Anthropic account needed.
 *
 * Run:
 *   npm run demo:mock
 */

import { countTokensSync } from 'rn-token-optimizer';
import { VERBOSE_PROMPTS } from '../data/verbose-prompts.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function divider(char = '─', len = 70): string {
  return char.repeat(len);
}

function savingsBar(pct: number): string {
  const filled = Math.round(pct / 5);
  const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
  return `[${bar}] ${pct.toFixed(1)}%`;
}

function tokenSavingsLine(before: string, after: string): string {
  const b = countTokensSync(before);
  const a = countTokensSync(after);
  const saved = b.tokens - a.tokens;
  const pct = b.tokens > 0 ? (saved / b.tokens) * 100 : 0;
  return (
    `  Before : ${b.tokens} tokens  ${b.chars} chars  ${b.words} words\n` +
    `  After  : ${a.tokens} tokens  ${a.chars} chars  ${a.words} words\n` +
    `  Savings: ${savingsBar(pct)}  🔥 ${saved} tokens saved`
  );
}

function printHeader(title: string): void {
  console.log('\n' + divider('═'));
  console.log(`  ${title}`);
  console.log(divider('═'));
}

function printSection(label: string): void {
  console.log('\n' + divider());
  console.log(`  ${label}`);
  console.log(divider());
}

// ─── Pre-canned compressed outputs (what Claude Haiku actually returns) ───────

const MOCK_TERMINAL_RESULTS: Record<string, { question: string; answer: string }> = {
  jest: {
    question: 'Which tests failed and why?',
    answer: [
      'S=JEST FAIL 2 suites 3 tests',
      'N=LoginScreen.test.tsx RootNavigator.test.tsx',
      'C=LoginScreen: getByTestId error-message undefined | nav.navigate not called',
      'C=RootNavigator: tab-navigator testId null C=auth state not set',
      'O=17/20 passed',
      'D=fix A mock + nav mock setup',
    ].join('\n'),
  },
  metro: {
    question: 'Did the Metro bundle succeed? What went wrong?',
    answer: [
      'S=METRO bundle FAIL',
      'C=SyntaxError CheckoutScreen.tsx:47 TransformError',
      'D=fix syntax CheckoutScreen.tsx:47 PaymentService.charge call',
      'R=bundle blocked until fixed',
    ].join('\n'),
  },
  android: {
    question: 'Did the Android build succeed? What do I need to fix?',
    answer: [
      'S=AND build FAIL',
      'C=Manifest merger fail: app@label conflict google-play-services-auth',
      'D=add tools:replace="android:label" to AndroidManifest.xml <application>',
      'R=block all AND debug builds',
    ].join('\n'),
  },
};

// ─── Section 1: Prompt Optimization ──────────────────────────────────────────

function runPromptDemo(): void {
  printHeader('MODE 1 — PROMPT OPTIMIZATION  (before sending to your AI agent)');

  console.log('\n  The tool compresses verbose prompts into lean DSL before you');
  console.log('  paste them into Claude, Codex, or Cursor.\n');

  for (const example of VERBOSE_PROMPTS.slice(0, 4)) {
    printSection(`Category: ${example.category}`);

    console.log('\n  VERBOSE PROMPT (what you normally type):');
    const verboseLines = example.verbose.match(/.{1,65}/g) ?? [example.verbose];
    for (const line of verboseLines) {
      console.log(`    ${line}`);
    }

    console.log('\n  OPTIMIZED PROMPT (what rn-token-optimizer sends to the LLM):');
    console.log(`    ${example.expectedCompressed}`);

    console.log('\n' + tokenSavingsLine(example.verbose, example.expectedCompressed));
  }
}

// ─── Section 2: Terminal Output Compression ───────────────────────────────────

function runTerminalDemo(): void {
  printHeader('MODE 2 — TERMINAL OUTPUT COMPRESSION  (compress command output)');

  console.log('\n  Pipe Metro/Jest/build logs and ask a question.');
  console.log('  The tool strips noise and returns a compact DSL answer.\n');

  for (const [key, result] of Object.entries(MOCK_TERMINAL_RESULTS)) {
    const fileMap: Record<string, string> = { jest: 'jest-output.txt', metro: 'metro-output.txt', android: 'android-build.txt' };
    const rawOutput = readFileSync(join(dataDir, fileMap[key] ?? `${key}-output.txt`), 'utf8');

    printSection(`Command: ${key === 'jest' ? 'npx jest --coverage' : key === 'metro' ? 'npx react-native start' : 'npx react-native run-android'}`);

    console.log(`\n  QUESTION: "${result.question}"`);

    console.log(`\n  RAW OUTPUT (${rawOutput.split('\n').length} lines, noisy):`);
    const preview = rawOutput.split('\n').slice(0, 4).join('\n');
    for (const line of preview.split('\n')) {
      console.log(`    ${line}`);
    }
    console.log('    ...');

    console.log('\n  COMPRESSED ANSWER (DSL output):');
    for (const line of result.answer.split('\n')) {
      console.log(`    ${line}`);
    }

    console.log('\n' + tokenSavingsLine(rawOutput, result.answer));
  }
}

// ─── Section 3: DSL reference ─────────────────────────────────────────────────

function runDSLDemo(): void {
  printHeader('DSL REFERENCE — The compression language');

  const dsl = [
    ['PREFIX', 'KEY', 'MEANING'],
    ['─────────────────────────────────────────────────────────────────────', '', ''],
    ['Fixed prefixes', 'S=', 'state'],
    ['', 'C=', 'cause / context'],
    ['', 'D=', 'action / decision'],
    ['', 'R=', 'risk'],
    ['', 'O=', 'outcome'],
    ['', 'N=', 'no-go / failure'],
    ['', 'P=', 'proof / pass'],
    ['─────────────────────────────────────────────────────────────────────', '', ''],
    ['RN Aliases', 'METRO', 'Metro bundler'],
    ['', 'JEST', 'Jest / RNTL'],
    ['', 'NAV', 'React Navigation'],
    ['', 'NATIVE', 'Native module'],
    ['', 'IOS', 'iOS build / device'],
    ['', 'AND', 'Android build / device'],
    ['', 'REDBOX', 'Red screen error'],
    ['', 'HOT', 'HMR / Fast Refresh'],
    ['─────────────────────────────────────────────────────────────────────', '', ''],
    ['Base Aliases', 'A', 'auth'],
    ['', 'B', 'backend'],
    ['', 'F', 'frontend'],
    ['', 'U', 'UI'],
    ['', 'X', 'deps'],
    ['', 'CFG', 'config'],
  ];

  for (const [prefix, key, meaning] of dsl) {
    if (key === '') {
      console.log(`  ${prefix}`);
    } else {
      console.log(`  ${prefix.padEnd(16)} ${key.padEnd(10)} ${meaning}`);
    }
  }

  console.log('\n  INLINE VARIABLES (model-chosen, thread-local):');
  console.log('    The LLM picks #shortkeys for repeated nouns dynamically:');
  console.log('      S cache=#c1 warmed model=#m1');
  console.log('      D inspect #c1 hit rate');
  console.log('      D compare #m1 latency');
}

// ─── Section 4: Real workflow example ─────────────────────────────────────────

function runWorkflowDemo(): void {
  printHeader('REAL WORKFLOW — How a developer uses this every day');

  const steps = [
    {
      step: '1. Optimize a prompt before sending to Cursor/Claude',
      command: 'rn-token-optimizer "I need you to help me fix the issue where the FlatList renders slowly with 100 items on Android"',
      output: 'D=fix FlatList perf lag 100+ items AND',
      saved: '~73%',
    },
    {
      step: '2. Run tests and compress the output',
      command: 'npx jest 2>&1 | rn-token-optimizer "Which tests failed?"',
      output: 'S=JEST FAIL 2 suites\nN=LoginScreen.test.tsx RootNavigator.test.tsx\nD=fix A mock + nav mock setup',
      saved: '~97%',
    },
    {
      step: '3. Check a failing Android build',
      command: 'npx react-native run-android 2>&1 | rn-token-optimizer "What caused the build failure?"',
      output: 'S=AND build FAIL\nC=Manifest merger label conflict play-services-auth\nD=add tools:replace android:label to AndroidManifest.xml',
      saved: '~95%',
    },
    {
      step: '4. Get the slash command for your AI agent session',
      command: 'rn-token-optimizer slash --project "MyShoppingApp"',
      output: '/rn-token-optimizer\n[agent adopts DSL for entire thread]',
      saved: 'ongoing',
    },
    {
      step: '5. Manage what the tool has learned from your project',
      command: 'rn-token-optimizer dsl show',
      output: '── Learned Terms ──\n  AUTHSVC = AuthenticationService\n  CARTCTX = ShoppingCartContext',
      saved: 'cumulative',
    },
  ];

  for (const { step, command, output, saved } of steps) {
    console.log(`\n  ${step}`);
    console.log(`\n    $ ${command}`);
    console.log('\n    Output:');
    for (const line of output.split('\n')) {
      console.log(`      ${line}`);
    }
    console.log(`\n    Tokens saved: ${saved}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.clear();
console.log('\n' + divider('═'));
console.log('  🔥  rn-token-optimizer — React Native Token Optimizer');
console.log('  MOCK DEMO  (no API key needed — pre-canned outputs)');
console.log(divider('═'));
console.log('\n  This demo shows what the tool produces in a real RN project.');
console.log('  To run with a real Anthropic API key: npm run demo');

runPromptDemo();
runTerminalDemo();
runDSLDemo();
runWorkflowDemo();

console.log('\n' + divider('═'));
console.log('  Setup: npm i -g rn-token-optimizer && rn-token-optimizer');
console.log('  Docs : see ../README.md');
console.log(divider('═') + '\n');
