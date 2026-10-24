/**
 * Fields the format does not define are forgiven in a model's reply (Lightbox
 * Slice 4K, epic decision 50): ignored at every level of groups A–G and the
 * Opinion (F), counted for the log and never named, and never a reason to
 * withhold. A required field that is missing still withholds, so a
 * misspelled one is withheld for the field it stands in for. The replies are
 * the worked examples' (the opening of "Alice's Adventures in Wonderland",
 * Lewis Carroll, 1865, public domain), with fields added as a model adds
 * them.
 */
import type { LightboxReadingGroupId } from '@messages';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { LightboxGroupFrameError } from '@/infrastructure/lightbox/LightboxReadingWire';
import { assembleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingTiles';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { createLightboxTermCounter } from '@/infrastructure/lightbox/LightboxTermCounts';
import { frame, framedJson, readWorkedExample } from './lightboxReadingFixtures';
import { readWorkedReply } from './lightboxReplyFixtures';

/* eslint-disable @typescript-eslint/no-explicit-any -- reply bodies are edited as plain JSON. */
type Body = Record<string, any>;

/** A field name a model might invent from the chapter or its context: it must never be shown or logged. */
const INVENTED = 'Synthetic private note: she never told the Queen';
const GROUPS: readonly LightboxReadingGroupId[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const bodyOf = (response: string): Body => framedJson(response) as Body;

const contextOf = (group: LightboxReadingGroupId) => {
  const example = readWorkedExample(group);
  return { group, lenses: example.lenses, columnCount: group === 'F' ? 0 : example.paragraphs.length };
};

/** Give every object in `value`, the root included, a field the format does not define; returns how many objects. */
function addEverywhere(value: unknown): number {
  if (Array.isArray(value)) {
    return value.reduce((count: number, item) => count + addEverywhere(item), 0);
  }
  if (value === null || typeof value !== 'object') {
    return 0;
  }
  const object = value as Body;
  const inside = Object.values(object).reduce((count: number, item) => count + addEverywhere(item), 0);
  object[INVENTED] = 'copied prose';
  return inside + 1;
}

function assemble(group: LightboxReadingGroupId, decoded: ReturnType<typeof decodeLightboxGroup>) {
  const paragraphs = readWorkedExample(group).paragraphs;
  let id = 0;
  return assembleLightboxGroup(decoded, {
    verifier: createLightboxQuoteVerifier(paragraphs),
    counter: createLightboxTermCounter(paragraphs),
    mintId: () => `t${++id}`
  });
}

describe('a field the format does not define, at every level, is ignored (decision 50)', () => {
  it.each(GROUPS)('group %s: one on every object, root to the deepest quote, reads exactly as the clean reply', (group) => {
    const example = readWorkedExample(group);
    const clean = decodeLightboxGroup(example.response, contextOf(group));
    const body = bodyOf(example.response);
    const objects = addEverywhere(body);
    const decoded = decodeLightboxGroup(frame(group, body), contextOf(group));
    expect(objects).toBeGreaterThan(20);
    expect(decoded.blocks).toEqual(clean.blocks);
    expect(decoded.withheld).toEqual([]);
    expect(decoded.ignored).toEqual([]);
    // Each one counted once, whatever level it stood at.
    expect(decoded.report).toEqual({ repairs: [], clipped: 0, ignored: objects, cutOff: false });
    expect(JSON.stringify(decoded)).not.toMatch(/Synthetic|copied prose/);
  });

  it.each(GROUPS.filter((group) => group !== 'F'))('group %s: the board draws the same tiles, quotes checked as before', (group) => {
    const example = readWorkedExample(group);
    const body = bodyOf(example.response);
    addEverywhere(body);
    const tolerant = assemble(group, decodeLightboxGroup(frame(group, body), contextOf(group)));
    const clean = assemble(group, decodeLightboxGroup(example.response, contextOf(group)));
    expect(tolerant.tiles.length).toBeGreaterThan(0);
    expect(tolerant).toEqual(clean);
  });

  it.each([
    ['the root', (body: Body) => { body[INVENTED] = 1; }],
    ['a block', (body: Body) => { body.headline[INVENTED] = 1; }],
    ['an item', (body: Body) => { body.motifs.items[1][INVENTED] = 1; }],
    ['a nested object: a quote inside an item', (body: Body) => { body.motifs.items[0].evidence[0][INVENTED] = 1; }],
    ['a nested object: a gravity term', (body: Body) => { body.gravity.fields[0].terms[0][INVENTED] = 1; }]
  ])('in %s, keeping the reading', (_level, add) => {
    const example = readWorkedExample('A');
    const body = bodyOf(example.response);
    add(body);
    const decoded = decodeLightboxGroup(frame('A', body), contextOf('A'));
    expect(decoded.blocks).toEqual(decodeLightboxGroup(example.response, contextOf('A')).blocks);
    expect(decoded.report?.ignored).toBe(1);
  });
});

describe('a misspelled required field is still withheld, for the field it stands in for', () => {
  const A = readWorkedExample('A');
  const misspell = (edit: (body: Body) => void) => {
    const body = bodyOf(A.response);
    edit(body);
    return decodeLightboxGroup(frame('A', body), contextOf('A'));
  };
  const rename = (object: Body, from: string, to: string) => {
    object[to] = object[from];
    delete object[from];
  };

  it('a block\'s friction: the block is withheld as naming none', () => {
    const decoded = misspell((body) => rename(body.headline, 'friction', 'frction'));
    expect(decoded.withheld).toEqual([
      { lens: 'headline', reason: 'The headline block names no friction; every lens must say where it strains.' }
    ]);
    // Friction is checked first (D7), so the block is withheld before its fields are read, and none is counted.
    expect(decoded.report?.ignored).toBe(0);
  });

  it('a block\'s field: the block is withheld by the format\'s own name for it', () => {
    const decoded = misspell((body) => rename(body.tension, 'scores', 'score'));
    expect(decoded.withheld).toEqual([
      { lens: 'tension', reason: 'The tension block broke the format: tension is missing required field scores.' }
    ]);
  });

  it('an item\'s field: the item is withheld by its place, its siblings kept', () => {
    const decoded = misspell((body) => rename(body.motifs.items[0], 'title', 'titel'));
    const motifs = decoded.blocks.find((block) => block.lens === 'motif');
    expect(motifs?.lens === 'motif' && motifs.malformed).toEqual([
      { title: 'Motif 1', reason: 'It broke the format: motifs.items[0] is missing required field title.' }
    ]);
    expect(motifs?.lens === 'motif' && motifs.items.length).toBe(bodyOf(A.response).motifs.items.length - 1);
  });

  it('a lens key: the block is reported missing, and the misspelled key ignored', () => {
    const decoded = misspell((body) => rename(body, 'headline', 'headlines'));
    expect(decoded.withheld).toEqual([{ lens: 'headline', reason: 'The reading returned no headline block.' }]);
    expect(decoded.report?.ignored).toBe(1);
  });

  it('the version: the whole group still fails, as any reply without its version does', () => {
    expect(() => misspell((body) => rename(body, 'version', 'verison'))).toThrow(LightboxGroupFrameError);
  });
});

describe('the count is logged, never the names', () => {
  const E = readWorkedExample('E');

  const readReply = (rawContent: string) => readWorkedReply('E', rawContent);

  it('says how many, in one line, and lands every lens with nothing saved for recovery', async () => {
    const body = bodyOf(E.response);
    body[INVENTED] = 'copied prose';
    const { outcome, logged, capture } = await readReply(frame('E', body));
    expect(outcome.status).toBe('ok');
    expect(outcome.withheldBlocks).toEqual([]);
    expect(logged).toContain('[LightboxReadingRunner] Group E ignored 1 field the format does not define');
    expect(capture).not.toHaveBeenCalled();
    expect(`${logged} ${JSON.stringify(outcome)}`).not.toMatch(/Synthetic|copied prose/);
  });

  it('counts every level together, in the plural', async () => {
    const body = bodyOf(E.response);
    body[INVENTED] = 1;
    body.template[INVENTED] = 1;
    body.pressure.threads[0][INVENTED] = 1;
    body.summary.movements[0].boundary[INVENTED] = 1;
    const { outcome, logged } = await readReply(frame('E', body));
    expect(outcome.withheldBlocks).toEqual([]);
    expect(logged).toContain('[LightboxReadingRunner] Group E ignored 4 fields the format does not define');
    expect(logged).not.toContain('Synthetic');
  });

  it('logs nothing of the kind for a reply that holds only what the format defines', async () => {
    const { logged } = await readReply(E.response);
    expect(logged).not.toContain('ignored');
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
