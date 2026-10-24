import { describe, expect, it } from 'vitest';
import {
  describeGdbusCallFailure,
  parseGdbusSingleString,
} from '../src/cli/gdbus.js';

describe('parseGdbusSingleString', () => {
  it('extracts a JSON string from gdbus tuple output', () => {
    expect(parseGdbusSingleString(`('{"ok":true}',)\n`)).toBe('{"ok":true}');
  });

  it('accepts double-quoted strings with escaped quotes and backslashes', () => {
    expect(
      parseGdbusSingleString(
        String.raw`("Francisco's \"Calculator\" in C:\\temp",)`,
      ),
    ).toBe(`Francisco's "Calculator" in C:\\temp`);
  });

  it('unescapes common GVariant string escapes', () => {
    expect(parseGdbusSingleString(`('line 1\\nline 2\\t\\'quoted\\'',)`)).toBe(
      "line 1\nline 2\t'quoted'",
    );
  });

  it('decodes control and Unicode escapes printed by GLib', () => {
    expect(
      parseGdbusSingleString(
        String.raw`('\a\b\f\v\u001b\u007f\u0085\u202e\U000e0001',)`,
      ),
    ).toBe('\x07\b\f\v\x1b\x7f\u0085\u202e\u{e0001}');
  });

  it('preserves the separate JSON escaping layer', () => {
    const output = String.raw`('{"title":"line 1\\nline 2","path":"C:\\\\temp","literal":"\\\\u202e"}',)`;

    expect(JSON.parse(parseGdbusSingleString(output))).toEqual({
      title: 'line 1\nline 2',
      path: 'C:\\temp',
      literal: '\\u202e',
    });
  });

  it('ignores escaped line continuations', () => {
    expect(parseGdbusSingleString("('line 1\\\nline 2',)")).toBe(
      'line 1line 2',
    );
  });

  it.each([
    String.raw`('\u12',)`,
    String.raw`('\uZZZZ',)`,
    String.raw`('\u0000',)`,
    String.raw`('\ud800',)`,
    String.raw`('\U00110000',)`,
  ])('rejects invalid Unicode escapes: %s', (output) => {
    expect(() => parseGdbusSingleString(output)).toThrow(
      'Invalid Unicode escape',
    );
  });

  it.each([
    `('one', 'two',)`,
    `("one", "two",)`,
    `('mismatched",)`,
    String.raw`('unfinished\',)`,
  ])('rejects malformed single-string tuples: %s', (output) => {
    expect(() => parseGdbusSingleString(output)).toThrow(
      'Unexpected gdbus output',
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

  it.each(['PreviewSetup', 'SaveSetup'])(
    'explains when %s is missing from an older extension',
    (method) => {
      expect(
        describeGdbusCallFailure(
          method,
          'GDBus.Error:org.freedesktop.DBus.Error.UnknownMethod: No such method',
        ),
      ).toBe(
        'The running extension does not support --configure. Reinstall the extension and log out/in, then try again.',
      );
    },
  );
});
