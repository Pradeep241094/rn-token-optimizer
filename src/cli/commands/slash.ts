import chalk from 'chalk';
import { loadActiveMemory } from '../../dsl/memory.js';
import { buildSlashCommandPrompt } from '../../core/promptBuilder.js';

export function runSlashCommand(projectName?: string): void {
  const memory = loadActiveMemory();
  const prompt = buildSlashCommandPrompt(memory, projectName ?? 'this project');

  // Print to stdout so it can be copied or piped
  process.stdout.write(prompt + '\n');

  process.stderr.write(
    '\n' +
      chalk.dim('─'.repeat(60)) +
      '\n' +
      chalk.cyan('✓ Copy the above block and paste it into your Claude/Codex/Cursor thread.\n') +
      chalk.gray('  The agent will adopt rn-token-optimizer DSL language for the entire session.\n') +
      chalk.dim('─'.repeat(60)) +
      '\n',
  );
}
