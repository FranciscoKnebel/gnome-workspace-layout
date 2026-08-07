# ADR-0002: Reproducible Release Packaging

## Status

Accepted.

## Context

Workspace Layout ships as two related artifacts:

- A GNOME Shell extension ZIP containing `extension.js` and `metadata.json`.
- A CLI/schema archive containing the `workspace-layout` command and JSON Schema.

The project also needs CI and release jobs to behave predictably. Earlier versions
used `npm install` and did not commit `package-lock.json`, which meant dependency
resolution could change without a source change.

## Decision

Commit `package-lock.json` and use `npm ci` in CI and release workflows.

Keep the release packaging logic in `scripts/package-release.sh`, and call that
same script from both local development and GitHub Actions through:

```bash
npm run package:release
```

The extension ZIP is validated after packaging. Runtime files must be at the
ZIP root, development-only content is rejected, and required GNOME metadata is
checked. CI builds and validates the release artifacts on every change.

The release workflow validates that the requested tag matches the version in
`package.json` before creating a GitHub Release.

## Consequences

- CI and release builds are reproducible from the committed lockfile.
- Local packaging and GitHub release packaging use the same implementation.
- Invalid extension ZIP structure or metadata fails before publication.
- Pull requests exercise release packaging through CI.
- The release workflow fails early if `inputs.tag` and `package.json` diverge.
- Generated artifacts stay untracked under `release/`.

## Future Considerations

- Add a version bump workflow if release cadence becomes frequent.
- Consider publishing installable CLI packages only after the extension flow is stable.
