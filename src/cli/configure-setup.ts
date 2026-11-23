import { createInterface } from 'node:readline/promises';
import type { Readable, Writable } from 'node:stream';
import { windowDisplayName } from '../shared/display.js';
import { selectCapturedWindows } from '../shared/capture.js';
import type { CapturePreview } from '../shared/dbus-responses.js';
import {
  layoutWindowsInApplyOrder,
  type LayoutFile,
} from '../shared/layout.js';
import { result, type OperationResult } from '../shared/result.js';
import { callExtension, quoteDbusString } from './extension-client.js';
import type { SetupOptions } from './setup.js';

type Terminal = {
  input: Readable & { isTTY?: boolean };
  output: Writable & { isTTY?: boolean };
};

export async function configureSetup(
  options: SetupOptions,
  { input, output }: Terminal = {
    input: process.stdin,
    output: process.stdout,
  },
): Promise<OperationResult> {
  if (!input.isTTY || !output.isTTY) {
    return result(
      ['--configure requires an interactive terminal (stdin and stdout).'],
      [],
    );
  }

  const preview = callExtension<CapturePreview>('PreviewSetup', [
    quoteDbusString(options.name),
    String(options.includeMinimized),
    String(options.force),
  ]);
  if (!preview.ok) {
    return preview;
  }
  if (preview.layout === undefined) {
    return result(['The extension returned no capture preview.'], []);
  }

  const terminal = createInterface({ input, output, terminal: true });
  const pending: string[] = [];
  let waiting: ((value: string | null) => void) | null = null;
  let closed = false;

  terminal.on('line', (line) => {
    // readline emits a partial final line on EOF, without an Enter key.
    if (input.readableEnded) {
      return;
    }

    const value = line.trim();
    if (waiting !== null) {
      const resolve = waiting;
      waiting = null;
      resolve(value);
    } else {
      pending.push(value);
    }
  });
  terminal.on('close', () => {
    closed = true;
    if (waiting !== null) {
      const resolve = waiting;
      waiting = null;
      resolve(null);
    }
  });
  terminal.on('SIGINT', () => {
    output.write('\n');
    terminal.close();
  });
  const ask = (prompt: string): Promise<string | null> =>
    new Promise((resolve) => {
      output.write(prompt);
      if (pending.length > 0) {
        resolve(pending.shift() ?? null);
        return;
      }

      if (closed) {
        resolve(null);
        return;
      }

      waiting = resolve;
    });

  try {
    output.write(
      `Configure layout "${terminalText(options.name)}". Live windows will not be changed.\n`,
    );
    while (true) {
      printWindows(preview.layout, output);
      const answer = await ask('Windows to keep (e.g. 1,3; all; cancel): ');
      if (answer === null || answer.toLowerCase() === 'cancel') {
        return cancelled();
      }

      let selected: LayoutFile;
      try {
        selected = selectCapturedWindows(
          preview.layout,
          selectionIndices(
            answer,
            layoutWindowsInApplyOrder(preview.layout).length,
          ),
        );
      } catch (error) {
        output.write(
          `${error instanceof Error ? error.message : String(error)}\n`,
        );
        continue;
      }

      output.write(
        `\nSelected ${layoutWindowsInApplyOrder(selected).length} window(s):\n`,
      );
      printWindows(selected, output);
      const confirmation = await ask('Save this layout? [y/N/edit]: ');
      if (confirmation?.toLowerCase() === 'edit') {
        continue;
      }
      if (confirmation === null || !/^(y|yes)$/i.test(confirmation)) {
        return cancelled();
      }

      return callExtension('SaveSetup', [
        quoteDbusString(JSON.stringify(selected)),
        String(options.force),
      ]);
    }
  } finally {
    terminal.close();
  }
}

function selectionIndices(answer: string, count: number): number[] {
  if (answer.toLowerCase() === 'all') {
    return Array.from({ length: count }, (_, index) => index);
  }
  if (answer === '') {
    return [];
  }
  return answer
    .split(/[,\s]+/)
    .map((number) => (/^\d+$/.test(number) ? Number(number) - 1 : NaN));
}

function printWindows(layout: LayoutFile, output: Writable): void {
  layoutWindowsInApplyOrder(layout).forEach((target, index) => {
    const window = target.window;
    const displayName = windowDisplayName(window);
    const application = window.appId ?? window.command ?? displayName;
    const title = window.title ?? window.label ?? '(untitled)';
    const workspace =
      target.kind === 'sticky'
        ? 'all workspaces (sticky)'
        : target.workspaceName;
    output.write(
      `  ${index + 1}. ${terminalText(application)} | ${terminalText(title)} | ${terminalText(workspace)} | monitor ${window.monitor} | ${window.minimized ? 'minimized' : 'visible'}\n`,
    );
  });
}

function terminalText(value: string): string {
  return value.replace(/[\p{Cc}\p{Cf}]/gu, ' ');
}

function cancelled(): OperationResult {
  return result(['Setup cancelled. No layout was written.'], []);
}
