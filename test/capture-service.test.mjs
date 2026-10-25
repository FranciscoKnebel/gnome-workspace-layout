import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  capturedWindowDetails,
  getWindows,
  layoutExists,
  writeLayout,
  getWorkspaceName,
} = vi.hoisted(() => ({
  capturedWindowDetails: vi.fn(),
  getWindows: vi.fn(),
  getWorkspaceName: vi.fn(),
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
  getWorkspaceName,
  isStickyWindow: () => false,
}));

const { captureLayout, previewSetup } =
  await import('../src/extension/capture-service.js');

describe('captureLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWindows.mockReturnValue([]);
    getWorkspaceName.mockReturnValue('Workspace 1');
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
      errors: [
        'Skipped window without app id or command: Unidentified window',
        'layout must define at least one workspace or sticky window',
      ],
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

describe('workspace name regression through preview, selection and save', () => {
  beforeEach(() => vi.clearAllMocks());
  it.each(['constructor', 'toString', '__proto__'])(
    'preserves %s without window mutation',
    async (name) => {
      const { selectSetupWindows } =
        await import('../src/shared/setup-selection.js');
      const { saveSetup } = await import('../src/extension/setup-service.js');
      getWorkspaceName.mockReturnValue(name);
      layoutExists.mockReturnValue(false);
      const window = Object.freeze({
        minimized: true,
        get_workspace: () => ({}),
      });
      getWindows.mockReturnValue([window, window]);
      capturedWindowDetails.mockReturnValue({
        appId: 'org.gnome.Calculator.desktop',
        monitorIndex: 0,
        rect: { x: 0, y: 0, width: 960, height: 1080 },
        title: 'Calculator',
      });
      const preview = previewSetup('test', true);
      expect(preview.ok).toBe(true);
      expect(writeLayout).not.toHaveBeenCalled();
      const original = JSON.stringify(preview.layout);
      const selected = selectSetupWindows(JSON.parse(original), [1]);
      expect(Object.keys(selected.workspaces)).toEqual([name]);
      expect(selected.workspaces[name].windows).toHaveLength(1);
      expect(selected.workspaces[name].windows[0].minimized).toBe(true);
      expect(saveSetup(JSON.stringify(selected), false).ok).toBe(true);
      expect(writeLayout).toHaveBeenCalledWith('test', selected);
      expect(JSON.stringify(preview.layout)).toBe(original);
    },
  );
});
