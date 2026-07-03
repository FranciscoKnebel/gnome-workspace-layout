import type { RelativeRect, WindowPosition } from './layout.js';

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function resolvePosition(position: WindowPosition, monitor: Rect): Rect {
  if (typeof position !== 'string') {
    return relativeToAbsolute(position, monitor);
  }

  switch (position) {
    case 'full':
      return { ...monitor };
    case 'left':
      return { ...monitor, width: Math.floor(monitor.width / 2) };
    case 'right': {
      const width = Math.ceil(monitor.width / 2);
      return {
        x: monitor.x + monitor.width - width,
        y: monitor.y,
        width,
        height: monitor.height,
      };
    }
    case 'top':
      return { ...monitor, height: Math.floor(monitor.height / 2) };
    case 'bottom': {
      const height = Math.ceil(monitor.height / 2);
      return {
        x: monitor.x,
        y: monitor.y + monitor.height - height,
        width: monitor.width,
        height,
      };
    }
    case 'center': {
      const width = Math.floor(monitor.width * 0.7);
      const height = Math.floor(monitor.height * 0.75);
      return {
        x: monitor.x + Math.floor((monitor.width - width) / 2),
        y: monitor.y + Math.floor((monitor.height - height) / 2),
        width,
        height,
      };
    }
  }
}

export function relativeToAbsolute(rect: RelativeRect, monitor: Rect): Rect {
  return {
    x: monitor.x + Math.round(rect.x * monitor.width),
    y: monitor.y + Math.round(rect.y * monitor.height),
    width: Math.round(rect.width * monitor.width),
    height: Math.round(rect.height * monitor.height),
  };
}

export function absoluteToRelative(rect: Rect, monitor: Rect): RelativeRect {
  return {
    x: round4((rect.x - monitor.x) / monitor.width),
    y: round4((rect.y - monitor.y) / monitor.height),
    width: round4(rect.width / monitor.width),
    height: round4(rect.height / monitor.height),
  };
}

export function detectPosition(rect: Rect, monitor: Rect): WindowPosition {
  const relative = absoluteToRelative(rect, monitor);
  const candidates: Array<[WindowPosition, Rect]> = [
    ['full', resolvePosition('full', monitor)],
    ['left', resolvePosition('left', monitor)],
    ['right', resolvePosition('right', monitor)],
    ['top', resolvePosition('top', monitor)],
    ['bottom', resolvePosition('bottom', monitor)],
    ['center', resolvePosition('center', monitor)],
  ];

  for (const [name, candidate] of candidates) {
    if (approximatelyEqual(rect, candidate, 12)) {
      return name;
    }
  }

  return relative;
}

function approximatelyEqual(a: Rect, b: Rect, tolerance: number): boolean {
  return (
    Math.abs(a.x - b.x) <= tolerance &&
    Math.abs(a.y - b.y) <= tolerance &&
    Math.abs(a.width - b.width) <= tolerance &&
    Math.abs(a.height - b.height) <= tolerance
  );
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
