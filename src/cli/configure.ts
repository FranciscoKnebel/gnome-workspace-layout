import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { assertLayout, layoutWindowsInApplyOrder } from '../shared/layout.js';
import {
  parseWindowSelection,
  selectSetupWindows,
} from '../shared/setup-selection.js';
import type { SetupOptions } from './setup.js';

type Response = {
  ok: boolean;
  errors: string[];
  messages: string[];
  layout?: unknown;
};
type ExtensionCall = (
  method: string,
  values: Array<string | boolean>,
) => Response;

export async function configureSetup(
  options: SetupOptions,
  call: ExtensionCall,
): Promise<Response> {
  if (!stdin.isTTY || !stdout.isTTY)
    throw new Error('setup --configure requires an interactive terminal');
  const preview = call('PreviewSetup', [
    options.name,
    options.includeMinimized,
  ]);
  if (!preview.ok) return preview;
  assertLayout(preview.layout);
  const layout = preview.layout;
  const targets = layoutWindowsInApplyOrder(layout);
  targets.forEach((target, index) => {
    stdout.write(
      `${index + 1}. [${target.kind === 'sticky' ? 'sticky' : target.workspaceName}] ${target.window.label ?? target.window.appId ?? target.window.command}\n`,
    );
  });
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await prompt.question(
      'Keep windows (all or comma-separated numbers; Enter cancels): ',
    );
    if (answer.trim() === '')
      return {
        ok: true,
        errors: [],
        messages: ['Cancelled; no layout written.'],
      };
    const selected = selectSetupWindows(
      layout,
      parseWindowSelection(answer, targets.length),
    );
    stdout.write(`${JSON.stringify(selected, null, 2)}\n`);
    const confirmation = await prompt.question(
      `Save ${options.name}${options.force ? ' (replace existing file)' : ''}? [y/N] `,
    );
    if (confirmation.trim().toLowerCase() !== 'y')
      return {
        ok: true,
        errors: [],
        messages: ['Cancelled; no layout written.'],
      };
    return call('SaveSetup', [JSON.stringify(selected), options.force]);
  } finally {
    prompt.close();
  }
}
