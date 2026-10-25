import { assertLayout } from '../shared/layout.js';
import { layoutExists, writeLayout } from './layout-store.js';
import type { OperationResult } from './result.js';
import { result } from './result.js';

export function saveSetup(layoutJson: string, force: boolean): OperationResult {
  try {
    const layout: unknown = JSON.parse(layoutJson);
    assertLayout(layout);
    // Names become filenames. Never let a D-Bus caller escape the layouts directory.
    if (
      !/^[^/\\]+$/.test(layout.name) ||
      ['.', '..'].includes(layout.name) ||
      layout.name.includes(String.fromCharCode(0))
    ) {
      return result(
        ['Layout name must be a single filename without path separators'],
        [],
      );
    }
    if (layoutExists(layout.name) && !force) {
      return result(
        [`Layout already exists: ${layout.name}. Use --force to replace it.`],
        [],
      );
    }
    return result([], [`Wrote ${writeLayout(layout.name, layout)}`]);
  } catch (error) {
    return result([String(error)], []);
  }
}
