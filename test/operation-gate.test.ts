import { describe, expect, it } from 'vitest';
import { OperationGate } from '../src/extension/operation-gate.js';

describe('extension operation gate', () => {
  it('rejects a reentrant operation', () => {
    const gate = new OperationGate();

    expect(gate.run(() => gate.run(success))).toEqual({
      ok: false,
      errors: ['Another workspace-layout operation is already running'],
      messages: [],
    });
  });

  it('allows another operation after completion', () => {
    const gate = new OperationGate();

    expect(gate.run(success)).toEqual(success());
    expect(gate.run(success)).toEqual(success());
  });

  it('allows another operation after an exception', () => {
    const gate = new OperationGate();

    expect(() =>
      gate.run(() => {
        throw new Error('failed');
      }),
    ).toThrow('failed');
    expect(gate.run(success)).toEqual(success());
  });
});

function success() {
  return { ok: true, errors: [], messages: ['ok'] };
}
