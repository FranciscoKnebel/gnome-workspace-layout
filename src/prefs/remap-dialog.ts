import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import { remapLayoutWorkspaces } from '../shared/layout-transform.js';
import type { LayoutSummary } from '../shared/layout-summary.js';
import type { RuntimeStatus } from '../shared/status.js';
import type { ExtensionClient } from './client.js';
import { showResult, singleLine } from './ui.js';

type RemapDialogOptions = {
  parentWindow: any;
  client: ExtensionClient;
  summary: LayoutSummary;
  status: RuntimeStatus | null;
  onSaved: () => void;
};

type WorkspaceMapping = {
  source: string;
  dropDown: any;
};

export class RemapDialog {
  private readonly options: RemapDialogOptions;
  private readonly window: any;
  private readonly mappings: WorkspaceMapping[] = [];
  private readonly workspaceNames: string[];
  private readonly errorRow: any;
  private readonly saveButton: any;
  private readonly cancelButton: any;
  private busy = false;

  constructor(options: RemapDialogOptions) {
    this.options = options;
    this.workspaceNames =
      options.status?.workspaces.map((workspace) => workspace.name) ?? [];
    this.window = new Adw.Window({
      title: 'Remap workspaces',
      default_width: 620,
      default_height: 480,
    });
    this.window.set_transient_for(options.parentWindow);
    this.window.set_modal(true);

    const toolbar = new Adw.ToolbarView();
    const header = new Adw.HeaderBar();
    this.cancelButton = new Gtk.Button({ label: 'Cancel' });
    this.cancelButton.connect('clicked', () => this.window.destroy());
    this.saveButton = new Gtk.Button({ label: 'Save remap' });
    this.saveButton.add_css_class('suggested-action');
    this.saveButton.connect('clicked', () => this.save());
    header.pack_start(this.cancelButton);
    header.pack_end(this.saveButton);
    toolbar.add_top_bar(header);

    const page = new Adw.PreferencesPage();
    const group = new Adw.PreferencesGroup({
      title: 'Missing workspaces',
      description:
        'Choose a current workspace for each name used by the layout. The layout file is updated in place.',
    });
    page.add(group);

    if (this.workspaceNames.length === 0) {
      group.add(
        new Adw.ActionRow({
          title: 'Current workspaces are unavailable',
          subtitle:
            'Refresh the status page and start the extension before remapping.',
        }),
      );
      this.saveButton.set_sensitive(false);
    }

    for (const source of options.summary.missingWorkspaces) {
      const row = new Adw.ActionRow({
        title: singleLine(source),
        subtitle: 'Missing workspace referenced by this layout',
      });
      const model = new Gtk.StringList({
        strings: ['Select a workspace', ...this.workspaceNames],
      });
      const dropDown = new Gtk.DropDown({
        model,
        valign: Gtk.Align.CENTER,
      });
      dropDown.set_selected(0);
      row.add_suffix(dropDown);
      group.add(row);
      this.mappings.push({ source, dropDown });
    }

    this.errorRow = new Adw.ActionRow({
      title: 'Status',
      subtitle: '',
    });
    this.errorRow.add_prefix(
      new Gtk.Image({ icon_name: 'dialog-error-symbolic' }),
    );
    this.errorRow.visible = false;
    group.add(this.errorRow);

    toolbar.set_content(page);
    this.window.set_content(toolbar);
  }

  present(): void {
    this.window.present();
  }

  private save(): void {
    if (this.busy || this.options.status === null) {
      return;
    }

    const mapping: Record<string, string> = {};

    for (const entry of this.mappings) {
      const selected = entry.dropDown.get_selected();
      if (selected <= 0) {
        this.showError(`Choose a workspace for ${entry.source}.`);
        return;
      }

      mapping[entry.source] = this.workspaceNames[selected - 1];
    }

    this.setBusy(true);
    const read = this.options.client.readLayout(this.options.summary.name);

    if (!read.ok || read.layout === null) {
      this.setBusy(false);
      this.showError(read.errors.join('\n'));
      return;
    }

    const remapped = {
      ...remapLayoutWorkspaces(read.layout, mapping),
      name: this.options.summary.name,
    };
    const saved = this.options.client.saveSetup(JSON.stringify(remapped), true);

    this.setBusy(false);

    if (!saved.ok) {
      this.showError(saved.errors.join('\n'));
      return;
    }

    this.window.destroy();
    this.options.onSaved();
    showResult(this.options.parentWindow, 'Workspaces remapped', saved);
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    this.saveButton.set_label(busy ? 'Saving...' : 'Save remap');
    this.saveButton.set_sensitive(!busy);
    this.cancelButton.set_sensitive(!busy);

    for (const entry of this.mappings) {
      entry.dropDown.set_sensitive(!busy);
    }
  }

  private showError(message: string): void {
    this.errorRow.set_subtitle(singleLine(message));
    this.errorRow.set_subtitle_selectable(true);
    this.errorRow.visible = true;
  }
}
