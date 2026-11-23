import { spawnSync } from 'node:child_process';
import { BUS_NAME, INTERFACE_NAME, OBJECT_PATH } from '../shared/dbus.js';
import type { OperationResult } from '../shared/result.js';
import { describeDbusFailure } from '../shared/dbus.js';
import { parseGdbusSingleString } from './gdbus.js';

const DBUS_TIMEOUT_SECONDS = 900;

export function callExtension<T extends OperationResult = OperationResult>(
  method: string,
  args: string[],
): T {
  const response = spawnSync(
    'gdbus',
    [
      'call',
      '--timeout',
      String(DBUS_TIMEOUT_SECONDS),
      '--session',
      '--dest',
      BUS_NAME,
      '--object-path',
      OBJECT_PATH,
      '--method',
      `${INTERFACE_NAME}.${method}`,
      ...args,
    ],
    { encoding: 'utf8' },
  );

  if (response.status !== 0) {
    throw new Error(describeDbusFailure(method, response.stderr ?? ''));
  }

  return JSON.parse(parseGdbusSingleString(response.stdout));
}

export function quoteDbusString(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}
