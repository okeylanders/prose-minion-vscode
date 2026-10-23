/**
 * Group E's rules, fresh (ADR 2026-10-19 D7 and its 2026-10-20 addendum;
 * Slice 4C), through the production codec, verifier, counter and assembly:
 * - the codec: strict objects whose undefined fields are counted, never
 *   named; friction required; closed vocabularies; a dormant thread with a
 *   later quote; a synopsis or an engagement list that breaks the format
 *   withholding itself alone;
 * - the movements as a set: contiguous, a gap, an overlap, not covering,
 *   not from ¶1, a boundary in the wrong paragraph, a malformed movement,
 *   a repeated id, each withholding the set whole by the rule it broke;
 * - engagement: one level per drawn movement by its id, or withheld;
 *   naming a movement not drawn; the summary not read in the call;
 * - pressure: the plant and resolution found, paragraph order, an
 *   escalation dropped when not found, the host's span;
 * - artifacts: counted by the gravity lens's counter, an object none of
 *   whose terms is in the chapter, an arc step out of order, "planted,
 *   unused" kept only when the counts bear it out.
 * The text is the worked example's ¶1–¶8 of "Alice's Adventures in
 * Wonderland" (1865, public domain).
 */
import type { LightboxWithheldClaim } from '@messages';
import { LIGHTBOX_PLOT_GATE_REASONS } from '@/infrastructure/lightbox/LightboxPlotGates';
import { LIGHTBOX_GATE_REASONS } from '@/infrastructure/lightbox/LightboxTileGates';
import { LIGHTBOX_UNUSED_REACH } from '@shared/constants/lightboxPlot';
import { ALICE, readStory, storyBody, tilesOf, type StoryBody } from './lightboxPlotFixtures';

const R = LIGHTBOX_PLOT_GATE_REASONS;
const claimsOf = (claims: readonly LightboxWithheldClaim[], kind: string) =>
  claims.filter((claim) => claim.kind === kind).map((claim) => [claim.title, claim.reason]);

