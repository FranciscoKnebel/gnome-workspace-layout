import { copyLayout } from './copy.js';
import type { LayoutFile, WindowPosition } from './layout.js';
import { layoutWindowsInApplyOrder, WorkspaceAccumulator } from './layout.js';

/**
 * Indices follow layoutWindowsInApplyOrder and are zero-based.
 */
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

  const workspaces = new WorkspaceAccumulator();
  const sticky: NonNullable<LayoutFile['sticky']> = [];

  targets.forEach((target, index) => {
    if (!selected.has(index)) {
      return;
    }

    if (target.kind === 'sticky') {
      sticky.push(target.window);
    } else {
      workspaces.add(target.workspaceName, [target.window]);
    }
  });

  return {
    ...(layout.$schema === undefined ? {} : { $schema: layout.$schema }),
    name: layout.name,
    workspaces: workspaces.toRecord(),
    ...(sticky.length > 0 ? { sticky } : {}),
  };
}

export function remapLayoutWorkspaces(
  layout: LayoutFile,
  mapping: ReadonlyMap<string, string>,
): LayoutFile {
  const workspaces = new WorkspaceAccumulator();

  for (const [workspaceName, workspace] of Object.entries(layout.workspaces)) {
    const targetName = mapping.get(workspaceName) ?? workspaceName;
    workspaces.add(targetName, workspace.windows);
  }

  return {
    ...(layout.$schema === undefined ? {} : { $schema: layout.$schema }),
    name: layout.name,
    workspaces: workspaces.toRecord(),
    ...(layout.sticky === undefined ? {} : { sticky: layout.sticky }),
  };
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
  const copy = copyLayout(layout);
  const target = layoutWindowsInApplyOrder(copy)[index];

  if (target === undefined) {
    throw new Error(`Window ${index} does not exist in this layout.`);
  }

  update(target);
  return copy;
}
