import { describe, expect, it } from 'vitest';
import {
  selectSetupWindows,
  parseWindowSelection,
} from '../src/shared/setup-selection.js';
import type { LayoutFile } from '../src/shared/layout.js';

const entry = {
  appId: 'org.gnome.Calculator.desktop',
  monitor: 0,
  position: 'left',
  minimized: true,
  match: { wmClass: 'Calculator' },
};
const preview = JSON.parse(
  JSON.stringify({
    name: 'test',
    workspaces: Object.fromEntries(
      ['constructor', 'toString', '__proto__', 'Dev'].map((name) => [
        name,
        { windows: [entry, { ...entry, title: name }] },
      ]),
    ),
    sticky: [entry, { ...entry, title: 'sticky' }],
  }),
) as LayoutFile;

describe('setup selection', () => {
  it('preserves partial selections, order, states and literal names without modifying the preview', () => {
    const before = JSON.stringify(preview);
    const selected = selectSetupWindows(preview, [9, 7, 4, 2, 0, 0]);
    expect(Object.keys(selected.workspaces)).toEqual([
      'constructor',
      'toString',
      '__proto__',
      'Dev',
    ]);
    expect(selected.workspaces.Dev.windows[0].title).toBe('Dev');
    expect(selected.sticky).toEqual([{ ...entry, title: 'sticky' }]);
    expect(selected.workspaces.__proto__.windows[0]).toEqual(entry);
    selected.workspaces.__proto__.windows[0].match!.wmClass = 'Changed';
    expect(JSON.stringify(preview)).toBe(before);
  });

  it('accepts sticky-only selection', () => {
    expect(selectSetupWindows(preview, [8]).workspaces).toEqual({});
  });

  it('rejects empty or out-of-bounds selections', () => {
    for (const indices of [[], [-1], [10], [0.5]])
      expect(() => selectSetupWindows(preview, indices)).toThrow();
  });

  it('parses human window numbers strictly', () => {
    expect(parseWindowSelection('all', 3)).toEqual([0, 1, 2]);
    expect(parseWindowSelection('3, 1, 1', 3)).toEqual([2, 0]);
    for (const answer of ['0', '4', '1x', '', '1,', '-1'])
      expect(() => parseWindowSelection(answer, 3)).toThrow();
  });
});
