/**
 * rn-token-optimizer — React Native Token Optimizer
 *
 * TWO MODES:
 *
 * 1. PROMPT OPTIMIZATION — compress verbose prompts before sending to an AI agent
 *    import { optimizePrompt } from 'rn-token-optimizer';
 *    const result = await optimizePrompt("I need you to fix the auth issue where Google login fails on Android 12");
 *    // result.optimizedPrompt → "D=fix A Google login fail AND v12+"
 *
 * 2. TERMINAL OUTPUT COMPRESSION — compress Metro/Jest/crash output to answer a question
 *    import { aiTokenOptimizer } from 'rn-token-optimizer';
 *    const result = await aiTokenOptimizer(jestOutput, "Did tests pass?");
 *    // result.output → "P=JEST all 20 passed"
 */

import { runDistillPipeline } from './core/distiller.js';
import { runPromptOptimizer } from './core/promptOptimizer.js';
import { computeSavings, countTokens, countTokensSync, formatSavingsLine } from './core/tokenCounter.js';
import { buildSlashCommandPrompt } from './core/promptBuilder.js';
import { analyzePromptContext } from './rn/promptContext.js';
import { createAnthropicProvider } from './llm/anthropic.js';
import {
  loadActiveMemory,
  loadGlobalMemory,
  loadProjectMemory,
  saveGlobalMemory,
  saveProjectMemory,
  addAlias,
  addMacro,
  pinAlias,
  pruneStale,
  mergeMemories,
  emptyMemory,
} from './dsl/memory.js';
import { learnFromDictPlus, learnFromThread, promoteEligibleCandidates } from './dsl/learner.js';
import { BUILTINS } from './dsl/builtins.js';
import { DEFAULT_CONFIG } from './types/index.js';

import type {
  DistillResult,
  OptimizeResult,
  DSLMemory,
  AppConfig,
  AnthropicModel,
  TokenSavings,
  PromptContext,
} from './types/index.js';

// ─── Re-exports ───────────────────────────────────────────────────────────────
export type { DistillResult, OptimizeResult, DSLMemory, AppConfig, AnthropicModel, TokenSavings, PromptContext };
export { BUILTINS, DEFAULT_CONFIG };

// ─── Shared options ───────────────────────────────────────────────────────────

export interface RNTokenOptimizerOptions {
  /** Anthropic API key. Falls back to ANTHROPIC_API_KEY env var. */
  apiKey?: string;
  /** Claude model to use. Defaults to claude-3-5-haiku-20241022. */
  model?: AnthropicModel;
  /** DSL scope for learning new entries. Defaults to 'project'. */
  scope?: 'global' | 'project';
}

// ─── Mode 1: Prompt Optimization ─────────────────────────────────────────────

/**
 * Compress a verbose developer prompt into a lean, token-efficient version
 * before sending it to an AI coding agent.
 *
 * The output preserves 100% of the original intent while stripping filler
 * words, applying DSL aliases, and using inline #var shorthands.
 *
 * @example
 * const result = await optimizePrompt(
 *   "I need you to please fix the issue in my React Native app where users can't log in with Google on Android 12"
 * );
 * console.log(result.optimizedPrompt); // "D=fix A Google login fail AND v12+"
 * console.log(result.savedPct);        // 71.3
 */
export async function optimizePrompt(
  verbosePrompt: string,
  options: RNTokenOptimizerOptions = {},
): Promise<OptimizeResult> {
  const provider = createAnthropicProvider(options.apiKey, options.model);
  return runPromptOptimizer(verbosePrompt, {
    provider,
    config: { defaultScope: options.scope ?? 'project' },
  });
}

// ─── Mode 2: Terminal Output Compression ─────────────────────────────────────

/**
 * Compress React Native command output (Metro, Jest, stack traces, etc.)
 * into a compact Military-English DSL answer to a specific question.
 *
 * @example
 * const result = await aiTokenOptimizer(jestOutput, "Which tests failed?");
 * console.log(result.output);    // "S=JEST FAIL 2 suites N=Login.test.tsx"
 * console.log(result.savedPct);  // 98.7
 */
export async function aiTokenOptimizer(
  rawTerminalOutput: string,
  question: string,
  options: RNTokenOptimizerOptions = {},
): Promise<DistillResult> {
  const provider = createAnthropicProvider(options.apiKey, options.model);
  return runDistillPipeline(rawTerminalOutput, {
    provider,
    question,
    config: { defaultScope: options.scope ?? 'project' },
  });
}

// ─── Token Counting ───────────────────────────────────────────────────────────

export { countTokens, countTokensSync, computeSavings, formatSavingsLine };

// ─── Prompt Context Analysis ─────────────────────────────────────────────────

/**
 * Analyze a prompt to detect RN domains, entities, and verbosity score
 * without calling the LLM.
 */
export { analyzePromptContext };

// ─── DSL Memory Management ────────────────────────────────────────────────────

export const dslMemory = {
  load: loadActiveMemory,
  loadGlobal: loadGlobalMemory,
  loadProject: loadProjectMemory,
  saveGlobal: saveGlobalMemory,
  saveProject: saveProjectMemory,
  merge: mergeMemories,
  empty: emptyMemory,
  addAlias,
  addMacro,
  pin: pinAlias,
  prune: pruneStale,
};

// ─── DSL Learning ─────────────────────────────────────────────────────────────

export const dslLearner = {
  learnFromDictPlus,
  learnFromThread,
  promote: promoteEligibleCandidates,
};

// ─── Slash Command Generator ─────────────────────────────────────────────────

/**
 * Generate the /rn-token-optimizer system prompt for pasting into an AI agent thread.
 * Once pasted, the agent adopts Military-English DSL for the entire session.
 */
export function generateSlashPrompt(projectName?: string): string {
  const memory = loadActiveMemory();
  return buildSlashCommandPrompt(memory, projectName);
}
