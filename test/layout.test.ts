import { describe, expect, it } from 'vitest';
import { validateLayout } from '../src/shared/layout.js';

describe('validateLayout', () => {
  it('accepts a minimal valid layout', () => {
    const result = validateLayout({
      name: 'trabalho',
      workspaces: {
        Dev: {
          windows: [
            {
              command: 'gnome-terminal',
              monitor: 0,
              position: 'left',
            },
          ],
        },
      },
    });

    expect(result.errors).toEqual([]);
  });

  it('requires command or appId for each window', () => {
    const result = validateLayout({
      name: 'broken',
      workspaces: {
        Dev: {
          windows: [{ monitor: 0, position: 'left' }],
        },
      },
    });

    expect(result.errors).toContain(
      'workspace Dev.windows[0] must define command or appId',
    );
  });
});
