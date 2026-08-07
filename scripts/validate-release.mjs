import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { validateExtensionRelease } from '../lib/shared/release.js';

const expectedUuid = 'workspace-layout@franciscoknebel.com';
const zipPath = process.argv[2];

if (zipPath === undefined) {
  process.stderr.write('Usage: node scripts/validate-release.mjs <zip>\n');
  process.exit(1);
}

let files;
try {
  files = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' })
    .split('\n')
    .filter((file) => file !== '');
} catch (error) {
  process.stderr.write(`Could not read extension ZIP: ${String(error)}\n`);
  process.exit(1);
}

let metadata = null;
if (files.includes('metadata.json')) {
  try {
    metadata = JSON.parse(
      execFileSync('unzip', ['-p', zipPath, 'metadata.json'], {
        encoding: 'utf8',
      }),
    );
  } catch (error) {
    process.stderr.write(`Could not parse metadata.json: ${String(error)}\n`);
    process.exit(1);
  }
}

const { errors } = validateExtensionRelease(files, metadata, expectedUuid);
if (errors.length > 0) {
  process.stderr.write(`${errors.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(`Validated extension ZIP: ${zipPath}\n`);
