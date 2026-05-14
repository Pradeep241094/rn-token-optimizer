import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { runPromptOptimizer } from '../core/promptOptimizer.js';
import { runDistillPipeline } from '../core/distiller.js';
import { buildSlashCommandPrompt, buildPromptCompressionPrompt, buildCompressionPrompt } from '../core/promptBuilder.js';
import { formatSavingsReport, estimateCost, countTokensSync } from '../core/tokenCounter.js';
import { runProjectIndex, saveProjectIndex, loadProjectContext, loadProjectIndex } from '../core/projectIndexer.js';
import { indexProject } from '../graph/indexer.js';
import {
  searchGraph,
  traceCallPath,
  getArchitecture,
  detectChanges,
  findDeadCode,
  getCodeSnippet,
  simpleQueryGraph,
} from '../graph/query.js';
import { createAnthropicProvider } from '../llm/anthropic.js';
import {
  loadActiveMemory,
  addAlias,
  addMacro,
  pruneStale,
} from '../dsl/memory.js';
import { learnFromDictPlus, promoteEligibleCandidates } from '../dsl/learner.js';
import { BUILTINS } from '../dsl/builtins.js';
import { analyzePromptContext } from '../rn/promptContext.js';

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const TOOLS: Tool[] = [
  {
    name: 'optimize_prompt',
    description:
      'Compress a verbose React Native developer prompt into a lean, token-efficient DSL version before it is sent to an LLM. ' +
      'Use this whenever a user message starts with "rn-token-optimizer" or asks to optimize/compress a prompt. ' +
      'Returns the compressed prompt that should be used as the actual intent.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The verbose prompt to compress',
        },
        scope: {
          type: 'string',
          enum: ['project', 'global'],
          description: 'DSL scope for learning new entries (default: project)',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'compress_output',
    description:
      'Compress noisy React Native terminal output (Metro logs, Jest results, Android/iOS build output, stack traces) ' +
      'into a compact DSL answer to a specific question. ' +
      'Use this when a user pipes command output and asks a question about it.',
    inputSchema: {
      type: 'object',
      properties: {
        output: {
          type: 'string',
          description: 'The raw terminal output to compress',
        },
        question: {
          type: 'string',
          description: 'The question to answer about the terminal output',
        },
        scope: {
          type: 'string',
          enum: ['project', 'global'],
          description: 'DSL scope for learning new entries (default: project)',
        },
      },
      required: ['output', 'question'],
    },
  },
  {
    name: 'get_slash_prompt',
    description:
      'Get the /rn-token-optimizer system prompt to paste into an AI agent thread. ' +
      'Once the agent receives this prompt, it will adopt Military-English DSL language for the entire session.',
    inputSchema: {
      type: 'object',
      properties: {
        projectName: {
          type: 'string',
          description: 'Optional project name to include in the prompt',
        },
      },
    },
  },
  {
    name: 'dsl_show',
    description:
      'Show the current DSL memory: project aliases, learned terms, macros, and optionally candidates. ' +
      'Use this to see what shorthand terms are currently active for this project.',
    inputSchema: {
      type: 'object',
      properties: {
        showCandidates: {
          type: 'boolean',
          description: 'Include candidate entries (not yet promoted)',
        },
        showBuiltins: {
          type: 'boolean',
          description: 'Include built-in aliases, macros, prefixes',
        },
      },
    },
  },
  {
    name: 'dsl_add_alias',
    description:
      'Add a project-specific DSL alias so future prompts and outputs are compressed using it. ' +
      'Example: dsl_add_alias("AUTHSVC", "AuthenticationService") means AUTHSVC will replace that term in all compressions.',
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Short uppercase alias key (e.g. AUTHSVC, CARTCTX, PMTFLOW)',
        },
        value: {
          type: 'string',
          description: 'Full term this alias replaces (e.g. AuthenticationService)',
        },
        scope: {
          type: 'string',
          enum: ['project', 'global'],
          description: 'Where to save the alias (default: project)',
        },
        pin: {
          type: 'boolean',
          description: 'Pin this alias so it never expires (default: false)',
        },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'dsl_add_macro',
    description:
      'Add a workflow macro shorthand. Macros are single keys that expand to common RN dev workflow steps.',
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Macro key (e.g. M6, M7)',
        },
        value: {
          type: 'string',
          description: 'What this macro means (e.g. "restart Metro + clear cache")',
        },
        scope: {
          type: 'string',
          enum: ['project', 'global'],
          description: 'Where to save the macro (default: project)',
        },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'dsl_learn',
    description:
      'Learn new DSL candidates from Dict+ entries in text. ' +
      'Dict+ format: "Dict+: KEY=full meaning here". The tool extracts and saves them as project candidates.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text containing Dict+ entries to learn from',
        },
        scope: {
          type: 'string',
          enum: ['project', 'global'],
          description: 'Where to save learned entries (default: project)',
        },
        dryRun: {
          type: 'boolean',
          description: 'Preview what would be learned without saving',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'dsl_promote',
    description:
      'Promote eligible DSL candidates to learned entries. ' +
      'Candidates that have been seen enough times get promoted to active DSL memory.',
    inputSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          enum: ['project', 'global'],
          description: 'Which scope to promote in (default: project)',
        },
        dryRun: {
          type: 'boolean',
          description: 'Preview promotions without saving',
        },
      },
    },
  },
  {
    name: 'index_project',
    description:
      'Scan the current React Native project and build a compact steering document. ' +
      'This document is automatically injected into every subsequent optimize_prompt and compress_output call ' +
      'so the LLM gives project-specific answers (correct file names, components, stack, requirements). ' +
      'Run this once after opening a new project, or after major structural changes. ' +
      'Also use this to retrieve the current project context if it already exists.',
    inputSchema: {
      type: 'object',
      properties: {
        rootDir: {
          type: 'string',
          description: 'Absolute path to the project root (default: current working directory)',
        },
        force: {
          type: 'boolean',
          description: 'Re-index even if a recent index already exists (default: false)',
        },
      },
    },
  },
  // ── Code Intelligence ──────────────────────────────────────────────────────
  {
    name: 'index_repository',
    description:
      'Full AST index of the React Native project — parses every TypeScript/TSX/JS/JSX file, ' +
      'extracts functions, classes, interfaces, screens, hooks, navigators, and ' +
      'builds a persistent knowledge graph (SQLite) of CALLS, IMPORTS, RENDERS, and NAVIGATES_TO edges. ' +
      'Run this once at the start of a session and again after major structural changes. ' +
      'Dramatically reduces token usage for subsequent structural queries: ' +
      'one graph query replaces dozens of file reads.',
    inputSchema: {
      type: 'object',
      properties: {
        rootDir: { type: 'string', description: 'Absolute path to the project root (default: cwd)' },
        force:   { type: 'boolean', description: 'Re-index even if a graph already exists' },
      },
    },
  },
  {
    name: 'search_graph',
    description:
      'Search the knowledge graph for nodes (functions, screens, hooks, classes, navigators…) by name pattern, label, or file. ' +
      'Returns qualified names, signatures, file paths, caller/callee counts. ' +
      'Use this instead of grep to find where code is defined — ~50x fewer tokens.',
    inputSchema: {
      type: 'object',
      properties: {
        name_pattern: { type: 'string', description: 'Substring to match against node names (case-insensitive)' },
        label: {
          type: 'string',
          enum: ['Function', 'Screen', 'Hook', 'Class', 'Interface', 'Type', 'Component', 'Navigator', 'Provider', 'Slice', 'File'],
          description: 'Filter to this node type only',
        },
        file_pattern: { type: 'string', description: 'Substring to match against file paths' },
        exported:     { type: 'boolean', description: 'Only return exported symbols' },
        limit:        { type: 'number', description: 'Max results (default 20)' },
        root_dir:     { type: 'string', description: 'Project root (default: cwd)' },
      },
    },
  },
  {
    name: 'trace_call_path',
    description:
      'BFS call chain traversal — who calls a function (inbound) and/or what it calls (outbound). ' +
      'Use this to understand the impact of a change or trace an execution path. ' +
      'Returns the full call tree with file paths and line numbers. ' +
      'Replaces reading 10-20 files to manually trace calls.',
    inputSchema: {
      type: 'object',
      properties: {
        function_name: { type: 'string', description: 'Function/component name to trace' },
        direction: {
          type: 'string',
          enum: ['inbound', 'outbound', 'both'],
          description: 'inbound=who calls this, outbound=what this calls, both=full tree (default: both)',
        },
        depth:    { type: 'number', description: 'BFS depth 1-5 (default: 3)' },
        root_dir: { type: 'string', description: 'Project root (default: cwd)' },
      },
      required: ['function_name'],
    },
  },
  {
    name: 'get_architecture',
    description:
      'One-call codebase overview: entry points, screen list, navigator tree, hotspots by call frequency, ' +
      'dead code count, RN stack aliases, and node/edge statistics. ' +
      'Use at the start of a session to orient the agent before any coding task.',
    inputSchema: {
      type: 'object',
      properties: {
        root_dir: { type: 'string', description: 'Project root (default: cwd)' },
      },
    },
  },
  {
    name: 'detect_changes',
    description:
      'Accepts raw git diff text, maps changed lines to the affected graph nodes (functions, screens, etc.), ' +
      'and returns a risk-classified list of symbols with their blast radius (how many callers are affected). ' +
      'Use before committing or as a pre-PR review step.',
    inputSchema: {
      type: 'object',
      properties: {
        diff_text: { type: 'string', description: 'Raw output of git diff (or git diff HEAD)' },
        root_dir:  { type: 'string', description: 'Project root (default: cwd)' },
      },
      required: ['diff_text'],
    },
  },
  {
    name: 'find_dead_code',
    description:
      'Returns functions, hooks, screens, and components with zero callers, excluding known entry points. ' +
      'Use periodically to identify code to remove.',
    inputSchema: {
      type: 'object',
      properties: {
        root_dir: { type: 'string', description: 'Project root (default: cwd)' },
      },
    },
  },
  {
    name: 'get_code_snippet',
    description:
      'Read the source code for a specific function or component by its qualified name ' +
      '(format: "src/screens/Login.tsx:handleAuth" or just the function name). ' +
      'Returns file path, line range, and source text. ' +
      'More token-efficient than reading the whole file.',
    inputSchema: {
      type: 'object',
      properties: {
        qualified_name: { type: 'string', description: 'Qualified name or plain function name to look up' },
        root_dir:       { type: 'string', description: 'Project root (default: cwd)' },
      },
      required: ['qualified_name'],
    },
  },
  {
    name: 'query_graph',
    description:
      'Execute a Cypher-lite structural query against the knowledge graph. ' +
      'Supports: MATCH (n:Label) [WHERE n.prop = "val"] RETURN n.name [LIMIT n] ' +
      'and MATCH (f:Label)-[:EDGE_TYPE]->(g) WHERE f.name = "x" RETURN g.name. ' +
      'Returns a table of results.',
    inputSchema: {
      type: 'object',
      properties: {
        query:    { type: 'string', description: 'Cypher-lite query string' },
        root_dir: { type: 'string', description: 'Project root (default: cwd)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'dsl_prune',
    description: 'Remove stale, unpinned DSL aliases and expired candidates that have not been used recently.',
    inputSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          enum: ['project', 'global'],
          description: 'Which scope to prune (default: project)',
        },
        days: {
          type: 'number',
          description: 'Prune entries not seen in this many days (default: 30)',
        },
        dryRun: {
          type: 'boolean',
          description: 'Preview what would be pruned without deleting',
        },
      },
    },
  },
];

