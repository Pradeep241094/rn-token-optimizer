// Shared regex patterns for React Native output parsing

export const METRO_PATTERNS = {
  bundleSuccess: /^BUNDLE\s+\.\//i,
  bundleError: /^error\s+watching\s+file|bundling\s+failed|error\s+in\s+.*:\s*\d+/i,
  syntaxError: /SyntaxError|Unexpected token|Cannot find module/i,
  transformError: /^TransformError|Unable to transform/i,
  cacheCleared: /transformed\s+\d+|cache\s+miss|cache\s+warmed/i,
  hmrUpdate: /fast.?refresh|HMR\s+(connected|update)|reload/i,
  serverStart: /Metro.*waiting|Running.*on port|Metro Bundler/i,
  dependencyError: /Cannot find module|Module not found|Unable to resolve/i,
  warning: /^warn\s+|^\s*warning:/i,
  errorLine: /^error\s+/i,
} as const;

export const JEST_PATTERNS = {
  passLine: /^\s*PASS\s+/,
  failLine: /^\s*FAIL\s+/,
  testPassed: /✓|✔|●\s+.*passed|pass/i,
  testFailed: /✕|✗|●\s+|FAIL|failed/i,
  assertionError: /expect\(.*\)\.|toEqual|toBe|toHaveBeenCalled|received:|expected:/i,
  summaryLine: /Tests?:\s+\d+|Test Suites?:\s+\d+|Snapshots?:|Time:/i,
  coverageLine: /Coverage\s+(provider|summary)|All files|Stmts|Branch|Lines/i,
  errorStack: /^\s+at\s+\w|^\s+●/,
  consoleOutput: /console\.(log|warn|error|info)/,
} as const;

export const ERROR_PATTERNS = {
  redboxError: /React Native Error|Invariant Violation|RedBox|FATAL/i,
  nativeModule: /Native module|RCT|NativeModules|requireNativeComponent/i,
  bridgeError: /bridge\s+(error|crash|disconnect)|JS thread|UI thread/i,
  crashLog: /SIGSEGV|SIGABRT|Fatal Exception|NSException|crash/i,
  stackFrame: /^\s+at\s+[\w.<>$[\]]+\s+\(|^\s+at\s+[\w.]+:\d+:\d+/,
  androidError: /AndroidException|java\.|android\.|Caused by:/i,
  iosError: /EXC_BAD_ACCESS|objc_msgSend|libobjc\.A\.dylib|CoreFoundation/i,
  moduleNotFound: /Cannot find module|Module not found|package\.json/i,
  networkError: /Network request failed|ECONNREFUSED|ETIMEDOUT|fetch\s+failed/i,
} as const;

export const NOISE_PATTERNS = [
  /^\s*$/,
  /^Browserslist:/,
  /^\[.*\]\s*$/,
  /^Loading dependency graph/,
  /^Scanning\s+\d+/,
  /watchman.*warning/i,
  /^info\s+Fetching|^info\s+Found|^info\s+Loading/i,
  /^\s+\d+\s*\|\s/,
  /^[─━═]+$/,
  /node_modules\/.cache/,
  /^> react-native/,
] as const;

export const HIGH_SIGNAL_PATTERNS = [
  METRO_PATTERNS.bundleError,
  METRO_PATTERNS.syntaxError,
  METRO_PATTERNS.transformError,
  METRO_PATTERNS.dependencyError,
  JEST_PATTERNS.failLine,
  JEST_PATTERNS.assertionError,
  JEST_PATTERNS.summaryLine,
  ERROR_PATTERNS.redboxError,
  ERROR_PATTERNS.nativeModule,
  ERROR_PATTERNS.crashLog,
  ERROR_PATTERNS.moduleNotFound,
] as const;

export function isNoise(line: string): boolean {
  return NOISE_PATTERNS.some((p) => p.test(line));
}

export function isHighSignal(line: string): boolean {
  return HIGH_SIGNAL_PATTERNS.some((p) => p.test(line));
}

export function scoreLineRelevance(line: string): number {
  const trimmed = line.trim();
  if (!trimmed) return 0;
  if (isNoise(trimmed)) return 0;

  let score = 1;

  if (isHighSignal(trimmed)) score += 10;
  if (ERROR_PATTERNS.stackFrame.test(trimmed)) score += 3;
  if (JEST_PATTERNS.summaryLine.test(trimmed)) score += 5;
  if (JEST_PATTERNS.assertionError.test(trimmed)) score += 4;
  if (METRO_PATTERNS.bundleSuccess.test(trimmed)) score += 3;
  if (METRO_PATTERNS.serverStart.test(trimmed)) score += 2;
  if (JEST_PATTERNS.passLine.test(trimmed)) score += 2;
  if (JEST_PATTERNS.failLine.test(trimmed)) score += 8;

  return score;
}
