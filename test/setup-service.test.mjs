import { beforeEach, describe, expect, it, vi } from 'vitest';

const { layoutExists, writeLayout } = vi.hoisted(() => ({
  layoutExists: vi.fn(),
  writeLayout: vi.fn(),
}));
vi.mock('../src/extension/layout-store.js', () => ({
  layoutExists,
  writeLayout,
}));
const { saveSetup } = await import('../src/extension/setup-service.js');

describe('SaveSetup persistence boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    layoutExists.mockReturnValue(false);
    writeLayout.mockReturnValue('/layouts/test.json');
  });

  for (const group of ['workspace', 'sticky']) {
    for (const [field, value] of [
      ['minimized', 'yes'],
      ['title', 123],
      ['label', []],
    ]) {
      it.each([false, true])(
        `rejects ${group} ${field} before writing (force=%s)`,
        (force) => {
          layoutExists.mockReturnValue(force);
          const window = {
            command: 'ptyxis --new-window',
            monitor: 0,
            position: 'left',
            [field]: value,
          };
          const layout =
            group === 'sticky'
              ? { name: 'test', workspaces: {}, sticky: [window] }
              : { name: 'test', workspaces: { Dev: { windows: [window] } } };
          expect(saveSetup(JSON.stringify(layout), force).ok).toBe(false);
          expect(writeLayout).not.toHaveBeenCalled();
        },
      );
    }
  }

  it.each([
    {},
    { label: '', title: '', minimized: false },
    { label: 'Terminal', title: 'Dev', minimized: true },
  ])('saves valid optional fields: %j', (fields) => {
    const layout = {
      name: 'test',
      workspaces: {},
      sticky: [
        {
          command: 'ptyxis --new-window',
          monitor: 0,
          position: 'left',
          ...fields,
        },
      ],
    };
    expect(saveSetup(JSON.stringify(layout), false).ok).toBe(true);
    expect(writeLayout).toHaveBeenCalledWith('test', layout);
  });

  it('rejects malformed JSON and path traversal without touching storage', () => {
    expect(saveSetup('{', true).ok).toBe(false);
    expect(
      saveSetup(
        JSON.stringify({
          name: '../test',
          workspaces: { Dev: { windows: [] } },
        }),
        true,
      ).ok,
    ).toBe(false);
    expect(layoutExists).not.toHaveBeenCalled();
    expect(writeLayout).not.toHaveBeenCalled();
  });

  it('requires force to replace, then writes exactly the supplied layout', () => {
    layoutExists.mockReturnValue(true);
    const layout = { name: 'test', workspaces: { Dev: { windows: [] } } };
    expect(saveSetup(JSON.stringify(layout), false).ok).toBe(false);
    expect(writeLayout).not.toHaveBeenCalled();
    expect(saveSetup(JSON.stringify(layout), true).ok).toBe(true);
    expect(writeLayout).toHaveBeenCalledExactlyOnceWith('test', layout);
  });
});
