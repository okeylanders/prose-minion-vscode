/**
 * ModelJsonRepair — reading a model's JSON with a deterministic,
 * structure-only repair before giving up on it (Lightbox Slice 4H, epic
 * decision 39). Pure: no host, no I/O, no model, and no feature: it imports
 * nothing, so any caller that has cut a reply's JSON out of its own frame can
 * use it (`boundaries.test.ts` holds it to that).
 *
 * `parseModelJson(jsonText)` is `JSON.parse` first. When that refuses, it
 * fixes the faults a model makes in the scaffolding around its words, and
 * nothing else:
 * - **a code fence** around the JSON (`code-fence`);
 * - **stray closing brackets** after a complete top-level value
 *   (`stray-closing-bracket`; the real case: a reply whose last object closed
 *   with `}}}` where `}}` belonged);
 * - **trailing commas** before a closing bracket (`trailing-comma`);
 * - **missing closing brackets** at the end (`missing-closing-bracket`), only
 *   when the caller says the reply stopped normally with its frame closed
 *   (`closeMissingBrackets`), since only the caller knows how it ended;
 * - **curly quotation marks used as a string's delimiters** (`“…”` where
 *   `"…"` belongs; `curly-quote-delimiters`), only where a token starts, and
 *   only when nothing between them is a quotation mark, a backslash or a line
 *   break: inside a string a curly quote is the text's own punctuation and is
 *   never touched.
 * Sentinels and other frame rules stay with each caller, whose protocols
 * differ.
 *
 * `salvageModelJson(jsonText)` reads a reply cut off at its output ceiling:
 * it keeps the root object's members that finished, drops the one it was
 * cut inside (never trusted, however much of it arrived), and closes the
 * root, naming that member's key when it had arrived whole.
 *
 * **Where each root member stood** (Lightbox Slice 4K). Asked with
 * `rootKeys: true`, either reports the root object's member keys in the
 * order the text gives them, a key written twice listed twice. `JSON.parse`
 * keeps a repeated key's last value at its first place, and lists keys that
 * look like array indexes first, so the parsed object's own key order is not
 * always the text's. A caller with a schema of its own can use the order to
 * know which member stood beside which; the parser knows no schema.
 *
 * **The content guard.** A repair may change only structure: brackets,
 * commas, whitespace, fences and string delimiters. The original and the
 * repaired text are each tokenized on their own, and their sequences of
 * string literals and other scalars (numbers, `true`, `false`, `null`) are
 * compared, kind and value: they must be identical, or, for a salvage, the
 * repaired sequence must be the original's up to the member it was cut
 * inside. Anything else is refused.
 *
 * **Errors carry no text.** A refusal throws `ModelJsonParseError`: the
 * position `JSON.parse` gave, and a closed reason with at most a character
 * position. Neither ever holds a slice of the reply, which may quote the
 * writer's work, so a caller can log and show them.
 *
 * The tokenizer and the guard's comparison live in `ModelJsonTokens`.
 */

import {
  guardModelJsonContent,
  ModelJsonRefused,
  modelJsonRootKeys,
  modelJsonScalars,
  tokenizeModelJson,
  unfenceModelJson,
  type ModelJsonRefusalReason,
  type ModelJsonToken
} from '@parsers/ModelJsonTokens';

export type { ModelJsonRefusalReason } from '@parsers/ModelJsonTokens';

export type ModelJsonRepairKind =
  | 'code-fence'
  | 'stray-closing-bracket'
  | 'trailing-comma'
  | 'missing-closing-bracket'
  | 'curly-quote-delimiters';

export interface ModelJsonParsed {
  value: unknown;
  /** The repairs made, each kind once, in the order first made; empty when the text parsed as it stood. */
  repairs: ModelJsonRepairKind[];
  /**
   * Asked with `rootKeys: true`: the root object's member keys in the order
   * the text gives them, a key written twice listed twice; empty when the
   * root is not an object.
   */
  rootKeys?: string[];
}

export interface ModelJsonSalvaged {
  root: Record<string, unknown>;
  repairs: ModelJsonRepairKind[];
  /** The key of the root member the reply was cut inside, when its key had arrived whole. */
  cutKey?: string;
  /** Asked with `rootKeys: true`: the kept members' keys in the order the text gives them, as `ModelJsonParsed.rootKeys`. */
  rootKeys?: string[];
}

export interface ModelJsonReadOptions {
  /** Report where each root member stood (`rootKeys`). */
  rootKeys?: boolean;
}

export interface ModelJsonRefusal {
  reason: ModelJsonRefusalReason;
  /** The character the refusal is about, when it is one. */
  at?: number;
}

