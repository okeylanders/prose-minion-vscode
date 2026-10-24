/**
 * A member closed out of its block, moved back into it (Lightbox Slice 4K,
 * epic decision 50; `LightboxBlockFormat`, through the production frame,
 * codec and reply reader). The writer's real case, rebuilt here from group
 * E's worked example since their reply holds manuscript text: group E came
 * back with `finishReason: stop`, its summary block closed one brace early,
 * before its friction (`…"movements":[…]},"friction":"…"}}`), the last brace
 * stray. `friction` landed in the root, the summary had none, and the root's
 * field the format does not define rejected all four blocks. The replies are
 * the worked examples' (the opening of "Alice's Adventures in Wonderland",
 * Lewis Carroll, 1865, public domain).
 */
import type { LightboxReadingGroupId } from '@messages';
import { modelJsonContentMatches, parseModelJson } from '@parsers/ModelJsonRepair';
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { LIGHTBOX_CUT_OFF_REASON, LIGHTBOX_LENS_KEYS } from '@/infrastructure/lightbox/LightboxReadingWire';
import { LIGHTBOX_BLOCK_FIELDS, renestLightboxMembers } from '@/infrastructure/lightbox/LightboxBlockFormat';
import { framedJson, readWorkedExample } from './lightboxReadingFixtures';
import { readWorkedReply } from './lightboxReplyFixtures';

/* eslint-disable @typescript-eslint/no-explicit-any -- reply bodies are edited as plain JSON. */
type Body = Record<string, any>;

