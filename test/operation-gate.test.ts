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

it('holds the gate across asynchronous waits and releases it after rejection', async () => {
  const gate = new OperationGate();
  let rejectWait: (reason: Error) => void = () => {};
  const pending = gate.runAsync(
    () =>
      new Promise((_resolve, reject) => {
        rejectWait = reject;
      }),
  );
  expect(gate.run(() => ({ ok: true, errors: [], messages: [] })).ok).toBe(
    false,
  );
  expect(
    (await gate.runAsync(async () => ({ ok: true, errors: [], messages: [] })))
      .ok,
  ).toBe(false);
  const rejected = expect(pending).rejects.toThrow('cancelled');
  rejectWait(new Error('cancelled'));
  await rejected;
  expect(gate.run(() => ({ ok: true, errors: [], messages: [] })).ok).toBe(
    true,
  );
});
