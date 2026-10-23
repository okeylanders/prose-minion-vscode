/**
 * Group F's block: the Opinion (ADR 2026-10-19 D7 addendum; Slice 4D).
 * Pure: no host, no I/O. Called by `LightboxReadingCodec` once the block's
 * friction is known; a throw here withholds the whole block.
 *
 * Counts and lengths the prompt states are asks (Slice 4H): more
 * observations, cites or Why points than asked, and longer words, are read
 * and shown; Bring clips a view to a Workshop tile. Rules enforced here, not
 * only asked for in the prompt:
 * - **Observations.** At least two, each with an id unique in the block
 *   (`O` and a number from 1; the prompt asks for `O1`–`O6`), a text, and at
 *   least one cite. A cite is a tile, by its host
 *   id, optionally with one of the quotes the digest numbered for it (a
 *   whole number from 0), or a measured figure, by its ref; nothing else. An
 *   observation that breaks the format is withheld by its id (or, with no
 *   well-formed id, by its position), and the views that cite it with it.
 *   Whether a cite names something the digest held is checked afterwards
 *   (`LightboxOpinionGates`), against the digest.
 * - **Views.** All three are required: a block without one of
 *   `enthusiastic`, `neutral` and `blunt` is withheld. Each is decoded on
 *   its own: a headline, a body and at least one Why point, each weighted
 *   `strength`, `even` or `concern`, citing at least one observation id. A
 *   view that breaks the format is withheld alone.
 * - **No counts.** No field carries one: an Opinion states only figures the
 *   items it cites hold, checked against them afterwards.
 * Every object decodes with `strictObject`: a field the format does not
 * define is counted, never named, and every reason is host-owned.
 */

import type { LightboxOpinionViewId } from '@messages';
import { LIGHTBOX_OPINION_VIEWS, LIGHTBOX_OPINION_WEIGHTS } from '@shared/constants/lightboxOpinion';
import { exactObject, objectAt, shapeError } from '@/application/services/workshop/persistedValidation';
import { listAt, strictObject, text } from '@/infrastructure/lightbox/LightboxReadingFields';
import {
  LIGHTBOX_OPINION_MINIMUM_OBSERVATIONS,
  LIGHTBOX_OPINION_OBSERVATION_ID,
  type LightboxDecodedObservation,
  type LightboxDecodedOpinionBlock,
  type LightboxDecodedOpinionCite,
  type LightboxDecodedOpinionView,
  type LightboxDecodedWhy
} from '@/infrastructure/lightbox/LightboxOpinionWire';

/** A host key a cite may name: a tile id or a measured ref. Longer is not a key the host mints: a structural rule, not an ask. */
const KEY_CHARACTERS = 120;

export function decodeOpinionBlock(value: unknown, path: string, friction: string): LightboxDecodedOpinionBlock {
  const block = strictObject(value, path, ['observations', 'views', 'friction']);
  const observations = decodeObservations(block.observations, `${path}.observations`);
  const views = strictObject(block.views, `${path}.views`, LIGHTBOX_OPINION_VIEWS);
  const decoded = Object.fromEntries(LIGHTBOX_OPINION_VIEWS.map((view) => [view, lenient(() => decodeView(views[view], `${path}.views.${view}`))]));
  return {
    lens: 'opinion',
    observations: observations.items,
    malformed: observations.malformed,
    views: decoded as LightboxDecodedOpinionBlock['views'],
    friction
  };
}

function decodeObservations(
  value: unknown,
  path: string
): { items: LightboxDecodedObservation[]; malformed: LightboxDecodedOpinionBlock['malformed'] } {
  listAt(value, path, LIGHTBOX_OPINION_MINIMUM_OBSERVATIONS, 'observations');
  const items: LightboxDecodedObservation[] = [];
  const malformed: LightboxDecodedOpinionBlock['malformed'] = [];
  const seen = new Set<string>();
  value.forEach((entry, index) => {
    const itemPath = `${path}[${index}]`;
    const id = wellFormedId(entry) ?? `Observation ${index + 1}`;
    try {
      const observation = decodeObservation(objectAt(entry, itemPath), itemPath);
      if (seen.has(observation.id)) {
        malformed.push({ id: `Observation ${index + 1}`, reason: 'Another observation in this block already has that id.' });
        return;
      }
      seen.add(observation.id);
      items.push(observation);
    } catch (error) {
      malformed.push({ id, reason: `It broke the format: ${error instanceof Error ? error.message : String(error)}` });
    }
  });
  return { items, malformed };
}

