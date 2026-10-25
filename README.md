# Workspace Layout

Workspace Layout is a GNOME Shell 50 extension plus CLI for Fedora/GNOME Wayland.
It captures the current workspace/window arrangement and reapplies named layouts later.

The command name is `workspace-layout`.

## Status

This is an initial implementation for GNOME 50 / Fedora 44. It intentionally targets
Wayland by doing window control inside a GNOME Shell extension instead of using
external X11 tools such as `wmctrl` or `xdotool`.

## Requirements

- GNOME Shell 50.
- Node.js 22 or newer. Node.js 24+ is preferred for development.
- `npm`.
- `gdbus`, available on typical GNOME/Fedora installs.
- `zip`, `unzip`, and `tar` when building release artifacts.

## Install For Development

```bash
npm install
npm run install:local
```

Then restart GNOME Shell or log out/in, and enable the extension:

```bash
gnome-extensions enable workspace-layout@franciscoknebel.com
```

Make sure `~/.local/bin` is in your `PATH`.

## Usage

### Preferences window

Open the preferences window from GNOME Extensions, or run:

```bash
gnome-extensions prefs workspace-layout@franciscoknebel.com
```

The window has three pages:

- **Layouts** lists every saved layout with its window/workspace counts, validity,
  missing workspaces or monitors, and file path. Each layout exposes separate
  Apply, Remap, Edit, Open, and Delete actions. The page updates after capture,
  remap, edit, delete, or a manual refresh.
- **Capture** reads the current arrangement, previews the windows found, and lets
  you uncheck windows before saving. It does not close, move, or minimize live
  windows. Capture is preview-first: nothing is written until Save layout.
- **Status** shows the D-Bus connection, the layouts folder, the installed JSON
  Schema, the current named workspaces, and monitor geometry.

The visual editor opens from the Edit action on a saved layout. It draws each
window of the selected monitor as a rectangle. Drag a rectangle to move it, drag
the handles to resize it, or enter exact percentages in the side panel. The
Position dropdown applies a preset and stores the same preset string used by the
CLI. The Window monitor dropdown moves a selected window to another monitor. Save
writes the layout with the existing `SaveSetup` operation, so the schema and
validation rules are unchanged. Revert discards edits since the editor opened.

Apply only launches and positions windows created by that apply run. It does not
rearrange windows that are already open, exactly like the CLI.

When a layout references a workspace that no longer exists, the Layouts page
reports it as missing and offers **Remap**. Remap maps each missing workspace name
to a current workspace and rewrites the layout file in place. If two old names map
to the same current workspace, their windows are merged in their existing order.

### CLI

Capture the current visible layout:

```bash
workspace-layout setup trabalho
```

Choose which windows to save using the interactive CLI wizard:

```bash
workspace-layout setup trabalho --configure
```

The wizard lists each window's application, title, workspace, monitor, and
minimized/sticky state. Enter window numbers such as `1,3`, or `all`, review the
selection, then confirm with `y`. Enter `edit` at confirmation to revise the
selection, or `cancel` at selection to quit. No live window is closed or changed.

Combine `--configure` with `--include-minimized` to select minimized windows too,
and with `--force` to replace an existing layout after confirmation. Cancellation,
Ctrl+C, EOF before confirmation, or a capture error leaves layout files unchanged.
Empty and invalid selections cannot be saved. The wizard requires an interactive
terminal on both stdin and stdout; omit `--configure` for scripts and pipes.
Without the flag, capture remains non-interactive.

See [interactive setup](docs/INTERACTIVE_SETUP.md) for the capture/save protocol
and manual validation steps.

Capture minimized windows too:

```bash
workspace-layout setup trabalho --include-minimized
```

Replace an existing layout with a new capture:

```bash
workspace-layout setup trabalho --force
```

Without `--force`, `setup` rejects an existing layout name. `--force` replaces
the layout file completely only after a valid, complete capture; it does not
create a backup or merge its contents.

