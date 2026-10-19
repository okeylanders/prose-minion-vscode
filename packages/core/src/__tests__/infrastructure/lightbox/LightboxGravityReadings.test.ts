/**
 * Lexical gravity and palette readings (ADR 2026-10-19 D7; Slice 3): the
 * codec's rules (the required literal set-aside list, degrees 1–3, fields a
 * collision may name, swatch colors), the host's counting (hits once each
 * under the longest term, case folding, degrees, drift, the gravity line),
 * and assembly (a collision drawn only when its quote holds both fields).
 * Readings are group A's worked example over its excerpt of "Alice's
 * Adventures in Wonderland" (1865, public domain), varied by hand.
 */
import type { LightboxLensId } from '@messages';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
import { countLightboxField, lightboxGravityDrift } from '@/infrastructure/lightbox/LightboxGravityCounts';
import { carryLightboxReadings } from '@/infrastructure/lightbox/LightboxStaleReadings';
import { frame, framedJson, readWorkedExample } from './lightboxReadingFixtures';

const example = readWorkedExample('A');
const paragraphs = example.paragraphs;
const lenses: LightboxLensId[] = ['gravity', 'palette'];
const context = { group: 'A' as const, lenses, columnCount: 8 };

/* eslint-disable @typescript-eslint/no-explicit-any -- worked-example bodies are edited as plain JSON. */
function body(): Record<string, any> {
  const json = framedJson(example.response) as Record<string, any>;
  return { version: 1, gravity: json.gravity, palette: json.palette };
}

