import { isRecord } from './objects.js';

export const LAYOUT_SCHEMA_ID =
  'https://franciscoknebel.com/workspace-layout.schema.json';

export const LAYOUT_NAME_MAX_LENGTH = 64;

export const POSITION_PRESETS = [
  'full',
  'left',
  'right',
  'top',
  'bottom',
  'center',
] as const;

export type PositionPreset = (typeof POSITION_PRESETS)[number];

export type RelativeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WindowPosition = PositionPreset | RelativeRect;

export type WindowMatch = {
  appId?: string;
  wmClass?: string;
  title?: string;
};

export type LayoutWindow = {
  label?: string;
  appId?: string;
  command?: string;
  title?: string;
  match?: WindowMatch;
  monitor: number;
  position: WindowPosition;
  minimized?: boolean;
  timeoutMs?: number;
};

export type WorkspaceLayout = {
  windows: LayoutWindow[];
};

export type LayoutFile = {
  $schema?: string;
  name: string;
  sticky?: LayoutWindow[];
  workspaces: Record<string, WorkspaceLayout>;
};

export type LayoutWindowTarget =
  | { kind: 'workspace'; workspaceName: string; window: LayoutWindow }
  | { kind: 'sticky'; window: LayoutWindow };

export type LayoutValidationResult = {
  errors: string[];
};

export function validateLayoutName(name: string): string[] {
  const errors: string[] = [];

  if (name.trim() === '') {
    return ['name must be a non-empty string'];
  }

  if (name !== name.trim()) {
    errors.push('name must not start or end with whitespace');
  }

  if ([...name].length > LAYOUT_NAME_MAX_LENGTH) {
    errors.push(
      `name must be at most ${LAYOUT_NAME_MAX_LENGTH} characters long`,
    );
  }

  if (name === '.' || name === '..') {
    errors.push('name must not be . or ..');
  }

  if (/[/\\\p{Cc}]/u.test(name)) {
    errors.push('name must not contain path separators or control characters');
  }

  return errors;
}

export function assertLayoutName(name: string): void {
  const errors = validateLayoutName(name);

  if (errors.length > 0) {
    throw new Error(`Invalid layout name:\n${errors.join('\n')}`);
  }
}

export function validateLayout(layout: unknown): LayoutValidationResult {
  const errors: string[] = [];

  if (!isRecord(layout)) {
    return { errors: ['layout must be an object'] };
  }

  if (typeof layout.name !== 'string') {
    errors.push('name must be a non-empty string');
  } else {
    errors.push(...validateLayoutName(layout.name));
  }

  if (!isRecord(layout.workspaces)) {
    errors.push('workspaces must be an object');
    return { errors };
  }

  if (layout.sticky !== undefined) {
    if (!Array.isArray(layout.sticky)) {
      errors.push('sticky must be an array');
    } else {
      layout.sticky.forEach((windowEntry, index) => {
        validateWindow(windowEntry, `sticky[${index}]`, errors);
      });
    }
  }

  if (
    Object.keys(layout.workspaces).length === 0 &&
    (!Array.isArray(layout.sticky) || layout.sticky.length === 0)
  ) {
    errors.push('layout must define at least one workspace or sticky window');
  }

  for (const [workspaceName, workspace] of Object.entries(layout.workspaces)) {
    if (workspaceName.trim() === '') {
      errors.push('workspace names must be non-empty');
    }

    if (!isRecord(workspace)) {
      errors.push(`workspace ${workspaceName} must be an object`);
      continue;
    }

    if (!Array.isArray(workspace.windows)) {
      errors.push(`workspace ${workspaceName}.windows must be an array`);
      continue;
    }

    workspace.windows.forEach((windowEntry, index) => {
      validateWindow(
        windowEntry,
        `workspace ${workspaceName}.windows[${index}]`,
        errors,
      );
    });
  }

  return { errors };
}

