import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import type { LayoutSummary } from '../shared/layout-summary.js';
import { formatTimestamp, plural, RowGroup, singleLine } from './ui.js';

type LayoutsPageOptions = {
  onApply: (name: string) => void;
  onRemap: (summary: LayoutSummary) => void;
  onEdit: (summary: LayoutSummary) => void;
  onDelete: (summary: LayoutSummary) => void;
  onOpenLayout: (summary: LayoutSummary) => void;
  onCapture: () => void;
  onRefresh: () => void;
};

type ApplyButton = {
  name: string;
  valid: boolean;
  button: any;
};

export class LayoutsPage {
  readonly page: any;
  private readonly options: LayoutsPageOptions;
  private readonly listGroup: any;
  private readonly actionsGroup: any;
  private readonly listRows: RowGroup;
  private applyButtons: ApplyButton[] = [];
  private actionButtons: any[] = [];
  private applyingName: string | null = null;
  private connected = false;
  private captureRow: any = null;
  private refreshRow: any = null;

  constructor(options: LayoutsPageOptions) {
    this.options = options;
    this.page = new Adw.PreferencesPage({
      title: 'Layouts',
      icon_name: 'view-grid-symbolic',
    });
    this.listGroup = new Adw.PreferencesGroup({
      title: 'Saved layouts',
      description:
        'Layouts are JSON files stored in your user configuration directory.',
    });
    this.actionsGroup = new Adw.PreferencesGroup();
    this.listRows = new RowGroup(this.listGroup);
    this.page.add(this.listGroup);
    this.page.add(this.actionsGroup);

    this.captureRow = new Adw.ButtonRow({
      title: 'Capture the current arrangement',
    });
    this.captureRow.set_end_icon_name('camera-photo-symbolic');
    this.captureRow.connect('activated', this.options.onCapture);
    this.actionsGroup.add(this.captureRow);

    this.refreshRow = new Adw.ButtonRow({ title: 'Refresh list' });
    this.refreshRow.set_end_icon_name('view-refresh-symbolic');
    this.refreshRow.connect('activated', this.options.onRefresh);
    this.actionsGroup.add(this.refreshRow);
  }

  setBusy(busy: boolean): void {
    this.captureRow.set_sensitive(!busy);
    this.refreshRow.set_sensitive(!busy);

    for (const button of this.actionButtons) {
      button.set_sensitive(!busy);
    }

    this.updateApplyButtons();
  }

  setApplying(name: string | null): void {
    this.applyingName = name;
    this.updateApplyButtons();
  }

  setLayouts(
    layouts: LayoutSummary[],
    connected: boolean,
    error: string | null,
  ): void {
    this.connected = connected;
    this.listRows.clear();
    this.applyButtons = [];
    this.actionButtons = [];

    if (!connected) {
      this.listRows.add(
        new Adw.ActionRow({
          title: 'Extension unavailable',
          subtitle:
            error ??
            'Start the extension in GNOME Extensions and refresh this page.',
        }),
      );
      return;
    }

    if (layouts.length === 0) {
      this.listRows.add(
        new Adw.ActionRow({
          title: 'No layouts yet',
          subtitle:
            'Use Capture the current arrangement to create your first layout.',
        }),
      );
      return;
    }

    for (const layout of layouts) {
      this.listRows.add(this.buildLayoutRow(layout));
    }

    this.updateApplyButtons();
  }

