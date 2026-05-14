import type { DSLMemory, PromptContext } from '../types/index.js';
import { BUILTINS, buildDSLReferenceText } from '../dsl/builtins.js';
import { buildDomainHints } from '../rn/promptContext.js';
import { loadProjectContext } from './projectIndexer.js';

export interface BuiltPrompt {
  systemPrompt: string;
  userPrompt: string;
}

// ─── Project context block builder (shared by both modes) ────────────────────

function buildProjectContextSection(rootDir?: string): string {
  const ctx = loadProjectContext(rootDir ?? process.cwd());
  if (!ctx) return '';
  // Keep only the first 400 tokens worth (chars ≈ 1600) to avoid overloading the prompt
  const trimmed = ctx.length > 1600 ? ctx.slice(0, 1600) + '\n…(truncated)' : ctx;
  return `PROJECT CONTEXT (use this to give project-specific answers):
${trimmed}`;
}

// ─── Mode 1: Terminal output compression ─────────────────────────────────────

export function buildCompressionPrompt(
  compressedInput: string,
  question: string,
  memory: DSLMemory,
  rootDir?: string,
): BuiltPrompt {
  const dslRef         = buildDSLReferenceText(BUILTINS);
  const learnedSection = buildLearnedSection(memory);
  const projectSection = buildProjectContextSection(rootDir);

  const systemPrompt = `You are rn-token-optimizer, a Military-English DSL compression engine for React Native development.

Your job: answer the user's question using ONLY the information in the provided command output. Compress the answer into the minimal number of tokens without losing signal.

${dslRef}
${projectSection ? '\n' + projectSection + '\n' : ''}
RESPONSE RULES:
- Use semantic dict atoms: S= C= D= R= O= N= P=
- Use DSL aliases instead of full terms when available
- Use inline #var shorthands dynamically for nouns that repeat or are likely to repeat (e.g. cache=#c1, model=#m1). The model picks these — there is no fixed list.
- Do NOT rewrite the question. Adopt the language structure and keep using it.
- Do NOT add explanations, preamble, or markdown headers.
- Emit only Dict atom lines. If the answer is PASS or FAIL, start with P= or N= respectively.
- If project context is provided, reference specific file paths and component names from it in your answer.

${learnedSection}

If you generate reusable shorthand entries, emit them as Dict+ lines at the end:
Dict+: KEY=full meaning here`;

  const userPrompt = `COMMAND OUTPUT:
${compressedInput}

QUESTION: ${question}`;

  return { systemPrompt, userPrompt };
}

// ─── Mode 2: Prompt compression ──────────────────────────────────────────────

export function buildPromptCompressionPrompt(
  verbosePrompt: string,
  memory: DSLMemory,
  context: PromptContext,
  rootDir?: string,
): BuiltPrompt {
  const dslRef         = buildDSLReferenceText(BUILTINS);
  const learnedSection = buildLearnedSection(memory);
  const domainHints    = buildDomainHints(context);
  const projectSection = buildProjectContextSection(rootDir);

  const systemPrompt = `You are rn-token-optimizer, a React Native prompt compression engine.

Your job: Rewrite the developer's verbose prompt into the minimum tokens possible while preserving 100% of the intent, context, and technical specifics.

${dslRef}
${projectSection ? '\n' + projectSection + '\n' : ''}
COMPRESSION RULES:
- Remove filler phrases: "please", "could you", "I need you to", "I would like you to", "I'm having an issue with", "basically", "essentially", "just", "simply"
- Replace verbose phrases with DSL aliases where semantically equivalent
- Use semantic dict atoms (D= for actions, S= for state, C= for context, R= for risk) when they make the prompt shorter
- Preserve ALL technical specifics: file names, component names, line numbers, error messages, version numbers
- Preserve the original intent exactly — do NOT change what is being asked
- Use inline #var shorthands for entities that appear or are likely to appear multiple times
- If the prompt is already concise, return it unchanged
- If project context is provided, prefer project-specific component/file names in the compressed output
- Output ONLY the compressed prompt — no explanation, no "Here is the compressed version:", no headers

${domainHints ? domainHints + '\n' : ''}${learnedSection}

EXAMPLES:
Input:  "I need you to please help me fix the issue in my React Native app where users are getting an error when trying to log in with their Google account on Android devices running version 12 or higher"
Output: "D=fix A Google login fail AND v12+"

Input:  "Can you help me understand why the navigation doesn't work correctly when going from the HomeScreen to the ProfileScreen on iOS? The back button seems broken"
Output: "D=debug NAV HomeScreen→ProfileScreen back btn fail IOS"

Input:  "I'm experiencing a problem with the Metro bundler where it keeps crashing after I run npm install and I've already tried clearing the cache but it didn't help"
Output: "D=fix METRO crash post npm-install C=cache clear failed"

If you generate reusable Dict+ entries for this project context, emit them at the end:
Dict+: KEY=full meaning here`;

  const userPrompt = verbosePrompt;

  return { systemPrompt, userPrompt };
}

// ─── Slash command generator ──────────────────────────────────────────────────

export function buildSlashCommandPrompt(memory: DSLMemory, projectName = 'this project'): string {
  const dslRef = buildDSLReferenceText(BUILTINS);
  const learnedSection = buildLearnedSection(memory);

  return `/rn-token-optimizer

You are now operating in rn-token-optimizer DSL mode for ${projectName}.

Adopt Military English + AR-0/AR-1 compression for ALL responses in this thread. Do NOT rewrite this prompt — adopt the language structure immediately and keep using it for every response.

${dslRef}

RESPONSE RULES:
- Use semantic dict atoms: S= C= D= R= O= N= P=
- Use DSL aliases instead of full terms (METRO, JEST, NAV, NATIVE, BRIDGE, HOT, IOS, AND, etc.)
- Use inline #var shorthands for repeated nouns. Choose keys dynamically (e.g. #c1 #m1 #a1). Thread-local only.
- Favor short semantic atoms over prose sentences.
- Defaults active: N1 N2 N3 N4 N5 N6 N7 N8 N9 (see reference above)
- When uncertain, ask with single-line S=? format.

${learnedSection}

Example response shape:
S cache=#c1 warmed model=#m1
D inspect #c1 hit rate
D compare #m1 latency
R stale #c1 entries may skew result`;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function buildLearnedSection(memory: DSLMemory): string {
  const parts: string[] = [];

  const learnedKeys = Object.keys(memory.learned);
  const aliasKeys = Object.keys(memory.aliases);

  if (learnedKeys.length > 0 || aliasKeys.length > 0) {
    parts.push('ACTIVE PROJECT DSL MEMORY:');
    for (const [k, v] of Object.entries(memory.aliases)) {
      parts.push(`  ${k} = ${v.value}`);
    }
    for (const [k, v] of Object.entries(memory.learned)) {
      parts.push(`  ${k} = ${v.value}`);
    }
  }

  const macroKeys = Object.keys(memory.macros);
  if (macroKeys.length > 0) {
    parts.push('PROJECT MACROS:');
    for (const [k, v] of Object.entries(memory.macros)) {
      parts.push(`  ${k} = ${v}`);
    }
  }

  return parts.join('\n');
}
