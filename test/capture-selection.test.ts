import { describe, expect, it } from 'vitest';
import { selectCapturedWindows } from '../src/shared/layout-transform.js';
import type { LayoutFile } from '../src/shared/layout.js';
import { validateLayout } from '../src/shared/layout.js';

const layout: LayoutFile = {
  $schema: 'file:///schema/workspace-layout.schema.json',
  name: 'trabalho',
  workspaces: {
    Code: {
      windows: [
        { appId: 'editor.desktop', monitor: 0, position: 'left' },
        {
          appId: 'terminal.desktop',
          monitor: 1,
          position: 'right',
          minimized: true,
        },
      ],
    },
    Browser: {
      windows: [{ appId: 'browser.desktop', monitor: 0, position: 'full' }],
    },
  },
  sticky: [{ appId: 'chat.desktop', monitor: 1, position: 'center' }],
};

describe('selectCapturedWindows', () => {
  it('keeps selected windows and their state, pruning unselected workspaces', () => {
    const before = structuredClone(layout);

    expect(selectCapturedWindows(layout, [3, 1, 1])).toEqual({
      $schema: layout.$schema,
      name: 'trabalho',
      workspaces: { Code: { windows: [layout.workspaces.Code.windows[1]] } },
      sticky: layout.sticky,
    });
    expect(layout).toEqual(before);
  });

  it.each([
    { name: 'empty', indices: [] },
    { name: 'negative', indices: [-1] },
    { name: 'out of range', indices: [4] },
    { name: 'fractional', indices: [0.5] },
    { name: 'not a number', indices: [NaN] },
  ])('rejects $name selection', ({ indices }) => {
    expect(() => selectCapturedWindows(layout, indices)).toThrow();
  });

  it('supports a sticky-only selection', () => {
    expect(selectCapturedWindows(layout, [3])).toEqual({
      $schema: layout.$schema,
      name: 'trabalho',
      workspaces: {},
      sticky: layout.sticky,
    });
  });

  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty'])(
    'keeps a workspace named %s in the selection',
    (name) => {
      const source: LayoutFile = {
        name: 'trabalho',
        workspaces: {
          [name]: {
            windows: [
              { appId: 'editor.desktop', monitor: 0, position: 'full' },
            ],
          },
        },
      };

      const selected = selectCapturedWindows(source, [0]);

      expect(Object.hasOwn(selected.workspaces, name)).toBe(true);
      expect(Object.keys(selected.workspaces)).toEqual([name]);
      expect(selected.workspaces[name].windows).toEqual(
        source.workspaces[name].windows,
      );
      expect(Object.hasOwn(Object.prototype, 'windows')).toBe(false);
      expect(
        validateLayout(JSON.parse(JSON.stringify(selected))).errors,
      ).toEqual([]);
    },
  );
});
