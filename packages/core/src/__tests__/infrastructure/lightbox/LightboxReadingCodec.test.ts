/**
 * LightboxReadingCodec (ADR 2026-10-19 D7): the frame and root fail the
 * group; below them, validation is per block and per item, so one malformed
 * block or item is withheld while its siblings survive.
 */
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { LightboxGroupFrameError, type LightboxDecodedGroup } from '@/infrastructure/lightbox/LightboxReadingWire';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { frame, framedJson, readWorkedExample } from './lightboxReadingFixtures';

const exampleA = readWorkedExample('A');
const exampleB = readWorkedExample('B');
const exampleC = readWorkedExample('C');
const contextA = { group: 'A' as const, lenses: exampleA.lenses, columnCount: 8 };
const contextB = { group: 'B' as const, lenses: exampleB.lenses, columnCount: 8 };
const contextC = { group: 'C' as const, lenses: exampleC.lenses, columnCount: 8 };

/** A deep copy of an example's JSON body, to break one part of it. */
function body(example: { response: string }): Record<string, any> {
  return framedJson(example.response) as Record<string, any>;
}

function assemble(decoded: LightboxDecodedGroup, paragraphs: string[]) {
  let id = 0;
  return assembleLightboxGroup(decoded, {
    verifier: createLightboxQuoteVerifier(paragraphs),
    counter: createLightboxTermCounter(paragraphs),
    mintId: () => `t${++id}`
  });
}

