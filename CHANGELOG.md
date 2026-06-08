# Changelog

All notable changes to **rn-token-optimizer**.  
Live site: **[prmargas.com/projects/rn-token-optimizer](https://prmargas.com/projects/rn-token-optimizer/)**

---

## [1.1.0] — 2026-06-08

### Summary

We extended the code intelligence graph with **concept search**, a **browser visual explorer**, and a **live file watcher**. The graph still lives in local SQLite (`.rn-token-optimizer/graph.db`); nothing is sent to the cloud.

---

### What we built

| Area | Added |
|------|--------|
| **Semantic search** | `src/graph/tfidf.ts`, `graph semantic`, MCP `semantic_search_graph`, `/api/search` in graph UI |
| **Visual explorer** | `src/graph/ui/server.ts`, `src/graph/ui/dashboard.ts`, `graph ui` → http://localhost:7842 |
| **Live watcher** | `src/graph/watcher.ts`, `graph watch` — incremental re-index on save |
| **Sample app** | `demo-rn-app/` — 17 files, 122 nodes, 220 edges (used on the website sandbox) |
| **Docs** | [GUIDE.md](./GUIDE.md), README Feature 1a / 1c / 1d |
| **MCP** | 19 tools (was 18) |
| **LLM** | Ollama fallback in `src/llm/ollama.ts` when no Anthropic key is set |

---

### Semantic search (TF-IDF)

#### What we did

- Each indexed symbol (function, hook, screen, service, class…) becomes a searchable document built from its **name**, **file path**, **signature**, and **qualified name**.
- We added a pure TypeScript TF-IDF engine — no LLM, no external search service.
- Exposed it three ways: CLI (`graph semantic`), MCP (`semantic_search_graph`), and the graph UI search box + REST API.

#### How it works

```
graph index
    → nodes written to SQLite

graph semantic "authentication flow"
    → query tokenised
    → TF-IDF vector built for query + every node
    → cosine similarity scored (0.0 – 1.0)
    → top N symbols returned ranked by relevance
```

Example:

```bash
rn-token-optimizer graph semantic "payment checkout" --limit 5
# CheckoutScreen  0.91  screens/CheckoutScreen.tsx
# useCart         0.86  hooks/useCart.ts
# CartService     0.74  services/CartService.ts
```

On a large project, grep returns hundreds of string matches across tests, comments, and unrelated files. TF-IDF returns the **symbols that best match the concept** — usually 5–10 nodes instead of 20+ files opened into an AI chat (~**95% fewer exploration tokens**).

A **code owner** uses this before refactors to see every touchpoint for a domain (`"billing"`, `"auth"`). A **new developer** uses it when they know the feature name but not the codebase's naming conventions (`"login"` finds `useAuth`, `LoginScreen`, `AuthService` together).

#### Try on the live site (no install)

- [Overview → Semantic Search pillar](https://prmargas.com/projects/rn-token-optimizer/)
- [How To Use → Demo: RN App](https://prmargas.com/projects/rn-token-optimizer/) — **Interactive Demo Sandbox**, search box: try `"auth"` or `"cart"`

---

### Graph watcher (`graph watch`)

#### What we did

- A long-running CLI daemon using Node.js native `fs.watch({ recursive: true })`.
- On save: re-parse **only the changed file** (TypeScript AST or Roslyn for `.cs`), delete old nodes/edges for that file, insert new ones.
- No full `graph index` needed after every edit.

#### How it works

```
Save file (e.g. screens/LoginScreen.tsx)
    → fs.watch fires
    → old nodes/edges for that file removed from graph.db
    → file re-parsed (indexer or Roslyn)
    → new nodes/edges inserted
    → done in milliseconds
```

Run alongside the explorer:

```bash
rn-token-optimizer graph watch    # terminal 1
rn-token-optimizer graph ui       # terminal 2 — refresh browser after saves
```

Without the watcher, the graph goes stale during active development; AI agents and humans query outdated call chains. With it, `graph trace`, `graph semantic`, and `graph ui` always reflect the working tree — important on large repos where full re-indexing is slower and easy to forget.

#### Try on the live site

- [What It Solves → Live File Watcher](https://prmargas.com/projects/rn-token-optimizer/)
- [How To Use → Visual Graph Explorer → watcher step](https://prmargas.com/projects/rn-token-optimizer/)

---

### Visual graph explorer (`graph ui`)

#### What we did

- Local HTTP server (port 7842) serving a zero-dependency dashboard: force-directed graph, type filters, TF-IDF sidebar, node detail panel with callers/callees/source.
- REST endpoints: `GET /api/graph`, `GET /api/search?q=`, `GET /api/node/:id`.

#### How it works

```
graph index  →  SQLite populated
graph ui     →  server reads graph.db, serves HTML + JSON API

Canvas:  dot = symbol,  line = CALLS | IMPORTS | RENDERS | INJECTS …
Click:   detail panel shows file:line, callers, callees, source snippet
Search:  same TF-IDF engine dims non-matches, highlights relevant nodes
```

Example flow visible in the graph:

```
AppNavigator → LoginScreen → useAuth → AuthService → ApiService
CheckoutScreen → useCart → CartService.checkout → ApiService.post
```

Reading that chain file-by-file can cost an AI agent **~15,000–50,000 tokens** on a large app. Clicking through the graph or calling `trace_call_path` costs **~300–400 tokens** for the same answer.

#### Try on the live site (no install)

- [Overview → Open Live Interactive Explorer](https://prmargas.com/projects/rn-token-optimizer/)
- [How To Use → Demo: RN App → Interactive Demo Sandbox](https://prmargas.com/projects/rn-token-optimizer/) — pre-loaded `demo-rn-app` graph (122 nodes, 220 edges)

Local:

```bash
rn-token-optimizer graph index --dir ./demo-rn-app
rn-token-optimizer graph ui --dir ./demo-rn-app
```

---

### How the pieces connect

```
graph index     build graph once
graph watch     keep graph current
graph semantic  find symbols by concept
graph ui        see call flow visually
MCP tools       IDE agent queries graph instead of opening files
```

Typical token difference on a large project:

| Question | Read files manually / via agent | Graph query |
|----------|--------------------------------|-------------|
| Who calls `handleLogin`? | ~18,000 tokens | ~300 |
| Find auth-related code | ~20,000+ tokens | ~400 |
| Architecture overview | ~50,000 tokens | ~400 |

The tool finds **where** to look. You (or the agent) still read source for **how** something works — but with far less wasted context.

---

### Also in 1.1.0

- `demo-rn-app/` sample project and website sandbox data
- [GUIDE.md](./GUIDE.md) — full walkthrough
- README sections for Feature 1a, 1c, 1d
- GitHub Actions workflow for npm publish (`NPM_TOKEN` secret)
- Ollama provider for local LLM compression

---

## [1.0.0] — 2026-05-14

- AST code intelligence graph (TypeScript + Roslyn .NET)
- Prompt optimization and terminal compression
- 18 MCP tools, Cursor / Kiro / Claude Desktop integration

---

## Links

| | |
|---|---|
| Live website | [prmargas.com/projects/rn-token-optimizer](https://prmargas.com/projects/rn-token-optimizer/) |
| GitHub | [github.com/Pradeep241094/rn-token-optimizer](https://github.com/Pradeep241094/rn-token-optimizer) |
| Guide | [GUIDE.md](./GUIDE.md) |