Apply a layout:

```bash
workspace-layout apply trabalho
```

Check installation and extension connectivity:

```bash
workspace-layout doctor
```

Layouts live in:

```text
~/.config/workspace-layout/layouts/<name>.json
```

The installed JSON Schema lives in:

```text
~/.local/share/workspace-layout/schema/workspace-layout.schema.json
```

Layouts may also define top-level `sticky` windows. A sticky window is launched
once, positioned, and then marked as visible on every GNOME workspace. Use this
for tools that should follow you across workspaces, such as a terminal, chat,
music player, or monitoring window.

`setup` captures existing sticky windows into the top-level `sticky` array. You
can also edit a layout file manually and move any window entry from a workspace
into `sticky`:

```json
{
  "name": "global-tools",
  "sticky": [
    {
      "appId": "org.gnome.Terminal.desktop",
      "command": "gnome-terminal",
      "monitor": 0,
      "position": "right"
    }
  ],
  "workspaces": {}
}
```

Sticky windows use the same entry format as workspace windows: `label`, `appId`,
`command`, `title`, `match`, `monitor`, `position`, `minimized`, and
`timeoutMs`. Optional `label` and `title` must be strings, and `minimized` must
be a boolean. Validation rejects other types before saving through D-Bus.
`apply` creates workspace-specific windows first, then sticky windows. A layout
with only sticky windows is valid when `workspaces` is `{}`.

When capturing a window, `setup` prefers the desktop entry's `new-window`
action when one exists. This avoids desktop launchers that only focus an
existing application window. For Flatpak entries without that action, it uses
`flatpak run` from the desktop `Exec=` line, retaining application/profile/PWA
arguments while removing standalone field codes and empty file-forwarding markers.
Unsupported desktop substitutions fall back to the desktop launcher.
Otherwise it records `gtk-launch <desktop-id>` as
the generic fallback. Raw desktop `Exec=` field codes are not copied into
layout commands without sanitization.

Electron applications without a readable desktop entry retain their `appId` and
`match.wmClass`, but have no generated `command`. Add a real launch command manually
(e.g. `code --new-window`); a window class is never treated as an executable. With
no command, apply attempts `Shell.App.open_new_window` using `appId`. Windows with
neither an app ID nor a usable command continue to be skipped by capture.

## Design Constraints

- `apply` always launches new windows and only positions windows created by the command it just ran.
- Existing windows are not reused, moved, closed, or minimized.
- Window detection is asynchronous: it listens for new-window events before
  launch, retries incomplete metadata, and performs a final scan at timeout
  with a 150 ms grace period. Disabling the extension cancels outstanding waits.
- Workspaces are referenced by their existing GNOME names.
- Layout names are 1 to 64 characters, cannot start or end with whitespace, cannot be `.` or `..`, and cannot contain path separators or control characters.
- Missing workspaces or monitors are reported as errors, but the rest of the layout continues.
- Sticky windows are applied after workspace-specific windows and use the same entry format.
- Window matching defaults to `appId`/`wmClass`; titles are captured as information but not used by default.
- Captured windows without an application ID or a usable launch command are skipped.
- A command-only entry is matched to the process started by apply. Add `appId` or `match` when the command delegates window creation to another process.
- Position presets are `full`, `left`, `right`, `top`, `bottom`, and `center`.
- Custom positions are stored as monitor-relative percentages.
- The visual editor changes only layout files. It never repositions live windows and adds no new layout-format fields.

## Development

```bash
npm run check
```

Useful scripts:

- `npm run build`: compile CLI and extension into `bin/` and `dist/`.
- `npm run test`: run pure TypeScript tests.
- `npm run lint`: run ESLint and Prettier checks.
- `npm run install:local`: build and install extension, CLI, and schema under the current user.

## License

GPL-3.0-or-later. See `LICENSE`.
