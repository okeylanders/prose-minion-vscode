/**
 * Shared protocol type for the OpenRouter account-balance client.
 *
 * Each client call returns a discriminated result so the service can keep one
 * call's data when the other fails (e.g. `/key` succeeds while `/credits` 403s).
 */

/**
 * Per-call result from an account-balance client.
 *
 * `status` maps directly onto the sanitized `ProviderStatus` the service emits;
 * `S` narrows it to the values a given call can actually produce.
 */
export type AccountCallResult<T, S extends string = 'no_key' | 'unavailable'> =
  | { ok: true; data: T }
  | { ok: false; status: S; reason: string };