export function assertLayout(layout: unknown): asserts layout is LayoutFile {
  const { errors } = validateLayout(layout);

  if (errors.length > 0) {
    throw new Error(`Invalid workspace layout:\n${errors.join('\n')}`);
  }
}

export function layoutWindowsInApplyOrder(
  layout: LayoutFile,
): LayoutWindowTarget[] {
  const targets: LayoutWindowTarget[] = [];

  for (const [workspaceName, workspace] of Object.entries(layout.workspaces)) {
    for (const window of workspace.windows) {
      targets.push({ kind: 'workspace', workspaceName, window });
    }
  }

  for (const window of layout.sticky ?? []) {
    targets.push({ kind: 'sticky', window });
  }

  return targets;
}

/**
 * Accumulates windows by workspace name. Workspace names are arbitrary strings,
 * so entries are kept in a Map until toRecord creates own properties with
 * Object.fromEntries. That prevents keys such as "__proto__" from reaching a
 * prototype setter.
 */
export class WorkspaceAccumulator {
  private readonly workspaces = new Map<string, WorkspaceLayout>();

  add(workspaceName: string, windows: readonly LayoutWindow[]): void {
    const workspace = this.workspaces.get(workspaceName) ?? { windows: [] };
    workspace.windows.push(...windows);
    this.workspaces.set(workspaceName, workspace);
  }

  toRecord(): LayoutFile['workspaces'] {
    return Object.fromEntries(this.workspaces);
  }
}

function validateWindow(entry: unknown, path: string, errors: string[]): void {
  if (!isRecord(entry)) {
    errors.push(`${path} must be an object`);
    return;
  }

  if (
    entry.command !== undefined &&
    (typeof entry.command !== 'string' || entry.command.trim() === '')
  ) {
    errors.push(`${path}.command must be a non-empty string`);
  }

  if (
    entry.appId !== undefined &&
    (typeof entry.appId !== 'string' || entry.appId.trim() === '')
  ) {
    errors.push(`${path}.appId must be a non-empty string`);
  }

  if (entry.command === undefined && entry.appId === undefined) {
    errors.push(`${path} must define command or appId`);
  }

  if (
    typeof entry.monitor !== 'number' ||
    !Number.isInteger(entry.monitor) ||
    entry.monitor < 0
  ) {
    errors.push(`${path}.monitor must be a non-negative integer`);
  }

  if (!isPosition(entry.position)) {
    errors.push(`${path}.position must be a supported preset or relative rect`);
  }

  if (entry.match !== undefined && !isMatch(entry.match)) {
    errors.push(
      `${path}.match must contain string appId, wmClass, or title fields`,
    );
  }

  if (
    entry.timeoutMs !== undefined &&
    (typeof entry.timeoutMs !== 'number' ||
      !Number.isInteger(entry.timeoutMs) ||
      entry.timeoutMs <= 0)
  ) {
    errors.push(`${path}.timeoutMs must be a positive integer`);
  }
}

function isPosition(position: unknown): position is WindowPosition {
  if (typeof position === 'string') {
    return POSITION_PRESETS.includes(position as PositionPreset);
  }

  if (!isRecord(position)) {
    return false;
  }

  return (
    isUnitNumber(position.x) &&
    isUnitNumber(position.y) &&
    isPositiveUnitNumber(position.width) &&
    isPositiveUnitNumber(position.height)
  );
}

function isMatch(match: unknown): match is WindowMatch {
  if (!isRecord(match)) {
    return false;
  }

  const supportedKeys = ['appId', 'wmClass', 'title'];
  const keys = Object.keys(match);
  if (keys.length === 0 || keys.some((key) => !supportedKeys.includes(key))) {
    return false;
  }

  const values = keys.map((key) => match[key]);

  return values.every(
    (value) => typeof value === 'string' && value.trim() !== '',
  );
}

function isUnitNumber(value: unknown): value is number {
  return typeof value === 'number' && value >= 0 && value <= 1;
}

function isPositiveUnitNumber(value: unknown): value is number {
  return typeof value === 'number' && value > 0 && value <= 1;
}
