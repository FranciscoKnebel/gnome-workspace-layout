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
also cancels. Cancellation exits unsuccessfully without creating or replacing a
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

An older running extension may lack these new methods. Reinstall and log out/in
before using the wizard; the CLI reports this mismatch instead of saving through
the legacy non-interactive path.

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
