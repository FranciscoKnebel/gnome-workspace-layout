import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { configureSetup } from '../src/cli/configure-setup.js';
import { buildLaunchCommand } from '../src/shared/launch-command.js';

const { spawnSync } = vi.hoisted(() => ({ spawnSync: vi.fn() }));
vi.mock('node:child_process', () => ({ spawnSync }));

describe('setup wizard D-Bus transport', () => {
  it('previews and saves captured commands and titles containing apostrophes', async () => {
    // Actual (s) tuple formatting from GLib.g_variant_print(), not JSON quoting.
    const stdout = String.raw`("{\"ok\":true,\"errors\":[],\"messages\":[],\"layout\":{\"name\":\"trabalho\",\"workspaces\":{\"Code\":{\"windows\":[{\"appId\":\"org.gnome.Calculator.desktop\",\"command\":\"gtk-launch 'org.gnome.Calculator'\",\"title\":\"Francisco's Calculator\",\"monitor\":0,\"position\":\"left\"}]}}}}",)`;
    spawnSync
      .mockReturnValueOnce({ status: 0, stdout, stderr: '' })
      .mockReturnValueOnce({
        status: 0,
        stdout: `('{"ok":true,"errors":[],"messages":["Wrote /layouts/trabalho.json"]}',)`,
        stderr: '',
      });
    const input = Object.assign(new PassThrough(), { isTTY: true });
    const output = Object.assign(new PassThrough(), { isTTY: true });
    let text = '';
    output.on('data', (chunk) => {
      text += chunk.toString();
    });
    input.end('1\ny\n');

    const response = await configureSetup(
      {
        name: 'trabalho',
        configure: true,
        force: false,
        includeMinimized: false,
      },
      { input, output },
    );

    expect(response).toEqual({
      ok: true,
      errors: [],
      messages: ['Wrote /layouts/trabalho.json'],
    });
    expect(text).toContain("Francisco's Calculator");
    expect(text).toContain('Save this layout?');
    expect(spawnSync).toHaveBeenCalledTimes(2);
    const [command, args] = spawnSync.mock.calls[1];
    expect(command).toBe('gdbus');
    const methodIndex = args.indexOf('--method') + 1;
    expect(args[methodIndex]).toBe(
      'com.franciscoknebel.WorkspaceLayout.SaveSetup',
    );
    const saved = JSON.parse(JSON.parse(args[methodIndex + 1]));
    expect(saved.workspaces.Code.windows).toEqual([
      {
        appId: 'org.gnome.Calculator.desktop',
        command: buildLaunchCommand({ appId: 'org.gnome.Calculator.desktop' }),
        title: "Francisco's Calculator",
        monitor: 0,
        position: 'left',
      },
    ]);
  });
});
