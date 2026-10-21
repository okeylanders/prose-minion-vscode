/**
 * The Lightbox inspector's passages (Slice 4E): their bounds, and what each
 * instance-counting style flag counts, in the writer's words. Shared by the
 * host, which cuts passages to these bounds, and the webview, which states
 * them.
 */

import type { LightboxStyleFlagId } from '@messages';

export const LIGHTBOX_PASSAGE_BOUNDS = {
  /** Rows a sentences well lists. Past it, a note says how many sentences and instances are not listed. */
  rows: 50,
  /** Paragraphs of a range (a bucketed ribbon column) sent at once; the rest are a ¶ chip away. */
  paragraphs: 10,
  /** The longest word, phrase or request id a request may name, in characters. Anything longer is on no board. */
  nameCharacters: 200
} as const;

/** What each instance-counting style flag counts, by its Style Flags detector, with its limit stated. */
export const LIGHTBOX_STYLE_FLAG_RULES: Readonly<Record<LightboxStyleFlagId, string>> = {
  adverbs: 'Words ending in -ly, as whole words. A heuristic: “only” and “family” count too.',
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the flag ids are kebab-case protocol literals.
  'passive-voice': '“was”, “were”, “been” or “being” followed by a word ending in -ed. A heuristic: irregular participles are missed.',
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the flag ids are kebab-case protocol literals.
  'weak-verbs': 'Forms of be, have, do, make and get, as whole words: is, are, was, were, has, have, had, do, does, did, make, makes, made, get, gets, got.',
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the flag ids are kebab-case protocol literals.
  'filler-words': 'just, really, very, quite, rather, somewhat, somehow, actually, basically and literally, as whole words.'
};

export const LIGHTBOX_STYLE_FLAG_ID_LIST: readonly LightboxStyleFlagId[] = ['adverbs', 'passive-voice', 'weak-verbs', 'filler-words'];

export function isLightboxStyleFlagId(value: unknown): value is LightboxStyleFlagId {
  return typeof value === 'string' && (LIGHTBOX_STYLE_FLAG_ID_LIST as readonly string[]).includes(value);
}
