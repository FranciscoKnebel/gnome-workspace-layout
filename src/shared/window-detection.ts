export type WindowDetection<T> = {
  getWindows: () => T[];
  key: (window: T) => string;
  matches: (window: T, pid: number | undefined) => boolean;
  subscribe: (created: (window: T) => void) => () => void;
  schedule: (ms: number, callback: () => void) => () => void;
  registerCancel: (cancel: () => void) => () => void;
  launch: () => { pid?: number };
  timeoutMs: number;
};

// The environment owns signals/timers; matching and lifecycle are testable here.
export function detectLaunchedWindow<T>(
  options: WindowDetection<T>,
): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const before = new Set(options.getWindows().map(options.key));
    const candidates = new Set<T>();
    const cleanup: Array<() => void> = [];
    let finished = false;
    let launched = false;
    let pid: number | undefined;
    let cancelRetry: (() => void) | undefined;

    const finish = (window: T | null, error?: unknown): void => {
      if (finished) return;
      finished = true;
      cancelRetry?.();
      for (const cancel of cleanup.reverse()) cancel();
      if (error !== undefined) reject(error);
      else resolve(window);
    };

    const check = (): void => {
      if (!launched || finished) return;
      try {
        for (const window of candidates) {
          if (
            !before.has(options.key(window)) &&
            options.matches(window, pid)
          ) {
            finish(window);
            return;
          }
        }
      } catch (error) {
        finish(null, error);
      }
    };

    const retry = (): void => {
      check();
      if (!finished) cancelRetry = options.schedule(50, retry);
    };

    try {
      cleanup.push(
        options.subscribe((window) => {
          candidates.add(window);
          check();
        }),
      );
      cleanup.push(
        options.registerCancel(() =>
          finish(
            null,
            new Error(
              'Window wait cancelled because the extension is disabled',
            ),
          ),
        ),
      );
      cleanup.push(
        options.schedule(options.timeoutMs, () => {
          // Recover from a missed signal and allow just-created windows to finish
          // populating their app identity before declaring a timeout.
          try {
            for (const window of options.getWindows()) candidates.add(window);
            check();
            if (!finished)
              cleanup.push(options.schedule(150, () => finish(null)));
          } catch (error) {
            finish(null, error);
          }
        }),
      );
      pid = options.launch().pid;
      launched = true;
      retry();
    } catch (error) {
      finish(null, error);
    }
  });
}
