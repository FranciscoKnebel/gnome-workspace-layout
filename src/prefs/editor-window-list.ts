import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import type { EditorTarget } from '../shared/layout-editor.js';
import { RowGroup, singleLine } from './ui.js';

export class EditorWindowList {
  readonly group: any;
  private readonly rows: RowGroup;
  private readonly onSelect: (target: EditorTarget) => void;

  constructor(onSelect: (target: EditorTarget) => void) {
    this.onSelect = onSelect;
    this.group = new Adw.PreferencesGroup({
      title: 'Windows in this layout',
      description: 'Select a window to edit its placement.',
    });
    this.rows = new RowGroup(this.group);
  }

  render(targets: EditorTarget[], selectedIndex: number | null): void {
    this.rows.clear();

    for (const target of targets) {
      const row = new Adw.ActionRow({
        title: singleLine(target.label),
        subtitle: `${singleLine(target.workspaceLabel)} | Monitor ${target.monitor}`,
      });
      row.set_subtitle_lines(2);
      row.set_activatable(true);

      if (target.index === selectedIndex) {
        row.add_prefix(new Gtk.Image({ icon_name: 'emblem-default-symbolic' }));
      }

      row.connect('activated', () => this.onSelect(target));
      this.rows.add(row);
    }
  }
}
