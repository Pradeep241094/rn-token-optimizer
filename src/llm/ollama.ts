/**
 * ollama.ts — Local Ollama LLM provider implementation (zero-dependency)
 */

import type { ILLMProvider, ILLMMessage } from '../types/index.js';

export class OllamaProvider implements ILLMProvider {
  readonly model: string;
  readonly baseUrl: string;

  constructor(model = 'qwen2.5-coder:1.5b', baseUrl = 'http://localhost:11434') {
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash if present
  }

  async complete(messages: ILLMMessage[]): Promise<string> {
    try {
      // Map message structure to Ollama API schema
      const mappedMessages = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: mappedMessages,
          stream: false,
          options: {
            temperature: 0.1, // low temperature for precise, code-centric responses
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Ollama API responded with status ${response.status}: ${errorText}`);
      }

      const data = await response.json() as { message?: { content?: string } };
      const content = data.message?.content;
      if (typeof content !== 'string') {
        throw new Error('Unexpected response format from Ollama chat API');
      }

      return content;
    } catch (err) {
      throw new Error(
        `Failed to query local Ollama: ${err instanceof Error ? err.message : String(err)}.\n` +
        `Ensure Ollama is running at ${this.baseUrl} and that you have pulled the model using: ollama pull ${this.model}`
      );
    }
  }
}
