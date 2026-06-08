# rn-token-optimizer — Complete Feature Guide

> **Your AI agent reads 200 files when it could query one graph.**
>
> `rn-token-optimizer` gives your AI coding agent a searchable knowledge graph of your codebase, compresses every prompt and terminal output, and plugs into Cursor, Kiro, and Claude Desktop as a local MCP server — no new API keys, no cloud upload.

---

## Table of Contents

1. [What This Tool Does](#1-what-this-tool-does)
2. [Quick Start — Any Project in 60 Seconds](#2-quick-start--any-project-in-60-seconds)
3. [Feature A — Semantic Search (TF-IDF)](#3-feature-a--semantic-search-tfidf)
4. [Feature B — Local LLM (Ollama)](#4-feature-b--local-llm-ollama)
5. [Feature C — Live File Watcher](#5-feature-c--live-file-watcher)
6. [Feature D — Visual Graph Explorer](#6-feature-d--visual-graph-explorer)
7. [Feature E — Prompt Compression](#7-feature-e--prompt-compression)
8. [Feature F — Terminal Output Compression](#8-feature-f--terminal-output-compression)
9. [Demo: Indexing a React Native App](#9-demo-indexing-a-react-native-app)
10. [Integration Patterns](#10-integration-patterns)
11. [MCP Server (Cursor / Kiro / Claude Desktop)](#11-mcp-server-cursor--kiro--claude-desktop)
12. [All CLI Commands Reference](#12-all-cli-commands-reference)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. What This Tool Does

`rn-token-optimizer` is a **local, zero-cloud code intelligence brain** with six capabilities:

| Capability | What it means in practice |
|---|---|
| **Knowledge Graph** | Scans your codebase and builds a graph of every function, class, hook, screen, and their relationships |
| **Semantic Search** | Type any concept ("auth flow", "payment error") — the TF-IDF engine finds relevant code without needing exact names |
| **Visual Graph Explorer** | Opens a live browser dashboard where you can visually explore, filter, and click on your entire codebase |
| **Live Watcher** | Automatically re-indexes files as you edit them — graph always stays current |
| **Prompt Compression** | Compresses verbose AI prompts by 65–85% using a Military-English DSL |
| **Terminal Compression** | Pipe Metro / Jest / build output and get a condensed, queryable summary |

**Supported Languages:** TypeScript, JavaScript, React Native, .NET/C#  
**Zero Dependencies:** No cloud, no API keys required, no npm packages beyond Node.js

---

## 2. Quick Start — Any Project in 60 Seconds

```bash
# Step 1 — Install globally (once, works in every project)
npm install -g rn-token-optimizer

# Step 2 — Go to your project
cd /path/to/your-react-native-project

# Step 3 — Build the knowledge graph (scans all TypeScript/JS files)
rn-token-optimizer graph index

# Step 4 — Open the visual explorer in your browser
rn-token-optimizer graph ui

# Step 5 (optional) — Connect to Cursor / Kiro / Claude Desktop
rn-token-optimizer install
```

That's it. The explorer opens at **http://localhost:7842** with your entire codebase as an interactive graph.

> **Tip:** The graph DB is stored at `.rn-token-optimizer/graph.db` inside your project — completely local and isolated per project.

---

## 3. Feature A — Semantic Search (TF-IDF)

### What it is

A custom TF-IDF (Term Frequency–Inverse Document Frequency) engine that finds code by *concept*, not just by name. It understands that "authentication flow" is related to `handleLogin`, `useAuth`, and `AuthService` — even if those exact words don't appear in the file.

### How it works

1. When you run `graph index`, every code symbol is tokenised into a "document" from its name, file path, signature, and qualifiedName
2. TF-IDF vectors are computed and stored in SQLite
3. When you search, your query is vectorised and cosine-similarity is calculated against every node
4. Results are ranked by relevance score (0.0–1.0)

### How to use

**CLI:**
```bash
rn-token-optimizer graph semantic "authentication flow"
rn-token-optimizer graph semantic "payment checkout error"
rn-token-optimizer graph semantic "push notification handler" --limit 10
```

**In the Visual Explorer:**  
Type any concept in the left sidebar search box. The graph instantly dims unrelated nodes and highlights the top matches with relevance percentages.

**Via REST API (while explorer is running):**
```bash
curl "http://localhost:7842/api/search?q=authentication&limit=5"
```

**Example output:**
```
Semantic Match: "authentication flow"  (5 results)
──────────────────────────────────────────────────
[Hook]     useAuth          relevance: 0.94   hooks/useAuth.ts:12
[Function] handleLogin      relevance: 0.87   screens/LoginScreen.tsx:45
[Service]  AuthService      relevance: 0.82   services/AuthService.ts:1
[Function] refreshTokens    relevance: 0.71   services/ApiService.ts:88
[Screen]   LoginScreen      relevance: 0.65   screens/LoginScreen.tsx:16
```

### When to use it

- **"Where is the code that handles X?"** — search instead of grep
- **Code review** — find all code related to a bug area before reading files
- **Onboarding** — understand an unfamiliar codebase by searching concepts
- **Before asking your AI agent** — give it only the relevant nodes, not all 200 files

---

## 4. Feature B — Local LLM (Ollama)

### What it is

A transparent LLM provider layer that automatically uses your local Ollama instance if no Anthropic API key is set. Zero-cost, fully private AI assistance.

### How it works

The provider checks in this order:
1. **Anthropic API** — if `ANTHROPIC_API_KEY` is set in your environment
2. **Ollama** — if Ollama is running locally at `http://localhost:11434`
3. **Passthrough** — returns a structured instruction for your IDE's built-in AI (Cursor/Kiro)

### Setup for local Ollama

```bash
# Install Ollama (mac)
brew install ollama

# Pull a model
ollama pull llama3.2
# or for code-focused:
ollama pull codellama

# Start Ollama
ollama serve

# rn-token-optimizer will now use it automatically
rn-token-optimizer optimize "Fix the payment screen crash on Android 12"
```

### No setup needed

If you use Cursor or Kiro, the tool runs in **passthrough mode** by default — your IDE's built-in AI does the compression, and you pay nothing extra.

---

## 5. Feature C — Live File Watcher

### What it is

A real-time file system watcher that automatically re-indexes your project whenever you save a file. Keeps the knowledge graph always up to date with zero manual effort.

### How it works

Uses Node.js native `fs.watch({ recursive: true })` — no external dependencies. When a `.ts`, `.tsx`, `.js`, or `.cs` file changes:
1. The changed file is re-parsed with the AST indexer
2. Old nodes/edges for that file are removed from SQLite
3. New nodes/edges are inserted
4. The graph is ready in milliseconds

### How to use

```bash
# Start the watcher (keep running in a terminal tab)
rn-token-optimizer graph watch

# Output:
# 👀 Watching /your/project for changes...
# ✔ Re-indexed screens/LoginScreen.tsx (12 nodes, 18 edges)  +3ms
```

**Pro tip:** Run watcher + explorer together:
```bash
# Terminal 1
rn-token-optimizer graph watch

# Terminal 2
rn-token-optimizer graph ui
```

Every time you save a file, the graph updates. Refresh the browser to see the new state.

---

## 6. Feature D — Visual Graph Explorer

### What it is

An interactive browser-based dashboard that shows your entire codebase as a living, navigable graph. No npm, no bundler, no external packages — just open http://localhost:7842.

### How to launch

```bash
rn-token-optimizer graph index    # index first (or use --force to rebuild)
rn-token-optimizer graph ui       # opens http://localhost:7842
```

### The interface at a glance

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  🧠 rn-token-optimizer › project-name  [122 nodes] [220 edges] [17 files]    │
│  ❓ How to use    📖 Legend    🌐 Project Site                                │
├──────────────────────────────────────────────────────────────────────────────┤
│  WHAT IS THIS? Each dot = a code symbol. Each line = a call relationship.    │
├──────────────────────────────────────────────────────────────────────────────┤
│  Show: ● Screen 7  ● Hook 5  ● Function 90  ● Navigator 3  ● Class 2        │
├──────────────┬───────────────────────────────────────┬────────────────────────┤
│  🔍 Search   │                                       │  DETAIL PANEL          │
│              │     Force-directed graph with          │  [Click any node]      │
│  Results...  │     spring physics animation           │                        │
│              │                                       │  Label: Screen         │
│  📖 Legend   │    ●──────●           ●               │  Name: LoginScreen     │
│  Screen = A  │     \    / \         / \              │                        │
│  full page   │      ●──●   ●───────●   ●             │  Location:             │
│              │                                       │  screens/Login.tsx:16  │
│  🚀 Use in   │                                       │  Callers (1):          │
│  Your Project│                                       │  AppNavigator          │
│              │   🖱️ Scroll to zoom · Drag to pan ·   │  Callees (8):          │
│  1. Install  │      Click any dot to inspect it      │  useAuth, handleLogin  │
└──────────────┴───────────────────────────────────────┴────────────────────────┘
```

### What the dots and lines mean

**The dots (nodes)** — each coloured dot is one code symbol:

| Colour | Type | Human explanation |
|--------|------|-------------------|
| 🔵 Cyan | **Screen** | A React Native screen component — a full page the user navigates to |
| 🟣 Violet | **Hook** | A React custom hook — reusable stateful logic shared across screens |
| ⚪ Slate | **Function** | A regular TypeScript/JavaScript function |
| 🟡 Amber | **Class** | A TypeScript or C# class |
| 🔵 Blue | **Navigator** | A React Navigation navigator (stack, tab, or drawer) |
| 🟠 Orange | **Provider** | A React Context provider that wraps parts of the app |
| 🟢 Green | **Component** | A reusable React component (not a full screen) |
| 🟢 Green | **Service** | A .NET service class (business logic layer) |
| 🔵 Blue | **Controller** | An ASP.NET API controller |
| ⬛ Dark | **Interface / Type** | A TypeScript interface or type alias |

**The lines (edges)** — each line shows a relationship:
- **CALLS** — Function A calls Function B
- **RENDERS** — Component renders another component
- **IMPORTS** — File imports another module
- **INJECTS** — .NET dependency injection

### Navigation controls

| Action | How |
|--------|-----|
| Zoom in/out | Scroll wheel |
| Pan the canvas | Click-drag on empty space |
| Move a node | Click-drag on a node |
| Select a node | Single click |
| Deselect | Click × in the detail panel |
| Search by concept | Type in left sidebar |
| Filter by type | Click the filter pills in the top bar |
| Open legend | Click 📖 Legend button in header |
| Show onboarding guide | Click ❓ in header |

### Detail panel — what you get when you click a node

- **Label + human description** — e.g. *"A React Native screen component (a full page/view)"*
- **Location** — exact file path + line number (e.g. `screens/LoginScreen.tsx:16`)
- **Callers** — everything that calls this node (clickable — navigate to it)
- **Callees** — everything this node calls (clickable)
- **Source code snippet** — the actual code, inline in the panel

### REST API exposed while running

```bash
# Full graph JSON
curl http://localhost:7842/api/graph | jq '.nodes | length'

# Semantic search
curl "http://localhost:7842/api/search?q=checkout&limit=10"

# Single node with callers, callees, source
curl http://localhost:7842/api/node/<nodeId>
```

### Options

```bash
rn-token-optimizer graph ui --port 9000      # different port
rn-token-optimizer graph ui --no-open        # don't auto-open browser
rn-token-optimizer graph ui --dir ./myapp    # target a specific directory
```

---

## 7. Feature E — Prompt Compression

### What it is

Compresses your verbose natural-language prompts before sending to any LLM using a Military-English DSL. Typical savings: **65–85%**.

### How to use

```bash
# Direct prompt
rn-token-optimizer optimize "Fix the issue where the payment screen crashes on Android 12 when the user tries to checkout with an expired credit card and the error message is not displayed"

# Output:
# S=PaymentScreen CRASH AND:12 C=checkout+expired-CC DSL:NOTSHOWN
# [Saved 82% — 47 tokens → 9 tokens]

# Smart dispatch (auto-detects mode)
rn-token-optimizer "Fix the payment screen crash"
```

---

## 8. Feature F — Terminal Output Compression

### What it is

Pipe any terminal output (Metro, Jest, Android build, npm logs) and get a compressed, queryable answer.

### How to use

```bash
# Pipe Metro output
npx react-native start 2>&1 | rn-token-optimizer "Why did Metro fail?"

# Pipe Jest failures
npx jest 2>&1 | rn-token-optimizer "Which tests failed and why?"

# Pipe Android build errors
./gradlew assembleDebug 2>&1 | rn-token-optimizer "What caused the build to fail?"
```

---

## 9. Demo: Indexing a React Native App

This section walks through the complete flow using the `demo-rn-app/` project included in this repo — a realistic e-commerce React Native app with 7 screens, 4 hooks, 4 services, a Redux store, and navigators.

### Project structure

```
demo-rn-app/
├── src/
│   ├── navigation/
│   │   └── AppNavigator.ts          ← AppNavigator, AuthNavigator, MainTabNavigator, ShopNavigator
│   ├── screens/
│   │   ├── LoginScreen.tsx          ← Auth entry with social login (Google, Apple)
│   │   ├── HomeScreen.tsx           ← Featured products + category carousel
│   │   ├── ProductListScreen.tsx    ← Filterable, searchable product grid
│   │   ├── ProductDetailScreen.tsx  ← Gallery, reviews, related products
│   │   ├── CheckoutScreen.tsx       ← Multi-step: address → payment → review
│   │   └── ProfileScreen.tsx        ← Profile + SettingsScreen
│   ├── hooks/
│   │   ├── useAuth.ts               ← login, register, logout, refresh
│   │   ├── useProducts.ts           ← fetch, filter, paginate, search
│   │   ├── useCart.ts               ← add, remove, update, checkout
│   │   └── useTheme.ts              ← useTheme, useDebounce, usePagination
│   ├── services/
│   │   ├── ApiService.ts            ← HTTP client, auth token injection, retry
│   │   ├── AuthService.ts           ← login, register, logout, password reset
│   │   ├── ProductService.ts        ← fetch, search, categories, reviews
│   │   └── CartService.ts           ← cart CRUD, checkout, orders
│   ├── store/
│   │   └── slices.ts                ← authReducer, cartReducer, productsReducer
│   └── types/
│       └── index.ts                 ← User, Product, Cart, Order, Address…
└── package.json
```

### Step-by-step: run it yourself

**1. Index the demo project:**

```bash
rn-token-optimizer graph index --dir ./demo-rn-app
```

Output you'll see:
```
✔ Indexed in 84ms

────────────────────────────────────────────────────
  🔍 Code Intelligence — demo-rn-app
────────────────────────────────────────────────────
  Files indexed : 17
  Nodes         : 122  (functions, classes, screens, hooks…)
  Edges         : 220  (calls, imports, renders, navigates)

  Screens found:
    CheckoutScreen      screens/CheckoutScreen.tsx
    HomeScreen          screens/HomeScreen.tsx
    LoginScreen         screens/LoginScreen.tsx
    ProductDetailScreen screens/ProductDetailScreen.tsx
    ProductListScreen   screens/ProductListScreen.tsx
    ProfileScreen       screens/ProfileScreen.tsx
    SettingsScreen      screens/ProfileScreen.tsx (co-located)

  Hotspots (most-called):
    post         (13 callers)  services/ApiService.ts
    get          (10 callers)  services/ApiService.ts
    useAuth      (7 callers)   hooks/useAuth.ts
    useCart      (5 callers)   hooks/useCart.ts
    buildHeaders (5 callers)   services/ApiService.ts
```

**2. Open the visual explorer:**

```bash
rn-token-optimizer graph ui --dir ./demo-rn-app --port 7843
```

Goes to http://localhost:7843.

**3. Try the architecture command:**

```bash
rn-token-optimizer graph architecture --dir ./demo-rn-app
```

**4. Trace the checkout flow:**

```bash
rn-token-optimizer graph trace checkout --dir ./demo-rn-app --direction inbound

# Output:
# ← Callers of checkout:
#   ↳ handlePlaceOrder   screens/CheckoutScreen.tsx
#     ↳ CheckoutScreen   screens/CheckoutScreen.tsx
```

**5. Find all authentication code by concept:**

```bash
rn-token-optimizer graph semantic "user login authentication" --dir ./demo-rn-app

# Output:
# [Screen]   LoginScreen      relevance: 0.92
# [Hook]     useAuth          relevance: 0.89
# [Function] handleLogin      relevance: 0.85
# [Service]  AuthService      relevance: 0.80
# [Function] handleGoogleLogin relevance: 0.74
```

**6. Find dead code:**

```bash
rn-token-optimizer graph dead-code --dir ./demo-rn-app
# Shows functions that nothing calls — candidates for deletion
```

### What you see in the visual explorer

When you open http://localhost:7843 after indexing `demo-rn-app`:

**Nodes visible by type:**
- **7 Screen nodes** (cyan) — LoginScreen, HomeScreen, ProductListScreen, ProductDetailScreen, CheckoutScreen, ProfileScreen, SettingsScreen
- **4 Hook nodes** (violet) — useAuth, useProducts, useCart, useTheme + useDebounce + usePagination
- **3 Navigator nodes** (blue) — AppNavigator, AuthNavigator, MainTabNavigator
- **4+ Function nodes** (slate) — formatPrice, calculateDiscount, buildHeaders, refreshTokens, etc.

**Call graph relationships visible as lines:**
```
AppNavigator ──────→ AuthNavigator ──────→ LoginScreen
                                                │
                                                ↓
                                            useAuth ──────→ AuthService ──────→ ApiService
                                                                                    │
                                                                              buildHeaders
                                                                              refreshTokens

AppNavigator ──────→ MainTabNavigator ─→ HomeScreen ──→ useProducts ──→ ProductService
                                              │
                                              └──→ useCart ──→ CartService ──→ ApiService

CheckoutScreen ────→ useCart ──→ CartService.checkout ──→ ApiService.post
```

**Try these searches in the explorer sidebar:**

| Search | What it highlights |
|---|---|
| `"login auth"` | LoginScreen, useAuth, handleLogin, AuthService, handleGoogleLogin |
| `"payment checkout"` | CheckoutScreen, useCart, CartService, checkout, handlePlaceOrder |
| `"product filter"` | ProductListScreen, useProducts, fetchProducts, setFilter |
| `"navigation stack"` | AppNavigator, AuthNavigator, MainTabNavigator, ShopNavigator |
| `"api token refresh"` | ApiService, refreshTokens, refreshTokenIfNeeded, buildHeaders |

### Apply this to YOUR project

The exact same flow works for any TypeScript / React Native / .NET project:

```bash
cd /your-own-project
rn-token-optimizer graph index     # scans all .ts/.tsx/.js/.cs files
rn-token-optimizer graph ui        # opens http://localhost:7842
```

The tool auto-detects:
- **React Native projects** → finds Screens, Hooks, Navigators, Providers
- **TypeScript projects** → finds Functions, Classes, Interfaces, Types
- **.NET projects** → finds Controllers, Services, Repositories, Middleware

---

## 10. Integration Patterns

### Pattern 1 — Global CLI (any project, immediately)

```bash
npm install -g rn-token-optimizer

cd /your/any-project
rn-token-optimizer graph index     # build the brain
rn-token-optimizer graph ui        # open explorer
rn-token-optimizer graph semantic "the concept you need"
```

### Pattern 2 — MCP Server (AI IDE integration)

Installs the tool as a "brain" that Cursor / Kiro queries automatically:

```bash
rn-token-optimizer install
# → Choose: Cursor / Kiro / Claude Desktop
```

After installation, every question you ask in Cursor silently queries the graph:

| You type in Cursor | Tool called automatically |
|---|---|
| "Find all auth-related code" | `semantic_search_graph` |
| "Who calls handlePayment?" | `trace_call_graph` |
| "What's the architecture?" | `graph_architecture` |
| "Which files changed and what broke?" | `detect_changes` |
| "Compress this prompt" | `optimize_prompt` |

### Pattern 3 — Programmatic API

```typescript
import { searchGraphTfIdf, getArchitecture, optimizePrompt } from 'rn-token-optimizer';

// Semantic search
const results = await searchGraphTfIdf('payment checkout', 5, '/your/project');
console.log(results[0].node.name);   // 'checkout'
console.log(results[0].score);        // 0.94

// Architecture overview
const arch = getArchitecture('/your/project');
console.log(arch.screens);           // ['LoginScreen', 'HomeScreen', ...]
console.log(arch.hotspots);          // [{name: 'post', callerCount: 13}, ...]

// Prompt compression
const result = await optimizePrompt('Fix the issue where...', { provider });
console.log(result.optimizedPrompt); // compressed DSL version
console.log(result.savedPct);        // "82%"
```

### Pattern 4 — CI/CD Pipeline

```yaml
# .github/workflows/analyze.yml
- name: Install rn-token-optimizer
  run: npm install -g rn-token-optimizer

- name: Build knowledge graph
  run: rn-token-optimizer graph index

- name: Detect change impact
  run: rn-token-optimizer graph changes --since origin/main

- name: Find dead code
  run: rn-token-optimizer graph dead-code

- name: Compress test failure report
  run: npx jest 2>&1 | rn-token-optimizer "Summarize all failures" > report.txt
```

---

## 11. MCP Server (Cursor / Kiro / Claude Desktop)

### Install

```bash
rn-token-optimizer install
```

### Available MCP tools (18 total)

| Tool | What it does |
|---|---|
| `graph_index` | Re-index the project |
| `search_graph` | Exact-name node search |
| `semantic_search_graph` | TF-IDF concept search |
| `trace_call_graph` | Trace callers/callees of a symbol |
| `graph_architecture` | Full codebase overview |
| `detect_changes` | Git diff → affected symbols |
| `find_dead_code` | Zero-callers detection |
| `get_code_snippet` | Source code for a named symbol |
| `query_graph` | Cypher-lite structural query |
| `optimize_prompt` | Compress a verbose prompt |
| `count_tokens` | Token count + cost estimate |
| `distill_terminal` | Compress terminal output |
| `show_dsl_memory` | Show the DSL dictionary |
| `add_dsl_alias` | Add a custom abbreviation |
| `add_dsl_macro` | Add a workflow macro |
| `learn_dsl_entry` | Learn a Dict+ pattern |
| `promote_dsl_candidates` | Promote frequent candidates |
| `prune_dsl_memory` | Remove stale entries |

---

## 12. All CLI Commands Reference

```
# ── Knowledge Graph ─────────────────────────────────────────────────────────
graph index                   Build / rebuild the knowledge graph
graph index --force            Force full re-index (ignore cache)
graph index --dir ./src        Index a specific directory

graph architecture             Codebase overview (screens, hotspots, stats)
graph search <pattern>         Exact-name node search
graph semantic <query>         TF-IDF concept search
graph semantic <q> --limit 10  Limit results
graph trace <name>             Trace call chain for a function/class
graph trace <name> --direction inbound    Who calls it
graph trace <name> --direction outbound   What it calls
graph trace <name> --direction both       Full chain
graph trace <name> --depth 3   Trace depth
graph dead-code                Find symbols with zero callers
graph changes                  Git diff → impacted symbols
graph snippet <name>           Print source code for a named symbol
graph query <cypher-lite>      Structural query

# ── Live Watcher ────────────────────────────────────────────────────────────
graph watch                    Real-time incremental re-indexer

# ── Visual Explorer ─────────────────────────────────────────────────────────
graph ui                       Launch browser dashboard (port 7842)
graph ui --port 9000           Custom port
graph ui --no-open             Don't auto-open browser
graph ui --dir ./myapp         Target a specific directory

# ── Compression ─────────────────────────────────────────────────────────────
optimize <prompt>              Compress a verbose prompt
distill <question>             Compress piped terminal output
[question]                     Smart dispatch (auto-detects mode)

# ── MCP & Setup ─────────────────────────────────────────────────────────────
install                        Install MCP into Cursor / Kiro / Claude Desktop
onboard                        Re-run interactive setup wizard
slash                          Print the /rn-token-optimizer slash command

# ── DSL Memory ──────────────────────────────────────────────────────────────
dsl show                       Show current DSL memory
dsl add alias <key> <value>    Add a custom abbreviation
dsl add macro <key> <value>    Add a workflow macro
dsl learn <dict>               Learn a Dict+ pattern
dsl learn-thread               Extract candidates from transcript via stdin
dsl promote                    Promote eligible candidates
dsl pin <key>                  Pin an alias (prevent pruning)
dsl prune                      Remove stale/unused entries

# ── Global flags ─────────────────────────────────────────────────────────────
--dir <path>      Target project directory (default: current directory)
--verbose         Show detailed output
--no-color        Disable coloured output
```

---

## 13. Troubleshooting

### "Roslyn analyzer source not found" when indexing

**Cause:** A `.csproj` or `.sln` file was found anywhere under the directory.

**Fix:** Target the TypeScript source directory specifically:
```bash
rn-token-optimizer graph index --dir ./src
rn-token-optimizer graph ui --dir ./src
```

### "Port 7842 is already in use"

```bash
# Use a different port
rn-token-optimizer graph ui --port 7843

# Or kill the existing server
lsof -ti:7842 | xargs kill -9
```

### "No graph index found" shown in the browser

Run `graph index` first, then open the UI:
```bash
rn-token-optimizer graph index
rn-token-optimizer graph ui
```

### Graph shows too few nodes

1. Check `--dir` points to the source directory (not root if it has non-TS subfolders)
2. Run `graph architecture` to see what was indexed
3. Force a rebuild: `rn-token-optimizer graph index --force`

### MCP server not appearing in Cursor

```bash
rn-token-optimizer install
# Then: Cmd+Shift+P → "Reload Window" in Cursor
```

### Ollama not detected

```bash
ollama list                  # check models
curl http://localhost:11434/api/tags   # check server
ollama serve                 # start if needed
```

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│  rn-token-optimizer — Quick Reference                        │
├─────────────────────────────────────────────────────────────┤
│  SETUP (once)                                                │
│  npm install -g rn-token-optimizer                           │
│  rn-token-optimizer install     → MCP for Cursor/Kiro        │
├─────────────────────────────────────────────────────────────┤
│  KNOWLEDGE GRAPH (run inside your project folder)            │
│  graph index              → build the brain (< 300ms)        │
│  graph ui                 → open visual explorer             │
│  graph watch              → live auto-re-index               │
│  graph semantic "auth"    → TF-IDF concept search            │
│  graph architecture       → codebase overview                │
│  graph trace <name>       → call chain tracing               │
│  graph dead-code          → find unused code                 │
│  graph changes            → git diff impact analysis         │
├─────────────────────────────────────────────────────────────┤
│  PROMPT / TERMINAL COMPRESSION                               │
│  optimize "your prompt"   → compress before sending to AI   │
│  jest 2>&1 | rn-tok "?"  → compress terminal output         │
├─────────────────────────────────────────────────────────────┤
│  VISUAL EXPLORER (while running)                             │
│  http://localhost:7842    → graph dashboard                  │
│  /api/graph               → raw graph JSON                   │
│  /api/search?q=<term>     → semantic search JSON             │
│  /api/node/<id>           → node detail JSON                 │
└─────────────────────────────────────────────────────────────┘
```

---

*For the full DSL specification, see [SETUP.md](./SETUP.md).*  
*Project website: [prmargas.com/projects/rn-token-optimizer](https://prmargas.com/projects/rn-token-optimizer/)*
