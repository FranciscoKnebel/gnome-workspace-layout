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
  getWorkspaceName: () => 'Workspace 1',
  isStickyWindow: () => false,
}));

const { captureLayout } = await import('../src/extension/capture-service.js');

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
});
