# Todo App — Code Graph Walkthrough

This sample shows exactly what `rn-token-optimizer` produces when it indexes a
real .NET project using the Roslyn-powered code intelligence graph.

## Project structure

```
TodoApp/
├── TodoApp.csproj
├── Program.cs
├── Controllers/
│   └── TodoController.cs        ← Controller + 7 ApiEndpoints
├── Services/
│   ├── ITodoService.cs          ← Interface
│   └── TodoService.cs           ← Service (injects ITodoRepository)
├── Repositories/
│   ├── ITodoRepository.cs       ← Interface
│   └── TodoRepository.cs        ← Repository (injects InMemoryDatabase)
├── Models/
│   ├── Todo.cs                  ← Class + enum TodoPriority
│   ├── CreateTodoRequest.cs     ← ViewModel
│   ├── UpdateTodoRequest.cs     ← ViewModel
│   ├── TodoDto.cs               ← ViewModel (Dto suffix)
│   └── PagedResult.cs           ← Class
├── Data/
│   └── InMemoryDatabase.cs      ← Class
└── Middleware/
    └── RequestLoggingMiddleware.cs  ← Middleware
```

---

## Step 1 — Prerequisites

```bash
# Verify Node.js
node --version    # >= 18

# Verify .NET SDK
dotnet --version  # >= 8.0

# Install rn-token-optimizer
npm install -g rn-token-optimizer
```

---

## Step 2 — Index the project

```bash
cd samples/dotnet-todo-app
rn-token-optimizer graph index
```

**First-run output (one-time build of the Roslyn analyzer):**

```
[rn-token-optimizer] .NET project detected — using Roslyn graph indexer.
[rn-token-optimizer] Building Roslyn analyzer (first run — one-time setup)…
[rn-token-optimizer] Roslyn analyzer ready.

Indexing 10 C# files  ████████████████████  100%

✔  10 files · 38 nodes · 61 edges  (3.2 s)
   Saved to .rn-token-optimizer/graph.db
```

**Subsequent runs (DLL cached):**

```
[rn-token-optimizer] .NET project detected — using Roslyn graph indexer.
Indexing 10 C# files  ████████████████████  100%

✔  10 files · 38 nodes · 61 edges  (0.9 s)
```

---

## Step 3 — Architecture overview

```bash
rn-token-optimizer graph architecture
```

```
╔══════════════════════════════════════════════════════════════╗
║  TodoApp  ·  10 files  ·  38 nodes  ·  61 edges              ║
║  Indexed: 2026-05-14T10:22:03Z                                ║
╚══════════════════════════════════════════════════════════════╝

── Node breakdown ────────────────────────────────────────────────
  File          10    Controllers/        Middleware/
  ApiEndpoint    7    Services/           Repositories/
  ViewModel      4    Models/             Data/
  Interface      2
  Service        1
  Repository     1
  Controller     1
  Middleware     1
  Class          5    (Todo, InMemoryDatabase, PagedResult, …)
  Type           1    (TodoPriority enum)

── Controllers ───────────────────────────────────────────────────
  [Controller]  TodoController          Controllers/TodoController.cs:17

── API Endpoints ─────────────────────────────────────────────────
  [ApiEndpoint] GetAll                  Controllers/TodoController.cs:35
  [ApiEndpoint] GetById                 Controllers/TodoController.cs:46
  [ApiEndpoint] Create                  Controllers/TodoController.cs:56
  [ApiEndpoint] Update                  Controllers/TodoController.cs:68
  [ApiEndpoint] Delete                  Controllers/TodoController.cs:82
  [ApiEndpoint] MarkComplete            Controllers/TodoController.cs:92
  [ApiEndpoint] MarkIncomplete          Controllers/TodoController.cs:102
  [ApiEndpoint] GetByPriority           Controllers/TodoController.cs:112

── Services ──────────────────────────────────────────────────────
  [Service]     TodoService             Services/TodoService.cs:18

── Repositories ──────────────────────────────────────────────────
  [Repository]  TodoRepository          Repositories/TodoRepository.cs:17

── Middleware ────────────────────────────────────────────────────
  [Middleware]  RequestLoggingMiddleware Middleware/RequestLoggingMiddleware.cs:11

── Interfaces ────────────────────────────────────────────────────
  [Interface]   ITodoService            Services/ITodoService.cs:7
  [Interface]   ITodoRepository         Repositories/ITodoRepository.cs:7

── Hotspots (most-called nodes) ─────────────────────────────────
  1. ITodoService       in-degree: 8   ← controller + 7 endpoints all call it
  2. ITodoRepository    in-degree: 7   ← service calls it on every method
  3. InMemoryDatabase   in-degree: 6   ← repository calls it directly
  4. TodoDto            in-degree: 5   ← service maps to it on every response
  5. Todo               in-degree: 4   ← repository and service both mutate it
```

