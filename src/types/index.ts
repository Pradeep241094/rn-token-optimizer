// ─── LLM Provider ────────────────────────────────────────────────────────────

export interface ILLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ILLMProvider {
  complete(messages: ILLMMessage[]): Promise<string>;
  model: string;
}

// ─── Token Counting ───────────────────────────────────────────────────────────

export interface TokenCount {
  tokens: number;
  chars: number;
  words: number;
}

export interface TokenSavings {
  before: TokenCount;
  after: TokenCount;
  savedTokens: number;
  savedPct: number;
}

// ─── RN Signal Extraction (terminal output mode) ─────────────────────────────

export type RNSignalType =
  | 'metro-error'
  | 'metro-warning'
  | 'metro-success'
  | 'jest-fail'
  | 'jest-pass'
  | 'jest-summary'
  | 'ts-error'
  | 'crash'
  | 'native-error'
  | 'stack-trace'
  | 'generic';

export interface RNSignal {
  type: RNSignalType;
  line: string;
  score: number;
  lineNumber?: number;
}

export interface ExtractedSignals {
  signals: RNSignal[];
  compressedText: string;
  originalLineCount: number;
  compressedLineCount: number;
}

// ─── RN Prompt Context (prompt optimization mode) ─────────────────────────────

export type RNDomain =
  | 'auth'
  | 'navigation'
  | 'metro'
  | 'jest'
  | 'native-module'
  | 'bridge'
  | 'android'
  | 'ios'
  | 'typescript'
  | 'styling'
  | 'state'
  | 'network'
  | 'generic';

export interface PromptContext {
  domains: RNDomain[];
  entities: string[];       // component names, file names, identifiers found in the prompt
  isQuestion: boolean;
  isActionRequest: boolean;
  verbosityScore: number;   // 0–10, higher = more compressible
}

// ─── DSL System ───────────────────────────────────────────────────────────────

export type DSLScope = 'global' | 'project';

export interface DSLEntry {
  value: string;
  scope: DSLScope;
  pinned: boolean;
  uses: number;
  lastSeen?: string;
}

export interface DSLCandidate {
  value: string;
  uses: number;
  firstSeen: string;
  lastSeen: string;
}

export interface DSLLearnedEntry {
  value: string;
  promoted: string;
  lastSeen?: string;
}

export interface DSLMemory {
  aliases: Record<string, DSLEntry>;
  macros: Record<string, string>;
  defaults: Record<string, string>;
  candidates: Record<string, DSLCandidate>;
  learned: Record<string, DSLLearnedEntry>;
}

export interface DSLBuiltins {
  prefixes: Record<string, string>;
  aliases: Record<string, string>;
  macros: Record<string, string>;
  defaults: Record<string, string>;
}

// ─── Optimize Result (prompt compression) ────────────────────────────────────

export interface OptimizeResult {
  /** The compressed, token-efficient prompt ready to send to an AI agent */
  optimizedPrompt: string;
  /** The original verbose prompt */
  originalPrompt: string;
  savings: TokenSavings;
  savedPct: number;
  model: string;
  context: PromptContext;
}

// ─── Distill Result (terminal output compression) ────────────────────────────

export interface DistillResult {
  /** Compressed DSL answer to the question */
  output: string;
  savings: TokenSavings;
  savedPct: number;
  model: string;
  question: string;
}

// ─── Project Index ────────────────────────────────────────────────────────────

export interface ProjectDep {
  name: string;
  version: string;
  dslAlias?: string;   // e.g. "NAV", "JEST", "METRO"
}

export interface RequirementFile {
  path: string;        // relative to project root
  type: 'spec' | 'requirements' | 'story' | 'design' | 'readme' | 'changelog' | 'other';
  lines: number;
  tokens: number;
  summary?: string;    // first non-empty heading/sentence
}

export interface ProjectIndex {
  name: string;
  root: string;               // absolute path
  indexedAt: string;          // ISO timestamp
  rnVersion?: string;
  stack: ProjectDep[];        // key deps with DSL aliases
  tree: string;               // compact directory tree (token-efficient)
  requirementFiles: RequirementFile[];
  keyFiles: string[];         // entry points, nav roots, store roots etc.
  customAliases: string[];    // learned from this project's file names
  contextDoc: string;         // the full steering document (token-optimised)
  stats: {
    totalFiles: number;
    totalTokens: number;
    tsFiles: number;
    testFiles: number;
  };
}

// ─── Config ───────────────────────────────────────────────────────────────────

export type AnthropicModel =
  | 'claude-haiku-4-5'
  | 'claude-3-5-haiku-20241022'
  | 'claude-sonnet-4-5'
  | 'claude-3-5-sonnet-20241022';

export interface AppConfig {
  anthropicApiKey: string;
  model: AnthropicModel;
  defaultScope: DSLScope;
  promotionThreshold: number;
  pruneAfterDays: number;
  learnThreadMinUses: number;
}

export const DEFAULT_CONFIG: Omit<AppConfig, 'anthropicApiKey'> = {
  model: 'claude-3-5-haiku-20241022',
  defaultScope: 'project',
  promotionThreshold: 3,
  pruneAfterDays: 30,
  learnThreadMinUses: 5,
};

// ─── Graph / Code Intelligence ────────────────────────────────────────────────

export type {
  NodeLabel,
  EdgeType,
  GraphNode,
  GraphEdge,
  GraphProject,
  SearchOptions,
  TraceOptions,
  SearchResult,
  TraceNode,
  TraceResult,
  HotspotEntry,
  ArchitectureReport,
  ChangeImpact,
  DeadCodeEntry,
  ParsedFile,
  RawCallRef,
  RawNavigateRef,
  RawRenderRef,
} from '../graph/types.js';
