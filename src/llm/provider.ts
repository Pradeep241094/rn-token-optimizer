import type { ILLMMessage, ILLMProvider } from '../types/index.js';

export type { ILLMMessage, ILLMProvider };

export function assertProvider(provider: ILLMProvider | null): asserts provider is ILLMProvider {
  if (!provider) {
    throw new Error(
      'No LLM provider configured. Run `rn-token-optimizer` to complete onboarding.',
    );
  }
}
