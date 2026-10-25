/**
 * Asks, not gates (Slice 4H, epic decision 37), across the codec families
 * of groups A–E: a field longer than its prompt asks for, and a list with
 * more items than asked, are read and drawn; a list shorter than its stated
 * minimum, a value outside its vocabulary, a missing field, a structural
 * rule and a quote the verifier cannot find still withhold; and the one
 * safety ceiling clips a runaway field with an ellipsis and counts it.
 * Groups F and G are held to the same in `LightboxOpinionReadings.test.ts`
 * and `LightboxSteeringReadings.test.ts`.
 *
 * Every body is a worked example's (the opening of "Alice's Adventures in
 * Wonderland", Lewis Carroll, 1865, public domain), lengthened with
 * sentences written for these tests.
 */
import type { LightboxLensId, LightboxReadingGroupId } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { LIGHTBOX_ELLIPSIS } from '@shared/constants/lightboxClip';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
import { frame, framedJson, readWorkedExample } from './lightboxReadingFixtures';

/* eslint-disable @typescript-eslint/no-explicit-any -- reading bodies are edited as plain JSON. */
type Body = Record<string, any>;

const B = PROMPT_BUDGETS.lightbox;
const LONGER = ' The reading holds across the chapter as a whole, from its opening lines to its close, and it returns to the same few images.';

/** `text` lengthened past `ask` characters with sentences that keep every text rule. */
const past = (text: string, ask: number): string => {
  let out = text;
  while (out.length <= ask) {
    out += LONGER;
  }
  return out;
};

const bodyOf = (group: LightboxReadingGroupId): Body => framedJson(readWorkedExample(group).response) as Body;

function read(group: LightboxReadingGroupId, body: Body, lenses: LightboxLensId[] = readWorkedExample(group).lenses) {
  const paragraphs = readWorkedExample(group).paragraphs;
  const decoded = decodeLightboxGroup(frame(group, body), { group, lenses, columnCount: paragraphs.length });
  let id = 0;
  const assembled = assembleLightboxGroup(decoded, {
    verifier: createLightboxQuoteVerifier(paragraphs),
    counter: createLightboxTermCounter(paragraphs),
    mintId: () => `t${++id}`
  });
  return { decoded, assembled };
}

/** Everything withheld, by block, item and claim: nothing, when only asks were overrun. */
function withheldOf(result: ReturnType<typeof read>) {
  const malformed = result.decoded.blocks.flatMap((block) => {
    if (!('malformed' in block)) {
      return [];
    }
    const lists = Array.isArray(block.malformed) ? [block.malformed] : Object.values(block.malformed);
    return lists.flat();
  });
  return {
    blocks: result.decoded.withheld,
    items: malformed,
    claims: result.assembled.withheldClaims.map((claim) => [claim.title, claim.reason])
  };
}

const NOTHING = { blocks: [], items: [], claims: [] };
const kinds = (result: ReturnType<typeof read>, kind: string) => result.assembled.tiles.filter((tile) => tile.kind === kind);

