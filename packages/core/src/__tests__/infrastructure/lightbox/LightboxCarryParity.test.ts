/**
 * Fresh/carry parity (PR #150 F-05): a reading carried onto changed text is
 * held to the same kind-specific rules a first reading of that text meets,
 * through one gate (`LightboxTileGates`). For every tile kind, reading the
 * changed text afresh and carrying the old reading onto it draw the same
 * tiles and withhold the same claims. The worked examples read ¶1–¶8 of
 * "Alice's Adventures in Wonderland" (1865, public domain); the witness and
 * palette fixtures are synthetic sentences written for these tests.
 */
import type { LightboxLensId, LightboxNumberRow, LightboxReadingGroup, LightboxReadingGroupId } from '@messages';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
import { carryLightboxReadings } from '@/infrastructure/lightbox/LightboxStaleReadings';
import { LIGHTBOX_GATE_REASONS } from '@/infrastructure/lightbox/LightboxTileGates';
import { lightboxStandoutRows } from '@/infrastructure/lightbox/LightboxNumberInstances';
import { LIGHTBOX_TILE_LENS } from '@shared/constants/lightbox';
import { frame, framedJson, readWorkedExample } from './lightboxReadingFixtures';
import { WITNESS_PARAGRAPHS, witnessBody } from './lightboxWitnessFixtures';
import { boardWithNumbers } from './lightboxCraftFixtures';
import { buildLightboxInspectorView } from '@hooks/domain/lightbox/controllers/useLightboxInspector';
import { makeReadBoard } from '@/__tests__/presentation/webview/hooks/domain/lightbox/lightboxReadingBoardFixtures';

/* eslint-disable @typescript-eslint/no-explicit-any -- worked-example bodies are edited as plain JSON. */
type Body = Record<string, any>;

/**
 * Each text's measured figures (Slice 4B): group D is read, and carried,
 * against what stands out in the text it lands on, as the host does. A text
 * the sweep never measured has none, so a numbers reading on it is withheld.
 */
const MEASURED = new Map<readonly string[], LightboxNumberRow[]>();

async function measure(...texts: Array<readonly string[]>): Promise<void> {
  for (const text of texts) {
    MEASURED.set(text, (await boardWithNumbers(text)).measured.numbers.rows);
  }
}

function assembleOn(group: LightboxReadingGroupId, lenses: LightboxLensId[], paragraphs: readonly string[], body: Body) {
  const decoded = decodeLightboxGroup(frame(group, body), { group, lenses, columnCount: paragraphs.length });
  let id = 0;
  return assembleLightboxGroup(decoded, {
    verifier: createLightboxQuoteVerifier(paragraphs),
    counter: createLightboxTermCounter(paragraphs),
    mintId: () => `p${++id}`,
    averageWordsPerSentence: 8.4,
    standouts: lightboxStandoutRows(MEASURED.get(paragraphs))
  });
}

function readOn(group: LightboxReadingGroupId, lenses: LightboxLensId[], paragraphs: readonly string[], body: Body): LightboxReadingGroup {
  const assembled = assembleOn(group, lenses, paragraphs, body);
  return {
    group,
    status: 'ok',
    lenses,
    tiles: assembled.tiles,
    withheldBlocks: assembled.withheldBlocks,
    withheldClaims: assembled.withheldClaims,
    frictions: assembled.frictions,
    quoteChecks: assembled.quoteChecks
  };
}

const outcome = (group: { tiles: Array<{ kind: string; title: string }>; withheldClaims: Array<{ kind: string; title: string }> }) => ({
  drawn: group.tiles.map((tile) => `${tile.kind}:${tile.title}`).sort(),
  withheld: group.withheldClaims.map((claim) => `${claim.kind}:${claim.title}`).sort()
});

/** Read `before`, then compare carrying that reading onto `after` with reading `after` afresh. */
function parity(group: LightboxReadingGroupId, lenses: LightboxLensId[], body: Body, before: readonly string[], after: readonly string[]) {
  const read = readOn(group, lenses, before, body);
  const [carried] = carryLightboxReadings([read], {
    readAgainst: 'old',
    paragraphs: after,
    averageWordsPerSentence: 9,
    numbers: MEASURED.get(after)
  });
  const fresh = assembleOn(group, lenses, after, body);
  return { read, carried, fresh };
}

