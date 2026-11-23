import Gio from 'gi://Gio';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { assertLayout, LAYOUT_SCHEMA_ID } from '../shared/layout.js';
import {
  listLayoutsResult,
  overviewResult,
  readLayoutResult,
  statusResult,
} from '../shared/dbus-responses.js';
import { applyLayout } from './apply-service.js';
import { BUS_NAME, DBUS_XML, OBJECT_PATH } from './constants.js';
import {
  captureLayout,
  previewCapture,
  saveCapture,
} from './capture-service.js';
import { deleteLayout, listLayouts, readLayout } from './layout-store.js';
import { OperationGate } from './operation-gate.js';
import { layoutsDir } from './paths.js';
import { result, type OperationResult } from '../shared/result.js';
import { runtimeStatus } from './status-service.js';
import {
  cancelWindowWaits,
  enableWindowWaits,
  getMonitorCount,
  getWorkspaceCount,
} from './shell.js';

export default class WorkspaceLayoutExtension extends Extension {
  private dbusObject: any = null;
  private busOwnerId = 0;
  private operations = new OperationGate();

  override enable(): void {
    enableWindowWaits();

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
    cancelWindowWaits();

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
    return this.runGated(() => applyLayout(name));
  }

  Setup(name: string, includeMinimized: boolean): string {
    return this.runGated(() => captureLayout(name, includeMinimized, false));
  }

  SetupForce(name: string, includeMinimized: boolean): string {
    return this.runGated(() => captureLayout(name, includeMinimized, true));
  }

  PreviewSetup(
    name: string,
    includeMinimized: boolean,
    force: boolean,
  ): string {
    return this.runRead(() => previewCapture(name, includeMinimized, force));
  }

  SaveSetup(layout: string, force: boolean): string {
    return this.runGated(() => saveCapture(layout, force));
  }

  Doctor(): string {
    return this.runRead(() => ({
      ok: true,
      errors: [],
      messages: [
        `D-Bus name: ${BUS_NAME}`,
        `D-Bus object path: ${OBJECT_PATH}`,
        `Layouts directory: ${layoutsDir()}`,
        `Schema id: ${LAYOUT_SCHEMA_ID}`,
        `Monitors detected: ${getMonitorCount()}`,
        `Workspaces detected: ${getWorkspaceCount()}`,
      ],
    }));
  }

  ListLayouts(): string {
    return this.runRead(
      () => {
        const status = runtimeStatus();
        return listLayoutsResult(
          listLayouts({
            workspaces: status.workspaces.map((workspace) => workspace.name),
            monitors: status.monitors.map((monitor) => monitor.index),
          }),
        );
      },
      (error) => listLayoutsResult([], [String(error)]),
    );
  }

  ReadLayout(name: string): string {
    return this.runRead(
      () => {
        const layout = readLayout(name);
        assertLayout(layout);
        return readLayoutResult(layout);
      },
      (error) => readLayoutResult(null, [String(error)]),
    );
  }

  DeleteLayout(name: string): string {
    return this.runGated(() => {
      const path = deleteLayout(name);
      return result([], [`Deleted ${path}`]);
    });
  }

  GetStatus(): string {
    return this.runRead(
      () => statusResult(runtimeStatus()),
      (error) => statusResult(null, [String(error)]),
    );
  }

  GetOverview(): string {
    return this.runRead(
      () => {
        const status = runtimeStatus();
        return overviewResult(
          status,
          listLayouts({
            workspaces: status.workspaces.map((workspace) => workspace.name),
            monitors: status.monitors.map((monitor) => monitor.index),
          }),
        );
      },
      (error) => overviewResult(null, [], [String(error)]),
    );
  }

  private runGated<T extends OperationResult>(
    factory: () => T,
    fallback: (error: unknown) => T = (error) =>
      result([String(error)], []) as unknown as T,
  ): string {
    return JSON.stringify(
      this.operations.run(() => this.withFallback(factory, fallback)),
    );
  }

  private runRead<T extends OperationResult>(
    factory: () => T,
    fallback: (error: unknown) => T = (error) =>
      result([String(error)], []) as unknown as T,
  ): string {
    return JSON.stringify(this.withFallback(factory, fallback));
  }

  private withFallback<T extends OperationResult>(
    factory: () => T,
    fallback: (error: unknown) => T,
  ): T {
    try {
      return factory();
    } catch (error) {
      return fallback(error);
    }
  }
}
