import { isRecord } from '@/application/services/workshop/persistedValidation';

/**
 * Defensive JSON clone for durable Workshop boundaries.
 *
 * This policy is format-neutral and deliberately unversioned: JavaScript
 * `undefined` object members are omitted exactly as JSON.stringify omits them,
 * while values that cannot exist in JSON fail before a snapshot reaches disk.
 */
export function clonePersistedJson<T>(
  value: T,
  path = 'persisted value'
): T {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`Workshop session ${path} contains a non-finite number.`);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      clonePersistedJson(entry, `${path}[${index}]`)
    ) as T;
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, entry]) =>
        entry === undefined
          ? []
          : [[key, clonePersistedJson(entry, `${path}.${key}`)]]
      )
    ) as T;
  }
  throw new Error(`Workshop session ${path} contains a non-JSON value.`);
}
