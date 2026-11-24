import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLayoutName } from '../shared/layout.js';
import { workspaceLayoutPaths } from '../shared/paths.js';
import type { OperationResult } from '../shared/result.js';
import { configureSetup } from './configure-setup.js';
import { callExtension, quoteDbusString } from './extension-client.js';
import { parseSetupOptions } from './setup.js';

const EXTENSION_UUID = 'workspace-layout@franciscoknebel.com';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const command = process.argv[2];

try {
  switch (command) {
    case 'apply':
      requireName(process.argv[3]);
      printResult(callExtension('Apply', [quoteDbusString(process.argv[3])]));
      break;
    case 'setup':
      {
        const setup = parseSetupOptions(process.argv.slice(3));
        printResult(
          setup.configure
            ? await configureSetup(setup)
            : callExtension(setup.force ? 'SetupForce' : 'Setup', [
                quoteDbusString(setup.name),
                setup.includeMinimized ? 'true' : 'false',
              ]),
        );
      }
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

function runDoctor(): void {
  const localChecks: string[] = [];
  const home = process.env.HOME ?? '';
  const paths = workspaceLayoutPaths(
    join(home, '.config'),
    join(home, '.local/share'),
  );
  localChecks.push(`CLI: ${process.argv[1]}`);
  localChecks.push(`Expected extension UUID: ${EXTENSION_UUID}`);
  localChecks.push(`Layouts: ${paths.layoutsDir}`);
  localChecks.push(`Schema: ${paths.schemaPath}`);
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
    join(projectRoot, 'dist/prefs.js'),
    join(extensionDir, 'prefs.js'),
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

  assertLayoutName(name);
}

function printHelp(): void {
  console.log(`workspace-layout

Usage:
  workspace-layout setup <name> [--include-minimized] [--force] [--configure]
  workspace-layout apply <name>
  workspace-layout doctor
  workspace-layout install

Use setup --configure to choose which windows to save in an interactive wizard.
Layouts are stored in ~/.config/workspace-layout/layouts/<name>.json.
`);
}
