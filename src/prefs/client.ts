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
  isListLayoutsResponse,
  isReadLayoutResponse,
  isStatusResponse,
  listLayoutsResult,
  readLayoutResult,
  statusResult,
  type CapturePreview,
  type ListLayoutsResponse,
  type ReadLayoutResponse,
  type StatusResponse,
} from '../shared/dbus-responses.js';
import {
  isOperationResult,
  result,
  type OperationResult,
} from '../shared/result.js';

export const APPLY_TIMEOUT_MS = 600_000;

const DEFAULT_TIMEOUT_MS = 30_000;

export class ExtensionClient {
  private proxy: any = null;

  listLayouts(): ListLayoutsResponse {
    try {
      const value = this.request('ListLayouts', '', []);
      if (isListLayoutsResponse(value)) {
        return value;
      }

      throw new Error('The extension returned an invalid layout list.');
    } catch (error) {
      return listLayoutsResult([], [describe('ListLayouts', error)]);
    }
  }

  readLayout(name: string): ReadLayoutResponse {
    try {
      const value = this.request('ReadLayout', 's', [name]);
      if (isReadLayoutResponse(value)) {
        return value;
      }

      throw new Error('The extension returned an invalid layout.');
    } catch (error) {
      return readLayoutResult(null, [describe('ReadLayout', error)]);
    }
  }

  getStatus(): StatusResponse {
    try {
      const value = this.request('GetStatus', '', []);
      if (isStatusResponse(value)) {
        return value;
      }

      throw new Error('The extension returned an invalid status.');
    } catch (error) {
      return statusResult(null, [describe('GetStatus', error)]);
    }
  }

  previewSetup(
    name: string,
    includeMinimized: boolean,
    force: boolean,
  ): CapturePreview {
    try {
      const value = this.request('PreviewSetup', 'sbb', [
        name,
        includeMinimized,
        force,
      ]);
      if (isCapturePreview(value)) {
        return value;
      }

      throw new Error('The extension returned an invalid capture preview.');
    } catch (error) {
      return capturePreviewResult(undefined, [describe('PreviewSetup', error)]);
    }
  }

  saveSetup(layout: string, force: boolean): OperationResult {
    return this.operation('SaveSetup', 'sb', [layout, force]);
  }

  deleteLayout(name: string): OperationResult {
    return this.operation('DeleteLayout', 's', [name]);
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
                'Apply',
                new Error('The extension returned an invalid result.'),
              ),
        );
      },
      (error) => callback(operationFailure('Apply', error)),
    );
  }

  private operation(
    method: 'SaveSetup' | 'DeleteLayout',
    signature: string,
    values: unknown[],
  ): OperationResult {
    try {
      const value = this.request(method, signature, values);
      if (isOperationResult(value)) {
        return value;
      }

      throw new Error('The extension returned an invalid result.');
    } catch (error) {
      return operationFailure(method, error);
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

function operationFailure(method: string, error: unknown): OperationResult {
  return result([describe(method, error)], []);
}

function describe(method: string, error: unknown): string {
  return describeDbusFailure(
    method,
    error instanceof Error ? error.message : String(error),
  );
}
