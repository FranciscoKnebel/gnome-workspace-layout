import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { LAYOUT_SCHEMA_ID } from '../shared/layout.js';
import { applyLayout } from './apply-service.js';
import { BUS_NAME, DBUS_XML, OBJECT_PATH } from './constants.js';
import { captureLayout } from './capture-service.js';
import { OperationGate } from './operation-gate.js';
import { layoutsDir } from './paths.js';
import type { OperationResult } from './result.js';
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

  async ApplyAsync([name]: [string], invocation: any): Promise<void> {
    try {
      const result = await this.operations.runAsync(() => applyLayout(name));
      invocation.return_value(
        new GLib.Variant('(s)', [JSON.stringify(result)]),
      );
    } catch (error) {
      invocation.return_dbus_error(
        'com.franciscoknebel.WorkspaceLayout.Error',
        String(error),
      );
    }
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
}
