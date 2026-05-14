import type { RNSignal } from '../types/index.js';
import { JEST_PATTERNS, scoreLineRelevance } from './patterns.js';

export interface JestParseResult {
  signals: RNSignal[];
  passed: string[];
  failed: string[];
  summary: string | null;
  totalTests: number | null;
  totalFailed: number | null;
  coverageLines: string[];
  overallPassed: boolean | null;
}

export function parseJestOutput(raw: string): JestParseResult {
  const lines = raw.split('\n');
  const signals: RNSignal[] = [];
  const passed: string[] = [];
  const failed: string[] = [];
  const coverageLines: string[] = [];
  let summary: string | null = null;
  let totalTests: number | null = null;
  let totalFailed: number | null = null;

  let inFailureBlock = false;
  const failureBlock: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const score = scoreLineRelevance(trimmed);

    if (JEST_PATTERNS.passLine.test(trimmed)) {
      const suiteName = trimmed.replace(/^\s*PASS\s+/, '').trim();
      passed.push(suiteName);
      signals.push({ type: 'jest-pass', line: trimmed, score: score + 2, lineNumber: i + 1 });
      inFailureBlock = false;
    } else if (JEST_PATTERNS.failLine.test(trimmed)) {
      const suiteName = trimmed.replace(/^\s*FAIL\s+/, '').trim();
      failed.push(suiteName);
      signals.push({ type: 'jest-fail', line: trimmed, score: score + 8, lineNumber: i + 1 });
      inFailureBlock = true;
    } else if (JEST_PATTERNS.summaryLine.test(trimmed)) {
      summary = (summary ? summary + ' ' : '') + trimmed;
      signals.push({ type: 'jest-summary', line: trimmed, score: score + 5, lineNumber: i + 1 });

      const testMatch = trimmed.match(/Tests?:\s+(\d+)\s+failed.*?(\d+)\s+total/i);
      if (testMatch) {
        totalFailed = parseInt(testMatch[1], 10);
        totalTests = parseInt(testMatch[2], 10);
      }
      const totalMatch = trimmed.match(/Tests?:\s+(\d+)\s+passed.*?(\d+)\s+total/i);
      if (totalMatch) {
        totalTests = parseInt(totalMatch[2], 10);
      }
    } else if (JEST_PATTERNS.coverageLine.test(trimmed)) {
      coverageLines.push(trimmed);
      signals.push({ type: 'jest-summary', line: trimmed, score, lineNumber: i + 1 });
    } else if (inFailureBlock && JEST_PATTERNS.assertionError.test(trimmed)) {
      failureBlock.push(trimmed);
      signals.push({ type: 'jest-fail', line: trimmed, score: score + 4, lineNumber: i + 1 });
    } else if (JEST_PATTERNS.errorStack.test(trimmed) && inFailureBlock) {
      signals.push({ type: 'stack-trace', line: trimmed, score: 2, lineNumber: i + 1 });
    } else if (score > 1 && !JEST_PATTERNS.consoleOutput.test(trimmed)) {
      signals.push({ type: 'generic', line: trimmed, score, lineNumber: i + 1 });
    }
  }

  const overallPassed = failed.length === 0 && passed.length > 0 ? true
    : failed.length > 0 ? false
    : null;

  return {
    signals,
    passed,
    failed,
    summary,
    totalTests,
    totalFailed,
    coverageLines,
    overallPassed,
  };
}

export function summarizeJest(result: JestParseResult): string {
  const parts: string[] = [];

  if (result.overallPassed === true) {
    parts.push(`P=JEST all ${result.passed.length} suite(s) passed`);
  } else if (result.overallPassed === false) {
    parts.push(`S=JEST FAIL ${result.failed.length} suite(s) failed`);
    parts.push(`N=${result.failed.slice(0, 5).join(', ')}`);
  }

  if (result.summary) parts.push(`O=${result.summary}`);

  if (result.totalFailed !== null && result.totalTests !== null) {
    parts.push(`D=${result.totalFailed}/${result.totalTests} tests failed`);
  }

  return parts.join('\n');
}
