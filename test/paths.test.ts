import { describe, expect, it } from 'vitest';
import { joinPath, workspaceLayoutPaths } from '../src/shared/paths.js';

describe('joinPath', () => {
  it('normalizes separators without losing the absolute root', () => {
    expect(
      joinPath('/home/user/.config/', '/workspace-layout/', 'layouts'),
    ).toBe('/home/user/.config/workspace-layout/layouts');
  });

  it('keeps the root when the first component is a filesystem root', () => {
    expect(joinPath('/', 'workspace-layout', 'layouts')).toBe(
      '/workspace-layout/layouts',
    );
    expect(joinPath('///', 'workspace-layout', 'schema')).toBe(
      '/workspace-layout/schema',
    );
    expect(joinPath('config', 'workspace-layout', 'layouts')).toBe(
      'config/workspace-layout/layouts',
    );
  });
});

describe('workspaceLayoutPaths', () => {
  it('derives layouts and schema paths from XDG directories', () => {
    expect(
      workspaceLayoutPaths('/home/user/.config', '/home/user/.local/share'),
    ).toEqual({
      layoutsDir: '/home/user/.config/workspace-layout/layouts',
      schemaDir: '/home/user/.local/share/workspace-layout/schema',
      schemaPath:
        '/home/user/.local/share/workspace-layout/schema/workspace-layout.schema.json',
    });
  });
});
