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
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return ['status must be an object'];
  }

  const status = value as Record<string, unknown>;
  const errors: string[] = [];

  if (!Array.isArray(status.monitors) || !status.monitors.every(isMonitor)) {
    errors.push('status.monitors must contain valid monitor entries');
  }

  if (
    !Array.isArray(status.workspaces) ||
    !status.workspaces.every(isWorkspace)
  ) {
    errors.push('status.workspaces must contain valid workspace entries');
  }

  if (
    typeof status.activeWorkspaceIndex !== 'number' ||
    !Number.isInteger(status.activeWorkspaceIndex) ||
    status.activeWorkspaceIndex < 0
  ) {
    errors.push('status.activeWorkspaceIndex must be a non-negative integer');
  }

  if (typeof status.layoutsDir !== 'string') {
    errors.push('status.layoutsDir must be a string');
  }

  if (typeof status.schemaPath !== 'string') {
    errors.push('status.schemaPath must be a string');
  }

  return errors;
}

function isMonitor(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const monitor = value as Record<string, unknown>;
  return ['index', 'x', 'y', 'width', 'height'].every(
    (key) =>
      typeof monitor[key] === 'number' &&
      Number.isFinite(monitor[key]) &&
      (monitor[key] as number) >= 0,
  );
}

function isWorkspace(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const workspace = value as Record<string, unknown>;
  return (
    typeof workspace.index === 'number' &&
    Number.isInteger(workspace.index) &&
    workspace.index >= 0 &&
    typeof workspace.name === 'string' &&
    typeof workspace.active === 'boolean'
  );
}
