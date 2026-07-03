# AGENTS.md

This repository contains a GNOME Shell extension and CLI named Workspace Layout.

## Operating Context

- Target platform: Fedora/GNOME Wayland, initially GNOME Shell 50.
- Public extension name: `Workspace Layout`.
- Technical name and CLI command: `workspace-layout`.
- GNOME extension UUID: `workspace-layout@franciscoknebel.com`.
- License: GPL-3.0-or-later.
- Runtime source is TypeScript, compiled to JavaScript for GNOME Shell and Node.js.

## Required Checks

Run this before reporting completion for code changes:

```bash
npm run check
```

This includes linting, Prettier checks, TypeScript type checks, Vitest tests, and build output generation.

For documentation-only changes, run at least:

```bash
npm run lint
```

## Architecture Guardrails

- Do not use X11 tools such as `wmctrl` or `xdotool` for core behavior. GNOME Wayland window manipulation must happen inside the GNOME Shell extension.
- Keep GNOME-specific APIs in `src/extension/`.
- Keep Node.js APIs in `src/cli/`.
- Put testable, environment-independent behavior in `src/shared/`.
- Keep layout schema changes synchronized across TypeScript types, validator code, `schema/workspace-layout.schema.json`, docs, and tests.
- Preserve the behavior that `workspace-layout apply <name>` only positions newly-created windows and does not alter existing windows.

## Files Of Interest

- `README.md`: user-facing overview and basic usage.
- `CONTRIBUTING.md`: contributor workflow.
- `docs/ADR-0001-architecture.md`: accepted architecture decisions.
- `docs/GLOSSARY.md`: domain vocabulary.
- `extension/metadata.json`: GNOME extension metadata.
- `src/extension/extension.ts`: GNOME Shell extension and D-Bus implementation.
- `src/cli/workspace-layout.ts`: CLI implementation.
- `src/shared/layout.ts`: layout types and validation.
- `src/shared/geometry.ts`: monitor-relative geometry logic.
- `schema/workspace-layout.schema.json`: layout JSON Schema.

## Git Hygiene

- Do not commit generated folders: `bin/`, `dist/`, `lib/`, `coverage/`, or `node_modules/`.
- Commit `package-lock.json`; CI and release workflows use `npm ci` for reproducible installs.
- Do not commit local layout files from `~/.config/workspace-layout/`.
