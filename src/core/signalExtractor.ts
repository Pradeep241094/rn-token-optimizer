import type { ExtractedSignals, RNSignal } from '../types/index.js';
import { parseMetroOutput } from '../rn/metroParser.js';
import { parseJestOutput } from '../rn/jestParser.js';
import { parseErrorOutput } from '../rn/errorParser.js';
import { scoreLineRelevance, isNoise } from '../rn/patterns.js';

type InputType = 'metro' | 'jest' | 'error' | 'generic';

function detectInputType(raw: string): InputType {
  if (/Metro\s+Bundler|BUNDLE\s+\.\//i.test(raw)) return 'metro';
  if (/^\s*(PASS|FAIL)\s+\S/m.test(raw)) return 'jest';
  if (/Invariant Violation|RedBox|SIGSEGV|Fatal Exception/i.test(raw)) return 'error';
  return 'generic';
}

function deduplicateLines(lines: string[]): string[] {
  const seen = new Set<string>();
  return lines.filter((l) => {
    const norm = l.trim().toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(norm)) return false;
    seen.add(norm);
    return true;
  });
}

function extractGenericSignals(raw: string): RNSignal[] {
  const lines = raw.split('\n');
  const signals: RNSignal[] = [];
  for (let i = 0; i < lines.length; i++) {
    const score = scoreLineRelevance(lines[i]);
    if (score > 0) {
      signals.push({ type: 'generic', line: lines[i].trim(), score, lineNumber: i + 1 });
    }
  }
  return signals;
}

export function extractSignals(raw: string): ExtractedSignals {
  const originalLines = raw.split('\n');
  const inputType = detectInputType(raw);

  let signals: RNSignal[] = [];

  switch (inputType) {
    case 'metro':
      signals = parseMetroOutput(raw).signals;
      break;
    case 'jest':
      signals = parseJestOutput(raw).signals;
      break;
    case 'error':
      signals = parseErrorOutput(raw).signals;
      break;
    default:
      signals = extractGenericSignals(raw);
  }

  // Sort by score descending, keep top signals
  signals.sort((a, b) => b.score - a.score);

  // Keep stack traces near error signals (context window of ±3 lines)
  const highSignalLineNums = new Set(
    signals.filter((s) => s.score >= 5).map((s) => s.lineNumber ?? -1),
  );

  const contextualSignals = signals.filter((s) => {
    if (s.score >= 3) return true;
    const ln = s.lineNumber ?? -1;
    for (const hl of highSignalLineNums) {
      if (Math.abs(ln - hl) <= 3) return true;
    }
    return false;
  });

  // Build compressed text from deduplicated relevant lines
  const relevantLines = deduplicateLines(
    contextualSignals
      .sort((a, b) => (a.lineNumber ?? 0) - (b.lineNumber ?? 0))
      .map((s) => s.line)
      .filter((l) => !isNoise(l)),
  );

  return {
    signals: contextualSignals,
    compressedText: relevantLines.join('\n'),
    originalLineCount: originalLines.length,
    compressedLineCount: relevantLines.length,
  };
}
