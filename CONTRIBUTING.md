# Contributing

Thanks for helping improve Workspace Layout.

## Development Requirements

- GNOME Shell 50 for manual extension testing.
- Node.js 22 or newer. Node.js 24+ is preferred.
- npm 10 or newer.

Install dependencies:

```bash
npm install
```

Run the full local check before opening a PR:

```bash
npm run check
```

This runs linting, formatting checks, TypeScript type checks, tests, and the build.

## Local Testing

Build and install the extension, CLI, and schema for the current user:

```bash
npm run install:local
```

Then restart GNOME Shell or log out/in, enable the extension, and verify D-Bus connectivity:

```bash
gnome-extensions enable workspace-layout@franciscoknebel.com
workspace-layout doctor
```

## Project Layout

- `src/extension/`: GNOME Shell extension code. This is the only layer that should manipulate GNOME windows.
- `src/cli/`: Node.js CLI that calls the extension over D-Bus and handles installation.
- `src/shared/`: pure TypeScript code shared by the CLI, extension, and tests.
- `schema/`: JSON Schema for layout files.
- `test/`: Vitest tests for pure behavior.
- `docs/`: architecture decisions and domain vocabulary.

## Design Rules

- Keep Wayland window control inside the GNOME Shell extension.
- Keep the CLI scriptable and suitable for custom keyboard shortcuts.
- `apply` must create new windows and must not move, close, reuse, or minimize pre-existing windows.
- Layout files are one JSON file per layout under `~/.config/workspace-layout/layouts/`.
- Workspaces are matched by existing GNOME workspace names.
- Monitors are referenced by GNOME monitor index.
- Prefer pure functions in `src/shared/` for behavior that can be tested without GNOME Shell.

## Pull Requests

- Keep changes focused.
- Update docs when behavior or layout schema changes.
- Add or update tests for pure logic changes.
- Run `npm run check` before requesting review.

## License

By contributing, you agree that your contributions are licensed under GPL-3.0-or-later.
