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
      ['no closing sentinel', (text: string) => text.replace('\n===END_LIGHTBOX_GROUP_A_V1===', '')],
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

    it('names unknown fields briefly, since the reason is logged', () => {
      const long = 'x'.repeat(200);
      const text = exampleA.response.replace('{"version":1', `{"version":1,"${long}":1,"b":1,"c":1,"d":1`);
      expect(() => decodeLightboxGroup(text, contextA))
        .toThrow(`The group A response has 4 unknown fields: "${'x'.repeat(24)}", "b", "c", …`);
    });

    it('refuses a response over the character ceiling', () => {
      const huge = frame('A', { version: 1, headline: { padding: 'x'.repeat(40_000) } });
      expect(() => decodeLightboxGroup(huge, contextA)).toThrow(/exceeds 32,000 characters/);
    });

    it('accepts CRLF line endings and surrounding whitespace', () => {
      const crlf = `\n  ${exampleA.response.replace(/\n/g, '\r\n')}  \n`;
      expect(decodeLightboxGroup(crlf, contextA).blocks).toHaveLength(3);
    });
  });

  describe('per block', () => {
    it('withholds a malformed block by lens while its siblings survive', () => {
      const broken = body(exampleA);
      broken.motifs.items = 'three motifs';
      const decoded = decodeLightboxGroup(frame('A', broken), contextA);
      expect(decoded.blocks.map((block) => block.lens)).toEqual(['headline', 'tension']);
      expect(decoded.withheld).toEqual([
        { lens: 'motif', reason: expect.stringContaining('motifs.items must be') }
      ]);
      const assembled = assemble(decoded, exampleA.paragraphs);
      expect(assembled.withheldBlocks).toEqual([{ kind: 'motif', lens: 'motif', reason: decoded.withheld[0].reason }]);
      expect(assembled.tiles.map((tile) => tile.kind)).toEqual(['headline', 'tension-arc']);
    });

    it('fails a block with no friction, naming the rule', () => {
      const broken = body(exampleB);
      delete broken.voice.friction;
      const decoded = decodeLightboxGroup(frame('B', broken), contextB);
      expect(decoded.blocks.map((block) => block.lens)).toEqual(['characters']);
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
      expect(decoded.ignored).toEqual(['motif']);
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

    it('refuses an affinity outside 0–1 and a fractional paragraph number', () => {
      const affinity = body(exampleC);
      affinity.genre.neighbors[0].affinity = 1.4;
      const decoded = decodeLightboxGroup(frame('C', affinity), contextC);
      expect(decoded.blocks).toHaveLength(1);
      expect(decoded.blocks[0].lens === 'genre' && decoded.blocks[0].malformed[0].reason).toContain('from 0 to 1');

      const paragraph = body(exampleA);
      paragraph.headline.evidence[0].para = 2.5;
      expect(decodeLightboxGroup(frame('A', paragraph), contextA).withheld[0].reason).toContain('a paragraph number');
    });
  });

  describe('per item', () => {
    it('withholds one malformed motif by its title while the other motifs land', () => {
      const broken = body(exampleA);
      broken.motifs.items[1].claim = 'x'.repeat(400);
      const decoded = decodeLightboxGroup(frame('A', broken), contextA);
      const motifs = decoded.blocks.find((block) => block.lens === 'motif');
      expect(motifs && motifs.lens === 'motif' ? motifs.items.map((item) => item.title) : [])
        .toEqual(['Going down', 'Hurry and leisure']);
      const assembled = assemble(decoded, exampleA.paragraphs);
      expect(assembled.withheldClaims).toEqual([{
        kind: 'motif',
        lens: 'motif',
        title: 'Pictures and conversations',
        reason: expect.stringContaining('at most 320 characters'),
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
