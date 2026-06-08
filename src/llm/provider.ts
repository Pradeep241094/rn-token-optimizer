import type { ILLMMessage, ILLMProvider } from '../types/index.js';
import { AnthropicProvider } from './anthropic.js';
import { OllamaProvider } from './ollama.js';

export type { ILLMMessage, ILLMProvider };
export { OllamaProvider };

export function assertProvider(provider: ILLMProvider | null): asserts provider is ILLMProvider {
  if (!provider) {
    throw new Error(
      'No LLM provider configured. Run `rn-token-optimizer` to complete onboarding.',
    );
  }
}

/**
 * Creates an LLM provider based on config or env settings.
 * Falls back automatically to local Ollama if no Anthropic API key is present.
 */
export function createLLMProvider(
  apiKeyOrEnv?: string,
  model?: string,
): ILLMProvider {
  const apiKey = apiKeyOrEnv || process.env.ANTHROPIC_API_KEY;
  const useOllama = process.env.USE_OLLAMA === 'true' || !!process.env.OLLAMA_MODEL || !apiKey;

  if (useOllama) {
    const ollamaModel = process.env.OLLAMA_MODEL || 'qwen2.5-coder:1.5b';
    const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
    return new OllamaProvider(ollamaModel, ollamaHost);
  }

  return new AnthropicProvider(apiKey!, model as any);
}
