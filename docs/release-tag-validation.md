# Release tag validation migration trigger

Issue #5 records a conditional migration, not a request to replace shell glue
immediately. The current release workflow only reads `package.json#version`,
prefixes it with `v`, compares it exactly to the requested tag and fails on a
mismatch. Keep that small check in `.github/workflows/release.yml`.

## When to migrate

Move tag validation into a pure function in `src/shared/` as soon as it needs
semantic version parsing, version ordering, prerelease rules, format validation,
or agreement between additional version sources. File length is not the trigger.
ZIP metadata validation in `src/shared/release.ts` is a separate responsibility;
it does not change this decision.

## Migration contract

The future function should receive the requested tag and package version as
values and return errors without reading files, environment variables or Git.
A thin script or workflow step reads inputs, calls the function and exits nonzero
on errors. Preserve the existing exact `v<package version>` policy unless a
separate product decision changes it.

Add `test/release-tag.test.ts` with matching and mismatching tags, absent and
malformed inputs, prerelease/build metadata cases relevant to the new rules,
and any newly introduced version comparison. Invoke the validator before
creating a Git tag or release. Run `npm run check` and verify a rejected tag
cannot reach the publishing step.

## Current disposition

The migration trigger is not present in the current code. No runtime migration
is needed now; keep issue #5 open as the trigger for a future change. This
document makes the decision and expected follow-up reviewable without adding
unused release code.
