import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import type { LayoutSummary } from '../shared/layout-summary.js';
import { workspaceLayoutPaths } from '../shared/paths.js';
import type { RuntimeStatus } from '../shared/status.js';
import { CapturePage } from './capture-page.js';
import { APPLY_TIMEOUT_MS, ExtensionClient } from './client.js';
import { EditorWindow } from './editor-window.js';
import { LayoutsPage } from './layouts-page.js';
import { RemapDialog } from './remap-dialog.js';
import { StatusPage } from './status-page.js';
import { confirmDestructive, showError, showResult } from './ui.js';

export class WorkspaceLayoutApp {
  private readonly window: any;
  private readonly client: ExtensionClient;
  private readonly layoutsPage: LayoutsPage;
  private readonly capturePage: CapturePage;
  private readonly statusPage: StatusPage;
  private layouts: LayoutSummary[] = [];
  private status: RuntimeStatus | null = null;
  private connected = false;
  private busy = false;

  constructor(window: any) {
    this.window = window;
    this.client = new ExtensionClient();
    this.layoutsPage = new LayoutsPage({
      onApply: (name) => this.onApply(name),
      onRemap: (summary) => this.onRemap(summary),
      onEdit: (summary) => this.onEdit(summary),
      onDelete: (summary) => this.onDelete(summary),
      onOpenLayout: (summary) => this.onOpenLayout(summary),
      onCapture: () => this.showCapture(),
      onRefresh: () => this.refresh(),
    });
    this.capturePage = new CapturePage({
      client: this.client,
      onSaved: (name) => this.onSavedLayout(name),
    });
    this.statusPage = new StatusPage({
      onRefresh: () => this.refresh(),
      onOpenLayoutsFolder: () => this.openLayoutsFolder(),
    });
  }

  attach(): void {
    this.window.add(this.layoutsPage.page);
    this.window.add(this.capturePage.page);
    this.window.add(this.statusPage.page);
    this.refresh();
  }

  refresh(): void {
    const overview = this.client.getOverview();

    this.status = overview.status;
    this.layouts = overview.layouts;
    this.connected = overview.ok;
    const error = overview.errors.join('\n') || null;
    this.layoutsPage.setLayouts(this.layouts, this.connected, error);
    this.capturePage.setLayouts(this.layouts, this.connected);
    this.statusPage.setStatus(this.status, error);
    this.setBusy(this.busy);
  }

  private showCapture(): void {
    this.capturePage.startCapture();
    this.window.set_visible_page(this.capturePage.page);
  }

  private onSavedLayout(name: string): void {
    this.refresh();
    this.window.set_visible_page(this.layoutsPage.page);
    const saved = this.layouts.find((layout) => layout.name === name);
    showResult(this.window, 'Layout saved', {
      ok: true,
      errors: [],
      messages: [
        saved?.path === undefined
          ? `Saved ${name}.`
          : `Saved ${name} to ${saved.path}.`,
      ],
    });
  }

  private onApply(name: string): void {
    if (this.busy) {
      return;
    }

    const summary = this.layouts.find((layout) => layout.name === name);

    if (summary === undefined) {
      this.refresh();
      return;
    }

    if (!summary.valid) {
      showError(
        this.window,
        'Invalid layout',
        summary.errors.join('\n') || 'The layout file is not valid.',
      );
      return;
    }

    if (
      summary.missingWorkspaces.length > 0 ||
      summary.missingMonitors.length > 0
    ) {
      this.showPreflightDialog(summary);
      return;
    }

    this.applyLayout(name);
  }

  private showPreflightDialog(summary: LayoutSummary): void {
    const lines: string[] = [];

    if (summary.missingWorkspaces.length > 0) {
      lines.push(
        `Missing workspaces: ${summary.missingWorkspaces.join(', ')}.`,
      );
    }

    if (summary.missingMonitors.length > 0) {
      lines.push(
        `Missing monitors: ${summary.missingMonitors
          .map((monitor) => `Monitor ${monitor}`)
          .join(', ')}.`,
      );
    }

    lines.push(
      'Applying now will skip the affected windows and report errors. Remap workspaces first to use the current workspace names.',
    );

    const dialog = new Adw.AlertDialog({
      heading: 'Layout needs attention',
      body: lines.join('\n'),
    });
    dialog.add_response('cancel', 'Cancel');

    if (summary.missingWorkspaces.length > 0) {
      dialog.add_response('remap', 'Remap workspaces');
      dialog.set_response_appearance('remap', Adw.ResponseAppearance.SUGGESTED);
      dialog.set_default_response('remap');
    } else {
      dialog.set_default_response('cancel');
    }

    dialog.add_response('apply', 'Apply anyway');
    dialog.set_response_appearance('apply', Adw.ResponseAppearance.DESTRUCTIVE);
    dialog.set_close_response('cancel');
    dialog.connect('response', (_dialog: any, response: string) => {
      if (response === 'remap') {
        this.onRemap(summary);
      } else if (response === 'apply') {
        this.applyLayout(summary.name);
      }
    });
    dialog.present(this.window);
  }

