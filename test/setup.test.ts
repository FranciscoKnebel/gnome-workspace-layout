import { describe, expect, it } from 'vitest';
import { parseSetupOptions } from '../src/cli/setup.js';

describe('parseSetupOptions', () => {
  it('accepts flags before or after the layout name', () => {
    expect(
      parseSetupOptions(['--force', 'trabalho', '--include-minimized']),
    ).toEqual({
      configure: false,
      force: true,
      includeMinimized: true,
      name: 'trabalho',
    });
  });

  it('enables the wizard together with the other capture flags', () => {
    expect(
      parseSetupOptions([
        '--configure',
        'trabalho',
        '--include-minimized',
        '--force',
      ]),
    ).toEqual({
      configure: true,
      force: true,
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
