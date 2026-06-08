# Changelog

All notable changes to **rn-token-optimizer**.  
Live product site: **[prmargas.com/projects/rn-token-optimizer](https://prmargas.com/projects/rn-token-optimizer/)**

---

## [1.1.0] — 2026-06-08

Code intelligence goes beyond name-based search: **find code by concept**, **see your codebase as a graph**, and **keep the graph live while you edit** — all local, no cloud upload.

### Semantic Search (TF-IDF)

**What changed**
- New `graph semantic <query>` CLI command
- New MCP tool: `semantic_search_graph` (**19 tools** total, was 18)
- Pure TypeScript TF-IDF engine in `src/graph/tfidf.ts` — cosine similarity over indexed symbols

**Why it helps**
- Ask *"authentication flow"* or *"payment checkout"* instead of guessing symbol names like `handleLogin` or `useCart`
- Your IDE agent can narrow 200 files down to the 5 most relevant nodes (~**98% fewer tokens** than file-by-file reading)
- Same ranking powers the visual explorer search box and `GET /api/search` while `graph ui` is running

**Explore on the live site**
| Where | What to do |
|-------|------------|
| [Overview → What's inside](https://prmargas.com/projects/rn-token-optimizer/) | Scroll to **Semantic Search (TF-IDF)** pillar (marked **NEW**) |
| [What It Solves](https://prmargas.com/projects/rn-token-optimizer/) | Open **Feature 1a — Semantic Search** card with CLI + REST examples |
| [How To Use → Visual Graph Explorer](https://prmargas.com/projects/rn-token-optimizer/) | Step **Search by concept (TF-IDF)** |
| [How To Use → Demo: RN App](https://prmargas.com/projects/rn-token-optimizer/) | Use the **Interactive Demo Sandbox** search box — try `"auth"` or `"cart"` |
| [Docs → MCP](https://prmargas.com/projects/rn-token-optimizer/) | Look up `semantic_search_graph` in the tools table |

**Try locally**
```bash
rn-token-optimizer graph index --dir ./demo-rn-app
rn-token-optimizer graph semantic "user login authentication" --dir ./demo-rn-app
```

---

### Visual Graph Explorer (`graph ui`)

**What changed**
- New `graph ui` command — zero-dependency browser dashboard at **http://localhost:7842**
- Force-directed graph, type filter pills, TF-IDF sidebar search, node detail panel (callers, callees, source snippet)
- REST API: `/api/graph`, `/api/search?q=`, `/api/node/:id`

**Why it helps**
- **See** call relationships instead of reading files linearly — onboarding, refactors, and code review become visual
- Click any dot → instant file path, line range, and source — no opening 15 tabs in your IDE
- Works for TypeScript/React Native **and** .NET graphs from the same SQLite store

**Explore on the live site**
| Where | What to do |
|-------|------------|
| [Overview → Live demo](https://prmargas.com/projects/rn-token-optimizer/) | Scroll to **Index any project in one command** — terminal output for `demo-rn-app` (122 nodes, 220 edges) |
| [Overview](https://prmargas.com/projects/rn-token-optimizer/) | Click **Open Live Interactive Explorer** (jumps to How To Use → Demo tab) |
| [What It Solves](https://prmargas.com/projects/rn-token-optimizer/) | **Feature 1c — Visual Graph Explorer** — launch commands and UI breakdown |
| [How To Use → Visual Graph Explorer](https://prmargas.com/projects/rn-token-optimizer/) | Full step-by-step: index → `graph ui` → REST API |
| [How To Use → Demo: RN App](https://prmargas.com/projects/rn-token-optimizer/) | **Interactive Demo Sandbox** — drag nodes, filter by type, click for source, search by concept *(no install required)* |

**Try locally**
```bash
rn-token-optimizer graph index --dir ./demo-rn-app
rn-token-optimizer graph ui --dir ./demo-rn-app
```

---

### Live File Watcher (`graph watch`)

**What changed**
- New `graph watch` daemon — native `fs.watch`, incremental re-index on save
- Supports `.ts`, `.tsx`, `.js`, `.jsx`, `.cs` (including Roslyn re-index for C#)

**Why it helps**
- Graph stays accurate while you code — no manual `graph index` after every edit
- Pair with `graph ui`: save a file → refresh browser → see updated nodes in seconds

**Explore on the live site**
| Where | What to do |
|-------|------------|
| [What It Solves](https://prmargas.com/projects/rn-token-optimizer/) | **Feature 1d — Live File Watcher** card |
| [How To Use → Visual Graph Explorer](https://prmargas.com/projects/rn-token-optimizer/) | Step **Keep the graph live with the file watcher** |

**Try locally**
```bash
# Terminal 1
rn-token-optimizer graph watch

# Terminal 2
rn-token-optimizer graph ui
```

---

### Demo React Native app (`demo-rn-app/`)

**What changed**
- Bundled e-commerce sample: 7 screens, 4 hooks, 4 services, navigators, Redux store
- Indexes in ~84ms → 122 nodes, 220 edges — used on the website sandbox and in [GUIDE.md](./GUIDE.md)

**Why it helps**
- Zero setup to see a **real** graph — clone the repo and run two commands
- Same app powers the website's live interactive explorer (pre-indexed graph JSON)

**Explore on the live site**
| Where | What to do |
|-------|------------|
| [Overview → Live demo](https://prmargas.com/projects/rn-token-optimizer/) | Stats cards: 17 files · 122 nodes · 220 edges · 84ms |
| [How To Use → Demo: RN App](https://prmargas.com/projects/rn-token-optimizer/) | Clone instructions + **Interactive Demo Sandbox** + call-graph diagram |

---

### Also in 1.1.0

| Update | Benefit |
|--------|---------|
| **Ollama LLM fallback** (`src/llm/ollama.ts`) | Local, private compression when no Anthropic key — set `OLLAMA_MODEL` or run Ollama at `localhost:11434` |
| **[GUIDE.md](./GUIDE.md)** | Full feature walkthrough (CLI, MCP, explorer, demo app) |
| **README** | Dedicated Feature 1a / 1c / 1d sections for semantic search, graph UI, watcher |
| **npm publish workflow** | GitHub Actions publish on tag / manual dispatch (requires `NPM_TOKEN` secret) |

---

## [1.0.0] — 2026-05-14

Initial release: AST code intelligence graph (TypeScript + Roslyn .NET), prompt optimization, terminal compression, 18 MCP tools, Cursor/Kiro/Claude Desktop integration.

---

## Quick links

| Resource | URL |
|----------|-----|
| Live website | [prmargas.com/projects/rn-token-optimizer](https://prmargas.com/projects/rn-token-optimizer/) |
| GitHub | [github.com/Pradeep241094/rn-token-optimizer](https://github.com/Pradeep241094/rn-token-optimizer) |
| Full guide | [GUIDE.md](./GUIDE.md) |
| npm | [npmjs.com/package/rn-token-optimizer](https://www.npmjs.com/package/rn-token-optimizer) |
