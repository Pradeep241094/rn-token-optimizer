# rn-token-optimizer

> **Cut AI token waste in React Native and .NET projects.**  
> Build a local code intelligence graph, compress prompts and terminal output, and wire it into Cursor, Kiro, or Claude Desktop via MCP — no cloud upload, no extra API key required.

[![npm version](https://img.shields.io/npm/v/rn-token-optimizer.svg)](https://www.npmjs.com/package/rn-token-optimizer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![.NET 8](https://img.shields.io/badge/.NET-8-purple)](https://dotnet.microsoft.com/download)

**[Changelog](./CHANGELOG.md)** · [Live site](https://prmargas.com/projects/rn-token-optimizer/) · [Full guide](./GUIDE.md) · [Setup & MCP](./SETUP.md)

---

## What this project does

AI coding agents burn tokens in three predictable ways: verbose prompts, noisy terminal logs, and reading files one-by-one to answer structural questions. **rn-token-optimizer** addresses all three locally.

| Capability | What you get |
|------------|--------------|
| **Code intelligence graph** | Parses TypeScript/JavaScript (React Native) and C# (.NET via Roslyn) into a persistent SQLite graph of functions, screens, controllers, services, and call relationships |
| **Semantic search** | Find code by concept — `"auth flow"`, `"payment error"` — without knowing exact symbol names (TF-IDF) |
| **Visual explorer** | `graph ui` opens **http://localhost:7842** — interactive force-directed dashboard with search, filters, and source snippets |
| **Live watcher** | `graph watch` re-indexes on save so the graph stays current while you code |
| **Prompt optimization** | Compresses natural-language prompts into a compact Military-English DSL — typically **70–90% fewer tokens** |
| **Terminal compression** | Pipes Metro, Jest, or build output through compression and returns a short DSL answer — typically **95–99% fewer tokens** |
| **MCP server** | 19 tools for your IDE agent: index, search, trace calls, detect diff impact, optimize prompts, and more |

Everything runs on your machine. Graph data lives in `.rn-token-optimizer/graph.db` per project. In **passthrough mode** (default in Cursor/Kiro), compression uses your existing IDE subscription — no Anthropic key needed.

---

## The problem (in one example)

**Verbose prompt** — 44 tokens:
```
I need you to please help me fix the issue in my React Native app where users
are getting an error when trying to log in with their Google account on Android
devices running version 12 or higher
```

**Compressed DSL** — 6 tokens:
```
D=fix A Google login fail AND v12+
```

**File-by-file exploration** — an agent reads ~15 files (~18,000 tokens) to answer “who calls `handleGoogleLogin`?” A single graph query answers the same question in ~300 tokens.

---

## Quick start

### React Native (one command)

```bash
cd /path/to/your-react-native-app
npx rn-token-optimizer setup
```

`setup` detects your IDE, writes MCP config, indexes the project, and prints next steps.

### .NET / C# project

```bash
# Prerequisites: Node.js >= 18 and .NET 8 SDK
npm install -g rn-token-optimizer
cd /path/to/YourDotNetApp
rn-token-optimizer graph index
```

The tool auto-detects `.csproj` / `.sln` files and uses the Roslyn-backed indexer. First run builds the analyzer once (~30 s); later runs reuse the cached DLL.

### Visual graph explorer

```bash
npm install -g rn-token-optimizer
cd /path/to/your-project

rn-token-optimizer graph index    # build SQLite graph
rn-token-optimizer graph ui       # → http://localhost:7842
```

### Install globally (both stacks)

```bash
npm install -g rn-token-optimizer
rn-token-optimizer setup
```

### One-line install script

```bash
curl -fsSL https://raw.githubusercontent.com/Pradeep241094/rn-token-optimizer/main/install.sh | bash
```

---

## Use in your IDE

After `setup`, ask your agent naturally:

```
"Index my project"
"Show my app architecture"
"Who calls handleGoogleLogin?"
"Find all auth-related code"
"What does my current git diff break?"
```

For prompt optimization in Cursor/Kiro, start a message with the keyword:

```
rn-token-optimizer Fix the Google login issue on Android 12 devices
```

| IDE | Config written |
|-----|----------------|
| **Cursor** | `.cursor/mcp.json` + `.cursor/rules/rn-token-optimizer.mdc` |
| **Kiro** | `.kiro/settings/mcp.json` + steering file |
| **Claude Desktop** | `claude_desktop_config.json` (direct API key recommended) |

See [SETUP.md](./SETUP.md) for MCP wiring, DSL reference, and troubleshooting.

---

## CLI essentials

```bash
# Prompt & terminal
rn-token-optimizer optimize "your verbose prompt"
npx jest 2>&1 | rn-token-optimizer "Which tests failed?"

# Graph
rn-token-optimizer graph index
rn-token-optimizer graph architecture
rn-token-optimizer graph search "Login" --label Screen
rn-token-optimizer graph trace handleGoogleLogin --direction inbound
rn-token-optimizer graph semantic "authentication flow"
rn-token-optimizer graph dead-code
rn-token-optimizer graph changes
rn-token-optimizer graph ui
rn-token-optimizer graph watch

# Project context & DSL
rn-token-optimizer index
rn-token-optimizer dsl show
```

Full command list and MCP tool reference: [GUIDE.md](./GUIDE.md).

---

## Sample projects

| Sample | Path | Try it |
|--------|------|--------|
| **React Native demo** | [`demo-rn-app/`](./demo-rn-app/) | `rn-token-optimizer graph index --dir ./demo-rn-app` then `graph ui` |
| **.NET Todo API** | [`samples/dotnet-todo-app/`](./samples/dotnet-todo-app/) | `dotnet run` then `rn-token-optimizer graph index` — see [GRAPH_WALKTHROUGH.md](./samples/dotnet-todo-app/GRAPH_WALKTHROUGH.md) |

---

## Programmatic API

```typescript
import { optimizePrompt, aiTokenOptimizer, countTokensSync } from 'rn-token-optimizer';

const result = await optimizePrompt("Fix Google login on Android 12", {
  apiKey: process.env.ANTHROPIC_API_KEY, // optional in passthrough mode
});
console.log(result.optimizedPrompt); // D=fix A Google login fail AND v12+
```

Types and graph exports are documented in [GUIDE.md](./GUIDE.md#12-all-cli-commands-reference).

---

## Documentation map

| Doc | Contents |
|-----|----------|
| [GUIDE.md](./GUIDE.md) | Complete feature walkthrough, CLI reference, MCP tools, demos |
| [SETUP.md](./SETUP.md) | Installation, IDE integration, DSL system, configuration |
| [CHANGELOG.md](./CHANGELOG.md) | Version history |
| [samples/dotnet-todo-app/GRAPH_WALKTHROUGH.md](./samples/dotnet-todo-app/GRAPH_WALKTHROUGH.md) | Step-by-step .NET graph demo |

---

## License

[MIT](LICENSE) — Copyright © 2026 [Pradeep Margasahayam Prakash](https://github.com/Pradeep241094)
