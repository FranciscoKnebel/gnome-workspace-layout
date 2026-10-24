import { PassThrough } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LayoutFile } from '../src/shared/layout.js';
import type * as ExtensionClient from '../src/cli/extension-client.js';
import { configureSetup } from '../src/cli/configure-setup.js';

const { callExtension } = vi.hoisted(() => ({ callExtension: vi.fn() }));
vi.mock('../src/cli/extension-client.js', async (importOriginal) => ({
  ...(await importOriginal<typeof ExtensionClient>()),
  callExtension,
}));

const layout: LayoutFile = {
  name: 'trabalho',
  workspaces: {
    Code: {
      windows: [
        {
          appId: 'editor.desktop',
          title: 'Project',
          monitor: 0,
          position: 'left',
        },
        {
          appId: 'terminal.desktop',
          title: 'Server',
          monitor: 1,
          position: 'right',
          minimized: true,
        },
      ],
    },
  },
  sticky: [
    { appId: 'chat.desktop', title: 'Chat', monitor: 1, position: 'center' },
  ],
};

function terminal(answers: string, interactive = true) {
  const input = Object.assign(new PassThrough(), { isTTY: interactive });
  const output = Object.assign(new PassThrough(), { isTTY: interactive });
  let text = '';
  output.on('data', (chunk) => {
    text += chunk.toString();
  });
  input.end(answers);
  return { input, output, text: () => text };
}

const options = {
  name: 'trabalho',
  configure: true,
  includeMinimized: true,
  force: true,
};

describe('configureSetup', () => {
  beforeEach(() => {
    callExtension.mockReset();
    callExtension
      .mockReturnValueOnce({ ok: true, errors: [], messages: [], layout })
      .mockReturnValue({
        ok: true,
        errors: [],
        messages: ['Wrote /layouts/trabalho.json'],
      });
  });

  it('previews windows, selects a subset, and saves only after confirmation', async () => {
    const io = terminal('2,3\ny\n');

    const saved = await configureSetup(options, io);

    expect(saved.ok).toBe(true);
    expect(callExtension.mock.calls[0]).toEqual([
      'PreviewSetup',
      ['"trabalho"', 'true', 'true'],
    ]);
    const [method, args] = callExtension.mock.calls[1];
    expect(method).toBe('SaveSetup');
    expect(JSON.parse(JSON.parse(args[0]))).toEqual({
      name: 'trabalho',
      workspaces: { Code: { windows: [layout.workspaces.Code.windows[1]] } },
      sticky: layout.sticky,
    });
    expect(args[1]).toBe('true');
    expect(io.text()).toContain('editor.desktop');
    expect(io.text()).toContain('Project');
    expect(io.text()).toContain('Code');
    expect(io.text()).toContain('monitor 1');
    expect(io.text()).toContain('minimized');
    expect(io.text()).toContain('sticky');
    expect(io.text()).toContain('Save this layout?');
  });

  it('allows revising the selection before saving', async () => {
    const io = terminal('all\nedit\n3\nyes\n');

    expect(
      (
        await configureSetup(
          { ...options, force: false, includeMinimized: false },
          io,
        )
      ).ok,
    ).toBe(true);

    expect(callExtension.mock.calls[0][1]).toEqual([
      '"trabalho"',
      'false',
      'false',
    ]);
    const [, args] = callExtension.mock.calls[1];
    expect(JSON.parse(JSON.parse(args[0]))).toEqual({
      name: 'trabalho',
      workspaces: {},
      sticky: layout.sticky,
    });
    expect(args[1]).toBe('false');
    expect(io.text()).toContain('Selected 3 window(s)');
    expect(io.text()).toContain('Selected 1 window(s)');
  });

  it.each([
    ['cancel selection', 'cancel\n'],
    ['reject confirmation', '1\nn\n'],
    ['default confirmation to no', '1\n\n'],
    ['EOF during selection', ''],
    ['EOF during confirmation', '1\n'],
    ['Ctrl+C during selection', '\x03'],
  ])('does not save on %s', async (_, answers) => {
    const io = terminal(answers);

    const cancelled = await configureSetup(options, io);

    expect(cancelled.ok).toBe(false);
    expect(cancelled.errors).toContain(
      'Setup cancelled. No layout was written.',
    );
    expect(callExtension).toHaveBeenCalledTimes(1);
    expect(io.input.listenerCount('keypress')).toBe(0);
  });

  it.each(['', '0', '4', '1.5', '1,garbage'])(
    'rejects invalid selection "%s" before confirmation',
    async (selection) => {
      const io = terminal(`${selection}\n`);

      expect((await configureSetup(options, io)).ok).toBe(false);
      expect(callExtension).toHaveBeenCalledTimes(1);
      expect(io.text()).not.toContain('Save this layout?');
    },
  );

  it('accepts a corrected selection after reporting invalid input', async () => {
    const io = terminal('0\n2\ny\n');

    expect((await configureSetup(options, io)).ok).toBe(true);
    expect(io.text()).toContain('Selection contains an invalid window number.');
    expect(callExtension).toHaveBeenCalledTimes(2);
  });

  it.each(['input', 'output'] as const)(
    'requires interactive %s without calling the extension',
    async (stream) => {
      const io = terminal('all\ny\n');
      io[stream].isTTY = false;

      const response = await configureSetup(options, io);

      expect(response.ok).toBe(false);
      expect(response.errors[0]).toContain('requires an interactive terminal');
      expect(callExtension).not.toHaveBeenCalled();
    },
  );

  it('does not prompt or save after a failed capture', async () => {
    const failed = {
      ok: false,
      errors: ['Capture incomplete'],
      messages: [],
      layout,
    };
    callExtension.mockReset().mockReturnValue(failed);
    const io = terminal('all\ny\n');

    expect(await configureSetup(options, io)).toEqual(failed);
    expect(callExtension).toHaveBeenCalledTimes(1);
    expect(io.text()).toBe('');
  });

  it('reports a save failure without claiming success', async () => {
    const failed = {
      ok: false,
      errors: ['Layout already exists'],
      messages: [],
    };
    callExtension
      .mockReset()
      .mockReturnValueOnce({ ok: true, errors: [], messages: [], layout })
      .mockReturnValueOnce(failed);

    expect(await configureSetup(options, terminal('all\ny\n'))).toEqual(failed);
  });

  it('sanitizes window metadata for display without changing saved titles', async () => {
    const unsafeLayout = structuredClone(layout);
    unsafeLayout.workspaces.Code.windows[0].title =
      'Title\x1b[2J\n"quoted" \\ path';
    callExtension
      .mockReset()
      .mockReturnValueOnce({
        ok: true,
        errors: [],
        messages: [],
        layout: unsafeLayout,
      })
      .mockReturnValueOnce({ ok: true, errors: [], messages: [] });
    const io = terminal('1\ny\n');

    expect((await configureSetup(options, io)).ok).toBe(true);

    expect(io.text()).not.toContain('\x1b[2J');
    const saved = JSON.parse(JSON.parse(callExtension.mock.calls[1][1][0]));
    expect(saved.workspaces.Code.windows[0].title).toBe(
      unsafeLayout.workspaces.Code.windows[0].title,
    );
  });
});
