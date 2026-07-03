import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGdbusSingleString } from './gdbus.js';

const BUS_NAME = 'com.franciscoknebel.WorkspaceLayout';
const OBJECT_PATH = '/com/franciscoknebel/WorkspaceLayout';
const INTERFACE = 'com.franciscoknebel.WorkspaceLayout';
const EXTENSION_UUID = 'workspace-layout@franciscoknebel.com';

type OperationResult = {
  ok: boolean;
  errors: string[];
  messages: string[];
};

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const command = process.argv[2];

try {
  switch (command) {
    case 'apply':
      requireName(process.argv[3]);
      printResult(
        callExtension('Apply', [`"${escapeDbusString(process.argv[3])}"`]),
      );
      break;
    case 'setup':
      requireName(process.argv[3]);
      printResult(
        callExtension('Setup', [
          `"${escapeDbusString(process.argv[3])}"`,
          process.argv.includes('--include-minimized') ? 'true' : 'false',
        ]),
      );
      break;
    case 'doctor':
      runDoctor();
      break;
    case 'install':
      installLocal();
      break;
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function callExtension(method: string, args: string[]): OperationResult {
  const result = spawnSync(
    'gdbus',
    [
      'call',
      '--session',
      '--dest',
      BUS_NAME,
      '--object-path',
      OBJECT_PATH,
      '--method',
      `${INTERFACE}.${method}`,
      ...args,
    ],
    { encoding: 'utf8' },
  );

  if (result.status !== 0) {
    throw new Error(
      `Failed to call extension via D-Bus. Is Workspace Layout enabled?\n${result.stderr.trim()}`,
    );
  }

  return JSON.parse(parseGdbusSingleString(result.stdout));
}

function runDoctor(): void {
  const localChecks: string[] = [];
  localChecks.push(`CLI: ${process.argv[1]}`);
  localChecks.push(`Expected extension UUID: ${EXTENSION_UUID}`);
  localChecks.push(
    `Layouts: ${process.env.HOME}/.config/workspace-layout/layouts`,
  );
  localChecks.push(
    `Schema: ${process.env.HOME}/.local/share/workspace-layout/schema/workspace-layout.schema.json`,
  );
  localChecks.push('GNOME logs: journalctl --user -f /usr/bin/gnome-shell');

  try {
    const extensionResult = callExtension('Doctor', []);
    printResult({
      ok: extensionResult.ok,
      errors: extensionResult.errors,
      messages: [...localChecks, ...extensionResult.messages],
    });
  } catch (error) {
    printResult({
      ok: false,
      errors: [error instanceof Error ? error.message : String(error)],
      messages: localChecks,
    });
  }
}

function installLocal(): void {
  const home = process.env.HOME;
  if (home === undefined) {
    throw new Error('HOME is not set');
  }

  const extensionDir = join(
    home,
    '.local/share/gnome-shell/extensions',
    EXTENSION_UUID,
  );
  const cliDir = join(home, '.local/bin');
  const schemaDir = join(home, '.local/share/workspace-layout/schema');

  rmSync(extensionDir, { recursive: true, force: true });
  mkdirSync(extensionDir, { recursive: true });
  mkdirSync(cliDir, { recursive: true });
  mkdirSync(schemaDir, { recursive: true });

  copyFileSync(
    join(projectRoot, 'dist/extension.js'),
    join(extensionDir, 'extension.js'),
  );
  copyFileSync(
    join(projectRoot, 'dist/metadata.json'),
    join(extensionDir, 'metadata.json'),
  );
  copyFileSync(
    join(projectRoot, 'dist/schema/workspace-layout.schema.json'),
    join(schemaDir, 'workspace-layout.schema.json'),
  );
  copyFileSync(
    join(projectRoot, 'bin/workspace-layout.js'),
    join(cliDir, 'workspace-layout'),
  );
  restoreSelinuxContext(extensionDir);

  console.log(`Installed extension to ${extensionDir}`);
  console.log(`Installed CLI to ${join(cliDir, 'workspace-layout')}`);
  console.log('Restart GNOME Shell or log out/in, then enable the extension.');
}

function restoreSelinuxContext(path: string): void {
  const result = spawnSync('restorecon', ['-R', path], { encoding: 'utf8' });
  if (result.error?.message.includes('ENOENT')) {
    console.log(
      'Skipped SELinux context restore because restorecon is unavailable.',
    );
    return;
  }

  if (result.status !== 0) {
    console.warn(
      `Could not restore SELinux context for ${path}: ${result.stderr.trim()}`,
    );
    return;
  }

  console.log(`Restored SELinux context for ${path}`);
}

function printResult(result: OperationResult): void {
  for (const message of result.messages) {
    console.log(message);
  }

  for (const error of result.errors) {
    console.error(error);
  }

  if (!result.ok) {
    process.exitCode = 1;
  }
}

function requireName(name: string | undefined): asserts name is string {
  if (name === undefined || name.trim() === '') {
    throw new Error(
      'A layout name is required. Example: workspace-layout apply trabalho',
    );
  }
}

function escapeDbusString(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function printHelp(): void {
  console.log(`workspace-layout

Usage:
  workspace-layout setup <name> [--include-minimized]
  workspace-layout apply <name>
  workspace-layout doctor
  workspace-layout install

Layouts are stored in ~/.config/workspace-layout/layouts/<name>.json.
`);
}
