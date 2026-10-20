/**
 * The Lightbox prompt bundle states the ceilings and rules the codec enforces
 * (ADR 2026-10-19 D7, D8). Each phrase is built from `PROMPT_BUDGETS.lightbox`
 * or the codec's protocol constants, so changing a number without changing
 * the prompt (or the reverse) fails here.
 */
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  LIGHTBOX_MINIMUM_GENRE_NEIGHBORS,
  LIGHTBOX_NEAR_MISS_AFFINITY,
  LIGHTBOX_TENSION_TOP_SCORE
} from '@/infrastructure/lightbox/LightboxReadingWire';
import { LIGHTBOX_PROMPT_FILES } from '@/infrastructure/lightbox/LightboxReadingPrompts';
import { LIGHTBOX_GRAVITY_LINE_HITS } from '@shared/constants/lightbox';
import { readLightboxPrompt } from '@/__tests__/infrastructure/lightbox/lightboxReadingFixtures';

const B = PROMPT_BUDGETS.lightbox;
const n = (value: number): string => value.toLocaleString('en-US');

const shared = readLightboxPrompt(LIGHTBOX_PROMPT_FILES.shared);
const lens = (id: keyof typeof LIGHTBOX_PROMPT_FILES.lenses): string => readLightboxPrompt(LIGHTBOX_PROMPT_FILES.lenses[id]);

