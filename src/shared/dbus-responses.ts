import type { LayoutFile } from './layout.js';
import { validateLayout } from './layout.js';
import { validateLayoutSummary } from './layout-summary.js';
import type { LayoutSummary } from './layout-summary.js';
import { isRecord } from './objects.js';
import { isOperationResult, result, type OperationResult } from './result.js';
import type { RuntimeStatus } from './status.js';
import { validateStatus } from './status.js';

export type CapturePreview = OperationResult & {
  kind: 'PreviewSetup';
  layout?: LayoutFile;
};

export type ReadLayoutResponse = OperationResult & {
  kind: 'ReadLayout';
  layout: LayoutFile | null;
};

export type OverviewResponse = OperationResult & {
  kind: 'GetOverview';
  status: RuntimeStatus | null;
  layouts: LayoutSummary[];
};

export function capturePreviewResult(
  layout: LayoutFile | undefined,
  errors: string[] = [],
  messages: string[] = [],
): CapturePreview {
  return {
    ...result(errors, messages),
    kind: 'PreviewSetup',
    ...(layout === undefined ? {} : { layout }),
  };
}

export function readLayoutResult(
  layout: LayoutFile | null,
  errors: string[] = [],
  messages: string[] = [],
): ReadLayoutResponse {
  return {
    ...result(errors, messages),
    kind: 'ReadLayout',
    layout,
  };
}

export function overviewResult(
  status: RuntimeStatus | null,
  layouts: LayoutSummary[] = [],
  errors: string[] = [],
  messages: string[] = [],
): OverviewResponse {
  return {
    ...result(errors, messages),
    kind: 'GetOverview',
    status,
    layouts,
  };
}

export function isCapturePreview(value: unknown): value is CapturePreview {
  return (
    isOperationResult(value) &&
    value.kind === 'PreviewSetup' &&
    (value.layout === undefined ||
      (isRecord(value.layout) &&
        validateLayout(value.layout).errors.length === 0))
  );
}

export function isReadLayoutResponse(
  value: unknown,
): value is ReadLayoutResponse {
  return (
    isOperationResult(value) &&
    value.kind === 'ReadLayout' &&
    'layout' in value &&
    (value.layout === null ||
      (isRecord(value.layout) &&
        validateLayout(value.layout).errors.length === 0))
  );
}

export function isOverviewResponse(value: unknown): value is OverviewResponse {
  if (!isOperationResult(value) || value.kind !== 'GetOverview') {
    return false;
  }

  const statusValid =
    value.status === null ||
    (isRecord(value.status) && validateStatus(value.status).length === 0);
  const layoutsValid =
    Array.isArray(value.layouts) &&
    value.layouts.every((layout) => validateLayoutSummary(layout).length === 0);

  return statusValid && layoutsValid;
}