/** A reason's fixed phrase. A switch, not a table keyed by the reasons, so each reason keeps its kebab-case spelling. */
function refusalWords(reason: ModelJsonRefusalReason): string {
  switch (reason) {
    case 'not-json':
      return 'text that is not JSON';
    case 'string-not-json':
      return 'a string that is not JSON';
    case 'unterminated-string':
      return 'an unterminated string';
    case 'unsafe-curly-quotes':
      return 'curly quotation marks that cannot be read safely as a string';
    case 'more-after-root':
      return 'more JSON after the root';
    case 'key-not-string':
      return 'a key that is not a string';
    case 'colon-out-of-place':
      return 'a colon out of place';
    case 'comma-out-of-place':
      return 'a comma out of place';
    case 'closer-before-value':
      return 'a closing bracket before any value';
    case 'closer-mismatch':
      return 'a closing bracket that does not match';
    case 'closer-where-value-belongs':
      return 'a closing bracket where a value belongs';
    case 'value-out-of-place':
      return 'a value out of place';
    case 'root-not-closed':
      return 'the JSON ends before its root closes';
    case 'ends-inside-member':
      return 'the JSON ends inside a member, so it cannot be closed without changing it';
    case 'no-root-object':
      return 'the reply was cut off before a root object began';
    case 'still-invalid':
      return 'the repaired JSON still does not parse';
    case 'content-changed':
      return 'the repair would change, add or drop a value';
    default: {
      const unknown: never = reason;
      return unknown;
    }
  }
}

/** A refusal in host words: a fixed phrase and at most a character position, never the reply's text. */
export function describeModelJsonRefusal(refusal: ModelJsonRefusal): string {
  return `${refusalWords(refusal.reason)}${refusal.at !== undefined ? ` at character ${refusal.at}` : ''}`;
}

/** The JSON could not be read, even repaired. Carries positions and a closed reason only. */
export class ModelJsonParseError extends Error {
  constructor(
    /** Where `JSON.parse` stopped, when it said. */
    readonly position: number | undefined,
    readonly refusal: ModelJsonRefusal
  ) {
    super(`The JSON is invalid${position !== undefined ? ` (at character ${position})` : ''}: ${describeModelJsonRefusal(refusal)}`);
    this.name = 'ModelJsonParseError';
  }
}

/**
 * The character `JSON.parse` stopped at, from its message, or undefined.
 * The wording is the engine's, not a contract: Node 18 says "Unexpected
 * token } in JSON at position 95", Node 20 and later "… at position 95 (line
 * 1 column 96)", and some messages give no position at all, or echo a slice
 * of the text instead ("Unexpected token 'x', \"…\" is not valid JSON").
 * Only a position at the very end of the message is read, so a number in an
 * echoed slice is never taken for one. Nothing depends on it but the
 * error's own words.
 */
export function jsonParseErrorPosition(message: string): number | undefined {
  const found = / at position (\d+)(?: \(line \d+ column \d+\))?$/u.exec(message)?.[1];
  return found !== undefined ? Number(found) : undefined;
}

/** `JSON.parse`, or the structure-only repair under its content guard; throws `ModelJsonParseError`. */
export function parseModelJson(
  jsonText: string,
  options: ModelJsonReadOptions & { closeMissingBrackets?: boolean } = {}
): ModelJsonParsed {
  const asWritten = parsedAsWritten(jsonText);
  if ('value' in asWritten) {
    return { value: asWritten.value, repairs: [], ...rootKeysAsked(options, () => tokenizeModelJson(jsonText, { partialEnd: false })) };
  }
  try {
    const fence = unfenceModelJson(jsonText);
    const tokens = tokenizeModelJson(fence.text, { partialEnd: false });
    const walk = walkTokens(tokens, { closeOpen: options.closeMissingBrackets === true, salvage: false });
    const repaired = rebuild(fence.text, tokens, walk.drops, walk.keepUntil, walk.closers);
    const value = parseOrRefuse(repaired);
    const repairedTokens = tokenizeModelJson(repaired, { partialEnd: false });
    guardModelJsonContent(modelJsonScalars(repairedTokens), modelJsonScalars(tokens));
    return {
      value,
      repairs: [...(fence.fenced ? ['code-fence' as const] : []), ...walk.repairs],
      ...rootKeysAsked(options, () => repairedTokens)
    };
  } catch (error) {
    throw new ModelJsonParseError(asWritten.position, refusalOf(error));
  }
}

