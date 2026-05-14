import Anthropic from '@anthropic-ai/sdk';
import type { ILLMProvider, ILLMMessage, AnthropicModel } from '../types/index.js';

export class AnthropicProvider implements ILLMProvider {
  readonly model: string;
  private client: Anthropic;

  constructor(apiKey: string, model: AnthropicModel = 'claude-3-5-haiku-20241022') {
    this.model = model;
    this.client = new Anthropic({ apiKey });
  }

  async complete(messages: ILLMMessage[]): Promise<string> {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    const system = systemMessages.map((m) => m.content).join('\n\n');

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: system || undefined,
      messages: nonSystemMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    const block = response.content[0];
    if (block.type !== 'text') {
      throw new Error(`Unexpected response type from Anthropic: ${block.type}`);
    }
    return block.text;
  }
}

export function createAnthropicProvider(
  apiKeyOrEnv?: string,
  model?: AnthropicModel,
): AnthropicProvider {
  const key = apiKeyOrEnv ?? process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Run `rn-token-optimizer` to complete onboarding ' +
        'or set the ANTHROPIC_API_KEY environment variable.',
    );
  }
  return new AnthropicProvider(key, model);
}

export const AVAILABLE_MODELS: Array<{ value: AnthropicModel; name: string }> = [
  { value: 'claude-3-5-haiku-20241022', name: 'Claude Haiku 3.5 (fastest, recommended)' },
  { value: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
  { value: 'claude-3-5-sonnet-20241022', name: 'Claude Sonnet 3.5 (higher quality)' },
  { value: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
];
