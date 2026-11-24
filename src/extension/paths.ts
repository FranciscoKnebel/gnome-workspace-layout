import GLib from 'gi://GLib';
import { assertLayoutName } from '../shared/layout.js';
import { joinPath, workspaceLayoutPaths } from '../shared/paths.js';

export function layoutPath(name: string): string {
  assertLayoutName(name);
  return joinPath(layoutsDir(), `${name}.json`);
}

export function layoutsDir(): string {
  return workspaceLayoutPaths(
    GLib.get_user_config_dir(),
    GLib.get_user_data_dir(),
  ).layoutsDir;
}

export function schemaUri(): string {
  return `file://${schemaPath()}`;
}

export function schemaPath(): string {
  return workspaceLayoutPaths(
    GLib.get_user_config_dir(),
    GLib.get_user_data_dir(),
  ).schemaPath;
}

export function ensureDirectory(path: string): void {
  GLib.mkdir_with_parents(path, 0o755);
}
