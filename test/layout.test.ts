import { describe, expect, it } from 'vitest';
import {
  layoutWindowsInApplyOrder,
  validateLayout,
  type LayoutFile,
} from '../src/shared/layout.js';

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

  it('accepts sticky windows without workspace windows', () => {
    const result = validateLayout({
      name: 'global-tools',
      sticky: [
        {
          appId: 'org.gnome.Terminal.desktop',
          command: 'gnome-terminal',
          monitor: 0,
          position: 'right',
        },
      ],
      workspaces: {},
    });

    expect(result.errors).toEqual([]);
  });

  it('requires at least one workspace or sticky window', () => {
    const result = validateLayout({
      name: 'empty',
      workspaces: {},
    });

    expect(result.errors).toContain(
      'layout must define at least one workspace or sticky window',
    );
  });

  it('validates sticky window entries', () => {
    const result = validateLayout({
      name: 'broken',
      sticky: [{ monitor: 0, position: 'left' }],
      workspaces: {},
    });

    expect(result.errors).toContain('sticky[0] must define command or appId');
  });

  it('returns workspace windows before sticky windows in apply order', () => {
    const layout: LayoutFile = {
      name: 'trabalho',
      sticky: [
        {
          label: 'sticky terminal',
          command: 'terminal',
          monitor: 0,
          position: 'right',
        },
      ],
      workspaces: {
        Dev: {
          windows: [
            {
              label: 'editor',
              command: 'editor',
              monitor: 0,
              position: 'left',
            },
          ],
        },
        Chat: {
          windows: [
            { label: 'chat', command: 'chat', monitor: 1, position: 'full' },
          ],
        },
      },
    };

    expect(layoutWindowsInApplyOrder(layout)).toEqual([
      {
        kind: 'workspace',
        workspaceName: 'Dev',
        window: {
          label: 'editor',
          command: 'editor',
          monitor: 0,
          position: 'left',
        },
      },
      {
        kind: 'workspace',
        workspaceName: 'Chat',
        window: {
          label: 'chat',
          command: 'chat',
          monitor: 1,
          position: 'full',
        },
      },
      {
        kind: 'sticky',
        window: {
          label: 'sticky terminal',
          command: 'terminal',
          monitor: 0,
          position: 'right',
        },
      },
    ]);
  });

  it('rejects empty commands', () => {
    const result = validateLayout({
      name: 'broken',
      workspaces: {
        Dev: {
          windows: [{ command: '', monitor: 0, position: 'left' }],
        },
      },
    });

    expect(result.errors).toContain(
      'workspace Dev.windows[0].command must be a non-empty string',
    );
  });
});
