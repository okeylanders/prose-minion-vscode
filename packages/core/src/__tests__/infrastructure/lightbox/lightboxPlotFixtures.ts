/**
 * Fixtures for the Lightbox's group E (Slice 4C): the worked example's body,
 * read through the production codec, verifier, counter and assembly, on its
 * own *Alice* paragraphs (Lewis Carroll, 1865, public domain) or on an
 * edited copy of them. No writer's text is committed.
 */
import type { LightboxLensId, LightboxReadingGroup, LightboxReadingTile } from '@messages';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
import { frame, framedJson, readWorkedExample } from './lightboxReadingFixtures';

/* eslint-disable @typescript-eslint/no-explicit-any -- worked-example bodies are edited as plain JSON. */
export type StoryBody = Record<string, any>;

export const STORY = readWorkedExample('E');
/** ¶1–¶8 of the worked example; index 0 is ¶1. */
export const ALICE = STORY.paragraphs;
export const STORY_LENSES: LightboxLensId[] = ['template', 'pressure', 'artifacts', 'summary'];

/** A fresh copy of the worked example's body, to edit. */
export function storyBody(): StoryBody {
  return framedJson(STORY.response) as StoryBody;
}

/** Group E read on `paragraphs` from `body`, as the runner assembles it. */
export function readStory(
  body: StoryBody = storyBody(),
  paragraphs: readonly string[] = ALICE,
  lenses: LightboxLensId[] = STORY_LENSES
) {
  const decoded = decodeLightboxGroup(frame('E', body), { group: 'E', lenses, columnCount: paragraphs.length });
  let id = 0;
  const assembled = assembleLightboxGroup(decoded, {
    verifier: createLightboxQuoteVerifier(paragraphs),
    counter: createLightboxTermCounter(paragraphs),
    mintId: () => `lbt-e-${++id}`
  });
  return { decoded, assembled };
}

/** The assembled reading as a board group. */
export function storyGroup(body: StoryBody = storyBody(), paragraphs: readonly string[] = ALICE): LightboxReadingGroup {
  const { assembled } = readStory(body, paragraphs);
  return {
    group: 'E',
    status: 'ok',
    lenses: [...STORY_LENSES],
    tiles: assembled.tiles,
    withheldBlocks: assembled.withheldBlocks,
    withheldClaims: assembled.withheldClaims,
    frictions: assembled.frictions,
    quoteChecks: assembled.quoteChecks
  };
}

export function tilesOf<K extends LightboxReadingTile['kind']>(
  group: { tiles: readonly LightboxReadingTile[] },
  kind: K
): Array<Extract<LightboxReadingTile, { kind: K }>> {
  return group.tiles.filter((tile): tile is Extract<LightboxReadingTile, { kind: K }> => tile.kind === kind);
}
/* eslint-enable @typescript-eslint/no-explicit-any */
