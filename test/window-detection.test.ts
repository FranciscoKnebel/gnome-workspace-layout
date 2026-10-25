import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectLaunchedWindow } from '../src/shared/window-detection.js';

type Window = { id: string; ready: boolean; pid?: number };

function harness() {
  const existing: Window = { id: 'old', ready: true, pid: 42 };
  const windows = [existing];
  let created: (window: Window) => void = () => {};
  let cancel = () => {};
  const disconnect = vi.fn();
  const unregister = vi.fn();
  const launch = vi.fn(() => ({ pid: 42 }));
  const wait = () =>
    detectLaunchedWindow({
      getWindows: () => windows,
      key: (window: Window) => window.id,
      matches: (window, pid) => window.ready && window.pid === pid,
      subscribe: (callback) => {
        created = callback;
        return disconnect;
      },
      registerCancel: (callback) => {
        cancel = callback;
        return unregister;
      },
      schedule: (ms, callback) => {
        const id = setTimeout(callback, ms);
        return () => clearTimeout(id);
      },
      launch,
      timeoutMs: 1000,
    });
  return {
    windows,
    wait,
    launch,
    disconnect,
    unregister,
    emit: (window: Window) => created(window),
    cancel: () => cancel(),
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('asynchronous window detection', () => {
  it('ignores old and unrelated windows, retries delayed identity and cleans up', async () => {
    const h = harness();
    const pending = h.wait();
    h.emit(h.windows[0]);
    h.emit({ id: 'other', ready: true, pid: 7 });
    const target = { id: 'new', ready: false, pid: 42 };
    h.emit(target);
    await vi.advanceTimersByTimeAsync(50);
    target.ready = true;
    await vi.advanceTimersByTimeAsync(50);
    expect(await pending).toBe(target);
    expect(h.disconnect).toHaveBeenCalledOnce();
    expect(h.unregister).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('subscribes before launch and checks synchronous events after PID is known', async () => {
    const h = harness();
    const target = { id: 'new', ready: true, pid: 42 };
    h.launch.mockImplementation(() => {
      h.emit(target);
      return { pid: 42 };
    });
    expect(await h.wait()).toBe(target);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses a final scan and metadata grace period if the signal was missed', async () => {
    const h = harness();
    const pending = h.wait();
    const target = { id: 'new', ready: false, pid: 42 };
    h.windows.push(target);
    await vi.advanceTimersByTimeAsync(1000);
    target.ready = true;
    await vi.advanceTimersByTimeAsync(50);
    expect(await pending).toBe(target);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns null on timeout and disconnects everything', async () => {
    const h = harness();
    const pending = h.wait();
    await vi.advanceTimersByTimeAsync(1150);
    expect(await pending).toBeNull();
    expect(h.disconnect).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans up on launch failure and cancellation', async () => {
    const h = harness();
    h.launch.mockImplementationOnce(() => {
      throw new Error('launch failed');
    });
    await expect(h.wait()).rejects.toThrow('launch failed');
    expect(h.disconnect).toHaveBeenCalledOnce();
    const pending = h.wait();
    const rejected = expect(pending).rejects.toThrow('disabled');
    h.cancel();
    await rejected;
    expect(h.disconnect).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});
