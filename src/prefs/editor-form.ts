import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import { absoluteToRelative } from '../shared/geometry.js';
import {
  clampEditorRect,
  editorPosition,
  editorRect,
  type EditorMonitor,
  type EditorTarget,
} from '../shared/layout-editor.js';
import {
  POSITION_PRESETS,
  type PositionPreset,
  type WindowPosition,
} from '../shared/layout.js';
import type { MonitorStatus } from '../shared/status.js';
import {
  buildMonitorDropdown,
  setMonitorSelection,
} from './monitor-widgets.js';
import { singleLine } from './ui.js';

type EditorFormOptions = {
  monitors: MonitorStatus[];
  onMonitorChange: (monitor: number) => void;
  onPresetChange: (preset: PositionPreset) => void;
  onPositionChange: (position: WindowPosition) => void;
};

export class EditorForm {
  readonly group: any;
  private readonly options: EditorFormOptions;
  private readonly selectionRow: any;
  private readonly workspaceRow: any;
  private readonly monitorDropdown: any;
  private readonly presetDropdown: any;
  private readonly entries: Record<string, any>;
  private readonly statusRow: any;
  private currentSize: EditorMonitor | null = null;
  private hasTarget = false;
  private updating = false;

  constructor(options: EditorFormOptions) {
    this.options = options;
    this.group = new Adw.PreferencesGroup({
      title: 'Selected window',
      description:
        'Drag a rectangle to move it, drag its handles to resize it, or enter exact percentages below.',
    });
    this.selectionRow = new Adw.ActionRow({
      title: 'Window',
      subtitle: 'No window selected',
    });
    this.workspaceRow = new Adw.ActionRow({
      title: 'Workspace',
      subtitle: 'None',
    });

    const monitorRow = new Adw.ActionRow({ title: 'Window monitor' });
    this.monitorDropdown = buildMonitorDropdown(
      this.options.monitors,
      (monitor) => options.onMonitorChange(monitor),
      () => this.updating,
    );
    monitorRow.add_suffix(this.monitorDropdown);

    const presetRow = new Adw.ActionRow({ title: 'Position' });
    const presetModel = new Gtk.StringList({
      strings: ['Custom', ...POSITION_PRESETS],
    });
    this.presetDropdown = new Gtk.DropDown({
      model: presetModel,
      valign: Gtk.Align.CENTER,
    });
    this.presetDropdown.connect('notify::selected', () => {
      if (this.updating) {
        return;
      }

      const position = this.presetDropdown.get_selected() - 1;
      const preset = POSITION_PRESETS[position];
      if (preset !== undefined) {
        options.onPresetChange(preset);
      }
    });
    presetRow.add_suffix(this.presetDropdown);

    this.entries = {
      x: this.buildPercentEntry(() => this.commitFields()),
      y: this.buildPercentEntry(() => this.commitFields()),
      width: this.buildPercentEntry(() => this.commitFields()),
      height: this.buildPercentEntry(() => this.commitFields()),
    };

    this.statusRow = new Adw.ActionRow({ title: 'Message', subtitle: '' });
    this.statusRow.visible = false;

    for (const row of [
      this.selectionRow,
      this.workspaceRow,
      monitorRow,
      presetRow,
      this.buildPercentRow('X', this.entries.x),
      this.buildPercentRow('Y', this.entries.y),
      this.buildPercentRow('Width', this.entries.width),
      this.buildPercentRow('Height', this.entries.height),
      this.statusRow,
    ]) {
      this.group.add(row);
    }
  }

  setTarget(
    target: EditorTarget | undefined,
    monitorSize: EditorMonitor,
    monitorRect: { x: number; y: number; width: number; height: number },
  ): void {
    this.hasTarget = true;
    this.currentSize = monitorSize;
    this.updating = true;

    if (target === undefined) {
      this.hasTarget = false;
      this.currentSize = null;
      this.selectionRow.set_subtitle('No window selected');
      this.workspaceRow.set_subtitle('None');
      this.setControlsEnabled(false);
      this.updating = false;
      return;
    }

    this.selectionRow.set_subtitle(singleLine(target.label));
    this.workspaceRow.set_subtitle(singleLine(target.workspaceLabel));
    this.setControlsEnabled(true);
    setMonitorSelection(
      this.monitorDropdown,
      this.options.monitors,
      target.monitor,
    );

    if (typeof target.position === 'string') {
      this.presetDropdown.set_selected(
        POSITION_PRESETS.indexOf(target.position) + 1,
      );
    } else {
      this.presetDropdown.set_selected(0);
    }

    const relative = absoluteToRelative(
      editorRect(target.position, monitorSize),
      monitorRect,
    );
    this.entries.x.set_text(formatPercent(relative.x));
    this.entries.y.set_text(formatPercent(relative.y));
    this.entries.width.set_text(formatPercent(relative.width));
    this.entries.height.set_text(formatPercent(relative.height));
    this.updating = false;
  }

  showStatus(message: string): void {
    this.statusRow.set_subtitle(singleLine(message));
    this.statusRow.visible = true;
  }

  hideStatus(): void {
    this.statusRow.visible = false;
  }

  private buildPercentEntry(onActivate: () => void): any {
    const entry = new Gtk.Entry({
      text: '0',
      width_chars: 7,
      valign: Gtk.Align.CENTER,
    });
    entry.connect('activate', onActivate);
    const focus = new Gtk.EventControllerFocus();
    focus.connect('leave', () => {
      if (!this.updating) {
        onActivate();
      }
    });
    entry.add_controller(focus);
    return entry;
  }

  private buildPercentRow(title: string, entry: any): any {
    const row = new Adw.ActionRow({ title: `${title} (%)` });
    row.add_suffix(entry);
    return row;
  }

  private setControlsEnabled(enabled: boolean): void {
    this.monitorDropdown.set_sensitive(enabled);
    this.presetDropdown.set_sensitive(enabled);

    for (const entry of Object.values(this.entries)) {
      entry.set_sensitive(enabled);
    }
  }

  private commitFields(): void {
    if (this.updating || !this.hasTarget || this.currentSize === null) {
      return;
    }

    const x = parsePercent(this.entries.x.get_text());
    const y = parsePercent(this.entries.y.get_text());
    const width = parsePercent(this.entries.width.get_text());
    const height = parsePercent(this.entries.height.get_text());

    if ([x, y, width, height].some((value) => value === null)) {
      this.showStatus('Enter a number for each percentage.');
      return;
    }

    const rect = clampEditorRect(
      editorRect(
        {
          x: x ?? 0,
          y: y ?? 0,
          width: width ?? 0,
          height: height ?? 0,
        },
        this.currentSize,
      ),
      this.currentSize,
    );
    this.options.onPositionChange(editorPosition(rect, this.currentSize));
  }
}

function parsePercent(text: string): number | null {
  const value = Number.parseFloat(text.replace('%', '').trim());
  return Number.isFinite(value) ? value / 100 : null;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 1000) / 10}`;
}
