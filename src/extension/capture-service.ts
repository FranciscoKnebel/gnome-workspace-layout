import { detectPosition } from '../shared/geometry.js';
import type { CapturePreview } from '../shared/dbus-responses.js';
import { capturePreviewResult } from '../shared/dbus-responses.js';
import type {
  LayoutFile,
  LayoutWindow,
  WindowMatch,
} from '../shared/layout.js';
import {
  assertLayout,
  layoutWindowsInApplyOrder,
  validateLayout,
  validateLayoutName,
  WorkspaceAccumulator,
} from '../shared/layout.js';
import type { OperationResult } from '../shared/result.js';
import { result } from '../shared/result.js';
import { layoutExists, writeLayout } from './layout-store.js';
import { schemaUri } from './paths.js';
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
  force: boolean,
): OperationResult {
  const preview = previewCapture(name, includeMinimized, force);
  if (preview.layout === undefined) {
    return result(preview.errors, preview.messages);
  }

  try {
    const path = writeLayout(name, preview.layout);
    return result(preview.errors, [...preview.messages, `Wrote ${path}`]);
  } catch (error) {
    return result([...preview.errors, String(error)], []);
  }
}

export function previewCapture(
  name: string,
  includeMinimized: boolean,
  force: boolean,
): CapturePreview {
  const errors: string[] = [];
  const messages: string[] = [];
  const nameErrors = validateLayoutName(name);

  if (nameErrors.length > 0) {
    return capturePreviewResult(undefined, nameErrors, []);
  }

  try {
    const replacing = layoutExists(name);
    if (replacing && !force) {
      return capturePreviewResult(undefined, [existingLayoutError(name)], []);
    }

    const workspaces = new WorkspaceAccumulator();
    const sticky: LayoutWindow[] = [];

    for (const window of getWindows()) {
      if (window.skip_taskbar || (!includeMinimized && window.minimized)) {
        continue;
      }

      const entry = captureWindow(window, errors);
      if (entry === null) {
        continue;
      }

      if (isStickyWindow(window)) {
        sticky.push(entry);
        continue;
      }

      const workspaceName = getWorkspaceName(window.get_workspace());
      workspaces.add(workspaceName, [entry]);
    }

    const layout: LayoutFile = {
      $schema: schemaUri(),
      name,
      workspaces: workspaces.toRecord(),
      ...(sticky.length > 0 ? { sticky } : {}),
    };

    if (replacing && errors.length > 0) {
      return capturePreviewResult(undefined, errors, messages);
    }

    const validationErrors = validateLayout(layout).errors;
    errors.push(...validationErrors);
    if (validationErrors.length > 0) {
      return capturePreviewResult(undefined, errors, messages);
    }

    return capturePreviewResult(layout, errors, messages);
  } catch (error) {
    errors.push(String(error));
  }

  return capturePreviewResult(undefined, errors, messages);
}

export function saveCapture(
  serializedLayout: string,
  force: boolean,
): OperationResult {
  try {
    const layout: unknown = JSON.parse(serializedLayout);
    assertLayout(layout);
    if (layoutWindowsInApplyOrder(layout).length === 0) {
      return result(['Select at least one window.'], []);
    }
    if (layoutExists(layout.name) && !force) {
      return result([existingLayoutError(layout.name)], []);
    }

    const path = writeLayout(layout.name, layout);
    return result([], [`Wrote ${path}`]);
  } catch (error) {
    return result([String(error)], []);
  }
}

function existingLayoutError(name: string): string {
  return `Layout already exists: ${name}. Use --force to replace it or choose another name.`;
}

function captureWindow(window: any, errors: string[]): LayoutWindow | null {
  const details = capturedWindowDetails(window);
  const monitor = getMonitorRect(details.monitorIndex);

  if (monitor === null) {
    errors.push(
      `Skipped window on unavailable monitor ${details.monitorIndex}: ${details.title}`,
    );
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
