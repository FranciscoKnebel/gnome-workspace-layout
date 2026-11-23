import { beforeEach, describe, expect, it, vi } from 'vitest';

const { capturedWindowDetails, getWindows, layoutExists, writeLayout } =
  vi.hoisted(() => ({
    capturedWindowDetails: vi.fn(),
    getWindows: vi.fn(),
    layoutExists: vi.fn(),
    writeLayout: vi.fn(),
  }));

vi.mock('../src/extension/layout-store.js', () => ({
  layoutExists,
  writeLayout,
}));

vi.mock('../src/extension/paths.js', () => ({
  schemaUri: () => 'file:///schema/workspace-layout.schema.json',
}));

vi.mock('../src/extension/shell.js', () => ({
  capturedWindowDetails,
  getWindows,
  getMonitorRect: () => ({ x: 0, y: 0, width: 1920, height: 1080 }),
  getWorkspaceName: (workspace) => workspace.name ?? 'Workspace 1',
  isStickyWindow: (window) => Boolean(window.sticky),
}));

const { captureLayout, previewCapture, saveCapture } =
  await import('../src/extension/capture-service.js');

describe('captureLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWindows.mockReturnValue([]);
  });

  it('rejects an existing layout without force', () => {
    layoutExists.mockReturnValue(true);

    expect(captureLayout('trabalho', false, false)).toEqual({
      ok: false,
      errors: [
        'Layout already exists: trabalho. Use --force to replace it or choose another name.',
      ],
      messages: [],
    });
    expect(writeLayout).not.toHaveBeenCalled();
  });

  it('replaces an existing layout with force', () => {
    layoutExists.mockReturnValue(true);
    writeLayout.mockReturnValue('/layouts/trabalho.json');
    getWindows.mockReturnValue([{ get_workspace: () => ({}) }]);
    capturedWindowDetails.mockReturnValue({
      command: 'gnome-terminal',
      monitorIndex: 0,
      rect: { x: 0, y: 0, width: 1920, height: 1080 },
      title: 'Terminal',
      wmClass: 'org.gnome.Terminal',
    });

    expect(captureLayout('trabalho', false, true)).toEqual({
      ok: true,
      errors: [],
      messages: ['Wrote /layouts/trabalho.json'],
    });
    expect(writeLayout).toHaveBeenCalledWith('trabalho', {
      $schema: 'file:///schema/workspace-layout.schema.json',
      name: 'trabalho',
      workspaces: {
        'Workspace 1': {
          windows: [
            {
              command: 'gnome-terminal',
              label: 'Terminal',
              match: { wmClass: 'org.gnome.Terminal' },
              monitor: 0,
              position: 'full',
              title: 'Terminal',
            },
          ],
        },
      },
    });
  });

  it('previews a valid capture without writing a layout', () => {
    layoutExists.mockReturnValue(false);
    getWindows.mockReturnValue([{ get_workspace: () => ({}) }]);
    capturedWindowDetails.mockReturnValue({
      appId: 'org.gnome.Ptyxis.desktop',
      command: 'ptyxis --new-window',
      monitorIndex: 0,
      rect: { x: 0, y: 0, width: 1920, height: 1080 },
      title: 'Terminal',
    });

    const preview = previewCapture('trabalho', false, false);

    expect(preview.ok).toBe(true);
    expect(preview.layout.workspaces['Workspace 1'].windows).toHaveLength(1);
    expect(writeLayout).not.toHaveBeenCalled();
  });

  it('filters preview candidates and preserves minimized and sticky state', () => {
    layoutExists.mockReturnValue(false);
    getWindows.mockReturnValue([
      { get_workspace: () => ({}) },
      { skip_taskbar: true },
      { minimized: true, sticky: true },
    ]);
    capturedWindowDetails.mockReturnValue({
      appId: 'org.gnome.Ptyxis.desktop',
      command: 'ptyxis --new-window',
      monitorIndex: 0,
      rect: { x: 0, y: 0, width: 1920, height: 1080 },
      title: 'Terminal',
    });

    const visible = previewCapture('trabalho', false, false);
    expect(visible.layout.workspaces['Workspace 1'].windows).toHaveLength(1);
    expect(visible.layout.sticky).toBeUndefined();

    const all = previewCapture('trabalho', true, false);
    expect(all.ok).toBe(true);
    expect(all.layout.sticky).toHaveLength(1);
    expect(all.layout.sticky[0].minimized).toBe(true);
    expect(writeLayout).not.toHaveBeenCalled();
  });

  it('does not expose a replaceable preview when a forced capture is incomplete', () => {
    layoutExists.mockReturnValue(true);
    getWindows.mockReturnValue([{ get_workspace: () => ({}) }, {}]);
    capturedWindowDetails
      .mockReturnValueOnce({
        appId: 'org.gnome.Ptyxis.desktop',
        monitorIndex: 0,
        rect: { x: 0, y: 0, width: 1920, height: 1080 },
        title: 'Terminal',
      })
      .mockReturnValueOnce({
        monitorIndex: 0,
        rect: { x: 0, y: 0, width: 1920, height: 1080 },
        title: 'Unidentified window',
      });

    const preview = previewCapture('trabalho', false, true);

    expect(preview.ok).toBe(false);
    expect(preview.layout).toBeUndefined();
    expect(writeLayout).not.toHaveBeenCalled();
  });

  it('saves a confirmed layout without recapturing live windows', () => {
    layoutExists.mockReturnValue(false);
    writeLayout.mockReturnValue('/layouts/trabalho.json');
    const selected = {
      name: 'trabalho',
      workspaces: {},
      sticky: [
        { command: 'ptyxis --new-window', monitor: 0, position: 'left' },
      ],
    };

    expect(saveCapture(JSON.stringify(selected), false)).toEqual({
      ok: true,
      errors: [],
      messages: ['Wrote /layouts/trabalho.json'],
    });
    expect(writeLayout).toHaveBeenCalledWith('trabalho', selected);
    expect(getWindows).not.toHaveBeenCalled();
  });

  it('checks overwrite protection again when saving after a preview', () => {
    const selected = JSON.stringify({
      name: 'trabalho',
      workspaces: {},
      sticky: [
        { command: 'ptyxis --new-window', monitor: 0, position: 'left' },
      ],
    });
    layoutExists.mockReturnValue(true);

    expect(saveCapture(selected, false).ok).toBe(false);
    expect(writeLayout).not.toHaveBeenCalled();

    expect(saveCapture(selected, true).ok).toBe(true);
    expect(writeLayout).toHaveBeenCalledTimes(1);
  });

  it.each([
    'not JSON',
    JSON.stringify({ name: 'trabalho', workspaces: {} }),
    JSON.stringify({ name: 'trabalho', workspaces: { Code: { windows: [] } } }),
    JSON.stringify({
      name: 'trabalho',
      workspaces: {},
      sticky: [{ monitor: 0 }],
    }),
  ])(
    'does not replace a layout with an invalid or empty selection: %s',
    (selected) => {
      layoutExists.mockReturnValue(true);

      expect(saveCapture(selected, true).ok).toBe(false);
      expect(writeLayout).not.toHaveBeenCalled();
    },
  );

  it('preserves an existing layout when a forced capture is incomplete', () => {
    layoutExists.mockReturnValue(true);
    getWindows.mockReturnValue([{}]);
    capturedWindowDetails.mockReturnValue({
      monitorIndex: 0,
      rect: { x: 0, y: 0, width: 1920, height: 1080 },
      title: 'Unidentified window',
    });

    expect(captureLayout('trabalho', false, true)).toEqual({
      ok: false,
      errors: ['Skipped window without app id or command: Unidentified window'],
      messages: [],
    });
    expect(writeLayout).not.toHaveBeenCalled();
  });

  it('writes a new layout after skipping an invalid window', () => {
    layoutExists.mockReturnValue(false);
    writeLayout.mockReturnValue('/layouts/trabalho.json');
    getWindows.mockReturnValue([
      { get_workspace: () => ({}) },
      { get_workspace: () => ({}) },
    ]);
    capturedWindowDetails
      .mockReturnValueOnce({
        command: 'gnome-terminal',
        monitorIndex: 0,
        rect: { x: 0, y: 0, width: 1920, height: 1080 },
        title: 'Terminal',
        wmClass: 'org.gnome.Terminal',
      })
      .mockReturnValueOnce({
        monitorIndex: 0,
        rect: { x: 0, y: 0, width: 1920, height: 1080 },
        title: 'Unidentified window',
      });

    expect(captureLayout('trabalho', false, false)).toEqual({
      ok: false,
      errors: ['Skipped window without app id or command: Unidentified window'],
      messages: ['Wrote /layouts/trabalho.json'],
    });
    expect(writeLayout).toHaveBeenCalledTimes(1);
  });

  it('does not write a new layout when every window is invalid', () => {
    layoutExists.mockReturnValue(false);
    getWindows.mockReturnValue([{}]);
    capturedWindowDetails.mockReturnValue({
      monitorIndex: 0,
      rect: { x: 0, y: 0, width: 1920, height: 1080 },
      title: 'Unidentified window',
    });

    expect(captureLayout('trabalho', false, false)).toEqual({
      ok: false,
      errors: [
        'Skipped window without app id or command: Unidentified window',
        'layout must define at least one workspace or sticky window',
      ],
      messages: [],
    });
    expect(writeLayout).not.toHaveBeenCalled();
  });
});
