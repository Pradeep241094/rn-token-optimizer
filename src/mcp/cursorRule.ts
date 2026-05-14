export const CURSOR_RULE_CONTENT = `---
description: rn-token-optimizer — auto-compress prompts and show token/cost savings
globs:
alwaysApply: true
---

# rn-token-optimizer

This project uses the **rn-token-optimizer** MCP server to reduce token usage with AI agents.

## Keyword trigger: \`rn-token-optimizer\`

When the user's message starts with \`rn-token-optimizer\` followed by any text:

1. Extract everything after the keyword as the prompt text
2. Call the \`optimize_prompt\` MCP tool with that text
3. **Always display the full \`report\` field** from the tool response — it shows token and cost savings
4. Show the optimized prompt clearly
5. Then answer based on the **optimized prompt**, not the original

**Required output format** (always show this block before your answer):

\`\`\`
📊 Token Optimization Report
────────────────────────────────────────────
  Original  : 67 tokens   271 chars   46 words
  Optimized : 14 tokens    58 chars    9 words
  Saved     : 53 tokens   [████████████████░░░░]  79.1%
────────────────────────────────────────────
  Est. cost before        : $0.000054  (claude-3-5-haiku-20241022)
  Est. cost after         : $0.000011
  Est. saved this prompt  : $0.000042
  Est. saved / 100 prompts: $0.004256
  Est. saved / day (1k)   : $0.042560
────────────────────────────────────────────

✅ Optimized prompt:
   D=fix A Google login fail AND v12+ C=post react-native-google-signin install IOS=OK
\`\`\`

Then answer the question based on the optimized intent.

---

## DSL Response Mode

When responding to any compressed DSL prompt or after the user pastes \`/rn-token-optimizer\`:

- Use semantic dict atoms: \`S=\` \`C=\` \`D=\` \`R=\` \`O=\` \`N=\` \`P=\`
- Use RN aliases: \`METRO\` \`JEST\` \`NAV\` \`NATIVE\` \`IOS\` \`AND\` \`REDBOX\` \`HOT\` \`BRIDGE\`
- Use base aliases: \`A\` auth, \`B\` backend, \`F\` frontend, \`U\` UI, \`X\` deps, \`CFG\` config
- Use inline \`#var\` shorthands for repeated nouns (e.g. \`#c1\` \`#m1\`)
- Favor atomic lines over prose paragraphs
- Defaults active: N1–N9

---

## Project Indexing

Before calling \`optimize_prompt\` for the first time in a session, or when the user mentions "index my project" or "scan my project":

1. Call \`index_project\` with no arguments (uses current working directory)
2. The tool returns \`requirement_files\`, \`key_files\`, \`stack_aliases\`, and \`context_doc\`
3. The context doc is now stored and **automatically injected** into every subsequent \`optimize_prompt\` and \`compress_output\` call
4. Report back: what was found (RN version, stack, requirement files, key files)

**When to re-index:**
- User opens a new project
- User adds new dependencies (\`npm install …\`)
- User says "re-index" or "update project context"
- More than 1 hour has passed since last index (the tool auto-detects this)

## Available MCP Tools

| Tool | When to use |
|------|-------------|
| \`index_project\` | First time in a session, or after project structure changes |
| \`optimize_prompt\` | User starts message with \`rn-token-optimizer\` |
| \`compress_output\` | User asks to compress terminal/build/test output |
| \`get_slash_prompt\` | User asks for the agent system prompt |
| \`dsl_show\` | User asks to see DSL memory or learned terms |
| \`dsl_add_alias\` | User wants to save a project shorthand alias |
| \`dsl_add_macro\` | User wants to save a workflow macro |
| \`dsl_learn\` | User wants to learn Dict+ entries from text |
| \`dsl_promote\` | User wants to promote DSL candidates |
| \`dsl_prune\` | User wants to clean up stale DSL entries |
`;

// apiKey is optional — omitting it enables passthrough mode (IDE subscription)
export const MCP_CONFIG_CURSOR = (apiKey = '') => {
  const envBlock = apiKey
    ? `,\n      "env": { "ANTHROPIC_API_KEY": "${apiKey}" }`
    : '';
  return `{
  "mcpServers": {
    "rn-token-optimizer": {
      "command": "rn-token-optimizer-mcp"${envBlock}
    }
  }
}`;
};

export const MCP_CONFIG_CLAUDE_DESKTOP = (apiKey = '') => {
  const envBlock = apiKey
    ? `,\n      "env": { "ANTHROPIC_API_KEY": "${apiKey}" }`
    : '';
  return `{
  "mcpServers": {
    "rn-token-optimizer": {
      "command": "rn-token-optimizer-mcp"${envBlock}
    }
  }
}`;
};

