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
      'metadata.json shell-version must be a non-empty array of GNOME Shell version strings',
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

it.each(['banana', ' 50 ', '', '50;echo', 'v50', 50])(
  'rejects malformed shell-version %j',
  (version) => {
    expect(
      validateExtensionRelease(
        ['extension.js', 'metadata.json'],
        { ...validMetadata, 'shell-version': [version] },
        expectedUuid,
      ).errors,
    ).toContain(
      'metadata.json shell-version must be a non-empty array of GNOME Shell version strings',
    );
  },
);

it.each(['3.38', '40', '50', '50.alpha', '50.beta', '50.rc'])(
  'accepts Shell version syntax %s',
  (version) => {
    expect(
      validateExtensionRelease(
        ['extension.js', 'metadata.json'],
        { ...validMetadata, 'shell-version': [version] },
        expectedUuid,
      ).errors,
    ).toEqual([]);
  },
);

it('rejects duplicate root metadata and non-canonical ZIP paths', () => {
  const errors = validateExtensionRelease(
    [
      'extension.js',
      'metadata.json',
      'metadata.json',
      '../src/code.js',
      '/extension.js',
      './hidden.js',
    ],
    validMetadata,
    expectedUuid,
  ).errors;
  expect(errors).toContain('Duplicate ZIP entry: metadata.json');
  for (const path of ['../src/code.js', '/extension.js', './hidden.js'])
    expect(errors).toContain(
      `ZIP entry must use a relative canonical path: ${path}`,
    );
});

it('allows future preferences and resources without allowing development files', () => {
  expect(
    validateExtensionRelease(
      [
        'extension.js',
        'metadata.json',
        'prefs.js',
        'schemas/gschemas.compiled',
        'stylesheet.css',
        'icons/app.svg',
        'locale/pt_BR/LC_MESSAGES/app.mo',
      ],
      validMetadata,
      expectedUuid,
    ).errors,
  ).toEqual([]);
});
