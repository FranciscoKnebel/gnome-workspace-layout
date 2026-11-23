import { isRecord } from './objects.js';

export type WorkspaceStatus = {
  index: number;
  name: string;
  active: boolean;
};

export type MonitorStatus = {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RuntimeStatus = {
  monitors: MonitorStatus[];
  workspaces: WorkspaceStatus[];
  activeWorkspaceIndex: number;
  layoutsDir: string;
  schemaPath: string;
};

export function validateStatus(value: unknown): string[] {
  if (!isRecord(value)) {
    return ['status must be an object'];
  }

  const errors: string[] = [];

  if (!Array.isArray(value.monitors) || !value.monitors.every(isMonitor)) {
    errors.push('status.monitors must contain valid monitor entries');
  }

  if (
    !Array.isArray(value.workspaces) ||
    !value.workspaces.every(isWorkspace)
  ) {
    errors.push('status.workspaces must contain valid workspace entries');
  }

  if (
    typeof value.activeWorkspaceIndex !== 'number' ||
    !Number.isInteger(value.activeWorkspaceIndex) ||
    value.activeWorkspaceIndex < 0
  ) {
    errors.push('status.activeWorkspaceIndex must be a non-negative integer');
  }

  if (typeof value.layoutsDir !== 'string') {
    errors.push('status.layoutsDir must be a string');
  }

  if (typeof value.schemaPath !== 'string') {
    errors.push('status.schemaPath must be a string');
  }

  return errors;
}

function isMonitor(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return ['index', 'x', 'y', 'width', 'height'].every(
    (key) =>
      typeof value[key] === 'number' &&
      Number.isFinite(value[key]) &&
      value[key] >= 0,
  );
}

function isWorkspace(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.index === 'number' &&
    Number.isInteger(value.index) &&
    value.index >= 0 &&
    typeof value.name === 'string' &&
    typeof value.active === 'boolean'
  );
}
