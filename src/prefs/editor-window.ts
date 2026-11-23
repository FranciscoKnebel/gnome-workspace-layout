import Adw from 'gi://Adw';
import cairo from 'cairo';
import Gtk from 'gi://Gtk';
import { absoluteToRelative } from '../shared/geometry.js';
import {
  editorPosition,
  editorRect,
  editorTargets,
  hitEditorHandle,
  hitEditorRect,
  moveEditorRect,
  resizeEditorRect,
  withEditorMonitor,
  withEditorPosition,
  type EditorHandle,
  type EditorRect,
} from '../shared/layout-editor.js';
import { POSITION_PRESETS, type LayoutFile } from '../shared/layout.js';
import type { OperationResult } from '../shared/result.js';
import type { MonitorStatus, RuntimeStatus } from '../shared/status.js';
import type { ExtensionClient } from './client.js';
import { showResult, singleLine } from './ui.js';

type EditorWindowOptions = {
  parentWindow: any;
  client: ExtensionClient;
  name: string;
  status: RuntimeStatus;
  layout: LayoutFile;
  onSaved: () => void;
};

type DragState = {
  index: number;
  mode: 'move' | 'resize';
  handle?: EditorHandle;
  rect: EditorRect;
};

type CanvasMetrics = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

const CANVAS_PADDING = 16;
const HANDLE_RADIUS_PX = 8;

export class EditorWindow {
  private readonly options: EditorWindowOptions;
  private readonly window: any;
  private readonly drawing: any;
  private readonly initialLayout: LayoutFile;
  private readonly monitors: MonitorStatus[];
  private readonly viewDropdown: any;
  private readonly monitorDropdown: any;
  private readonly presetDropdown: any;
  private readonly xEntry: any;
  private readonly yEntry: any;
  private readonly widthEntry: any;
  private readonly heightEntry: any;
  private readonly selectionRow: any;
  private readonly workspaceRow: any;
  private readonly statusRow: any;
  private readonly windowsGroup: any;
  private readonly saveButton: any;
  private layout: LayoutFile;
  private monitorIndex: number;
  private selectedIndex: number | null = null;
  private visible: Array<{ index: number; rect: EditorRect }> = [];
  private windowRows: any[] = [];
  private drag: DragState | null = null;
  private metrics: CanvasMetrics = { scale: 1, offsetX: 0, offsetY: 0 };
  private updating = false;

