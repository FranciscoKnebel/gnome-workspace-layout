import { detectPosition, resolvePosition } from './geometry.js';
import type { LayoutFile, WindowPosition } from './layout.js';
import { layoutWindowsInApplyOrder } from './layout.js';

export type EditorRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type EditorMonitor = {
  width: number;
  height: number;
};

export type EditorHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export type EditorTarget = {
  index: number;
  kind: 'workspace' | 'sticky';
  label: string;
  workspaceLabel: string;
  monitor: number;
  position: WindowPosition;
};

export const EDITOR_MIN_SIZE_PX = 40;

export function editorTargets(layout: LayoutFile): EditorTarget[] {
  return layoutWindowsInApplyOrder(layout).map((target, index) => ({
    index,
    kind: target.kind,
    label:
      target.window.label ??
      target.window.title ??
      target.window.appId ??
      target.window.command ??
      'Window',
    workspaceLabel:
      target.kind === 'sticky'
        ? 'All workspaces (sticky)'
        : target.workspaceName,
    monitor: target.window.monitor,
    position: target.window.position,
  }));
}

export function editorRect(
  position: WindowPosition,
  monitor: EditorMonitor,
): EditorRect {
  return resolvePosition(position, { x: 0, y: 0, ...monitor });
}

export function editorPosition(
  rect: EditorRect,
  monitor: EditorMonitor,
): WindowPosition {
  return detectPosition(rect, { x: 0, y: 0, ...monitor });
}

export function clampEditorRect(
  rect: EditorRect,
  monitor: EditorMonitor,
): EditorRect {
  const minWidth = Math.min(EDITOR_MIN_SIZE_PX, monitor.width);
  const minHeight = Math.min(EDITOR_MIN_SIZE_PX, monitor.height);
  const width = clamp(rect.width, minWidth, monitor.width);
  const height = clamp(rect.height, minHeight, monitor.height);

  return {
    x: clamp(rect.x, 0, monitor.width - width),
    y: clamp(rect.y, 0, monitor.height - height),
    width,
    height,
  };
}

export function moveEditorRect(
  rect: EditorRect,
  dx: number,
  dy: number,
  monitor: EditorMonitor,
): EditorRect {
  return {
    ...rect,
    x: clamp(rect.x + dx, 0, Math.max(0, monitor.width - rect.width)),
    y: clamp(rect.y + dy, 0, Math.max(0, monitor.height - rect.height)),
  };
}

export function resizeEditorRect(
  rect: EditorRect,
  handle: EditorHandle,
  dx: number,
  dy: number,
  monitor: EditorMonitor,
): EditorRect {
  const minWidth = Math.min(EDITOR_MIN_SIZE_PX, monitor.width);
  const minHeight = Math.min(EDITOR_MIN_SIZE_PX, monitor.height);
  let left = clamp(rect.x, 0, monitor.width);
  let top = clamp(rect.y, 0, monitor.height);
  let right = clamp(rect.x + rect.width, 0, monitor.width);
  let bottom = clamp(rect.y + rect.height, 0, monitor.height);

  if (handle.includes('w')) {
    left = clamp(left + dx, 0, Math.max(0, right - minWidth));
  }

  if (handle.includes('e')) {
    right = clamp(
      right + dx,
      Math.min(monitor.width, left + minWidth),
      monitor.width,
    );
  }

  if (handle.includes('n')) {
    top = clamp(top + dy, 0, Math.max(0, bottom - minHeight));
  }

  if (handle.includes('s')) {
    bottom = clamp(
      bottom + dy,
      Math.min(monitor.height, top + minHeight),
      monitor.height,
    );
  }

  if (right - left < minWidth) {
    if (handle.includes('w')) {
      left = Math.max(0, right - minWidth);
    } else {
      right = Math.min(monitor.width, left + minWidth);
    }
  }

  if (bottom - top < minHeight) {
    if (handle.includes('n')) {
      top = Math.max(0, bottom - minHeight);
    } else {
      bottom = Math.min(monitor.height, top + minHeight);
    }
  }

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

export function hitEditorRect(
  rects: ReadonlyArray<{ index: number; rect: EditorRect }>,
  point: { x: number; y: number },
): number | null {
  for (let position = rects.length - 1; position >= 0; position -= 1) {
    const { index, rect } = rects[position];
    if (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    ) {
      return index;
    }
  }

  return null;
}

export function hitEditorHandle(
  rect: EditorRect,
  point: { x: number; y: number },
  radius: number,
): EditorHandle | null {
  const left = rect.x;
  const top = rect.y;
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  const middleX = left + rect.width / 2;
  const middleY = top + rect.height / 2;
  const candidates: Array<[EditorHandle, number, number]> = [
    ['nw', left, top],
    ['ne', right, top],
    ['se', right, bottom],
    ['sw', left, bottom],
    ['n', middleX, top],
    ['e', right, middleY],
    ['s', middleX, bottom],
    ['w', left, middleY],
  ];

  for (const [handle, x, y] of candidates) {
    if (Math.abs(point.x - x) <= radius && Math.abs(point.y - y) <= radius) {
      return handle;
    }
  }

  return null;
}

export function withEditorPosition(
  layout: LayoutFile,
  index: number,
  position: WindowPosition,
): LayoutFile {
  return updateEditorTarget(layout, index, (target) => {
    target.window.position = position;
  });
}

export function withEditorMonitor(
  layout: LayoutFile,
  index: number,
  monitor: number,
): LayoutFile {
  return updateEditorTarget(layout, index, (target) => {
    target.window.monitor = monitor;
  });
}

function updateEditorTarget(
  layout: LayoutFile,
  index: number,
  update: (target: {
    window: { monitor: number; position: WindowPosition };
  }) => void,
): LayoutFile {
  const copy = JSON.parse(JSON.stringify(layout)) as LayoutFile;
  const target = layoutWindowsInApplyOrder(copy)[index];

  if (target === undefined) {
    throw new Error(`Window ${index} does not exist in this layout.`);
  }

  update(target);
  return copy;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
