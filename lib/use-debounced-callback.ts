import { useCallback, useEffect, useMemo, useRef } from "react";

/**
 * A stable, debounced wrapper around `callback`. The returned function delays
 * invocation until `delay` ms have elapsed since the last call; rapid calls
 * (e.g. keystrokes) collapse into a single trailing invocation.
 *
 * The latest `callback` is always used when the timer fires (kept in a ref), so
 * closures over fresh state/props stay correct without re-creating the debounced
 * function. Call `.cancel()` to drop a pending invocation (e.g. on Enter/clear
 * or unmount — unmount is handled automatically).
 */
type Debounced<A extends unknown[]> = ((...args: A) => void) & {
  cancel: () => void;
};

export function useDebouncedCallback<A extends unknown[]>(
  callback: (...args: A) => void,
  delay: number,
): Debounced<A> {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  // Drop any pending call when the host unmounts.
  useEffect(() => cancel, [cancel]);

  return useMemo<Debounced<A>>(() => {
    const fn = ((...args: A) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        callbackRef.current(...args);
      }, delay);
    }) as Debounced<A>;
    fn.cancel = cancel;
    return fn;
  }, [delay, cancel]);
}
