import { detectPosition } from '../shared/geometry.js';
import type {
  LayoutFile,
  LayoutWindow,
  WindowMatch,
} from '../shared/layout.js';
import { layoutExists, writeLayout } from './layout-store.js';
import { schemaUri } from './paths.js';
import type { OperationResult } from './result.js';
import { result } from './result.js';
import {
  capturedWindowDetails,
  getMonitorRect,
  getWindows,
  getWorkspaceName,
  isStickyWindow,
} from './shell.js';

export function captureLayout(
  name: string,
  includeMinimized: boolean,
): OperationResult {
  const errors: string[] = [];
  const messages: string[] = [];

  try {
    if (layoutExists(name)) {
      return result(
        [
          `Layout already exists: ${name}. Use --force support in a future version or remove it manually.`,
        ],
        [],
      );
    }

    const layout: LayoutFile = {
      $schema: schemaUri(),
      name,
      workspaces: {},
    };

    for (const window of getWindows()) {
      if (window.skip_taskbar || (!includeMinimized && window.minimized)) {
        continue;
      }

      const entry = captureWindow(window, errors);
      if (entry === null) {
        continue;
      }

      if (isStickyWindow(window)) {
        layout.sticky ??= [];
        layout.sticky.push(entry);
        continue;
      }

      const workspaceName = getWorkspaceName(window.get_workspace());
      layout.workspaces[workspaceName] ??= { windows: [] };
      layout.workspaces[workspaceName].windows.push(entry);
    }

    const path = writeLayout(name, layout);
    messages.push(`Wrote ${path}`);
  } catch (error) {
    errors.push(String(error));
  }

  return result(errors, messages);
}

function captureWindow(window: any, errors: string[]): LayoutWindow | null {
  const details = capturedWindowDetails(window);
  const monitor = getMonitorRect(details.monitorIndex);

  if (monitor === null) {
    return null;
  }

  if (details.appId === undefined && details.command === undefined) {
    errors.push(`Skipped window without app id or command: ${details.title}`);
    return null;
  }

  const match = buildMatch(details.appId, details.wmClass);

  return {
    label: makeLabel(details.appName, details.title),
    ...(details.appId ? { appId: details.appId } : {}),
    ...(details.command ? { command: details.command } : {}),
    title: details.title,
    ...(match ? { match } : {}),
    monitor: details.monitorIndex,
    position: detectPosition(details.rect, monitor),
    ...(window.minimized ? { minimized: true } : {}),
  };
}

function buildMatch(
  appId: string | undefined,
  wmClass: string | undefined,
): WindowMatch | undefined {
  const match = {
    ...(appId ? { appId } : {}),
    ...(wmClass ? { wmClass } : {}),
  };

  return Object.keys(match).length > 0 ? match : undefined;
}

function makeLabel(appName: string | undefined, title: string): string {
  if (appName !== undefined && title !== '') {
    return `${appName} - ${title}`;
  }
  return appName ?? title ?? 'Window';
}
