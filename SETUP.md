# rn-token-optimizer — Setup & Usage Guide

A React Native–focused token optimizer that compresses your AI prompts and terminal output using a compact Military-English DSL, powered by Claude. Use it to save money and reduce latency on every LLM call.

---

## Table of Contents

1. [What It Does](#1-what-it-does)
2. [Prerequisites](#2-prerequisites)
3. [Installation](#3-installation)
4. [First-Run Onboarding](#4-first-run-onboarding)
5. [Mode 1 — Prompt Optimization](#5-mode-1--prompt-optimization)
6. [Mode 2 — Terminal Output Compression](#6-mode-2--terminal-output-compression)
7. [Token & Cost Report](#7-token--cost-report)
8. [Cursor MCP Integration](#8-cursor-mcp-integration)
9. [Kiro MCP Integration](#9-kiro-mcp-integration)
10. [Claude Desktop Integration](#10-claude-desktop-integration)
11. [DSL Reference](#11-dsl-reference)
12. [DSL Memory Management](#12-dsl-memory-management)
13. [Programmatic API](#13-programmatic-api)
14. [Sample Project](#14-sample-project)
15. [All CLI Commands](#15-all-cli-commands)
16. [Configuration Reference](#16-configuration-reference)
17. [Troubleshooting](#17-troubleshooting)

---

## 1. What It Does

`rn-token-optimizer` has two core modes:

| Mode | Input | Output | Typical saving |
|------|-------|--------|----------------|
| **Prompt Optimization** | Your verbose natural-language prompt | Lean DSL prompt to send to the LLM | 65–85% |
| **Terminal Compression** | Metro / Jest / Android build output via stdin | Compact DSL answer to your question | 90–99% |

Both modes use the same **Military-English DSL** — a fixed set of semantic prefixes (`S=` `C=` `D=` `R=` `O=` `N=` `P=`) plus React Native aliases (`METRO` `JEST` `NAV` `AND` `IOS` etc.) that pack maximum meaning into minimum tokens.

### Do I need a separate Anthropic API key?

**No.** If you use Cursor or Kiro, you can run the tool completely free using your existing IDE subscription. The tool supports two operating modes:

| Mode | How it works | API key needed? | Cost |
|------|-------------|-----------------|------|
| **Passthrough** (default) | The MCP server does all deterministic work (token counting, domain detection, DSL lookup) and returns a structured compression instruction. Your IDE's own AI — already covered by your Cursor/Kiro subscription — performs the actual compression. | ❌ None | Free — uses your existing subscription |
| **Direct** | The MCP server calls Claude directly via the Anthropic API and returns the compressed prompt itself. Marginally faster. Required for Claude Desktop (which has no built-in AI). | ✅ Anthropic API key | ~$0.000011 per prompt (Haiku) |

**For Cursor and Kiro users:** passthrough mode is the default. The installer will ask which mode you want. You can always add a key later if you prefer direct mode.

**For Claude Desktop users:** direct mode is required because Claude Desktop's MCP tools are not executed by an AI that can follow passthrough instructions — you need a key.

---

## 2. Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | ≥ 18.0.0 |
| npm | ≥ 8 |
| Anthropic API key | Any tier (Haiku is cheapest) |

Get an Anthropic API key at [console.anthropic.com](https://console.anthropic.com).

---

## 3. Installation

### Global install (recommended — gives you the `rn-token-optimizer` command everywhere)

```bash
npm install -g rn-token-optimizer
```

### Per-project install

```bash
npm install --save-dev rn-token-optimizer
# then use: npx rn-token-optimizer …
```

### Install from this repo (development)

```bash
git clone <this-repo>
cd codebase-token-optimizer
npm install
npm run build
npm link          # makes `rn-token-optimizer` available globally from source
```

---

## 4. First-Run Onboarding

Run the tool with no arguments to launch the interactive setup wizard:

```bash
rn-token-optimizer
```

The wizard asks for:

1. **Anthropic API key** — stored in `~/.rn-token-optimizer/config.json` (never committed)
2. **Default model** — `claude-3-5-haiku-20241022` (fast, cheap) or `claude-3-5-sonnet-20241022` (smarter)
3. **Default DSL scope** — `project` (per-repo memory) or `global` (shared across all projects)
4. **Promotion threshold** — how many times a term must appear before it is auto-learned (default: 3)
5. **Prune after days** — how many days of non-use before a custom alias is removed (default: 30)

To re-run onboarding at any time:

```bash
rn-token-optimizer onboard
```

---

## 5. Mode 1 — Prompt Optimization

Compress a verbose prompt before sending it to any AI agent.

### Basic usage

```bash
rn-token-optimizer optimize "I need you to fix the issue where Google login fails after installing react-native-google-signin on Android 12 devices but it works fine on iOS"
```

**Output (stderr — token report):**
```
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
```

**Output (stdout — piped-friendly, clean):**
```
D=fix A Google login fail AND v12+ C=post react-native-google-signin install IOS=OK
```

### Smart shorthand (no subcommand needed)

When you pass a string with no stdin piped, the tool auto-detects prompt mode:

```bash
rn-token-optimizer "Can you help me understand why FlatList renders slowly on Android?"
# → D=debug FlatList perf lag AND
```

### More examples

```bash
# Navigation issue
rn-token-optimizer optimize "Why is the back button on Android not triggering the onBeforeRemove listener in React Navigation v6?"
# → D=debug NAV Android back btn onBeforeRemove v6

# Dependency/setup issue
rn-token-optimizer optimize "How do I configure Metro to resolve symlinked packages from a monorepo workspace?"
# → D=CFG METRO resolve symlinks monorepo workspace

# UI bug
rn-token-optimizer optimize "The keyboard pushes up the entire screen on iOS but only the input on Android"
# → D=fix U keyboard push IOS=full AND=input-only
```

### Pipe the optimized prompt directly into another tool

```bash
rn-token-optimizer optimize "Your verbose prompt" | pbcopy   # macOS — copies to clipboard
rn-token-optimizer optimize "Your verbose prompt" | xclip     # Linux
```

---

## 6. Mode 2 — Terminal Output Compression

Pipe any terminal output and ask a question about it.

### Jest test results

```bash
npx jest --coverage 2>&1 | rn-token-optimizer "Which tests failed and why?"
```

**Output:**
```
S=JEST FAIL 2 suites 3 tests
N=LoginScreen.test.tsx RootNavigator.test.tsx
C=LoginScreen: getByTestId error-message undefined | nav.navigate not called
C=RootNavigator: tab-navigator testId null C=auth state not set
O=17/20 passed
D=fix A mock + nav mock setup
```

### Metro bundler error

```bash
npx react-native start 2>&1 | rn-token-optimizer "Did the bundle succeed?"
```

**Output:**
```
S=METRO bundle FAIL
C=SyntaxError CheckoutScreen.tsx:47 TransformError
D=fix syntax CheckoutScreen.tsx:47 PaymentService.charge call
R=bundle blocked until fixed
```

### Android build failure

```bash
npx react-native run-android 2>&1 | rn-token-optimizer "What caused the build failure?"
```

**Output:**
```
S=AND build FAIL
C=Manifest merger fail: app@label conflict google-play-services-auth
D=add tools:replace="android:label" to AndroidManifest.xml <application>
R=block all AND debug builds
```

### iOS build

```bash
xcodebuild 2>&1 | rn-token-optimizer "Did the iOS build pass?"
```

### Explicit `distill` subcommand

```bash
npx jest 2>&1 | rn-token-optimizer distill "Which tests failed?"
```

---

## 7. Token & Cost Report

Every optimization — whether from the CLI, MCP, or API — includes a full report:

```
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
```

**Cost estimates use current Anthropic pricing:**

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|-----------------------|------------------------|
| claude-3-5-haiku-20241022 | $0.80 | $4.00 |
| claude-3-5-sonnet-20241022 | $3.00 | $15.00 |

> The report always goes to **stderr** so it never pollutes piped output.  
> The optimized prompt/answer always goes to **stdout** for clean piping.

---

## 8. Cursor MCP Integration

The MCP server lets Cursor call `rn-token-optimizer` automatically whenever you type the trigger keyword in chat — no manual CLI needed.

### Step 1 — Run the installer

Inside your React Native project:

```bash
rn-token-optimizer install
```

The installer asks:
1. **API key mode** — choose `No` to use your Cursor subscription (passthrough, free) or `Yes` to enter your own Anthropic key (direct mode)
2. **Where to install** — select a Cursor option: project-level `.cursor/mcp.json` or global `~/.cursor/mcp.json`
3. **Install the Cursor rule?** → Yes (enables the keyword trigger)

### Step 2 — Reload Cursor

```
Cmd+Shift+P → "Reload Window"
```

### Step 3 — Verify

In Cursor chat, run:
```
Use rn-token-optimizer to show my DSL memory
```

The MCP tools panel should list `rn-token-optimizer` as connected.

### Step 4 — Use the keyword trigger

Type `rn-token-optimizer` at the start of any Cursor chat message:

```
rn-token-optimizer I need you to fix the issue where Google login fails after installing react-native-google-signin on Android 12 devices but it works fine on iOS
```

Cursor will:
1. Detect the `rn-token-optimizer` keyword via the installed Cursor rule
2. Call `optimize_prompt` via MCP automatically
3. Display the full Token Optimization Report
4. Show the compressed prompt
5. Answer based on the compressed intent — not the verbose original

**Example response in Cursor:**

```
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

[Answer to the compressed prompt follows…]
```

### Manual install — Cursor

**Passthrough mode (no API key — uses Cursor subscription):**

```json
{
  "mcpServers": {
    "rn-token-optimizer": {
      "command": "rn-token-optimizer-mcp"
    }
  }
}
```

**Direct mode (your own Anthropic key):**

```json
{
  "mcpServers": {
    "rn-token-optimizer": {
      "command": "rn-token-optimizer-mcp",
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-YOUR_KEY_HERE"
      }
    }
  }
}
```

Save to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global), then reload Cursor.

**Create `.cursor/rules/rn-token-optimizer.mdc`** — run the installer and choose *"Show me the config — I will add it manually"* to print the full rule content.

---

## 9. Kiro MCP Integration

[Kiro](https://kiro.dev) is Amazon's AI IDE. It supports MCP servers natively and has its own **Steering** system (persistent markdown guidance files) and **Agent Hooks** (event-driven automation) — both of which `rn-token-optimizer` integrates with.

### Step 1 — Run the installer

Inside your React Native workspace:

```bash
rn-token-optimizer install
```

The installer asks:
1. **API key mode** — choose `No` to use your Kiro subscription (passthrough, free) or `Yes` to enter your own Anthropic key (direct mode)
2. **Where to install** — select a Kiro option: workspace `.kiro/settings/mcp.json` or user-level `~/.kiro/settings/mcp.json`
3. **Install the Kiro steering file?** → **Yes** (recommended — this is the keyword trigger)
4. **Install the Kiro agent hook?** → Optional (fires on every prompt submission)

The installer writes three files automatically:
| File | Purpose |
|------|---------|
| `.kiro/settings/mcp.json` | Registers the MCP server with Kiro |
| `.kiro/steering/rn-token-optimizer.md` | Tells Kiro when and how to call the MCP tools |
| `.kiro/hooks/rn-token-optimizer.kiro.hook` | (optional) Hook that fires on prompt events |

### Step 2 — Verify in Kiro

Kiro reloads MCP config automatically when the file is saved — no restart needed.

1. Open the **Kiro panel** (sidebar)
2. Go to the **MCP** section
3. You should see `rn-token-optimizer` listed as connected with its tools

### Step 3 — Use the keyword trigger

Type `rn-token-optimizer` at the start of any Kiro chat message:

```
rn-token-optimizer I need you to fix the issue where Google login fails after installing react-native-google-signin on Android 12 devices but it works fine on iOS
```

Because the steering file uses `inclusion: auto` with a description that matches this pattern, Kiro loads the rn-token-optimizer steering context automatically and calls `optimize_prompt` via MCP.

**The response is identical to Cursor** — full token report, then the optimized prompt, then the answer.

### Manual install — Kiro

**Passthrough mode (no API key — uses Kiro subscription):**

```json
{
  "mcpServers": {
    "rn-token-optimizer": {
      "command": "rn-token-optimizer-mcp",
      "args": [],
      "autoApprove": ["optimize_prompt", "compress_output", "get_slash_prompt", "dsl_show"]
    }
  }
}
```

**Direct mode (your own Anthropic key):**

```json
{
  "mcpServers": {
    "rn-token-optimizer": {
      "command": "rn-token-optimizer-mcp",
      "args": [],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-YOUR_KEY_HERE"
      },
      "autoApprove": ["optimize_prompt", "compress_output", "get_slash_prompt", "dsl_show"]
    }
  }
}
```

Save to `.kiro/settings/mcp.json` (workspace) or `~/.kiro/settings/mcp.json` (user). Kiro reloads automatically on save.

> `autoApprove` lets Kiro call those tools without asking for confirmation each time. Remove any you want to approve manually.

**2. Create `.kiro/steering/rn-token-optimizer.md`** — run the installer and choose *"Show me the config"* to print the full steering file content. Or use the Kiro panel:

1. Kiro panel → **Steering** → **+** → Workspace scope
2. Name it `rn-token-optimizer`
3. Paste the content printed by `rn-token-optimizer install` → Manual

**3. (Optional) Create `.kiro/hooks/rn-token-optimizer.kiro.hook`** — via Kiro panel → **Agent Hooks** → **+** → *Ask Kiro to create a hook*, and describe:

> When the user's prompt starts with "rn-token-optimizer", call the optimize_prompt MCP tool and display the token savings report before answering.

### Steering file — inclusion modes

The installed steering file uses `inclusion: auto` mode, which means Kiro includes it automatically when your message matches the description. You can also switch to other modes:

| Mode | Front-matter | Behaviour |
|------|-------------|-----------|
| `auto` | `inclusion: auto` + `description:` | Kiro loads it when the request matches the description |
| `always` | `inclusion: always` | Loaded in every Kiro interaction (highest context use) |
| `manual` | `inclusion: manual` | Type `/rn-token-optimizer` in chat to include on demand |
| `fileMatch` | `inclusion: fileMatch` + `fileMatchPattern:` | Load when editing specific files |

To change the mode, edit `.kiro/steering/rn-token-optimizer.md` and update the front-matter block at the top.

### Kiro vs Cursor — comparison

| Feature | Cursor | Kiro |
|---------|--------|------|
| MCP config location | `.cursor/mcp.json` | `.kiro/settings/mcp.json` |
| Keyword trigger mechanism | Cursor Rule (`.mdc` file) | Steering file (`.md` with `inclusion: auto`) |
| Auto-approve tools | Not available | `autoApprove` array in config |
| Event-driven automation | Not available | Agent Hooks (`.kiro.hook` files) |
| Global config | `~/.cursor/mcp.json` | `~/.kiro/settings/mcp.json` |
| Reload required | Yes — `Cmd+Shift+P → Reload Window` | No — auto-reloads on file save |

---

## 10. Claude Desktop Integration

> **Claude Desktop requires an Anthropic API key.** It runs MCP tools as standalone processes with no built-in AI to delegate to, so passthrough mode cannot be used here. Get a key at [console.anthropic.com](https://console.anthropic.com) — Haiku is ~$0.80/1M tokens.

```bash
rn-token-optimizer install
# Select: "Claude Desktop (claude_desktop_config.json)"
# Select: Yes for direct mode, enter your API key
```

The installer writes to:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/claude/claude_desktop_config.json`

Restart Claude Desktop after installation.

---

## 11. DSL Reference

The compression language used by both modes:

### Fixed Semantic Prefixes

| Prefix | Meaning | Example |
|--------|---------|---------|
| `S=` | state / current situation | `S=METRO bundle FAIL` |
| `C=` | cause / context | `C=SyntaxError CheckoutScreen.tsx:47` |
| `D=` | action / decision / fix | `D=fix A Google login fail AND v12+` |
| `R=` | risk / blocker | `R=bundle blocked until fixed` |
| `O=` | outcome / result | `O=17/20 tests passed` |
| `N=` | no-go / failure item | `N=LoginScreen.test.tsx` |
| `P=` | proof / pass | `P=iOS build green` |

### React Native Aliases

| Alias | Expands to |
|-------|-----------|
| `METRO` | Metro bundler |
| `JEST` | Jest / RNTL test runner |
| `NAV` | React Navigation |
| `NATIVE` | Native module |
| `BRIDGE` | JS-native bridge |
| `HOT` | HMR / Fast Refresh |
| `IOS` | iOS build / device |
| `AND` | Android build / device |
| `REDBOX` | Red screen error |
| `PACK` | Package manager |
| `TS` | TypeScript error |

### Base Aliases

| Alias | Expands to |
|-------|-----------|
| `A` | auth |
| `B` | backend |
| `F` | frontend |
| `U` | UI |
| `X` | deps / dependencies |
| `DB` | database |
| `CFG` | config |
| `DOC` | docs |
| `PERM` | permissions |
| `E` | E2E |
| `V` | env / environment |

### Workflow Macros

| Macro | Meaning |
|-------|---------|
| `1` | test first |
| `2` | run tests |
| `3` | report summary / files / tests / status |
| `4` | review |
| `5` | fix |
| `6` | validate |
| `7` | commit / push |
| `8` | PR |
| `9` | release |
| `M1` | run Metro bundler |
| `M2` | build iOS |
| `M3` | build Android |
| `M4` | clear Metro cache + restart |
| `M5` | check native device logs |

### Negation Defaults (always active)

| Default | Meaning |
|---------|---------|
| `N1` | no frontend changes |
| `N2` | no backend changes |
| `N3` | no UI changes |
| `N4` | no broad refactor |
| `N5` | preserve user changes |
| `N6` | TUI / interactive |
| `N7` | no iOS-only changes |
| `N8` | no Android-only changes |
| `N9` | preserve native code |

### Inline Variables

The LLM dynamically assigns `#shortkeys` for repeated nouns within a response:

```
S=cache=#c1 warmed  model=#m1
D=inspect #c1 hit rate
D=compare #m1 latency
```

### `/rn-token-optimizer` Agent Slash Command

Paste this into any AI chat to activate DSL mode for the entire thread:

```bash
rn-token-optimizer slash --project "MyApp"
```

---

## 12. DSL Memory Management

The tool learns project-specific terms over time, storing them in:
- **Global**: `~/.rn-token-optimizer/dsl.json`
- **Project**: `.rn-token-optimizer/dsl.json` (add to `.gitignore`)

### View current memory

```bash
rn-token-optimizer dsl show                # custom memory only
rn-token-optimizer dsl show --builtins     # include built-in aliases
rn-token-optimizer dsl show --candidates   # include not-yet-promoted candidates
```

### Add a custom alias

```bash
rn-token-optimizer dsl add alias AUTHSVC AuthenticationService
rn-token-optimizer dsl add alias CARTCTX ShoppingCartContext --scope global
rn-token-optimizer dsl add alias PAYAPI PaymentAPIService --pin   # pin = never prune
```

### Add a workflow macro

```bash
rn-token-optimizer dsl add macro BUILDCHECK "clear cache, run Metro, run Android build, check logs"
```

### Learn from `Dict+:` output

When the LLM returns lines like `Dict+: AUTHFLOW=authentication flow`, learn them:

```bash
rn-token-optimizer dsl learn "Dict+: AUTHFLOW=authentication flow"
```

### Learn from a conversation transcript

```bash
cat my-chat-log.txt | rn-token-optimizer dsl learn-thread --stdin
rn-token-optimizer dsl learn-thread --stdin --dry-run < transcript.txt
```

### Promote candidates to learned entries

```bash
rn-token-optimizer dsl promote             # promote all eligible
rn-token-optimizer dsl promote --dry-run   # preview first
```

### Pin an alias (prevent pruning)

```bash
rn-token-optimizer dsl pin AUTHSVC
```

### Prune stale entries

```bash
rn-token-optimizer dsl prune              # use config threshold (default 30 days)
rn-token-optimizer dsl prune --days 7     # more aggressive
rn-token-optimizer dsl prune --dry-run    # preview only
```

---

## 13. Programmatic API

Use the library in your own Node.js / TypeScript scripts.

### Installation

```bash
npm install rn-token-optimizer
```

### Optimize a prompt

```typescript
import { optimizePrompt, createAnthropicProvider } from 'rn-token-optimizer';

const provider = createAnthropicProvider(process.env.ANTHROPIC_API_KEY!);

const result = await optimizePrompt(
  "I need you to fix the issue where Google login fails after installing react-native-google-signin on Android 12 devices but it works fine on iOS",
  { provider }
);

console.log(result.optimizedPrompt);
// → D=fix A Google login fail AND v12+ C=post react-native-google-signin install IOS=OK

console.log(`Saved ${result.savedPct}%`);
// → Saved 79.1%

console.log(result.savings.before.tokens, '→', result.savings.after.tokens);
// → 67 → 14

console.log(result.context.domains);
// → ['auth', 'android']
```

### Compress terminal output

```typescript
import { aiTokenOptimizer, createAnthropicProvider } from 'rn-token-optimizer';

const provider = createAnthropicProvider(process.env.ANTHROPIC_API_KEY!);

const result = await aiTokenOptimizer(jestOutput, {
  provider,
  question: "Which tests failed?",
});

console.log(result.output);
// → S=JEST FAIL 2 suites\nN=LoginScreen.test.tsx\nD=fix A mock
```

### Count tokens (no API key needed)

```typescript
import { countTokens, countTokensSync, computeSavings, formatSavingsReport } from 'rn-token-optimizer';

// Async (uses tiktoken for accuracy)
const count = await countTokens("Your text here");
console.log(count.tokens, count.chars, count.words);

// Sync (character-based approximation — fast, no I/O)
const count2 = countTokensSync("Your text here");

// Full savings report
const savings = await computeSavings(originalText, optimizedText);
console.log(formatSavingsReport(savings, 'claude-3-5-haiku-20241022'));
```

### Analyze prompt context

```typescript
import { analyzePromptContext } from 'rn-token-optimizer';

const ctx = analyzePromptContext("Fix the auth issue where Google login fails on Android 12");
console.log(ctx.domains);        // → ['auth', 'android']
console.log(ctx.verbosityScore); // → 6  (0–10, higher = more verbose)
console.log(ctx.isQuestion);     // → false
console.log(ctx.isActionRequest);// → true
```

### DSL memory

```typescript
import { dslMemory, dslLearner } from 'rn-token-optimizer';

const mem = dslMemory.loadActiveMemory();
dslMemory.addAlias('AUTHSVC', 'AuthenticationService', 'project', false);

const result = dslLearner.learnFromDictPlus('Dict+: AUTHFLOW=auth flow', 'project', false);
console.log(result.added); // → [{ key: 'AUTHFLOW', value: 'auth flow' }]
```

---

## 14. Sample Project

A fully runnable demo lives in the `sample/` directory.

### Run the mock demo (no API key required)

```bash
cd sample
npm install
npm run demo:mock
```

Shows pre-canned compressed outputs for Jest, Metro, and Android — so you can see exactly what the tool produces without an Anthropic account.

### Run the live prompt optimizer demo

```bash
cd sample
ANTHROPIC_API_KEY=sk-ant-YOUR_KEY npm run demo:prompt
```

### Run the live terminal compression demo

```bash
cd sample
ANTHROPIC_API_KEY=sk-ant-YOUR_KEY npm run demo:terminal
```

### Run all demos

```bash
cd sample
ANTHROPIC_API_KEY=sk-ant-YOUR_KEY npm run demo
```

---

## Validate on Your Own Project — `stats` command

The `stats` command runs **100% offline** (no API key needed) and gives you real token counts, verbosity scores, domain detection, and projected savings on your actual files.

### Scan your React Native project source

```bash
cd /path/to/your/rn-project

# Scan all TypeScript/JS source files
rn-token-optimizer stats --scan ./src --ext ts,tsx

# Scan everything including tests
rn-token-optimizer stats --scan . --ext ts,tsx,js,jsx

# Show top 20 highest-token files only
rn-token-optimizer stats --scan ./src --top 20
```

### Analyse a single prompt or log file

```bash
# A prompt you saved to a file
rn-token-optimizer stats --file my-prompt.txt

# A Jest log you saved
rn-token-optimizer stats --file jest-output.log --type terminal

# Pipe any content directly
echo "I need you to fix the Google login issue on Android 12" | rn-token-optimizer stats

# Pipe real Jest output
npx jest 2>&1 | rn-token-optimizer stats --type terminal

# Pipe a real Android build
npx react-native run-android 2>&1 | rn-token-optimizer stats --type terminal
```

### What each field means

| Field | What it tells you |
|-------|------------------|
| **Tokens** | Current token count of this file/prompt — what you're spending per LLM call |
| **Type** | Auto-detected: `prompt` (natural language) or `terminal` (log output) or `mixed` |
| **Verbosity** | 0–10 score. ≥7 = very compressible. 0 = already lean. |
| **Domains** | Which RN areas were detected (auth, android, metro, jest, nav…) |
| **DSL aliases** | Which built-in aliases apply to this content |
| **Est. after** | Projected token count after compression, with savings bar |
| **Cost now** | What sending this text to Claude Haiku costs per call |
| **Est. saved** | How much you save per call by compressing first |

### Aggregate Summary

At the bottom you get the full picture across all scanned files:

```
📊 Aggregate Statistics
────────────────────────────────────────────────────────
  Files analysed   : 28
  Total tokens now : 33,855
  Est. after opt.  : 13,584 tokens
  Est. total saved : 20,271 tokens  [████████████░░░░░░░░] ~60%
────────────────────────────────────────────────────────
  Cost per batch now   : $0.027084  (Haiku)
  Est. cost per batch  : $0.010867
  Est. saved / batch   : $0.016217
  Est. saved / 100/day : $1.621680
────────────────────────────────────────────────────────
  🔥 Top savings opportunities:
     4409 → 1852 tokens  (58%)  mcp/server.ts
     3217 → 1158 tokens  (64%)  cli/commands/stats.ts
```

---

## 15. All CLI Commands

```
rn-token-optimizer [question]            Smart dispatch: optimize if no stdin, distill if stdin
rn-token-optimizer optimize <prompt>     Compress a verbose prompt
rn-token-optimizer distill <question>    Compress piped terminal output
rn-token-optimizer slash [--project]     Print the /rn-token-optimizer agent slash command
rn-token-optimizer install               Install MCP server into Cursor / Claude Desktop
rn-token-optimizer onboard               Re-run the setup wizard
rn-token-optimizer dsl show              Show DSL memory
rn-token-optimizer dsl add alias <k> <v> Add a custom alias
rn-token-optimizer dsl add macro <k> <v> Add a workflow macro
rn-token-optimizer dsl learn <dict>      Learn a Dict+ entry
rn-token-optimizer dsl learn-thread      Extract candidates from transcript via stdin
rn-token-optimizer dsl promote           Promote eligible candidates
rn-token-optimizer dsl pin <key>         Pin an alias (prevent pruning)
rn-token-optimizer dsl prune             Remove stale entries
```

### Global flags

| Flag | Description |
|------|-------------|
| `--scope global` | Apply command to global DSL memory |
| `--scope project` | Apply command to project DSL memory (default) |
| `--dry-run` | Preview changes without writing |
| `--pin` | Pin an alias so it is never pruned |
| `--days <n>` | Override prune threshold |

---

## 16. Configuration Reference

Config is stored at `~/.rn-token-optimizer/config.json`:

```json
{
  "anthropicApiKey": "sk-ant-...",
  "model": "claude-3-5-haiku-20241022",
  "defaultScope": "project",
  "promotionThreshold": 3,
  "learnThreadMinUses": 2,
  "pruneAfterDays": 30
}
```

| Key | Default | Description |
|-----|---------|-------------|
| `anthropicApiKey` | — | Your Anthropic API key |
| `model` | `claude-3-5-haiku-20241022` | Model for all LLM calls |
| `defaultScope` | `project` | Where to store learned DSL entries |
| `promotionThreshold` | `3` | Uses required before candidate is promoted |
| `learnThreadMinUses` | `2` | Min uses in a thread to extract a candidate |
| `pruneAfterDays` | `30` | Days of non-use before an entry is pruned |

### Environment variable override

```bash
ANTHROPIC_API_KEY=sk-ant-... rn-token-optimizer optimize "..."
```

The `ANTHROPIC_API_KEY` env var takes priority over the config file value.

---

## 17. Troubleshooting

### "No API key found"

```bash
rn-token-optimizer onboard    # saves key to ~/.rn-token-optimizer/config.json
# or:
export ANTHROPIC_API_KEY=sk-ant-YOUR_KEY
```

### MCP server not appearing in Cursor

1. Check the MCP config file exists:
   ```bash
   cat .cursor/mcp.json         # project-level
   cat ~/.cursor/mcp.json       # global
   ```
2. Ensure the binary is available on your PATH:
   ```bash
   which rn-token-optimizer-mcp
   ```
3. Reload Cursor: `Cmd+Shift+P → "Reload Window"`
4. Check the MCP panel in Cursor settings for error messages.

### Cursor rule not triggering

1. Verify the rule file exists:
   ```bash
   cat .cursor/rules/rn-token-optimizer.mdc
   ```
2. If missing, re-run: `rn-token-optimizer install`
3. The rule requires `alwaysApply: true` — check the file header.
4. Reload the Cursor window.

### MCP server not appearing in Kiro

1. Check the config file exists:
   ```bash
   cat .kiro/settings/mcp.json        # workspace-level
   cat ~/.kiro/settings/mcp.json      # user-level
   ```
2. Ensure the binary is on your PATH:
   ```bash
   which rn-token-optimizer-mcp
   ```
3. Kiro reloads MCP servers automatically on file save — no restart needed. Try resaving the config file (`Cmd+S`).
4. Open the Kiro panel → MCP section. If the server shows an error, expand it to see the exact message.
5. Try running the server binary manually to check for startup errors:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-YOUR_KEY rn-token-optimizer-mcp
   ```

### Kiro steering file not triggering

1. Verify the file exists:
   ```bash
   cat .kiro/steering/rn-token-optimizer.md
   ```
2. Check the front-matter at the top of the file. It must be:
   ```yaml
   ---
   inclusion: auto
   name: rn-token-optimizer
   description: >
     Optimize prompts and compress terminal output…
   ---
   ```
3. If missing, re-run: `rn-token-optimizer install` and select a Kiro target.
4. For immediate manual testing, type `/rn-token-optimizer` in Kiro chat to include the steering file explicitly.
5. Try switching the inclusion mode to `always` temporarily to confirm the file content is correct.

### "rn-token-optimizer: command not found"

```bash
npm install -g rn-token-optimizer
# If using nvm, ensure your global bin is in PATH:
export PATH="$(npm bin -g):$PATH"
```

### High token counts (optimization not working well)

- Switch to Sonnet for better compression: `rn-token-optimizer onboard` → select `claude-3-5-sonnet-20241022`
- Check verbosity score: the optimizer reports `Verbosity score: X/10`. Scores below 4 may not compress well.
- Use the slash command at the start of a session to put the agent in DSL mode: `rn-token-optimizer slash`

### DSL entries not persisting

Ensure the project config directory is writable:

```bash
ls -la .rn-token-optimizer/    # project scope
ls -la ~/.rn-token-optimizer/  # global scope
```

Add `.rn-token-optimizer/` to your `.gitignore` to avoid committing your personal learned terms.

### tiktoken native binding warning

On some systems `tiktoken` may fail to load its native module. The tool falls back to a character-based approximation (1 token ≈ 4 chars), which is accurate to within ~5%. No action needed.

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│  rn-token-optimizer — Quick Reference                           │
├─────────────────────────────────────────────────────────────────┤
│  SETUP                                                          │
│  npm install -g rn-token-optimizer                              │
│  rn-token-optimizer                    ← first-run wizard       │
│  rn-token-optimizer install            ← Cursor/Claude MCP      │
├─────────────────────────────────────────────────────────────────┤
│  PROMPT MODE                                                    │
│  rn-token-optimizer "Your long prompt"                          │
│  rn-token-optimizer optimize "Your long prompt"                 │
├─────────────────────────────────────────────────────────────────┤
│  TERMINAL MODE                                                  │
│  npx jest 2>&1           | rn-token-optimizer "Did tests pass?" │
│  npx react-native run-android 2>&1 | rn-token-optimizer "Build?"│
│  npx react-native start 2>&1  | rn-token-optimizer "Any errors?"│
├─────────────────────────────────────────────────────────────────┤
│  CURSOR CHAT (after MCP install)                                │
│  rn-token-optimizer <your prompt here>                          │
│  → shows token report + optimized prompt + answer              │
├─────────────────────────────────────────────────────────────────┤
│  DSL MEMORY                                                     │
│  rn-token-optimizer dsl show                                    │
│  rn-token-optimizer dsl add alias AUTHSVC AuthenticationService │
│  rn-token-optimizer dsl prune                                   │
└─────────────────────────────────────────────────────────────────┘
```
