import { isRecord } from './objects.js';

export type OperationResult = {
  ok: boolean;
  errors: string[];
  messages: string[];
};

export function result(errors: string[], messages: string[]): OperationResult {
  return { ok: errors.length === 0, errors, messages };
}

export function operationFailure(
  error: unknown,
  describe: (value: unknown) => string = String,
): OperationResult {
  return result([describe(error)], []);
}

export function isOperationResult(
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
