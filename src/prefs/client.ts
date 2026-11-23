import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {
  BUS_NAME,
  describeDbusFailure,
  INTERFACE_NAME,
  OBJECT_PATH,
} from '../shared/dbus.js';
import type { DbusMethod, DbusResponseFor } from '../shared/dbus-responses.js';
import type { OperationResult } from '../shared/result.js';

const DEFAULT_TIMEOUT_MS = 30_000;

export const APPLY_TIMEOUT_MS = 600_000;

export class ExtensionClient {
  private proxy: any = null;

  call<M extends DbusMethod>(
    method: M,
    signature: string,
    values: unknown[],
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): DbusResponseFor<M> {
    try {
      const reply = this.getProxy().call_sync(
        method,
        makeParameters(signature, values),
        Gio.DBusCallFlags.NONE,
        timeoutMs,
        null,
      );
      return parseReply(reply, method);
    } catch (error) {
      return failureFor(method, error);
    }
  }

  callAsync<M extends DbusMethod>(
    method: M,
    signature: string,
    values: unknown[],
    timeoutMs: number,
    callback: (response: DbusResponseFor<M>) => void,
  ): void {
    let parameters: any;

    try {
      parameters = makeParameters(signature, values);
    } catch (error) {
      callback(failureFor(method, error));
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
          let response: DbusResponseFor<M>;

          try {
            response = parseReply(proxy.call_finish(result), method);
          } catch (error) {
            response = failureFor(method, error);
          }

          callback(response);
        },
      );
    } catch (error) {
      callback(failureFor(method, error));
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

function parseReply<M extends DbusMethod>(
  reply: any,
  method: M,
): DbusResponseFor<M> {
  const [serialized] = reply.deep_unpack();

  if (typeof serialized !== 'string') {
    throw new Error('The extension returned an unexpected D-Bus response.');
  }

  const parsed: unknown = JSON.parse(serialized);

  if (!isOperationResult(parsed) || !hasValidPayload(method, parsed)) {
    throw new Error('The extension returned an invalid operation result.');
  }

  return parsed as DbusResponseFor<M>;
}

function hasValidPayload(method: DbusMethod, value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  switch (method) {
    case 'ListLayouts':
      return Array.isArray(value.layouts);
    case 'ReadLayout':
      return 'layout' in value;
    case 'GetStatus':
      return 'status' in value;
    default:
      return true;
  }
}

function failureFor<M extends DbusMethod>(
  method: M,
  error: unknown,
): DbusResponseFor<M> {
  const base = {
    ok: false,
    errors: [describeDbusFailure(method, stringify(error))],
    messages: [],
  };

  switch (method) {
    case 'ListLayouts':
      return { ...base, layouts: [] } as unknown as DbusResponseFor<M>;
    case 'ReadLayout':
      return { ...base, layout: null } as unknown as DbusResponseFor<M>;
    case 'GetStatus':
      return { ...base, status: null } as unknown as DbusResponseFor<M>;
    default:
      return base as unknown as DbusResponseFor<M>;
  }
}

function stringify(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isOperationResult(value: unknown): value is OperationResult {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.ok === 'boolean' &&
    Array.isArray(value.errors) &&
    value.errors.every((error) => typeof error === 'string') &&
    Array.isArray(value.messages) &&
    value.messages.every((message) => typeof message === 'string')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