  private applyLayout(name: string): void {
    if (this.busy) {
      return;
    }

    this.setBusy(true, name);
    this.client.apply(name, APPLY_TIMEOUT_MS, (response) => {
      this.setBusy(false);
      showResult(
        this.window,
        response.ok ? 'Layout applied' : 'Layout applied with errors',
        response,
      );
    });
  }

  private onRemap(summary: LayoutSummary): void {
    if (this.busy) {
      return;
    }

    if (this.status === null) {
      showError(
        this.window,
        'Workspaces unavailable',
        'Refresh the status page and make sure the extension is running before remapping workspaces.',
      );
      return;
    }

    if (summary.missingWorkspaces.length === 0) {
      showError(
        this.window,
        'Nothing to remap',
        'This layout does not reference missing workspaces.',
      );
      return;
    }

    const dialog = new RemapDialog({
      parentWindow: this.window,
      client: this.client,
      summary,
      status: this.status,
      onSaved: () => this.refresh(),
    });
    dialog.present();
  }

  private onEdit(summary: LayoutSummary): void {
    if (this.busy) {
      return;
    }

    if (this.status === null || this.status.monitors.length === 0) {
      showError(
        this.window,
        'Monitors unavailable',
        'Refresh the status page and make sure the extension is running before editing positions.',
      );
      return;
    }

    if (!summary.valid) {
      showError(
        this.window,
        'Invalid layout',
        'Fix the layout validation errors before editing it in visual mode.',
      );
      return;
    }

    const response = this.client.readLayout(summary.name);

    if (!response.ok || response.layout === null) {
      showError(
        this.window,
        'Could not read layout',
        response.errors.join('\n') ||
          'The extension did not return the layout.',
      );
      return;
    }

    const editor = new EditorWindow({
      parentWindow: this.window,
      client: this.client,
      name: summary.name,
      status: this.status,
      layout: response.layout,
      onSaved: () => this.refresh(),
    });
    editor.present();
  }

  private onDelete(summary: LayoutSummary): void {
    if (this.busy) {
      return;
    }

    confirmDestructive(
      this.window,
      'Delete layout?',
      `This removes ${summary.name}.json from disk. This action cannot be undone.`,
      'Delete',
      () => {
        const response = this.client.deleteLayout(summary.name);

        if (response.ok) {
          this.refresh();
        }

        showResult(
          this.window,
          response.ok ? 'Layout deleted' : 'Could not delete layout',
          response,
        );
      },
    );
  }

  private onOpenLayout(summary: LayoutSummary): void {
    if (summary.path === undefined) {
      showError(
        this.window,
        'Layout file unavailable',
        'The extension did not return the layout file path.',
      );
      return;
    }

    this.openUri(Gio.File.new_for_path(summary.path).get_uri());
  }

  private openLayoutsFolder(): void {
    const fallbackPaths = workspaceLayoutPaths(
      GLib.get_user_config_dir(),
      GLib.get_user_data_dir(),
    );
    const directory = this.status?.layoutsDir ?? fallbackPaths.layoutsDir;

    if (!GLib.file_test(directory, GLib.FileTest.IS_DIR)) {
      showError(
        this.window,
        'Layouts folder not found',
        `No layouts folder exists yet at ${directory}. Capture a layout first.`,
      );
      return;
    }

    this.openUri(Gio.File.new_for_path(directory).get_uri());
  }

  private openUri(uri: string): void {
    try {
      Gio.AppInfo.launch_default_for_uri(uri, null);
    } catch (error) {
      showError(
        this.window,
        'Could not open file',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private setBusy(busy: boolean, applyingName: string | null = null): void {
    this.busy = busy;
    this.layoutsPage.setApplying(applyingName);
    this.layoutsPage.setBusy(busy);
    this.capturePage.setBusy(busy);
    this.statusPage.setBusy(busy);
  }
}