  constructor(options: EditorWindowOptions) {
    this.options = options;
    this.monitors = options.status.monitors;
    this.monitorIndex = this.monitors[0].index;
    this.initialLayout = copyLayout(options.layout);
    this.layout = copyLayout(options.layout);

    this.window = new Adw.Window({
      title: `Edit ${options.name}`,
      default_width: 1100,
      default_height: 720,
    });
    this.window.set_transient_for(options.parentWindow);
    this.window.set_modal(true);

    const toolbar = new Adw.ToolbarView();
    const header = new Adw.HeaderBar();
    const cancelButton = new Gtk.Button({ label: 'Cancel' });
    cancelButton.connect('clicked', () => this.window.destroy());
    const revertButton = new Gtk.Button({ label: 'Revert' });
    revertButton.connect('clicked', () => this.revert());
    this.saveButton = new Gtk.Button({ label: 'Save layout' });
    this.saveButton.add_css_class('suggested-action');
    this.saveButton.connect('clicked', () => this.save());
    header.pack_start(cancelButton);
    header.pack_start(revertButton);
    header.pack_end(this.saveButton);
    toolbar.add_top_bar(header);

    const paned = new Gtk.Paned({
      orientation: Gtk.Orientation.HORIZONTAL,
      wide_handle: true,
      position: 560,
    });
    paned.set_resize_start_child(true);
    paned.set_resize_end_child(false);
    paned.set_shrink_start_child(true);
    paned.set_shrink_end_child(false);

    this.drawing = new Gtk.DrawingArea({
      hexpand: true,
      vexpand: true,
    });
    this.drawing.set_draw_func(
      (_area: any, cr: any, width: number, height: number) =>
        this.draw(cr, width, height),
    );
    this.addDragGesture();

    const leftBox = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 12,
    });
    const viewGroup = new Adw.PreferencesGroup({
      title: 'Monitor',
      description: 'Select the monitor shown on the canvas.',
    });
    const viewRow = new Adw.ActionRow({ title: 'View' });
    this.viewDropdown = this.buildMonitorDropdown((index) =>
      this.changeViewMonitor(index),
    );
    viewRow.add_suffix(this.viewDropdown);
    viewGroup.add(viewRow);
    leftBox.append(viewGroup);
    leftBox.append(this.drawing);

    const page = new Adw.PreferencesPage();
    const selectionGroup = new Adw.PreferencesGroup({
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
    this.monitorDropdown = this.buildMonitorDropdown((index) =>
      this.changeWindowMonitor(index),
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
    this.presetDropdown.connect('notify::selected', () => this.changePreset());
    presetRow.add_suffix(this.presetDropdown);

    this.xEntry = this.buildPercentEntry();
    this.yEntry = this.buildPercentEntry();
    this.widthEntry = this.buildPercentEntry();
    this.heightEntry = this.buildPercentEntry();
    const xRow = this.buildPercentRow('X', this.xEntry, 'x');
    const yRow = this.buildPercentRow('Y', this.yEntry, 'y');
    const widthRow = this.buildPercentRow('Width', this.widthEntry, 'width');
    const heightRow = this.buildPercentRow(
      'Height',
      this.heightEntry,
      'height',
    );

    this.statusRow = new Adw.ActionRow({ title: 'Message', subtitle: '' });
    this.statusRow.visible = false;

    for (const row of [
      this.selectionRow,
      this.workspaceRow,
      monitorRow,
      presetRow,
      xRow,
      yRow,
      widthRow,
      heightRow,
      this.statusRow,
    ]) {
      selectionGroup.add(row);
    }

    this.windowsGroup = new Adw.PreferencesGroup({
      title: 'Windows in this layout',
      description: 'Select a window to edit its placement.',
    });
    page.add(selectionGroup);
    page.add(this.windowsGroup);

    paned.set_start_child(leftBox);
    paned.set_end_child(page);
    toolbar.set_content(paned);
    this.window.set_content(toolbar);

    this.refreshAll();
  }

  present(): void {
    this.window.present();
  }

  private addDragGesture(): void {
    const gesture = new Gtk.GestureDrag();
    gesture.set_button(1);
    gesture.connect(
      'drag-begin',
      (_gesture: any, startX: number, startY: number) =>
        this.onDragBegin(startX, startY),
    );
    gesture.connect(
      'drag-update',
      (_gesture: any, offsetX: number, offsetY: number) =>
        this.onDragUpdate(offsetX, offsetY),
    );
    gesture.connect('drag-end', () => this.onDragEnd());
    this.drawing.add_controller(gesture);
  }

  private buildMonitorDropdown(onChanged: (index: number) => void): any {
    const model = new Gtk.StringList({
      strings: this.monitors.map((monitor) => `Monitor ${monitor.index}`),
    });
    const dropdown = new Gtk.DropDown({
      model,
      valign: Gtk.Align.CENTER,
    });
    dropdown.connect('notify::selected', () => {
      if (this.updating) {
        return;
      }

      const selected = dropdown.get_selected();
      const monitor = this.monitors[selected];
      if (monitor !== undefined) {
        onChanged(monitor.index);
      }
    });
    return dropdown;
  }

  private buildPercentEntry(): any {
    const entry = new Gtk.Entry({
      text: '0',
      width_chars: 7,
      valign: Gtk.Align.CENTER,
    });
    entry.connect('activate', () => this.commitPercentEntries());
    return entry;
  }

  private buildPercentRow(title: string, entry: any, field: string): any {
    const row = new Adw.ActionRow({ title: `${title} (%)` });
    row.add_suffix(entry);

    entry.connect('notify::has-focus', () => {
      if (!entry.get_has_focus() && !this.updating) {
        this.commitPercentField(field, entry.get_text());
      }
    });

    return row;
  }

  private currentMonitor(): MonitorStatus {
    return (
      this.monitors.find((monitor) => monitor.index === this.monitorIndex) ??
      this.monitors[0]
    );
  }

  private monitorSize(): { width: number; height: number } {
    const monitor = this.currentMonitor();
    return { width: monitor.width, height: monitor.height };
  }

  private monitorRect(): EditorRect {
    return { x: 0, y: 0, ...this.monitorSize() };
  }

  private computeMetrics(width: number, height: number): CanvasMetrics {
    const size = this.monitorSize();
    const availableWidth = Math.max(1, width - CANVAS_PADDING * 2);
    const availableHeight = Math.max(1, height - CANVAS_PADDING * 2);
    const scale = Math.min(
      availableWidth / Math.max(1, size.width),
      availableHeight / Math.max(1, size.height),
    );

    return {
      scale,
      offsetX: (width - size.width * scale) / 2,
      offsetY: (height - size.height * scale) / 2,
    };
  }

  private draw(cr: any, width: number, height: number): void {
    this.metrics = this.computeMetrics(width, height);
    const size = this.monitorSize();
    const { scale, offsetX, offsetY } = this.metrics;
    const monitorWidth = size.width * scale;
    const monitorHeight = size.height * scale;

    cr.setSourceRGBA(0, 0, 0, 0);
    cr.paint();
    cr.setSourceRGBA(0.1, 0.1, 0.12, 1);
    cr.rectangle(offsetX, offsetY, monitorWidth, monitorHeight);
    cr.fill();
    cr.setSourceRGBA(0.55, 0.55, 0.6, 1);
    cr.setLineWidth(1);
    cr.rectangle(offsetX, offsetY, monitorWidth, monitorHeight);
    cr.stroke();

    for (const entry of this.visible) {
      const selected = entry.index === this.selectedIndex;
      const x = offsetX + entry.rect.x * scale;
      const y = offsetY + entry.rect.y * scale;
      const rectWidth = entry.rect.width * scale;
      const rectHeight = entry.rect.height * scale;

      if (selected) {
        cr.setSourceRGBA(0.95, 0.65, 0.2, 0.32);
      } else {
        cr.setSourceRGBA(0.25, 0.55, 0.9, 0.22);
      }
      cr.rectangle(x, y, rectWidth, rectHeight);
      cr.fill();

      if (selected) {
        cr.setSourceRGBA(1, 0.75, 0.3, 1);
        cr.setLineWidth(2);
      } else {
        cr.setSourceRGBA(0.35, 0.65, 1, 0.9);
        cr.setLineWidth(1);
      }
      cr.rectangle(x, y, rectWidth, rectHeight);
      cr.stroke();

      const target = editorTargets(this.layout)[entry.index];
      if (target !== undefined) {
        cr.selectFontFace(
          'Sans',
          cairo.FontSlant.NORMAL,
          cairo.FontWeight.NORMAL,
        );
        cr.setFontSize(11);
        cr.setSourceRGBA(1, 1, 1, 0.95);
        cr.moveTo(x + 6, y + 16);
        cr.showText(singleLine(target.label).slice(0, 48));
      }
    }

    const selectedRect = this.selectedRect();
    if (selectedRect !== null) {
      const x = offsetX + selectedRect.x * scale;
      const y = offsetY + selectedRect.y * scale;
      const rectWidth = selectedRect.width * scale;
      const rectHeight = selectedRect.height * scale;
      const points = [
        [x, y],
        [x + rectWidth / 2, y],
        [x + rectWidth, y],
        [x + rectWidth, y + rectHeight / 2],
        [x + rectWidth, y + rectHeight],
        [x + rectWidth / 2, y + rectHeight],
        [x, y + rectHeight],
        [x, y + rectHeight / 2],
      ];

      cr.setSourceRGBA(1, 1, 1, 1);
      cr.setLineWidth(1);
      for (const [handleX, handleY] of points) {
        cr.rectangle(handleX - 4, handleY - 4, 8, 8);
        cr.fill();
        cr.setSourceRGBA(0.1, 0.1, 0.12, 1);
        cr.rectangle(handleX - 4, handleY - 4, 8, 8);
        cr.stroke();
        cr.setSourceRGBA(1, 1, 1, 1);
      }
    }
  }

  private selectedRect(): EditorRect | null {
    if (this.selectedIndex === null) {
      return null;
    }

    return (
      this.visible.find((entry) => entry.index === this.selectedIndex)?.rect ??
      null
    );
  }

  private toMonitorPoint(
    widgetX: number,
    widgetY: number,
  ): { x: number; y: number } {
    const { scale, offsetX, offsetY } = this.metrics;
    return {
      x: (widgetX - offsetX) / scale,
      y: (widgetY - offsetY) / scale,
    };
  }

  private onDragBegin(startX: number, startY: number): void {
    const point = this.toMonitorPoint(startX, startY);
    const selected = this.selectedRect();
    const handleRadius = HANDLE_RADIUS_PX / this.metrics.scale;
    const handle =
      selected === null ? null : hitEditorHandle(selected, point, handleRadius);

    if (selected !== null && handle !== null && this.selectedIndex !== null) {
      this.drag = {
        index: this.selectedIndex,
        mode: 'resize',
        handle,
        rect: { ...selected },
      };
      return;
    }

    const hit = hitEditorRect(this.visible, point);
    if (hit === null) {
      this.drag = null;
      this.setSelection(null);
      return;
    }

    const rect = this.visible.find((entry) => entry.index === hit)?.rect;
    if (rect === undefined) {
      return;
    }

    this.setSelection(hit);
    this.drag = { index: hit, mode: 'move', rect: { ...rect } };
  }

  private onDragUpdate(offsetX: number, offsetY: number): void {
    if (this.drag === null) {
      return;
    }

    const size = this.monitorSize();
    const dx = offsetX / this.metrics.scale;
    const dy = offsetY / this.metrics.scale;
    const rect =
      this.drag.mode === 'move' || this.drag.handle === undefined
        ? moveEditorRect(this.drag.rect, dx, dy, size)
        : resizeEditorRect(this.drag.rect, this.drag.handle, dx, dy, size);

    this.layout = withEditorPosition(
      this.layout,
      this.drag.index,
      editorPosition(rect, size),
    );
    this.refreshCanvas();
    this.refreshSelectedControls();
  }

  private onDragEnd(): void {
    if (this.drag === null) {
      return;
    }

    this.drag = null;
    this.refreshWindowRows();
  }

  private changeViewMonitor(monitorIndex: number): void {
    this.monitorIndex = monitorIndex;
    this.refreshCanvas();
    const first = this.visible[0];
    this.setSelection(first?.index ?? null);
    this.setMonitorSelection(this.viewDropdown, monitorIndex);
  }

  private changeWindowMonitor(monitorIndex: number): void {
    if (this.selectedIndex === null) {
      return;
    }

    this.layout = withEditorMonitor(
      this.layout,
      this.selectedIndex,
      monitorIndex,
    );
    this.refreshCanvas();
    this.refreshWindowRows();
    this.refreshSelectedControls();
  }

  private changePreset(): void {
    if (
      this.updating ||
      this.selectedIndex === null ||
      this.presetDropdown.get_selected() === 0
    ) {
      return;
    }

    const preset = POSITION_PRESETS[this.presetDropdown.get_selected() - 1];
    if (preset !== undefined) {
      this.layout = withEditorPosition(this.layout, this.selectedIndex, preset);
      this.refreshCanvas();
      this.refreshSelectedControls();
    }
  }

  private commitPercentEntries(): void {
    const fields = [
      ['x', this.xEntry],
      ['y', this.yEntry],
      ['width', this.widthEntry],
      ['height', this.heightEntry],
    ] as const;

    let changed = false;
    for (const [field, entry] of fields) {
      changed = this.commitPercentField(field, entry.get_text()) || changed;
    }

    if (changed) {
      this.refreshWindowRows();
    }
  }

  private commitPercentField(field: string, text: string): boolean {
    if (this.updating || this.selectedIndex === null) {
      return false;
    }

    const value = Number.parseFloat(text.replace('%', '').trim());
    if (!Number.isFinite(value)) {
      this.showStatus(`Enter a number for ${field}.`);
      return false;
    }

    const size = this.monitorSize();
    const target = editorTargets(this.layout)[this.selectedIndex];
    if (target === undefined) {
      return false;
    }

    const relative = absoluteToRelative(
      editorRect(target.position, size),
      this.monitorRect(),
    );
    const next = { ...relative, [field]: value / 100 };
    let rect = editorRect(next, size);
    rect = moveEditorRect(rect, 0, 0, size);
    rect = resizeEditorRect(rect, 'se', 0, 0, size);
    this.layout = withEditorPosition(
      this.layout,
      this.selectedIndex,
      editorPosition(rect, size),
    );
    this.hideStatus();
    this.refreshCanvas();
    this.refreshSelectedControls();
    return true;
  }

  private setSelection(index: number | null): void {
    if (this.selectedIndex === index) {
      return;
    }

    this.selectedIndex = index;
    this.refreshWindowRows();
    this.refreshSelectedControls();
    this.drawing.queue_draw();
  }

  private refreshAll(): void {
    this.setMonitorSelection(this.viewDropdown, this.monitorIndex);
    this.refreshCanvas();
    this.refreshWindowRows();
    this.refreshSelectedControls();
    this.hideStatus();
  }

  private refreshCanvas(): void {
    const size = this.monitorSize();
    this.visible = editorTargets(this.layout)
      .filter((target) => target.monitor === this.monitorIndex)
      .map((target) => ({
        index: target.index,
        rect: editorRect(target.position, size),
      }));
    this.drawing.queue_draw();
  }

  private refreshWindowRows(): void {
    for (const row of this.windowRows) {
      this.windowsGroup.remove(row);
    }
    this.windowRows = [];

    for (const target of editorTargets(this.layout)) {
      const row = new Adw.ActionRow({
        title: singleLine(target.label),
        subtitle: `${singleLine(target.workspaceLabel)} | Monitor ${target.monitor}`,
      });
      row.set_subtitle_lines(2);
      row.set_activatable(true);

      if (target.index === this.selectedIndex) {
        row.add_prefix(new Gtk.Image({ icon_name: 'emblem-default-symbolic' }));
      }

      row.connect('activated', () => {
        this.changeViewMonitor(target.monitor);
        this.setSelection(target.index);
      });
      this.windowsGroup.add(row);
      this.windowRows.push(row);
    }
  }

  private refreshSelectedControls(): void {
    this.updating = true;
    const target =
      this.selectedIndex === null
        ? undefined
        : editorTargets(this.layout)[this.selectedIndex];

    if (target === undefined) {
      this.selectionRow.set_subtitle('No window selected');
      this.workspaceRow.set_subtitle('None');
      this.monitorDropdown.set_sensitive(false);
      this.presetDropdown.set_sensitive(false);
      this.xEntry.set_sensitive(false);
      this.yEntry.set_sensitive(false);
      this.widthEntry.set_sensitive(false);
      this.heightEntry.set_sensitive(false);
      this.updating = false;
      return;
    }

    this.selectionRow.set_subtitle(singleLine(target.label));
    this.workspaceRow.set_subtitle(singleLine(target.workspaceLabel));
    this.monitorDropdown.set_sensitive(true);
    this.presetDropdown.set_sensitive(true);
    this.xEntry.set_sensitive(true);
    this.yEntry.set_sensitive(true);
    this.widthEntry.set_sensitive(true);
    this.heightEntry.set_sensitive(true);
    this.setMonitorSelection(this.monitorDropdown, target.monitor);

    if (typeof target.position === 'string') {
      this.presetDropdown.set_selected(
        POSITION_PRESETS.indexOf(target.position) + 1,
      );
    } else {
      this.presetDropdown.set_selected(0);
    }

    const size = this.monitorSize();
    const relative = absoluteToRelative(
      editorRect(target.position, size),
      this.monitorRect(),
    );
    this.xEntry.set_text(formatPercent(relative.x));
    this.yEntry.set_text(formatPercent(relative.y));
    this.widthEntry.set_text(formatPercent(relative.width));
    this.heightEntry.set_text(formatPercent(relative.height));
    this.updating = false;
  }

  private setMonitorSelection(dropdown: any, monitorIndex: number): void {
    const position = this.monitors.findIndex(
      (monitor) => monitor.index === monitorIndex,
    );

    if (position >= 0) {
      dropdown.set_selected(position);
    }
  }

  private showStatus(message: string): void {
    this.statusRow.set_subtitle(singleLine(message));
    this.statusRow.visible = true;
  }

  private hideStatus(): void {
    this.statusRow.visible = false;
  }

  private revert(): void {
    this.layout = copyLayout(this.initialLayout);
    this.monitorIndex = this.monitors[0].index;
    this.selectedIndex = null;
    this.drag = null;
    this.refreshAll();
  }

  private save(): void {
    const response = this.options.client.call<OperationResult>(
      'SaveSetup',
      'sb',
      [JSON.stringify(this.layout), true],
    );

    if (!response.ok) {
      showResult(this.window, 'Could not save layout', response);
      return;
    }

    this.window.destroy();
    this.options.onSaved();
    showResult(this.options.parentWindow, 'Layout updated', response);
  }
}

function copyLayout(layout: LayoutFile): LayoutFile {
  return JSON.parse(JSON.stringify(layout)) as LayoutFile;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 1000) / 10}`;
}
