import { resolvePosition } from '../shared/geometry.js';
import {
  assertLayout,
  layoutWindowsInApplyOrder,
  type LayoutWindow,
} from '../shared/layout.js';
import { readLayout } from './layout-store.js';
import type { OperationResult } from './result.js';
import { result } from './result.js';
import {
  findWorkspaceByName,
  getActiveWorkspaceIndex,
  getMonitorRect,
  launchAndWaitForNewWindow,
  makeStickyWindow,
  placeWindow,
} from './shell.js';

export function applyLayout(name: string): OperationResult {
  const errors: string[] = [];
  const messages: string[] = [];

  try {
    const layout = readLayout(name);
    assertLayout(layout);

    for (const target of layoutWindowsInApplyOrder(layout)) {
      const placement =
        target.kind === 'sticky'
          ? launchAndPlaceStickyWindow(target.window)
          : launchAndPlaceWorkspaceWindow(target.window, target.workspaceName);
      errors.push(...placement.errors);
      messages.push(...placement.messages);
    }
  } catch (error) {
    errors.push(String(error));
  }

  return result(errors, messages);
}

function launchAndPlaceStickyWindow(
  windowEntry: LayoutWindow,
): OperationResult {
  return launchAndPlaceWindow(
    windowEntry,
    getActiveWorkspaceIndex(),
    'sticky windows',
    makeStickyWindow,
  );
}

function launchAndPlaceWorkspaceWindow(
  windowEntry: LayoutWindow,
  workspaceName: string,
): OperationResult {
  const workspace = findWorkspaceByName(workspaceName);
  if (workspace === null) {
    return result([`Workspace not found: ${workspaceName}`], []);
  }

  return launchAndPlaceWindow(
    windowEntry,
    workspace.index(),
    workspaceName,
    (created) => created.change_workspace(workspace),
  );
}

function launchAndPlaceWindow(
  windowEntry: LayoutWindow,
  workspaceIndex: number,
  workspaceName: string,
  placeInWorkspace: (window: any) => void,
): OperationResult {
  try {
    const monitorRect = getMonitorRect(windowEntry.monitor);

    if (monitorRect === null) {
      return result(
        [
          `Monitor ${windowEntry.monitor} not found for ${windowEntry.label ?? 'window'}`,
        ],
        [],
      );
    }

    const created = launchAndWaitForNewWindow(windowEntry, workspaceIndex);

    if (created === null) {
      return result(
        [
          `Timed out waiting for ${windowEntry.label ?? windowEntry.command ?? windowEntry.appId}`,
        ],
        [],
      );
    }

    placeInWorkspace(created);
    placeWindow(created, resolvePosition(windowEntry.position, monitorRect));

    if (windowEntry.minimized === true) {
      created.minimize();
    }

    return result(
      [],
      [
        `Placed ${windowEntry.label ?? created.get_title()} on ${workspaceName}`,
      ],
    );
  } catch (error) {
    return result([String(error)], []);
  }
}
