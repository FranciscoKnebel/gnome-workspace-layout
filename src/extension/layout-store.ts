import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import type { LayoutFile } from '../shared/layout.js';
import { validateLayoutName } from '../shared/layout.js';
import type {
  LayoutEnvironment,
  LayoutSummary,
} from '../shared/layout-summary.js';
import { summarizeLayout } from '../shared/layout-summary.js';
import { ensureDirectory, layoutPath, layoutsDir } from './paths.js';

export function layoutExists(name: string): boolean {
  return GLib.file_test(layoutPath(name), GLib.FileTest.EXISTS);
}

export function readLayout(name: string): unknown {
  return readLayoutFile(layoutPath(name));
}

function readLayoutFile(path: string): unknown {
  const [, contents] = GLib.file_get_contents(path);
  return JSON.parse(new TextDecoder().decode(contents));
}

export function writeLayout(name: string, layout: LayoutFile): string {
  ensureDirectory(layoutsDir());
  const path = layoutPath(name);
  GLib.file_set_contents(path, `${JSON.stringify(layout, null, 2)}\n`);
  return path;
}

export function deleteLayout(name: string): string {
  const path = layoutPath(name);

  if (!GLib.file_test(path, GLib.FileTest.EXISTS)) {
    throw new Error(`Layout not found: ${name}`);
  }

  Gio.File.new_for_path(path).delete(null);
  return path;
}

export function listLayouts(environment: LayoutEnvironment): LayoutSummary[] {
  const directory = layoutsDir();

  if (!GLib.file_test(directory, GLib.FileTest.IS_DIR)) {
    return [];
  }

  const enumerator = Gio.File.new_for_path(directory).enumerate_children(
    'standard::name,standard::type,time::modified',
    Gio.FileQueryInfoFlags.NONE,
    null,
  );
  const summaries: LayoutSummary[] = [];

  try {
    for (;;) {
      const info = enumerator.next_file(null);
      if (info === null) {
        break;
      }

      const filename = info.get_name();
      if (
        info.get_file_type() !== Gio.FileType.REGULAR ||
        !filename.endsWith('.json')
      ) {
        continue;
      }

      const name = filename.slice(0, -'.json'.length);
      const path = GLib.build_filenamev([directory, filename]);
      const modifiedAt = info.get_attribute_uint64('time::modified') || null;

      if (validateLayoutName(name).length > 0) {
        summaries.push(
          invalidSummary(name, path, modifiedAt, [
            `Invalid layout file name: ${filename}`,
          ]),
        );
        continue;
      }

      let layout: unknown;
      try {
        layout = readLayoutFile(path);
      } catch (error) {
        summaries.push(
          invalidSummary(name, path, modifiedAt, [
            `Could not read layout: ${String(error)}`,
          ]),
        );
        continue;
      }

      summaries.push(
        summarizeLayout(layout, environment, { name, path, modifiedAt }),
      );
    }
  } finally {
    enumerator.close(null);
  }

  return summaries.sort((left, right) => left.name.localeCompare(right.name));
}

function invalidSummary(
  name: string,
  path: string,
  modifiedAt: number | null,
  errors: string[],
): LayoutSummary {
  return {
    name,
    path,
    windowCount: 0,
    workspaceCount: 0,
    stickyCount: 0,
    workspaces: [],
    monitors: [],
    valid: false,
    errors,
    missingWorkspaces: [],
    missingMonitors: [],
    modifiedAt,
  };
}
