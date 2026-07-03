import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import {
  detectPosition,
  resolvePosition,
  type Rect,
} from '../shared/geometry.js';
import {
  assertLayout,
  LAYOUT_SCHEMA_ID,
  type LayoutFile,
  type LayoutWindow,
} from '../shared/layout.js';

const BUS_NAME = 'com.franciscoknebel.WorkspaceLayout';
const OBJECT_PATH = '/com/franciscoknebel/WorkspaceLayout';
const DEFAULT_TIMEOUT_MS = 10000;

const DBUS_XML = `
<node>
  <interface name="com.franciscoknebel.WorkspaceLayout">
    <method name="Apply">
      <arg type="s" name="name" direction="in" />
      <arg type="s" name="result" direction="out" />
    </method>
    <method name="Setup">
      <arg type="s" name="name" direction="in" />
      <arg type="b" name="includeMinimized" direction="in" />
      <arg type="s" name="result" direction="out" />
    </method>
    <method name="Doctor">
      <arg type="s" name="result" direction="out" />
    </method>
  </interface>
</node>`;

type OperationResult = {
  ok: boolean;
  errors: string[];
  messages: string[];
};

export default class WorkspaceLayoutExtension extends Extension {
  private dbusObject: any = null;
  private busOwnerId = 0;

  override enable(): void {
    const iface = Gio.DBusExportedObject.wrapJSObject(DBUS_XML, this);
    iface.export(Gio.DBus.session, OBJECT_PATH);
    this.dbusObject = iface;
    this.busOwnerId = Gio.bus_own_name_on_connection(
      Gio.DBus.session,
      BUS_NAME,
      Gio.BusNameOwnerFlags.REPLACE,
      null,
      null,
    );
    console.log('Workspace Layout enabled');
  }

  override disable(): void {
    if (this.dbusObject !== null) {
      this.dbusObject.unexport();
      this.dbusObject = null;
    }

    if (this.busOwnerId !== 0) {
      Gio.bus_unown_name(this.busOwnerId);
      this.busOwnerId = 0;
    }

    console.log('Workspace Layout disabled');
  }

  Apply(name: string): string {
    return JSON.stringify(this.applyLayout(name));
  }

  Setup(name: string, includeMinimized: boolean): string {
    return JSON.stringify(this.captureLayout(name, includeMinimized));
  }

  Doctor(): string {
    return JSON.stringify({
      ok: true,
      errors: [],
      messages: [
        `D-Bus name: ${BUS_NAME}`,
        `D-Bus object path: ${OBJECT_PATH}`,
        `Layouts directory: ${layoutsDir()}`,
        `Schema id: ${LAYOUT_SCHEMA_ID}`,
        `Monitors detected: ${global.display.get_n_monitors()}`,
        `Workspaces detected: ${global.workspace_manager.get_n_workspaces()}`,
      ],
    } satisfies OperationResult);
  }

  private applyLayout(name: string): OperationResult {
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
          const result = this.launchAndPlaceWindow(
            windowEntry,
            workspace,
            workspaceName,
          );
          errors.push(...result.errors);
          messages.push(...result.messages);
        }
      }
    } catch (error) {
      errors.push(String(error));
    }

    return { ok: errors.length === 0, errors, messages };
  }

  private launchAndPlaceWindow(
    windowEntry: LayoutWindow,
    workspace: any,
    workspaceName: string,
  ): OperationResult {
    const errors: string[] = [];
    const messages: string[] = [];
    const monitorRect = getMonitorRect(windowEntry.monitor);

    if (monitorRect === null) {
      return {
        ok: false,
        errors: [
          `Monitor ${windowEntry.monitor} not found for ${windowEntry.label ?? 'window'}`,
        ],
        messages,
      };
    }

    const before = new Set(getWindows().map(windowKey));
    launchWindow(windowEntry, workspace.index());
    const created = waitForNewWindow(
      before,
      windowEntry,
      windowEntry.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );

    if (created === null) {
      return {
        ok: false,
        errors: [
          `Timed out waiting for ${windowEntry.label ?? windowEntry.command ?? windowEntry.appId}`,
        ],
        messages,
      };
    }

    created.change_workspace(workspace);
    placeWindow(created, resolvePosition(windowEntry.position, monitorRect));

    if (windowEntry.minimized === true) {
      created.minimize();
    }

    messages.push(
      `Placed ${windowEntry.label ?? created.get_title()} on ${workspaceName}`,
    );
    return { ok: true, errors, messages };
  }

  private captureLayout(
    name: string,
    includeMinimized: boolean,
  ): OperationResult {
    const errors: string[] = [];
    const messages: string[] = [];
    const path = layoutPath(name);

    try {
      if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
        return {
          ok: false,
          errors: [
            `Layout already exists: ${path}. Use --force support in a future version or remove it manually.`,
          ],
          messages,
        };
      }

      ensureDirectory(layoutsDir());

      const layout: LayoutFile = {
        $schema: schemaUri(),
        name,
        workspaces: {},
      };

      for (const window of getWindows()) {
        if (window.skip_taskbar || (!includeMinimized && window.minimized)) {
          continue;
        }

        const workspace = window.get_workspace();
        const workspaceName = getWorkspaceName(workspace);
        const monitorIndex = window.get_monitor();
        const monitor = getMonitorRect(monitorIndex);

        if (monitor === null) {
          continue;
        }

        layout.workspaces[workspaceName] ??= { windows: [] };
        const rect = window.get_frame_rect();
        const app = Shell.WindowTracker.get_default().get_window_app(window);
        const appId = app?.get_id?.();
        const title = window.get_title?.() ?? '';
        const wmClass = window.get_wm_class?.();

        layout.workspaces[workspaceName].windows.push({
          label: makeLabel(app?.get_name?.(), title),
          ...(appId ? { appId } : {}),
          command: appIdToCommand(appId, wmClass),
          title,
          match: {
            ...(appId ? { appId } : {}),
            ...(wmClass ? { wmClass } : {}),
          },
          monitor: monitorIndex,
          position: detectPosition(rectToPlain(rect), monitor),
          ...(window.minimized ? { minimized: true } : {}),
        });
      }

      GLib.file_set_contents(path, `${JSON.stringify(layout, null, 2)}\n`);
      messages.push(`Wrote ${path}`);
    } catch (error) {
      errors.push(String(error));
    }

    return { ok: errors.length === 0, errors, messages };
  }
}

