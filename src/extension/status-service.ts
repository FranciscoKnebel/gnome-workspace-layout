import type { RuntimeStatus } from '../shared/status.js';
import { layoutsDir, schemaPath } from './paths.js';
import {
  getActiveWorkspaceIndex,
  getMonitors,
  getWorkspaces,
} from './shell.js';

export function runtimeStatus(): RuntimeStatus {
  return {
    monitors: getMonitors(),
    workspaces: getWorkspaces(),
    activeWorkspaceIndex: getActiveWorkspaceIndex(),
    layoutsDir: layoutsDir(),
    schemaPath: schemaPath(),
  };
}