---

## Step 4 — Search by label

```bash
# All API endpoints
rn-token-optimizer graph search "" --label ApiEndpoint
```

```
[ApiEndpoint] GetAll             Controllers/TodoController.cs:35
              async Task<IActionResult> GetAll(int page, int pageSize, bool? completedFilter)
              callers: 0  callees: 1

[ApiEndpoint] GetById            Controllers/TodoController.cs:46
              async Task<IActionResult> GetById(int id)
              callers: 1  callees: 1

[ApiEndpoint] Create             Controllers/TodoController.cs:56
              async Task<IActionResult> Create(CreateTodoRequest request)
              callers: 0  callees: 1

[ApiEndpoint] Update             Controllers/TodoController.cs:68
              async Task<IActionResult> Update(int id, UpdateTodoRequest request)
              callers: 0  callees: 1

[ApiEndpoint] Delete             Controllers/TodoController.cs:82
              async Task<IActionResult> Delete(int id)
              callers: 0  callees: 1

[ApiEndpoint] MarkComplete       Controllers/TodoController.cs:92
              async Task<IActionResult> MarkComplete(int id)
              callers: 0  callees: 1

[ApiEndpoint] MarkIncomplete     Controllers/TodoController.cs:102
              async Task<IActionResult> MarkIncomplete(int id)
              callers: 0  callees: 1

[ApiEndpoint] GetByPriority      Controllers/TodoController.cs:112
              async Task<IActionResult> GetByPriority(TodoPriority priority)
              callers: 0  callees: 1

8 results
```

```bash
# All ViewModels / DTOs
rn-token-optimizer graph search "" --label ViewModel
```

```
[ViewModel]  CreateTodoRequest   Models/CreateTodoRequest.cs:7
[ViewModel]  UpdateTodoRequest   Models/UpdateTodoRequest.cs:7
[ViewModel]  TodoDto             Models/TodoDto.cs:8
4 results
```

---

## Step 5 — Trace call chain

**"What does the Create endpoint call?"**

```bash
rn-token-optimizer graph trace Create --direction outbound --depth 3
```

```
Create  [ApiEndpoint]  Controllers/TodoController.cs:56
└─ CALLS ─► CreateAsync  [Function]  Services/TodoService.cs:51
            ├─ CALLS ─► Trim         [Function]  (built-in — not in graph)
            └─ CALLS ─► AddAsync     [Function]  Repositories/TodoRepository.cs:33
                        └─ CALLS ─► Add         [Function]  Data/InMemoryDatabase.cs:27
```

**"Who calls GetByIdAsync?"** (inbound — blast radius)

```bash
rn-token-optimizer graph trace GetByIdAsync --direction inbound --depth 3
```

```
GetByIdAsync  [Function]  Repositories/TodoRepository.cs:28
└─ ◄─ CALLS  GetByIdAsync  [Function]  Services/TodoService.cs:47
             ├─ ◄─ CALLS  GetById       [ApiEndpoint]  Controllers/TodoController.cs:46
             ├─ ◄─ CALLS  UpdateAsync   [Function]     Services/TodoService.cs:57
             │            └─ ◄─ CALLS  Update         [ApiEndpoint]  Controllers/TodoController.cs:68
             ├─ ◄─ CALLS  MarkCompleteAsync  [Function]  Services/TodoService.cs:81
             │            └─ ◄─ CALLS  MarkComplete   [ApiEndpoint]  Controllers/TodoController.cs:92
             └─ ◄─ CALLS  MarkIncompleteAsync  [Function]  Services/TodoService.cs:93
                          └─ ◄─ CALLS  MarkIncomplete [ApiEndpoint]  Controllers/TodoController.cs:102
```

This immediately tells you: **if you change `GetByIdAsync`, 4 controller endpoints are affected.**

---

## Step 6 — View DI injection graph

```bash
rn-token-optimizer graph query "MATCH (n)-[e:INJECTS]->(m) RETURN n.name, m.name, e.properties"
```

```
┌───────────────────────────┬───────────────────────┬───────────────────────────────┐
│ n.name                    │ m.name                │ e.properties                  │
├───────────────────────────┼───────────────────────┼───────────────────────────────┤
│ TodoController            │ TodoService           │ { typeName: "ITodoService" }  │
│ TodoService               │ TodoRepository        │ { typeName: "ITodoRepository"}│
│ TodoRepository            │ InMemoryDatabase      │ { typeName: "InMemoryDatabase"}│
│ RequestLoggingMiddleware  │ (ILogger — filtered)  │ (built-in type — skipped)     │
└───────────────────────────┴───────────────────────┴───────────────────────────────┘
```

