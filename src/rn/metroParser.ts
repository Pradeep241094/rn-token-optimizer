import type { RNSignal } from '../types/index.js';
import { METRO_PATTERNS, scoreLineRelevance } from './patterns.js';

export interface MetroParseResult {
  signals: RNSignal[];
  bundleSucceeded: boolean | null;
  errors: string[];
  warnings: string[];
  serverStarted: boolean;
  hmrActive: boolean;
}

export function parseMetroOutput(raw: string): MetroParseResult {
  const lines = raw.split('\n');
  const signals: RNSignal[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  let bundleSucceeded: boolean | null = null;
  let serverStarted = false;
  let hmrActive = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const score = scoreLineRelevance(trimmed);

    if (score === 0) continue;

    if (METRO_PATTERNS.bundleSuccess.test(trimmed)) {
      bundleSucceeded = true;
      signals.push({ type: 'metro-success', line: trimmed, score: score + 5, lineNumber: i + 1 });
    } else if (
      METRO_PATTERNS.bundleError.test(trimmed) ||
      METRO_PATTERNS.syntaxError.test(trimmed) ||
      METRO_PATTERNS.transformError.test(trimmed) ||
      METRO_PATTERNS.dependencyError.test(trimmed)
    ) {
      bundleSucceeded = false;
      errors.push(trimmed);
      signals.push({ type: 'metro-error', line: trimmed, score: score + 10, lineNumber: i + 1 });
    } else if (METRO_PATTERNS.warning.test(trimmed)) {
      warnings.push(trimmed);
      signals.push({ type: 'metro-warning', line: trimmed, score, lineNumber: i + 1 });
    } else if (METRO_PATTERNS.serverStart.test(trimmed)) {
      serverStarted = true;
      signals.push({ type: 'metro-success', line: trimmed, score, lineNumber: i + 1 });
    } else if (METRO_PATTERNS.hmrUpdate.test(trimmed)) {
      hmrActive = true;
      signals.push({ type: 'metro-success', line: trimmed, score, lineNumber: i + 1 });
    } else if (score > 1) {
      signals.push({ type: 'generic', line: trimmed, score, lineNumber: i + 1 });
    }
  }

  return { signals, bundleSucceeded, errors, warnings, serverStarted, hmrActive };
}

export function summarizeMetro(result: MetroParseResult): string {
  const parts: string[] = [];

  if (result.bundleSucceeded === true) parts.push('S=METRO bundle OK');
  if (result.bundleSucceeded === false) parts.push('S=METRO bundle FAIL');
  if (result.serverStarted) parts.push('S=METRO server started');
  if (result.hmrActive) parts.push('S=HOT refresh active');

  if (result.errors.length > 0) {
    parts.push(`C=${result.errors.slice(0, 3).join(' | ')}`);
  }
  if (result.warnings.length > 0) {
    parts.push(`R=${result.warnings.length} warning(s)`);
  }

  return parts.join('\n');
}
