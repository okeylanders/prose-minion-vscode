/**
 * The saved board codec's decoders (ADR 2026-10-19 D12 addendum; Slice 5A).
 * Pure: no host, no I/O.
 *
 * A decoder reads one JSON value into one contract type, or throws
 * `LightboxBoardShapeError` with a host-owned path and expectation. Objects
 * are read by a `Shape<T>`, which TypeScript holds to `T` itself: every
 * required field needs a decoder, every optional field an `optional(…)`
 * one, and nothing else may be named. So a new field or tile kind on the
 * board does not compile until the codec reads it (the tile kinds by a
 * `Record` over the closed union, `LightboxBoardTileCodec`).
 *
 * Keys are exact. A key the shape does not name fails its object, counted
 * and never named: the file's own keys never reach a reason or a log. A list
 * whose entries may be lost without hiding anything (`droppable`) drops an
 * entry that fails and counts it, and so does an optional field that may be
 * (`leftOutIfInvalid`); everything else fails whole.
 */

/** Why a value was refused: a key this build does not read, or any other shape fault. */
export type LightboxBoardShapeFault = 'unknown-field' | 'shape';

export class LightboxBoardShapeError extends Error {
  constructor(
    /** Host words: the schema's path to the value ("board.readings[2].tiles[4]"), never a key from the file. */
    readonly at: string,
    readonly expected: string,
    readonly fault: LightboxBoardShapeFault = 'shape'
  ) {
    super(`${at} must be ${expected}`);
    this.name = 'LightboxBoardShapeError';
  }
}

/** What a decode keeps beside the value: the board's paragraph count and the parts it dropped. */
export interface LightboxBoardDecodeContext {
  /** Paragraphs on the board; a measured paragraph address must be 1 to this. */
  paragraphs: number;
  dropped: { count: number; at: string[] };
}

/** At most this many dropped paths are kept, for the log. */
const DROPPED_PATHS_KEPT = 10;

export type Decoder<T> = (value: unknown, at: string, context: LightboxBoardDecodeContext) => T;

/**
 * An optional field's decoder: the key may be absent; present, it must
 * decode. One that reads as `undefined` (`leftOutIfInvalid`) leaves the key
 * out of the object.
 */
export interface Optional<T> {
  readonly optional: Decoder<T | undefined>;
}

/** The keys `T` may leave out: `{}` is assignable to a pick of only those. */
type OptionalKeys<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? K : never }[keyof T];
type RequiredKeys<T> = Exclude<keyof T, OptionalKeys<T>>;

/** How an object type is read: a decoder per required field, an `optional` per optional one, and nothing else. */
export type Shape<T> = { [K in RequiredKeys<T>]-?: Decoder<T[K]> } & { [K in OptionalKeys<T>]-?: Optional<Exclude<T[K], undefined>> };

export function optional<T>(decoder: Decoder<T>): Optional<T> {
  return { optional: decoder };
}

/**
 * An optional field that may be lost without hiding anything (a board's
 * name, Slice 5A.1): present and failing, it is left out and counted, as a
 * droppable entry is, and its object reads without it.
 */
export function leftOutIfInvalid<T>(decoder: Decoder<T>): Optional<T> {
  return {
    optional: (value, at, context) => {
      try {
        return decoder(value, at, context);
      } catch (error) {
        if (!(error instanceof LightboxBoardShapeError)) {
          throw error;
        }
        countDropped(context, at);
        return undefined;
      }
    }
  };
}

