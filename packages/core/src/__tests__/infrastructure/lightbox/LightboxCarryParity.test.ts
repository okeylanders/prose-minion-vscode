/**
 * Fresh/carry parity (PR #150 F-05): a reading carried onto changed text is
 * held to the same kind-specific rules a first reading of that text meets,
 * through one gate (`LightboxTileGates`). For every tile kind, reading the
 * changed text afresh and carrying the old reading onto it draw the same
 * tiles and withhold the same claims. The worked examples read ¶1–¶8 of
 * "Alice's Adventures in Wonderland" (1865, public domain); the witness and
 * palette fixtures are synthetic sentences written for these tests.
 */
import type { LightboxLensId, LightboxReadingGroup, LightboxReadingGroupId } from '@messages';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
import { carryLightboxReadings } from '@/infrastructure/lightbox/LightboxStaleReadings';
import { LIGHTBOX_GATE_REASONS } from '@/infrastructure/lightbox/LightboxTileGates';
import { frame, framedJson, readWorkedExample } from './lightboxReadingFixtures';
import { WITNESS_PARAGRAPHS, witnessBody } from './lightboxWitnessFixtures';

/* eslint-disable @typescript-eslint/no-explicit-any -- worked-example bodies are edited as plain JSON. */
type Body = Record<string, any>;

function assembleOn(group: LightboxReadingGroupId, lenses: LightboxLensId[], paragraphs: readonly string[], body: Body) {
  const decoded = decodeLightboxGroup(frame(group, body), { group, lenses, columnCount: paragraphs.length });
  let id = 0;
  return assembleLightboxGroup(decoded, {
    verifier: createLightboxQuoteVerifier(paragraphs),
    counter: createLightboxTermCounter(paragraphs),
    mintId: () => `p${++id}`,
    averageWordsPerSentence: 8.4
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
  const [carried] = carryLightboxReadings([read], { readAgainst: 'old', paragraphs: after, averageWordsPerSentence: 9 });
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

    // One property over every group: B's and C's kinds have no rule beyond a
    // found quote, so only group A's edits can tell the two paths apart.
    it('carry and a fresh reading agree for groups A, B and C, including partial evidence survival', () => {
      const groups = [
        ['A', collisionBody],
        ['B', () => framedJson(readWorkedExample('B').response) as Body],
        ['C', () => framedJson(readWorkedExample('C').response) as Body]
      ] as const;
      for (const [group, body] of groups) {
        const lenses = readWorkedExample(group).lenses;
        for (const after of [paragraphs, edited, thinned]) {
          const { carried, fresh } = parity(group, lenses, body(), paragraphs, after);
          expect({ group, ...outcome(carried) }).toEqual({ group, ...outcome(fresh) });
        }
      }
    });

    it('covers every reading kind, and the partial survivals hold or withhold as they should', () => {
      const lenses = readWorkedExample('A').lenses;
      const drawnKinds = new Set((['A', 'B', 'C'] as const).flatMap((group) => {
        const body = group === 'A' ? collisionBody() : framedJson(readWorkedExample(group).response) as Body;
        return readOn(group, readWorkedExample(group).lenses, paragraphs, body).tiles.map((tile) => tile.kind);
      }));
      expect([...drawnKinds].sort()).toEqual([
        'character', 'genre-neighbor', 'gravity-collision', 'gravity-field', 'gravity-literal', 'headline', 'motif',
        'palette-cluster', 'reader-promise', 'swatch', 'tension-arc', 'voice'
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
    });
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