describe('LightboxReadingCodec', () => {
  describe('the frame fails the whole group', () => {
    it.each([
      ['no opening sentinel', (text: string) => text.replace('===LIGHTBOX_GROUP_A_V1===\n', '')],
      ['no closing sentinel, and JSON that does not close', (text: string) => text.replace(/\}\n===END_LIGHTBOX_GROUP_A_V1===$/, '')],
      ['a repeated opening sentinel', (text: string) => `===LIGHTBOX_GROUP_A_V1===\n${text}`],
      ['a duplicated closing sentinel', (text: string) => `${text}\n===END_LIGHTBOX_GROUP_A_V1===`],
      ['commentary before the frame', (text: string) => `Here are the readings:\n${text}`],
      ['another group\'s sentinels', (text: string) => text.replace(/_A_V1/g, '_B_V1')],
      ['invalid JSON', (text: string) => text.replace('{"version":1', '{"version":1,,')],
      ['a wrong version', (text: string) => text.replace('{"version":1', '{"version":2')],
      ['an unknown root field', (text: string) => text.replace('{"version":1', '{"version":1,"score":9')]
    ])('%s', (_label, breakIt) => {
      expect(() => decodeLightboxGroup(breakIt(exampleA.response), contextA)).toThrow(LightboxGroupFrameError);
    });

    it('counts fields the format does not define, and names them only in the recovery diagnostic (PR #149 F-05)', () => {
      // A model can copy chapter or context prose into a field name.
      const prose = 'Synthetic private note: she never told the Queen';
      const long = 'x'.repeat(200);
      const text = exampleA.response.replace('{"version":1', `{"version":1,"${prose}":1,"${long}":1,"b":1`);
      let caught: unknown;
      try {
        decodeLightboxGroup(text, contextA);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(LightboxGroupFrameError);
      const frameError = caught as LightboxGroupFrameError;
      expect(frameError.message).toBe('The group A response has 3 fields the format does not define');
      expect(frameError.message).not.toContain('Synthetic');
      expect(frameError.diagnostic).toBe(`Undefined root fields: ${JSON.stringify(prose)}, "${'x'.repeat(120)}", "b"`);
    });

    it('counts, never names, an undefined field inside a block or an item', () => {
      const block = body(exampleA);
      block.tension['Synthetic private note'] = 'copied prose';
      const item = body(exampleA);
      item.motifs.items[0]['Synthetic private note'] = 'copied prose';
      const blockReason = decodeLightboxGroup(frame('A', block), contextA).withheld[0].reason;
      const motifs = decodeLightboxGroup(frame('A', item), contextA).blocks.find((entry) => entry.lens === 'motif');
      const itemReason = motifs && motifs.lens === 'motif' ? motifs.malformed[0].reason : '';
      expect(blockReason).toBe('The tension block broke the format: tension has 1 field the format does not define.');
      expect(itemReason).toBe('It broke the format: motifs.items[0] has 1 field the format does not define.');
      expect(`${blockReason} ${itemReason}`).not.toContain('Synthetic');
    });

    it('reads a response past the characters it asks for, and refuses one only past the safety ceiling (Slice 4H)', () => {
      const asked = PROMPT_BUDGETS.lightbox.groupResponseCharacters;
      const long = body(exampleA);
      long.headline.friction = `${long.headline.friction} ${'The fall reads two ways. '.repeat(Math.ceil(asked / 20))}`;
      const text = frame('A', long);
      expect(text.length).toBeGreaterThan(asked);
      expect(decodeLightboxGroup(text, contextA).blocks).toHaveLength(contextA.lenses.length);
      const ceiling = asked * PROMPT_BUDGETS.lightbox.safetyMultiple;
      const huge = frame('A', { version: 1, headline: { padding: 'x'.repeat(ceiling) } });
      expect(() => decodeLightboxGroup(huge, contextA)).toThrow(/runs past 384,000 characters/);
    });

    it('accepts a reply with no closing sentinel whose JSON is complete as it stands, as a repair (Slice 4H)', () => {
      const decoded = decodeLightboxGroup(exampleA.response.replace('\n===END_LIGHTBOX_GROUP_A_V1===', ''), contextA);
      expect(decoded.blocks).toHaveLength(contextA.lenses.length);
      expect(decoded.report).toEqual({ repairs: ['missing-closing-sentinel'], clipped: 0, cutOff: false });
    });

    it('accepts CRLF line endings and surrounding whitespace', () => {
      const crlf = `\n  ${exampleA.response.replace(/\n/g, '\r\n')}  \n`;
      expect(decodeLightboxGroup(crlf, contextA).blocks).toHaveLength(contextA.lenses.length);
    });
  });

  describe('per block', () => {
    it('withholds a malformed block by lens while its siblings survive', () => {
      const broken = body(exampleA);
      broken.motifs.items = 'three motifs';
      const decoded = decodeLightboxGroup(frame('A', broken), contextA);
      expect(decoded.blocks.map((block) => block.lens)).toEqual(['headline', 'tension', 'gravity', 'palette']);
      expect(decoded.withheld).toEqual([
        { lens: 'motif', reason: expect.stringContaining('motifs.items must be') }
      ]);
      const assembled = assemble(decoded, exampleA.paragraphs);
      expect(assembled.withheldBlocks).toEqual([{ kind: 'motif', lens: 'motif', reason: decoded.withheld[0].reason }]);
      expect(assembled.tiles.map((tile) => tile.kind).slice(0, 2)).toEqual(['headline', 'tension-arc']);
      expect(assembled.tiles.map((tile) => tile.kind)).not.toContain('motif');
    });

    it('fails a block with no friction, naming the rule', () => {
      const broken = body(exampleB);
      delete broken.voice.friction;
      const decoded = decodeLightboxGroup(frame('B', broken), contextB);
      expect(decoded.blocks.map((block) => block.lens)).toEqual(['characters', 'subtext']);
      expect(decoded.withheld).toEqual([
        { lens: 'voice', reason: 'The voice block names no friction; every lens must say where it strains.' }
      ]);
    });

    it('fails a block whose friction is blank', () => {
      const broken = body(exampleA);
      broken.headline.friction = '   ';
      expect(decodeLightboxGroup(frame('A', broken), contextA).withheld.map((entry) => entry.lens)).toEqual(['headline']);
    });

    it('withholds a requested block the response left out', () => {
      const broken = body(exampleA);
      delete broken.tension;
      expect(decodeLightboxGroup(frame('A', broken), contextA).withheld).toEqual([
        { lens: 'tension', reason: 'The reading returned no tension block.' }
      ]);
    });

    it('drops a block for a lens the call did not ask for', () => {
      const decoded = decodeLightboxGroup(exampleA.response, { ...contextA, lenses: ['headline', 'tension'] });
      expect(decoded.blocks.map((block) => block.lens)).toEqual(['headline', 'tension']);
      expect(decoded.ignored).toEqual(['motif', 'gravity', 'palette']);
    });

    it('requires exactly one tension score per ribbon column, each 0–9', () => {
      expect(decodeLightboxGroup(exampleA.response, { ...contextA, columnCount: 9 }).withheld[0])
        .toEqual({ lens: 'tension', reason: expect.stringContaining('exactly 9 scores') });
      const broken = body(exampleA);
      broken.tension.scores[2] = 10;
      expect(decodeLightboxGroup(frame('A', broken), contextA).withheld[0].reason)
        .toContain('a whole number from 0 to 9');
    });

    it('withholds a genre neighborhood with no near miss', () => {
      const broken = body(exampleC);
      broken.genre.neighbors = broken.genre.neighbors.slice(0, 3);
      expect(decodeLightboxGroup(frame('C', broken), contextC).withheld).toEqual([
        { lens: 'genre', reason: expect.stringContaining('drew no near miss') }
      ]);
    });

    it('requires a near miss to say what matches and what does not (PR #149 F-06)', () => {
      const blank = body(exampleC);
      blank.genre.neighbors = [
        { ...blank.genre.neighbors[0], affinity: 0.8 },
        blank.genre.neighbors[1],
        { ...blank.genre.neighbors[3], affinity: 0.4, nearMiss: '' },
        { ...blank.genre.neighbors[3], genre: 'Gothic horror', affinity: 0.38, nearMiss: '   ' }
      ];
      const decoded = decodeLightboxGroup(frame('C', blank), contextC);
      // Neither low-affinity neighbor explains itself, so the neighborhood draws no near miss.
      expect(decoded.withheld).toEqual([{ lens: 'genre', reason: expect.stringContaining('drew no near miss') }]);

      const one = body(exampleC);
      one.genre.neighbors[3].nearMiss = '';
      one.genre.neighbors.push({ ...one.genre.neighbors[3], genre: 'Gothic horror', affinity: 0.399, nearMiss: 'A dark fall matches; no dread.' });
      const kept = decodeLightboxGroup(frame('C', one), contextC).blocks[0];
      expect(kept.lens === 'genre' && kept.malformed).toEqual([{
        title: 'Survival thriller',
        reason: expect.stringContaining('genre.neighbors[3].nearMiss must be a non-empty string')
      }]);
      expect(kept.lens === 'genre' && kept.neighbors.map((neighbor) => [neighbor.genre, neighbor.affinity, neighbor.nearMiss])).toEqual([
        ['Victorian children’s fantasy', 0.86, ''],
        ['Literary nonsense', 0.71, ''],
        ['Portal fantasy', 0.55, ''],
        ['Gothic horror', 0.4, 'A dark fall matches; no dread.']
      ]);
    });

    it('keeps no near miss for a closer neighbor, without withholding it', () => {
      const extra = body(exampleC);
      extra.genre.neighbors[0].nearMiss = 'Not a near miss at all.';
      const block = decodeLightboxGroup(frame('C', extra), contextC).blocks[0];
      expect(block.lens === 'genre' && block.malformed).toEqual([]);
      expect(block.lens === 'genre' && block.neighbors[0]).toMatchObject({ affinity: 0.86, nearMiss: '' });
    });

    it('refuses an affinity outside 0–1 and a fractional paragraph number', () => {
      const affinity = body(exampleC);
      affinity.genre.neighbors[0].affinity = 1.4;
      const decoded = decodeLightboxGroup(frame('C', affinity), contextC);
      expect(decoded.blocks.map((block) => block.lens)).toEqual(['genre', 'lineage', 'spark']);
      expect(decoded.blocks[0].lens === 'genre' && decoded.blocks[0].malformed[0].reason).toContain('from 0 to 1');

      const paragraph = body(exampleA);
      paragraph.headline.evidence[0].para = 2.5;
      expect(decodeLightboxGroup(frame('A', paragraph), contextA).withheld[0].reason).toContain('a paragraph number');
    });
  });

  describe('per item', () => {
    it('withholds one malformed motif by its title while the other motifs land', () => {
      const broken = body(exampleA);
      broken.motifs.items[1].claim = 400;
      const decoded = decodeLightboxGroup(frame('A', broken), contextA);
      const motifs = decoded.blocks.find((block) => block.lens === 'motif');
      expect(motifs && motifs.lens === 'motif' ? motifs.items.map((item) => item.title) : [])
        .toEqual(['Going down', 'Hurry and leisure']);
      const assembled = assemble(decoded, exampleA.paragraphs);
      expect(assembled.withheldClaims).toEqual([{
        kind: 'motif',
        lens: 'motif',
        title: 'Pictures and conversations',
        reason: 'It broke the format: motifs.items[1].claim must be string',
        quotes: []
      }]);
    });

    it('names an untitled malformed item by its place', () => {
      const broken = body(exampleB);
      broken.characters.items[2] = { name: 7 };
      const decoded = decodeLightboxGroup(frame('B', broken), contextB);
      const block = decoded.blocks[0];
      expect(block.lens === 'characters' && block.malformed[0].title).toBe('Character 3');
    });

    it('requires a motif to quote at least two places', () => {
      const broken = body(exampleA);
      broken.motifs.items[0].evidence = broken.motifs.items[0].evidence.slice(0, 1);
      const decoded = decodeLightboxGroup(frame('A', broken), contextA);
      const motifs = decoded.blocks.find((block) => block.lens === 'motif');
      expect(motifs && motifs.lens === 'motif' ? motifs.malformed.map((item) => item.title) : []).toEqual(['Going down']);
    });
  });
});
