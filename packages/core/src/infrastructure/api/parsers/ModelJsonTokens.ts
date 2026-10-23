/**
 * ModelJsonTokens — the tokens and the content guard under
 * `ModelJsonRepair` (Lightbox Slice 4H, epic decision 39). Pure, and it
 * imports nothing: `boundaries.test.ts` holds every `@parsers/*` module to
 * importing only one another.
 *
 * The tokenizer reads JSON's tokens, and a curly-quoted string only where a
 * token starts and only when nothing between its marks could be the text's
 * own quotation. The content guard compares two token sequences' string
 * literals and other scalars, kind and value: a repair may change only
 * structure.
 */

/** Why no repair was made: a closed reason. */
export type ModelJsonRefusalReason =
  | 'not-json'
  | 'string-not-json'
  | 'unterminated-string'
  | 'unsafe-curly-quotes'
  | 'more-after-root'
  | 'key-not-string'
  | 'colon-out-of-place'
  | 'comma-out-of-place'
  | 'closer-before-value'
  | 'closer-mismatch'
  | 'closer-where-value-belongs'
  | 'value-out-of-place'
  | 'root-not-closed'
  | 'ends-inside-member'
  | 'no-root-object'
  | 'still-invalid'
  | 'content-changed';

/** Thrown inside the parser and turned into `ModelJsonParseError` at its edge. Holds no text. */
export class ModelJsonRefused extends Error {
  constructor(readonly reason: ModelJsonRefusalReason, readonly at?: number) {
    super(reason);
    this.name = 'ModelJsonRefused';
  }
}

export type ModelJsonPunctuation = '{' | '}' | '[' | ']' | ':' | ',';

export type ModelJsonToken =
  | { kind: 'punct'; value: ModelJsonPunctuation; start: number; end: number }
  | { kind: 'string'; value: string; curly: boolean; start: number; end: number; complete: boolean }
  | { kind: 'scalar'; raw: string; start: number; end: number; complete: boolean };

/** A scalar as the guard compares it: its kind and its decoded value. */
export type ModelJsonScalar = readonly ['string' | 'scalar', string];

const OPENING_FENCE = /^```[\w-]*$/u;
const CLOSING_FENCE = '```';
const OPEN_CURLY = '“';
const CLOSE_CURLY = '”';
const SCALAR = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/y;
const PARTIAL_SCALAR = /[-+.\deEtrufalsn]+$/y;
const WHITESPACE = /[ \t\n\r]+/y;

/** The text without a fence line at its start or its end. */
export function unfenceModelJson(text: string): { text: string; fenced: boolean } {
  const lines = text.trim().split(/\r?\n/u);
  let from = 0;
  let to = lines.length;
  if (OPENING_FENCE.test(lines[0].trim())) {
    from += 1;
  }
  if (to > from && lines[to - 1].trim() === CLOSING_FENCE) {
    to -= 1;
  }
  return from === 0 && to === lines.length ? { text, fenced: false } : { text: lines.slice(from, to).join('\n'), fenced: true };
}

/**
 * JSON's tokens, with a curly-quoted string read where a token starts.
 * `partialEnd` lets the last token stop short (a reply cut off mid-string
 * or mid-number); anything that is not a token is refused.
 */
export function tokenizeModelJson(text: string, options: { partialEnd: boolean }): ModelJsonToken[] {
  const tokens: ModelJsonToken[] = [];
  let at = 0;
  while (at < text.length) {
    WHITESPACE.lastIndex = at;
    if (WHITESPACE.exec(text)) {
      at = WHITESPACE.lastIndex;
      continue;
    }
    const character = text[at];
    if ('{}[]:,'.includes(character)) {
      tokens.push({ kind: 'punct', value: character as ModelJsonPunctuation, start: at, end: at + 1 });
      at += 1;
    } else if (character === '"') {
      const token = straightString(text, at, options.partialEnd);
      tokens.push(token);
      at = token.end;
    } else if (character === OPEN_CURLY) {
      const token = curlyString(text, at);
      tokens.push(token);
      at = token.end;
    } else {
      SCALAR.lastIndex = at;
      const match = SCALAR.exec(text);
      if (match && !/[\w.]/u.test(text.charAt(SCALAR.lastIndex))) {
        // Cut off at the very end, a number or word may have been longer: it is not trusted.
        const complete = !(options.partialEnd && SCALAR.lastIndex === text.length);
        tokens.push({ kind: 'scalar', raw: match[0], start: at, end: SCALAR.lastIndex, complete });
        at = SCALAR.lastIndex;
        continue;
      }
      PARTIAL_SCALAR.lastIndex = at;
      if (options.partialEnd && PARTIAL_SCALAR.exec(text)) {
        tokens.push({ kind: 'scalar', raw: text.slice(at), start: at, end: text.length, complete: false });
        at = text.length;
        continue;
      }
      throw new ModelJsonRefused('not-json', at);
    }
  }
  return tokens;
}

function straightString(text: string, start: number, partialEnd: boolean): ModelJsonToken {
  let at = start + 1;
  while (at < text.length) {
    const character = text[at];
    if (character === '\\') {
      at += 2;
      continue;
    }
    if (character === '"') {
      let value: string;
      try {
        value = JSON.parse(text.slice(start, at + 1)) as string;
      } catch {
        throw new ModelJsonRefused('string-not-json', start);
      }
      return { kind: 'string', value, curly: false, start, end: at + 1, complete: true };
    }
    at += 1;
  }
  if (!partialEnd) {
    throw new ModelJsonRefused('unterminated-string', start);
  }
  return { kind: 'string', value: '', curly: false, start, end: text.length, complete: false };
}

/** `“…”` where a token starts: read only when nothing between could be the text's own quotation. */
function curlyString(text: string, start: number): ModelJsonToken {
  const close = text.indexOf(CLOSE_CURLY, start + 1);
  const inner = close < 0 ? '' : text.slice(start + 1, close);
  if (close < 0 || /["\\“”\n\r]/u.test(inner)) {
    throw new ModelJsonRefused('unsafe-curly-quotes', start);
  }
  return { kind: 'string', value: inner, curly: true, start, end: close + 1, complete: true };
}

export function modelJsonScalars(tokens: readonly ModelJsonToken[]): ModelJsonScalar[] {
  return tokens.flatMap((token): ModelJsonScalar[] => {
    if (token.kind === 'string') {
      return [['string', token.value]];
    }
    return token.kind === 'scalar' ? [['scalar', token.raw]] : [];
  });
}

/** The content guard: the repaired text's scalars, kind and value, are exactly the original's, in order. */
export function guardModelJsonContent(repaired: readonly ModelJsonScalar[], original: readonly ModelJsonScalar[]): void {
  const same = repaired.length === original.length &&
    repaired.every(([kind, value], index) => kind === original[index][0] && value === original[index][1]);
  if (!same) {
    throw new ModelJsonRefused('content-changed');
  }
}
