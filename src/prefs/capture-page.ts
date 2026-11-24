import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import {
  selectCapturedWindows,
  type CapturePreview,
} from '../shared/capture.js';
import {
  layoutWindowsInApplyOrder,
  validateLayoutName,
  type LayoutFile,
  type LayoutWindowTarget,
} from '../shared/layout.js';
import type { LayoutSummary } from '../shared/layout-summary.js';
import type { OperationResult } from '../shared/result.js';
import type { ExtensionClient } from './client.js';
import { formatWindowDetails, formatWindowTitle, singleLine } from './ui.js';

type CapturePageOptions = {
  client: ExtensionClient;
  onSaved: (name: string) => void;
};

type WindowCheck = {
  index: number;
  check: any;
};

export class CapturePage {
  readonly page: any;
  private readonly options: CapturePageOptions;
  private readonly formGroup: any;
  private readonly previewGroup: any;
  private readonly saveGroup: any;
  private readonly resultGroup: any;
  private readonly nameRow: any;
  private readonly includeMinimizedRow: any;
  private readonly forceRow: any;
  private readonly nameStatusRow: any;
  private readonly previewButton: any;
  private readonly saveButton: any;
  private readonly discardButton: any;
  private readonly resultRows = new Map<any, any[]>();
  private readonly previewRows: any[] = [];
  private readonly checks: WindowCheck[] = [];
  private preview: LayoutFile | null = null;
  private layouts: LayoutSummary[] = [];
  private connected = false;
  private busy = false;

  constructor(options: CapturePageOptions) {
    this.options = options;
    this.page = new Adw.PreferencesPage({
      title: 'Capture',
      icon_name: 'camera-photo-symbolic',
    });
    this.formGroup = new Adw.PreferencesGroup({
      title: 'Capture the current arrangement',
      description:
        'The preview is a snapshot. It does not close, move, or minimize any live window.',
    });
    this.previewGroup = new Adw.PreferencesGroup({
      title: 'Windows to keep',
      description: 'Unchecked windows are left out of the saved layout.',
    });
    this.previewGroup.visible = false;
    this.saveGroup = new Adw.PreferencesGroup();
    this.saveGroup.visible = false;
    this.resultGroup = new Adw.PreferencesGroup({ title: 'Result' });
    this.resultGroup.visible = false;

    this.nameRow = new Adw.EntryRow({ title: 'Layout name' });
    this.includeMinimizedRow = new Adw.SwitchRow({
      title: 'Include minimized windows',
      subtitle: 'Captured minimized windows stay minimized in the layout.',
    });
    this.forceRow = new Adw.SwitchRow({
      title: 'Replace an existing layout',
      subtitle: 'Overwrites the layout file with the same name.',
    });
    this.nameStatusRow = new Adw.ActionRow({
      title: 'Name',
      subtitle: 'Enter a name for the new layout.',
    });

    const previewActionRow = new Adw.ActionRow({
      title: 'Preview current windows',
      subtitle: 'Reads the arrangement without saving anything.',
    });
    this.previewButton = new Gtk.Button({
      label: 'Preview',
      valign: Gtk.Align.CENTER,
    });
    this.previewButton.add_css_class('suggested-action');
    this.previewButton.connect('clicked', () => this.previewCapture());
    previewActionRow.add_suffix(this.previewButton);

    const saveActionRow = new Adw.ActionRow({
      title: 'Save layout',
      subtitle: 'Only the checked windows are written to the layout file.',
    });
    this.saveButton = new Gtk.Button({
      label: 'Save layout',
      valign: Gtk.Align.CENTER,
    });
    this.saveButton.add_css_class('suggested-action');
    this.saveButton.connect('clicked', () => this.saveLayout());
    saveActionRow.add_suffix(this.saveButton);

    const discardActionRow = new Adw.ActionRow({
      title: 'Discard preview',
      subtitle: 'Keeps the current layout files unchanged.',
    });
    this.discardButton = new Gtk.Button({
      label: 'Discard',
      valign: Gtk.Align.CENTER,
    });
    this.discardButton.connect('clicked', () => this.clearPreview());
    discardActionRow.add_suffix(this.discardButton);

    this.saveGroup.add(saveActionRow);
    this.saveGroup.add(discardActionRow);

    this.formGroup.add(this.nameRow);
    this.formGroup.add(this.includeMinimizedRow);
    this.formGroup.add(this.forceRow);
    this.formGroup.add(this.nameStatusRow);
    this.formGroup.add(previewActionRow);

    this.page.add(this.formGroup);
    this.page.add(this.previewGroup);
    this.page.add(this.saveGroup);
    this.page.add(this.resultGroup);

    this.nameRow.connect('notify::text', () => this.onNameChanged());
    this.includeMinimizedRow.connect('notify::active', () =>
      this.clearPreview(),
    );
    this.forceRow.connect('notify::active', () => this.onNameChanged());
  }

  setBusy(busy: boolean): void {
    this.busy = busy;
    this.updateSensitivity();
  }

  setLayouts(layouts: LayoutSummary[], connected: boolean): void {
    this.layouts = layouts;
    this.connected = connected;
    this.updateNameStatus();
    this.updateSensitivity();
  }

  focusName(): void {
    this.nameRow.grab_focus();
  }

  startCapture(): void {
    this.clearPreview();
    this.resultGroup.visible = false;
    this.focusName();
  }

  private onNameChanged(): void {
    this.clearPreview();
    this.updateNameStatus();
  }

