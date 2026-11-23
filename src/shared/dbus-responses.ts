import type { LayoutFile } from './layout.js';
import { validateLayout } from './layout.js';
import type { LayoutSummary } from './layout-summary.js';
import { isRecord } from './objects.js';
import { isOperationResult, result, type OperationResult } from './result.js';
import type { RuntimeStatus } from './status.js';
import { validateStatus } from './status.js';

export type CapturePreview = OperationResult & {
  kind: 'PreviewSetup';
  layout?: LayoutFile;
};

export type ListLayoutsResponse = OperationResult & {
  kind: 'ListLayouts';
  layouts: LayoutSummary[];
};

export type ReadLayoutResponse = OperationResult & {
  kind: 'ReadLayout';
  layout: LayoutFile | null;
};

export type StatusResponse = OperationResult & {
  kind: 'GetStatus';
  status: RuntimeStatus | null;
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

export function listLayoutsResult(
  layouts: LayoutSummary[] = [],
  errors: string[] = [],
  messages: string[] = [],
): ListLayoutsResponse {
  return {
    ...result(errors, messages),
    kind: 'ListLayouts',
    layouts,
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

export function statusResult(
  status: RuntimeStatus | null,
  errors: string[] = [],
  messages: string[] = [],
): StatusResponse {
  return {
    ...result(errors, messages),
    kind: 'GetStatus',
    status,
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

export function isListLayoutsResponse(
  value: unknown,
): value is ListLayoutsResponse {
  return (
    isOperationResult(value) &&
    value.kind === 'ListLayouts' &&
    Array.isArray(value.layouts)
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

export function isStatusResponse(value: unknown): value is StatusResponse {
  return (
    isOperationResult(value) &&
    value.kind === 'GetStatus' &&
    'status' in value &&
    (value.status === null ||
      (isRecord(value.status) && validateStatus(value.status).length === 0))
  );
}