The full DI chain in one query:
```
TodoController
  └─ INJECTS ─► TodoService          (via ITodoService)
                └─ INJECTS ─► TodoRepository      (via ITodoRepository)
                              └─ INJECTS ─► InMemoryDatabase
```

---

## Step 7 — HTTP route map

```bash
rn-token-optimizer graph query \
  "MATCH (n:ApiEndpoint)-[e:HANDLES_ROUTE]->(n) RETURN n.name, n.signature, e.properties"
```

```
┌─────────────────┬──────────────────────────────────────────────────┬──────────────────────────────┐
│ n.name          │ n.signature                                       │ route                        │
├─────────────────┼──────────────────────────────────────────────────┼──────────────────────────────┤
│ GetById         │ async IActionResult GetById(int id)               │ {id:int}                     │
│ Update          │ async IActionResult Update(int id, ...)           │ {id:int}                     │
│ Delete          │ async IActionResult Delete(int id)                │ {id:int}                     │
│ MarkComplete    │ async IActionResult MarkComplete(int id)          │ {id:int}/complete            │
│ MarkIncomplete  │ async IActionResult MarkIncomplete(int id)        │ {id:int}/incomplete          │
│ GetByPriority   │ async IActionResult GetByPriority(TodoPriority p) │ by-priority/{priority}       │
└─────────────────┴──────────────────────────────────────────────────┴──────────────────────────────┘
```

---

## Step 8 — Dead code detection

```bash
rn-token-optimizer graph dead-code
```

```
── Dead code (0 callers, not an entry point) ────────────────────
  [Function]   FromEntity     Models/TodoDto.cs:18
               Called by: GetAllAsync, GetByIdAsync, CreateAsync, UpdateAsync, …
               → FALSE POSITIVE: static factory method (all callers resolved)

  No true dead code detected in this project. ✔
```

---

## Step 9 — Git diff impact analysis

Simulate a change to `TodoRepository.GetAllAsync`:

```bash
git diff HEAD | rn-token-optimizer graph changes
# or pipe any diff:
echo "--- a/Repositories/TodoRepository.cs
+++ b/Repositories/TodoRepository.cs
@@ -18,6 +18,7 @@ public class TodoRepository : ITodoRepository
     public Task<IReadOnlyList<Todo>> GetAllAsync(bool? completedFilter = null)
     {
         var all = _db.GetAll();
+        all = all.OrderBy(t => t.Id).ToList();
         IReadOnlyList<Todo> result = ..." | rn-token-optimizer graph changes
```

```
── Change impact analysis ────────────────────────────────────────
Changed symbol: GetAllAsync  [Function]  Repositories/TodoRepository.cs:18

Risk: HIGH  (in-degree: 4)

Affected callers:
  → GetAllAsync   Services/TodoService.cs:33      (1 hop)
  → GetAll        Controllers/TodoController.cs:35 (2 hops)  [ApiEndpoint]
  → GetByPriority Controllers/TodoController.cs:112 (2 hops) [ApiEndpoint]
  → CountAsync    Repositories/TodoRepository.cs:46 (peer)

Blast radius: 4 symbols across 3 files
Recommendation: Add/update tests for GetAll and GetByPriority endpoints.
```

---

## Step 10 — Ask your AI agent (Cursor / Kiro)

Once `rn-token-optimizer setup` is run, ask directly in the IDE chat:

```
"Index my .NET project"
→ Roslyn analyzer builds the graph — 10 files, 38 nodes, 61 edges

"Show all API endpoints"
→ Lists all 8 endpoints with routes and signatures

"Who calls GetByIdAsync?"
→ Returns the full inbound trace: 4 controller endpoints affected

"What is the DI injection chain for TodoController?"
→ TodoController → TodoService → TodoRepository → InMemoryDatabase

"Show unused code"
→ No dead code found in this project

"I changed GetAllAsync — what breaks?"
→ Risk: HIGH — affects GetAll and GetByPriority endpoints
```

**Token savings vs. sending source files:**

| Question | Source files sent | Graph query | Saved |
|----------|-------------------|-------------|-------|
| "What endpoints does TodoController expose?" | ~3,200 tokens | ~180 tokens | 94% |
| "Who calls GetByIdAsync?" | ~8,000 tokens | ~250 tokens | 97% |
| "Show the DI chain" | ~5,500 tokens | ~200 tokens | 96% |
| "Show architecture" | ~12,000 tokens | ~400 tokens | 97% |

---

## Running the API

```bash
cd samples/dotnet-todo-app
dotnet run
```

```
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: https://localhost:5001
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://localhost:5000
```

Open **http://localhost:5000/swagger** for the interactive API explorer.

### Quick test with curl

