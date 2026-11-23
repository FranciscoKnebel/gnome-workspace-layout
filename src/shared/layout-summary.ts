import {
  isNonNegativeInteger as isNonNegativeIntegerValue,
  isRecord,
} from './objects.js';
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

function readWorkspaceNames(layout: unknown): string[] {
  if (!isRecord(layout) || !isRecord(layout.workspaces)) {
    return [];
  }

  return Object.keys(layout.workspaces);
}

function readWindows(layout: unknown): Array<{ monitor?: unknown }> {
  if (!isRecord(layout)) {
    return [];
  }

  const windows: Array<{ monitor?: unknown }> = [];

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

export function validateLayoutSummary(value: unknown): string[] {
  if (!isRecord(value)) {
    return ['layout summary must be an object'];
  }

  const errors: string[] = [];

  if (typeof value.name !== 'string') {
    errors.push('layout summary.name must be a string');
  }

  if (!isNonNegativeIntegerValue(value.windowCount)) {
    errors.push('layout summary.windowCount must be a non-negative integer');
  }

  if (!isNonNegativeIntegerValue(value.workspaceCount)) {
    errors.push('layout summary.workspaceCount must be a non-negative integer');
  }

  if (!isNonNegativeIntegerValue(value.stickyCount)) {
    errors.push('layout summary.stickyCount must be a non-negative integer');
  }

  if (
    !Array.isArray(value.workspaces) ||
    !value.workspaces.every((name) => typeof name === 'string')
  ) {
    errors.push('layout summary.workspaces must contain strings');
  }

  if (
    !Array.isArray(value.monitors) ||
    !value.monitors.every(isNonNegativeIntegerValue)
  ) {
    errors.push('layout summary.monitors must contain non-negative integers');
  }

  if (typeof value.valid !== 'boolean') {
    errors.push('layout summary.valid must be a boolean');
  }

  if (
    !Array.isArray(value.errors) ||
    !value.errors.every((error) => typeof error === 'string')
  ) {
    errors.push('layout summary.errors must contain strings');
  }

  if (
    !Array.isArray(value.missingWorkspaces) ||
    !value.missingWorkspaces.every((name) => typeof name === 'string')
  ) {
    errors.push('layout summary.missingWorkspaces must contain strings');
  }

  if (
    !Array.isArray(value.missingMonitors) ||
    !value.missingMonitors.every(isNonNegativeIntegerValue)
  ) {
    errors.push(
      'layout summary.missingMonitors must contain non-negative integers',
    );
  }

  if (value.path !== undefined && typeof value.path !== 'string') {
    errors.push('layout summary.path must be a string when present');
  }

  if (
    value.modifiedAt !== null &&
    (typeof value.modifiedAt !== 'number' || !Number.isFinite(value.modifiedAt))
  ) {
    errors.push('layout summary.modifiedAt must be a number or null');
  }

  return errors;
}
