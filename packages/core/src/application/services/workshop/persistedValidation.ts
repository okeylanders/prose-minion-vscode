/**
 * Shared structural primitives for strict Workshop persistence codecs.
 *
 * These helpers define facts shared by the outer session envelope, temporal
 * state, bounded search index, and widget-local codecs. Keeping them here
 * prevents durable formats from drifting on timestamps, timezones, exact-key
 * rules, or JSON-shape policy.
 */

/** Keep recursive validation comfortably below the JavaScript call-stack ceiling. */
export const MAXIMUM_PERSISTED_JSON_DEPTH = 100;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const isTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

export const isNonNegativeInteger = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

export const normalizeTimestamp = (value: string): string => new Date(value).toISOString();

export function exactKeys(
  value: Record<string, unknown>,
  label: string,
  required: readonly string[],
  optional: readonly string[] = []
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`${label} contains unknown field ${key}.`);
    }
  }
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key) || value[key] === undefined) {
      throw new Error(`${label} is missing required field ${key}.`);
    }
  }
}

export function exactObject(
  value: unknown,
  path: string,
  required: readonly string[],
  optional: readonly string[] = []
): Record<string, unknown> {
  const object = objectAt(value, path);
  exactKeys(object, path, required, optional);
  return object;
}

export function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (
    typeof value !== 'object'
    || value === null
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    shapeError(path, 'plain object');
  }
  return value as Record<string, unknown>;
}

export function arrayOf(
  value: unknown,
  path: string,
  assertItem: (item: unknown, itemPath: string) => void
): void {
  if (!Array.isArray(value)) {
    shapeError(path, 'array');
  }
  value.forEach((item, index) => assertItem(item, `${path}[${index}]`));
}

export function stringAt(value: unknown, path: string): void {
  if (typeof value !== 'string') {
    shapeError(path, 'string');
  }
}

export function boundedStringAt(
  value: unknown,
  path: string,
  maximumCharacters: number,
  allowBlank = true
): void {
  stringAt(value, path);
  const text = value as string;
  if (!allowBlank && text.trim().length === 0) {
    shapeError(path, 'a non-empty string');
  }
  if (text.length > maximumCharacters) {
    shapeError(path, `a string of at most ${maximumCharacters} characters`);
  }
}

export function optionalStringAt(value: unknown, path: string): void {
  if (value !== undefined) {
    stringAt(value, path);
  }
}

export function optionalBoundedStringAt(
  value: unknown,
  path: string,
  maximumCharacters: number,
  allowBlank = true
): void {
  if (value !== undefined) {
    boundedStringAt(value, path, maximumCharacters, allowBlank);
  }
}

export function numberAt(value: unknown, path: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    shapeError(path, 'finite number');
  }
}

export function optionalNumberAt(value: unknown, path: string): void {
  if (value !== undefined) {
    numberAt(value, path);
  }
}

export function booleanAt(value: unknown, path: string): void {
  if (typeof value !== 'boolean') {
    shapeError(path, 'boolean');
  }
}

export function optionalBooleanAt(value: unknown, path: string): void {
  if (value !== undefined) {
    booleanAt(value, path);
  }
}

export function enumAt(value: unknown, path: string, allowed: readonly string[]): void {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    shapeError(path, allowed.join(' | '));
  }
}

export function jsonObjectAt(value: unknown, path: string): void {
  objectAt(value, path);
  assertJsonValue(value, path);
}

/**
 * Free-form JSON validation runs on both sides of the persistence boundary:
 * on read against a `JSON.parse` result (where `undefined` cannot occur) and on
 * write against the live in-memory object (where it routinely does — any
 * optional metadata field the persona omitted is an `undefined` member).
 *
 * It must therefore honor the same policy `clonePersistedJson` documents: an
 * `undefined` object member is absent, exactly as `JSON.stringify` omits it.
 * Rejecting one used to fail every save of a session containing a
 * `resource.read` without an explicit `endLine` — the validator refusing a
 * value that would never have reached disk.
 *
 * An `undefined` array item is different and stays refused: JSON has no hole,
 * so `JSON.stringify` writes `null` there, silently changing the data.
 */
function assertJsonValue(value: unknown, path: string, depth = 0): void {
  if (depth > MAXIMUM_PERSISTED_JSON_DEPTH) {
    throw new Error(
      `${path} exceeds the maximum JSON nesting depth of ${MAXIMUM_PERSISTED_JSON_DEPTH}.`
    );
  }
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
  ) {
    return;
  }
  if (typeof value === 'number') {
    numberAt(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertJsonValue(item, `${path}[${index}]`, depth + 1)
    );
    return;
  }
  if (value === undefined) {
    // Only reachable as an array item: object members are skipped below.
    shapeError(path, 'a JSON value (an undefined array item would be written as null)');
  }
  const object = objectAt(value, path);
  for (const [key, nested] of Object.entries(object)) {
    if (nested === undefined) {
      continue;
    }
    assertJsonValue(nested, `${path}.${key}`, depth + 1);
  }
}

export function shapeError(path: string, expected: string): never {
  throw new Error(`${path} must be ${expected}`);
}

export function assertTimezone(
  value: unknown,
  label = 'Workshop session timezone'
): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty IANA timezone.`);
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date(0));
  } catch {
    throw new Error(`Invalid ${label}: ${value}`);
  }
}
