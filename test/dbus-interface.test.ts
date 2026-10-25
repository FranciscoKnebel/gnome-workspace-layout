import { describe, expect, it } from 'vitest';
import { DBUS_XML } from '../src/extension/constants.js';

function inputTypes(methodName: string): string[] {
  const method = DBUS_XML.match(
    new RegExp(`<method name="${methodName}">([\\s\\S]*?)</method>`),
  )?.[1];

  if (method === undefined) {
    throw new Error(`Missing D-Bus method: ${methodName}`);
  }

  return [...method.matchAll(/<arg type="(\w)"[^>]*direction="in"/g)].map(
    ([, type]) => type,
  );
}

describe('D-Bus capture methods', () => {
  it('preserves Setup for installed CLIs', () => {
    expect(inputTypes('Setup')).toEqual(['s', 'b']);
  });

  it('exposes SetupForce with the same capture inputs', () => {
    expect(inputTypes('SetupForce')).toEqual(['s', 'b']);
  });
});

it('exposes SaveSetup with JSON and an explicit overwrite flag', () => {
  expect(inputTypes('SaveSetup')).toEqual(['s', 'b']);
});
