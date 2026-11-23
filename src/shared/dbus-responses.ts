import type { LayoutFile } from './layout.js';
import type { LayoutSummary } from './layout-summary.js';
import { result, type OperationResult } from './result.js';
import type { RuntimeStatus } from './status.js';

export type CapturePreview = OperationResult & { layout?: LayoutFile };

export type ListLayoutsResponse = OperationResult & {
  layouts: LayoutSummary[];
};

export type ReadLayoutResponse = OperationResult & {
  layout: LayoutFile | null;
};

export type StatusResponse = OperationResult & {
  status: RuntimeStatus | null;
};

export type DbusMethod =
  | 'Apply'
  | 'PreviewSetup'
  | 'SaveSetup'
  | 'DeleteLayout'
  | 'ListLayouts'
  | 'ReadLayout'
  | 'GetStatus';

export type DbusResponseFor<M extends DbusMethod> = M extends 'ListLayouts'
  ? ListLayoutsResponse
  : M extends 'ReadLayout'
    ? ReadLayoutResponse
    : M extends 'GetStatus'
      ? StatusResponse
      : M extends 'PreviewSetup'
        ? CapturePreview
        : OperationResult;

export function listLayoutsResult(
  layouts: LayoutSummary[] = [],
  errors: string[] = [],
  messages: string[] = [],
): ListLayoutsResponse {
  return { ...result(errors, messages), layouts };
}

export function readLayoutResult(
  layout: LayoutFile | null,
  errors: string[] = [],
  messages: string[] = [],
): ReadLayoutResponse {
  return { ...result(errors, messages), layout };
}

export function statusResult(
  status: RuntimeStatus | null,
  errors: string[] = [],
  messages: string[] = [],
): StatusResponse {
  return { ...result(errors, messages), status };
}
