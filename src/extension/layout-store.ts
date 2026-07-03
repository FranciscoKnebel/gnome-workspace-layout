import GLib from 'gi://GLib';
import type { LayoutFile } from '../shared/layout.js';
import { ensureDirectory, layoutPath, layoutsDir } from './paths.js';

export function layoutExists(name: string): boolean {
  return GLib.file_test(layoutPath(name), GLib.FileTest.EXISTS);
}

export function readLayout(name: string): unknown {
  const [, contents] = GLib.file_get_contents(layoutPath(name));
  return JSON.parse(new TextDecoder().decode(contents));
}

export function writeLayout(name: string, layout: LayoutFile): string {
  ensureDirectory(layoutsDir());
  const path = layoutPath(name);
  GLib.file_set_contents(path, `${JSON.stringify(layout, null, 2)}\n`);
  return path;
}
