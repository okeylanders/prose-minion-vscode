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
  LIGHTBOX_STOCK_MINIMUM_BEATS,
  LIGHTBOX_TENSION_TOP_SCORE
} from '@/infrastructure/lightbox/LightboxReadingWire';
import { LIGHTBOX_PROMPT_FILES } from '@/infrastructure/lightbox/LightboxReadingPrompts';
import { LIGHTBOX_GRAVITY_LINE_HITS } from '@shared/constants/lightbox';
import { LIGHTBOX_UNUSED_REACH } from '@shared/constants/lightboxPlot';
import { LIGHTBOX_MOVEMENT_ID, LIGHTBOX_SYNOPSIS_MINIMUM_QUOTES } from '@/infrastructure/lightbox/LightboxPlotWire';
import {
  LIGHTBOX_OPINION_MINIMUM_OBSERVATIONS,
  LIGHTBOX_OPINION_OBSERVATION_ID
} from '@/infrastructure/lightbox/LightboxOpinionWire';
import { LIGHTBOX_OPINION_REWRITE_WORDS, LIGHTBOX_OPINION_WRITER_WORDS } from '@/infrastructure/lightbox/LightboxOpinionPhrasing';
import { LIGHTBOX_STEERING_FORBIDDEN_WORDS } from '@/infrastructure/lightbox/LightboxSteeringPhrasing';
import { LIGHTBOX_STEERING_STANCES } from '@/infrastructure/lightbox/LightboxSteeringWire';
import {
  LIGHTBOX_NUMBERS_READ_STATS,
  LIGHTBOX_STEERING_EXAMPLE_LABEL,
  LIGHTBOX_STEERING_STATS
} from '@shared/constants/lightboxSteering';
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

  it('states the craft lenses\' ceilings (Slice 4B)', () => {
    const stock = lens('stock');
    expect(stock).toContain(`\`beats\`: 0–${B.stockBeats} beats`);
    expect(stock).toContain(`With fewer than ${LIGHTBOX_STOCK_MINIMUM_BEATS} beats found, no mix is drawn.`);
    expect(stock).toContain(`\`note\`: at most ${B.claimCharacters} characters`);
    expect(stock).toContain(`\`signature\`: 0–${B.signaturePhrases} signature phrases`);
    expect(stock).toContain(`\`familiar\`: 0–${B.familiarPhrases} familiar phrases`);
    expect(stock).toContain(`\`phrase\`: at most ${B.labelCharacters} characters`);
    expect(stock).toContain(`\`airLocks\`: 0–${B.airLocks} air-lock passages`);
    expect(stock).toContain(`\`echoes\`: 0–${B.echoes} aphoristic lines`);
    expect(stock).toContain(`\`reminiscentOf\`, at most ${B.labelCharacters} characters`);
    expect(stock).toContain(`a \`title\` of at most ${B.labelCharacters} characters, a \`note\` of one line of at most ${B.noteCharacters} characters`);
    expect(stock).toContain(`\`evidence\`: 1–${B.quotesPerClaim} quotes`);

    const rhythm = lens('rhythm');
    expect(rhythm).toContain('`endings`: exactly one ending for each ribbon column, in column order.');
    expect(rhythm).toContain(`\`movement\`: at most ${B.claimCharacters} characters`);
    expect(rhythm).toContain(`\`evidence\`: 1–${B.quotesPerClaim} quotes for \`movement\``);
    expect(rhythm).toContain(`\`handoffs\`: 0–${B.handoffs} samples`);
    expect(rhythm).toContain(`\`carried\`: one line of at most ${B.noteCharacters} characters`);
    expect(rhythm).toContain(`\`changes\`: one line of at most ${B.noteCharacters} characters`);

    const numbers = lens('numbers');
    expect(numbers).toContain(`\`items\`: 0–${B.numberReadings} readings, at most one per figure`);
    expect(numbers).toContain(`\`claim\`: at most ${B.claimCharacters} characters`);
    expect(numbers).toContain(`\`evidence\`: 1–${B.quotesPerClaim} quotes, each holding an instance of its figure`);
  });
  it('states the story lenses\' ceilings and rules (Slice 4C)', () => {
    const template = lens('template');
    expect(template).toContain(`\`name\`: at most ${B.labelCharacters} characters`);
    expect(template).toContain(`\`description\`: at most ${B.claimCharacters} characters`);
    expect(template).toContain(`\`evidence\`: 1–${B.quotesPerClaim} quotes where the template shows`);
    expect(template).toContain(`\`beats\`: 0–${B.templateBeats} beats where the chapter meets its template`);
    expect(template).toContain(`a \`note\` of one line of at most ${B.noteCharacters} characters`);
    expect(template).toContain('`level` is `familiar`, `mixed` or `fresh`');
    expect(template).toContain(`\`note\` is one line of at most ${B.noteCharacters} characters`);
    expect(template).toContain('It is a reading, not a grade');
    expect(template).toContain('give exactly one entry for each movement the summary block draws');

    const pressure = lens('pressure');
    expect(pressure).toContain(`\`threads\`: 0–${B.pressureThreads} threads`);
    expect(pressure).toContain(`\`question\`: one line of at most ${B.noteCharacters} characters`);
    expect(pressure).toContain(`\`escalations\`: 0–${B.threadEscalations} quotes where it builds`);
    expect(pressure).toContain('A dormant thread with a later quote is withheld.');

    const artifacts = lens('artifacts');
    expect(artifacts).toContain(`\`objects\`: 0–${B.artifacts} objects`);
    expect(artifacts).toContain(`\`name\`: at most ${B.labelCharacters} characters`);
    expect(artifacts).toContain(`\`terms\`: 1–${B.termsPerClaim} words or short phrases`);
    expect(artifacts).toContain(`\`arc\`: 1–${B.artifactSteps} steps, in paragraph order, each a \`step\` of at most ${B.labelCharacters} characters`);
    expect(artifacts).toContain(`every mention and every step stands within ${LIGHTBOX_UNUSED_REACH} paragraphs of its first`);

    const summary = lens('summary');
    expect(summary).toContain(
      `\`text\` is at most ${B.claimCharacters} characters and at most ${B.synopsisSentences} sentences; ` +
        `\`evidence\` is ${LIGHTBOX_SYNOPSIS_MINIMUM_QUOTES}–${B.synopsisQuotes} quotes from different moments, ` +
        `and at least ${LIGHTBOX_SYNOPSIS_MINIMUM_QUOTES} must be found`
    );
    expect(summary).toContain(`\`movements\`: 1–${B.movements} movements, in order`);
    expect(summary).toContain('`id`: a short key of 1 to 12 letters, digits or hyphens');
    expect([LIGHTBOX_MOVEMENT_ID.test('a'.repeat(12)), LIGHTBOX_MOVEMENT_ID.test('a'.repeat(13)), LIGHTBOX_MOVEMENT_ID.test('')])
      .toEqual([true, false, false]);
    expect(summary).toContain(`\`title\`: at most ${B.labelCharacters} characters`);
    expect(summary).toContain(`\`gist\`: one line of at most ${B.noteCharacters} characters`);
    expect(summary).toContain('If any of that fails, every movement is withheld');
  });

  it('states craft steering\'s ceilings and rules, and the numbers lens leaves its figures alone (Slice 4F)', () => {
    const steering = lens('steering');
    expect(steering).toContain(`\`figures\`: 0–${LIGHTBOX_STEERING_STATS.length}, at most one per figure`);
    for (const stat of LIGHTBOX_STEERING_STATS) {
      expect(steering).toContain(`(\`${stat}\`)`);
    }
    expect(steering).toContain(`\`claim\`: at most ${B.claimCharacters} characters`);
    expect(steering).toContain(`\`evidence\`: 1–${B.quotesPerClaim} quotes for the claim`);
    expect(steering).toContain(`\`notes\`: 0–${B.steeringNotes} instance notes per figure`);
    expect(steering).toContain(`\`why\`: one line of at most ${B.steeringWhyCharacters} characters`);
    expect(steering).toContain(`\`nudge\`: for \`leans\` and \`compensates\`, at most ${B.steeringNudgeCharacters} characters`);
    expect(steering).toContain(
      `at most ${B.steeringExampleBeforeWords} words and ${B.steeringExampleCharacters} characters; \`after\` is one way the move could go, ` +
        `at most ${B.steeringExampleAfterWords} words and ${B.steeringExampleCharacters} characters`
    );
    expect(steering).toContain(`the board labels it "${LIGHTBOX_STEERING_EXAMPLE_LABEL}"`);
    expect(steering).toContain('`stance`: exactly one of `earns`');
    for (const stance of LIGHTBOX_STEERING_STANCES) {
      expect(steering).toContain(`\`${stance}\` (`);
    }
    // Every word the codec withholds is one the prompt names, in the codec's order.
    expect(steering).toContain(`Words this lens never uses, in any field: ${LIGHTBOX_STEERING_FORBIDDEN_WORDS.join(', ')}.`);
    expect(shared).toContain('`B`, `C`, `D`, `E` or `G`');
    // The numbers lens reads only the figures craft steering leaves it.
    expect(lens('numbers')).toContain('Being verbs, adverbs and intensifiers are read by craft steering, never here');
    expect(LIGHTBOX_NUMBERS_READ_STATS).toEqual(['sentence-length', 'dialogue', 'passive-voice']);
  });

  it('states the Opinion\'s ceilings and rules (Slice 4D)', () => {
    const opinion = lens('opinion');
    expect(opinion).toContain(`and up to ${B.opinionQuotesPerItem} of its quotes, numbered \`q0\`, \`q1\`, \`q2\``);
    expect(B.opinionQuotesPerItem).toBe(3);
    expect(opinion).toContain(`\`observations\`: ${LIGHTBOX_OPINION_MINIMUM_OBSERVATIONS}–${B.opinionObservations} observations about the chapter`);
    expect(opinion).toContain(`\`id\`: \`O1\` to \`O${B.opinionObservations}\`, each used once.`);
    expect([
      LIGHTBOX_OPINION_OBSERVATION_ID.test('O1'),
      LIGHTBOX_OPINION_OBSERVATION_ID.test(`O${B.opinionObservations}`),
      LIGHTBOX_OPINION_OBSERVATION_ID.test(`O${B.opinionObservations + 1}`),
      LIGHTBOX_OPINION_OBSERVATION_ID.test('O0')
    ]).toEqual([true, true, false, false]);
    expect(opinion).toContain(`\`text\`: one sentence, at most ${B.opinionObservationCharacters} characters`);
    expect(opinion).toContain(`\`cites\`: 1–${B.opinionCitesPerObservation} board items the observation stands on`);
    expect(opinion).toContain(`\`headline\`: one sentence, at most ${B.opinionHeadlineCharacters} characters`);
    expect(opinion).toContain(`\`body\`: a short paragraph, at most ${B.opinionBodyCharacters} characters`);
    expect(opinion).toContain(
      `\`why\`: 1–${B.opinionWhyPoints} points. Each has a \`weight\`, \`strength\`, \`even\` or \`concern\`; ` +
        `a \`text\` of at most ${B.opinionWhyCharacters} characters; and \`observations\`: the 1–${B.opinionCitesPerObservation} observation ids it weighs.`
    );
    expect(opinion).toContain(`\`friction\`: one to three sentences, at most ${n(B.frictionCharacters)} characters`);
    expect(opinion).toContain(`The whole response stays under ${n(B.groupResponseCharacters)} characters.`);
    // Every word the rewrite check withholds is one the prompt forbids, or a form of one.
    for (const word of ['should', 'must', 'try', 'consider', 'cut', 'trim', 'tighten', 'shorten', 'rewrite', 'replace', 'remove', 'fix', 'needs to']) {
      expect(LIGHTBOX_OPINION_REWRITE_WORDS).toContain(word);
      expect(opinion).toContain(`"${word}"`);
    }
    for (const word of ['you', 'your', 'the writer', 'the author']) {
      expect(LIGHTBOX_OPINION_WRITER_WORDS).toContain(word);
      expect(opinion).toContain(`"${word}"`);
    }
  });
});