describe('the same rules for a fresh reading and a carried one (PR #150 F-05)', () => {
  it('withholds a carried collision whose witness sentence was deleted, while both fields survive on their own', () => {
    const body = witnessBody([{ evidence: [
      { para: 1, quote: 'Her hope was a flame.' },
      { para: 4, quote: 'A tide swallowed the flame.' }
    ] }]);
    const after = [...WITNESS_PARAGRAPHS.slice(0, 3), 'A wave swallowed the light.'];
    const { read, carried, fresh } = parity('A', ['gravity'], body, WITNESS_PARAGRAPHS, after);
    expect(outcome(read).drawn).toContain('gravity-collision:Fire meets Ocean');
    expect(outcome(carried)).toEqual(outcome(fresh));
    expect(outcome(carried).drawn).toEqual(expect.arrayContaining(['gravity-field:Fire', 'gravity-field:Ocean']));
    expect(carried.withheldClaims).toEqual(expect.arrayContaining([expect.objectContaining({
      kind: 'gravity-collision', reason: LIGHTBOX_GATE_REASONS.noSharedSentence
    })]));
  });

  it('withholds carried palette tiles whose counted words are gone, though their quote still stands', () => {
    const before = ['The white window was open.', 'A gold light came in.'];
    const after = ['The blue window was open.', 'A pale light came in.'];
    const body: Body = {
      version: 1,
      palette: {
        clusters: [{ name: 'Pale tones', claim: 'Light colors.', words: ['white', 'gold'], evidence: [{ para: 1, quote: 'window was open.' }] }],
        swatches: [{ name: 'White', words: ['white'], hex: '#F4F4F0', note: 'The window.', evidence: [{ para: 1, quote: 'window was open.' }] }],
        friction: 'Two pale words.'
      }
    };
    const { read, carried, fresh } = parity('A', ['palette'], body, before, after);
    expect(outcome(read).drawn).toEqual(['palette-cluster:Pale tones', 'swatch:White']);
    expect(outcome(carried)).toEqual(outcome(fresh));
    expect(carried.tiles).toEqual([]);
    expect(carried.withheldClaims.map((claim) => claim.reason)).toEqual([
      LIGHTBOX_GATE_REASONS.clusterWordsGone,
      LIGHTBOX_GATE_REASONS.swatchWordsGone
    ]);
  });

  describe('every tile kind, on the worked examples', () => {
    const paragraphs = readWorkedExample('A').paragraphs;
    // Edits inside paragraphs, so no quote has to move: Ledger loses its ¶3
    // quote but keeps ¶2; "Going down" loses ¶6 but recurs in ¶5 and ¶8; the
    // tension arc loses its ¶6 peak; the "Too dark to see" swatch loses its
    // quote; and the "Sleepy" swatch keeps its quote but loses its word.
    const edited = paragraphs.map((text, index) => {
      if (index === 2) {
        return text
          .replace('whether the pleasure of making a daisy-chain would be worth the trouble', 'whether to make a daisy-chain')
          .replace('very sleepy and stupid', 'very tired and stupid');
      }
      if (index === 5) {
        return text.replace('and then dipped suddenly down, so suddenly that', 'and then');
      }
      if (index === 6) {
        return text.replace('it was too dark to see anything', 'it was hard to see anything');
      }
      return text;
    });
    // And again: "Going down" now stands in ¶5 only, and the collision's
    // witness sentence loses its flash and its rabbit, so its other quote
    // (Fire's alone) is all that stands; Fire and Animals each still stand.
    const thinned = edited.map((text, index) => {
      if (index === 3) {
        return text.replace(
          'for it flashed across her mind that she had never before seen a rabbit with either a waistcoat-pocket, or a watch to take out of it, and burning',
          'and burning'
        );
      }
      return index === 7 ? text.replace('tumbling down stairs', 'tumbling') : text;
    });
    // Slice 4: the speech marks come off ¶4 and ¶8, so the Rabbit's line and
    // Alice's ¶8 thought still stand word for word but are no longer dialogue.
    const unquoted = paragraphs.map((text, index) => (index === 3 || index === 7 ? text.replace(/[“”]/g, '') : text));
    // Slice 4B: group D reads the same eight paragraphs, against each text's own measured figures.
    beforeAll(() => measure(paragraphs, edited, thinned, unquoted));
    const craftBody = (): Body => framedJson(readWorkedExample('D').response) as Body;
    // Group C with a spark that stands on "sleepy", which `edited` removes
    // while the spark's quote stands.
    const sparkBody = (): Body => {
      const body = framedJson(readWorkedExample('C').response) as Body;
      body.spark.items.push({
        title: 'Sleepy hours', question: 'What does the hot afternoon do to what Alice is willing to believe?',
        terms: ['sleepy'], evidence: [{ para: 3, quote: 'So she was considering in her own mind' }]
      });
      return body;
    };
    const collisionBody = (): Body => {
      const body = framedJson(readWorkedExample('A').response) as Body;
      body.gravity.fields.push({
        name: 'Animals', metaphor: 'The chase as a hunt.', pull: 0.12, claim: 'The Rabbit is chased like quarry.',
        terms: [{ term: 'rabbit', degree: 1 }], evidence: [{ para: 3, quote: 'a White Rabbit with pink eyes' }]
      });
      body.gravity.collisions = [{
        fields: ['Fire', 'Animals'],
        claim: 'The thought that flashes is a thought about the rabbit.',
        evidence: [
          { para: 4, quote: 'it flashed across her mind that she had never before seen a rabbit' },
          { para: 4, quote: 'burning with curiosity, she ran across the field after it' }
        ]
      }];
      body.palette.swatches.push({
        name: 'Sleepy', words: ['sleepy'], hex: '#B9B2A4', note: 'The hot day’s haze.',
        evidence: [{ para: 3, quote: 'So she was considering in her own mind' }]
      });
      return body;
    };

    // One property over every group: A's edits test its fields, collisions
    // and palette; B's subtext and C's sparks have rules of their own too
    // (Slice 4), which `unquoted` and `edited` exercise; D's tier mix,
    // handoffs and numbers readings (Slice 4B) lose beats, sentences and
    // measured instances under the same edits.
    it('carry and a fresh reading agree for groups A, B, C and D, including partial evidence survival', () => {
      expect(readWorkedExample('D').paragraphs).toEqual(paragraphs);
      const groups = [
        ['A', collisionBody],
        ['B', () => framedJson(readWorkedExample('B').response) as Body],
        ['C', sparkBody],
        ['D', craftBody]
      ] as const;
      for (const [group, body] of groups) {
        const lenses = readWorkedExample(group).lenses;
        for (const after of [paragraphs, edited, thinned, unquoted]) {
          const { carried, fresh } = parity(group, lenses, body(), paragraphs, after);
          expect({ group, ...outcome(carried) }).toEqual({ group, ...outcome(fresh) });
        }
      }
    });

    it('holds a said line to dialogue and a spark to its counted words, fresh and carried alike (Slice 4)', () => {
      const lensesB = readWorkedExample('B').lenses;
      const subtextB = framedJson(readWorkedExample('B').response) as Body;
      const { read, carried, fresh } = parity('B', lensesB, subtextB, paragraphs, unquoted);
      expect(outcome(read).drawn.filter((tile) => tile.startsWith('subtext:'))).toEqual(['subtext:Alice', 'subtext:Alice', 'subtext:White Rabbit']);
      // ¶2's line keeps its marks; the Rabbit's and ¶8's lose theirs.
      expect(outcome(carried).drawn.filter((tile) => tile.startsWith('subtext:'))).toEqual(['subtext:Alice']);
      expect(carried.withheldClaims.filter((claim) => claim.kind === 'subtext').map((claim) => claim.reason))
        .toEqual([LIGHTBOX_GATE_REASONS.saidNotDialogue.carried, LIGHTBOX_GATE_REASONS.saidNotDialogue.carried]);
      expect(fresh.withheldClaims.filter((claim) => claim.kind === 'subtext').map((claim) => claim.reason))
        .toEqual([LIGHTBOX_GATE_REASONS.saidNotDialogue.fresh, LIGHTBOX_GATE_REASONS.saidNotDialogue.fresh]);

      const lensesC = readWorkedExample('C').lenses;
      const sparks = parity('C', lensesC, sparkBody(), paragraphs, edited);
      expect(outcome(sparks.read).drawn).toContain('spark:Sleepy hours');
      expect(sparks.carried.withheldClaims).toEqual(expect.arrayContaining([expect.objectContaining({
        kind: 'spark', title: 'Sleepy hours', reason: LIGHTBOX_GATE_REASONS.sparkUncounted.carried
      })]));
      expect(sparks.fresh.withheldClaims).toEqual(expect.arrayContaining([expect.objectContaining({
        kind: 'spark', title: 'Sleepy hours', reason: LIGHTBOX_GATE_REASONS.sparkUncounted.fresh
      })]));
      expect(outcome(sparks.carried).drawn.filter((tile) => tile.startsWith('spark:')))
        .toEqual(['spark:Late for what?', 'spark:Nobody at home', 'spark:The empty jar']);
    });

    it('finds a carried said line in speech when the edit puts the same words in narration first (PR #151 F-04)', () => {
      const pair: Body = { version: 1, subtext: {
        items: [{ speaker: 'Bill', said: { para: 1, quote: 'I don\'t know' }, meant: 'He knows, and will not say.', evidence: [] }],
        friction: 'One line is thin ground for a reading.'
      } };
      const before = ['"I don\'t know," he said.'];
      const after = ['I don\'t know was written all over his face. “I don’t know,” he said.'];
      const { read, carried, fresh } = parity('B', ['subtext'], pair, before, after);
      const saidOf = (group: { tiles: LightboxReadingGroup['tiles'] }) =>
        group.tiles.map((tile) => (tile.kind === 'subtext' ? tile.said : undefined));
      expect(saidOf(read)).toEqual([{ paragraph: 1, text: 'I don\'t know', match: 'exact' }]);
      expect(saidOf(carried)).toEqual([{ paragraph: 1, text: 'I don’t know', match: 'normalized' }]);
      expect(saidOf(fresh)).toEqual(saidOf(carried));
      expect(outcome(carried)).toEqual(outcome(fresh));
    });

    describe('a carried pair\'s evidence, led by the said line it found (PR #151 F-07)', () => {
      const pairBody = (evidence: Array<{ para: number; quote: string }>): Body => ({ version: 1, subtext: {
        items: [{ speaker: 'Mara', said: { para: 1, quote: 'I don\'t know' }, meant: 'She knows, and will not say.', evidence }],
        friction: 'One line is thin ground for a reading.'
      } });
      const before = ['"I don\'t know," she said.'];
      const after = ['I don\'t know was written all over her face. “I don’t know,” she said.'];
      const SPEECH = { paragraph: 1, text: 'I don’t know', match: 'normalized' };
      /** What the inspector shows for the group's one pair, on a board holding that group. */
      const inspected = (group: LightboxReadingGroup) => {
        const board = { ...makeReadBoard(), readings: [group] };
        return buildLightboxInspectorView(board, { kind: 'reading', tileId: group.tiles[0].id })?.reading?.evidence;
      };

      it('leads with the speech, never the narration\'s exact copy, on the card and in the inspector', () => {
        const { carried, fresh } = parity('B', ['subtext'], pairBody([]), before, after);
        const [pair] = carried.tiles;
        expect(pair.kind === 'subtext' && pair.said).toEqual(SPEECH);
        expect(pair.evidence).toEqual([SPEECH]);
        expect(inspected(carried)).toEqual([{ paragraph: 1, text: 'I don’t know', matchLabel: 'found with typography folded' }]);
        expect(fresh.tiles.map((tile) => tile.evidence)).toEqual([pair.evidence]);
      });

      it('keeps its context quotes after the said line, once each, as a fresh read does', () => {
        // The second context quote is the speech again: a fresh read drops it beside the said line.
        const evidence = [{ para: 1, quote: 'she said' }, { para: 1, quote: 'I don’t know' }];
        const { carried, fresh } = parity('B', ['subtext'], pairBody(evidence), before, after);
        const [pair] = carried.tiles;
        expect(pair.evidence).toEqual([SPEECH, { paragraph: 1, text: 'she said', match: 'exact' }]);
        expect(fresh.tiles.map((tile) => tile.evidence)).toEqual([pair.evidence]);
        expect(carried.withheldClaims).toEqual(fresh.withheldClaims);
        expect(inspected(carried)).toEqual([
          { paragraph: 1, text: 'I don’t know', matchLabel: 'found with typography folded' },
          { paragraph: 1, text: 'she said', matchLabel: 'found verbatim' }
        ]);
      });

      it('counts a said line that is gone as one lost quote, first', () => {
        const gone = ['"I never said a word," she said.'];
        const { carried } = parity('B', ['subtext'], pairBody([{ para: 1, quote: 'she said' }]), before, gone);
        expect(carried.withheldClaims).toEqual([expect.objectContaining({
          kind: 'subtext',
          reason: LIGHTBOX_GATE_REASONS.saidNotFound.carried,
          quotes: [{ paragraph: 1, reason: 'no-longer-in-chapter' }]
        })]);
      });
    });

    it('carries every drawn tile\'s full evidence, said line and witness as a fresh read of the changed text has them (PR #151 F-07)', () => {
      const projection = (group: { tiles: LightboxReadingGroup['tiles'] }) => Object.fromEntries(group.tiles.map((tile) => [
        `${tile.kind}:${tile.title}`,
        {
          evidence: tile.evidence.map(({ paragraph, text, match }) => ({ paragraph, text, match })),
          ...(tile.kind === 'subtext' ? { said: tile.said } : {}),
          ...(tile.kind === 'gravity-collision' ? { witness: tile.witness } : {})
        }
      ]));
      const groups = [
        ['A', collisionBody],
        ['B', () => framedJson(readWorkedExample('B').response) as Body],
        ['C', sparkBody],
        ['D', craftBody]
      ] as const;
      for (const [group, body] of groups) {
        const lenses = readWorkedExample(group).lenses;
        for (const after of [paragraphs, edited, thinned, unquoted]) {
          const { carried, fresh } = parity(group, lenses, body(), paragraphs, after);
          expect({ group, tiles: projection(carried) }).toEqual({ group, tiles: projection(fresh) });
        }
      }
      // And the narration-first edit the F-04 and F-07 fixes are about.
      const pair: Body = { version: 1, subtext: {
        items: [{
          speaker: 'Mara',
          said: { para: 1, quote: 'I don\'t know' },
          meant: 'She knows, and will not say.',
          evidence: [{ para: 1, quote: 'she said' }]
        }],
        friction: 'One line is thin ground for a reading.'
      } };
      const narrated = parity(
        'B',
        ['subtext'],
        pair,
        ['"I don\'t know," she said.'],
        ['I don\'t know was written all over her face. “I don’t know,” she said.']
      );
      expect(projection(narrated.carried)).toEqual(projection(narrated.fresh));
    });

    it('covers every reading kind, and the partial survivals hold or withhold as they should', () => {
      const lenses = readWorkedExample('A').lenses;
      const drawnKinds = new Set((['A', 'B', 'C', 'D'] as const).flatMap((group) => {
        const body = group === 'A' ? collisionBody() : framedJson(readWorkedExample(group).response) as Body;
        return readOn(group, readWorkedExample(group).lenses, paragraphs, body).tiles.map((tile) => tile.kind);
      }));
      // Every reading kind the board can draw, so a new kind cannot skip this sweep.
      expect([...drawnKinds].sort()).toEqual(Object.keys(LIGHTBOX_TILE_LENS).sort());
      expect([...drawnKinds].sort()).toEqual([
        'air-lock', 'character', 'echo', 'familiar-phrase', 'genre-neighbor', 'gravity-collision', 'gravity-field',
        'gravity-literal', 'handoff', 'headline', 'lineage', 'motif', 'number-usage', 'palette-cluster', 'reader-promise',
        'rhythm-endings', 'signature', 'spark', 'stock-tiers', 'subtext', 'swatch', 'tension-arc', 'voice'
      ]);
      const once = parity('A', lenses, collisionBody(), paragraphs, edited).carried;
      expect(outcome(once).drawn).toEqual(expect.arrayContaining([
        'motif:Going down', 'gravity-field:Ledger', 'tension-arc:Tension arc', 'gravity-collision:Fire meets Animals'
      ]));
      expect(outcome(once).withheld).toContain('swatch:Too dark to see');
      expect(once.withheldClaims).toEqual(expect.arrayContaining([expect.objectContaining({
        kind: 'swatch', title: 'Sleepy', reason: LIGHTBOX_GATE_REASONS.swatchWordsGone
      })]));
      const twice = parity('A', lenses, collisionBody(), paragraphs, thinned).carried;
      expect(twice.withheldClaims).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: 'motif', title: 'Going down', reason: LIGHTBOX_GATE_REASONS.motifOneParagraph.carried }),
        expect.objectContaining({ kind: 'gravity-collision', reason: LIGHTBOX_GATE_REASONS.noSharedSentence })
      ]));
      expect(outcome(twice).drawn).toEqual(expect.arrayContaining(['gravity-field:Fire', 'gravity-field:Animals']));

      // Slice 4B: the tier mix keeps the beats that stand and counts its
      // tiers again from them; a numbers reading keeps the quote that still
      // holds an instance and counts the one that is gone.
      const craft = parity('D', readWorkedExample('D').lenses, craftBody(), paragraphs, thinned).carried;
      const tiers = craft.tiles.find((tile) => tile.kind === 'stock-tiers');
      expect(tiers?.kind === 'stock-tiers' && { beats: tiers.beats.length, tiers: tiers.tiers }).toEqual({
        beats: 13,
        tiers: { functional: 5, decorated: 1, weighted: 1, signature: 6 }
      });
      expect(tiers?.withheldQuotes).toEqual([
        { paragraph: 3, reason: 'no-longer-in-chapter' },
        { paragraph: 3, reason: 'no-longer-in-chapter' },
        { paragraph: 8, reason: 'no-longer-in-chapter' }
      ]);
      const length = craft.tiles.find((tile) => tile.kind === 'number-usage' && tile.stat === 'sentence-length');
      expect(length?.evidence.map((quote) => quote.paragraph)).toEqual([7]);
      expect(length?.withheldQuotes).toEqual([{ paragraph: 4, reason: 'no-longer-in-chapter' }]);
    });
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
