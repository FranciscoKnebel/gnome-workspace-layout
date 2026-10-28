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

Capture the current visible layout:

```bash
workspace-layout setup trabalho
```

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
`timeoutMs`. `apply` creates workspace-specific windows first, then sticky
windows. A layout with only sticky windows is valid when `workspaces` is `{}`.

When capturing a window, `setup` prefers the desktop entry's `new-window`
action when one exists. This avoids desktop launchers that only focus an
existing application window. For Flatpak entries without that action, it uses
`flatpak run` from the desktop `Exec=` line, retaining application/profile/PWA
arguments while removing standalone field codes and empty file-forwarding markers.
Unsupported desktop substitutions fall back to the desktop launcher.
Otherwise it records `gtk-launch <desktop-id>` as
the generic fallback. Raw desktop `Exec=` field codes are not copied into
layout commands without sanitization.

The layout format accepts any non-empty launch command, including these captured
commands and manually supplied custom launchers. Omitting `command` requires
`appId`; `match.wmClass` alone is insufficient.

Electron applications without a readable desktop entry retain their `appId` and
`match.wmClass`, but have no generated `command`. Add a real launch command manually
(e.g. `code --new-window`); a window class is never treated as an executable. With
no command, apply attempts `Shell.App.open_new_window` using `appId`. Windows with
neither an app ID nor a usable command continue to be skipped by capture.

## Design Constraints

- `apply` always launches new windows and only positions windows created by the command it just ran.
- Existing windows are not reused, moved, closed, or minimized.
- Workspaces are referenced by their existing GNOME names.
- Missing workspaces or monitors are reported as errors, but the rest of the layout continues.
- Sticky windows are applied after workspace-specific windows and use the same entry format.
- Window matching defaults to `appId`/`wmClass`; titles are captured as information but not used by default.
- Captured windows without an application ID or a usable launch command are skipped.
- A command-only entry is matched to the process started by apply. Add `appId` or `match` when the command delegates window creation to another process.
- Position presets are `full`, `left`, `right`, `top`, `bottom`, and `center`.
- Custom positions are stored as monitor-relative percentages.

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
