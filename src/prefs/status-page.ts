import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import type { RuntimeStatus } from '../shared/status.js';
import { singleLine } from './ui.js';

type StatusPageOptions = {
  onRefresh: () => void;
  onOpenLayoutsFolder: () => void;
};

export class StatusPage {
  readonly page: any;
  private readonly options: StatusPageOptions;
  private readonly connectionGroup: any;
  private readonly pathsGroup: any;
  private readonly workspacesGroup: any;
  private readonly monitorsGroup: any;
  private readonly rows = new Map<any, any[]>();
  private refreshButton: any = null;

  constructor(options: StatusPageOptions) {
    this.options = options;
    this.page = new Adw.PreferencesPage({
      title: 'Status',
      icon_name: 'dialog-information-symbolic',
    });
    this.connectionGroup = new Adw.PreferencesGroup({
      title: 'Extension',
      description:
        'The preferences window talks to the GNOME Shell extension over D-Bus.',
    });
    this.pathsGroup = new Adw.PreferencesGroup({ title: 'Paths' });
    this.workspacesGroup = new Adw.PreferencesGroup({ title: 'Workspaces' });
    this.monitorsGroup = new Adw.PreferencesGroup({ title: 'Monitors' });

    this.page.add(this.connectionGroup);
    this.page.add(this.pathsGroup);
    this.page.add(this.workspacesGroup);
    this.page.add(this.monitorsGroup);
  }

  setBusy(busy: boolean): void {
    if (this.refreshButton !== null) {
      this.refreshButton.set_sensitive(!busy);
    }
  }

  setStatus(status: RuntimeStatus | null, error: string | null): void {
    this.clear(this.connectionGroup);
    this.clear(this.pathsGroup);
    this.clear(this.workspacesGroup);
    this.clear(this.monitorsGroup);
    this.refreshButton = null;

    const connectionRow = new Adw.ActionRow({
      title: 'Connection',
      subtitle:
        status === null ? singleLine(error ?? 'Not connected') : 'Connected',
    });
    connectionRow.add_prefix(
      new Gtk.Image({
        icon_name:
          status === null ? 'dialog-warning-symbolic' : 'emblem-ok-symbolic',
      }),
    );

    if (status === null) {
      connectionRow.set_subtitle_selectable(true);
    }

    this.addRow(this.connectionGroup, connectionRow);

    this.refreshButton = new Gtk.Button({
      label: 'Refresh',
      icon_name: 'view-refresh-symbolic',
      valign: Gtk.Align.CENTER,
    });
    this.refreshButton.connect('clicked', this.options.onRefresh);
    connectionRow.add_suffix(this.refreshButton);

    const layoutsDirectory =
      status?.layoutsDir ??
      GLib.build_filenamev([
        GLib.get_user_config_dir(),
        'workspace-layout',
        'layouts',
      ]);
    const schemaPath =
      status?.schemaPath ??
      GLib.build_filenamev([
        GLib.get_user_data_dir(),
        'workspace-layout',
        'schema',
        'workspace-layout.schema.json',
      ]);

    const layoutsRow = new Adw.ActionRow({
      title: 'Layouts folder',
      subtitle: singleLine(layoutsDirectory),
    });
    layoutsRow.set_subtitle_selectable(true);
    layoutsRow.set_tooltip_text(layoutsDirectory);
    const openButton = new Gtk.Button({
      label: 'Open',
      icon_name: 'folder-open-symbolic',
      valign: Gtk.Align.CENTER,
    });
    openButton.connect('clicked', this.options.onOpenLayoutsFolder);
    layoutsRow.add_suffix(openButton);
    this.addRow(this.pathsGroup, layoutsRow);

    const schemaRow = new Adw.ActionRow({
      title: 'JSON Schema',
      subtitle: singleLine(schemaPath),
    });
    schemaRow.set_subtitle_selectable(true);
    schemaRow.set_tooltip_text(schemaPath);
    this.addRow(this.pathsGroup, schemaRow);

    if (status === null || status.workspaces.length === 0) {
      this.addRow(
        this.workspacesGroup,
        new Adw.ActionRow({
          title: 'No workspaces reported',
          subtitle:
            status === null
              ? 'Start the extension to read the current workspaces.'
              : 'GNOME did not report any workspaces.',
        }),
      );
    } else {
      for (const workspace of status.workspaces) {
        const row = new Adw.ActionRow({
          title: `Workspace ${workspace.index + 1}: ${singleLine(workspace.name)}`,
          subtitle: workspace.active ? 'Active workspace' : 'Inactive',
        });
        row.add_prefix(
          new Gtk.Image({
            icon_name: workspace.active
              ? 'emblem-default-symbolic'
              : 'folder-symbolic',
          }),
        );
        this.addRow(this.workspacesGroup, row);
      }
    }

    if (status === null || status.monitors.length === 0) {
      this.addRow(
        this.monitorsGroup,
        new Adw.ActionRow({
          title: 'No monitors reported',
          subtitle:
            status === null
              ? 'Start the extension to read monitor geometry.'
              : 'GNOME did not report any monitors.',
        }),
      );
    } else {
      for (const monitor of status.monitors) {
        this.addRow(
          this.monitorsGroup,
          new Adw.ActionRow({
            title: `Monitor ${monitor.index}`,
            subtitle: `${monitor.width} x ${monitor.height} at ${monitor.x}, ${monitor.y}`,
          }),
        );
      }
    }
  }

  private addRow(group: any, row: any): void {
    const rows = this.rows.get(group) ?? [];
    rows.push(row);
    this.rows.set(group, rows);
    group.add(row);
  }

  private clear(group: any): void {
    for (const row of this.rows.get(group) ?? []) {
      group.remove(row);
    }

    this.rows.set(group, []);
  }
}
