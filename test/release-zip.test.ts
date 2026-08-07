import { describe, expect, it } from 'vitest';
import { validateExtensionRelease } from '../src/shared/release.js';

const expectedUuid = 'workspace-layout@franciscoknebel.com';
const validMetadata = {
  uuid: expectedUuid,
  name: 'Workspace Layout',
  description: 'Capture and apply named workspace layouts.',
  version: 1,
  'shell-version': ['50'],
};

describe('extension release validation', () => {
  it('accepts the expected extension artifact', () => {
    expect(
      validateExtensionRelease(
        ['extension.js', 'metadata.json'],
        validMetadata,
        expectedUuid,
      ),
    ).toEqual({ errors: [] });
  });

  it('requires runtime files at the ZIP root', () => {
    expect(
      validateExtensionRelease(
        [`${expectedUuid}/extension.js`, `${expectedUuid}/metadata.json`],
        validMetadata,
        expectedUuid,
      ).errors,
    ).toEqual([
      'extension.js must exist at the ZIP root',
      'metadata.json must exist at the ZIP root',
    ]);
  });

  it('rejects development-only content', () => {
    expect(
      validateExtensionRelease(
        [
          'extension.js',
          'metadata.json',
          'src/extension.ts',
          'vendor/node_modules/package/index.js',
          'config/tsconfig.extension.json',
          'test/release.test.js',
          'package.json',
          '.github/workflows/ci.yml',
        ],
        validMetadata,
        expectedUuid,
      ).errors,
    ).toEqual([
      'Development-only file is not allowed in the extension ZIP: src/extension.ts',
      'Development-only file is not allowed in the extension ZIP: vendor/node_modules/package/index.js',
      'Development-only file is not allowed in the extension ZIP: config/tsconfig.extension.json',
      'Development-only file is not allowed in the extension ZIP: test/release.test.js',
      'Development-only file is not allowed in the extension ZIP: package.json',
      'Development-only file is not allowed in the extension ZIP: .github/workflows/ci.yml',
    ]);
  });

  it('validates required metadata fields', () => {
    expect(
      validateExtensionRelease(
        ['extension.js', 'metadata.json'],
        {
          uuid: 'wrong@example.com',
          name: '',
          description: 1,
          version: 0,
          'shell-version': [],
        },
        expectedUuid,
      ).errors,
    ).toEqual([
      `metadata.json uuid must be ${expectedUuid}`,
      'metadata.json name must be a non-empty string',
      'metadata.json description must be a non-empty string',
      'metadata.json version must be a positive integer',
      'metadata.json shell-version must be a non-empty array of non-empty strings',
    ]);
  });

  it('rejects non-object metadata', () => {
    expect(
      validateExtensionRelease(
        ['extension.js', 'metadata.json'],
        null,
        expectedUuid,
      ).errors,
    ).toEqual(['metadata.json must contain a JSON object']);
  });
});
