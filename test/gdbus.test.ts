import { describe, expect, it } from 'vitest';
import { parseGdbusSingleString } from '../src/cli/gdbus.js';

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