function isOptional(field: Decoder<unknown> | Optional<unknown>): field is Optional<unknown> {
  return typeof field === 'object' && field !== null && 'optional' in field;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

/**
 * An object read by its shape: exact keys, every required one present, an
 * optional one absent or decoded (and left out when it reads as nothing).
 * The value keeps the file's key order, so a board read and written again
 * is the same text.
 */
export function object<T>(shape: Shape<T>): Decoder<T> {
  const fields = new Map(Object.entries(shape) as Array<[string, Decoder<unknown> | Optional<unknown>]>);
  const required = [...fields].filter(([, field]) => !isOptional(field)).map(([key]) => key);
  return (value, at, context) => {
    if (!isPlainObject(value)) {
      throw new LightboxBoardShapeError(at, 'an object');
    }
    const keys = Object.keys(value);
    const unknown = keys.filter((key) => !fields.has(key)).length;
    if (unknown > 0) {
      throw new LightboxBoardShapeError(at, `without the ${unknown === 1 ? 'field' : `${unknown} fields`} this build does not read`, 'unknown-field');
    }
    const missing = required.find((key) => !Object.prototype.hasOwnProperty.call(value, key));
    if (missing !== undefined) {
      throw new LightboxBoardShapeError(`${at}.${missing}`, 'present');
    }
    const read: Record<string, unknown> = {};
    for (const key of keys) {
      const field = fields.get(key) as Decoder<unknown> | Optional<unknown>;
      const decoded = isOptional(field) ? field.optional(value[key], `${at}.${key}`, context) : field(value[key], `${at}.${key}`, context);
      if (decoded !== undefined || !isOptional(field)) {
        read[key] = decoded;
      }
    }
    return read as T;
  };
}

export const text: Decoder<string> = (value, at) => {
  if (typeof value !== 'string') {
    throw new LightboxBoardShapeError(at, 'a string');
  }
  return value;
};

/** A string of at most `characters` characters. */
export function bounded(characters: number): Decoder<string> {
  return (value, at, context) => {
    const read = text(value, at, context);
    if (read.length > characters) {
      throw new LightboxBoardShapeError(at, `at most ${characters} characters`);
    }
    return read;
  };
}

export const finite: Decoder<number> = (value, at) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new LightboxBoardShapeError(at, 'a finite number');
  }
  return value;
};

/** A whole number, 0 or more. */
export const whole: Decoder<number> = (value, at) => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new LightboxBoardShapeError(at, 'a whole number');
  }
  return value as number;
};

/** Any safe integer: a withheld quote's paragraph is the one the reading named, declared or not. */
export const integer: Decoder<number> = (value, at) => {
  if (!Number.isSafeInteger(value)) {
    throw new LightboxBoardShapeError(at, 'an integer');
  }
  return value as number;
};

/** A paragraph number a reading holds: 1 or more. */
export const ordinal: Decoder<number> = (value, at, context) => {
  const read = whole(value, at, context);
  if (read < 1) {
    throw new LightboxBoardShapeError(at, 'a number from 1');
  }
  return read;
};

/** A paragraph the board measured: 1 to its paragraph count. */
export const paragraph: Decoder<number> = (value, at, context) => {
  const read = ordinal(value, at, context);
  if (read > context.paragraphs) {
    throw new LightboxBoardShapeError(at, `a paragraph of the board's ${context.paragraphs}`);
  }
  return read;
};

export const flag: Decoder<boolean> = (value, at) => {
  if (typeof value !== 'boolean') {
    throw new LightboxBoardShapeError(at, 'true or false');
  }
  return value;
};

/** Exactly `expected`. */
export function literal<T extends string | number>(expected: T): Decoder<T> {
  return (value, at) => {
    if (value !== expected) {
      throw new LightboxBoardShapeError(at, JSON.stringify(expected));
    }
    return expected;
  };
}

/** One word of a closed vocabulary. A `Record` over the union, so a new member does not compile until it is listed. */
export function oneOf<T extends string>(vocabulary: Readonly<Record<T, true>>): Decoder<T> {
  const words = new Set(Object.keys(vocabulary));
  return (value, at) => {
    if (typeof value !== 'string' || !words.has(value)) {
      throw new LightboxBoardShapeError(at, 'a word this build knows');
    }
    return value as T;
  };
}

/** One of two shapes, told apart by `discriminant`. */
export function either<A, B>(discriminant: string, cases: Readonly<Record<string, Decoder<A> | Decoder<B>>>): Decoder<A | B> {
  return (value, at, context) => {
    const tag = isPlainObject(value) ? value[discriminant] : undefined;
    const decoder = typeof tag === 'string' && Object.prototype.hasOwnProperty.call(cases, tag) ? cases[tag] : undefined;
    if (!decoder) {
      throw new LightboxBoardShapeError(`${at}.${discriminant}`, 'a kind this build knows');
    }
    return decoder(value, at, context);
  };
}