describe('an overrun is shown, never withheld (Slice 4H)', () => {
  it('group A: a long headline, motif, peak note, metaphor and swatch note, and more motifs, peaks and quotes than asked', () => {
    const body = bodyOf('A');
    body.headline.sentence = past(body.headline.sentence, B.noteCharacters);
    const [first, , third] = body.motifs.items;
    first.claim = past(first.claim, B.claimCharacters);
    first.gist = past(first.gist, B.noteCharacters);
    first.title = past(first.title, B.labelCharacters);
    first.evidence = [...first.evidence, first.evidence[0]];
    body.motifs.items.push({ ...first, title: 'Going down, again' }, { ...third, title: 'Pictures, once more' });
    body.tension.peaks = [...body.tension.peaks, ...body.tension.peaks];
    body.tension.peaks[0] = { ...body.tension.peaks[0], note: past(body.tension.peaks[0].note, B.noteCharacters) };
    body.tension.friction = past(body.tension.friction, B.frictionCharacters);
    body.gravity.fields[0].metaphor = past(body.gravity.fields[0].metaphor, B.noteCharacters);
    body.palette.swatches[0].note = past(body.palette.swatches[0].note, B.noteCharacters);
    expect(body.motifs.items.length).toBeGreaterThan(B.motifs);
    expect(body.tension.peaks.length).toBeGreaterThan(B.tensionPeaks);
    expect(first.evidence.length).toBeGreaterThan(B.quotesPerClaim);

    const result = read('A', body);
    expect(withheldOf(result)).toEqual(NOTHING);
    expect(kinds(result, 'headline')[0].claim).toBe(body.headline.sentence);
    expect(kinds(result, 'motif').map((tile) => tile.title).sort()).toEqual([
      first.title, 'Going down, again', 'Hurry and leisure', 'Pictures and conversations', 'Pictures, once more'
    ].sort());
    expect(kinds(result, 'motif').find((tile) => tile.title === first.title)?.claim).toBe(first.claim);
    const block = result.decoded.blocks.find((candidate) => candidate.lens === 'tension');
    expect(block?.lens === 'tension' && block.peaks.length).toBe(4);
    expect(kinds(result, 'tension-arc')).toHaveLength(1);
    expect(result.decoded.report?.clipped).toBe(0);
  });

  it('group B: a long trait, energy and meaning, and more said/meant pairs than asked', () => {
    const body = bodyOf('B');
    body.characters.items[0].energy = past(body.characters.items[0].energy, B.noteCharacters);
    body.voice.pov = past(body.voice.pov, B.noteCharacters);
    body.voice.claim = past(body.voice.claim, B.claimCharacters);
    body.subtext.items[0].meant = past(body.subtext.items[0].meant, B.noteCharacters);
    body.subtext.items = [...body.subtext.items, ...body.subtext.items.slice(0, 2)];
    expect(body.subtext.items.length).toBeGreaterThan(B.subtextPairs);

    const result = read('B', body);
    expect(withheldOf(result)).toEqual(NOTHING);
    expect(kinds(result, 'subtext')).toHaveLength(5);
    const voice = kinds(result, 'voice')[0];
    expect(voice.claim).toBe(body.voice.claim);
    expect(voice.kind === 'voice' && voice.traits[0].value).toBe(body.voice.pov);
  });

  it('group C: more neighbors and sparks than asked, a long claim, and a spark question past its ask', () => {
    const body = bodyOf('C');
    const [, second, third] = body.genre.neighbors;
    body.genre.neighbors.push({ ...second, genre: 'Dream-vision allegory' }, { ...third, genre: 'Comic fable' });
    body.genre.neighbors[0].claim = past(body.genre.neighbors[0].claim, B.claimCharacters);
    body.lineage.items[0].claim = past(body.lineage.items[0].claim, B.claimCharacters);
    let question = body.spark.items[0].question as string;
    while (question.length <= B.sparkCharacters) {
      question = `Across the whole chapter, and in each scene where it returns, ${question}`;
    }
    body.spark.items[0].question = question;
    body.spark.items.push({ ...body.spark.items[1], title: 'The door again' }, { ...body.spark.items[2], title: 'One more door' });
    expect(body.genre.neighbors.length).toBeGreaterThan(B.genreNeighbors);
    expect(body.spark.items.length).toBeGreaterThan(B.sparks);

    const result = read('C', body);
    expect(withheldOf(result)).toEqual(NOTHING);
    expect(kinds(result, 'genre-neighbor')).toHaveLength(6);
    expect(kinds(result, 'spark')).toHaveLength(5);
    expect(kinds(result, 'spark')[0].claim).toBe(question);
  });

  it('group D: more echoes and handoffs than asked, and a long economy note, signature note and movement', () => {
    const body = bodyOf('D');
    const lenses: LightboxLensId[] = ['stock', 'rhythm'];
    const echo = body.stock.echoes[0];
    body.stock.echoes.push({ ...echo, title: 'A proverb’s turn, again' }, { ...echo, title: 'A third turn' }, { ...echo, title: 'A fourth turn' });
    body.stock.economy.note = past(body.stock.economy.note, B.claimCharacters);
    body.stock.signature[0].note = past(body.stock.signature[0].note, B.noteCharacters);
    body.rhythm.movement = past(body.rhythm.movement, B.claimCharacters);
    body.rhythm.handoffs.push(body.rhythm.handoffs[0]);
    expect(body.stock.echoes.length).toBeGreaterThan(B.echoes);
    expect(body.rhythm.handoffs.length).toBeGreaterThan(B.handoffs);

    const result = read('D', { version: 1, stock: body.stock, rhythm: body.rhythm }, lenses);
    expect(withheldOf(result)).toEqual(NOTHING);
    expect(kinds(result, 'echo')).toHaveLength(4);
    expect(kinds(result, 'handoff')).toHaveLength(4);
    expect(kinds(result, 'rhythm-endings')[0].claim).toBe(body.rhythm.movement);
  });

  it('group E: the writer\'s case, a freshness note past 120 characters, with more beats and threads than asked', () => {
    const body = bodyOf('E');
    // "template.freshness.note must be a string of at most 120 characters" withheld the whole template block before.
    body.template.freshness.note = past(body.template.freshness.note, 121);
    expect(body.template.freshness.note.length).toBeGreaterThan(B.noteCharacters);
    body.template.description = past(body.template.description, B.claimCharacters);
    body.template.beats = [...body.template.beats, ...body.template.beats.slice(0, 2)];
    body.pressure.threads = [...body.pressure.threads, ...body.pressure.threads];
    body.summary.movements[0].gist = past(body.summary.movements[0].gist, B.noteCharacters);
    expect(body.template.beats.length).toBeGreaterThan(B.templateBeats);
    expect(body.pressure.threads.length).toBeGreaterThan(B.pressureThreads);

    const result = read('E', body);
    expect(withheldOf(result)).toEqual(NOTHING);
    const template = kinds(result, 'template')[0];
    expect(template.kind === 'template' && template.freshness.note).toBe(body.template.freshness.note);
    expect(template.claim).toBe(body.template.description);
    expect(kinds(result, 'template-beat')).toHaveLength(7);
    expect(kinds(result, 'pressure-thread')).toHaveLength(8);
  });
});

