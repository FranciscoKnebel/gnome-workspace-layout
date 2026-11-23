import { describe, expect, it } from 'vitest';
import type { LayoutFile } from '../src/shared/layout.js';
import { remapLayoutWorkspaces } from '../src/shared/layout-transform.js';
import {
  summarizeLayout,
  validateLayoutSummary,
} from '../src/shared/layout-summary.js';
import {
  isOverviewResponse,
  overviewResult,
} from '../src/shared/dbus-responses.js';

const environment = {
  workspaces: ['Dev', 'Chat'],
  monitors: [0, 1],
};

describe('summarizeLayout', () => {
  it('counts windows, workspaces, sticky windows, and available targets', () => {
    const summary = summarizeLayout(
      {
        name: 'trabalho',
        workspaces: {
          Dev: {
            windows: [
              { command: 'editor', monitor: 0, position: 'left' },
              { command: 'terminal', monitor: 1, position: 'right' },
            ],
          },
          Chat: {
            windows: [{ command: 'chat', monitor: 0, position: 'full' }],
          },
        },
        sticky: [{ command: 'music', monitor: 1, position: 'bottom' }],
      },
      environment,
      { name: 'trabalho', path: '/layouts/trabalho.json', modifiedAt: 123 },
    );

    expect(summary).toMatchObject({
      name: 'trabalho',
      path: '/layouts/trabalho.json',
      windowCount: 4,
      workspaceCount: 2,
      stickyCount: 1,
      workspaces: ['Dev', 'Chat'],
      monitors: [0, 1],
      valid: true,
      errors: [],
      missingWorkspaces: [],
      missingMonitors: [],
      modifiedAt: 123,
    });
  });

  it('reports missing workspaces and monitors without dropping the layout', () => {
    const summary = summarizeLayout(
      {
        name: 'antigo',
        workspaces: {
          'Workspace 2': {
            windows: [{ command: 'editor', monitor: 2, position: 'left' }],
          },
          Dev: {
            windows: [{ command: 'terminal', monitor: 0, position: 'right' }],
          },
        },
      },
      environment,
    );

    expect(summary.valid).toBe(true);
    expect(summary.missingWorkspaces).toEqual(['Workspace 2']);
    expect(summary.missingMonitors).toEqual([2]);
  });

  it('keeps invalid layouts visible with validation errors', () => {
    const summary = summarizeLayout(
      {
        name: '../escape',
        workspaces: {},
      },
      environment,
      { name: 'escape' },
    );

    expect(summary.valid).toBe(false);
    expect(summary.name).toBe('escape');
    expect(summary.errors).toContain(
      'name must not contain path separators or control characters',
    );
    expect(summary.errors).toContain(
      'layout must define at least one workspace or sticky window',
    );
  });

  it('tolerates non-layout JSON', () => {
    const summary = summarizeLayout(null, environment, { name: 'broken' });

    expect(summary).toMatchObject({
      name: 'broken',
      windowCount: 0,
      workspaceCount: 0,
      stickyCount: 0,
      workspaces: [],
      monitors: [],
      valid: false,
      missingWorkspaces: [],
      missingMonitors: [],
      modifiedAt: null,
    });
  });

  it('ignores malformed windows when building monitor requirements', () => {
    const summary = summarizeLayout(
      {
        name: 'broken',
        workspaces: {
          Dev: {
            windows: [
              { command: 'editor', monitor: 'zero', position: 'left' },
              { command: 'terminal', monitor: 1.5, position: 'right' },
              { command: 'chat', monitor: 1, position: 'full' },
            ],
          },
        },
        sticky: [{ monitor: 4, command: 'music', position: 'bottom' }],
      },
      environment,
    );

    expect(summary.monitors).toEqual([1, 4]);
    expect(summary.missingMonitors).toEqual([4]);
  });
});