  private buildLayoutRow(summary: LayoutSummary): any {
    const row = new Adw.ExpanderRow({
      title: singleLine(summary.name),
      subtitle: summarySubtitle(summary),
    });
    row.set_expanded(
      !summary.valid ||
        summary.missingWorkspaces.length > 0 ||
        summary.missingMonitors.length > 0,
    );

    const applyButton = new Gtk.Button({
      label: 'Apply',
      valign: Gtk.Align.CENTER,
    });
    applyButton.add_css_class('suggested-action');
    applyButton.connect('clicked', () => this.options.onApply(summary.name));
    row.add_suffix(applyButton);
    this.applyButtons.push({
      name: summary.name,
      valid: summary.valid,
      button: applyButton,
    });

    const statusRow = new Adw.ActionRow({
      title: 'Status',
      subtitle: summary.valid ? 'Valid layout' : 'Invalid layout',
    });
    statusRow.set_subtitle_lines(3);
    statusRow.add_prefix(
      new Gtk.Image({
        icon_name: summary.valid
          ? 'emblem-ok-symbolic'
          : 'dialog-error-symbolic',
      }),
    );
    row.add_row(statusRow);

    row.add_row(
      new Adw.ActionRow({
        title: 'Windows',
        subtitle: windowSummary(summary),
      }),
    );

    row.add_row(
      new Adw.ActionRow({
        title: 'Workspaces',
        subtitle: summary.workspaces.map(singleLine).join(', ') || 'None',
      }),
    );

    if (summary.missingWorkspaces.length > 0) {
      const missingRow = new Adw.ActionRow({
        title: 'Missing workspaces',
        subtitle: summary.missingWorkspaces.map(singleLine).join(', '),
      });
      missingRow.set_subtitle_lines(3);
      missingRow.add_prefix(
        new Gtk.Image({ icon_name: 'dialog-warning-symbolic' }),
      );
      const remapButton = new Gtk.Button({
        label: 'Remap',
        valign: Gtk.Align.CENTER,
      });
      remapButton.connect('clicked', () => this.options.onRemap(summary));
      missingRow.add_suffix(remapButton);
      this.actionButtons.push(remapButton);
      row.add_row(missingRow);
    }

    if (summary.missingMonitors.length > 0) {
      const missingMonitors = new Adw.ActionRow({
        title: 'Missing monitors',
        subtitle: summary.missingMonitors
          .map((monitor) => `Monitor ${monitor}`)
          .join(', '),
      });
      missingMonitors.add_prefix(
        new Gtk.Image({ icon_name: 'dialog-warning-symbolic' }),
      );
      row.add_row(missingMonitors);
    }

    if (!summary.valid && summary.errors.length > 0) {
      const errorsRow = new Adw.ActionRow({
        title: 'Validation errors',
        subtitle: summary.errors.map(singleLine).join('\n'),
      });
      errorsRow.set_subtitle_lines(4);
      row.add_row(errorsRow);
    }

    row.add_row(
      new Adw.ActionRow({
        title: 'Last modified',
        subtitle: formatTimestamp(summary.modifiedAt),
      }),
    );

    if (summary.path !== undefined) {
      const fileRow = new Adw.ActionRow({
        title: 'File',
        subtitle: singleLine(summary.path),
      });
      fileRow.set_subtitle_selectable(true);
      fileRow.set_tooltip_text(summary.path);
      const openButton = new Gtk.Button({
        label: 'Open',
        valign: Gtk.Align.CENTER,
      });
      openButton.connect('clicked', () => this.options.onOpenLayout(summary));
      fileRow.add_suffix(openButton);
      row.add_row(fileRow);
    }

    const editRow = new Adw.ActionRow({
      title: 'Edit window positions',
      subtitle: 'Open the visual editor for this layout.',
    });
    const editButton = new Gtk.Button({
      label: 'Edit',
      valign: Gtk.Align.CENTER,
    });
    editButton.connect('clicked', () => this.options.onEdit(summary));
    editRow.add_suffix(editButton);
    this.actionButtons.push(editButton);
    row.add_row(editRow);

    const deleteRow = new Adw.ActionRow({
      title: 'Delete this layout',
      subtitle: 'The layout file is removed from disk.',
    });
    const deleteButton = new Gtk.Button({
      label: 'Delete',
      valign: Gtk.Align.CENTER,
    });
    deleteButton.add_css_class('destructive-action');
    deleteButton.connect('clicked', () => this.options.onDelete(summary));
    deleteRow.add_suffix(deleteButton);
    this.actionButtons.push(deleteButton);
    row.add_row(deleteRow);

    return row;
  }

  private updateApplyButtons(): void {
    for (const entry of this.applyButtons) {
      const isApplying = entry.name === this.applyingName;
      entry.button.set_label(isApplying ? 'Applying...' : 'Apply');
      entry.button.set_sensitive(
        this.connected && this.applyingName === null && entry.valid,
      );
    }
  }
}

function summarySubtitle(summary: LayoutSummary): string {
  const parts = [
    plural(summary.windowCount, 'window'),
    plural(summary.workspaceCount, 'workspace'),
  ];

  if (summary.stickyCount > 0) {
    parts.push(plural(summary.stickyCount, 'sticky window'));
  }

  if (!summary.valid) {
    parts.push('invalid');
  }

  if (summary.missingWorkspaces.length > 0) {
    parts.push(plural(summary.missingWorkspaces.length, 'missing workspace'));
  }

  return parts.join(', ');
}

function windowSummary(summary: LayoutSummary): string {
  const parts = [plural(summary.windowCount, 'window')];

  if (summary.stickyCount > 0) {
    parts.push(plural(summary.stickyCount, 'sticky'));
  }

  return parts.join(', ');
}