  private updateNameStatus(): void {
    const name = this.nameRow.get_text();
    const nameErrors = validateLayoutName(name);

    if (nameErrors.length > 0) {
      this.nameStatusRow.set_subtitle(nameErrors[0]);
    } else if (this.layouts.some((layout) => layout.name === name)) {
      this.nameStatusRow.set_subtitle(
        this.forceRow.get_active()
          ? 'The existing layout with this name will be replaced.'
          : 'This name already exists. Enable Replace an existing layout to overwrite it.',
      );
    } else {
      this.nameStatusRow.set_subtitle('New layout.');
    }
  }

  private updateSensitivity(): void {
    this.nameRow.set_sensitive(!this.busy);
    this.includeMinimizedRow.set_sensitive(!this.busy);
    this.forceRow.set_sensitive(!this.busy);
    this.previewButton.set_sensitive(!this.busy && this.connected);
    this.saveButton.set_sensitive(
      !this.busy && this.preview !== null && this.checkedCount() > 0,
    );
    this.discardButton.set_sensitive(!this.busy && this.preview !== null);
  }

  private previewCapture(): void {
    const name = this.nameRow.get_text();
    const nameErrors = validateLayoutName(name);

    if (nameErrors.length > 0) {
      this.showMessages({
        ok: false,
        errors: nameErrors,
        messages: [],
      });
      return;
    }

    this.clearPreview();
    const preview = this.options.client.call<CapturePreview>(
      'PreviewSetup',
      'sbb',
      [name, this.includeMinimizedRow.get_active(), this.forceRow.get_active()],
    );

    if (!preview.ok || preview.layout === undefined) {
      this.showMessages(preview);
      return;
    }

    this.preview = preview.layout;
    this.buildPreviewRows(preview.layout);
    this.previewGroup.visible = true;
    this.saveGroup.visible = true;
    this.resultGroup.visible = false;
    this.updateSensitivity();
  }

  private buildPreviewRows(layout: LayoutFile): void {
    this.clearPreviewRows();

    const targets = layoutWindowsInApplyOrder(layout);
    const groups = new Map<string, Array<{ index: number; target: any }>>();

    targets.forEach((target: LayoutWindowTarget, index: number) => {
      const label =
        target.kind === 'sticky'
          ? 'All workspaces (sticky)'
          : target.workspaceName;
      const group = groups.get(label) ?? [];
      group.push({ index, target });
      groups.set(label, group);
    });

    for (const [label, entries] of groups) {
      const expander = new Adw.ExpanderRow({
        title: singleLine(label),
        subtitle: plural(entries.length, 'window'),
      });
      expander.set_expanded(true);

      for (const entry of entries) {
        const windowRow = new Adw.ActionRow({
          title: formatWindowTitle(entry.target.window),
          subtitle: formatWindowDetails(entry.target.window),
        });
        windowRow.set_subtitle_lines(2);
        const check = new Gtk.CheckButton({
          active: true,
          valign: Gtk.Align.CENTER,
        });
        check.connect('toggled', () => this.updateSensitivity());
        windowRow.add_suffix(check);
        expander.add_row(windowRow);
        this.checks.push({ index: entry.index, check });
      }

      this.previewGroup.add(expander);
      this.previewRows.push(expander);
    }
  }

  private saveLayout(): void {
    if (this.preview === null) {
      return;
    }

    let selected: LayoutFile;
    try {
      selected = selectCapturedWindows(
        this.preview,
        this.checks
          .filter((entry) => entry.check.get_active())
          .map((entry) => entry.index),
      );
    } catch (error) {
      this.showMessages({
        ok: false,
        errors: [error instanceof Error ? error.message : String(error)],
        messages: [],
      });
      return;
    }

    const savedName = selected.name;
    const response = this.options.client.call<OperationResult>(
      'SaveSetup',
      'sb',
      [JSON.stringify(selected), this.forceRow.get_active()],
    );

    if (!response.ok) {
      this.showMessages(response);
      return;
    }

    this.clearPreview();
    this.options.onSaved(savedName);
  }

  private clearPreview(): void {
    this.preview = null;
    this.clearPreviewRows();
    this.previewGroup.visible = false;
    this.saveGroup.visible = false;
    this.updateSensitivity();
  }

  private clearPreviewRows(): void {
    for (const row of this.previewRows) {
      this.previewGroup.remove(row);
    }

    this.previewRows.length = 0;
    this.checks.length = 0;
  }

  private checkedCount(): number {
    return this.checks.filter((entry) => entry.check.get_active()).length;
  }

  private showMessages(messageResult: OperationResult): void {
    this.clearGroup(this.resultGroup);

    if (
      messageResult.messages.length === 0 &&
      messageResult.errors.length === 0
    ) {
      this.resultGroup.visible = false;
      return;
    }

    for (const message of messageResult.messages) {
      const row = new Adw.ActionRow({
        title: 'Message',
        subtitle: singleLine(message),
      });
      row.add_prefix(new Gtk.Image({ icon_name: 'emblem-ok-symbolic' }));
      this.addRow(this.resultGroup, row);
    }

    for (const error of messageResult.errors) {
      const row = new Adw.ActionRow({
        title: 'Error',
        subtitle: singleLine(error),
      });
      row.set_subtitle_selectable(true);
      row.add_prefix(new Gtk.Image({ icon_name: 'dialog-error-symbolic' }));
      this.addRow(this.resultGroup, row);
    }

    this.resultGroup.visible = true;
  }

  private addRow(group: any, row: any): void {
    const rows = this.resultRows.get(group) ?? [];
    rows.push(row);
    this.resultRows.set(group, rows);
    group.add(row);
  }

  private clearGroup(group: any): void {
    for (const row of this.resultRows.get(group) ?? []) {
      group.remove(row);
    }

    this.resultRows.set(group, []);
  }
}

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}
