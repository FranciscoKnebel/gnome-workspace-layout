export type OperationResult = {
  ok: boolean;
  errors: string[];
  messages: string[];
};

export function result(errors: string[], messages: string[]): OperationResult {
  return { ok: errors.length === 0, errors, messages };
}
