/**
 * Structural grammar primitives shared by the frozen Workshop session codec
 * and widget-local codecs nested inside that persisted aggregate.
 *
 * This is deliberately codec infrastructure, not a general validation helper:
 * callers supply the durable field paths and domain-specific rules.
 */

import {
  MAXIMUM_PERSISTED_JSON_DEPTH
} from '@/application/services/workshop/persistedJson';

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

export function exactKeys(
  object: Record<string, unknown>,
  path: string,
  required: readonly string[],
  optional: readonly string[] = []
): void {
  const allowed = new Set([...required, ...optional]);
  const unknown = Object.keys(object).find((key) => !allowed.has(key));
  if (unknown) {
    throw new Error(`${path} contains unknown field ${unknown}`);
  }
  const missing = required.find(
    (key) => !Object.prototype.hasOwnProperty.call(object, key) || object[key] === undefined
  );
  if (missing) {
    throw new Error(`${path} is missing required field ${missing}`);
  }
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
 * Free-form JSON validation for capability metadata.
 *
 * Object members with `undefined` values are absent in persisted JSON and are
 * accepted. Undefined array items are rejected because JSON would silently
 * rewrite them to `null`.
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
