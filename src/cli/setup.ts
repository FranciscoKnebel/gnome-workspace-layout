export type SetupOptions = {
  force: boolean;
  includeMinimized: boolean;
  name: string;
};

export function parseSetupOptions(arguments_: string[]): SetupOptions {
  let force = false;
  let includeMinimized = false;
  let name: string | undefined;

  for (const argument of arguments_) {
    if (argument === '--force') {
      force = true;
    } else if (argument === '--include-minimized') {
      includeMinimized = true;
    } else if (argument.startsWith('--')) {
      throw new Error(`Unknown setup option: ${argument}`);
    } else if (name === undefined) {
      name = argument;
    } else {
      throw new Error('Only one layout name is allowed for setup.');
    }
  }

  if (name === undefined || name.trim() === '') {
    throw new Error(
      'A layout name is required. Example: workspace-layout setup trabalho',
    );
  }

  return { force, includeMinimized, name };
}
