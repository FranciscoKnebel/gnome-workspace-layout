import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import type { ExtensionResponse } from '../shared/dbus-responses.js';
import type { OperationResult } from '../shared/result.js';

const BUS_NAME = 'com.franciscoknebel.WorkspaceLayout';
const OBJECT_PATH = '/com/franciscoknebel/WorkspaceLayout';
const INTERFACE_NAME = 'com.franciscoknebel.WorkspaceLayout';
const DEFAULT_TIMEOUT_MS = 30_000;

export const APPLY_TIMEOUT_MS = 600_000;

export class ExtensionClient {
  private proxy: any = null;

  call(
    method: string,
    signature: string,
    values: unknown[],
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): ExtensionResponse {
    try {
      const reply = this.getProxy().call_sync(
        method,
        makeParameters(signature, values),
        Gio.DBusCallFlags.NONE,
        timeoutMs,
        null,
      );
      return parseReply(reply);
    } catch (error) {
      return errorResponse(error);
    }
  }

  callAsync(
    method: string,
    signature: string,
    values: unknown[],
    timeoutMs: number,
    callback: (response: ExtensionResponse) => void,
  ): void {
    let parameters: any;

    try {
      parameters = makeParameters(signature, values);
    } catch (error) {
      callback(errorResponse(error));
      return;
    }

    try {
      this.getProxy().call(
        method,
        parameters,
        Gio.DBusCallFlags.NONE,
        timeoutMs,
        null,
        (proxy: any, result: any) => {
          let response: ExtensionResponse;

          try {
            response = parseReply(proxy.call_finish(result));
          } catch (error) {
            response = errorResponse(error);
          }

          callback(response);
        },
      );
    } catch (error) {
      callback(errorResponse(error));
    }
  }

  private getProxy(): any {
    if (this.proxy === null) {
      this.proxy = Gio.DBusProxy.new_for_bus_sync(
        Gio.BusType.SESSION,
        Gio.DBusProxyFlags.NONE,
        null,
        BUS_NAME,
        OBJECT_PATH,
        INTERFACE_NAME,
        null,
      );
    }

    return this.proxy;
  }
}

function makeParameters(signature: string, values: unknown[]): any {
  if (signature === '') {
    return null;
  }

  return new GLib.Variant(`(${signature})`, values);
}

function parseReply(reply: any): ExtensionResponse {
  const [serialized] = reply.deep_unpack();

  if (typeof serialized !== 'string') {
    throw new Error('The extension returned an unexpected D-Bus response.');
  }

  const parsed: unknown = JSON.parse(serialized);

  if (!isOperationResult(parsed)) {
    throw new Error('The extension returned an invalid operation result.');
  }

  return parsed;
}

function errorResponse(error: unknown): ExtensionResponse {
  return {
    ok: false,
    errors: [describeError(error)],
    messages: [],
  };
}

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (
    includesAny(message, [
      'ServiceUnknown',
      'NameHasNoOwner',
      'not activatable',
      'Could not connect',
    ])
  ) {
    return 'Workspace Layout is not running. Enable the extension in GNOME Extensions and make sure the session is unlocked.';
  }

  if (includesAny(message, ['UnknownMethod', 'Unknown method'])) {
    return 'The installed extension is older than this preferences window. Reinstall it and restart GNOME Shell.';
  }

  if (
    message.includes('Another workspace-layout operation is already running')
  ) {
    return 'Another Workspace Layout operation is already running. Wait for it to finish and try again.';
  }

  if (message.includes('Timeout was reached')) {
    return 'The extension did not answer in time. It may still be applying the layout.';
  }

  return message;
}

function includesAny(value: string, candidates: string[]): boolean {
  return candidates.some((candidate) => value.includes(candidate));
}

function isOperationResult(value: unknown): value is OperationResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const result = value as Record<string, unknown>;

  return (
    typeof result.ok === 'boolean' &&
    Array.isArray(result.errors) &&
    result.errors.every((error) => typeof error === 'string') &&
    Array.isArray(result.messages) &&
    result.messages.every((message) => typeof message === 'string')
  );
}
