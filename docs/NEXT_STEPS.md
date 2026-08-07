# Next Steps

Last verified: 2026-08-06.

This document records the completed stabilization work, evidence from the
current GNOME session, and the remaining product decisions.

## Current State

- `npm run check` passes with 11 test files and 56 tests. Linting, Prettier,
  TypeScript, tests, and builds complete without AJV warnings.
- `npm run package:release` produces a validated extension ZIP containing
  `extension.js` and `metadata.json` at the root.
- CI builds and validates release artifacts in addition to running the normal
  checks.
- The latest extension build is installed with the expected `data_home_t`
  SELinux context. The current Wayland session still needs logout/login to
  replace the already-loaded ESM module with that build.
- `workspace-layout doctor` reaches D-Bus and reports 4 monitors and 3
  workspaces in the current session.

## Completed Stabilization

### Capture Validation

Every completed capture is now validated before writing. A new capture may
still save valid windows while reporting skipped invalid windows, but a capture
containing no valid window cannot write an invalid empty layout. Forced
replacement remains atomic when capture reports an error.

Regression coverage includes mixed valid/invalid captures and all-invalid new
captures.

### Release ZIP Validation

The release script now packages extension files at the ZIP root and invokes a
pure validator that checks:

- Required root `extension.js` and `metadata.json` files.
- Expected UUID, non-empty name and description, positive integer version, and
  non-empty `shell-version` array.
- Absence of source, tests, dependencies, build scripts, package manifests, and
  TypeScript/tool configuration.

The same packaging command runs in CI and in the manual release workflow.

### Schema Diagnostics

The root JSON Schema alternatives now declare their object and array types
explicitly. Runtime validation and schema behavior remain in parity, and AJV no
longer emits `strictTypes` warnings.

### Event-Driven Window Detection

Window detection now connects to `global.display`'s `window-created` signal
before launching an application. It keeps the pre-launch window identity set,
accepts only normal windows with a compositor actor, retries signal candidates
while app metadata is populated, and has an explicit timeout.

Signal and timeout sources are removed after success, timeout, launch failure,
or cancellation. A shared operation gate rejects reentrant `Apply`/`Setup`
calls while the nested event loop is waiting. Disabling the extension prevents
later waits; in the current live test, GNOME serialized the disable request
until the synchronous D-Bus `Apply` call completed.

Window identity matching is a pure shared function with tests for explicit
rules, delayed metadata, default `appId`, and spawned process IDs for
command-only entries. Commands that delegate window creation can still use
`appId` or `match`. Runtime confirmation of the latest build remains pending
because this GNOME Shell does not implement the introspected `ReloadExtension`
D-Bus method.

## GNOME Validation Results

- [x] Basic capture wrote real windows under `Workspace 1` and `Workspace 3`
      with monitor indexes 1, 2, and 3.
- [x] Apply created a new Ptyxis window on `Workspace 1`, monitor 0, in the
      requested `left` position.
- [x] Captures before and after apply showed that pre-existing terminals kept
      their workspaces, monitors, and geometry.
- [x] Missing workspace and monitor errors were both reported while a later
      valid entry was still created and positioned.
- [x] A window applied with `"minimized": true` was positioned and minimized.
- [x] Default capture excluded minimized windows; `--include-minimized` included
      them with `"minimized": true`.
- [x] A sticky-only layout applied successfully, and the next capture placed
      the new window only in top-level `sticky`.
- [ ] Log out/in, run a one-window apply, and confirm the event-driven detector
      creates and positions it without extension errors in the journal.
- [ ] Visually switch through every workspace while a sticky test window is
      alive to confirm continuous visibility. Capture already confirms GNOME's
      `is_on_all_workspaces()` state.
- [ ] Repeat placement on every physical monitor and visually confirm GNOME's
      index-to-monitor mapping for the current hardware arrangement.

## Launch Command Compatibility

Investigation in the current environment found:

- Native Ptyxis has `org.gnome.Ptyxis.desktop`. Its captured `gtk-launch`
  fallback only activated an existing instance and timed out, while its desktop
  `new-window` action uses the reliable `ptyxis --new-window` command.
- Flatpak Chrome has `com.google.Chrome.desktop`. Its raw desktop `Exec=` value
  contains Flatpak arguments and field codes such as `%U` and `@@`, so copying
  it directly into a shell command is unsafe.
- OpenCode and Antigravity expose desktop IDs and `StartupWMClass` values even
  though they are Electron applications. Antigravity's `gtk-launch` fallback
  created a new window in the live test.
- Chrome PWAs have distinct desktop entries containing profile and app IDs.

Capture now prefers an announced, syntactically safe desktop `new-window`
action and sanitizes standalone desktop field codes in a tested pure function.
Complex escaped or malformed actions, and entries without that action, fall
back to `gtk-launch <desktop-id>`. Capture never treats a `wmClass` as an
executable.

- [x] Native Ptyxis `gtk-launch` failure reproduced with an existing instance.
- [x] Flatpak Chrome `gtk-launch` created and positioned a new window.
- [x] Electron Antigravity `gtk-launch` created and positioned a new window.
- [ ] Browser normal window, profile window, and installed PWA.
- [ ] After logout/login, capture Ptyxis and confirm its command is
      `ptyxis --new-window`, then apply that captured entry.

An entry containing only `match.wmClass` is still not launchable and would
require a public layout schema change.

## Remaining Backlog

### Release Tag Validation

The release workflow compares the requested tag exactly with
`package.json#version`. Keep this check in workflow shell unless semver parsing,
prerelease rules, or additional version sources are introduced.

### Preferences UI

Build a preferences UI only after launch behavior is stable and the remaining
GNOME checks pass. Define whether it edits layouts, configures defaults, invokes
setup/apply, or combines those responsibilities before implementation.

Packaging validation must allow legitimate future `prefs.js`, schemas, styles,
icons, and resources.

## Useful Commands

```bash
npm run check
npm run package:release
npm run install:local
gnome-extensions info workspace-layout@franciscoknebel.com
gnome-extensions enable workspace-layout@franciscoknebel.com
workspace-layout doctor
```
