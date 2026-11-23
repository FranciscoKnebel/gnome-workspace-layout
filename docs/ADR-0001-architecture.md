# ADR-0001: GNOME Shell Extension With CLI Frontend

## Status

Accepted.

## Context

The target environment is Fedora 44 with GNOME 50 on Wayland. The user wants a
manual command that captures and reapplies layouts across named workspaces and
indexed monitors. The layout must be editable as JSON and suitable for future
publication in the GNOME Extensions Store.

Wayland prevents normal external scripts from controlling arbitrary application
windows. X11-oriented tools such as `wmctrl` and `xdotool` are not reliable for
this use case on GNOME Wayland.

## Decision

Workspace Layout is implemented as two cooperating pieces:

- A GNOME Shell extension named `Workspace Layout`, UUID `workspace-layout@franciscoknebel.com`.
- A command-line tool named `workspace-layout` that calls the extension over D-Bus.

The extension owns all window operations: workspace lookup, monitor geometry,
window capture, launching, moving, resizing, and minimizing. The CLI owns user
experience: command parsing, local installation, and diagnostics.

Interactive setup follows the same division: the extension provides a capture
preview and validates/saves the confirmed selection over separate D-Bus calls.
The CLI owns the selection wizard. Waiting for terminal input holds no extension
operation gate, and previewing a capture does not write a layout file.

The extension also ships a libadwaita preferences window (`prefs.js`). It is
another D-Bus client: listing layouts, previewing and saving captures, remapping
workspaces, applying layouts, editing window positions, and reading runtime
status all call the extension. The preferences process never manipulates GNOME
windows directly. The editor renders windows as monitor-relative rectangles and
reuses the existing position format and `SaveSetup` validation, so no new layout
fields are introduced.

Layouts are stored as one JSON file per layout in
`~/.config/workspace-layout/layouts/<name>.json`. They point to an installed JSON
Schema at `~/.local/share/workspace-layout/schema/workspace-layout.schema.json`.

## Consequences

- The command remains scriptable and suitable for GNOME keyboard shortcuts.
- The extension can operate on GNOME Wayland because it runs inside GNOME Shell.
- Integration tests against GNOME Shell are manual for now.
- Pure behavior such as layout validation and geometry mapping is tested with Vitest.
- The project uses TypeScript for source code, compiled to JavaScript for GNOME Shell.

## Initial Scope

- GNOME Shell 50 only.
- No panel UI.
- A preferences window for layout listing, capture selection, workspace remap,
  apply, visual position editing, and runtime status.
- `setup`, `apply`, `doctor`, and local install commands.
- Workspaces must already exist and are matched by name.
- Monitors are referenced by index.
- `apply` creates new windows and does not touch pre-existing windows.

## Future Considerations

- Better Flatpak and browser command generation.
- More robust asynchronous D-Bus handling.
- Extension Store packaging automation.