function decodeObservation(item: Record<string, unknown>, path: string): LightboxDecodedObservation {
  const observation = strictObject(item, path, ['id', 'text', 'cites']);
  listAt(observation.cites, `${path}.cites`, 1, 'cites');
  return {
    id: observationId(observation.id, `${path}.id`),
    text: text(observation.text, `${path}.text`),
    cites: observation.cites.map((cite, index) => decodeCite(cite, `${path}.cites[${index}]`))
  };
}

/** A tile (maybe with a quote by index) or a measured ref: exactly one of the two shapes. */
function decodeCite(value: unknown, path: string): LightboxDecodedOpinionCite {
  const object = objectAt(value, path);
  const undefinedFields = Object.keys(object).filter((key) => !['tile', 'quote', 'measured'].includes(key)).length;
  if (undefinedFields > 0) {
    throw new Error(`${path} has ${undefinedFields} field${undefinedFields === 1 ? '' : 's'} the format does not define.`);
  }
  if ('measured' in object) {
    const cite = exactObject(object, path, ['measured']);
    return { measured: key(cite.measured, `${path}.measured`) };
  }
  const cite = exactObject(object, path, ['tile'], ['quote']);
  if (cite.quote !== undefined && (!Number.isSafeInteger(cite.quote) || (cite.quote as number) < 0)) {
    shapeError(`${path}.quote`, 'a quote number (a whole number from 0)');
  }
  return { tile: key(cite.tile, `${path}.tile`), ...(cite.quote !== undefined ? { quote: cite.quote as number } : {}) };
}

function decodeView(value: unknown, path: string): LightboxDecodedOpinionView {
  const view = strictObject(value, path, ['headline', 'body', 'why']);
  listAt(view.why, `${path}.why`, 1, 'points');
  return {
    headline: text(view.headline, `${path}.headline`),
    body: text(view.body, `${path}.body`),
    why: view.why.map((point, index) => decodeWhy(point, `${path}.why[${index}]`))
  };
}

function decodeWhy(value: unknown, path: string): LightboxDecodedWhy {
  const point = strictObject(value, path, ['weight', 'text', 'observations']);
  if (typeof point.weight !== 'string' || !(LIGHTBOX_OPINION_WEIGHTS as readonly string[]).includes(point.weight)) {
    shapeError(`${path}.weight`, 'strength, even or concern');
  }
  listAt(point.observations, `${path}.observations`, 1, 'observation ids');
  return {
    weight: point.weight as LightboxDecodedWhy['weight'],
    text: text(point.text, `${path}.text`),
    observations: point.observations.map((id, index) => observationId(id, `${path}.observations[${index}]`))
  };
}

function observationId(value: unknown, path: string): string {
  if (typeof value !== 'string' || !LIGHTBOX_OPINION_OBSERVATION_ID.test(value)) {
    shapeError(path, 'an observation id: O and a number from 1');
  }
  return value as string;
}

function key(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > KEY_CHARACTERS || /\s/.test(value)) {
    shapeError(path, `a board item's key, as the digest names it (at most ${KEY_CHARACTERS} characters)`);
  }
  return value as string;
}

/** An entry's id, when it gave a well-formed one: a malformed observation is withheld under it. */
function wellFormedId(entry: unknown): string | undefined {
  const id = entry && typeof entry === 'object' && !Array.isArray(entry) ? (entry as Record<string, unknown>).id : undefined;
  return typeof id === 'string' && LIGHTBOX_OPINION_OBSERVATION_ID.test(id) ? id : undefined;
}

/** A view decoded on its own: its value, or its fault in host words, so it withholds only itself. */
function lenient(decode: () => LightboxDecodedOpinionView): { value: LightboxDecodedOpinionView } | { fault: string } {
  try {
    return { value: decode() };
  } catch (error) {
    return { fault: `It broke the format: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/** The views in tab order, as `[name, decoded]` pairs. */
export function lightboxDecodedViews(block: LightboxDecodedOpinionBlock): Array<[LightboxOpinionViewId, LightboxDecodedOpinionBlock['views'][LightboxOpinionViewId]]> {
  return LIGHTBOX_OPINION_VIEWS.map((view) => [view, block.views[view]]);
}
