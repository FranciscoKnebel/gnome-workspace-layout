import { layoutWindowsInApplyOrder, type LayoutFile } from './layout.js';

/** Indices follow layoutWindowsInApplyOrder and are zero-based. */
export function selectCapturedWindows(
  layout: LayoutFile,
  indices: readonly number[],
): LayoutFile {
  const selected = new Set(indices);
  const targets = layoutWindowsInApplyOrder(layout);
  if (selected.size === 0) {
    throw new Error('Select at least one window.');
  }
  if (
    indices.some(
      (index) =>
        !Number.isInteger(index) || index < 0 || index >= targets.length,
    )
  ) {
    throw new Error('Selection contains an invalid window number.');
  }

  const workspaces: LayoutFile['workspaces'] = {};
  const sticky: NonNullable<LayoutFile['sticky']> = [];

  targets.forEach((target, index) => {
    if (!selected.has(index)) {
      return;
    }

    if (target.kind === 'sticky') {
      sticky.push(target.window);
    } else {
      workspaces[target.workspaceName] ??= { windows: [] };
      workspaces[target.workspaceName].windows.push(target.window);
    }
  });

  return {
    ...(layout.$schema === undefined ? {} : { $schema: layout.$schema }),
    name: layout.name,
    workspaces,
    ...(sticky.length > 0 ? { sticky } : {}),
  };
}