// ─── Shared tool dispatcher ───────────────────────────────────────────────────
// Exported so both the MCP server and CLI mode can use the same logic.

export async function callTool(name: string, a: Record<string, unknown>): Promise<ReturnType<typeof ok>> {
  const apiKey    = process.env.ANTHROPIC_API_KEY ?? '';
  const passthrough = !apiKey;

  try {
    switch (name) {
        // ── optimize_prompt ───────────────────────────────────────────────────
        case 'optimize_prompt': {
          const verbosePrompt = str(a.prompt);

          if (passthrough) {
            // Deterministic analysis — no API call needed
            const context = analyzePromptContext(verbosePrompt);
            const memory = loadActiveMemory();
            const { systemPrompt } = buildPromptCompressionPrompt(verbosePrompt, memory, context);
            const tokensBefore = countTokensSync(verbosePrompt).tokens;

            return ok({
              mode: 'passthrough',
              original_prompt: verbosePrompt,
              tokens_before: tokensBefore,
              domains_detected: context.domains,
              verbosity_score: context.verbosityScore,
              // The IDE's own AI executes this compression using its subscription
              compression_instruction: systemPrompt,
              ide_action: [
                'You (the IDE AI) must now compress the original_prompt using the compression_instruction above.',
                'Apply the DSL rules, aliases, and negation defaults described.',
                'Return ONLY the compressed prompt — no commentary, no markdown.',
                'Then estimate tokens_after and compute saved_pct = ((tokens_before - tokens_after) / tokens_before * 100).',
                'Finally display the Token Optimization Report as specified in your steering/rule file.',
              ].join('\n'),
              note: 'No ANTHROPIC_API_KEY found — running in passthrough mode. The IDE AI compresses the prompt using its own subscription. To use a dedicated Anthropic key instead, add it to your MCP env config.',
            });
          }

          const provider = createAnthropicProvider(apiKey);
          const result = await runPromptOptimizer(verbosePrompt, {
            provider,
            config: { defaultScope: scope(a.scope) },
          });
          const cost = estimateCost(result.savings, provider.model);
          const report = formatSavingsReport(result.savings, provider.model);
          return ok({
            mode: 'direct',
            optimized_prompt: result.optimizedPrompt,
            original_prompt: result.originalPrompt,
            domains_detected: result.context.domains,
            tokens_before: result.savings.before.tokens,
            tokens_after: result.savings.after.tokens,
            tokens_saved: result.savings.savedTokens,
            saved_pct: result.savedPct,
            cost_before_usd: cost.costBefore,
            cost_after_usd: cost.costAfter,
            cost_saved_usd: cost.costSaved,
            cost_saved_per_100_prompts_usd: cost.per100Prompts,
            cost_saved_per_1000_prompts_usd: cost.per1000Prompts,
            model: provider.model,
            report,
          });
        }

        // ── compress_output ───────────────────────────────────────────────────
        case 'compress_output': {
          const rawOutput = str(a.output);
          const question  = str(a.question);

          if (passthrough) {
            const memory = loadActiveMemory();
            const { systemPrompt } = buildCompressionPrompt(rawOutput, question, memory);
            const tokensBefore = countTokensSync(rawOutput).tokens;

            return ok({
              mode: 'passthrough',
              original_output_tokens: tokensBefore,
              question,
              compression_instruction: systemPrompt,
              ide_action: [
                'You (the IDE AI) must now answer the question by compressing the raw terminal output.',
                'Apply the DSL rules described in compression_instruction.',
                'Return a compact DSL answer — no commentary, no markdown.',
                'Then estimate tokens_after and display the Token Optimization Report.',
              ].join('\n'),
              note: 'No ANTHROPIC_API_KEY — running in passthrough mode. IDE AI performs the compression.',
            });
          }

          const provider = createAnthropicProvider(apiKey);
          const result = await runDistillPipeline(rawOutput, {
            provider,
            question,
            config: { defaultScope: scope(a.scope) },
          });
          const cost = estimateCost(result.savings, provider.model);
          const report = formatSavingsReport(result.savings, provider.model);
          return ok({
            mode: 'direct',
            answer: result.output,
            tokens_before: result.savings.before.tokens,
            tokens_after: result.savings.after.tokens,
            tokens_saved: result.savings.savedTokens,
            saved_pct: result.savedPct,
            cost_saved_usd: cost.costSaved,
            cost_saved_per_100_prompts_usd: cost.per100Prompts,
            model: provider.model,
            report,
          });
        }

        // ── index_project ─────────────────────────────────────────────────────
        case 'index_project': {
          const rootDir = a.rootDir ? str(a.rootDir) : process.cwd();
          const force   = Boolean(a.force);

          // Return cached index if fresh (< 1 hour) and force not set
          if (!force) {
            const existing = loadProjectIndex(rootDir);
            if (existing) {
              const ageMs = Date.now() - new Date(existing.indexedAt).getTime();
              if (ageMs < 60 * 60 * 1000) {
                const ctx = loadProjectContext(rootDir);
                return ok({
                  status: 'cached',
                  indexed_at: existing.indexedAt,
                  name: existing.name,
                  rn_version: existing.rnVersion,
                  stack_aliases: existing.stack
                    .filter(d => d.dslAlias)
                    .map(d => `${d.dslAlias}=${d.name.split('/').pop()}`),
                  requirement_files: existing.requirementFiles.map(r => r.path),
                  key_files: existing.keyFiles,
                  stats: existing.stats,
                  context_doc: ctx ?? '',
                  message: `Using cached index from ${new Date(existing.indexedAt).toLocaleTimeString()}. Pass force=true to re-index.`,
                });
              }
            }
          }

          const idx = runProjectIndex({ rootDir });
          saveProjectIndex(idx, rootDir);
          const ctxTokens = countTokensSync(idx.contextDoc).tokens;

          return ok({
            status: 'indexed',
            indexed_at: idx.indexedAt,
            name: idx.name,
            rn_version: idx.rnVersion,
            stack_aliases: idx.stack
              .filter(d => d.dslAlias)
              .map(d => `${d.dslAlias}=${d.name.split('/').pop()}`),
            requirement_files: idx.requirementFiles.map(r => ({
              path: r.path,
              type: r.type,
              tokens: r.tokens,
              summary: r.summary,
            })),
            key_files: idx.keyFiles,
            custom_alias_candidates: idx.customAliases,
            stats: idx.stats,
            context_doc_tokens: ctxTokens,
            context_doc: idx.contextDoc,
            message:
              `Project "${idx.name}" indexed. ` +
              `${idx.stats.totalFiles} files, ~${idx.stats.totalTokens.toLocaleString()} tokens, ` +
              `${idx.requirementFiles.length} requirement files found. ` +
              `Context document (${ctxTokens} tokens) will be injected into all future optimize_prompt / compress_output calls.`,
          });
        }

        // ── get_slash_prompt ──────────────────────────────────────────────────
        case 'get_slash_prompt': {
          const memory = loadActiveMemory();
          const prompt = buildSlashCommandPrompt(memory, a.projectName ? str(a.projectName) : undefined);
          return ok({ slash_prompt: prompt });
        }

        // ── dsl_show ──────────────────────────────────────────────────────────
        case 'dsl_show': {
          const memory = loadActiveMemory();
          const result: Record<string, unknown> = {
            aliases: memory.aliases,
            learned: memory.learned,
            macros: memory.macros,
            defaults: memory.defaults,
          };
          if (a.showCandidates) result.candidates = memory.candidates;
          if (a.showBuiltins) {
            result.builtins = {
              prefixes: BUILTINS.prefixes,
              aliases: BUILTINS.aliases,
              macros: BUILTINS.macros,
              defaults: BUILTINS.defaults,
            };
          }
          return ok(result);
        }

        // ── dsl_add_alias ─────────────────────────────────────────────────────
        case 'dsl_add_alias': {
          const key = str(a.key).toUpperCase();
          addAlias(key, str(a.value), scope(a.scope), Boolean(a.pin));
          return ok({ success: true, message: `Alias added: ${key} = ${str(a.value)} [${scope(a.scope)}]` });
        }

        // ── dsl_add_macro ─────────────────────────────────────────────────────
        case 'dsl_add_macro': {
          addMacro(str(a.key), str(a.value), scope(a.scope));
          return ok({ success: true, message: `Macro added: ${str(a.key)} = ${str(a.value)} [${scope(a.scope)}]` });
        }

        // ── index_repository ──────────────────────────────────────────────────
        case 'index_repository': {
          const rootDir = a.root_dir ? str(a.root_dir) : process.cwd();
          const result  = await indexProject({ rootDir, force: Boolean(a.force) });
          return ok({
            status:         'indexed',
            name:           result.name,
            root_dir:       result.rootDir,
            indexed_at:     result.indexedAt,
            node_count:     result.nodeCount,
            edge_count:     result.edgeCount,
            file_count:     result.fileCount,
            duration_ms:    result.durationMs,
            screens:        result.screens.map(s => ({ name: s.name, file: s.filePath })),
            hotspots:       result.hotspots.map(h => ({ name: h.node.name, callers: h.inDegree })),
            message:
              `Indexed "${result.name}": ${result.fileCount} files, ${result.nodeCount} nodes, ` +
              `${result.edgeCount} edges in ${result.durationMs}ms. ` +
              `Use search_graph, trace_call_path, or get_architecture for structural queries.`,
          });
        }

        // ── search_graph ──────────────────────────────────────────────────────
        case 'search_graph': {
          const rootDir = a.root_dir ? str(a.root_dir) : process.cwd();
          const results = searchGraph(
            {
              namePattern: a.name_pattern ? str(a.name_pattern) : undefined,
              label:       a.label as import('../graph/types.js').NodeLabel | undefined,
              filePattern: a.file_pattern ? str(a.file_pattern) : undefined,
              exported:    typeof a.exported === 'boolean' ? a.exported : undefined,
              limit:       typeof a.limit === 'number' ? a.limit : 20,
            },
            rootDir,
          );
          return ok({
            count: results.length,
            results: results.map(r => ({
              name:           r.node.name,
              label:          r.node.label,
              qualified_name: r.node.qualifiedName,
              file:           r.node.filePath + ':' + r.node.lineStart,
              signature:      r.node.signature,
              callers:        r.callerCount,
              callees:        r.calleeCount,
              exported:       r.node.exported,
            })),
          });
        }

        // ── trace_call_path ───────────────────────────────────────────────────
        case 'trace_call_path': {
          const rootDir   = a.root_dir ? str(a.root_dir) : process.cwd();
          const direction = (a.direction as 'inbound' | 'outbound' | 'both') ?? 'both';
          const depth     = typeof a.depth === 'number' ? a.depth : 3;
          const result    = traceCallPath(str(a.function_name), direction, depth, rootDir);
          if (!result) {
            return ok({ found: false, message: `No node found for "${str(a.function_name)}". Run index_repository first or check the name.` });
          }
          const flattenTrace = (nodes: import('../graph/types.js').TraceNode[], d = 0): unknown[] =>
            nodes.flatMap(tn => [
              { name: tn.node.name, label: tn.node.label, file: tn.node.filePath + ':' + tn.node.lineStart, edge: tn.edgeType, depth: d },
              ...flattenTrace(tn.children, d + 1),
            ]);
          return ok({
            found:    true,
            root:     { name: result.root.name, label: result.root.label, file: result.root.filePath + ':' + result.root.lineStart },
            inbound:  flattenTrace(result.inbound),
            outbound: flattenTrace(result.outbound),
          });
        }

        // ── get_architecture ─────────────────────────────────────────────────
        case 'get_architecture': {
          const rootDir = a.root_dir ? str(a.root_dir) : process.cwd();
          const report  = getArchitecture(rootDir);
          if (!report) {
            return ok({ found: false, message: 'No graph index found. Run index_repository first.' });
          }
          return ok({
            project:     report.projectName,
            indexed_at:  report.indexedAt,
            stats:       report.stats,
            rn_stack:    report.rnStack,
            entry_points: report.entryPoints.map(n => ({ name: n.name, file: n.filePath })),
            screens:     report.screens.map(n => ({ name: n.name, file: n.filePath })),
            navigators:  report.navigators.map(n => ({ name: n.name, file: n.filePath })),
            hotspots:    report.hotspots.map(h => ({ name: h.node.name, callers: h.inDegree, file: h.node.filePath })),
            dead_code_count: report.deadCodeCount,
          });
        }

        // ── detect_changes ────────────────────────────────────────────────────
        case 'detect_changes': {
          const rootDir = a.root_dir ? str(a.root_dir) : process.cwd();
          const impacts = detectChanges(str(a.diff_text), rootDir);
          return ok({
            affected_count: impacts.length,
            impacts: impacts.map(i => ({
              symbol:       i.changedSymbol.name,
              label:        i.changedSymbol.label,
              file:         i.changedSymbol.filePath + ':' + i.changedSymbol.lineStart,
              risk:         i.risk,
              blast_radius: i.blastRadius,
              callers:      i.affectedCallers.map(c => c.name),
            })),
          });
        }

        // ── find_dead_code ────────────────────────────────────────────────────
        case 'find_dead_code': {
          const rootDir = a.root_dir ? str(a.root_dir) : process.cwd();
          const entries = findDeadCode(rootDir);
          return ok({
            count: entries.length,
            dead_code: entries.slice(0, 50).map(e => ({
              name:   e.node.name,
              label:  e.node.label,
              file:   e.node.filePath + ':' + e.node.lineStart,
              reason: e.reason,
            })),
          });
        }

        // ── get_code_snippet ──────────────────────────────────────────────────
        case 'get_code_snippet': {
          const rootDir = a.root_dir ? str(a.root_dir) : process.cwd();
          const snippet = getCodeSnippet(str(a.qualified_name), rootDir);
          if (!snippet) {
            return ok({ found: false, message: `No node found for "${str(a.qualified_name)}". Try search_graph first.` });
          }
          return ok({
            found:          true,
            qualified_name: snippet.qualifiedName,
            file:           snippet.filePath,
            line_start:     snippet.lineStart,
            line_end:       snippet.lineEnd,
            language:       snippet.language,
            source:         snippet.source,
          });
        }

        // ── query_graph ───────────────────────────────────────────────────────
        case 'query_graph': {
          const rootDir = a.root_dir ? str(a.root_dir) : process.cwd();
          const result  = simpleQueryGraph(str(a.query), rootDir);
          return ok({
            columns: result.columns,
            rows:    result.rows,
            count:   result.rows.length,
          });
        }

        // ── dsl_learn ─────────────────────────────────────────────────────────
        case 'dsl_learn': {
          const result = learnFromDictPlus(str(a.text), scope(a.scope), Boolean(a.dryRun));
          return ok({ added: result.added, rejected: result.rejected, dry_run: Boolean(a.dryRun) });
        }

        // ── dsl_promote ───────────────────────────────────────────────────────
        case 'dsl_promote': {
          const threshold = 3;
          const result = promoteEligibleCandidates(threshold, scope(a.scope), Boolean(a.dryRun));
          return ok({ promoted: result.promoted, skipped: result.skipped, dry_run: Boolean(a.dryRun) });
        }

        // ── dsl_prune ─────────────────────────────────────────────────────────
        case 'dsl_prune': {
          const days = typeof a.days === 'number' ? a.days : 30;
          const pruned = pruneStale(days, scope(a.scope), Boolean(a.dryRun));
          return ok({ pruned, count: pruned.length, dry_run: Boolean(a.dryRun) });
        }

        default:
          return error(`Unknown tool: ${name}`);
      }
    } catch (err) {
      return error(err instanceof Error ? err.message : String(err));
    }
}

