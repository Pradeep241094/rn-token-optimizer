/**
 * rn-token-optimizer-mcp entry point
 *
 * Without arguments:  start stdio MCP server (used by Cursor/Kiro/Claude Desktop)
 *
 * With arguments — CLI mode (call any MCP tool directly, no IDE needed):
 *
 *   rn-token-optimizer-mcp <tool_name> ['{"arg": "val", ...}']
 *   rn-token-optimizer-mcp list
 *   rn-token-optimizer-mcp help
 *
 * Examples:
 *   rn-token-optimizer-mcp list
 *   rn-token-optimizer-mcp index_repository
 *   rn-token-optimizer-mcp index_repository '{"root_dir": "/path/to/project"}'
 *   rn-token-optimizer-mcp search_graph '{"name_pattern": "Login", "label": "Screen"}'
 *   rn-token-optimizer-mcp trace_call_path '{"function_name": "handleGoogleLogin", "direction": "inbound"}'
 *   rn-token-optimizer-mcp get_architecture
 *   rn-token-optimizer-mcp find_dead_code
 */

import { startMCPServer, callTool, TOOLS } from './server.js';

const [, , firstArg, secondArg] = process.argv;

// No arguments → start MCP server
if (!firstArg) {
  startMCPServer().catch((err) => {
    process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
} else {
  // CLI mode — call a single tool and print JSON output
  runCLI(firstArg, secondArg).catch((err) => {
    process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}

async function runCLI(toolName: string, argsJson?: string): Promise<void> {
  // ── List all tools ────────────────────────────────────────────────────────
  if (toolName === 'list' || toolName === '--list') {
    const maxLen = Math.max(...TOOLS.map(t => t.name.length));
    console.log('\nAvailable tools:\n');
    for (const t of TOOLS) {
      const desc = t.description?.split('\n')[0].slice(0, 70) ?? '';
      console.log(`  ${t.name.padEnd(maxLen + 2)} ${desc}`);
    }
    console.log('');
    console.log('Usage:');
    console.log('  rn-token-optimizer-mcp <tool_name> [\'{"arg": "value"}\']');
    console.log('');
    return;
  }

  // ── Help ──────────────────────────────────────────────────────────────────
  if (toolName === 'help' || toolName === '--help' || toolName === '-h') {
    const tool = TOOLS.find(t => t.name === (secondArg ?? ''));
    if (tool) {
      console.log(`\n${tool.name}`);
      console.log(`  ${tool.description}`);
      console.log('\n  Parameters:');
      const props = (tool.inputSchema as { properties?: Record<string, { type: string; description?: string }> })?.properties ?? {};
      for (const [k, v] of Object.entries(props)) {
        console.log(`    ${k} (${v.type})  ${v.description ?? ''}`);
      }
      console.log('');
    } else {
      console.log('\nUsage:');
      console.log('  rn-token-optimizer-mcp <tool_name> [\'{"arg": "value"}\']');
      console.log('  rn-token-optimizer-mcp list');
      console.log('  rn-token-optimizer-mcp help <tool_name>');
      console.log('\nExamples:');
      console.log('  rn-token-optimizer-mcp index_repository');
      console.log('  rn-token-optimizer-mcp search_graph \'{"name_pattern": "Login"}\'');
      console.log('  rn-token-optimizer-mcp trace_call_path \'{"function_name": "handleAuth", "direction": "inbound"}\'');
      console.log('  rn-token-optimizer-mcp get_architecture');
      console.log('  rn-token-optimizer-mcp find_dead_code');
      console.log('  rn-token-optimizer-mcp detect_changes \'{"diff_text": "$(git diff HEAD)"}\'');
      console.log('');
    }
    return;
  }

  // ── Validate tool name ────────────────────────────────────────────────────
  const known = TOOLS.find(t => t.name === toolName);
  if (!known) {
    // Suggest close matches
    const suggestions = TOOLS
      .map(t => t.name)
      .filter(n => n.startsWith(toolName) || n.includes(toolName));

    process.stderr.write(`Unknown tool: "${toolName}"\n`);
    if (suggestions.length > 0) {
      process.stderr.write(`Did you mean: ${suggestions.join(', ')}?\n`);
    }
    process.stderr.write('Run: rn-token-optimizer-mcp list\n');
    process.exit(1);
  }

  // ── Parse args ────────────────────────────────────────────────────────────
  let args: Record<string, unknown> = {};
  if (argsJson) {
    try {
      args = JSON.parse(argsJson) as Record<string, unknown>;
    } catch {
      process.stderr.write(`Invalid JSON for arguments: ${argsJson}\n`);
      process.exit(1);
    }
  }

  // ── Call tool ─────────────────────────────────────────────────────────────
  const result = await callTool(toolName, args);
  const text = result.content[0]?.text ?? '{}';

  // Pretty-print if JSON, otherwise raw
  try {
    const parsed = JSON.parse(text) as unknown;
    console.log(JSON.stringify(parsed, null, 2));
  } catch {
    console.log(text);
  }
}
