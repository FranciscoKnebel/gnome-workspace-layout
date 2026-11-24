import Gtk from 'gi://Gtk';
import type { MonitorStatus } from '../shared/status.js';

export function buildMonitorDropdown(
  monitors: MonitorStatus[],
  onChanged: (index: number) => void,
  isUpdating: () => boolean,
): any {
  const model = new Gtk.StringList({
    strings: monitors.map((monitor) => `Monitor ${monitor.index}`),
  });
  const dropdown = new Gtk.DropDown({
    model,
    valign: Gtk.Align.CENTER,
  });
  dropdown.connect('notify::selected', () => {
    if (isUpdating()) {
      return;
    }

    const monitor = monitors[dropdown.get_selected()];
    if (monitor !== undefined) {
      onChanged(monitor.index);
    }
  });
  return dropdown;
}

export function setMonitorSelection(
  dropdown: any,
  monitors: MonitorStatus[],
  monitorIndex: number,
): void {
  const position = monitors.findIndex(
    (monitor) => monitor.index === monitorIndex,
  );

  if (position >= 0) {
    dropdown.set_selected(position);
  }
}
