type Window = { count: number; resetsAt: number };

type LimiterOptions = { limit: number; windowMs: number; maxKeys?: number };

/** Per-process limiter. When the table is full, the oldest window is dropped so new keys are never locked out. */
export function createFixedWindowLimiter({ limit, windowMs, maxKeys = 10_000 }: LimiterOptions) {
  const windows = new Map<string, Window>();

  return (key: string, now = Date.now()) => {
    const current = windows.get(key);

    if (current && current.resetsAt > now) {
      if (current.count >= limit) return false;
      current.count += 1;
      return true;
    }

    windows.delete(key);

    if (windows.size >= maxKeys) {
      for (const [windowKey, window] of windows) {
        if (window.resetsAt <= now) windows.delete(windowKey);
      }
      if (windows.size >= maxKeys) {
        const oldestKey = windows.keys().next().value;
        if (oldestKey !== undefined) windows.delete(oldestKey);
      }
    }

    windows.set(key, { count: 1, resetsAt: now + windowMs });
    return true;
  };
}
