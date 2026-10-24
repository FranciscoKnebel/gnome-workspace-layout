import { spawnSync } from 'node:child_process';
import type { OperationResult } from '../shared/result.js';
import { describeGdbusCallFailure, parseGdbusSingleString } from './gdbus.js';

export function callExtension<T extends OperationResult = OperationResult>(
  method: string,
  args: string[],
): T {
  const response = spawnSync(
    'gdbus',
    [
      'call',
      '--session',
      '--dest',
      'com.franciscoknebel.WorkspaceLayout',
      '--object-path',
      '/com/franciscoknebel/WorkspaceLayout',
      '--method',
      `com.franciscoknebel.WorkspaceLayout.${method}`,
      ...args,
    ],
    { encoding: 'utf8' },
  );

  if (response.status !== 0) {
    throw new Error(describeGdbusCallFailure(method, response.stderr ?? ''));
  }

  return JSON.parse(parseGdbusSingleString(response.stdout));
}

export function quoteDbusString(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}