function decode(edit: (json: Record<string, any>) => void = () => undefined) {
  const json = body();
  edit(json);
  return decodeLightboxGroup(frame('A', json), context);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function assemble(edit?: Parameters<typeof decode>[0]) {
  let id = 0;
  return assembleLightboxGroup(decode(edit), {
    verifier: createLightboxQuoteVerifier(paragraphs),
    counter: createLightboxTermCounter(paragraphs),
    mintId: () => `g${++id}`
  });
}

describe('the gravity and palette codec', () => {
  it('decodes both blocks of the worked example', () => {
    const decoded = decode();
    expect(decoded.withheld).toEqual([]);
    expect(decoded.blocks.map((block) => block.lens)).toEqual(['gravity', 'palette']);
  });

  it('withholds a gravity block with no literal set-aside list, or an empty one', () => {
    const missing = decode((json) => {
      delete json.gravity.literal;
    });
    expect(missing.blocks.map((block) => block.lens)).toEqual(['palette']);
    expect(missing.withheld).toEqual([{ lens: 'gravity', reason: expect.stringContaining('literal') }]);
    const empty = decode((json) => {
      json.gravity.literal = [];
    });
    expect(empty.withheld).toEqual([{ lens: 'gravity', reason: expect.stringContaining('literal') }]);
  });

  it('withholds a field whose term has a degree out of range, by its name', () => {
    const decoded = decode((json) => {
      json.gravity.fields[1].terms[0].degree = 4;
    });
    const gravity = decoded.blocks.find((block) => block.lens === 'gravity');
    expect(gravity?.lens === 'gravity' ? gravity.fields.map((field) => field.name) : []).toEqual(['Ledger']);
    expect(gravity?.lens === 'gravity' ? gravity.malformed.fields : []).toEqual([
      { title: 'Fire', reason: expect.stringContaining('a degree: 1 (latent), 2 (felt) or 3 (overt)') }
    ]);
  });

  it('holds a collision to two different fields the block draws, and a set-aside to a name no field has', () => {
    const decoded = decode((json) => {
      json.gravity.collisions = [
        { fields: ['Ledger', 'Clockwork'], claim: 'c', evidence: [{ para: 3, quote: 'worth the trouble' }] },
        { fields: ['Fire', 'fire'], claim: 'c', evidence: [{ para: 4, quote: 'burning with curiosity' }] }
      ];
      json.gravity.literal.push({ name: 'Fire', reason: 'r', terms: ['burning'], evidence: [{ para: 4, quote: 'burning with curiosity' }] });
    });
    const gravity = decoded.blocks.find((block) => block.lens === 'gravity');
    if (gravity?.lens !== 'gravity') {
      throw new Error('expected a gravity block');
    }
    expect(gravity.collisions).toEqual([]);
    expect(gravity.malformed.collisions.map((item) => item.reason)).toEqual([
      expect.stringContaining('It names a field that is not one of the block\'s borrowed fields.'),
      expect.stringContaining('two different fields')
    ]);
    expect(gravity.literal.map((item) => item.name)).toEqual(['Falling', 'Household things']);
    expect(gravity.malformed.literal).toEqual([{ title: 'Fire', reason: expect.stringContaining('drawn as a borrowed field') }]);
  });

  it('withholds a swatch whose color is not #RRGGBB, and upper-cases one that is', () => {
    const decoded = decode((json) => {
      json.palette.swatches[0].hex = 'white';
      json.palette.swatches[1].hex = '#e8a2b2';
    });
    const palette = decoded.blocks.find((block) => block.lens === 'palette');
    if (palette?.lens !== 'palette') {
      throw new Error('expected a palette block');
    }
    expect(palette.malformed.swatches).toEqual([{ title: 'White Rabbit', reason: expect.stringContaining('#RRGGBB') }]);
    expect(palette.swatches[0].hex).toBe('#E8A2B2');
  });
});

describe('counting a field (host)', () => {
  const counter = createLightboxTermCounter(paragraphs);

  it('counts multi-word terms and folds case, each occurrence once under its longest term', () => {
    const field = countLightboxField(
      [
        { term: 'Rabbit', degree: 1 },
        { term: 'White Rabbit', degree: 3 },
        { term: 'rabbit-hole', degree: 2 },
        { term: 'she', degree: 1 },
        { term: 'RABBIT', degree: 2 }
      ],
      counter,
      paragraphs.length
    );
    // A lone stopword and a repeated term are dropped; raw counts are per term.
    expect(field.support.map((term) => [term.term, term.degree, term.count, term.paragraphs])).toEqual([
      ['rabbit', 1, 4, [3, 4]],
      ['white rabbit', 3, 1, [3]],
      ['rabbit-hole', 2, 3, [1, 4, 6]]
    ]);
    // "White Rabbit" holds one of the four "rabbit"s: seven hits, not eight.
    expect(field.hits).toBe(7);
    expect(field.degreeHits).toEqual([3, 3, 1]);
    expect(field.belowLine).toBe(false);
    // ¶4 holds three rabbits and a rabbit-hole.
    expect(field.drift).toEqual({ first: 1, last: 6, densest: { from: 4, to: 4, hits: 4 } });
  });

  it('draws a field with fewer hits than the line below it, and one with none with no drift', () => {
    expect(countLightboxField([{ term: 'flashed', degree: 1 }, { term: 'burning', degree: 2 }], counter, 8))
      .toMatchObject({ hits: 2, belowLine: true });
    expect(countLightboxField([{ term: 'telescope', degree: 3 }], counter, 8))
      .toMatchObject({ hits: 0, belowLine: true, drift: null });
  });

  it('finds the densest stretch of a long chapter, trimmed to its hits', () => {
    const perParagraph = new Array<number>(31).fill(0);
    perParagraph[3] = 1;
    perParagraph[21] = 2;
    perParagraph[22] = 4;
    expect(lightboxGravityDrift(perParagraph)).toEqual({ first: 4, last: 23, densest: { from: 22, to: 23, hits: 6 } });
  });
});

describe('assembling gravity and palette tiles', () => {
  it('draws the worked example\'s fields, set-asides, clusters and swatches', () => {
    const assembled = assemble();
    expect(assembled.withheldClaims).toEqual([]);
    expect(assembled.tiles.map((tile) => tile.kind)).toEqual([
      'gravity-field', 'gravity-field', 'gravity-literal', 'gravity-literal',
      'palette-cluster', 'palette-cluster', 'palette-cluster', 'swatch', 'swatch', 'swatch', 'swatch'
    ]);
    expect(assembled.frictions.map((entry) => entry.lens)).toEqual(['gravity', 'palette']);
  });

  it('draws a collision only when a found quote holds a term of each field', () => {
    const quoteBoth = { para: 4, quote: 'it flashed across her mind that she had never before seen a rabbit' };
    const drawn = assemble((json) => {
      json.gravity.fields.push({
        name: 'Animals', metaphor: 'm', pull: 0.1, claim: 'c',
        terms: [{ term: 'rabbit', degree: 1 }], evidence: [{ para: 3, quote: 'a White Rabbit with pink eyes' }]
      });
      json.gravity.collisions = [{ fields: ['Fire', 'Animals'], claim: 'They meet.', evidence: [quoteBoth] }];
    });
    const collision = drawn.tiles.find((tile) => tile.kind === 'gravity-collision');
    expect(collision).toMatchObject({ title: 'Fire meets Animals', fields: ['Fire', 'Animals'], paragraphs: [4] });

    const refused = assemble((json) => {
      json.gravity.collisions = [{ fields: ['Fire', 'Ledger'], claim: 'c', evidence: [{ para: 4, quote: 'burning with curiosity' }] }];
    });
    expect(refused.tiles.some((tile) => tile.kind === 'gravity-collision')).toBe(false);
    expect(refused.withheldClaims).toEqual([expect.objectContaining({
      kind: 'gravity-collision', title: 'Fire meets Ledger', reason: expect.stringContaining('holds a term of each field')
    })]);
  });

  it('withholds a collision naming a field the board withheld, and a swatch whose words are not in the chapter', () => {
    const assembled = assemble((json) => {
      json.gravity.fields[1].evidence = [{ para: 4, quote: 'a flame of curiosity lit her up' }];
      json.gravity.collisions = [{ fields: ['Ledger', 'Fire'], claim: 'c', evidence: [{ para: 3, quote: 'worth the trouble' }] }];
      json.palette.swatches[0].words = ['golden'];
    });
    expect(assembled.withheldClaims.map((claim) => [claim.kind, claim.title, claim.reason])).toEqual([
      ['gravity-field', 'Fire', expect.stringContaining('No quote it gave was found')],
      ['gravity-collision', 'Ledger meets Fire', 'One of the fields it names is not on the board.'],
      ['swatch', 'White Rabbit', 'Its color words are not in the chapter.']
    ]);
  });

  it('recounts a field\'s hits, degrees, line and drift when its reading is carried onto a changed text', () => {
    const assembled = assemble();
    const group = {
      group: 'A' as const, status: 'ok' as const, lenses, tiles: assembled.tiles,
      withheldBlocks: [], withheldClaims: [], frictions: assembled.frictions, quoteChecks: assembled.quoteChecks
    };
    // ¶3 loses "worth the trouble" and ¶4 gains another "burning".
    const changed = paragraphs.map((text, index) => (index === 2
      ? text.replace('would be worth the trouble of getting up', 'would be any use at all')
      : index === 3 ? `${text} Her cheeks were burning.` : text));
    const [carried] = carryLightboxReadings([group], { readAgainst: 'old', paragraphs: changed, averageWordsPerSentence: 9 });
    const ledger = carried.tiles.find((tile) => tile.title === 'Ledger');
    const fire = carried.tiles.find((tile) => tile.title === 'Fire');
    expect(ledger && ledger.kind === 'gravity-field' ? [ledger.hits, ledger.degreeHits] : []).toEqual([3, [3, 0, 0]]);
    expect(fire && fire.kind === 'gravity-field' ? [fire.hits, fire.belowLine] : []).toEqual([3, false]);
    // Its quote from ¶3 no longer stands; the one from ¶2 does.
    expect(ledger?.withheldQuotes).toEqual([{ paragraph: 3, reason: 'no-longer-in-chapter' }]);
  });
});
