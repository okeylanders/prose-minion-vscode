/**
 * A bound on the repeat counter's scans, for tests (PR #177 F-04). Every call
 * of a phrase pattern's `exec` is counted (the pattern's own lookbehind marks
 * it), and a call past `limit` throws, so a scan that never moves forward
 * fails its test instead of hanging the worker. The count proves progress;
 * no clock is read.
 */
const PHRASE_PATTERN_PREFIX = '(?<![\\p{L}\\p{N}])';

export async function withPhraseScanLimit<T>(limit: number, work: () => T | Promise<T>): Promise<{ result: T; scans: number }> {
  const exec = RegExp.prototype.exec;
  let scans = 0;
  const spy = jest.spyOn(RegExp.prototype, 'exec').mockImplementation(function (this: RegExp, input: string) {
    if (this.source.startsWith(PHRASE_PATTERN_PREFIX)) {
      scans += 1;
      if (scans > limit) {
        throw new Error(`The phrase scan ran ${limit} times without finishing`);
      }
    }
    return exec.call(this, input);
  });
  try {
    return { result: await work(), scans };
  } finally {
    spy.mockRestore();
  }
}