describe('a real fault still withholds (Slice 4H)', () => {
  it.each([
    ['a motif with fewer quotes than its minimum (A)', 'A', (body: Body) => { body.motifs.items[0].evidence = body.motifs.items[0].evidence.slice(0, 1); },
      { items: [{ title: 'Going down', reason: 'It broke the format: motifs.items[0].evidence must be an array of 2 or more quotes' }] }],
    ['a voice with no claim (B)', 'B', (body: Body) => { delete body.voice.claim; },
      { blocks: [{ lens: 'voice', reason: 'The voice block broke the format: voice is missing required field claim.' }] }],
    ['a stance outside its vocabulary (C)', 'C', (body: Body) => { body.lineage.items[0].stances[0].stance = 'mirrors'; },
      { items: [{ title: body0('C').lineage.items[0].title, reason: 'It broke the format: lineage.items[0].stances[0].stance must be matches, departs or subverts' }] }],
    ['a neighborhood of one (C)', 'C', (body: Body) => { body.genre.neighbors = body.genre.neighbors.slice(0, 1); },
      { blocks: [{ lens: 'genre', reason: 'The genre block broke the format: genre.neighbors must be an array of 2 or more neighbors' }] }],
    ['endings one short of the ribbon columns (D)', 'D', (body: Body) => { body.rhythm.endings = body.rhythm.endings.slice(1); },
      { blocks: [{ lens: 'rhythm', reason: 'The rhythm block broke the format: rhythm.endings must be an array containing exactly 8 endings, one per ribbon column' }] }],
    ['a freshness outside its scale (E)', 'E', (body: Body) => { body.template.freshness.level = 'novel'; },
      { blocks: [{ lens: 'template', reason: 'The template block broke the format: template.freshness.level must be familiar, mixed or fresh' }] }]
  ])('withholds %s', (_case, group, breakIt, expected) => {
    const body = bodyOf(group as LightboxReadingGroupId);
    breakIt(body);
    const lenses = group === 'D' ? ['stock', 'rhythm'] as LightboxLensId[] : undefined;
    const withheld = withheldOf(read(group as LightboxReadingGroupId, group === 'D' ? { version: 1, stock: body.stock, rhythm: body.rhythm } : body, lenses));
    // An item the codec withholds is also shown among the withheld claims, by its title: compare what the codec withheld.
    expect({ blocks: withheld.blocks, items: withheld.items }).toEqual({ blocks: [], items: [], ...expected });
  });

  it('withholds a claim whose quote is not in the chapter, however long the claim', () => {
    const body = bodyOf('A');
    body.headline.sentence = past(body.headline.sentence, B.noteCharacters);
    body.headline.evidence = [{ para: 2, quote: 'a line the chapter never holds' }];
    const result = read('A', body);
    expect(result.assembled.withheldClaims.map((claim) => [claim.kind, claim.reason])).toEqual([
      ['headline', expect.stringContaining('No quote')]
    ]);
  });

  it('withholds a synopsis with fewer than two quotes, and movements that no longer tile the chapter (E)', () => {
    const body = bodyOf('E');
    body.summary.synopsis.evidence = body.summary.synopsis.evidence.slice(0, 1);
    body.summary.movements[1].from += 1;
    const claims = read('E', body).assembled.withheldClaims.map((claim) => [claim.kind, claim.reason]);
    expect(claims).toEqual(expect.arrayContaining([
      ['synopsis', 'It broke the format: summary.synopsis.evidence must be an array of 2 or more quotes'],
      ['movement', expect.stringMatching(/movement|tile/i)]
    ]));
  });
});

describe('the one safety ceiling clips a runaway field, never withholds it (Slice 4H)', () => {
  it('clips a field past eight times its ask with an ellipsis, counts it, and draws the tile', () => {
    const body = bodyOf('A');
    const runaway = past('A girl follows a rabbit.', B.noteCharacters * B.safetyMultiple);
    body.headline.sentence = runaway;
    body.motifs.items[0].claim = past(body.motifs.items[0].claim, B.claimCharacters * B.safetyMultiple);
    const result = read('A', body);
    expect(result.decoded.report?.clipped).toBe(2);
    expect(withheldOf(result)).toEqual(NOTHING);
    const headline = kinds(result, 'headline')[0].claim;
    expect(headline.length).toBeLessThanOrEqual(B.noteCharacters * B.safetyMultiple);
    expect(headline.endsWith(LIGHTBOX_ELLIPSIS)).toBe(true);
    expect(runaway.startsWith(headline.slice(0, -1).trimEnd())).toBe(true);
    // Up to the ceiling, a field is whole.
    const whole = bodyOf('A');
    whole.headline.sentence = runaway.slice(0, B.noteCharacters * B.safetyMultiple);
    expect(read('A', whole).decoded.report?.clipped).toBe(0);
  });
});

function body0(group: LightboxReadingGroupId): Body {
  return bodyOf(group);
}