// ─── Server factory ───────────────────────────────────────────────────────────

export function createMCPServer(): Server {
  const server = new Server(
    { name: 'rn-token-optimizer', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return callTool(name, (args ?? {}) as Record<string, unknown>);
  });

  return server;
}

// ─── Start server (stdio transport) ──────────────────────────────────────────

export async function startMCPServer(): Promise<void> {
  const server = createMCPServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  const mode = process.env.ANTHROPIC_API_KEY
    ? 'direct mode (Anthropic API)'
    : 'passthrough mode (IDE AI handles compression — no API key required)';
  process.stderr.write(`rn-token-optimizer MCP server running — ${mode}\n`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  if (typeof v === 'string') return v;
  throw new Error(`Expected string, got ${typeof v}`);
}

function scope(v: unknown): 'global' | 'project' {
  return v === 'global' ? 'global' : 'project';
}

function ok(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

function error(message: string) {
  return {
    content: [{ type: 'text' as const, text: `Error: ${message}` }],
    isError: true,
  };
}

// Kept for any future callers that explicitly require a key
function _missingApiKey() {
  return error(
    'ANTHROPIC_API_KEY is not set. The server runs in passthrough mode by default.\n' +
    'To use a dedicated key: add "env": { "ANTHROPIC_API_KEY": "sk-ant-..." } to your mcp.json (Cursor/Kiro) ' +
    'or claude_desktop_config.json (Claude Desktop).',
  );
}
// suppress unused warning — available for future use
void _missingApiKey;
