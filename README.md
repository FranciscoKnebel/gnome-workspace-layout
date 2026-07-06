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
once and then marked as visible on every GNOME workspace:

```json
{
  "name": "global-tools",
  "sticky": [
    { "command": "gnome-terminal", "monitor": 0, "position": "right" }
  ],
  "workspaces": {}
}
```

## Design Constraints

- `apply` always launches new windows and only positions windows created by the command it just ran.
- Existing windows are not reused, moved, closed, or minimized.
- Workspaces are referenced by their existing GNOME names.
- Missing workspaces or monitors are reported as errors, but the rest of the layout continues.
- Sticky windows are applied after workspace-specific windows and use the same entry format.
- Window matching defaults to `appId`/`wmClass`; titles are captured as information but not used by default.
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
