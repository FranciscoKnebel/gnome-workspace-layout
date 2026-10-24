# Next Steps

Last manual GNOME behavior verification: 2026-08-06.

This document records the completed stabilization work, evidence from the
last manual GNOME session, and the remaining product decisions.

## Current State

- `npm run check` passes with 13 test files and 96 tests. Linting, Prettier,
  TypeScript, tests, and builds complete without AJV warnings.
- `npm run package:release` produces a validated extension ZIP containing
  `extension.js` and `metadata.json` at the root.
- CI builds and validates release artifacts in addition to running the normal
  checks.
- The last recorded install had the expected `data_home_t` SELinux context.
  The interactive setup build still needs local installation and logout/login
  before live GNOME validation.
- `workspace-layout doctor` reaches D-Bus and reports 4 monitors and 3
  workspaces in the last checked session.

## Completed Stabilization

### Capture Validation

Every completed capture is now validated before writing. A new capture may
still save valid windows while reporting skipped invalid windows, but a capture
containing no valid window cannot write an invalid empty layout. Forced
replacement remains atomic when capture reports an error.

Regression coverage includes mixed valid/invalid captures and all-invalid new
captures.

### Interactive Setup With `--configure`

`workspace-layout setup <name> --configure` now opens a CLI wizard to select
which captured windows to keep in the saved layout. It lists application, title,
workspace, monitor, and minimized/sticky state, accepts individual window numbers
or `all`, and shows a summary before explicit save confirmation. `edit` revises
the selection. Live windows are never modified.

The wizard supports `--include-minimized` and `--force`. Previewing writes nothing;
confirmation sends the selected snapshot to a separate, gated D-Bus save method
that revalidates it and checks overwrite protection again. Cancellation, Ctrl+C,
EOF before confirmation, capture errors, invalid/empty selections, and redirected
input/output cannot silently save or replace a layout. Without `--configure`,
setup retains its non-interactive behavior. The layout format is unchanged.

Automated coverage exercises selection filtering, sticky/minimized entries,
confirmation/revision, cancellation, EOF, non-interactive execution, invalid and
empty selections, and overwrite protection. Live GNOME wizard validation remains
pending; see [interactive setup](INTERACTIVE_SETUP.md) for protocol details and
the manual checklist.

The compiled CLI also passed real-terminal (PTY) smoke checks with a simulated
D-Bus executable: subset selection and confirmation, revision with `edit`,
rejected confirmation, Ctrl+C at confirmation, and EOF at selection. These checks
did not install the extension or modify live layouts/windows.

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
- [ ] Install the build with `--configure`, log out/in, and complete the
      [interactive setup manual checks](INTERACTIVE_SETUP.md#manual-gnome-validation).

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

### Priority: Reapply Layouts Without Closing Existing Windows

Product requirement: applying a layout to an already-running session must offer
a way to reuse and reposition matching open windows, launching only missing
windows. The user must not need to close existing windows before restoring an
arrangement. This is planned behavior, not implemented functionality.

Acceptance criteria:

- Reuse matching windows and restore their configured workspace, monitor,
  geometry, minimized state, and sticky state.
- Launch a new window only when no suitable existing window is available.
- Assign each existing window to at most one layout entry per operation,
  including layouts with multiple windows from the same application.
- Leave unrelated or surplus windows open and unchanged. Never close windows
  as part of restoring a layout.
- Applying the same layout repeatedly must not keep creating duplicates when
  suitable windows already satisfy all entries.
- Define matching precedence and how ambiguous matches are resolved or reported,
  including multiple terminals, browser profiles, and PWAs. Do not silently
  select an unrelated window solely because it belongs to the same application.

Implementation plan:

1. Decide the CLI/API contract: a separate command, an explicit apply option,
   or a revised default. Keep the current launch-only path unchanged until the
   new contract is defined, and keep intentional fresh-window launches available.
2. Model deterministic, one-to-one window assignment and reuse-versus-launch
   decisions in `src/shared/`, with tests independent of GNOME.
3. Execute the plan inside the extension, retaining operation gating and the
   existing new-window detector for entries that still require launching.
4. Reconcile the existing launch-only architecture guardrails and update README,
   glossary, architecture decisions, and CLI/D-Bus documentation. If the layout
   format changes, update types, validation, JSON Schema, and parity tests together.
5. Test complete reuse, partial reuse, repeated application, duplicate app entries,
   ambiguous matches, minimized/sticky transitions, and preservation of unrelated
   windows. Repeat the relevant cases in a real GNOME session.

Prioritize this work before the preferences UI.

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
