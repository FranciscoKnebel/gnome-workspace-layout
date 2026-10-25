# Preferences editor design (issue #6)

Status: design only; implementation remains blocked on the manual GNOME checks
listed in `docs/NEXT_STEPS.md`. Automated tests cannot prove that monitor mapping,
sticky visibility or window placement work on real hardware. This document does
not mark those checks complete.

## Entry point and responsibilities

Use the standard GTK4/libadwaita extension preferences window, implemented as a
separate `prefs.js` entry point compiled from TypeScript. Open it with
`gnome-extensions prefs workspace-layout@franciscoknebel.com`. Keep GTK imports in
the preferences process; never import GTK into the Shell extension process.

The initial window edits named layout files without requiring JSON editing. It
does not capture, apply, launch, move or close windows. Defaults and runtime
controls can be separate follow-up work.

## Window flow

1. A layout list shows existing names with Open and New actions. Empty state
   explains how to capture the first layout with the CLI.
2. The editor presents workspace groups followed by a Sticky group. Users can
   add/remove/reorder windows within a group and move entries between groups.
3. Each window form edits label, application ID, command, informational title,
   match rules, monitor index, position preset or relative rectangle, minimized
   state, and timeout. Advanced fields are collapsed initially.
4. A review panel shows validation errors with the affected group and window.
   Save is disabled while errors exist. Cancel leaves the file unchanged.
5. Saving a new name refuses collisions. Replacing an existing layout requires
   explicit confirmation. Closing with unsaved changes offers discard or return.

Workspace names are literal keys, including `constructor`, `toString` and
`__proto__`. The editor must preserve valid fields it does not modify and retain
workspace/sticky ordering. Monitor indexes are stored as indexes, not guessed
physical labels. Missing current workspaces/monitors produce explanatory notices
without preventing editing a portable layout.

## Data and persistence boundary

Reuse `LayoutFile`, the shared validator and JSON Schema. Keep the editable draft
independent of the loaded file. Put form-to-layout transformations in shared pure
functions; put GTK widgets and GIO file access in a separate preferences module.
Use XDG config paths consistently with the CLI. Validate before any write, use
atomic replacement, and detect external file changes before overwriting to avoid
silently discarding edits from another editor. Reading and editing files must
work even when the Shell extension is disabled.

The preferences build must produce `dist/prefs.js`; local install and release
packaging must include it. The existing ZIP validator must continue allowing
legitimate prefs, schemas, styles, icons and translations.

## Unblocking and acceptance

Before implementing, complete the remaining real-session tests for capture,
apply, sticky visibility, minimized entries and missing workspaces/monitors,
including the latest launch/detection changes. Record build commit, GNOME version,
hardware arrangement, expected behavior and actual result in `NEXT_STEPS.md`.

After that gate passes, implement the editor and verify:

- Every supported layout field round-trips without losing data.
- Invalid optional fields and invalid geometry cannot be saved.
- Special workspace names and sticky-only layouts edit and save correctly.
- Cancel and invalid input leave both new and existing files untouched.
- Concurrent external edits are detected and require reload or explicit overwrite.
- Keyboard navigation, accessible labels and resizing work in a real preferences
  window; the installed and packaged entry points both open it.
- `npm run check` and `npm run package:release` pass.

References: [GNOME preferences guide](https://gjs.guide/extensions/development/preferences.html)
and [extension anatomy](https://gjs.guide/extensions/overview/anatomy.html).
