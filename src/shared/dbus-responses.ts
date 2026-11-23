import type { LayoutFile } from './layout.js';
import type { LayoutSummary } from './layout-summary.js';
import { isRecord } from './objects.js';
import { result, type OperationResult } from './result.js';
import type { RuntimeStatus } from './status.js';

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
    isResultRecord(value) &&
    value.kind === 'PreviewSetup' &&
    (value.layout === undefined || isRecord(value.layout))
  );
}

export function isListLayoutsResponse(
  value: unknown,
): value is ListLayoutsResponse {
  return (
    isResultRecord(value) &&
    value.kind === 'ListLayouts' &&
    Array.isArray(value.layouts)
  );
}

export function isReadLayoutResponse(
  value: unknown,
): value is ReadLayoutResponse {
  return (
    isResultRecord(value) &&
    value.kind === 'ReadLayout' &&
    'layout' in value &&
    (value.layout === null || isRecord(value.layout))
  );
}

export function isStatusResponse(value: unknown): value is StatusResponse {
  return (
    isResultRecord(value) &&
    value.kind === 'GetStatus' &&
    'status' in value &&
    (value.status === null || isRecord(value.status))
  );
}

function isResultRecord(
  value: unknown,
): value is Record<string, unknown> & OperationResult {
  return (
    isRecord(value) &&
    typeof value.ok === 'boolean' &&
    Array.isArray(value.errors) &&
    value.errors.every((error) => typeof error === 'string') &&
    Array.isArray(value.messages) &&
    value.messages.every((message) => typeof message === 'string')
  );
}
