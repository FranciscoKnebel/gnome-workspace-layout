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

  it('separates preview from confirmed persistence for the setup wizard', () => {
    expect(inputTypes('PreviewSetup')).toEqual(['s', 'b', 'b']);
    expect(inputTypes('SaveSetup')).toEqual(['s', 'b']);
  });
});

describe('D-Bus preferences methods', () => {
  it('lists and reads layouts for the preferences window', () => {
    expect(inputTypes('ListLayouts')).toEqual([]);
    expect(inputTypes('ReadLayout')).toEqual(['s']);
  });

  it('deletes a layout by name and reports runtime status', () => {
    expect(inputTypes('DeleteLayout')).toEqual(['s']);
    expect(inputTypes('GetStatus')).toEqual([]);
  });

  it('reports status and layouts together for the preferences refresh', () => {
    expect(inputTypes('GetOverview')).toEqual([]);
  });
});