describe('Lightbox prompt bundle ↔ PROMPT_BUDGETS.lightbox', () => {
  it('states the shared ceilings', () => {
    expect(shared).toContain(`never more than ${n(B.quoteCharacters)} characters`);
    expect(shared).toContain(`Give each claim at most ${B.quotesPerClaim} quotes`);
    expect(shared).toContain(`at most ${B.termsPerClaim} per claim and at most ${B.labelCharacters} characters each`);
    expect(shared).toContain(`one to three sentences, at most ${n(B.frictionCharacters)} characters`);
    expect(shared).toContain(`The whole response stays under ${n(B.groupResponseCharacters)} characters.`);
  });

  it('states each lens\'s field ceilings and counts', () => {
    expect(lens('headline')).toContain(`one sentence, at most ${B.noteCharacters} characters`);
    expect(lens('headline')).toContain(`\`terms\`: 1–${B.termsPerClaim} words`);
    expect(lens('headline')).toContain(`\`evidence\`: 1–${B.quotesPerClaim} quotes`);

    expect(lens('motif')).toContain(`\`items\`: 0–${B.motifs} motifs`);
    expect(lens('motif')).toContain(`each needs 2–${B.quotesPerClaim} quotes from at least two different paragraphs`);
    expect(lens('motif')).toContain(`\`title\`: at most ${B.labelCharacters} characters`);
    expect(lens('motif')).toContain(`\`gist\`: one line, at most ${B.noteCharacters} characters`);
    expect(lens('motif')).toContain(`\`claim\`: at most ${B.claimCharacters} characters`);

    expect(lens('tension')).toContain(`one whole number from 0 to ${LIGHTBOX_TENSION_TOP_SCORE} for each ribbon column`);
    expect(lens('tension')).toContain(`\`claim\`: at most ${B.claimCharacters} characters`);
    expect(lens('tension')).toContain(`\`peaks\`: 1–${B.tensionPeaks} moments`);
    expect(lens('tension')).toContain(`a \`note\` of at most ${B.noteCharacters} characters`);

    expect(lens('characters')).toContain(`\`items\`: 0–${B.characters} characters`);
    expect(lens('characters')).toContain(`\`name\`: at most ${B.labelCharacters} characters`);
    expect(lens('characters')).toContain(`\`archetype\`: at most ${B.labelCharacters} characters`);
    expect(lens('characters')).toContain(`one line each, at most ${B.noteCharacters} characters`);
    expect(lens('characters')).toContain(`\`claim\`: at most ${B.claimCharacters} characters; \`evidence\`: 1–${B.quotesPerClaim} quotes`);

    expect(lens('voice')).toContain(`one line each, at most ${B.noteCharacters} characters`);
    expect(lens('voice')).toContain(`\`claim\`: at most ${B.claimCharacters} characters`);

    expect(lens('genre')).toContain(`\`neighbors\`: ${LIGHTBOX_MINIMUM_GENRE_NEIGHBORS}–${B.genreNeighbors} shelves`);
    expect(lens('genre')).toContain(`\`genre\`: at most ${B.labelCharacters} characters`);
    expect(lens('genre')).toContain(`At least one neighbor sits at ${LIGHTBOX_NEAR_MISS_AFFINITY.toFixed(2)} or below`);
    expect(lens('genre')).toContain(`one line of at most ${B.noteCharacters} characters`);
    expect(lens('genre')).toContain(`\`claim\`: at most ${B.claimCharacters} characters; \`evidence\`: 1–${B.quotesPerClaim} quotes per neighbor`);
  });

  it('states gravity\'s and the palette\'s ceilings, and the gravity line (Slice 3)', () => {
    expect(lens('gravity')).toContain(`\`fields\`: 0–${B.gravityFields} borrowed fields`);
    expect(lens('gravity')).toContain(`\`name\`: at most ${B.labelCharacters} characters`);
    expect(lens('gravity')).toContain(`one line of at most ${B.noteCharacters} characters: what the chapter is seen as`);
    expect(lens('gravity')).toContain(`a field with fewer than ${LIGHTBOX_GRAVITY_LINE_HITS} hits is drawn below the gravity line`);
    expect(lens('gravity')).toContain(`\`terms\`: 1–${B.gravityTerms} words or short phrases`);
    expect(lens('gravity')).toContain(`\`claim\`: at most ${B.claimCharacters} characters: what the borrowing does`);
    expect(lens('gravity')).toContain(`\`evidence\`: 1–${B.quotesPerClaim} quotes where the field is at work`);
    expect(lens('gravity')).toContain(`\`collisions\`: 0–${B.gravityCollisions} places`);
    expect(lens('gravity')).toContain(`\`literal\`: required, 1–${B.gravityLiterals} fields`);
    expect(lens('gravity')).toContain(`1–${B.termsPerClaim} \`terms\` the host counts, and 1–${B.quotesPerClaim} quotes`);

    expect(lens('palette')).toContain(`\`clusters\`: 0–${B.paletteClusters} diction clusters`);
    expect(lens('palette')).toContain(`\`words\`: 2–${B.clusterWords} words exactly as they stand`);
    expect(lens('palette')).toContain(`\`claim\`: at most ${B.claimCharacters} characters`);
    expect(lens('palette')).toContain(`\`swatches\`: 0–${B.swatches} colors the text names`);
    expect(lens('palette')).toContain(`\`words\`: 1–${B.swatchWords} color words`);
    expect(lens('palette')).toContain(`\`note\`: one line of at most ${B.noteCharacters} characters`);
    expect(lens('palette')).toContain(`\`evidence\`: 1–${B.quotesPerClaim} quotes`);
  });

  it('states subtext\'s, lineage\'s and Spark\'s ceilings (Slice 4)', () => {
    expect(lens('subtext')).toContain(`\`items\`: 0–${B.subtextPairs} said/meant pairs`);
    expect(lens('subtext')).toContain(`\`speaker\`: at most ${B.labelCharacters} characters`);
    expect(lens('subtext')).toContain(`\`meant\`: one line of at most ${B.noteCharacters} characters`);
    expect(lens('subtext')).toContain(`\`evidence\`: 0–${B.subtextContextQuotes} more quotes`);

    expect(lens('lineage')).toContain(`\`items\`: 0–${B.lineageStories} adjacent stories`);
    expect(lens('lineage')).toContain(`\`title\`: at most ${B.labelCharacters} characters`);
    expect(lens('lineage')).toContain(`\`source\`: at most ${B.labelCharacters} characters`);
    expect(lens('lineage')).toContain(`\`stances\`: 1–${B.lineageStances} ways the chapter stands to the story`);
    expect(lens('lineage')).toContain(`a \`note\`, one line of at most ${B.noteCharacters} characters`);
    expect(lens('lineage')).toContain(`\`claim\`: at most ${B.claimCharacters} characters`);
    expect(lens('lineage')).toContain(`\`evidence\`: 1–${B.quotesPerClaim} quotes`);
    expect(lens('lineage')).toContain(
      `\`setAside\`: required, 0–${B.lineageSetAsides} stories you checked and set aside, each with a \`title\` of at most ` +
        `${B.labelCharacters} characters and a \`reason\` of one line of at most ${B.noteCharacters} characters`
    );
    expect(lens('lineage')).toContain('Only these three words are stances: any other withholds the story.');

    expect(lens('spark')).toContain(`\`items\`: 0–${B.sparks} sparks`);
    expect(lens('spark')).toContain(`\`title\`: at most ${B.labelCharacters} characters`);
    expect(lens('spark')).toContain(`\`question\`: at most ${B.sparkCharacters} characters, ending with a question mark`);
    expect(lens('spark')).toContain(`\`terms\`: 1–${B.termsPerClaim} words or short phrases`);
    expect(lens('spark')).toContain(`\`evidence\`: 1–${B.quotesPerClaim} quotes`);
  });
});
