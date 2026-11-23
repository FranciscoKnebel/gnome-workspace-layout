# Interactive Setup

Use the CLI wizard to save a subset of the current windows:

```bash
workspace-layout setup trabalho --configure
workspace-layout setup trabalho --configure --include-minimized --force
```

## Wizard

1. Capture a preview of eligible windows. Minimized windows are excluded unless
   `--include-minimized` is present. Existing names require `--force`.
2. Show numbered windows with application, title, workspace, monitor, and
   minimized/sticky state. Enter numbers separated by commas or spaces, such as
   `1,3`, or enter `all`. Each window is included at most once.
3. Review the selected windows. Enter `edit` to replace the selection, `y` or
   `yes` to save, or any other response to cancel. Only the selected entries are
   saved. Workspaces with no selected windows and an unselected sticky group are
   omitted. Sticky-only selections are supported.

Enter `cancel` at the selection prompt to exit. Ctrl+C or EOF before confirmation
also cancels, including EOF after typing `y` without pressing Enter. Cancellation
exits unsuccessfully without creating or replacing a
layout. Invalid or empty selections show an error and prompt again; they cannot
be saved. A capture error aborts the wizard without saving, even if some windows
could be captured. Forced replacement never saves an incomplete capture.

Both stdin and stdout must be interactive terminals. For automation, omit
`--configure` to retain the original non-interactive setup behavior.

The wizard never closes, moves, minimizes, or otherwise changes any live window.
It saves a snapshot: windows opened, closed, or moved while the wizard is running
do not change that preview. Applying the saved layout is a separate operation.
The layout JSON format and schema are unchanged.

## CLI And D-Bus Protocol

The interface is `com.franciscoknebel.WorkspaceLayout` at object path
`/com/franciscoknebel/WorkspaceLayout`, on the session bus with the same bus name.

- `Setup(name: s, includeMinimized: b)` and
  `SetupForce(name: s, includeMinimized: b)` retain their existing signatures
  and non-interactive behavior.
- `PreviewSetup(name: s, includeMinimized: b, force: b)` returns a JSON string
  containing `ok`, `errors`, `messages`, and, when available, `layout`. No file
  is written. The CLI proceeds only with a successful preview containing a layout.
- `SaveSetup(layout: s, force: b)` accepts the selected layout serialized as JSON
  and returns the usual JSON `ok`, `errors`, and `messages`. The extension parses
  and validates the selection, rejects zero selected windows, checks overwrite
  protection again, and writes using the existing atomic layout store.

Each extension operation is gated separately. No gate is held while the CLI
waits for input, and abandoning a preview requires no extension-side cleanup.
If a layout appears after preview, saving without `--force` still rejects the
overwrite. With `--force`, confirmation authorizes replacing the file at save
time, without a backup or merge.

The preferences window uses three additional methods:

- `ReadLayout(name: s)` returns the parsed `layout` for remapping.
- `DeleteLayout(name: s)` removes one layout file.
- `GetOverview()` returns `status` and `layouts` in one call. The status includes
  monitors, workspaces, the active workspace index, the layouts directory, and
  the schema path. Each summary includes counts, validity, missing workspaces and
  monitors, file path, and modification time.

`ReadLayout` and `GetOverview` are read-only and remain available while another
operation runs. `DeleteLayout` and `SaveSetup` use the operation gate. Layout
names are validated before any file path is built, so a name cannot escape the
layouts directory.

An older running extension may lack these new methods. Reinstall and log out/in
before using the wizard; the CLI reports this mismatch instead of saving through
the legacy non-interactive path. The preferences window reports the same mismatch
when a method is missing.

## Manual GNOME Validation

After `npm run install:local`, log out/in and enable the extension. Then:

1. Open two windows from the same app and another app on a different workspace
   or monitor. Make one window sticky and minimize another if available.
2. Run setup with `--configure` and a new name. Check that the metadata lets you
   distinguish the windows and that minimized windows are excluded by default.
3. Select a subset, revise it with `edit`, and confirm. Inspect
   `~/.config/workspace-layout/layouts/<name>.json` for only the selected windows.
   Confirm all live windows stayed unchanged.
4. Repeat with `--include-minimized`, including a sticky-only selection, and
   check the saved state and grouping.
5. Repeat with an existing name: without `--force`, expect rejection. With
   `--force`, cancel at each prompt and check that the original file is unchanged;
   only a confirmed valid selection may replace it.
6. Test empty/out-of-range input, Ctrl+C, and Ctrl+D at the prompts. Confirm no
   unexpected file writes. While a wizard waits, run `workspace-layout doctor`
   and a second setup with another new name to confirm input does not block the
   extension operation gate.
7. Try redirecting stdin or stdout. Expect an interactive-terminal error before
   any capture or save. Check the GNOME journal for extension errors.

## Manual Preferences Validation

Open the preferences window with:

```bash
gnome-extensions prefs workspace-layout@franciscoknebel.com
```

Then:

1. Check that Layouts lists every file in the layouts folder, including invalid
   JSON, and that counts, paths, and modification times match the files.
2. Capture a layout from the Capture page, uncheck one window, save it, and
   confirm the file contains only the checked entries. Confirm live windows did
   not change.
3. Rename a workspace in GNOME Settings, refresh Status, and confirm the layout
   reports the old name as missing. Use Remap to choose a current workspace and
   confirm the file is rewritten in place.
4. Open Edit on a layout. Drag a rectangle, resize it with the handles, apply a
   preset, and enter exact percentages. Save and inspect the layout file to
   confirm only `position` and `monitor` changed. Revert and confirm the file is
   unchanged until Save.
5. Apply a layout and confirm new windows are placed on the mapped workspaces and
   monitors. Confirm windows that were already open were not moved or closed.
6. Try Apply on a layout with a missing monitor, then cancel and apply anyway.
   Confirm the result dialog reports which windows could not be placed.
7. Delete a layout and confirm only that file is removed. Open a layout file and
   the layouts folder from the preferences window.
8. Disable the extension and refresh. Confirm the window reports that Workspace
   Layout is not running instead of crashing or writing files.
