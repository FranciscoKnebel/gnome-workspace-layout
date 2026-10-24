import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import {
  selectCapturedWindows,
  type CapturePreview,
} from '../shared/capture.js';
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
  const answers = terminal[Symbol.asyncIterator]();
  let submittedAnswers = 0;
  terminal.on('line', () => {
    // readline also emits a partial final line on EOF, without an Enter key.
    if (!input.readableEnded) {
      submittedAnswers += 1;
    }
  });
  terminal.on('SIGINT', () => {
    output.write('\n');
    terminal.close();
  });
  const ask = async (prompt: string): Promise<string | null> => {
    terminal.setPrompt(prompt);
    output.write(prompt);
    const answer = await answers.next();
    if (answer.done || submittedAnswers === 0) {
      return null;
    }
    submittedAnswers -= 1;
    return answer.value.trim();
  };

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
    const application =
      window.appId ?? window.command ?? window.label ?? 'Window';
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
