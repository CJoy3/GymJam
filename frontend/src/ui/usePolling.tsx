import { useEffect, useRef } from 'react';
import { AppState as RNAppState } from 'react-native';

/**
 * Keeps a multi-user screen fresh without a tight poll:
 *  - refreshes immediately when the screen opens (focus/mount),
 *  - refreshes again whenever the app returns to the foreground,
 *  - and ticks on a gentle interval *only while the app is active*.
 * Backgrounded apps never poll. The latest `refresh` is read via a ref so the
 * interval isn't torn down every time the callback's identity changes.
 */
export function usePolling(refresh: () => void | Promise<void>, intervalMs = 10000) {
  const saved = useRef(refresh);
  saved.current = refresh;

  useEffect(() => {
    let mounted = true;
    const run = () => {
      if (mounted && RNAppState.currentState === 'active') void saved.current();
    };
    run(); // immediate refresh on open
    const id = setInterval(run, intervalMs);
    const sub = RNAppState.addEventListener('change', (s) => {
      if (s === 'active') run(); // catch up the moment the app is reopened
    });
    return () => {
      mounted = false;
      clearInterval(id);
      sub.remove();
    };
  }, [intervalMs]);
}
