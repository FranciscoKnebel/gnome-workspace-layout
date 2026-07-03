import { resolvePosition } from '../shared/geometry.js';
import { assertLayout, type LayoutWindow } from '../shared/layout.js';
import { readLayout } from './layout-store.js';
import type { OperationResult } from './result.js';
import { result } from './result.js';
import {
  findWorkspaceByName,
  getMonitorRect,
  getWindows,
  launchWindow,
  placeWindow,
  waitForNewWindow,
  windowKey,
} from './shell.js';

export function applyLayout(name: string): OperationResult {
  const errors: string[] = [];
  const messages: string[] = [];

  try {
    const layout = readLayout(name);
    assertLayout(layout);

    for (const [workspaceName, workspaceLayout] of Object.entries(
      layout.workspaces,
    )) {
      const workspace = findWorkspaceByName(workspaceName);
      if (workspace === null) {
        errors.push(`Workspace not found: ${workspaceName}`);
        continue;
      }

      for (const windowEntry of workspaceLayout.windows) {
        const placement = launchAndPlaceWindow(
          windowEntry,
          workspace,
          workspaceName,
        );
        errors.push(...placement.errors);
        messages.push(...placement.messages);
      }
    }
  } catch (error) {
    errors.push(String(error));
  }

  return result(errors, messages);
}

function launchAndPlaceWindow(
  windowEntry: LayoutWindow,
  workspace: any,
  workspaceName: string,
): OperationResult {
  const monitorRect = getMonitorRect(windowEntry.monitor);

  if (monitorRect === null) {
    return result(
      [
        `Monitor ${windowEntry.monitor} not found for ${windowEntry.label ?? 'window'}`,
      ],
      [],
    );
  }

  const before = new Set(getWindows().map(windowKey));
  launchWindow(windowEntry, workspace.index());
  const created = waitForNewWindow(before, windowEntry);

  if (created === null) {
    return result(
      [
        `Timed out waiting for ${windowEntry.label ?? windowEntry.command ?? windowEntry.appId}`,
      ],
      [],
    );
  }

  created.change_workspace(workspace);
  placeWindow(created, resolvePosition(windowEntry.position, monitorRect));

  if (windowEntry.minimized === true) {
    created.minimize();
  }

  return result(
    [],
    [`Placed ${windowEntry.label ?? created.get_title()} on ${workspaceName}`],
  );
}
