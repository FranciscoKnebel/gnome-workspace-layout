export type ReleaseValidationResult = {
  errors: string[];
};

export function validateExtensionRelease(
  files: string[],
  metadata: unknown,
  expectedUuid: string,
): ReleaseValidationResult {
  const errors: string[] = [];

  if (!files.includes('extension.js')) {
    errors.push('extension.js must exist at the ZIP root');
  }

  if (!files.includes('metadata.json')) {
    errors.push('metadata.json must exist at the ZIP root');
  }

  for (const file of files) {
    if (isDevelopmentOnly(file)) {
      errors.push(
        `Development-only file is not allowed in the extension ZIP: ${file}`,
      );
    }
  }

  if (!isRecord(metadata)) {
    errors.push('metadata.json must contain a JSON object');
    return { errors };
  }

  if (metadata.uuid !== expectedUuid) {
    errors.push(`metadata.json uuid must be ${expectedUuid}`);
  }

  if (!isNonEmptyString(metadata.name)) {
    errors.push('metadata.json name must be a non-empty string');
  }

  if (!isNonEmptyString(metadata.description)) {
    errors.push('metadata.json description must be a non-empty string');
  }

  if (
    typeof metadata.version !== 'number' ||
    !Number.isInteger(metadata.version) ||
    metadata.version <= 0
  ) {
    errors.push('metadata.json version must be a positive integer');
  }

  if (
    !Array.isArray(metadata['shell-version']) ||
    metadata['shell-version'].length === 0 ||
    !metadata['shell-version'].every(isNonEmptyString)
  ) {
    errors.push(
      'metadata.json shell-version must be a non-empty array of non-empty strings',
    );
  }

  return { errors };
}

function isDevelopmentOnly(file: string): boolean {
  const parts = file.split('/').filter((part) => part !== '');
  const basename = parts.at(-1) ?? '';
  const developmentDirectories = [
    '.github',
    'node_modules',
    'scripts',
    'src',
    'test',
    'tests',
  ];

  return (
    parts.some((part) => developmentDirectories.includes(part)) ||
    basename.endsWith('.ts') ||
    /^tsconfig(?:\.|$)/.test(basename) ||
    /^package(?:-lock)?\.json$/.test(basename) ||
    /^(?:eslint|vitest)\.config\./.test(basename) ||
    /^\.prettier/.test(basename)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
