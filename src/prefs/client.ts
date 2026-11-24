import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {
  BUS_NAME,
  describeDbusFailure,
  INTERFACE_NAME,
  OBJECT_PATH,
} from '../shared/dbus.js';
import {
  capturePreviewResult,
  isCapturePreview,
  isOverviewResponse,
  isReadLayoutResponse,
  overviewResult,
  readLayoutResult,
  type CapturePreview,
  type OverviewResponse,
  type ReadLayoutResponse,
} from '../shared/dbus-responses.js';
import {
  isOperationResult,
  operationFailure,
  result,
  type OperationResult,
} from '../shared/result.js';

export const APPLY_TIMEOUT_MS = 600_000;

const DEFAULT_TIMEOUT_MS = 30_000;

export class ExtensionClient {
  private proxy: any = null;

  readLayout(name: string): ReadLayoutResponse {
    return this.requestTyped(
      'ReadLayout',
      's',
      [name],
      isReadLayoutResponse,
      (errors) => readLayoutResult(null, errors),
      'The extension returned an invalid layout.',
    );
  }

  getOverview(): OverviewResponse {
    return this.requestTyped(
      'GetOverview',
      '',
      [],
      isOverviewResponse,
      (errors) => overviewResult(null, [], errors),
      'The extension returned an invalid overview.',
    );
  }

  previewSetup(
    name: string,
    includeMinimized: boolean,
    force: boolean,
  ): CapturePreview {
    return this.requestTyped(
      'PreviewSetup',
      'sbb',
      [name, includeMinimized, force],
      isCapturePreview,
      (errors) => capturePreviewResult(undefined, errors),
      'The extension returned an invalid capture preview.',
    );
  }

  saveSetup(layout: string, force: boolean): OperationResult {
    return this.requestTyped(
      'SaveSetup',
      'sb',
      [layout, force],
      isOperationResult,
      (errors) => result(errors, []),
      'The extension returned an invalid result.',
    );
  }

  deleteLayout(name: string): OperationResult {
    return this.requestTyped(
      'DeleteLayout',
      's',
      [name],
      isOperationResult,
      (errors) => result(errors, []),
      'The extension returned an invalid result.',
    );
  }

  apply(
    name: string,
    timeoutMs: number,
    callback: (response: OperationResult) => void,
  ): void {
    this.requestAsync(
      'Apply',
      's',
      [name],
      timeoutMs,
      (value) => {
        callback(
          isOperationResult(value)
            ? value
            : operationFailure(
                new Error('The extension returned an invalid result.'),
                describe,
              ),
        );
      },
      (error) => callback(operationFailure(error, describe)),
    );
  }

  private requestTyped<T>(
    method: string,
    signature: string,
    values: unknown[],
    guard: (value: unknown) => value is T,
    fallback: (errors: string[]) => T,
    invalidMessage: string,
  ): T {
    try {
      const value = this.request(method, signature, values);
      if (guard(value)) {
        return value;
      }

      throw new Error(invalidMessage);
    } catch (error) {
      return fallback([describe(error)]);
    }
  }

  private request(
    method: string,
    signature: string,
    values: unknown[],
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): unknown {
    const reply = this.getProxy().call_sync(
      method,
      makeParameters(signature, values),
      Gio.DBusCallFlags.NONE,
      timeoutMs,
      null,
    );
    return parseRawReply(reply);
  }

  private requestAsync(
    method: string,
    signature: string,
    values: unknown[],
    timeoutMs: number,
    onValue: (value: unknown) => void,
    onError: (error: unknown) => void,
  ): void {
    let parameters: any;

    try {
      parameters = makeParameters(signature, values);
    } catch (error) {
      onError(error);
      return;
    }

    try {
      this.getProxy().call(
        method,
        parameters,
        Gio.DBusCallFlags.NONE,
        timeoutMs,
        null,
        (proxy: any, callResult: any) => {
          try {
            onValue(parseRawReply(proxy.call_finish(callResult)));
          } catch (error) {
            onError(error);
          }
        },
      );
    } catch (error) {
      onError(error);
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

function parseRawReply(reply: any): unknown {
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

function describe(error: unknown): string {
  return describeDbusFailure(
    error instanceof Error ? error.message : String(error),
  );
}
