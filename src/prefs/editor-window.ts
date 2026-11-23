import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import {
  editorPosition,
  editorRect,
  editorTargets,
  hitEditorHandle,
  hitEditorRect,
  moveEditorRect,
  resizeEditorRect,
  type EditorHandle,
  type EditorRect,
  type EditorTarget,
} from '../shared/layout-editor.js';
import {
  withEditorMonitor,
  withEditorPosition,
} from '../shared/layout-transform.js';
import type {
  LayoutFile,
  PositionPreset,
  WindowPosition,
} from '../shared/layout.js';
import type { MonitorStatus, RuntimeStatus } from '../shared/status.js';
import type { ExtensionClient } from './client.js';
import {
  canvasHandleRadius,
  canvasToMonitorPoint,
  drawEditorCanvas,
  type CanvasEntry,
  type CanvasMetrics,
} from './editor-canvas.js';
import { EditorForm } from './editor-form.js';
import { EditorWindowList } from './editor-window-list.js';
import {
  buildMonitorDropdown,
  setMonitorSelection,
} from './monitor-widgets.js';
import { showResult } from './ui.js';

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

export class EditorWindow {
  private readonly options: EditorWindowOptions;
  private readonly window: any;
  private readonly drawing: any;
  private readonly initialLayout: LayoutFile;
  private readonly monitors: MonitorStatus[];
  private readonly viewDropdown: any;
  private readonly form: EditorForm;
  private readonly windowList: EditorWindowList;
  private readonly saveButton: any;
  private layout: LayoutFile;
  private monitorIndex: number;
  private selectedIndex: number | null = null;
  private visible: CanvasEntry[] = [];
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
    this.viewDropdown = buildMonitorDropdown(
      this.monitors,
      (index) => this.changeViewMonitor(index),
      () => this.updating,
    );
    viewRow.add_suffix(this.viewDropdown);
    viewGroup.add(viewRow);
    leftBox.append(viewGroup);
    leftBox.append(this.drawing);

    this.form = new EditorForm({
      monitors: this.monitors,
      onMonitorChange: (monitor) => this.changeWindowMonitor(monitor),
      onPresetChange: (preset) => this.changePreset(preset),
      onPositionChange: (position) => this.changePosition(position),
    });
    this.windowList = new EditorWindowList((target) =>
      this.onWindowSelected(target),
    );

    const page = new Adw.PreferencesPage();
    page.add(this.form.group);
    page.add(this.windowList.group);

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

  private draw(cr: any, width: number, height: number): void {
    this.metrics = drawEditorCanvas(cr, width, height, {
      monitor: this.monitorSize(),
      entries: this.visible,
      selectedIndex: this.selectedIndex,
      selectedRect: this.selectedRect(),
    });
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
    return canvasToMonitorPoint(this.metrics, widgetX, widgetY);
  }

  private onDragBegin(startX: number, startY: number): void {
    const point = this.toMonitorPoint(startX, startY);
    const selected = this.selectedRect();
    const handleRadius = canvasHandleRadius(this.metrics);
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
    this.syncForm();
  }

  private onDragEnd(): void {
    if (this.drag === null) {
      return;
    }

    this.drag = null;
    this.refreshWindowList();
  }

  private onWindowSelected(target: EditorTarget): void {
    this.changeViewMonitor(target.monitor);
    this.setSelection(target.index);
  }

  private changeViewMonitor(monitorIndex: number): void {
    if (this.updating) {
      return;
    }

    this.monitorIndex = monitorIndex;
    this.refreshCanvas();
    const first = this.visible[0];
    this.setSelection(first?.index ?? null);
    setMonitorSelection(this.viewDropdown, this.monitors, monitorIndex);
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
    this.refreshWindowList();
    this.syncForm();
  }

  private changePreset(preset: PositionPreset): void {
    if (this.selectedIndex === null) {
      return;
    }

    this.layout = withEditorPosition(this.layout, this.selectedIndex, preset);
    this.refreshCanvas();
    this.syncForm();
  }

  private changePosition(position: WindowPosition): void {
    if (this.selectedIndex === null) {
      return;
    }

    this.layout = withEditorPosition(this.layout, this.selectedIndex, position);
    this.refreshCanvas();
    this.refreshWindowList();
    this.syncForm();
  }

  private setSelection(index: number | null): void {
    if (this.selectedIndex === index) {
      return;
    }

    this.selectedIndex = index;
    this.refreshWindowList();
    this.syncForm();
    this.drawing.queue_draw();
  }

  private refreshAll(): void {
    this.updating = true;
    setMonitorSelection(this.viewDropdown, this.monitors, this.monitorIndex);
    this.updating = false;
    this.refreshCanvas();
    this.refreshWindowList();
    this.syncForm();
  }

  private refreshCanvas(): void {
    const size = this.monitorSize();
    this.visible = editorTargets(this.layout)
      .filter((target) => target.monitor === this.monitorIndex)
      .map((target) => ({
        index: target.index,
        rect: editorRect(target.position, size),
        label: target.label,
      }));
    this.drawing.queue_draw();
  }

  private refreshWindowList(): void {
    this.windowList.render(editorTargets(this.layout), this.selectedIndex);
  }

  private syncForm(): void {
    const target =
      this.selectedIndex === null
        ? undefined
        : editorTargets(this.layout)[this.selectedIndex];
    this.form.setTarget(target, this.monitorSize(), this.monitorRect());
  }

  private revert(): void {
    this.layout = copyLayout(this.initialLayout);
    this.monitorIndex = this.monitors[0].index;
    this.selectedIndex = null;
    this.drag = null;
    this.refreshAll();
  }

  private save(): void {
    const response = this.options.client.saveSetup(
      JSON.stringify({ ...this.layout, name: this.options.name }),
      true,
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
