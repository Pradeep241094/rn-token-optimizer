# rn-token-optimizer

> **Abstracy Syntax tree code graph · prompt optimizer · terminal compressor · MCP server**
> Built for React Native AI coding workflows in Cursor, Kiro, and Claude Desktop.

[![npm version](https://img.shields.io/npm/v/rn-token-optimizer.svg)](https://www.npmjs.com/package/rn-token-optimizer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

---

## What it does

| Pillar | What you get |
|--------|-------------|
| **Code Intelligence Graph** | Indexes every `.ts/.tsx/.js/.jsx` file into a persistent SQLite knowledge graph. 18 MCP tools let your IDE answer "who calls this?", "show all screens", "what does my git diff break?" without reading a single file |
| **Prompt Optimization** | Compresses verbose natural-language prompts into a Military-English DSL before they reach the LLM — typically **60% fewer tokens** |
| **Terminal Compression** | Pipes Metro/Jest/Android build output through Claude and returns a 3-line DSL answer — typically ** atleast 50% fewer tokens** |
| **MCP Integration** | A local MCP server auto-triggers on a keyword in Cursor, Kiro, or Claude Desktop. No API key required — runs in passthrough mode using your existing IDE subscription |

---

## Quick Start (one command)

```bash
# From your React Native project root
npx rn-token-optimizer setup
```

That single command:
1. Auto-detects your IDE (Cursor / Kiro / Claude Desktop)
2. Writes the MCP server config + Cursor rule / Kiro steering file
3. Scans your `package.json`, finds your RN version, deps, requirement files
4. Parses every source file and builds the code intelligence graph
5. Prints a full report and tells you exactly what to do next

Or install globally first:

```bash
npm install -g rn-token-optimizer
cd /path/to/YourRNApp
rn-token-optimizer setup
```

Or via `curl` (one-line install from scratch):

```bash
curl -fsSL https://raw.githubusercontent.com/prmargas/rn-token-optimizer/main/install.sh | bash
```

---

## Table of Contents

1. [The Problem](#the-problem)
2. [Feature 1 — Code Intelligence Graph](#feature-1--code-intelligence-graph)
3. [Feature 2 — Prompt Optimization](#feature-2--prompt-optimization)
4. [Feature 3 — Terminal Output Compression](#feature-3--terminal-output-compression)
5. [Feature 4 — MCP Server for IDEs](#feature-4--mcp-server-for-ides)
6. [Feature 5 — MCP CLI Mode](#feature-5--mcp-cli-mode)
7. [Feature 6 — DSL System](#feature-6--dsl-system)
8. [Feature 7 — Project Index & Steering Doc](#feature-7--project-index--steering-doc)
9. [Feature 8 — Token Stats (offline)](#feature-8--token-stats-offline)
10. [Full CLI Reference](#full-cli-reference)
11. [All MCP Tools](#all-mcp-tools)
12. [Programmatic API](#programmatic-api)
13. [Configuration](#configuration)
14. [How Passthrough Mode Works](#how-passthrough-mode-works)
15. [License](#license)

---

## The Problem

Every token you send to an AI coding agent costs money and burns context window. In a React Native project, three sources waste the most:

**1. Verbose prompts**

```
"I need you to please help me fix the issue in my React Native app where users
are getting an error when trying to log in with their Google account on Android
devices running version 12 or higher"
```
→ 44 tokens. The same intent takes 6: `D=fix A Google login fail AND v12+`

**2. Terminal noise**

A single Jest run can produce 8,000 lines. You only need 3: which suites failed and why. Sending the full output to answer "did it pass?" is ~8,000 tokens when the answer needs ~80.

**3. File-by-file exploration**

When an agent needs to answer "what calls `handleGoogleLogin`?", it reads 15 files (~18,000 tokens). A single graph query answers the same question in ~300 tokens.

**rn-token-optimizer** solves all three.

---

## Feature 1 — Code Intelligence Graph

### What is an AST?

**AST** stands for **Abstract Syntax Tree** — the data structure every modern compiler and language tool builds when it reads source code.

Instead of treating a file as raw text (like `grep` does), an AST parser understands the *structure* of the code. It produces a tree where every node is a meaningful construct:

```
FunctionDeclaration: handleGoogleLogin
├── Param: email  (type: string)
├── Param: password  (type: string)
└── BlockStatement
    ├── CallExpression: signInWithGoogle(email, password)
    └── ReturnStatement
        └── Identifier: result
```

This is why AST-based analysis is so much more reliable than regex:

| Task | Regex / grep | AST |
|------|-------------|-----|
| Find all functions named `handle*` | Finds comments and strings too | Only real function declarations |
| Find what `handleGoogleLogin` calls | Misses indirect references | Walks the exact call tree |
| Detect if a component is a Screen | String matching, unreliable | Checks JSX return + naming convention |
| Map imports across files | Fragile, breaks on multiline | Reads every `ImportDeclaration` node |

`rn-token-optimizer` uses `@typescript-eslint/typescript-estree` — the same AST parser that powers ESLint and TypeScript tooling — to build a knowledge graph that is structurally correct, not a best-guess text match.

### How it works

Every `.ts/.tsx/.js/.jsx` file in your project is parsed via a real TypeScript AST (no regex, no heuristics). The result is a persistent SQLite knowledge graph of:

- **Nodes**: `Function`, `Class`, `Interface`, `Type`, `File`, `Screen`, `Hook`, `Navigator`, `Provider`, `Slice`
- **Edges**: `CALLS`, `IMPORTS`, `DEFINES`, `RENDERS`, `NAVIGATES_TO`, `IMPLEMENTS`, `INHERITS`

React Native-specific labels are detected automatically:
- `useXxx` → `Hook`
- `XxxScreen` → `Screen`
- `XxxNavigator` → `Navigator`
- `XxxProvider` → `Provider`
- `XxxSlice` → `Slice` (Redux/Zustand)

The graph is stored at `.rn-token-optimizer/graph.db` and persists across sessions.

### Build the graph

```bash
rn-token-optimizer graph index
# 1,247 files · 4,891 nodes · 12,447 edges in 2.3s
```

### Query it

```bash
# Codebase overview: screens, navigators, hotspots, dead code
rn-token-optimizer graph architecture

# Find any function, screen, or hook
rn-token-optimizer graph search "Login"
rn-token-optimizer graph search "handle" --label Function
rn-token-optimizer graph search "Auth" --label Screen

# Who calls handleGoogleLogin? What does it call?
rn-token-optimizer graph trace handleGoogleLogin
rn-token-optimizer graph trace handleGoogleLogin --direction inbound --depth 4

# Functions and components with zero callers
rn-token-optimizer graph dead-code

# Impact of your current git changes — risk-classified blast radius
rn-token-optimizer graph changes

# Read source for a specific function (no need to open the file)
rn-token-optimizer graph snippet "src/screens/Login.tsx:handleAuth"

# Cypher-lite structural queries
rn-token-optimizer graph query "MATCH (n:Screen) RETURN n.name, n.file_path LIMIT 20"
```

### Token efficiency

| Task | File-by-file | Graph query | Savings |
|------|-------------|-------------|---------|
| Find what calls `handleGoogleLogin` | ~18,000 tokens | ~300 tokens | **98%** |
| List all screens | ~5,000 tokens | ~120 tokens | **98%** |
| Architecture overview | ~50,000 tokens | ~400 tokens | **99%** |
| Dead code detection | ~30,000 tokens | ~200 tokens | **99%** |

### Ask your IDE instead

Once the MCP server is running in Cursor or Kiro, just ask in chat:

```
"Index my project"                    → runs index_repository
"Show my app architecture"            → runs get_architecture
"Find all screens"                    → runs search_graph {label: "Screen"}
"Who calls handleGoogleLogin?"        → runs trace_call_path {direction: "inbound"}
"Show dead code"                      → runs find_dead_code
"What does my current diff break?"    → runs detect_changes
```

---

## Feature 2 — Prompt Optimization

Compress verbose natural-language prompts before they reach an LLM.

### CLI

```bash
rn-token-optimizer optimize "I need you to fix the issue where Google login fails on Android 12"
# → D=fix A Google login fail AND v12+   (saved 79%)

rn-token-optimizer optimize "Why is the navigation broken when going from HomeScreen to ProfileScreen on iOS?"
# → D=debug NAV HomeScreen→ProfileScreen back btn fail IOS

rn-token-optimizer optimize "Metro keeps crashing after npm install, I've already cleared the cache"
# → D=fix METRO crash post npm-install C=cache clear failed

rn-token-optimizer optimize "Add a loading spinner to the login screen while auth request is in progress"
# → D=add U loading spinner LoginScreen C=show during A request
```

**Output includes a token savings report:**
```
D=fix A Google login fail AND v12+

─────────────────────────────────────────────
Before : 44 tokens  231 chars
After  : 9 tokens   30 chars
Saved  : 35 tokens  (79.5%)
Est. cost saved: $0.000004
─────────────────────────────────────────────
```

### Auto-detect mode

The default command detects context automatically:

| How you run it | Mode |
|---|---|
| `rn-token-optimizer "your prompt"` (no stdin) | Prompt optimization |
| `command \| rn-token-optimizer "question"` (stdin present) | Terminal compression |
| `rn-token-optimizer` (no args, no stdin) | Interactive onboarding |

---

## Feature 3 — Terminal Output Compression

Pipe any terminal output and ask a question about it. The tool compresses it to the minimum signal needed to answer.

### CLI

```bash
# Jest
npx jest --coverage 2>&1 | rn-token-optimizer "Which tests failed and why?"
# → S=JEST FAIL 2 suite(s)  N=Login.test.tsx Stack.test.tsx  D=token mismatch

# Metro build
npx react-native run-android 2>&1 | rn-token-optimizer "Did the build succeed?"
# → P=BUILD SUCCESS C=3 warnings linking libssl

# TypeScript
npx tsc --noEmit 2>&1 | rn-token-optimizer "What type errors exist?"
# → S=TS FAIL 4 errors  N=src/auth/provider.tsx:23 missing type

# Android logs
adb logcat 2>&1 | rn-token-optimizer "What native errors occurred?"
# → R=NullPointerException MainActivity.java:142  D=check null ref before mount
```

**Output (example):**
```
S=JEST FAIL 2 suite(s) failed
N=src/auth/Login.test.tsx, src/nav/Stack.test.tsx
D=expect(received).toBe(expected) token mismatch
O=18/20 tests passed

─────────────────────────────────────────────
Before : 7,648 tokens
After  : 99 tokens
Saved  : 98.7%
─────────────────────────────────────────────
```

---

## Feature 4 — MCP Server for IDEs

The MCP server runs locally alongside your IDE and exposes all functionality as tools the agent can call automatically.

### Setup

```bash
rn-token-optimizer setup          # auto-detects IDE, writes all configs
# or
rn-token-optimizer install        # interactive installer with more options
```

### Supported IDEs

| IDE | Config written | Auto-trigger |
|-----|---------------|-------------|
| **Cursor** | `.cursor/mcp.json` + `.cursor/rules/rn-token-optimizer.mdc` | ✅ keyword trigger |
| **Kiro** | `.kiro/settings/mcp.json` + `.kiro/steering/rn-token-optimizer.md` | ✅ steering file |
| **Claude Desktop** | `claude_desktop_config.json` | manual tool calls |

### Use in Cursor / Kiro Agent mode

**Prompt optimization** — start any message with the keyword:
```
rn-token-optimizer Fix the Google login issue on Android 12 devices
```
The IDE calls `optimize_prompt` automatically, shows the token savings report, then answers the compressed intent.

**Code graph** — ask naturally:
```
"Index my project"
"Show my app architecture"
"Who calls handleGoogleLogin?"
"Find all screens in my app"
"What does my current git diff break?"
"Show functions with no callers"
```

**Terminal compression** — paste output and ask:
```
"Compress this Jest output: [paste]  — question: which tests failed?"
```

### Do I need an API key?

No. The tool supports two modes:

| Mode | How | API key? | Cost |
|------|-----|----------|------|
| **Passthrough** (default) | MCP server does analysis; IDE's AI performs compression using your subscription | ❌ None | Free — uses your Cursor/Kiro plan |
| **Direct** | MCP server calls Claude directly (required for Claude Desktop) | ✅ Anthropic key | ~$0.000011/prompt (Haiku) |

### Manual config (without the installer)

**`.cursor/mcp.json`** or **`~/.cursor/mcp.json`**:

```json
{
  "mcpServers": {
    "rn-token-optimizer": {
      "command": "rn-token-optimizer-mcp"
    }
  }
}
```

With a direct API key:
```json
{
  "mcpServers": {
    "rn-token-optimizer": {
      "command": "rn-token-optimizer-mcp",
      "env": { "ANTHROPIC_API_KEY": "sk-ant-..." }
    }
  }
}
```

Reload your IDE window after adding the config (`Cmd+Shift+P` → `Reload Window` in Cursor).

---

## Feature 5 — MCP CLI Mode

Every MCP tool can be called directly from the terminal — no IDE needed.

```bash
# List all 18 available tools
rn-token-optimizer-mcp list

# Code intelligence
rn-token-optimizer-mcp index_repository
rn-token-optimizer-mcp get_architecture
rn-token-optimizer-mcp search_graph '{"name_pattern": "Login", "label": "Screen"}'
rn-token-optimizer-mcp trace_call_path '{"function_name": "handleGoogleLogin", "direction": "inbound"}'
rn-token-optimizer-mcp find_dead_code
rn-token-optimizer-mcp detect_changes '{"diff_text": "$(git diff HEAD)"}'
rn-token-optimizer-mcp get_code_snippet '{"qualified_name": "src/screens/Login.tsx:handleAuth"}'
rn-token-optimizer-mcp query_graph '{"query": "MATCH (n:Screen) RETURN n.name LIMIT 10"}'

# Prompt optimization
rn-token-optimizer-mcp optimize_prompt '{"prompt": "Fix the Google login issue on Android 12"}'

# DSL management
rn-token-optimizer-mcp dsl_show
rn-token-optimizer-mcp dsl_add_alias '{"key": "AUTHSVC", "value": "AuthenticationService"}'

# Help for a specific tool
rn-token-optimizer-mcp help trace_call_path
```

Partial name → smart suggestions:
```
rn-token-optimizer-mcp trace_
# Unknown tool: "trace_"
# Did you mean: trace_call_path?
```

---

## Feature 6 — DSL System

The Military-English DSL compresses code-related language into dense, signal-preserving atoms.

### Fixed Prefixes (always active)

| Key | Meaning |
|-----|---------|
| `S` | State / current status |
| `C` | Cause / context |
| `D` | Action / decision |
| `R` | Risk |
| `O` | Outcome |
| `N` | No-go / failure |
| `P` | Proof / pass |

### Base Aliases

`A` auth · `B` backend · `F` frontend · `E` E2E · `V` env · `X` deps · `U` UI · `DB` database · `CFG` config

### React Native Aliases

| Alias | Full term |
|-------|-----------|
| `METRO` | Metro bundler |
| `JEST` | Jest / React Native Testing Library |
| `NAV` | React Navigation |
| `NATIVE` | Native module |
| `BRIDGE` | JS-native bridge |
| `HOT` | Hot reload / fast-refresh |
| `IOS` | iOS build/runtime |
| `AND` | Android build/runtime |
| `REDBOX` | Red screen error |
| `TS` | TypeScript error |

### Macros

`1` test first · `2` run tests · `3` report · `4` review · `5` fix · `6` validate · `7` commit · `8` PR · `9` release

`M1` run Metro · `M2` build iOS · `M3` build Android · `M4` clear Metro cache · `M5` check native logs

### Negation Defaults (active guards)

`N1–N6` (base): no frontend change, no backend change, no broad UI refactor, preserve user edits, keep TUI interactive

`N7–N9` (RN): no iOS-only changes, no Android-only changes, preserve native code

### Inline Variables (model-chosen, thread-local)

The LLM dynamically assigns `#key` shorthands for repeated nouns:

```
S cache=#c1 warmed model=#m1
D inspect #c1 hit rate
R stale #c1 entries may skew result
```

### DSL Memory Management

The tool learns and remembers project-specific terms:

```bash
rn-token-optimizer dsl show                          # view active memory
rn-token-optimizer dsl show --candidates             # view candidates awaiting promotion
rn-token-optimizer dsl show --builtins               # view all built-in aliases

rn-token-optimizer dsl add alias AUTHSVC "AuthenticationService" --scope project
rn-token-optimizer dsl add macro M6 "restart Metro + clear cache" --scope global
rn-token-optimizer dsl pin AUTHSVC --scope project   # never expires

rn-token-optimizer dsl learn --dry-run "Dict+: NAVFIX=navigation stack fix"
rn-token-optimizer dsl promote --dry-run             # preview promotions
rn-token-optimizer dsl prune --dry-run               # preview stale cleanup
```

**Candidate lifecycle:**

```
new compress/distill output
        ↓
   candidate (uses: 1)
        ↓  seen 3+ times
   candidate (uses: 3)
        ↓  rn-token-optimizer dsl promote
   learned entry  (active in all future compressions)
        ↓  30+ days unused
   expired  (rn-token-optimizer dsl prune)
```

Pinned entries never expire.

### The `/rn-token-optimizer` Slash Command

Get a system prompt to paste into any Claude / Cursor / Kiro thread:

```bash
rn-token-optimizer slash
rn-token-optimizer slash --project "MyApp"
```

Once pasted, the agent adopts Military-English DSL for the entire session without rewriting your messages.

---

## Feature 7 — Project Index & Steering Doc

Before answering any question, the tool can scan your project and build a compact steering document that is automatically injected into every prompt — so the LLM gives project-specific answers using your actual component names, file paths, and architecture.

```bash
rn-token-optimizer index            # scan and build steering doc
rn-token-optimizer index --show     # print the current context doc
rn-token-optimizer index --json     # print the raw JSON index
```

**What it extracts (no API key, ~instant):**
- React Native version + key dependencies → DSL aliases (`NAV`, `REDUX`, `GSIGN`, …)
- Compact directory tree (skips `node_modules`, `dist`, `android`, `ios`)
- Requirement files: `.kiro/specs/**`, `docs/**/*.md`, `*.requirements.md`, `*.stories.*`
- Key architectural files: `App.tsx`, `RootNavigator.tsx`, `store/index.ts`, …
- Frequent component names → alias candidates

**Stored at** `.rn-token-optimizer/project-context.md` — injected automatically into every `optimize_prompt` and `compress_output` call.

---

## Feature 8 — Token Stats (offline)

Estimate how much this tool would save on your actual project — no API key, no network, no cost.

```bash
# Analyse a single file
rn-token-optimizer stats --file src/screens/LoginScreen.tsx

# Analyse a whole directory
rn-token-optimizer stats --scan src/

# Pipe from stdin
cat src/screens/LoginScreen.tsx | rn-token-optimizer stats

# Specify content type
rn-token-optimizer stats --file logs/jest-output.txt --type terminal
```

**Output:**
```
─────────────────────────────────────────────────────
File          : src/screens/LoginScreen.tsx
Type          : prompt
Tokens        : 847
Verbosity     : 7.2/10
Domains       : auth, navigation, typescript
DSL aliases   : A, NAV, TS
Est. after    : ~186 tokens  (78% reduction)
Est. savings  : $0.000007 per call @ claude-haiku
─────────────────────────────────────────────────────
```

---

## Full CLI Reference

```
rn-token-optimizer                              Interactive onboarding (first run)
rn-token-optimizer setup                        One-shot project setup (recommended)
rn-token-optimizer setup --cursor               Force Cursor IDE config
rn-token-optimizer setup --kiro                 Force Kiro IDE config
rn-token-optimizer setup --all-ides             Configure every detected IDE
rn-token-optimizer setup --ci                   Non-interactive (CI/CD)
rn-token-optimizer setup --api-key sk-ant-...   With Anthropic API key

rn-token-optimizer "your prompt"                Auto-detect mode
rn-token-optimizer optimize "your prompt"       Prompt optimization
rn-token-optimizer distill "question"           Terminal compression (reads stdin)

rn-token-optimizer index                        Build project context steering doc
rn-token-optimizer index --show                 Print current context doc
rn-token-optimizer index --json                 Print raw JSON index

rn-token-optimizer graph index                  Build AST code intelligence graph
rn-token-optimizer graph architecture           Codebase overview
rn-token-optimizer graph search <pattern>       Search nodes by name
rn-token-optimizer graph search <pattern> --label Screen|Hook|Function|Navigator|…
rn-token-optimizer graph trace <name>           BFS call chain (who calls / what calls)
rn-token-optimizer graph trace <name> --direction inbound|outbound|both
rn-token-optimizer graph trace <name> --depth 4
rn-token-optimizer graph dead-code              Zero-callers detection
rn-token-optimizer graph changes                Git diff → blast radius
rn-token-optimizer graph snippet <qualified>    Print source for a function
rn-token-optimizer graph query "<cypher-lite>"  Structural query

rn-token-optimizer slash                        Get system prompt for agent thread
rn-token-optimizer slash --project "MyApp"

rn-token-optimizer stats                        Offline token savings estimate (stdin)
rn-token-optimizer stats --file <path>
rn-token-optimizer stats --scan <directory>

rn-token-optimizer dsl show
rn-token-optimizer dsl show --candidates --builtins
rn-token-optimizer dsl add alias <KEY> <value> --scope project|global
rn-token-optimizer dsl add macro <KEY> <value>
rn-token-optimizer dsl pin <KEY>
rn-token-optimizer dsl learn "Dict+: KEY=value"
rn-token-optimizer dsl promote --dry-run
rn-token-optimizer dsl prune --dry-run

rn-token-optimizer install                      Interactive MCP installer
rn-token-optimizer onboard                      Re-run first-time wizard
```

---

## All MCP Tools

18 tools available to your IDE agent:

### Code Intelligence

| Tool | Description |
|------|-------------|
| `index_repository` | Full AST index — parses all source files, builds nodes + edges, persists to SQLite. Run once per session. |
| `search_graph` | Search nodes by `name_pattern`, `label`, `file_pattern`. Returns qualified names, signatures, caller/callee counts. |
| `trace_call_path` | BFS call chain. `direction`: inbound/outbound/both. `depth` 1–5. Returns full call tree with file locations. |
| `get_architecture` | One-call overview: screens, navigators, entry points, hotspots by in-degree, dead code count, RN stack. |
| `detect_changes` | Accepts raw `git diff` text, maps lines → symbols → blast radius, returns risk-classified impact list. |
| `find_dead_code` | Functions/components with zero callers, excluding known entry points. |
| `get_code_snippet` | Source code for a symbol by qualified name. More efficient than reading the whole file. |
| `query_graph` | Cypher-lite queries: `MATCH (n:Screen) RETURN n.name LIMIT 10` |

### Project Context

| Tool | Description |
|------|-------------|
| `index_project` | Scans `package.json`, finds requirement files, builds compact steering document. Injected into every optimize call. |

### Prompt & Output Optimization

| Tool | Description |
|------|-------------|
| `optimize_prompt` | Compress a verbose prompt into Military-English DSL. Supports passthrough mode (no API key). |
| `compress_output` | Compress terminal output (Metro/Jest/build logs) and answer a specific question about it. |
| `get_slash_prompt` | Get the `/rn-token-optimizer` DSL system prompt for an agent thread. |

### DSL Management

| Tool | Description |
|------|-------------|
| `dsl_show` | View active DSL memory: aliases, learned terms, macros, candidates. |
| `dsl_add_alias` | Add a project-specific shorthand alias (`AUTHSVC` = `AuthenticationService`). |
| `dsl_add_macro` | Add a workflow macro (`M6` = "restart Metro + clear cache"). |
| `dsl_learn` | Extract Dict+ entries from text and save as project candidates. |
| `dsl_promote` | Promote frequently-seen candidates to active learned terms. |
| `dsl_prune` | Remove stale, unpinned aliases and expired candidates. |

---

## Programmatic API

```typescript
import {
  optimizePrompt,
  aiTokenOptimizer,
  countTokensSync,
} from 'rn-token-optimizer';

// Prompt optimization
const result = await optimizePrompt(
  "I need to fix the issue where Google login fails on Android 12",
  { apiKey: process.env.ANTHROPIC_API_KEY }
);
console.log(result.optimizedPrompt); // "D=fix A Google login fail AND v12+"
console.log(result.savedPct);        // 79.5
console.log(result.context.domains); // ["auth", "android"]

// Terminal output compression
const distilled = await aiTokenOptimizer(jestOutput, "Which tests failed?", {
  apiKey: process.env.ANTHROPIC_API_KEY,
});
console.log(distilled.output);   // "S=JEST FAIL 2 suites N=Login.test.tsx"
console.log(distilled.savedPct); // 98.7

// Token counting (no API key)
const count = countTokensSync("your text here");
console.log(count.tokens); // 7
```

### Types

```typescript
import type {
  OptimizeResult,
  DistillResult,
  TokenCount,
  TokenSavings,
  // Graph types
  GraphNode,
  GraphEdge,
  NodeLabel,
  EdgeType,
  TraceResult,
  ArchitectureReport,
  SearchResult,
  ChangeImpact,
  DeadCodeEntry,
} from 'rn-token-optimizer';
```

---

## Configuration

| File | Purpose |
|------|---------|
| `~/.rn-token-optimizer/config.json` | Global: API key, model, default scope |
| `~/.rn-token-optimizer/dsl.json` | Global DSL memory (aliases, macros, learned) |
| `.rn-token-optimizer/dsl.json` | Project DSL memory (walks up from cwd) |
| `.rn-token-optimizer/project-context.md` | Project steering document (auto-generated) |
| `.rn-token-optimizer/project-index.json` | Project structure JSON (auto-generated) |
| `.rn-token-optimizer/graph.db` | SQLite code intelligence graph (auto-generated) |

### Models

| Model | Speed | Quality | Cost |
|-------|-------|---------|------|
| `claude-3-5-haiku-20241022` | ⚡ Fastest | Good | ~$0.000011/prompt |
| `claude-haiku-4-5` | ⚡ Fast | Good | Similar |
| `claude-3-5-sonnet-20241022` | Slower | Best | ~$0.000150/prompt |
| `claude-sonnet-4-5` | Slower | Best | Similar |

The default is `claude-3-5-haiku-20241022`.

### Environment variables

```bash
export ANTHROPIC_API_KEY="sk-ant-..."    # optional — passthrough mode works without it
```

---

## How Passthrough Mode Works

If no `ANTHROPIC_API_KEY` is configured, the MCP server runs in **passthrough mode**:

1. The server does all deterministic work locally — token counting, domain detection, DSL lookup, project context injection
2. It returns a `compression_instruction` containing the full DSL system prompt
3. Your IDE's AI (Cursor/Kiro) performs the actual compression using your existing subscription
4. The token savings report is computed from the `tokens_before` value the tool returns

This means **zero extra cost** if you already pay for Cursor or Kiro. Direct mode (with your own API key) is only required for Claude Desktop, which has no built-in AI.

---

## License

[MIT](LICENSE) — Copyright © 2026 [Pradeep Margasahayam Prakash](https://github.com/Pradeep241094)
