import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import type { Rect } from '../shared/geometry.js';
import type { LayoutWindow } from '../shared/layout.js';
import { DEFAULT_TIMEOUT_MS } from './constants.js';

export function getMonitorCount(): number {
  return global.display.get_n_monitors();
}

export function getWorkspaceCount(): number {
  return global.workspace_manager.get_n_workspaces();
}

export function getWindows(): any[] {
  return global.display
    .get_tab_list(0, null)
    .filter(
      (window: any) =>
        window.window_type === 0 || window.get_window_type?.() === 0,
    );
}

export function findWorkspaceByName(name: string): any | null {
  const manager = global.workspace_manager;
  for (let index = 0; index < manager.get_n_workspaces(); index += 1) {
    const workspace = manager.get_workspace_by_index(index);
    if (getWorkspaceName(workspace) === name) {
      return workspace;
    }
  }
  return null;
}

export function getWorkspaceName(workspace: any): string {
  return workspace.get_name?.() ?? `Workspace ${workspace.index() + 1}`;
}

export function getMonitorRect(index: number): Rect | null {
  if (index < 0 || index >= global.display.get_n_monitors()) {
    return null;
  }
  return rectToPlain(global.display.get_monitor_geometry(index));
}

export function windowKey(window: any): string {
  return String(
    window.get_stable_sequence?.() ?? window.get_id?.() ?? window.get_title?.(),
  );
}

export function launchWindow(
  windowEntry: LayoutWindow,
  workspaceIndex: number,
): void {
  if (windowEntry.command !== undefined) {
    GLib.spawn_command_line_async(windowEntry.command);
    return;
  }

  if (windowEntry.appId !== undefined) {
    const app = Shell.AppSystem.get_default().lookup_app(windowEntry.appId);
    if (app === null) {
      throw new Error(`App not found: ${windowEntry.appId}`);
    }
    app.open_new_window(workspaceIndex);
    return;
  }

  throw new Error('Window entry must define command or appId');
}

export function waitForNewWindow(
  before: Set<string>,
  windowEntry: LayoutWindow,
): any | null {
  const startedAt = GLib.get_monotonic_time();
  const timeoutMs = windowEntry.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let found: any | null = null;

  while (elapsedMs(startedAt) < timeoutMs && found === null) {
    for (const window of getWindows()) {
      if (
        !before.has(windowKey(window)) &&
        matchesWindow(window, windowEntry)
      ) {
        found = window;
        break;
      }
    }

    if (found === null) {
      flushMainContext(100);
    }
  }

  return found;
}

export function placeWindow(window: any, rect: Rect): void {
  if (window.minimized) {
    window.unminimize();
  }

  if (window.maximized_horizontally || window.maximized_vertically) {
    window.unmaximize(3);
  }

  window.move_resize_frame(false, rect.x, rect.y, rect.width, rect.height);
}

export function capturedWindowDetails(window: any): {
  appId?: string;
  appName?: string;
  command?: string;
  monitorIndex: number;
  rect: Rect;
  title: string;
  wmClass?: string;
} {
  const app = Shell.WindowTracker.get_default().get_window_app(window);
  const appId = app?.get_id?.();
  const wmClass = window.get_wm_class?.();
  const command = appIdToCommand(appId, wmClass);

  return {
    ...(appId ? { appId } : {}),
    ...(app?.get_name?.() ? { appName: app.get_name() } : {}),
    ...(command ? { command } : {}),
    monitorIndex: window.get_monitor(),
    rect: rectToPlain(window.get_frame_rect()),
    title: window.get_title?.() ?? '',
    ...(wmClass ? { wmClass } : {}),
  };
}

export function rectToPlain(rect: any): Rect {
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

function matchesWindow(window: any, windowEntry: LayoutWindow): boolean {
  const app = Shell.WindowTracker.get_default().get_window_app(window);
  const match = windowEntry.match;

  if (match?.appId !== undefined && app?.get_id?.() !== match.appId) {
    return false;
  }

  if (
    match?.wmClass !== undefined &&
    window.get_wm_class?.() !== match.wmClass
  ) {
    return false;
  }

  if (
    match?.title !== undefined &&
    !String(window.get_title?.() ?? '').includes(match.title)
  ) {
    return false;
  }

  if (
    match === undefined &&
    windowEntry.appId !== undefined &&
    app?.get_id?.() !== windowEntry.appId
  ) {
    return false;
  }

  return true;
}

function appIdToCommand(
  appId: string | undefined,
  wmClass: string | undefined,
): string | undefined {
  if (appId !== undefined) {
    return `gtk-launch ${shellQuote(appId.replace(/\.desktop$/, ''))}`;
  }

  if (wmClass !== undefined && wmClass.trim() !== '') {
    return wmClass;
  }

  return undefined;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function flushMainContext(milliseconds: number): void {
  const context = GLib.MainContext.default();
  const end = GLib.get_monotonic_time() + milliseconds * 1000;
  while (GLib.get_monotonic_time() < end) {
    context.iteration(false);
  }
}

function elapsedMs(startedAt: number): number {
  return (GLib.get_monotonic_time() - startedAt) / 1000;
}
