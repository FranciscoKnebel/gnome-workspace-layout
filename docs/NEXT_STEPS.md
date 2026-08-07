# Next Steps

This document captures the remaining manual testing needed after local install.

## Current State

- `npm run check` passes.
- `npm run install:local` completed successfully.
- The extension is installed at `~/.local/share/gnome-shell/extensions/workspace-layout@franciscoknebel.com`.
- The CLI is installed at `~/.local/bin/workspace-layout`.
- The schema is installed at `~/.local/share/workspace-layout/schema/workspace-layout.schema.json`.
- The local installer now runs `restorecon -R` on the installed extension directory when SELinux tooling is available.
- The installed extension files have the expected SELinux context, `data_home_t`.
- GNOME Shell recognizes the extension after logout/login.
- `workspace-layout doctor` reaches the extension D-Bus service and reports monitors and workspaces.

## Manual Testing

Test capture:

```bash
workspace-layout setup trabalho-test
```

Then inspect:

```bash
$EDITOR ~/.config/workspace-layout/layouts/trabalho-test.json
```

Then test apply with a small edited layout first, preferably one terminal window:

```bash
workspace-layout apply trabalho-test
```

## Things To Verify Manually

- `setup` captures workspace names correctly.
- `setup` captures monitor indexes correctly.
- `setup` captures sticky windows into the top-level `sticky` array, not into the current workspace.
- `setup` skips invalid windows instead of writing invalid layout entries.
- `apply` creates new windows and does not move existing windows.
- `apply` reports missing workspaces and monitors but continues with other entries.
- `apply` creates sticky windows after workspace-specific windows and marks them visible on every GNOME workspace.
- Minimized windows are ignored by default and included with `--include-minimized`.

## Follow-Up Work

Decisions captured during a grilling session. Each item is a backlog candidate,
not immediate work.

### Event-Driven Window Detection

Replace synchronous polling in `src/extension/shell.ts` with event-driven
detection. Listen to `display::window-created` as the primary path; keep an
explicit timeout as fallback. Matching stays `before` + `matchesWindow` with a
retry grace period before declaring timeout, because `wm_class` and `title` may
not be populated immediately on `window-created`.

### Command Generation for Flatpak, Electron, and Browsers

Hybrid approach. `src/shared/` gains a pure function that decides the launch
command from app metadata:

- Flatpak: read the `Exec=` field of the `.desktop` file in `shell.ts`; if it
  starts with `flatpak run`, use that as `command`.
- Native `.desktop`: keep `gtk-launch <appId>` as today.
- Electron without a reliable `.desktop`: write `match.wmClass` but leave
  `command` undefined so the user fills it manually. `apply` falls back to
  `appId` via `Shell.App.open_new_window` when `command` is absent.

Tests live in `test/launch-command.test.ts` with pure cases for each app type.

### Release ZIP Validation

Validate the release ZIP against GNOME Extensions Store expectations via a pure
function in `src/shared/` that checks:

- Structure: `metadata.json` at the root, `extension.js` present, no `src/`,
  `node_modules/`, or `tsconfig` files.
- `metadata.json` content: UUID, name, version, and shell-version are present
  and well-formed.

A shell script unpacks the ZIP and passes the file list and `metadata.json` to
the pure validator. Tests live in `test/release-zip.test.ts`.

### Release Tag Validation Tests

Migrate release tag validation logic to `src/shared/` when it grows beyond
simple shell glue — specifically when it gains conditional logic like semver
parsing, version comparison, or format validation. Pure shell glue
(`npm version` + `git tag`) stays in the script.

### Preferences UI

Build a preferences UI only after the CLI flow is proven, defined as: all manual
tests in this document pass. The UI is the next backlog item, not immediate work.
The current audience edits JSON directly.

## Useful Commands

```bash
npm run check
npm run package:release
npm run install:local
gnome-extensions list --user
gnome-extensions enable workspace-layout@franciscoknebel.com
workspace-layout doctor
```
