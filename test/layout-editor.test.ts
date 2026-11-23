import { describe, expect, it } from 'vitest';
import type { LayoutFile } from '../src/shared/layout.js';
import {
  EDITOR_MIN_SIZE_PX,
  clampEditorRect,
  editorPosition,
  editorRect,
  editorTargets,
  hitEditorHandle,
  hitEditorRect,
  moveEditorRect,
  resizeEditorRect,
  withEditorMonitor,
  withEditorPosition,
} from '../src/shared/layout-editor.js';

const monitor = { width: 1920, height: 1080 };

const layout: LayoutFile = {
  name: 'trabalho',
  workspaces: {
    Dev: {
      windows: [
        { command: 'editor', monitor: 0, position: 'left' },
        { command: 'terminal', monitor: 1, position: 'right' },
      ],
    },
  },
  sticky: [{ command: 'music', monitor: 0, position: 'bottom' }],
};

describe('editorTargets', () => {
  it('follows apply order and labels sticky windows', () => {
    expect(editorTargets(layout)).toEqual([
      {
        index: 0,
        kind: 'workspace',
        label: 'editor',
        workspaceLabel: 'Dev',
        monitor: 0,
        position: 'left',
      },
      {
        index: 1,
        kind: 'workspace',
        label: 'terminal',
        workspaceLabel: 'Dev',
        monitor: 1,
        position: 'right',
      },
      {
        index: 2,
        kind: 'sticky',
        label: 'music',
        workspaceLabel: 'All workspaces (sticky)',
        monitor: 0,
        position: 'bottom',
      },
    ]);
  });

  it('prefers an explicit label', () => {
    const copy = JSON.parse(JSON.stringify(layout)) as LayoutFile;
    copy.workspaces.Dev.windows[0].label = 'Code editor';
    expect(editorTargets(copy)[0].label).toBe('Code editor');
  });
});

describe('editorRect and editorPosition', () => {
  it('converts presets and relative rectangles in monitor-local pixels', () => {
    expect(editorRect('full', monitor)).toEqual({
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    });
    expect(editorRect('left', monitor)).toEqual({
      x: 0,
      y: 0,
      width: 960,
      height: 1080,
    });
    expect(
      editorRect({ x: 0.25, y: 0.5, width: 0.5, height: 0.25 }, monitor),
    ).toEqual({ x: 480, y: 540, width: 960, height: 270 });
  });

  it('detects presets when a dragged rectangle matches them', () => {
    expect(editorPosition(editorRect('right', monitor), monitor)).toBe('right');
    expect(editorPosition(editorRect('center', monitor), monitor)).toBe(
      'center',
    );
  });

  it('falls back to a relative rectangle for custom positions', () => {
    const position = editorPosition(
      { x: 100, y: 100, width: 400, height: 300 },
      monitor,
    );

    expect(position).toEqual({
      x: 0.0521,
      y: 0.0926,
      width: 0.2083,
      height: 0.2778,
    });
  });
});

describe('clampEditorRect', () => {
  it('keeps a rectangle inside the monitor with a minimum size', () => {
    expect(
      clampEditorRect({ x: -100, y: -50, width: 10, height: 10 }, monitor),
    ).toEqual({
      x: 0,
      y: 0,
      width: EDITOR_MIN_SIZE_PX,
      height: EDITOR_MIN_SIZE_PX,
    });

    expect(
      clampEditorRect({ x: 3000, y: 2000, width: 5000, height: 5000 }, monitor),
    ).toEqual({
      x: 0,
      y: 0,
      width: monitor.width,
      height: monitor.height,
    });
  });
});

describe('moveEditorRect', () => {
  it('moves a rectangle by a pixel delta', () => {
    const rect = { x: 100, y: 100, width: 400, height: 300 };
    expect(moveEditorRect(rect, 50, -25, monitor)).toEqual({
      x: 150,
      y: 75,
      width: 400,
      height: 300,
    });
  });

  it('keeps the rectangle inside the monitor', () => {
    const rect = { x: 100, y: 100, width: 400, height: 300 };
    expect(moveEditorRect(rect, -500, 5000, monitor)).toEqual({
      x: 0,
      y: 780,
      width: 400,
      height: 300,
    });
  });
});

