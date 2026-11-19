/**
 * LexicalGravityLensReplyJson — reading a lens build reply's JSON: the
 * shared parser (`parseModelJson`), and before it the one repair only the
 * lens format can make, an `attention` closed one brace early. Pure: no
 * host, no I/O, no model.
 *
 * **An `attention` closed early** (`early-closed-attention`). The writer's
 * real case: in two of a reply's three lenses the model wrote
 *
 *     "attention":{"foregrounds":[…]},"backgrounds":[…]}   ← written
 *     "attention":{"foregrounds":[…],"backgrounds":[…]}    ← meant
 *
 * so `backgrounds` stood in `logic`, `logic` closed where `attention` was
 * meant to, and the lens closed where `logic` was meant to. The reply then
 * does not parse, and the shared parser cannot mend it: a stray brace in
 * the middle can be removed several ways with the same content, and only
 * the lens format knows `backgrounds` belongs in `attention`.
 *
 * **When it applies.** Read in the text's own order, token by token, never
 * from a parsed object: an `attention` member whose object holds only
 * `foregrounds`, a list of strings, closed and followed at once by a
 * `backgrounds` member, a list of strings.
 *
 * **What it does.** The early closing brace moves to just after
 * `backgrounds`. When a brace already stands there (the case above, where
 * the model wrote one brace too many), that brace is `attention`'s and
 * nothing is added. No other brace is touched.
 *
 * **Checked, or nothing moves.** The repaired text must hold exactly the
 * original's strings and other scalars, in order (`modelJsonContentMatches`),
 * and must then read through the shared parser. That guard compares
 * scalars, not grouping, so what moves is held by the rule above and by
 * tests. A text that cannot be tokenized, a guard that cannot confirm, or a
 * repaired text that still does not read leaves the reply exactly as it
 * came, to be read (or refused) as written. One case is left alone on
 * purpose: a balanced reply whose `backgrounds` is the last member of
 * `logic`, where the brace after it is `logic`'s own; the repaired text
 * does not read, so nothing moves and the lens is left to its validator.
 *
 * Errors and repair kinds carry no text of the reply.
 */

import { modelJsonContentMatches, parseModelJson, type ModelJsonRepairKind } from '@parsers/ModelJsonRepair';
import { tokenizeModelJson, unfenceModelJson, type ModelJsonToken } from '@parsers/ModelJsonTokens';

export const LEXICAL_GRAVITY_EARLY_CLOSED_ATTENTION = 'early-closed-attention';

export type LexicalGravityLensJsonRepairKind =
  | ModelJsonRepairKind
  | typeof LEXICAL_GRAVITY_EARLY_CLOSED_ATTENTION;

export interface LexicalGravityLensJson {
  value: unknown;
  /** The repairs made, each kind once; empty when the reply read as written. */
  repairs: LexicalGravityLensJsonRepairKind[];
  /** How many `attention` objects were closed again after their `backgrounds`. */
  reclosedAttentions: number;
}

interface ReclosedText {
  text: string;
  moved: number;
  fenced: boolean;
}

const isPunct = (token: ModelJsonToken | undefined, value: string): boolean =>
  token?.kind === 'punct' && token.value === value;

const isKey = (tokens: readonly ModelJsonToken[], at: number, key: string): boolean => {
  const token = tokens[at];
  return token?.kind === 'string' && token.value === key && isPunct(tokens[at + 1], ':');
};

/** The index of the `]` closing a list of strings that opens at `at`, or -1 when it is anything else. */
function stringListEnd(tokens: readonly ModelJsonToken[], at: number): number {
  if (!isPunct(tokens[at], '[')) {
    return -1;
  }
  for (let index = at + 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (isPunct(token, ']')) {
      return index;
    }
    if (token.kind !== 'string' && !isPunct(token, ',')) {
      return -1;
    }
  }
  return -1;
}

/**
 * The reply with each early-closed `attention` closed after its
 * `backgrounds` instead, by the rules above; as it came (`moved: 0`) when
 * there is none, or when the repair cannot be checked.
 */
export function recloseLexicalGravityAttention(jsonText: string): ReclosedText {
  const unchanged: ReclosedText = { text: jsonText, moved: 0, fenced: false };
  const fence = unfenceModelJson(jsonText);
  let tokens: ModelJsonToken[];
  try {
    tokens = tokenizeModelJson(fence.text, { partialEnd: false });
  } catch {
    return unchanged;
  }
  /** Character ranges to leave out, and where a closing brace is written instead. */
  const dropped: Array<{ start: number; end: number }> = [];
  const closedAt = new Set<number>();
  for (let index = 0; index < tokens.length; index += 1) {
    // "attention" : { "foregrounds" : [ … ] }   ← the early brace
    if (!isKey(tokens, index, 'attention') || !isPunct(tokens[index + 2], '{') || !isKey(tokens, index + 3, 'foregrounds')) {
      continue;
    }
    const foregroundsEnd = stringListEnd(tokens, index + 5);
    const early = tokens[foregroundsEnd + 1];
    // , "backgrounds" : [ … ]
    if (foregroundsEnd < 0 || !isPunct(early, '}') || !isPunct(tokens[foregroundsEnd + 2], ',')
      || !isKey(tokens, foregroundsEnd + 3, 'backgrounds')) {
      continue;
    }
    const backgroundsEnd = stringListEnd(tokens, foregroundsEnd + 5);
    if (backgroundsEnd < 0) {
      continue;
    }
    dropped.push({ start: early.start, end: early.end });
    if (!isPunct(tokens[backgroundsEnd + 1], '}')) {
      closedAt.add(tokens[backgroundsEnd].end);
    }
    index = backgroundsEnd;
  }
  if (dropped.length === 0) {
    return unchanged;
  }
  let text = '';
  let from = 0;
  const cuts = [
    ...dropped.map((range) => ({ at: range.start, resume: range.end, write: '' })),
    ...[...closedAt].map((at) => ({ at, resume: at, write: '}' }))
  ].sort((left, right) => left.at - right.at);
  for (const cut of cuts) {
    text += fence.text.slice(from, cut.at) + cut.write;
    from = cut.resume;
  }
  text += fence.text.slice(from);
  // The guard: the same scalars in the same order, and a text that now reads. Anything else moves nothing.
  if (!modelJsonContentMatches(fence.text, text)) {
    return unchanged;
  }
  try {
    parseModelJson(text);
  } catch {
    return unchanged;
  }
  return { text, moved: dropped.length, fenced: fence.fenced };
}

/** A lens build reply's JSON, cut out of its frame: read through the lens repair and the shared parser. */
export function parseLexicalGravityLensJson(jsonText: string): LexicalGravityLensJson {
  const reclosed = recloseLexicalGravityAttention(jsonText);
  const parsed = parseModelJson(reclosed.text);
  if (reclosed.moved === 0) {
    return { value: parsed.value, repairs: parsed.repairs, reclosedAttentions: 0 };
  }
  return {
    value: parsed.value,
    repairs: [
      ...(reclosed.fenced ? ['code-fence' as const] : []),
      LEXICAL_GRAVITY_EARLY_CLOSED_ATTENTION,
      ...parsed.repairs
    ],
    reclosedAttentions: reclosed.moved
  };
}
