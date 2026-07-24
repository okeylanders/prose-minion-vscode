/**
 * Shared primitives for strict Workshop persistence codecs.
 *
 * These helpers define facts shared by the outer session envelope, temporal
 * state, and bounded search index. Keeping them here prevents the durable
 * formats from drifting on timestamps, timezones, or exact-key rules.
 */

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
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      throw new Error(`${label} is missing required field ${key}.`);
    }
  }
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
