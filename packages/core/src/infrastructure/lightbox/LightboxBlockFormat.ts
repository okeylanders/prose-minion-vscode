/**
 * LightboxBlockFormat — each reading block's own fields, as the format
 * defines them, and the one repair that reads them: a member closed out of
 * its block (Lightbox Slice 4K, epic decision 50). Pure: no host, no I/O.
 *
 * **The fields.** `LIGHTBOX_BLOCK_FIELDS` names, for every lens, the
 * members its block holds. Each block decoder reads its block through this
 * table, so what the repair knows of a block and what its decoder reads
 * are one list.
 *
 * **A member closed out of its block** (`misnested-member`). A model that
 * closes a block one brace early leaves the block's last members standing
 * in the root. The writer's real case was group E's summary closed before
 * its friction, `…"movements":[…]},"friction":"…"}}`, its last brace stray:
 * the root then held a field the format does not define, and the summary
 * had no friction. A root member moves back into a block only when all of
 * these hold:
 * - the format does not define it at the root;
 * - the root member just before it, where the text puts it, is a block (an
 *   object under a lens's key) whose format defines it;
 * - that block does not hold it already.
 * A run of such members right after one block moves together, in the
 * text's order: one misplaced brace. Nothing guesses past a gap: a member
 * after anything else (`version`, a member the format does not define, a
 * block that holds that field already or does not define it) stays where
 * it is, to be ignored as any field the format does not define is. Only
 * the root is read this way; a member closed out of an object inside a
 * block is not moved.
 *
 * **Where a member stood** is the text's order, from the shared parser
 * (`rootKeys`), never the parsed object's: `JSON.parse` lists keys that
 * look like array indexes first, and keeps a key written twice at its
 * first place with its last value. So when a root key is written twice,
 * where its members stood is not known, and nothing moves.
 *
 * **The content guard, applied.** Moving members that stood just after
 * their block to the block's end moves one closing brace past them: the
 * strings and other scalars, and their order, are exactly as before, and
 * only the grouping changes. The repair checks the first part: the root
 * before and after, written out, must hold the same scalars in the same
 * order (`modelJsonContentMatches`), or nothing moves. That guard compares
 * scalars, not structure, so what moves is held by the rules above and by
 * tests, not by the guard.
 */

import type { LightboxLensId } from '@messages';
import { modelJsonContentMatches } from '@parsers/ModelJsonRepair';
import { LIGHTBOX_LENS_KEYS, LIGHTBOX_VOICE_TRAITS } from '@/infrastructure/lightbox/LightboxReadingWire';

/** Each lens's block: the members the format defines for it, every one required. */
export const LIGHTBOX_BLOCK_FIELDS: Readonly<Record<LightboxLensId, readonly string[]>> = {
  headline: ['sentence', 'terms', 'evidence', 'friction'],
  motif: ['items', 'friction'],
  tension: ['scores', 'claim', 'peaks', 'friction'],
  gravity: ['fields', 'collisions', 'literal', 'friction'],
  palette: ['clusters', 'swatches', 'friction'],
  characters: ['items', 'friction'],
  voice: [...LIGHTBOX_VOICE_TRAITS.map(([key]) => key), 'claim', 'evidence', 'friction'],
  subtext: ['items', 'friction'],
  genre: ['neighbors', 'promise', 'friction'],
  lineage: ['items', 'setAside', 'friction'],
  spark: ['items', 'friction'],
  stock: ['economy', 'signature', 'familiar', 'airLocks', 'echoes', 'friction'],
  rhythm: ['endings', 'movement', 'evidence', 'handoffs', 'friction'],
  numbers: ['items', 'friction'],
  template: ['name', 'description', 'evidence', 'beats', 'freshness', 'engagement', 'friction'],
  pressure: ['threads', 'friction'],
  artifacts: ['objects', 'friction'],
  summary: ['synopsis', 'movements', 'friction'],
  opinion: ['observations', 'views', 'friction'],
  steering: ['figures', 'friction']
};

/** Each block's root key, with its fields. */
const BLOCK_FIELDS_BY_KEY: ReadonlyMap<string, readonly string[]> = new Map(
  (Object.keys(LIGHTBOX_LENS_KEYS) as LightboxLensId[]).map((lens) => [LIGHTBOX_LENS_KEYS[lens], LIGHTBOX_BLOCK_FIELDS[lens]])
);

export interface LightboxRenestedRoot {
  root: Record<string, unknown>;
  /** How many root members moved into the block before them: none when the root is as it came. */
  moved: number;
}

const hasOwn = (object: object, key: string): boolean => Object.prototype.hasOwnProperty.call(object, key);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The root with each member closed out of its block moved back into it,
 * by the rules above. `rootKeys` is the root's member keys in the text's
 * order (`ModelJsonParsed.rootKeys`); any root it does not describe exactly
 * is returned as it came.
 */
export function renestLightboxMembers(root: Record<string, unknown>, rootKeys: readonly string[]): LightboxRenestedRoot {
  const unchanged = { root, moved: 0 };
  const own = Object.keys(root);
  // Where each member stood is known only when every root key is written once, and these are the root's keys.
  if (new Set(rootKeys).size !== rootKeys.length || rootKeys.length !== own.length || !rootKeys.every((key) => hasOwn(root, key))) {
    return unchanged;
  }
  const grown = new Map<string, Record<string, unknown>>();
  const moved = new Set<string>();
  // The block the members just read may rejoin: the last root member read, while it is a block.
  let open: string | undefined;
  for (const key of rootKeys) {
    const block = open !== undefined ? grown.get(open) ?? root[open] : undefined;
    const fields = open !== undefined ? BLOCK_FIELDS_BY_KEY.get(open) : undefined;
    const atRoot = key === 'version' || BLOCK_FIELDS_BY_KEY.has(key);
    if (open !== undefined && !atRoot && isObject(block) && fields?.includes(key) && !hasOwn(block, key)) {
      grown.set(open, { ...block, [key]: root[key] });
      moved.add(key);
      continue;
    }
    open = BLOCK_FIELDS_BY_KEY.has(key) ? key : undefined;
  }
  if (moved.size === 0) {
    return unchanged;
  }
  const renested = Object.fromEntries(own.filter((key) => !moved.has(key)).map((key) => [key, grown.get(key) ?? root[key]]));
  // The guard: the same scalars, in the same order; only a closing brace moved.
  return modelJsonContentMatches(JSON.stringify(root), JSON.stringify(renested)) ? { root: renested, moved: moved.size } : unchanged;
}