/** A reply cut off at its output ceiling: its finished root members, the cut one dropped, the root closed. */
export function salvageModelJson(jsonText: string, options: ModelJsonReadOptions = {}): ModelJsonSalvaged {
  try {
    const fence = unfenceModelJson(jsonText);
    const tokens = tokenizeModelJson(fence.text, { partialEnd: true });
    const walk = walkTokens(tokens, { closeOpen: false, salvage: true });
    const repaired = rebuild(fence.text, tokens, walk.drops, walk.keepUntil, walk.closers);
    const value = parseOrRefuse(repaired);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new ModelJsonRefused('no-root-object');
    }
    // Every scalar before the cut is kept exactly; only the cut member's are dropped.
    const kept = tokens.filter((token) => token.end <= walk.keepUntil);
    const repairedTokens = tokenizeModelJson(repaired, { partialEnd: false });
    guardModelJsonContent(modelJsonScalars(repairedTokens), modelJsonScalars(kept));
    return {
      root: value as Record<string, unknown>,
      repairs: [...(fence.fenced ? ['code-fence' as const] : []), ...walk.repairs],
      ...(walk.cutKey !== undefined ? { cutKey: walk.cutKey } : {}),
      ...rootKeysAsked(options, () => repairedTokens)
    };
  } catch (error) {
    throw new ModelJsonParseError(undefined, refusalOf(error));
  }
}

/** `JSON.parse` on the text as written: its value, or the position it stopped at. */
function parsedAsWritten(jsonText: string): { value: unknown } | { position: number | undefined } {
  try {
    return { value: JSON.parse(jsonText) as unknown };
  } catch (error) {
    return { position: jsonParseErrorPosition(error instanceof Error ? error.message : '') };
  }
}

/** The root's keys in the text's order, only when asked: tokenizing text that parsed cannot refuse it. */
function rootKeysAsked(options: ModelJsonReadOptions, tokens: () => readonly ModelJsonToken[]): { rootKeys?: string[] } {
  return options.rootKeys ? { rootKeys: modelJsonRootKeys(tokens()) } : {};
}

/**
 * The content guard, on two texts tokenized on their own: whether the
 * repaired text holds exactly the original's string literals and other
 * scalars, kind and value, in order. Only structure may differ. False when
 * either text holds anything that is not a token.
 *
 * **It compares scalar sequences, not structure.** It does not prove that
 * the grouping survived: moving a value into another object or array, or
 * swapping an empty object for an empty array, keeps the same scalars and
 * passes. The deterministic walk above never makes such a change (it only
 * drops a stray closer or a trailing comma, appends closers, or rewrites a
 * curly string's delimiters), so the guard is enough for it. A repair that
 * could regroup (a model asked to fix the syntax, say) needs a structural
 * check of its own as well; this guard alone is not one.
 */
