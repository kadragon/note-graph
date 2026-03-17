/**
 * Shared test utilities for mocking the global Date object.
 */

export const REAL_DATE = Date;

/**
 * Override `globalThis.Date` so that `new Date()` and `Date.now()` return the
 * given fixed point in time, while `new Date(value)` still works normally.
 */
export function useFixedDateAt(isoString: string): void {
  const fixedTime = new REAL_DATE(isoString);
  class MockDate extends REAL_DATE {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super(fixedTime.getTime());
        return;
      }
      // @ts-expect-error allow variadic Date constructor args
      super(...args);
    }
    static now() {
      return fixedTime.getTime();
    }
  }
  // @ts-expect-error override global Date
  globalThis.Date = MockDate;
}

/**
 * Restore the original `Date` constructor.
 */
export function restoreDate(): void {
  globalThis.Date = REAL_DATE;
}
