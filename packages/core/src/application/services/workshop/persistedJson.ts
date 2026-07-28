import { isRecord } from '@/application/services/workshop/persistedValidation';

/**
 * Durable Workshop JSON is user-controlled workspace input. Keep recursive
 * validators/cloners comfortably below the JavaScript call-stack ceiling.
 */
export const MAXIMUM_PERSISTED_JSON_DEPTH = 100;

export function assertPersistedJsonNestingDepth(
  text: string,
  path = 'Workshop session JSON'
): void {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text.charCodeAt(index);
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === 92) { // \
        escaped = true;
      } else if (character === 34) { // "
        inString = false;
      }
      continue;
    }
    if (character === 34) { // "
      inString = true;
      continue;
    }
    if (character === 123 || character === 91) { // { [
      depth += 1;
      if (depth > MAXIMUM_PERSISTED_JSON_DEPTH) {
        throw new Error(
          `${path} exceeds the maximum JSON nesting depth of ${MAXIMUM_PERSISTED_JSON_DEPTH}.`
        );
      }
    } else if (character === 125 || character === 93) { // } ]
      depth = Math.max(0, depth - 1);
    }
  }
}

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
  return clonePersistedJsonAtDepth(value, path, 0);
}

function clonePersistedJsonAtDepth<T>(
  value: T,
  path: string,
  depth: number
): T {
  if (depth > MAXIMUM_PERSISTED_JSON_DEPTH) {
    throw new Error(
      `Workshop session ${path} exceeds the maximum JSON nesting depth of ` +
      `${MAXIMUM_PERSISTED_JSON_DEPTH}.`
    );
  }
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
      clonePersistedJsonAtDepth(entry, `${path}[${index}]`, depth + 1)
    ) as T;
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, entry]) =>
        entry === undefined
          ? []
          : [[key, clonePersistedJsonAtDepth(entry, `${path}.${key}`, depth + 1)]]
      )
    ) as T;
  }
  throw new Error(`Workshop session ${path} contains a non-JSON value.`);
}
