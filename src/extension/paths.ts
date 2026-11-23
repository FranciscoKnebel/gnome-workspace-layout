import GLib from 'gi://GLib';
import { assertLayoutName } from '../shared/layout.js';

export function layoutPath(name: string): string {
  assertLayoutName(name);
  return GLib.build_filenamev([layoutsDir(), `${name}.json`]);
}

export function layoutsDir(): string {
  return GLib.build_filenamev([
    GLib.get_user_config_dir(),
    'workspace-layout',
    'layouts',
  ]);
}

export function schemaUri(): string {
  return `file://${schemaPath()}`;
}

export function schemaPath(): string {
  return GLib.build_filenamev([
    GLib.get_user_data_dir(),
    'workspace-layout',
    'schema',
    'workspace-layout.schema.json',
  ]);
}

export function ensureDirectory(path: string): void {
  GLib.mkdir_with_parents(path, 0o755);
}
