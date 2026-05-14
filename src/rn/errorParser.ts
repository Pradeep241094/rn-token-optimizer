import type { RNSignal } from '../types/index.js';
import { ERROR_PATTERNS, scoreLineRelevance } from './patterns.js';

export interface ErrorParseResult {
  signals: RNSignal[];
  errorType: 'redbox' | 'native' | 'crash' | 'network' | 'module' | 'generic' | null;
  errorMessage: string | null;
  stackFrames: string[];
  isAndroid: boolean;
  isIOS: boolean;
}

export function parseErrorOutput(raw: string): ErrorParseResult {
  const lines = raw.split('\n');
  const signals: RNSignal[] = [];
  const stackFrames: string[] = [];
  let errorType: ErrorParseResult['errorType'] = null;
  let errorMessage: string | null = null;
  let isAndroid = false;
  let isIOS = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const score = scoreLineRelevance(trimmed);

    if (ERROR_PATTERNS.redboxError.test(trimmed)) {
      errorType = errorType ?? 'redbox';
      errorMessage = errorMessage ?? trimmed;
      signals.push({ type: 'crash', line: trimmed, score: score + 10, lineNumber: i + 1 });
    } else if (ERROR_PATTERNS.nativeModule.test(trimmed)) {
      errorType = errorType ?? 'native';
      errorMessage = errorMessage ?? trimmed;
      signals.push({ type: 'native-error', line: trimmed, score: score + 8, lineNumber: i + 1 });
    } else if (ERROR_PATTERNS.crashLog.test(trimmed)) {
      errorType = errorType ?? 'crash';
      errorMessage = errorMessage ?? trimmed;
      signals.push({ type: 'crash', line: trimmed, score: score + 10, lineNumber: i + 1 });
    } else if (ERROR_PATTERNS.moduleNotFound.test(trimmed)) {
      errorType = errorType ?? 'module';
      errorMessage = errorMessage ?? trimmed;
      signals.push({ type: 'metro-error', line: trimmed, score: score + 8, lineNumber: i + 1 });
    } else if (ERROR_PATTERNS.networkError.test(trimmed)) {
      errorType = errorType ?? 'network';
      errorMessage = errorMessage ?? trimmed;
      signals.push({ type: 'native-error', line: trimmed, score: score + 6, lineNumber: i + 1 });
    } else if (ERROR_PATTERNS.androidError.test(trimmed)) {
      isAndroid = true;
      signals.push({ type: 'native-error', line: trimmed, score: score + 4, lineNumber: i + 1 });
    } else if (ERROR_PATTERNS.iosError.test(trimmed)) {
      isIOS = true;
      signals.push({ type: 'native-error', line: trimmed, score: score + 4, lineNumber: i + 1 });
    } else if (ERROR_PATTERNS.stackFrame.test(trimmed)) {
      stackFrames.push(trimmed);
      signals.push({ type: 'stack-trace', line: trimmed, score: 2, lineNumber: i + 1 });
    } else if (score > 1) {
      signals.push({ type: 'generic', line: trimmed, score, lineNumber: i + 1 });
    }
  }

  return { signals, errorType, errorMessage, stackFrames, isAndroid, isIOS };
}

export function summarizeError(result: ErrorParseResult): string {
  const parts: string[] = [];

  if (result.errorMessage) {
    parts.push(`S=${result.errorType?.toUpperCase() ?? 'ERR'} ${result.errorMessage.slice(0, 120)}`);
  }

  if (result.isAndroid) parts.push('C=AND platform');
  if (result.isIOS) parts.push('C=IOS platform');

  if (result.stackFrames.length > 0) {
    const topFrames = result.stackFrames.slice(0, 3);
    parts.push(`D=trace: ${topFrames.join(' → ').slice(0, 200)}`);
  }

  return parts.join('\n');
}