function readLayout(name: string): unknown {
  const [, contents] = GLib.file_get_contents(layoutPath(name));
  return JSON.parse(new TextDecoder().decode(contents));
}

function launchWindow(windowEntry: LayoutWindow, workspaceIndex: number): void {
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

function waitForNewWindow(
  before: Set<string>,
  windowEntry: LayoutWindow,
  timeoutMs: number,
): any | null {
  const startedAt = GLib.get_monotonic_time();
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

function placeWindow(window: any, rect: Rect): void {
  if (window.minimized) {
    window.unminimize();
  }

  if (window.maximized_horizontally || window.maximized_vertically) {
    window.unmaximize(3);
  }

  window.move_resize_frame(false, rect.x, rect.y, rect.width, rect.height);
}

function findWorkspaceByName(name: string): any | null {
  const manager = global.workspace_manager;
  for (let index = 0; index < manager.get_n_workspaces(); index += 1) {
    const workspace = manager.get_workspace_by_index(index);
    if (getWorkspaceName(workspace) === name) {
      return workspace;
    }
  }
  return null;
}

function getWorkspaceName(workspace: any): string {
  return workspace.get_name?.() ?? `Workspace ${workspace.index() + 1}`;
}

function getMonitorRect(index: number): Rect | null {
  if (index < 0 || index >= global.display.get_n_monitors()) {
    return null;
  }
  return rectToPlain(global.display.get_monitor_geometry(index));
}

function getWindows(): any[] {
  return global.display
    .get_tab_list(0, null)
    .filter(
      (window: any) =>
        window.window_type === 0 || window.get_window_type?.() === 0,
    );
}

function windowKey(window: any): string {
  return String(
    window.get_stable_sequence?.() ?? window.get_id?.() ?? window.get_title?.(),
  );
}

function rectToPlain(rect: any): Rect {
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

function appIdToCommand(
  appId: string | undefined,
  wmClass: string | undefined,
): string {
  if (appId !== undefined) {
    return `gtk-launch ${shellQuote(appId.replace(/\.desktop$/, ''))}`;
  }
  return wmClass ?? '';
}

function makeLabel(appName: string | undefined, title: string): string {
  if (appName !== undefined && title !== '') {
    return `${appName} - ${title}`;
  }
  return appName ?? title ?? 'Window';
}

function layoutPath(name: string): string {
  return GLib.build_filenamev([layoutsDir(), `${name}.json`]);
}

function layoutsDir(): string {
  return GLib.build_filenamev([
    GLib.get_user_config_dir(),
    'workspace-layout',
    'layouts',
  ]);
}

function schemaUri(): string {
  return `file://${GLib.build_filenamev([
    GLib.get_user_data_dir(),
    'workspace-layout',
    'schema',
    'workspace-layout.schema.json',
  ])}`;
}

function ensureDirectory(path: string): void {
  GLib.mkdir_with_parents(path, 0o755);
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
