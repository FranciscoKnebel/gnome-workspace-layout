import type { LayoutFile } from './layout.js';
import type { LayoutSummary } from './layout-summary.js';
import { result, type OperationResult } from './result.js';
import type { RuntimeStatus } from './status.js';

export type CapturePreview = OperationResult & { layout?: LayoutFile };

export type ListLayoutsResponse = OperationResult & {
  layouts?: LayoutSummary[];
};

export type ReadLayoutResponse = OperationResult & { layout?: LayoutFile };

export type StatusResponse = OperationResult & { status?: RuntimeStatus };

export type ExtensionResponse = OperationResult & {
  layout?: LayoutFile;
  layouts?: LayoutSummary[];
  status?: RuntimeStatus;
};

export function listLayoutsResult(
  layouts: LayoutSummary[] = [],
  errors: string[] = [],
  messages: string[] = [],
): ListLayoutsResponse {
  return { ...result(errors, messages), layouts };
}

export function readLayoutResult(
  layout: LayoutFile | undefined,
  errors: string[] = [],
  messages: string[] = [],
): ReadLayoutResponse {
  return {
    ...result(errors, messages),
    ...(layout === undefined ? {} : { layout }),
  };
}

export function statusResult(
  status: RuntimeStatus | undefined,
  errors: string[] = [],
  messages: string[] = [],
): StatusResponse {
  return {
    ...result(errors, messages),
    ...(status === undefined ? {} : { status }),
  };
}
