# Force replacement verification

Issue #2 is already implemented in `main` (commit
`34bae251ce8bd40a40ffda14a50029ca1e8216bf`). This change adds regression evidence
instead of introducing another overwrite mechanism.

The CLI parses `--force` before or after the name and sends `SetupForce(name,
includeMinimized)`. The extension keeps legacy `Setup(name, includeMinimized)`
for installed clients and routes the two methods to `captureLayout` with an
explicit false/true force flag.

Without force, an existing name is rejected before capture or writing. With
force, the complete validated capture replaces the file: old workspaces, sticky
entries and optional fields are not merged, and no backup is created. A failed
or incomplete forced capture preserves the previous file.

Automated tests cover new names with either force value, existing names with
and without force, replacement without retained old entries, incomplete capture,
and CLI flag ordering. Storage is mocked, so these checks do not overwrite user
layouts. `test/dbus-interface.test.ts` protects the public input signatures.

For live verification, capture to a disposable name, confirm a second capture
fails without force, then capture a different set of windows with force. Inspect
the JSON to confirm only the new capture remains. Do not use a valuable layout
name for this destructive replacement check.