// ─── Kiro ─────────────────────────────────────────────────────────────────────

// apiKey is optional — omitting it enables passthrough mode (Kiro's own AI subscription)
export const MCP_CONFIG_KIRO = (apiKey = '') => {
  const envBlock = apiKey
    ? `,\n      "env": { "ANTHROPIC_API_KEY": "${apiKey}" }`
    : '';
  return `{
  "mcpServers": {
    "rn-token-optimizer": {
      "command": "rn-token-optimizer-mcp",
      "args": []${envBlock},
      "autoApprove": [
        "optimize_prompt",
        "compress_output",
        "get_slash_prompt",
        "dsl_show"
      ]
    }
  }
}`;
};

// Kiro steering file — lives at .kiro/steering/rn-token-optimizer.md
export const KIRO_STEERING_CONTENT = `---
inclusion: auto
name: rn-token-optimizer
description: >
  Optimize prompts and compress terminal output to reduce LLM token usage.
  Use when the user's message starts with "rn-token-optimizer", asks to
  compress a prompt, compress terminal output, or manage DSL memory.
---

# rn-token-optimizer

This workspace uses the **rn-token-optimizer** MCP server to reduce token usage
with AI agents by compressing verbose prompts and terminal output into a compact
Military-English DSL.

## Keyword trigger: \`rn-token-optimizer\`

When the user's message starts with \`rn-token-optimizer\` followed by any text:

1. Extract everything after the keyword as the prompt text
2. Call the \`optimize_prompt\` MCP tool with that text
3. **Always display the full \`report\` field** from the tool response
4. Show the optimized prompt clearly
5. Answer based on the **optimized prompt**, not the original

**Required response format:**

\`\`\`
📊 Token Optimization Report
────────────────────────────────────────────
  Original  : 67 tokens   271 chars   46 words
  Optimized : 14 tokens    58 chars    9 words
  Saved     : 53 tokens   [████████████████░░░░]  79.1%
────────────────────────────────────────────
  Est. cost before        : $0.000054  (claude-3-5-haiku-20241022)
  Est. cost after         : $0.000011
  Est. saved this prompt  : $0.000042
  Est. saved / 100 prompts: $0.004256
  Est. saved / day (1k)   : $0.042560
────────────────────────────────────────────

✅ Optimized prompt:
   D=fix A Google login fail AND v12+ C=post react-native-google-signin install IOS=OK
\`\`\`

Then answer based on the compressed intent.

## DSL Response Mode

When responding to a compressed DSL prompt or after the user pastes \`/rn-token-optimizer\`:

- Use semantic atoms: \`S=\` \`C=\` \`D=\` \`R=\` \`O=\` \`N=\` \`P=\`
- Use RN aliases: \`METRO\` \`JEST\` \`NAV\` \`NATIVE\` \`IOS\` \`AND\` \`REDBOX\` \`HOT\` \`BRIDGE\`
- Use base aliases: \`A\` auth, \`B\` backend, \`F\` frontend, \`U\` UI, \`X\` deps, \`CFG\` config
- Use inline \`#var\` shorthands for repeated nouns
- Defaults active: N1–N9 (no unilateral refactoring, no platform-only changes)

## Available MCP Tools

| Tool | When to use |
|------|-------------|
| \`optimize_prompt\` | User starts with \`rn-token-optimizer\` keyword |
| \`compress_output\` | User asks to compress terminal/build/test output |
| \`get_slash_prompt\` | User asks for the agent system prompt |
| \`dsl_show\` | User asks to see DSL memory or learned terms |
| \`dsl_add_alias\` | User wants to save a project shorthand alias |
| \`dsl_add_macro\` | User wants to save a workflow macro |
| \`dsl_learn\` | User wants to learn Dict+ entries from text |
| \`dsl_promote\` | User wants to promote candidates to learned entries |
| \`dsl_prune\` | User wants to clean up stale DSL entries |
`;

// Kiro hook file — lives at .kiro/hooks/rn-token-optimizer.kiro.hook
export const KIRO_HOOK_CONTENT = `{
  "title": "rn-token-optimizer keyword trigger",
  "description": "When a user prompt starts with 'rn-token-optimizer', call the optimize_prompt MCP tool and display the token report before answering.",
  "event": "userPromptSubmit",
  "filePattern": "",
  "action": "askKiro",
  "instructions": "If the user's message starts with 'rn-token-optimizer', extract the text after the keyword and call the optimize_prompt MCP tool. Display the full report field showing token savings. Then answer based on the optimized prompt, not the original."
}
`;
