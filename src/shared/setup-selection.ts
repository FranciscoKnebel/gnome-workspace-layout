import {
  assertLayout,
  layoutWindowsInApplyOrder,
  type LayoutFile,
} from './layout.js';

// Indices follow apply order: workspace entries, then sticky entries.
export function selectSetupWindows(
  preview: LayoutFile,
  indices: number[],
): LayoutFile {
  assertLayout(preview);
  const targets = layoutWindowsInApplyOrder(preview);
  if (
    indices.some(
      (index) =>
        !Number.isInteger(index) || index < 0 || index >= targets.length,
    )
  ) {
    throw new Error('Selection contains an invalid window index');
  }
  const selected = new Set(indices);
  const layout: LayoutFile = {
    ...(preview.$schema !== undefined ? { $schema: preview.$schema } : {}),
    name: preview.name,
    workspaces: Object.create(null),
  };
  targets.forEach((target, index) => {
    if (!selected.has(index)) return;
    // JSON cloning works in GJS and keeps the preview independent of edits.
    const window = JSON.parse(JSON.stringify(target.window));
    if (target.kind === 'sticky') {
      layout.sticky ??= [];
      layout.sticky.push(window);
    } else {
      layout.workspaces[target.workspaceName] ??= { windows: [] };
      layout.workspaces[target.workspaceName].windows.push(window);
    }
  });
  assertLayout(layout);
  return layout;
}

export function parseWindowSelection(answer: string, count: number): number[] {
  if (answer.trim().toLowerCase() === 'all')
    return Array.from({ length: count }, (_, i) => i);
  const values = answer.split(',').map((value) => value.trim());
  if (values.some((value) => !/^\d+$/.test(value)))
    throw new Error('Enter all or comma-separated window numbers');
  const indices = values.map((value) => Number(value) - 1);
  if (indices.some((index) => index < 0 || index >= count))
    throw new Error('Window number is out of range');
  return [...new Set(indices)];
}