export function modelJsonContentMatches(original: string, repaired: string): boolean {
  try {
    guardModelJsonContent(modelJsonScalars(tokenizeModelJson(repaired, { partialEnd: false })), modelJsonScalars(tokenizeModelJson(original, { partialEnd: false })));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// The walk: JSON's grammar, with the repairs it allows
// ---------------------------------------------------------------------------

type ContainerState = 'start' | 'key' | 'colon' | 'value' | 'after';

interface Container {
  kind: 'object' | 'array';
  state: ContainerState;
  /** The comma that put this container in `key` or `value`, dropped if a closer follows it. */
  comma?: number;
}

interface Walk {
  drops: Set<number>;
  repairs: ModelJsonRepairKind[];
  /** Characters of the text kept: all of it, or (a salvage) up to the end of the last finished root member. */
  keepUntil: number;
  closers: string;
  cutKey?: string;
}

function walkTokens(tokens: readonly ModelJsonToken[], options: { closeOpen: boolean; salvage: boolean }): Walk {
  const drops = new Set<number>();
  const repairs = new Set<ModelJsonRepairKind>();
  const stack: Container[] = [];
  let done = false;
  // A salvage: where the root's last finished member ends, and the key of the member after it.
  let lastFinished = -1;
  let memberKey: string | undefined;
  const top = (): Container | undefined => stack[stack.length - 1];
  const valueDone = (end: number) => {
    const container = top();
    if (!container) {
      done = true;
      return;
    }
    container.state = 'after';
    container.comma = undefined;
    if (stack.length === 1) {
      lastFinished = end;
      memberKey = undefined;
    }
  };

  tokens.forEach((token, index) => {
    if (done) {
      if (token.kind === 'punct' && (token.value === '}' || token.value === ']')) {
        drops.add(index);
        repairs.add('stray-closing-bracket');
        return;
      }
      throw new ModelJsonRefused('more-after-root', token.start);
    }
    const container = top();
    if (token.kind === 'string' || token.kind === 'scalar') {
      // A token cut off at the end is never trusted, and never counted as a repair: its member is dropped.
      if (!token.complete) {
        return;
      }
      if (token.kind === 'string' && token.curly) {
        repairs.add('curly-quote-delimiters');
      }
      if (container?.kind === 'object' && (container.state === 'start' || container.state === 'key')) {
        if (token.kind !== 'string') {
          throw new ModelJsonRefused('key-not-string', token.start);
        }
        container.state = 'colon';
        container.comma = undefined;
        if (stack.length === 1) {
          memberKey = token.value;
        }
        return;
      }
      expectValue(container, token.start);
      valueDone(token.end);
      return;
    }
    switch (token.value) {
      case '{':
      case '[':
        expectValue(container, token.start);
        stack.push({ kind: token.value === '{' ? 'object' : 'array', state: 'start' });
        return;
      case ':':
        if (container?.kind !== 'object' || container.state !== 'colon') {
          throw new ModelJsonRefused('colon-out-of-place', token.start);
        }
        container.state = 'value';
        return;
      case ',':
        if (!container || container.state !== 'after') {
          throw new ModelJsonRefused('comma-out-of-place', token.start);
        }
        container.state = container.kind === 'object' ? 'key' : 'value';
        container.comma = index;
        return;
      case '}':
      case ']': {
        if (!container) {
          throw new ModelJsonRefused('closer-before-value', token.start);
        }
        if ((token.value === '}') !== (container.kind === 'object')) {
          throw new ModelJsonRefused('closer-mismatch', token.start);
        }
        if (container.comma !== undefined) {
          drops.add(container.comma);
          repairs.add('trailing-comma');
        } else if (container.state !== 'start' && container.state !== 'after') {
          throw new ModelJsonRefused('closer-where-value-belongs', token.start);
        }
        stack.pop();
        valueDone(token.end);
        return;
      }
    }
  });

  if (done) {
    return { drops, repairs: [...repairs], keepUntil: Number.POSITIVE_INFINITY, closers: '' };
  }
  if (options.salvage) {
    if (stack.length === 0 || stack[0].kind !== 'object') {
      throw new ModelJsonRefused('no-root-object');
    }
    // Keep the root's finished members, close the root, drop the member it was cut inside.
    repairs.add('missing-closing-bracket');
    const opening = tokens.find((token) => token.kind === 'punct' && token.value === '{');
    return {
      drops,
      repairs: [...repairs],
      keepUntil: lastFinished >= 0 ? lastFinished : (opening?.end ?? 0),
      closers: '}',
      ...(memberKey !== undefined ? { cutKey: memberKey } : {})
    };
  }
  const innermost = top();
  if (!options.closeOpen || !innermost) {
    throw new ModelJsonRefused('root-not-closed');
  }
  if (innermost.comma !== undefined) {
    drops.add(innermost.comma);
    repairs.add('trailing-comma');
  } else if (innermost.state !== 'start' && innermost.state !== 'after') {
    throw new ModelJsonRefused('ends-inside-member');
  }
  repairs.add('missing-closing-bracket');
  const closers = [...stack].reverse().map((container) => (container.kind === 'object' ? '}' : ']')).join('');
  return { drops, repairs: [...repairs], keepUntil: Number.POSITIVE_INFINITY, closers };
}

function expectValue(container: Container | undefined, at: number): void {
  if (container && container.state !== 'value' && !(container.kind === 'array' && container.state === 'start')) {
    throw new ModelJsonRefused('value-out-of-place', at);
  }
}

// ---------------------------------------------------------------------------
// Rebuilding and parsing
// ---------------------------------------------------------------------------

/** The text with dropped tokens removed, curly strings given straight delimiters, cut at `keepUntil`, closers added. */
function rebuild(text: string, tokens: readonly ModelJsonToken[], drops: ReadonlySet<number>, keepUntil: number, closers: string): string {
  let out = '';
  let at = 0;
  tokens.forEach((token, index) => {
    if (token.end > keepUntil) {
      return;
    }
    out += text.slice(at, token.start);
    if (!drops.has(index)) {
      out += token.kind === 'string' && token.curly ? JSON.stringify(token.value) : text.slice(token.start, token.end);
    }
    at = token.end;
  });
  if (keepUntil === Number.POSITIVE_INFINITY) {
    out += text.slice(at);
  }
  return `${out.trimEnd()}${closers}`;
}

function parseOrRefuse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new ModelJsonRefused('still-invalid');
  }
}

function refusalOf(error: unknown): ModelJsonRefusal {
  if (error instanceof ModelJsonRefused) {
    return { reason: error.reason, ...(error.at !== undefined ? { at: error.at } : {}) };
  }
  // Nothing else is thrown above; should it be, it is described by the closed reason that fits it best.
  return { reason: 'still-invalid' };
}