export function nullable<T>(decoder: Decoder<T>): Decoder<T | null> {
  return (value, at, context) => (value === null ? null : decoder(value, at, context));
}

export function list<T>(item: Decoder<T>): Decoder<T[]> {
  return (value, at, context) => {
    if (!Array.isArray(value)) {
      throw new LightboxBoardShapeError(at, 'a list');
    }
    return value.map((entry, index) => item(entry, `${at}[${index}]`, context));
  };
}

/**
 * A list whose entries may be lost without hiding anything: an entry that
 * fails is dropped and counted, and the rest are read. The list itself must
 * be a list.
 */
export function droppable<T>(item: Decoder<T>): Decoder<T[]> {
  return (value, at, context) => {
    if (!Array.isArray(value)) {
      throw new LightboxBoardShapeError(at, 'a list');
    }
    const read: T[] = [];
    value.forEach((entry, index) => {
      try {
        read.push(item(entry, `${at}[${index}]`, context));
      } catch (error) {
        if (!(error instanceof LightboxBoardShapeError)) {
          throw error;
        }
        countDropped(context, `${at}[${index}]`);
      }
    });
    return read;
  };
}

function countDropped(context: LightboxBoardDecodeContext, at: string): void {
  context.dropped.count += 1;
  if (context.dropped.at.length < DROPPED_PATHS_KEPT) {
    context.dropped.at.push(at);
  }
}

/** A fixed-length list. */
export function pair<A, B>(first: Decoder<A>, second: Decoder<B>): Decoder<[A, B]> {
  return (value, at, context) => {
    if (!Array.isArray(value) || value.length !== 2) {
      throw new LightboxBoardShapeError(at, 'a list of two');
    }
    return [first(value[0], `${at}[0]`, context), second(value[1], `${at}[1]`, context)];
  };
}

export function triple<A, B, C>(first: Decoder<A>, second: Decoder<B>, third: Decoder<C>): Decoder<[A, B, C]> {
  return (value, at, context) => {
    if (!Array.isArray(value) || value.length !== 3) {
      throw new LightboxBoardShapeError(at, 'a list of three');
    }
    return [first(value[0], `${at}[0]`, context), second(value[1], `${at}[1]`, context), third(value[2], `${at}[2]`, context)];
  };
}

/** An object whose keys are exactly a closed vocabulary's, each read by `entry`. */
export function keyed<K extends string, V>(vocabulary: Readonly<Record<K, true>>, entry: Decoder<V>): Decoder<Record<K, V>> {
  const keys = Object.keys(vocabulary) as K[];
  return (value, at, context) => {
    if (!isPlainObject(value)) {
      throw new LightboxBoardShapeError(at, 'an object');
    }
    const unknown = Object.keys(value).filter((key) => !(keys as string[]).includes(key)).length;
    if (unknown > 0) {
      throw new LightboxBoardShapeError(at, `without the ${unknown === 1 ? 'field' : `${unknown} fields`} this build does not read`, 'unknown-field');
    }
    const missing = keys.find((key) => !Object.prototype.hasOwnProperty.call(value, key));
    if (missing !== undefined) {
      throw new LightboxBoardShapeError(`${at}.${missing}`, 'present');
    }
    // The file's key order, as `object` keeps it.
    const read = {} as Record<K, V>;
    for (const key of Object.keys(value) as K[]) {
      read[key] = entry(value[key], `${at}.${key}`, context);
    }
    return read;
  };
}

/** A number or a string (a standards item's value). */
export const figureOrWord: Decoder<number | string> = (value, at, context) =>
  (typeof value === 'string' ? value : finite(value, at, context));

/** A field a saved board never holds (a group's lenses in flight): present, it fails. */
export function never<T>(why: string): Decoder<T> {
  return (_value, at) => {
    throw new LightboxBoardShapeError(at, why);
  };
}
