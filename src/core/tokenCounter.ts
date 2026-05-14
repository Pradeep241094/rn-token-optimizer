import type { TokenCount, TokenSavings } from '../types/index.js';

// ─── Pricing table (per 1M tokens, USD) ──────────────────────────────────────
// Source: Anthropic pricing as of 2025
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-3-5-haiku-20241022': { input: 0.80,  output: 4.00  },
  'claude-haiku-4-5':          { input: 0.80,  output: 4.00  },
  'claude-3-5-sonnet-20241022':{ input: 3.00,  output: 15.00 },
  'claude-sonnet-4-5':         { input: 3.00,  output: 15.00 },
};
const DEFAULT_PRICING = { input: 0.80, output: 4.00 };

export interface CostEstimate {
  costBefore: number;   // USD
  costAfter: number;    // USD
  costSaved: number;    // USD
  per100Prompts: number;// USD saved if 100 prompts/day
  per1000Prompts: number;
}

// ─── Token estimation ─────────────────────────────────────────────────────────
// ~4 chars per token (GPT/Claude approximation).
// Falls back gracefully if tiktoken native binding is unavailable.
let _enc: { encode: (text: string) => Uint32Array } | null = null;

async function getEncoder(): Promise<{ encode: (text: string) => Uint32Array } | null> {
  if (_enc !== null) return _enc;
  try {
    const { encoding_for_model } = await import('tiktoken');
    _enc = encoding_for_model('gpt-4');
    return _enc;
  } catch {
    return null;
  }
}

export async function countTokens(text: string): Promise<TokenCount> {
  const enc = await getEncoder();
  const tokens = enc ? enc.encode(text).length : Math.ceil(text.length / 4);
  const words = text.split(/\s+/).filter(Boolean).length;
  return { tokens, chars: text.length, words };
}

export function countTokensSync(text: string): TokenCount {
  const tokens = Math.ceil(text.length / 4);
  const words = text.split(/\s+/).filter(Boolean).length;
  return { tokens, chars: text.length, words };
}

export async function computeSavings(before: string, after: string): Promise<TokenSavings> {
  const [beforeCount, afterCount] = await Promise.all([countTokens(before), countTokens(after)]);
  const savedTokens = beforeCount.tokens - afterCount.tokens;
  const savedPct = beforeCount.tokens > 0
    ? Math.round((savedTokens / beforeCount.tokens) * 1000) / 10
    : 0;
  return { before: beforeCount, after: afterCount, savedTokens, savedPct };
}

export function estimateCost(savings: TokenSavings, model = 'claude-3-5-haiku-20241022'): CostEstimate {
  const pricing = MODEL_PRICING[model] ?? DEFAULT_PRICING;
  const perM = pricing.input / 1_000_000;
  const costBefore = savings.before.tokens * perM;
  const costAfter  = savings.after.tokens  * perM;
  const costSaved  = costBefore - costAfter;
  return {
    costBefore,
    costAfter,
    costSaved,
    per100Prompts:  costSaved * 100,
    per1000Prompts: costSaved * 1000,
  };
}

function fmt(n: number): string {
  if (n < 0.000001) return `$${(n * 1_000_000).toFixed(2)}µ`;
  if (n < 0.001)    return `$${(n * 1000).toFixed(3)}m`;
  return `$${n.toFixed(6)}`;
}

export function formatSavingsReport(savings: TokenSavings, model?: string): string {
  const cost = estimateCost(savings, model);
  const bar = buildBar(savings.savedPct);

  return [
    '📊 Token Optimization Report',
    '─'.repeat(44),
    `  Original  : ${savings.before.tokens.toLocaleString()} tokens   ${savings.before.chars.toLocaleString()} chars   ${savings.before.words.toLocaleString()} words`,
    `  Optimized : ${savings.after.tokens.toLocaleString()} tokens   ${savings.after.chars.toLocaleString()} chars   ${savings.after.words.toLocaleString()} words`,
    `  Saved     : ${savings.savedTokens.toLocaleString()} tokens   ${bar}  ${savings.savedPct}%`,
    '─'.repeat(44),
    `  Est. cost before        : ${fmt(cost.costBefore)}  (${model ?? 'claude-haiku'})`,
    `  Est. cost after         : ${fmt(cost.costAfter)}`,
    `  Est. saved this prompt  : ${fmt(cost.costSaved)}`,
    `  Est. saved / 100 prompts: ${fmt(cost.per100Prompts)}`,
    `  Est. saved / day (1k)   : ${fmt(cost.per1000Prompts)}`,
    '─'.repeat(44),
  ].join('\n');
}

// Compact single-line version for inline display
export function formatSavingsLine(savings: TokenSavings, model?: string): string {
  const cost = estimateCost(savings, model);
  return (
    `Before: ${savings.before.tokens} tokens  After: ${savings.after.tokens} tokens  ` +
    `Saved: ${savings.savedPct}% (${savings.savedTokens} tokens / ${fmt(cost.costSaved)} per prompt)\n` +
    `🔥 At 100 prompts/day that's ${fmt(cost.per100Prompts)} saved`
  );
}

export function printSavingsToStderr(savings: TokenSavings, model?: string): void {
  process.stderr.write('\n' + formatSavingsReport(savings, model) + '\n');
}

function buildBar(pct: number, width = 20): string {
  const filled = Math.round((pct / 100) * width);
  return '[' + '█'.repeat(filled) + '░'.repeat(width - filled) + ']';
}
