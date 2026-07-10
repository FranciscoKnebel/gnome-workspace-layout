import { describe, expect, it } from 'vitest';
import {
  describeGdbusCallFailure,
  parseGdbusSingleString,
} from '../src/cli/gdbus.js';

describe('parseGdbusSingleString', () => {
  it('extracts a JSON string from gdbus tuple output', () => {
    expect(parseGdbusSingleString(`('{"ok":true}',)\n`)).toBe('{"ok":true}');
  });

  it('unescapes common GVariant string escapes', () => {
    expect(parseGdbusSingleString(`('line 1\\nline 2\\t\\'quoted\\'',)`)).toBe(
      "line 1\nline 2\t'quoted'",
    );
  });

  it('throws for unexpected output', () => {
    expect(() => parseGdbusSingleString('not a tuple')).toThrow(
      'Unexpected gdbus output',
    );
  });
});

describe('describeGdbusCallFailure', () => {
  it('explains when the running extension does not support --force', () => {
    expect(
      describeGdbusCallFailure(
        'SetupForce',
        'GDBus.Error:org.freedesktop.DBus.Error.UnknownMethod: No such method',
      ),
    ).toBe(
      'The running extension does not support --force. Restart GNOME Shell or log out/in, then try again.',
    );
  });
});
