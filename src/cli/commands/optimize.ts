import chalk from 'chalk';
import ora from 'ora';
import { runPromptOptimizer } from '../../core/promptOptimizer.js';
import { printSavingsToStderr } from '../../core/tokenCounter.js';
import { createAnthropicProvider } from '../../llm/anthropic.js';
import { requireConfig } from './onboard.js';

export async function runOptimizeCommand(verbosePrompt: string): Promise<void> {
  const config = requireConfig();

  if (!verbosePrompt.trim()) {
    console.error(chalk.yellow('No prompt provided.'));
    console.error(chalk.gray('Usage: rn-token-optimizer optimize "Your verbose prompt here"'));
    process.exit(1);
  }

  const spinner = ora({
    text: chalk.gray(`Optimizing prompt with ${config.model}…`),
    stream: process.stderr,
  }).start();

  try {
    const provider = createAnthropicProvider(config.anthropicApiKey, config.model);

    const result = await runPromptOptimizer(verbosePrompt, {
      provider,
      config: { defaultScope: config.defaultScope },
    });

    spinner.stop();

    // Token + cost report to stderr first
    printSavingsToStderr(result.savings, result.model);

    // Optimized prompt to stdout (pipe-friendly — clean, no extra text)
    process.stderr.write(chalk.bold.green('\n✅ Optimized prompt:\n'));
    process.stderr.write(chalk.cyan('   ' + result.optimizedPrompt + '\n\n'));
    process.stdout.write(result.optimizedPrompt + '\n');
  } catch (err) {
    spinner.fail(chalk.red('Prompt optimization failed'));
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(message));
    process.exit(1);
  }
}