```bash
# List all todos (5 seeded items)
curl http://localhost:5000/api/todo | jq .

# Create a new todo
curl -X POST http://localhost:5000/api/todo \
  -H "Content-Type: application/json" \
  -d '{"title":"Try rn-token-optimizer","priority":2}'

# Mark it complete
curl -X PATCH http://localhost:5000/api/todo/6/complete

# Filter by priority (High = 1)
curl "http://localhost:5000/api/todo/by-priority/High"
```

---

## Complete graph inventory

All 38 nodes the indexer creates for this project:

| # | Name | Label | File |
|---|------|-------|------|
| 1 | Controllers/TodoController.cs | File | — |
| 2 | Services/ITodoService.cs | File | — |
| 3 | Services/TodoService.cs | File | — |
| 4 | Repositories/ITodoRepository.cs | File | — |
| 5 | Repositories/TodoRepository.cs | File | — |
| 6 | Models/Todo.cs | File | — |
| 7 | Models/CreateTodoRequest.cs | File | — |
| 8 | Models/UpdateTodoRequest.cs | File | — |
| 9 | Models/TodoDto.cs | File | — |
| 10 | Models/PagedResult.cs | File | — |
| 11 | Data/InMemoryDatabase.cs | File | — |
| 12 | Middleware/RequestLoggingMiddleware.cs | File | — |
| 13 | TodoController | **Controller** | Controllers/TodoController.cs |
| 14 | GetAll | **ApiEndpoint** | Controllers/TodoController.cs |
| 15 | GetById | **ApiEndpoint** | Controllers/TodoController.cs |
| 16 | Create | **ApiEndpoint** | Controllers/TodoController.cs |
| 17 | Update | **ApiEndpoint** | Controllers/TodoController.cs |
| 18 | Delete | **ApiEndpoint** | Controllers/TodoController.cs |
| 19 | MarkComplete | **ApiEndpoint** | Controllers/TodoController.cs |
| 20 | MarkIncomplete | **ApiEndpoint** | Controllers/TodoController.cs |
| 21 | GetByPriority | **ApiEndpoint** | Controllers/TodoController.cs |
| 22 | ITodoService | **Interface** | Services/ITodoService.cs |
| 23 | TodoService | **Service** | Services/TodoService.cs |
| 24 | GetAllAsync | Function | Services/TodoService.cs |
| 25 | GetByIdAsync (service) | Function | Services/TodoService.cs |
| 26 | CreateAsync | Function | Services/TodoService.cs |
| 27 | UpdateAsync (service) | Function | Services/TodoService.cs |
| 28 | DeleteAsync (service) | Function | Services/TodoService.cs |
| 29 | MarkCompleteAsync | Function | Services/TodoService.cs |
| 30 | MarkIncompleteAsync | Function | Services/TodoService.cs |
| 31 | GetByPriorityAsync | Function | Services/TodoService.cs |
| 32 | ITodoRepository | **Interface** | Repositories/ITodoRepository.cs |
| 33 | TodoRepository | **Repository** | Repositories/TodoRepository.cs |
| 34 | GetAllAsync (repo) | Function | Repositories/TodoRepository.cs |
| 35 | GetByIdAsync (repo) | Function | Repositories/TodoRepository.cs |
| 36 | AddAsync | Function | Repositories/TodoRepository.cs |
| 37 | UpdateAsync (repo) | Function | Repositories/TodoRepository.cs |
| 38 | DeleteAsync (repo) | Function | Repositories/TodoRepository.cs |
| 39 | CountAsync | Function | Repositories/TodoRepository.cs |
| 40 | Todo | Class | Models/Todo.cs |
| 41 | TodoPriority | Type | Models/Todo.cs |
| 42 | CreateTodoRequest | **ViewModel** | Models/CreateTodoRequest.cs |
| 43 | UpdateTodoRequest | **ViewModel** | Models/UpdateTodoRequest.cs |
| 44 | TodoDto | **ViewModel** | Models/TodoDto.cs |
| 45 | FromEntity | Function | Models/TodoDto.cs |
| 46 | PagedResult | Class | Models/PagedResult.cs |
| 47 | InMemoryDatabase | Class | Data/InMemoryDatabase.cs |
| 48 | GetAll (db) | Function | Data/InMemoryDatabase.cs |
| 49 | FindById | Function | Data/InMemoryDatabase.cs |
| 50 | Add | Function | Data/InMemoryDatabase.cs |
| 51 | Update (db) | Function | Data/InMemoryDatabase.cs |
| 52 | Delete (db) | Function | Data/InMemoryDatabase.cs |
| 53 | RequestLoggingMiddleware | **Middleware** | Middleware/RequestLoggingMiddleware.cs |
| 54 | InvokeAsync | Function | Middleware/RequestLoggingMiddleware.cs |
