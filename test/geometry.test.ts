import { describe, expect, it } from 'vitest';
import { detectPosition, resolvePosition } from '../src/shared/geometry.js';

const monitor = { x: 100, y: 50, width: 1920, height: 1080 };

describe('resolvePosition', () => {
  it('resolves the left half of a monitor', () => {
    expect(resolvePosition('left', monitor)).toEqual({
      x: 100,
      y: 50,
      width: 960,
      height: 1080,
    });
  });

  it('resolves relative rectangles', () => {
    expect(
      resolvePosition({ x: 0.25, y: 0.1, width: 0.5, height: 0.8 }, monitor),
    ).toEqual({ x: 580, y: 158, width: 960, height: 864 });
  });
});

describe('detectPosition', () => {
  it('detects a preset when the rectangle is close enough', () => {
    expect(
      detectPosition({ x: 103, y: 52, width: 956, height: 1075 }, monitor),
    ).toBe('left');
  });

  it('falls back to a relative rectangle', () => {
    expect(
      detectPosition({ x: 580, y: 158, width: 960, height: 864 }, monitor),
    ).toEqual({ x: 0.25, y: 0.1, width: 0.5, height: 0.8 });
  });
});
