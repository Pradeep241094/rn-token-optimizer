import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { select, input, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import type { AppConfig, AnthropicModel } from '../../types/index.js';
import { DEFAULT_CONFIG } from '../../types/index.js';
import { AVAILABLE_MODELS } from '../../llm/anthropic.js';

const CONFIG_DIR = path.join(os.homedir(), '.rn-token-optimizer');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

export function loadConfig(): AppConfig | null {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return null;
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as AppConfig;
  } catch {
    return null;
  }
}

export function saveConfig(config: AppConfig): void {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

export function requireConfig(): AppConfig {
  const config = loadConfig();
  if (!config) {
    console.error(
      chalk.red(
        'rn-token-optimizer is not configured. Run `rn-token-optimizer` to complete onboarding.',
      ),
    );
    process.exit(1);
  }
  return config;
}

export async function runOnboarding(): Promise<AppConfig> {
  console.log(chalk.bold.cyan('\n🔥 rn-token-optimizer — React Native Token Optimizer\n'));
  console.log(
    chalk.gray(
      'Compresses Metro, Jest, and crash output into Military-English DSL via Claude.\n' +
        'Saves up to 99% of tokens for AI coding agents.\n',
    ),
  );

  const existing = loadConfig();
  if (existing) {
    const reconfig = await confirm({
      message: chalk.yellow('Configuration already exists. Reconfigure?'),
      default: false,
    });
    if (!reconfig) {
      console.log(chalk.green('✓ Using existing configuration.'));
      printNextSteps();
      return existing;
    }
  }

  // API key
  const envKey = process.env.ANTHROPIC_API_KEY;
  let anthropicApiKey: string;

  if (envKey) {
    const useEnv = await confirm({
      message: `ANTHROPIC_API_KEY found in environment. Use it?`,
      default: true,
    });
    anthropicApiKey = useEnv ? envKey : await promptApiKey();
  } else {
    anthropicApiKey = await promptApiKey();
  }

  // Model selection
  const model = await select<AnthropicModel>({
    message: 'Select default model:',
    choices: AVAILABLE_MODELS.map((m) => ({ value: m.value, name: m.name })),
    default: DEFAULT_CONFIG.model,
  });

  // Scope
  const defaultScope = await select<'global' | 'project'>({
    message: 'Default DSL scope for learned entries:',
    choices: [
      { value: 'project', name: 'project  (stored in .rn-token-optimizer/dsl.json)' },
      { value: 'global', name: 'global   (stored in ~/.rn-token-optimizer/dsl.json)' },
    ],
    default: 'project',
  });

  const config: AppConfig = {
    anthropicApiKey,
    model,
    defaultScope,
    promotionThreshold: DEFAULT_CONFIG.promotionThreshold,
    pruneAfterDays: DEFAULT_CONFIG.pruneAfterDays,
    learnThreadMinUses: DEFAULT_CONFIG.learnThreadMinUses,
  };

  saveConfig(config);
  console.log(chalk.green(`\n✓ Configuration saved to ${CONFIG_PATH}`));
  printNextSteps();

  return config;
}

async function promptApiKey(): Promise<string> {
  return input({
    message: 'Anthropic API key (sk-ant-...):',
    validate: (v) => v.startsWith('sk-ant-') || 'Must start with sk-ant-',
  });
}

function printNextSteps(): void {
  console.log(chalk.bold('\n📋 Next steps:\n'));
  console.log(chalk.cyan('  Pipe command output:'));
  console.log('    npx jest 2>&1 | rn-token-optimizer "Which tests failed?"');
  console.log('    npx react-native run-android 2>&1 | rn-token-optimizer "Did the build succeed?"\n');
  console.log(chalk.cyan('  Get the agent slash command:'));
  console.log('    rn-token-optimizer slash\n');
  console.log(chalk.cyan('  Manage DSL memory:'));
  console.log('    rn-token-optimizer dsl show\n');
}
