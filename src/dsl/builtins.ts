import type { DSLBuiltins } from '../types/index.js';

export const BUILTINS: DSLBuiltins = {
  prefixes: {
    S: 'state',
    C: 'cause/context',
    D: 'action/decision',
    R: 'risk',
    O: 'outcome',
    N: 'no-go',
    P: 'proof/pass',
  },

  aliases: {
    // Base (same as @samuelfaj/distill)
    A: 'auth',
    B: 'backend',
    F: 'frontend',
    E: 'E2E',
    V: 'env',
    X: 'deps',
    U: 'UI',
    DB: 'database',
    CFG: 'config',
    DOC: 'docs',
    PERM: 'permissions',
    // React Native specific
    METRO: 'Metro bundler',
    JEST: 'Jest/RNTL test runner',
    NAV: 'React Navigation',
    NATIVE: 'native module',
    BRIDGE: 'JS-native bridge',
    HOT: 'HMR/fast-refresh',
    PACK: 'package manager',
    TS: 'TypeScript error',
    IOS: 'iOS build',
    AND: 'Android build',
    REDBOX: 'red-screen error',
  },

  macros: {
    // Base (same as @samuelfaj/distill)
    '1': 'test first',
    '2': 'run tests',
    '3': 'report summary/files/tests/status',
    '4': 'review',
    '5': 'fix',
    '6': 'validate',
    '7': 'commit/push',
    '8': 'PR',
    '9': 'release',
    '0': 'raw output',
    // React Native specific
    M1: 'run Metro bundler',
    M2: 'build iOS',
    M3: 'build Android',
    M4: 'clear Metro cache + restart',
    M5: 'check native device logs',
  },

  defaults: {
    // Base negation guards (same as @samuelfaj/distill)
    N1: 'no frontend changes',
    N2: 'no backend changes',
    N3: 'no UI changes',
    N4: 'no broad refactor',
    N5: 'preserve user changes',
    N6: 'TUI/interactive',
    // React Native specific
    N7: 'no iOS-only changes',
    N8: 'no Android-only changes',
    N9: 'preserve native code',
  },
};

export function buildDSLReferenceText(builtins: DSLBuiltins = BUILTINS): string {
  const lines: string[] = [];

  lines.push('=== DSL REFERENCE ===');
  lines.push('');
  lines.push('Fixed prefixes (semantic atoms):');
  for (const [k, v] of Object.entries(builtins.prefixes)) {
    lines.push(`  ${k}  ${v}`);
  }

  lines.push('');
  lines.push('Aliases:');
  for (const [k, v] of Object.entries(builtins.aliases)) {
    lines.push(`  ${k}  ${v}`);
  }

  lines.push('');
  lines.push('Macros:');
  for (const [k, v] of Object.entries(builtins.macros)) {
    lines.push(`  ${k}  ${v}`);
  }

  lines.push('');
  lines.push('Defaults (active negation guards):');
  for (const [k, v] of Object.entries(builtins.defaults)) {
    lines.push(`  ${k}  ${v}`);
  }

  return lines.join('\n');
}