describe('resizeEditorRect', () => {
  it('resizes from the south-east handle', () => {
    const rect = { x: 100, y: 100, width: 400, height: 300 };
    expect(resizeEditorRect(rect, 'se', 100, 50, monitor)).toEqual({
      x: 100,
      y: 100,
      width: 500,
      height: 350,
    });
  });

  it('resizes from the north-west handle', () => {
    const rect = { x: 100, y: 100, width: 400, height: 300 };
    expect(resizeEditorRect(rect, 'nw', 40, 60, monitor)).toEqual({
      x: 140,
      y: 160,
      width: 360,
      height: 240,
    });
  });

  it('resizes from edge handles', () => {
    const rect = { x: 100, y: 100, width: 400, height: 300 };
    expect(resizeEditorRect(rect, 'e', -100, 0, monitor)).toEqual({
      x: 100,
      y: 100,
      width: 300,
      height: 300,
    });
    expect(resizeEditorRect(rect, 'n', 0, 40, monitor)).toEqual({
      x: 100,
      y: 140,
      width: 400,
      height: 260,
    });
  });

  it('enforces a minimum size and monitor bounds', () => {
    const rect = { x: 100, y: 100, width: 400, height: 300 };
    const resized = resizeEditorRect(rect, 'se', -1000, -1000, monitor);

    expect(resized.width).toBe(EDITOR_MIN_SIZE_PX);
    expect(resized.height).toBe(EDITOR_MIN_SIZE_PX);
    expect(resized.x).toBe(100);
    expect(resized.y).toBe(100);

    const grown = resizeEditorRect(rect, 'se', 5000, 5000, monitor);
    expect(grown).toEqual({ x: 100, y: 100, width: 1820, height: 980 });
  });

  it('handles a monitor smaller than the minimum size', () => {
    const small = { width: 20, height: 20 };
    expect(
      resizeEditorRect(
        { x: 0, y: 0, width: 10, height: 10 },
        'se',
        5,
        5,
        small,
      ),
    ).toEqual({ x: 0, y: 0, width: 20, height: 20 });
  });
});

describe('editor hit testing', () => {
  const rect = { x: 100, y: 100, width: 400, height: 300 };

  it('finds the topmost rectangle under a point', () => {
    const rects = [
      { index: 0, rect },
      { index: 1, rect: { x: 200, y: 150, width: 100, height: 100 } },
    ];

    expect(hitEditorRect(rects, { x: 250, y: 200 })).toBe(1);
    expect(hitEditorRect(rects, { x: 150, y: 120 })).toBe(0);
    expect(hitEditorRect(rects, { x: 10, y: 10 })).toBeNull();
  });

  it('finds corner and edge handles', () => {
    expect(hitEditorHandle(rect, { x: 100, y: 100 }, 8)).toBe('nw');
    expect(hitEditorHandle(rect, { x: 500, y: 400 }, 8)).toBe('se');
    expect(hitEditorHandle(rect, { x: 300, y: 100 }, 8)).toBe('n');
    expect(hitEditorHandle(rect, { x: 500, y: 250 }, 8)).toBe('e');
    expect(hitEditorHandle(rect, { x: 300, y: 250 }, 8)).toBeNull();
  });
});

describe('editor layout updates', () => {
  it('changes the position of one window without mutating the layout', () => {
    const updated = withEditorPosition(layout, 1, {
      x: 0.1,
      y: 0.1,
      width: 0.4,
      height: 0.4,
    });

    expect(updated.workspaces.Dev.windows[1].position).toEqual({
      x: 0.1,
      y: 0.1,
      width: 0.4,
      height: 0.4,
    });
    expect(layout.workspaces.Dev.windows[1].position).toBe('right');
  });

  it('updates sticky windows as well', () => {
    const updated = withEditorPosition(layout, 2, 'full');
    expect(updated.sticky?.[0].position).toBe('full');
  });

  it('changes the monitor of one window', () => {
    const updated = withEditorMonitor(layout, 0, 2);
    expect(updated.workspaces.Dev.windows[0].monitor).toBe(2);
    expect(updated.workspaces.Dev.windows[1].monitor).toBe(1);
  });

  it('rejects an unknown window index', () => {
    expect(() => withEditorPosition(layout, 99, 'full')).toThrow(
      'Window 99 does not exist in this layout.',
    );
  });
});