describe('remapLayoutWorkspaces', () => {
  const layout: LayoutFile = {
    $schema: 'https://example.com/schema.json',
    name: 'trabalho',
    workspaces: {
      'Workspace 2': {
        windows: [{ command: 'editor', monitor: 0, position: 'left' }],
      },
      'Workspace 3': {
        windows: [{ command: 'chat', monitor: 1, position: 'right' }],
      },
      Dev: {
        windows: [{ command: 'terminal', monitor: 0, position: 'bottom' }],
      },
    },
    sticky: [{ command: 'music', monitor: 1, position: 'full' }],
  };

  it('renames missing workspaces and keeps other workspaces untouched', () => {
    const remapped = remapLayoutWorkspaces(layout, {
      'Workspace 2': 'Dawntech',
      'Workspace 3': 'G&G',
    });

    expect(remapped).toEqual({
      $schema: 'https://example.com/schema.json',
      name: 'trabalho',
      workspaces: {
        Dawntech: {
          windows: [{ command: 'editor', monitor: 0, position: 'left' }],
        },
        'G&G': {
          windows: [{ command: 'chat', monitor: 1, position: 'right' }],
        },
        Dev: {
          windows: [{ command: 'terminal', monitor: 0, position: 'bottom' }],
        },
      },
      sticky: [{ command: 'music', monitor: 1, position: 'full' }],
    });
  });

  it('merges windows when two sources map to the same workspace', () => {
    const remapped = remapLayoutWorkspaces(layout, {
      'Workspace 2': 'Principal',
      Dev: 'Principal',
    });

    expect(remapped.workspaces.Principal.windows).toEqual([
      { command: 'editor', monitor: 0, position: 'left' },
      { command: 'terminal', monitor: 0, position: 'bottom' },
    ]);
  });

  it('does not mutate the original layout', () => {
    const snapshot = structuredClone(layout);

    remapLayoutWorkspaces(layout, { 'Workspace 2': 'Dawntech' });

    expect(layout).toEqual(snapshot);
  });
});

describe('validateLayoutSummary', () => {
  const summary = summarizeLayout(
    {
      name: 'trabalho',
      workspaces: {
        Dev: {
          windows: [{ command: 'editor', monitor: 0, position: 'left' }],
        },
      },
    },
    environment,
    { name: 'trabalho', modifiedAt: 1700000000 },
  );

  it('accepts a generated summary', () => {
    expect(validateLayoutSummary(summary)).toEqual([]);
  });

  it('rejects a malformed modification time', () => {
    expect(
      validateLayoutSummary({ ...summary, modifiedAt: 'yesterday' }),
    ).toContain('layout summary.modifiedAt must be a number or null');
  });

  it('rejects a summary with the wrong workspace types', () => {
    expect(validateLayoutSummary({ ...summary, workspaces: [1, 2] })).toContain(
      'layout summary.workspaces must contain strings',
    );
  });
});

describe('isOverviewResponse', () => {
  it('rejects an overview with an invalid summary', () => {
    expect(
      isOverviewResponse({
        ok: true,
        errors: [],
        messages: [],
        kind: 'GetOverview',
        overview: {
          status: null,
          layouts: [{ name: 1 }],
        },
      }),
    ).toBe(false);
  });
});

describe('isOverviewResponse round trip', () => {
  it('accepts a generated overview', () => {
    const summary = summarizeLayout(
      {
        name: 'trabalho',
        workspaces: {
          Dev: {
            windows: [{ command: 'editor', monitor: 0, position: 'left' }],
          },
        },
      },
      environment,
      { name: 'trabalho', modifiedAt: 1700000000 },
    );
    const response = overviewResult(
      {
        monitors: [{ index: 0, x: 0, y: 0, width: 1920, height: 1080 }],
        workspaces: [{ index: 0, name: 'Dev', active: true }],
        activeWorkspaceIndex: 0,
        layoutsDir: '/layouts',
        schemaPath: '/schema.json',
      },
      [summary],
    );

    expect(isOverviewResponse(response)).toBe(true);
  });
});
