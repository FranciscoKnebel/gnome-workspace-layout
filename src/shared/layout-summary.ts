import { isRecord } from './objects.js';
import type { LayoutFile } from './layout.js';
import { validateLayout } from './layout.js';

export type LayoutEnvironment = {
  workspaces: string[];
  monitors: number[];
};

export type LayoutSummary = {
  name: string;
  path?: string;
  windowCount: number;
  workspaceCount: number;
  stickyCount: number;
  workspaces: string[];
  monitors: number[];
  valid: boolean;
  errors: string[];
  missingWorkspaces: string[];
  missingMonitors: number[];
  modifiedAt: number | null;
};

export type LayoutSummaryMetadata = {
  name?: string;
  path?: string;
  modifiedAt?: number | null;
};

export function summarizeLayout(
  layout: unknown,
  environment: LayoutEnvironment,
  metadata: LayoutSummaryMetadata = {},
): LayoutSummary {
  const validation = validateLayout(layout);
  const workspaces = readWorkspaceNames(layout);
  const windows = readWindows(layout);
  const monitors = [
    ...new Set(
      windows.map((window) => window.monitor).filter(isNonNegativeInteger),
    ),
  ].sort((left, right) => left - right);
  const name =
    metadata.name ??
    (isRecord(layout) && typeof layout.name === 'string' ? layout.name : '');

  return {
    name,
    ...(metadata.path === undefined ? {} : { path: metadata.path }),
    windowCount: windows.length,
    workspaceCount: workspaces.length,
    stickyCount: readStickyEntries(layout).length,
    workspaces,
    monitors,
    valid: validation.errors.length === 0,
    errors: validation.errors,
    missingWorkspaces: workspaces.filter(
      (workspace) => !environment.workspaces.includes(workspace),
    ),
    missingMonitors: monitors.filter(
      (monitor) => !environment.monitors.includes(monitor),
    ),
    modifiedAt: metadata.modifiedAt ?? null,
  };
}

export function remapLayoutWorkspaces(
  layout: LayoutFile,
  mapping: Readonly<Record<string, string>>,
): LayoutFile {
  const workspaces: LayoutFile['workspaces'] = {};

  for (const [workspaceName, workspace] of Object.entries(layout.workspaces)) {
    const targetName = mapping[workspaceName] ?? workspaceName;
    workspaces[targetName] ??= { windows: [] };
    workspaces[targetName].windows.push(...workspace.windows);
  }

  return {
    ...(layout.$schema === undefined ? {} : { $schema: layout.$schema }),
    name: layout.name,
    workspaces,
    ...(layout.sticky === undefined ? {} : { sticky: layout.sticky }),
  };
}

function readWorkspaceNames(layout: unknown): string[] {
  if (!isRecord(layout) || !isRecord(layout.workspaces)) {
    return [];
  }

  return Object.keys(layout.workspaces);
}

function readWindows(layout: unknown): Record<string, unknown>[] {
  if (!isRecord(layout)) {
    return [];
  }

  const windows: Record<string, unknown>[] = [];

  if (isRecord(layout.workspaces)) {
    for (const workspace of Object.values(layout.workspaces)) {
      if (!isRecord(workspace) || !Array.isArray(workspace.windows)) {
        continue;
      }

      for (const window of workspace.windows) {
        if (isRecord(window)) {
          windows.push(window);
        }
      }
    }
  }

  for (const window of readStickyEntries(layout)) {
    if (isRecord(window)) {
      windows.push(window);
    }
  }

  return windows;
}

function readStickyEntries(layout: unknown): unknown[] {
  if (!isRecord(layout) || !Array.isArray(layout.sticky)) {
    return [];
  }

  return layout.sticky;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
