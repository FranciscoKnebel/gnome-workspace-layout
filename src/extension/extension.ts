import Gio from 'gi://Gio';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { assertLayout, LAYOUT_SCHEMA_ID } from '../shared/layout.js';
import {
  listLayoutsResult,
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
    return JSON.stringify(this.operations.run(() => applyLayout(name)));
  }

  Setup(name: string, includeMinimized: boolean): string {
    return JSON.stringify(
      this.operations.run(() => captureLayout(name, includeMinimized, false)),
    );
  }

  SetupForce(name: string, includeMinimized: boolean): string {
    return JSON.stringify(
      this.operations.run(() => captureLayout(name, includeMinimized, true)),
    );
  }

  PreviewSetup(
    name: string,
    includeMinimized: boolean,
    force: boolean,
  ): string {
    return JSON.stringify(
      this.operations.run(() => previewCapture(name, includeMinimized, force)),
    );
  }

  SaveSetup(layout: string, force: boolean): string {
    return JSON.stringify(
      this.operations.run(() => saveCapture(layout, force)),
    );
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
        `Monitors detected: ${getMonitorCount()}`,
        `Workspaces detected: ${getWorkspaceCount()}`,
      ],
    } satisfies OperationResult);
  }

  ListLayouts(): string {
    try {
      const status = runtimeStatus();
      return JSON.stringify(
        listLayoutsResult(
          listLayouts({
            workspaces: status.workspaces.map((workspace) => workspace.name),
            monitors: status.monitors.map((monitor) => monitor.index),
          }),
        ),
      );
    } catch (error) {
      return JSON.stringify(listLayoutsResult([], [String(error)]));
    }
  }

  ReadLayout(name: string): string {
    try {
      const layout = readLayout(name);
      assertLayout(layout);
      return JSON.stringify(readLayoutResult(layout));
    } catch (error) {
      return JSON.stringify(readLayoutResult(undefined, [String(error)]));
    }
  }

  DeleteLayout(name: string): string {
    return JSON.stringify(
      this.operations.run(() => {
        try {
          const path = deleteLayout(name);
          return result([], [`Deleted ${path}`]);
        } catch (error) {
          return result([String(error)], []);
        }
      }),
    );
  }

  GetStatus(): string {
    try {
      return JSON.stringify(statusResult(runtimeStatus()));
    } catch (error) {
      return JSON.stringify(statusResult(undefined, [String(error)]));
    }
  }
}
