import type { OptimizeResult, ILLMProvider, AppConfig } from '../types/index.js';
import { analyzePromptContext } from '../rn/promptContext.js';
import { computeSavings } from './tokenCounter.js';
import { buildPromptCompressionPrompt } from './promptBuilder.js';
import { loadActiveMemory } from '../dsl/memory.js';
import { learnFromDictPlus } from '../dsl/learner.js';

export interface PromptOptimizeOptions {
  provider: ILLMProvider;
  config?: Partial<Pick<AppConfig, 'defaultScope'>>;
}

/**
 * Compress a verbose developer prompt into a lean, token-efficient version
 * using Military-English DSL and the active project DSL memory.
 *
 * The LLM preserves 100% of intent while stripping filler words, replacing
 * verbose phrases with DSL aliases, and using inline #var shorthands.
 */
export async function runPromptOptimizer(
  verbosePrompt: string,
  options: PromptOptimizeOptions,
): Promise<OptimizeResult> {
  const { provider, config } = options;
  const scope = config?.defaultScope ?? 'project';

  // 1. Analyze prompt context to detect RN domains and verbosity
  const context = analyzePromptContext(verbosePrompt);

  // 2. Load active DSL memory
  const memory = loadActiveMemory();

  // 3. Build compression-focused system prompt
  const { systemPrompt, userPrompt } = buildPromptCompressionPrompt(
    verbosePrompt,
    memory,
    context,
  );

  // 4. Call LLM
  const llmOutput = await provider.complete([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  // 5. Extract any Dict+ entries the model emitted and save as candidates
  const dictPlusLines = llmOutput
    .split('\n')
    .filter((l) => l.trim().startsWith('Dict+:'))
    .join('\n');

  if (dictPlusLines) {
    learnFromDictPlus(dictPlusLines, scope, false);
  }

  // 6. Clean output — remove Dict+ metadata lines
  const optimizedPrompt = llmOutput
    .split('\n')
    .filter((l) => !l.trim().startsWith('Dict+:'))
    .join('\n')
    .trim();

  // 7. Compute token savings
  const savings = await computeSavings(verbosePrompt, optimizedPrompt);

  return {
    optimizedPrompt,
    originalPrompt: verbosePrompt,
    savings,
    savedPct: savings.savedPct,
    model: provider.model,
    context,
  };
}
