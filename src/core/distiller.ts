import type { DistillResult, ILLMProvider, AppConfig } from '../types/index.js';
import { extractSignals } from './signalExtractor.js';
import { computeSavings } from './tokenCounter.js';
import { buildCompressionPrompt } from './promptBuilder.js';
import { loadActiveMemory } from '../dsl/memory.js';
import { learnFromDictPlus } from '../dsl/learner.js';

export interface DistillOptions {
  provider: ILLMProvider;
  question: string;
  config?: Partial<Pick<AppConfig, 'defaultScope'>>;
  skipSignalExtraction?: boolean;
}

export async function runDistillPipeline(
  rawInput: string,
  options: DistillOptions,
): Promise<DistillResult> {
  const { provider, question, config, skipSignalExtraction = false } = options;
  const scope = config?.defaultScope ?? 'project';

  // 1. Signal extraction — strip noise, keep high-signal lines
  const extracted = skipSignalExtraction
    ? { compressedText: rawInput, signals: [], originalLineCount: 0, compressedLineCount: 0 }
    : extractSignals(rawInput);

  // 2. Load active DSL memory (global + project merged)
  const memory = loadActiveMemory();

  // 3. Build prompt with DSL context
  const { systemPrompt, userPrompt } = buildCompressionPrompt(
    extracted.compressedText,
    question,
    memory,
  );

  // 4. Call LLM
  const llmOutput = await provider.complete([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  // 5. Extract any Dict+ entries emitted by the model and learn them as candidates
  const dictPlusLines = llmOutput
    .split('\n')
    .filter((l) => l.trim().startsWith('Dict+:'))
    .join('\n');

  if (dictPlusLines) {
    learnFromDictPlus(dictPlusLines, scope, false);
  }

  // 6. Clean output — strip Dict+ lines from user-facing output
  const cleanOutput = llmOutput
    .split('\n')
    .filter((l) => !l.trim().startsWith('Dict+:'))
    .join('\n')
    .trim();

  // 7. Compute token savings
  const savings = await computeSavings(rawInput, cleanOutput);

  return {
    output: cleanOutput,
    savings,
    savedPct: savings.savedPct,
    model: provider.model,
    question,
  };
}