describe('group E, read fresh (Slice 4C)', () => {
  it('reads the worked example into a template with its beats, threads, objects, a synopsis and three movements', () => {
    const { assembled } = readStory();
    expect(assembled.withheldClaims).toEqual([]);
    expect(assembled.withheldBlocks).toEqual([]);
    const [template] = tilesOf(assembled, 'template');
    expect(template).toMatchObject({ title: 'Portal descent', freshness: { level: 'fresh' } });
    expect(tilesOf(assembled, 'template-beat').map((beat) => beat.stance)).toEqual(['departs', 'aligns', 'aligns', 'subverts', 'subverts']);
    const movements = tilesOf(assembled, 'movement');
    expect(movements.map((movement) => [movement.ordinal, movement.title, movement.from, movement.to])).toEqual([
      [1, 'The bank', 1, 3], [2, 'The chase', 4, 5], [3, 'The well', 6, 8]
    ]);
    // A movement lights its whole range, and its boundary leads its evidence, found in its first paragraph.
    expect(movements[1].paragraphs).toEqual([4, 5]);
    expect(movements.map((movement) => movement.boundary.paragraph)).toEqual([1, 4, 6]);
    // Engagement names the movements by the host's tile ids, never the reading's own keys.
    expect(template.engagement).toEqual([
      { movementId: movements[0].id, level: 'low' },
      { movementId: movements[1].id, level: 'high' },
      { movementId: movements[2].id, level: 'medium' }
    ]);
    expect(JSON.stringify(template.engagement)).not.toMatch(/"I"|"II"|"III"/);
    const [synopsis] = tilesOf(assembled, 'synopsis');
    expect(synopsis.evidence.map((quote) => quote.paragraph)).toEqual([3, 5, 7]);
  });

  it('counts each thread\'s span itself, and keeps the dormant one dormant', () => {
    const { assembled } = readStory();
    const threads = tilesOf(assembled, 'pressure-thread');
    expect(threads.map((thread) => [thread.span, thread.resolution?.paragraph ?? null, thread.dormant])).toEqual([
      [{ from: 4, to: 8 }, null, false],
      [{ from: 5, to: 8 }, null, true],
      [{ from: 6, to: 8 }, null, false],
      [{ from: 7, to: 7 }, 7, false]
    ]);
    expect(threads[0].paragraphs).toEqual([4, 5, 6, 7, 8]);
    expect(threads[0].escalations.map((quote) => quote.text)).toEqual(['TOOK A WATCH OUT OF ITS WAISTCOAT-POCKET']);
  });

  it('counts each object\'s mentions and first paragraph from its terms, and keeps "unused" only where the counts bear it out', () => {
    const { assembled } = readStory();
    const objects = tilesOf(assembled, 'artifact');
    expect(objects.map((object) => [object.title, object.mentions, object.firstParagraph, object.arc.length, object.plantedUnused])).toEqual([
      // "book-shelves" in ¶7 is one token, so the book stays in ¶2.
      ["Her sister's book", 2, 2, 2, true],
      ['The watch', 2, 4, 2, false],
      // The heading in ¶1 names the rabbit-hole before the chase does.
      ['The rabbit-hole', 3, 1, 2, false],
      ['The marmalade jar', 3, 7, 3, true]
    ]);
    expect(objects[3].support.map((term) => [term.term, term.count])).toEqual([['jar', 2], ['marmalade', 1]]);
    expect(objects[3].claim).toBe('taken down → found empty → put away');
  });

  describe('the codec', () => {
    it('counts a field the format does not define, never naming it, and withholds only that block', () => {
      const body = storyBody();
      body.template.score = 9;
      body.pressure.threads[0].urgency = 'high';
      const { decoded, assembled } = readStory(body);
      expect(decoded.withheld).toEqual([{ lens: 'template', reason: 'The template block broke the format: template has 1 field the format does not define.' }]);
      expect(JSON.stringify(decoded.withheld)).not.toContain('score');
      // The thread with an undefined field is withheld by its noun and position; its siblings stand.
      expect(claimsOf(assembled.withheldClaims, 'pressure-thread')).toEqual([
        ['Thread 1', 'It broke the format: pressure.threads[0] has 1 field the format does not define.']
      ]);
      expect(JSON.stringify(assembled.withheldClaims)).not.toContain('urgency');
      expect(tilesOf(assembled, 'pressure-thread')).toHaveLength(3);
      // The movements survive the template's loss; engagement goes with the template.
      expect(tilesOf(assembled, 'movement')).toHaveLength(3);
    });

    it('requires friction of every block', () => {
      const body = storyBody();
      delete body.artifacts.friction;
      const { decoded } = readStory(body);
      expect(decoded.withheld).toEqual([
        { lens: 'artifacts', reason: 'The artifacts block names no friction; every lens must say where it strains.' }
      ]);
    });

    it('holds stances, freshness and engagement to their vocabularies', () => {
      const body = storyBody();
      body.template.beats[1].stance = 'mirrors';
      const beat = readStory(body);
      expect(claimsOf(beat.assembled.withheldClaims, 'template-beat')).toEqual([
        ['Template beat 2', 'It broke the format: template.beats[1].stance must be aligns, subverts or departs']
      ]);
      const fresh = storyBody();
      fresh.template.freshness.level = 'great';
      expect(readStory(fresh).decoded.withheld.map((entry) => entry.lens)).toEqual(['template']);
      const level = storyBody();
      level.template.engagement[0].level = 'gripping';
      const engagement = readStory(level).assembled;
      // An engagement list that breaks the format withholds engagement alone; the template stands.
      expect(tilesOf(engagement, 'template')[0].engagement).toEqual([]);
      expect(claimsOf(engagement.withheldClaims, 'template')).toEqual([
        ['Engagement', 'It broke the format: template.engagement[0].level must be low, medium or high']
      ]);
    });

    it('withholds a dormant thread that gives a later quote: the flag is read, its consistency checked', () => {
      const body = storyBody();
      body.pressure.threads[1].escalations = [{ para: 6, quote: 'The rabbit-hole went straight on like a tunnel for some way' }];
      const { assembled } = readStory(body);
      expect(claimsOf(assembled.withheldClaims, 'pressure-thread')).toEqual([[
        'Thread 2',
        'It broke the format: A dormant thread is planted and never touched again, so it gives no escalation and no resolution; this one does.'
      ]]);
    });

    it('shows a synopsis past the sentences and characters asked, whole, beside its movements (Slice 4H)', () => {
      const body = storyBody();
      const text = 'She is bored. She sees a rabbit. It has a watch. She follows it. She falls. She falls a long way, past ' +
        'cupboards and shelves, maps and pictures, a jar of marmalade she takes down and puts back. She wonders where she ' +
        'will land, and whether she will come out among the people who walk with their heads downward. Then she thinks ' +
        'of her cat at home, and of whether cats eat bats, and the fall goes on, slowly, until she lands on a heap of sticks.';
      expect(text.length).toBeGreaterThan(400);
      body.summary.synopsis.text = text;
      const { assembled } = readStory(body);
      // Seven sentences and more characters than asked: a length or a count is an ask, never a reason to withhold.
      expect(claimsOf(assembled.withheldClaims, 'synopsis')).toEqual([]);
      expect(tilesOf(assembled, 'synopsis').map((tile) => tile.claim)).toEqual([text]);
      expect(tilesOf(assembled, 'movement')).toHaveLength(3);
    });
  });

  describe('the movements, as a set', () => {
    const withMovements = (edit: (movements: StoryBody[]) => void) => {
      const body = storyBody();
      edit(body.summary.movements);
      return readStory(body).assembled;
    };
    const setReason = (assembled: ReturnType<typeof withMovements>) => {
      expect(tilesOf(assembled, 'movement')).toEqual([]);
      // The synopsis stands on its own quotes.
      expect(tilesOf(assembled, 'synopsis')).toHaveLength(1);
      return claimsOf(assembled.withheldClaims, 'movement');
    };

    it('draws them in paragraph order however the reading lists them', () => {
      const assembled = withMovements((movements) => movements.reverse());
      expect(tilesOf(assembled, 'movement').map((movement) => [movement.ordinal, movement.from])).toEqual([[1, 1], [2, 4], [3, 6]]);
    });

    it('withholds the set for a gap, an overlap, a short cover, a late start, an empty range or a boundary out of its first paragraph', () => {
      expect(setReason(withMovements((movements) => { movements[1].to = 4; }))).toEqual([['Movements', R.gap]]);
      expect(setReason(withMovements((movements) => { movements[1].to = 6; }))).toEqual([['Movements', R.overlap]]);
      expect(setReason(withMovements((movements) => { movements[2].to = 7; }))).toEqual([['Movements', R.notToEnd]]);
      expect(setReason(withMovements((movements) => {
        movements[0].from = 2;
        movements[0].boundary = { para: 2, quote: 'Alice was beginning to get very tired' };
      }))).toEqual([['Movements', R.notFromStart.fresh]]);
      expect(setReason(withMovements((movements) => { movements[1].to = 3; }))).toEqual([['Movements', R.emptyRange.fresh]]);
      // A boundary found, but in another paragraph than the one its movement starts in.
      expect(setReason(withMovements((movements) => {
        movements[1].boundary = { para: 5, quote: 'In another moment down went Alice after it' };
      }))).toEqual([['Movements', R.boundaryNotFirst]]);
    });

    it('withholds the set when a boundary is not found, naming the quote that failed', () => {
      const assembled = withMovements((movements) => { movements[2].boundary.quote = 'and so she fell for a long time'; });
      expect(setReason(assembled)).toEqual([['Movements', R.boundaryGone.fresh]]);
      expect(assembled.withheldClaims.find((claim) => claim.kind === 'movement')?.quotes).toEqual([
        { paragraph: 6, reason: 'not-in-chapter' }
      ]);
    });

    it('withholds the set for a movement that broke the format, or two that share an id', () => {
      // The movement is withheld by its own title, as every lens's malformed item is, and the set with it.
      const malformed = withMovements((movements) => { movements[1].id = 'two words'; });
      expect(setReason(malformed)).toEqual([
        ['The chase', 'It broke the format: summary.movements[1].id must be a movement id: 1 to 12 letters, digits or hyphens'],
        ['Movements', R.movementMalformed]
      ]);
      const twice = withMovements((movements) => { movements[2].id = 'ii'; });
      expect(twice.withheldClaims.map((claim) => [claim.kind, claim.title, claim.reason])).toEqual(expect.arrayContaining([
        ['movement', 'Movement 3', 'Another movement in this block already has that id.'],
        ['movement', 'Movements', R.movementMalformed]
      ]));
    });
  });

  describe('engagement', () => {
    const withEngagement = (entries: StoryBody[]) => {
      const body = storyBody();
      body.template.engagement = entries;
      return readStory(body).assembled;
    };

    it('withholds engagement that names a movement not drawn, misses one, or gives one two levels; the template stands', () => {
      for (const [entries, reason] of [
        [[{ movement: 'I', level: 'low' }, { movement: 'II', level: 'high' }, { movement: 'IV', level: 'low' }], R.engagementUnknown],
        [[{ movement: 'I', level: 'low' }, { movement: 'II', level: 'high' }], R.engagementNotOne],
        [[{ movement: 'I', level: 'low' }, { movement: 'ii', level: 'high' }, { movement: 'II', level: 'low' }], R.engagementNotOne],
        [[], R.engagementNotOne]
      ] as const) {
        const assembled = withEngagement([...entries]);
        expect(tilesOf(assembled, 'template')[0].engagement).toEqual([]);
        expect(claimsOf(assembled.withheldClaims, 'template')).toEqual([['Engagement', reason]]);
      }
      // Ids are matched case folded.
      const folded = withEngagement([{ movement: 'i', level: 'low' }, { movement: 'Ii', level: 'high' }, { movement: 'iii', level: 'medium' }]);
      expect(tilesOf(folded, 'template')[0].engagement.map((mark) => mark.level)).toEqual(['low', 'high', 'medium']);
    });

    it('goes with the movements: withheld when the set is, and refused when the movements were not read in the call', () => {
      const body = storyBody();
      body.summary.movements[0].to = 2;
      const withheld = readStory(body).assembled;
      expect(claimsOf(withheld.withheldClaims, 'template')).toEqual([['Engagement', R.engagementNoMovements.fresh]]);

      const alone = readStory(storyBody(), ALICE, ['template', 'pressure', 'artifacts']).assembled;
      expect(tilesOf(alone, 'template')[0].engagement).toEqual([]);
      expect(claimsOf(alone.withheldClaims, 'template')).toEqual([['Engagement', R.engagementNotRead]]);

      const empty = storyBody();
      empty.template.engagement = [];
      const asked = readStory(empty, ALICE, ['template', 'pressure', 'artifacts']).assembled;
      expect(asked.withheldClaims).toEqual([]);
    });
  });

  describe('pressure', () => {
    const withThread = (index: number, edit: (thread: StoryBody) => void) => {
      const body = storyBody();
      edit(body.pressure.threads[index]);
      return readStory(body).assembled;
    };

    it('withholds a thread whose quotes run out of paragraph order', () => {
      const late = withThread(2, (thread) => { thread.planted = { para: 7, quote: 'Either the well was very deep, or she fell very slowly' }; thread.escalations = [{ para: 6, quote: 'she found herself falling down a very deep well' }]; });
      expect(claimsOf(late.withheldClaims, 'pressure-thread')).toEqual([['Will the fall ever end?', R.threadOrder.fresh]]);
      const early = withThread(3, (thread) => { thread.resolution = { para: 6, quote: 'The rabbit-hole went straight on like a tunnel for some way' }; });
      expect(claimsOf(early.withheldClaims, 'pressure-thread')).toEqual([['What is in the jar she takes down?', R.threadOrder.fresh]]);
    });

    it('withholds a thread whose plant or resolution is not found, and drops an escalation that is not', () => {
      const plant = withThread(0, (thread) => { thread.planted.quote = 'the Rabbit was terribly worried'; });
      expect(claimsOf(plant.withheldClaims, 'pressure-thread')).toEqual([['Where is the Rabbit hurrying, and why is it late?', R.plantGone.fresh]]);
      const resolution = withThread(3, (thread) => { thread.resolution.quote = 'it was full of jam'; });
      expect(claimsOf(resolution.withheldClaims, 'pressure-thread')).toEqual([['What is in the jar she takes down?', R.resolutionGone.fresh]]);
      const escalation = withThread(0, (thread) => { thread.escalations = [{ para: 4, quote: 'a watch the size of a plate' }]; });
      const [kept] = tilesOf(escalation, 'pressure-thread');
      expect(kept.escalations).toEqual([]);
      expect(kept.withheldQuotes).toEqual([{ paragraph: 4, reason: 'not-in-chapter' }]);
    });
  });

  describe('artifacts', () => {
    const withObject = (index: number, edit: (object: StoryBody) => void) => {
      const body = storyBody();
      edit(body.artifacts.objects[index]);
      return readStory(body).assembled;
    };

    it('withholds an object none of whose terms is in the chapter', () => {
      const assembled = withObject(1, (object) => { object.terms = ['pocket-watch']; });
      expect(claimsOf(assembled.withheldClaims, 'artifact')).toEqual([['The watch', R.artifactUncounted.fresh]]);
    });

    it('withholds an arc step that stands before the step it follows, by its position, and keeps the rest', () => {
      const assembled = withObject(2, (object) => { object.arc.reverse(); });
      const object = tilesOf(assembled, 'artifact').find((tile) => tile.title === 'The rabbit-hole');
      expect(object?.arc.map((step) => step.step)).toEqual(['becomes a well']);
      expect(object?.withheldQuotes).toEqual([{ paragraph: 4, reason: 'out-of-order' }]);
      expect(object?.claim).toBe('becomes a well');
    });

    it('counts a step withheld for its order in the tallies, once: it was checked and found, then withheld (PR #156 N-01)', () => {
      const fresh = readStory().assembled;
      const reversed = withObject(2, (object) => { object.arc.reverse(); });
      const artifacts = (assembled: typeof fresh) => assembled.quoteChecks.find((checks) => checks.lens === 'artifacts');
      // Every quote is still checked once; the order rejection adds one withheld, no check.
      expect(artifacts(reversed)).toEqual({ ...artifacts(fresh), withheld: 1 });
      expect([reversed.quotesChecked, reversed.quotesWithheld]).toEqual([fresh.quotesChecked, 1]);
      // A step not found as well as one out of order: each withheld once, never twice.
      const both = withObject(2, (object) => {
        object.arc = [object.arc[1], object.arc[0], { step: 'gone', para: 6, quote: 'the hole was never there' }];
      });
      expect(tilesOf(both, 'artifact').find((tile) => tile.title === 'The rabbit-hole')?.withheldQuotes).toEqual([
        { paragraph: 6, reason: 'not-in-chapter' },
        { paragraph: 4, reason: 'out-of-order' }
      ]);
      expect(artifacts(both)).toEqual({ ...artifacts(fresh), checked: (artifacts(fresh)?.checked ?? 0) + 1, withheld: 2 });
    });

    it('withholds a step whose quote is not found, and the object with no step left', () => {
      const one = withObject(0, (object) => { object.arc[1].quote = 'it had nothing in it at all'; });
      expect(tilesOf(one, 'artifact')[0].arc.map((step) => step.step)).toEqual(['peeped into']);
      const none = withObject(0, (object) => { object.arc = [{ step: 'read', para: 2, quote: 'she read the whole of it' }]; });
      expect(claimsOf(none.withheldClaims, 'artifact')).toEqual([["Her sister's book", LIGHTBOX_GATE_REASONS.noQuote.fresh]]);
    });

    it(`keeps "planted, unused" only when every mention and step stands within ${LIGHTBOX_UNUSED_REACH} paragraphs of the first`, () => {
      const assembled = withObject(2, (object) => { object.plantedUnused = true; });
      const hole = tilesOf(assembled, 'artifact').find((tile) => tile.title === 'The rabbit-hole');
      expect(hole).toMatchObject({ plantedUnused: false, unusedWithheld: R.unusedFar });
      // The object stands; only the flag is not shown.
      expect(assembled.withheldClaims).toEqual([]);
    });
  });

  it('keeps every reason host-owned: no model words in a withheld title or reason it made', () => {
    const body = storyBody();
    body.summary.movements[1].boundary.quote = 'ZEBRA-QUOTE-WORDS never in the chapter';
    body.template.engagement = [{ movement: 'ZEBRA', level: 'low' }];
    const { assembled } = readStory(body);
    expect(JSON.stringify(assembled.withheldClaims)).not.toContain('ZEBRA');
  });
});
