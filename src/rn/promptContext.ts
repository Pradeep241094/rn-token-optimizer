import type { PromptContext, RNDomain } from '../types/index.js';

// Domain keyword map — detects which RN areas a prompt touches
const DOMAIN_KEYWORDS: Record<RNDomain, RegExp> = {
  auth: /\b(auth|login|logout|sign.?in|sign.?out|token|jwt|oauth|session|credential|password|biometric|face.?id|touch.?id)\b/i,
  navigation: /\b(navigation|navigator|screen|route|router|stack|tab|drawer|deep.?link|linking|goBack|navigate|push|pop|react.?navigation)\b/i,
  metro: /\b(metro|bundle|bundl|transform|haste|cache|watch|fast.?refresh|hmr|hot.?reload)\b/i,
  jest: /\b(jest|test|spec|snapshot|mock|spy|describe|it\(|expect|beforeEach|afterEach|coverage|react.?native.?testing)\b/i,
  'native-module': /\b(native.?module|requireNativeComponent|RCT|NativeModules|TurboModule|JSI|native.?bridge|native.?event)\b/i,
  bridge: /\b(bridge|js.?thread|ui.?thread|native.?thread|serializ|async.?native|batch)\b/i,
  android: /\b(android|gradle|apk|aab|play.?store|kotlin|java|manifest|proguard|minify|build\.gradle|MainApplication)\b/i,
  ios: /\b(ios|xcode|swift|objective.?c|cocoapods|pod.?file|info\.plist|app.?store|simulator|provisioning|signing)\b/i,
  typescript: /\b(typescript|ts.?error|type.?error|interface|generic|tsconfig|infer|as\s+\w|type\s+\w|\.tsx?)\b/i,
  styling: /\b(style|stylesheet|flexbox|flex|layout|dimension|responsive|safe.?area|statusbar|theme|darkmode|color)\b/i,
  state: /\b(redux|zustand|recoil|mobx|context|useReducer|useState|state.?management|store|dispatch|selector)\b/i,
  network: /\b(fetch|axios|api|request|response|http|rest|graphql|websocket|upload|download|network|endpoint)\b/i,
  generic: /./,
};

// Verbosity indicators — phrases that add tokens without adding meaning
const VERBOSITY_PATTERNS = [
  /\b(please|could you|can you|i need you to|i would like|i want you to|would you mind)\b/gi,
  /\b(basically|essentially|actually|literally|just|simply|really|very|quite)\b/gi,
  /\b(in my react native (app|project|codebase))\b/gi,
  /\b(i am (having|getting|experiencing) an? (issue|problem|error|bug))\b/gi,
  /\b(i have been (trying|attempting) to)\b/gi,
  /\b(the (issue|problem) is that|the thing is|what (happens|i see) is)\b/gi,
  /\b(as you can see|as mentioned|as i said)\b/gi,
  /\b(i hope this makes sense|thank you in advance|any help would be appreciated)\b/gi,
];

// Entity extraction — file names, component names, version strings
const ENTITY_PATTERNS = [
  /[\w/]+\.(tsx?|jsx?|json|gradle|swift|kt|m)\b/g,    // file names
  /v?\d+\.\d+(\.\d+)?/g,                               // version strings
  /[A-Z][a-zA-Z]+(?:Screen|Component|Hook|Context|Provider|Navigator|Stack|Store)\b/g, // RN component names
  /<[A-Z][a-zA-Z]+/g,                                   // JSX components
];

export function analyzePromptContext(prompt: string): PromptContext {
  const lower = prompt.toLowerCase();

  // Detect domains
  const domains: RNDomain[] = [];
  for (const [domain, pattern] of Object.entries(DOMAIN_KEYWORDS) as [RNDomain, RegExp][]) {
    if (domain === 'generic') continue;
    if (pattern.test(prompt)) domains.push(domain);
  }
  if (domains.length === 0) domains.push('generic');

  // Extract entities
  const entities: string[] = [];
  for (const pattern of ENTITY_PATTERNS) {
    const matches = prompt.match(pattern);
    if (matches) entities.push(...matches.slice(0, 5));
  }

  // Detect intent
  const isQuestion = /\?|^(what|how|why|when|where|is|are|does|do|can|should|will)\b/i.test(prompt.trim());
  const isActionRequest = /\b(fix|create|add|update|implement|refactor|debug|optimize|remove|rename|migrate|convert|build|generate)\b/i.test(lower);

  // Verbosity score: count how many verbosity patterns fire
  let verbosityMatches = 0;
  for (const p of VERBOSITY_PATTERNS) {
    const m = prompt.match(p);
    if (m) verbosityMatches += m.length;
  }
  const wordCount = prompt.split(/\s+/).filter(Boolean).length;
  // Scale: 10+ filler words in a 50-word prompt = very verbose
  const verbosityScore = Math.min(10, Math.round((verbosityMatches / Math.max(wordCount, 1)) * 50));

  return {
    domains,
    entities: [...new Set(entities)],
    isQuestion,
    isActionRequest,
    verbosityScore,
  };
}

export function buildDomainHints(context: PromptContext): string {
  if (context.domains.length === 0 || context.domains[0] === 'generic') return '';

  const aliasMap: Partial<Record<RNDomain, string>> = {
    auth: 'A (auth)',
    navigation: 'NAV (navigation)',
    metro: 'METRO (Metro bundler)',
    jest: 'JEST (test runner)',
    'native-module': 'NATIVE (native module)',
    bridge: 'BRIDGE (JS-native bridge)',
    android: 'AND (Android)',
    ios: 'IOS (iOS)',
    typescript: 'TS (TypeScript)',
    styling: 'U (UI/styling)',
    state: 'CFG (state/config)',
    network: 'B (backend/network)',
  };

  const hints = context.domains
    .map((d) => aliasMap[d])
    .filter(Boolean)
    .join(', ');

  return hints ? `Relevant DSL aliases for this prompt: ${hints}` : '';
}
