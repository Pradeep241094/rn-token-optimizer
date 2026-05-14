/**
 * demo-slash.ts
 *
 * Shows the /rn-token-optimizer slash command that you paste into
 * Claude / Codex / Cursor to enable DSL mode for an entire thread.
 *
 * Run:
 *   npm run demo:slash
 */

import { generateSlashPrompt } from 'rn-token-optimizer';

function divider(char = '─', len = 70): string {
  return char.repeat(len);
}

console.log('\n' + divider('═'));
console.log('  🔥  rn-token-optimizer — Slash Command Demo');
console.log(divider('═'));
console.log('\n  The slash command makes your AI agent adopt DSL language');
console.log('  for an ENTIRE thread, not just a one-shot reply.\n');
console.log('  Paste the block below into Claude / Codex / Cursor:\n');
console.log(divider());

const prompt = generateSlashPrompt('MyShoppingApp');
console.log(prompt);

console.log(divider());
console.log('\n  Once pasted, the agent will respond like this:\n');
console.log('  You ask:');
console.log('    "Why is my FlatList slow on Android?"\n');
console.log('  Agent responds (DSL mode ON):');
console.log('    S=perf FlatList AND');
console.log('    C=missing keyExtractor + no getItemLayout + heavy items');
console.log('    D=add keyExtractor + getItemLayout');
console.log('    D=wrap item w/ React.memo');
console.log('    R=re-render all items on scroll w/o fix');
console.log('    P=perf OK after keyExtractor+memo\n');
console.log('  Instead of 3 paragraphs of prose explanation.\n');
console.log(divider('═'));
console.log('  CLI equivalent: rn-token-optimizer slash --project "MyShoppingApp"');
console.log(divider('═') + '\n');