const GROUPS: readonly LightboxReadingGroupId[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const bodyOf = (group: LightboxReadingGroupId): Body => framedJson(readWorkedExample(group).response) as Body;
const contextOf = (group: LightboxReadingGroupId) => {
  const example = readWorkedExample(group);
  return { group, lenses: example.lenses, columnCount: group === 'F' ? 0 : example.paragraphs.length };
};
const sentinels = (group: LightboxReadingGroupId) => [`===LIGHTBOX_GROUP_${group}_V1===`, `===END_LIGHTBOX_GROUP_${group}_V1===`];
/** A JSON text between a group's sentinels, as a model writes it. */
const framed = (group: LightboxReadingGroupId, json: string) => [sentinels(group)[0], json, sentinels(group)[1]].join('\n');
/** The worked example's JSON line, as written. */
const jsonOf = (group: LightboxReadingGroupId) => readWorkedExample(group).response.split('\n')[1];
const decode = (group: LightboxReadingGroupId, text: string) => decodeLightboxGroup(text, contextOf(group));
const clean = (group: LightboxReadingGroupId) => decode(group, readWorkedExample(group).response);

/**
 * The real slip, on the example as written: its last block closed one brace
 * early, before its friction, and the closing braces at the end left as they
 * were, so one is stray.
 */
function closedEarly(group: LightboxReadingGroupId): string {
  const json = jsonOf(group);
  const at = json.lastIndexOf(',"friction":"');
  return `${json.slice(0, at)}}${json.slice(at)}`;
}

/** Root members written out in order, `raw` for a member as a model wrote it. */
const rootText = (members: Array<[string, unknown] | { raw: string }>) =>
  `{${members.map((member) => ('raw' in member ? member.raw : `${JSON.stringify(member[0])}:${JSON.stringify(member[1])}`)).join(',')}}`;

/** A block written with its last `fields` outside it: the brace moved, not added, so the text parses. */
function closedBefore(body: Body, key: string, fields: string[]): string {
  const inside = Object.fromEntries(Object.entries(body[key] as Body).filter(([field]) => !fields.includes(field)));
  const outside = fields.map((field) => `,${JSON.stringify(field)}:${JSON.stringify(body[key][field])}`).join('');
  return rootText(Object.entries(body).map(([member, value]) => (member === key
    ? { raw: `${JSON.stringify(key)}:${JSON.stringify(inside)}${outside}` }
    : [member, value])));
}

describe('the real case: group E\'s summary closed before its friction, a stray brace after', () => {
  const slipped = closedEarly('E');

  it('is the shape the writer saw: JSON.parse refuses it, and repaired as before it keeps a root friction', () => {
    expect(slipped).toContain(']},"friction":"');
    expect(slipped.endsWith('."}}')).toBe(true);
    expect(() => JSON.parse(slipped)).toThrow(SyntaxError);
    // The stray brace's repair alone leaves summary's friction in the root: the field that rejected the group.
    const root = parseModelJson(slipped).value as Body;
    expect(Object.keys(root)).toEqual(['version', 'template', 'pressure', 'artifacts', 'summary', 'friction']);
    expect(root.summary.friction).toBeUndefined();
  });

  it('decodes all four blocks as the clean reply does, the summary with its friction', () => {
    const decoded = decode('E', framed('E', slipped));
    const reference = clean('E');
    expect(decoded.blocks).toEqual(reference.blocks);
    expect(decoded.blocks.map((block) => block.lens)).toEqual(['template', 'pressure', 'artifacts', 'summary']);
    expect(decoded.withheld).toEqual([]);
    const summary = decoded.blocks.find((block) => block.lens === 'summary');
    expect(summary?.friction).toBe(bodyOf('E').summary.friction);
    expect(decoded.report).toEqual({ repairs: ['stray-closing-bracket', 'misnested-member'], clipped: 0, ignored: 0, cutOff: false });
  });

  it('lands the group through the reply reader, every lens drawn, each repair logged by its kind', async () => {
    const { outcome, logged, capture } = await readWorkedReply('E', framed('E', slipped));
    const reference = await readWorkedReply('E', readWorkedExample('E').response);
    expect(outcome.status).toBe('ok');
    expect(outcome.withheldBlocks).toEqual([]);
    expect(outcome.tiles).toEqual(reference.outcome.tiles);
    expect(outcome.frictions.map((entry) => entry.lens)).toEqual(['template', 'pressure', 'artifacts', 'summary']);
    expect(logged).toContain('[LightboxReadingRunner] Group E repaired: stray-closing-bracket');
    expect(logged).toContain('[LightboxReadingRunner] Group E repaired: misnested-member');
    expect(logged).not.toContain('ignored');
    expect(logged).not.toContain('rejected');
    expect(capture).not.toHaveBeenCalled();
  });

  it('changes no string or other scalar: the slip and the clean reply hold the same values in the same order', () => {
    // The content guard, on the texts: the slip moved one brace and added one, nothing else.
    expect(modelJsonContentMatches(jsonOf('E'), slipped)).toBe(true);
    const read = parseModelJson(slipped, { rootKeys: true });
    const renested = renestLightboxMembers(read.value as Body, read.rootKeys ?? []);
    expect(renested.moved).toBe(1);
    // And on the root before and after: the repair's own guard.
    expect(modelJsonContentMatches(JSON.stringify(read.value), JSON.stringify(renested.root))).toBe(true);
    expect(renested.root).toEqual(JSON.parse(jsonOf('E')));
  });
});

describe('the same slip in every group\'s last block', () => {
  it.each(GROUPS)('group %s (the Opinion\'s frame included) reads as its clean reply', (group) => {
    const decoded = decode(group, framed(group, closedEarly(group)));
    expect(decoded.blocks).toEqual(clean(group).blocks);
    expect(decoded.withheld).toEqual([]);
    expect(decoded.report?.repairs).toEqual(['stray-closing-bracket', 'misnested-member']);
  });

  it.each(GROUPS)('group %s: any block closed before its friction, the brace moved, reads as its clean reply', (group) => {
    const body = bodyOf(group);
    const blocks = Object.keys(body).filter((key) => key !== 'version');
    expect(blocks.length).toBe(contextOf(group).lenses.length);
    for (const key of blocks) {
      const decoded = decode(group, framed(group, closedBefore(body, key, ['friction'])));
      expect(decoded.blocks).toEqual(clean(group).blocks);
      expect(decoded.report?.repairs).toEqual(['misnested-member']);
    }
  });
});

describe('a run of members closed out together', () => {
  it('moves them all back, in the text\'s order: one misplaced brace', () => {
    const body = bodyOf('E');
    const decoded = decode('E', framed('E', closedBefore(body, 'summary', ['movements', 'friction'])));
    expect(decoded.blocks).toEqual(clean('E').blocks);
    expect(decoded.report).toEqual({ repairs: ['misnested-member'], clipped: 0, ignored: 0, cutOff: false });
  });

  it('moves a template\'s last three fields back past its own block', () => {
    const decoded = decode('E', framed('E', closedBefore(bodyOf('E'), 'template', ['freshness', 'engagement', 'friction'])));
    expect(decoded.blocks).toEqual(clean('E').blocks);
  });
});

describe('nothing moves, and the member is ignored, when', () => {
  const E = bodyOf('E');
  const { friction, ...summaryWithout } = E.summary;
  const members = (...tail: Array<[string, unknown] | { raw: string }>): Array<[string, unknown] | { raw: string }> =>
    [...Object.entries(E).filter(([key]) => key !== 'summary'), ...tail];

  it('the block before it already holds that field', () => {
    const decoded = decode('E', framed('E', rootText(members(['summary', E.summary], ['friction', 'A second friction.']))));
    expect(decoded.blocks).toEqual(clean('E').blocks);
    expect(decoded.report).toEqual({ repairs: [], clipped: 0, ignored: 1, cutOff: false });
  });

  it('the block before it does not define that field, though another block does', () => {
    const engagement = E.template.engagement;
    const decoded = decode('E', framed('E', rootText(members(['summary', E.summary], ['engagement', engagement]))));
    expect(decoded.blocks).toEqual(clean('E').blocks);
    expect(decoded.report?.repairs).toEqual([]);
    expect(decoded.report?.ignored).toBe(1);
  });

  it('the member before it is the version, not a block', () => {
    const decoded = decode('E', framed('E', rootText([['version', 1], ['friction', friction], ...Object.entries(E).slice(1)])));
    expect(decoded.blocks).toEqual(clean('E').blocks);
    expect(decoded.report?.ignored).toBe(1);
  });

  it('something stands between the block and it: a member the format does not define', () => {
    const decoded = decode('E', framed('E', rootText(members(['summary', summaryWithout], ['note', 'An aside.'], ['friction', friction]))));
    expect(decoded.withheld).toEqual([{ lens: 'summary', reason: 'The summary block names no friction; every lens must say where it strains.' }]);
    expect(decoded.report).toEqual({ repairs: [], clipped: 0, ignored: 2, cutOff: false });
  });

  it('a key that looks like an index stands between, though the parsed object lists it first', () => {
    const text = rootText(members(['summary', summaryWithout], ['7', 'seven'], ['friction', friction]));
    // `JSON.parse` puts "7" first, so in the parsed object the summary stands just before the friction.
    expect(Object.keys(JSON.parse(text)).slice(-2)).toEqual(['summary', 'friction']);
    const decoded = decode('E', framed('E', text));
    expect(decoded.withheld).toEqual([{ lens: 'summary', reason: 'The summary block names no friction; every lens must say where it strains.' }]);
    expect(decoded.report?.repairs).toEqual([]);
  });

  it('a root key is written twice, so where its members stood is not known', () => {
    const text = rootText(members(['summary', summaryWithout], ['friction', friction], ['summary', summaryWithout]));
    const decoded = decode('E', framed('E', text));
    expect(decoded.withheld).toEqual([{ lens: 'summary', reason: 'The summary block names no friction; every lens must say where it strains.' }]);
    expect(decoded.report).toEqual({ repairs: [], clipped: 0, ignored: 1, cutOff: false });
  });

  it('the block before it is not an object', () => {
    const decoded = decode('E', framed('E', rootText(members(['summary', 'A synopsis as prose.'], ['friction', friction]))));
    expect(decoded.withheld).toEqual([{ lens: 'summary', reason: 'The summary block broke the format: summary must be plain object' }]);
    expect(decoded.report?.repairs).toEqual([]);
  });
});

describe('two blocks could claim it: only the one just before it does', () => {
  it('a friction after the palette goes to the palette, never past it to the gravity block that lacks one too', () => {
    const A = bodyOf('A');
    delete A.gravity.friction;
    const decoded = decode('A', framed('A', closedBefore(A, 'palette', ['friction'])));
    expect(decoded.withheld).toEqual([{ lens: 'gravity', reason: 'The gravity block names no friction; every lens must say where it strains.' }]);
    const palette = decoded.blocks.find((block) => block.lens === 'palette');
    expect(palette?.friction).toBe(bodyOf('A').palette.friction);
    expect(decoded.report?.repairs).toEqual(['misnested-member']);
  });
});

describe('in a reply cut off at the output ceiling', () => {
  it('moves a finished block\'s member back, and still withholds the block the reply was cut inside', () => {
    const text = closedBefore(bodyOf('A'), 'headline', ['friction']);
    const cut = `${sentinels('A')[0]}\n${text.slice(0, text.indexOf('"motifs"') + 60)}`;
    const decoded = decodeLightboxGroup(cut, { ...contextOf('A'), end: 'ceiling' });
    expect(decoded.blocks).toEqual([clean('A').blocks[0]]);
    expect(decoded.withheld[0]).toEqual({ lens: 'motif', reason: LIGHTBOX_CUT_OFF_REASON });
    expect(decoded.report?.repairs).toEqual(['missing-closing-sentinel', 'missing-closing-bracket', 'misnested-member']);
  });
});

describe('the block table', () => {
  it('names every lens, its friction last, under the lens\'s own key', () => {
    expect(Object.keys(LIGHTBOX_BLOCK_FIELDS).sort()).toEqual(Object.keys(LIGHTBOX_LENS_KEYS).sort());
    for (const fields of Object.values(LIGHTBOX_BLOCK_FIELDS)) {
      expect(fields[fields.length - 1]).toBe('friction');
      expect(new Set(fields).size).toBe(fields.length);
    }
  });

  it('is what each block of every worked example holds, exactly', () => {
    for (const group of GROUPS) {
      const body = bodyOf(group);
      for (const lens of contextOf(group).lenses) {
        expect([group, lens, Object.keys(body[LIGHTBOX_LENS_KEYS[lens]])]).toEqual([group, lens, [...LIGHTBOX_BLOCK_FIELDS[lens]]]);
      }
    }
  });

  it('returns a root it cannot place as it came: keys that are not the root\'s own', () => {
    const root = { version: 1, summary: { synopsis: {} }, friction: 'Thin ground.' };
    expect(renestLightboxMembers(root, ['version', 'summary'])).toEqual({ root, moved: 0 });
    expect(renestLightboxMembers(root, ['version', 'summary', 'friction']).moved).toBe(1);
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
