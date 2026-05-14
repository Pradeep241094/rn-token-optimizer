import { createInterface } from 'node:readline';
import chalk from 'chalk';
import ora from 'ora';
import { runDistillPipeline } from '../../core/distiller.js';
import { printSavingsToStderr } from '../../core/tokenCounter.js';
import { createAnthropicProvider } from '../../llm/anthropic.js';
import { requireConfig } from './onboard.js';

export async function runDistillCommand(question: string): Promise<void> {
  const config = requireConfig();

  // Read from stdin
  const rawInput = await readStdin();

  if (!rawInput.trim()) {
    console.error(chalk.yellow('No input received on stdin. Pipe command output into rn-token-optimizer.'));
    console.error(chalk.gray('Example: npx jest 2>&1 | rn-token-optimizer "Did tests pass?"'));
    process.exit(1);
  }

  const spinner = ora({
    text: chalk.gray(`Optimizing with ${config.model}…`),
    stream: process.stderr,
  }).start();

  try {
    const provider = createAnthropicProvider(config.anthropicApiKey, config.model);

    const result = await runDistillPipeline(rawInput, {
      provider,
      question,
      config: { defaultScope: config.defaultScope },
    });

    spinner.stop();

    // Token + cost report to stderr
    printSavingsToStderr(result.savings, result.model);

    // Compressed answer to stderr label + stdout (pipe-friendly)
    process.stderr.write(chalk.bold.green('\n✅ Compressed answer:\n'));
    process.stderr.write(chalk.cyan('   ' + result.output.replace(/\n/g, '\n   ') + '\n\n'));
    process.stdout.write(result.output + '\n');
  } catch (err) {
    spinner.fail(chalk.red('Optimization failed'));
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(message));
    process.exit(1);
  }
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }

    const chunks: string[] = [];
    const rl = createInterface({ input: process.stdin });

    rl.on('line', (line) => chunks.push(line));
    rl.on('close', () => resolve(chunks.join('\n')));
  });
}
