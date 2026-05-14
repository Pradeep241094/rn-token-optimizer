import type { ILLMProvider, DSLMemory, AppConfig } from '../types/index.js';
import { addCandidate, loadProjectMemory, saveProjectMemory, loadGlobalMemory, saveGlobalMemory } from './memory.js';

export interface LearnResult {
  added: Array<{ key: string; value: string }>;
  rejected: Array<{ key: string; reason: string }>;
}

export interface PromoteResult {
  promoted: Array<{ key: string; value: string }>;
  skipped: Array<{ key: string; uses: number; needed: number }>;
}

// Parse `Dict+: KEY=value` lines from LLM output
export function parseDictPlusLines(text: string): Array<{ key: string; value: string }> {
  const entries: Array<{ key: string; value: string }> = [];
  const re = /Dict\+:\s*([A-Z][A-Z0-9_]*)\s*=\s*(.+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    entries.push({ key: m[1].toUpperCase(), value: m[2].trim() });
  }
  return entries;
}

export function learnFromDictPlus(
  text: string,
  scope: 'global' | 'project',
  dryRun = false,
): LearnResult {
  const entries = parseDictPlusLines(text);
  const added: LearnResult['added'] = [];
  const rejected: LearnResult['rejected'] = [];

  for (const { key, value } of entries) {
    if (isSensitive(value)) {
      rejected.push({ key, reason: 'sensitive term' });
      continue;
    }
    if (isNoisy(value)) {
      rejected.push({ key, reason: 'noisy/generic term' });
      continue;
    }
    added.push({ key, value });
    if (!dryRun) addCandidate(key, value, scope);
  }

  return { added, rejected };
}

export async function learnFromThread(
  transcript: string,
  llm: ILLMProvider,
  config: Pick<AppConfig, 'learnThreadMinUses' | 'defaultScope'>,
  dryRun = false,
): Promise<LearnResult> {
  const prompt = buildLearnThreadPrompt(transcript, config.learnThreadMinUses);
  const raw = await llm.complete([{ role: 'user', content: prompt }]);

  let entries: Array<{ key: string; value: string }> = [];
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Array<{ key: string; value: string }>;
      entries = parsed.filter((e) => e.key && e.value);
    }
  } catch {
    // fall back to Dict+ parsing
    entries = parseDictPlusLines(raw);
  }

  const added: LearnResult['added'] = [];
  const rejected: LearnResult['rejected'] = [];

  for (const { key, value } of entries) {
    if (isSensitive(value) || isNoisy(value)) {
      rejected.push({ key, reason: 'filtered' });
      continue;
    }
    added.push({ key, value });
    if (!dryRun) addCandidate(key, value, config.defaultScope);
  }

  return { added, rejected };
}

export function promoteEligibleCandidates(
  threshold: number,
  scope: 'global' | 'project',
  dryRun = false,
): PromoteResult {
  const mem: DSLMemory = scope === 'global' ? loadGlobalMemory() : loadProjectMemory();
  const promoted: PromoteResult['promoted'] = [];
  const skipped: PromoteResult['skipped'] = [];
  const now = new Date().toISOString().split('T')[0];

  for (const [key, candidate] of Object.entries(mem.candidates)) {
    if (candidate.uses >= threshold) {
      promoted.push({ key, value: candidate.value });
      if (!dryRun) {
        mem.learned[key] = { value: candidate.value, promoted: now };
        delete mem.candidates[key];
      }
    } else {
      skipped.push({ key, uses: candidate.uses, needed: threshold });
    }
  }

  if (!dryRun) {
    if (scope === 'global') saveGlobalMemory(mem);
    else saveProjectMemory(mem);
  }

  return { promoted, skipped };
}

function isSensitive(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    /password|secret|token|api.?key|bearer|private.?key|credential/.test(lower) ||
    /\b[A-Za-z0-9+/]{40,}={0,2}\b/.test(value) // base64-ish
  );
}

function isNoisy(value: string): boolean {
  const lower = value.toLowerCase();
  // Too generic to be useful as a DSL shorthand
  return (
    lower.length < 4 ||
    /^(the|and|for|this|that|with|from|some|any)$/.test(lower) ||
    /^\d+$/.test(value)
  );
}

function buildLearnThreadPrompt(transcript: string, minUses: number): string {
  return `You are a DSL memory extractor for a React Native token optimizer.

Analyze this conversation transcript and identify workflow terms/phrases that:
1. Appear at least ${minUses} times OR are highly likely to recur in future RN dev sessions
2. Are specific enough to be useful as short DSL aliases (not generic words)
3. Are NOT sensitive (no passwords, tokens, API keys, credentials)
4. Are NOT noisy (no single words like "the", "and", "fix")

Return ONLY a strict JSON array with this exact shape (no markdown, no explanation):
[
  { "key": "SHORT_KEY", "value": "full meaning here" },
  ...
]

Use ALL_CAPS keys of 2–8 characters. Prefer RN domain terms.

TRANSCRIPT:
${transcript.slice(0, 12000)}`;
}
