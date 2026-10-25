import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import type { Rect } from '../shared/geometry.js';
import { buildLaunchCommand } from '../shared/launch-command.js';
import type { LayoutWindow } from '../shared/layout.js';
import { detectLaunchedWindow } from '../shared/window-detection.js';
import { matchesWindowIdentity } from '../shared/window-matching.js';
import { DEFAULT_TIMEOUT_MS } from './constants.js';

const activeWindowWaitCancels = new Set<() => void>();
let windowWaitsEnabled = false;

export function getMonitorCount(): number {
  return global.display.get_n_monitors();
}

export function getWorkspaceCount(): number {
  return global.workspace_manager.get_n_workspaces();
}

export function getWindows(): any[] {
  return global.display.get_tab_list(0, null).filter(isNormalWindow);
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

export function getActiveWorkspaceIndex(): number {
  return global.workspace_manager.get_active_workspace().index();
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
): { pid?: number } {
  if (windowEntry.command !== undefined) {
    const [parsed, argv] = GLib.shell_parse_argv(windowEntry.command);
    if (!parsed) {
      throw new Error(`Could not parse command: ${windowEntry.command}`);
    }

    const [spawned, pid] = GLib.spawn_async(
      null,
      argv,
      null,
      GLib.SpawnFlags.SEARCH_PATH,
      null,
    );
    if (!spawned) {
      throw new Error(`Could not launch command: ${windowEntry.command}`);
    }

    return { pid };
  }

  if (windowEntry.appId !== undefined) {
    const app = Shell.AppSystem.get_default().lookup_app(windowEntry.appId);
    if (app === null) {
      throw new Error(`App not found: ${windowEntry.appId}`);
    }
    app.open_new_window(workspaceIndex);
    return {};
  }

  throw new Error('Window entry must define command or appId');
}

export async function launchAndWaitForNewWindow(
  windowEntry: LayoutWindow,
  workspaceIndex: number,
): Promise<any | null> {
  if (!windowWaitsEnabled) {
    throw new Error('Window wait cancelled because the extension is disabled');
  }
  return detectLaunchedWindow({
    getWindows,
    key: windowKey,
    matches: (window, pid) =>
      isWindowReadyForPlacement(window) &&
      matchesWindowIdentity(windowIdentity(window), windowEntry, pid),
    subscribe: (created) => {
      const signalId = global.display.connect(
        'window-created',
        (_display: any, window: any) => created(window),
      );
      return () => global.display.disconnect(signalId);
    },
    schedule: (ms, callback) => {
      let sourceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
        sourceId = 0;
        callback();
        return GLib.SOURCE_REMOVE;
      });
      return () => {
        if (sourceId !== 0) {
          GLib.source_remove(sourceId);
          sourceId = 0;
        }
      };
    },
    registerCancel: (cancel) => {
      activeWindowWaitCancels.add(cancel);
      return () => {
        activeWindowWaitCancels.delete(cancel);
      };
    },
    launch: () => launchWindow(windowEntry, workspaceIndex),
    timeoutMs: windowEntry.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });
}

export function enableWindowWaits(): void {
  windowWaitsEnabled = true;
}

export function cancelWindowWaits(): void {
  windowWaitsEnabled = false;

  for (const cancel of [...activeWindowWaitCancels]) {
    cancel();
  }
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

export function isStickyWindow(window: any): boolean {
  return window.is_on_all_workspaces() === true;
}

export function makeStickyWindow(window: any): void {
  window.stick();
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
  const desktopFile = readDesktopFile(appId);
  const command = buildLaunchCommand({
    ...(appId ? { appId } : {}),
    ...(desktopFile ? { desktopFile } : {}),
  });

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

function windowIdentity(window: any): {
  appId?: string;
  pid?: number;
  title?: string;
  wmClass?: string;
} {
  const app = Shell.WindowTracker.get_default().get_window_app(window);

  return {
    ...(app?.get_id?.() ? { appId: app.get_id() } : {}),
    ...(window.get_pid?.() ? { pid: window.get_pid() } : {}),
    ...(window.get_title?.() ? { title: window.get_title() } : {}),
    ...(window.get_wm_class?.() ? { wmClass: window.get_wm_class() } : {}),
  };
}

function isNormalWindow(window: any): boolean {
  return window.window_type === 0 || window.get_window_type?.() === 0;
}

function isWindowReadyForPlacement(window: any): boolean {
  const actor = window.get_compositor_private?.();
  return isNormalWindow(window) && actor !== null && actor !== undefined;
}

function readDesktopFile(appId: string | undefined): string | undefined {
  if (appId === undefined) {
    return undefined;
  }

  const dataDirectories = [
    GLib.get_user_data_dir(),
    ...GLib.get_system_data_dirs(),
  ];

  for (const dataDirectory of dataDirectories) {
    const filename = GLib.build_filenamev([
      dataDirectory,
      'applications',
      appId,
    ]);

    try {
      const [success, contents] = GLib.file_get_contents(filename);
      if (success) {
        return new TextDecoder().decode(contents);
      }
    } catch {
      continue;
    }
  }

  return undefined;
}
