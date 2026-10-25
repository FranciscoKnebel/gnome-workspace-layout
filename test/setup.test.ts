import { describe, expect, it } from 'vitest';
import { parseSetupOptions } from '../src/cli/setup.js';

describe('parseSetupOptions', () => {
  it('accepts flags before or after the layout name', () => {
    expect(
      parseSetupOptions(['--force', 'trabalho', '--include-minimized']),
    ).toEqual({
      force: true,
      configure: false,
      includeMinimized: true,
      name: 'trabalho',
    });
  });

  it('rejects unknown options', () => {
    expect(() => parseSetupOptions(['trabalho', '--overwrite'])).toThrow(
      'Unknown setup option: --overwrite',
    );
  });

  it('rejects multiple layout names', () => {
    expect(() => parseSetupOptions(['trabalho', 'pessoal'])).toThrow(
      'Only one layout name is allowed for setup.',
    );
  });
});
