/**
 * The misnested-member repair at its edges (Lightbox Slice 4K; PR #168's
 * review), through the production frame, codec and reply reader:
 * - **F-01.** A reply cut off at the output ceiling keeps only its finished
 *   root members, so a key the cut member repeats was hidden from the
 *   duplicate barrier, and the repair moved a member anyway. The cut
 *   member's key now counts; a cut inside a root key, whose key is not
 *   known, moves nothing; a block whose member the reply was cut inside is
 *   withheld as cut; and the log says where the reply was cut.
 * - **N-01.** The repair's guard writes the root out; a value nested too
 *   deep to write out made it throw, failing the whole group. A guard that
 *   cannot be checked now moves nothing.
 * Built from group E's worked example (the opening of "Alice's Adventures
 * in Wonderland", Lewis Carroll, 1865, public domain).
 */
import { decodeLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingCodec';
import { LIGHTBOX_CUT_OFF_REASON } from '@/infrastructure/lightbox/LightboxReadingWire';
import { renestLightboxMembers } from '@/infrastructure/lightbox/LightboxBlockFormat';
import { framedJson, readWorkedExample } from './lightboxReadingFixtures';
import { readWorkedReply } from './lightboxReplyFixtures';

/* eslint-disable @typescript-eslint/no-explicit-any -- reply bodies are edited as plain JSON. */
type Body = Record<string, any>;

const E = framedJson(readWorkedExample('E').response) as Body;
const [START, END] = ['===LIGHTBOX_GROUP_E_V1===', '===END_LIGHTBOX_GROUP_E_V1==='];
const context = { group: 'E' as const, lenses: readWorkedExample('E').lenses, columnCount: readWorkedExample('E').paragraphs.length };
const clean = decodeLightboxGroup(readWorkedExample('E').response, context);
const { friction, ...summaryWithout } = E.summary as Body;
const NO_FRICTION = 'The summary block names no friction; every lens must say where it strains.';
const RECOVERY = 'Complete response saved for recovery at /workspace/prose-minion/recovery/model-responses/reply.response.txt.';

const member = (key: string, value: unknown) => `${JSON.stringify(key)}:${JSON.stringify(value)}`;
/** Version, template, pressure and artifacts, as the worked example writes them. */
const FIRST_THREE = Object.entries(E).filter(([key]) => key !== 'summary').map(([key, value]) => member(key, value));
/** The writer's slip: the summary closed before its friction, the friction standing in the root after it. */
const SLIPPED = `{${[...FIRST_THREE, member('summary', summaryWithout), member('friction', friction)].join(',')}`;
/** A reply cut off at the output ceiling with `tail` as its last words: no closing brace, no closing sentinel. */
const cutOff = (tail: string) => `${START}\n${SLIPPED}${tail}`;
const decodeCut = (text: string) => decodeLightboxGroup(text, { ...context, end: 'ceiling' });

describe('F-01: the member a reply was cut inside counts against the duplicate barrier', () => {
  it.each([
    ['a second summary, cut mid-string', ',"summary":{"synopsis":{"text":"Bored on the ba'],
    ['a second summary under an escaped key', ',"summ\\u0061ry":{"synopsis":{"text":"Bored on the ba']
  ])('the review\'s witness, %s: nothing moves, and the summary is withheld as cut', async (_case, tail) => {
    const decoded = decodeCut(cutOff(tail));
    expect(decoded.report).toEqual({ repairs: ['missing-closing-sentinel', 'missing-closing-bracket'], clipped: 0, ignored: 1, cutOff: true });
    expect(decoded.blocks).toEqual(clean.blocks.slice(0, 3));
    expect(decoded.withheld).toEqual([{ lens: 'summary', reason: LIGHTBOX_CUT_OFF_REASON }]);
    // Through the reply reader: cut inside the summary, its place in the recovery folder named on it, as any ceiling cut.
    const { outcome, logged, capture } = await readWorkedReply('E', cutOff(tail), 'length');
    expect(logged).toContain('[LightboxReadingRunner] Group E reached the output ceiling: 3 blocks finished, cut inside summary');
    expect(logged).not.toContain('misnested-member');
    expect(outcome.withheldBlocks).toEqual([{ kind: 'synopsis', lens: 'summary', reason: `${LIGHTBOX_CUT_OFF_REASON} ${RECOVERY}` }]);
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it('a second friction, the loose field, cut mid-string: nothing moves, and the summary has none', async () => {
    const text = cutOff(',"friction":"The chase could cl');
    const decoded = decodeCut(text);
    expect(decoded.report?.repairs).not.toContain('misnested-member');
    expect(decoded.withheld).toEqual([{ lens: 'summary', reason: NO_FRICTION }]);
    const { logged } = await readWorkedReply('E', text, 'length');
    expect(logged).toContain('3 blocks finished, cut inside a root member that is not a block');
  });

  it('a cut inside a root key, which so is not known: nothing moves, whatever key it began', async () => {
    const text = cutOff(',"summ');
    const decoded = decodeCut(text);
    expect(decoded.report?.repairs).not.toContain('misnested-member');
    expect(decoded.withheld).toEqual([{ lens: 'summary', reason: NO_FRICTION }]);
    const { logged } = await readWorkedReply('E', text, 'length');
    expect(logged).toContain('3 blocks finished, cut between blocks');
  });

  it('control: a completed duplicate summary still disables the repair, the cut falling later', () => {
    const decoded = decodeCut(cutOff(`,${member('summary', summaryWithout)},"note":"An as`));
    expect(decoded.report?.repairs).not.toContain('misnested-member');
    expect(decoded.withheld).toEqual([{ lens: 'summary', reason: NO_FRICTION }]);
  });

  it.each([
    ['inside an unrelated member', ',"note":"An as', 'cut inside a root member that is not a block'],
    ['before the next key began', ',', 'cut between blocks']
  ])('control: cut %s, the repair is still made, every block read', async (_case, tail, place) => {
    const decoded = decodeCut(cutOff(tail));
    expect(decoded.report?.repairs).toEqual(['missing-closing-sentinel', 'missing-closing-bracket', 'misnested-member']);
    expect(decoded.blocks).toEqual(clean.blocks);
    expect(decoded.withheld).toEqual([]);
    const { logged } = await readWorkedReply('E', cutOff(tail), 'length');
    expect(logged).toContain(`4 blocks finished, ${place}`);
  });
});

describe('F-01: a block whose member the reply was cut inside did not finish', () => {
  const before = `{${[...FIRST_THREE, member('summary', summaryWithout)].join(',')}`;

  it('the friction closed out of the summary, cut mid-string: the summary is withheld as cut, its recovery file named', async () => {
    const text = `${START}\n${before},"friction":"The chase could cl`;
    const decoded = decodeCut(text);
    expect(decoded.withheld).toEqual([{ lens: 'summary', reason: LIGHTBOX_CUT_OFF_REASON }]);
    expect(decoded.blocks).toEqual(clean.blocks.slice(0, 3));
    const { outcome, logged } = await readWorkedReply('E', text, 'length');
    expect(logged).toContain('3 blocks finished, cut inside summary');
    expect(outcome.withheldBlocks).toEqual([{ kind: 'synopsis', lens: 'summary', reason: `${LIGHTBOX_CUT_OFF_REASON} ${RECOVERY}` }]);
  });

  it('a run closed out of it, the last member cut: what finished moves back, and the block is still withheld as cut', () => {
    const { movements, ...synopsisOnly } = summaryWithout;
    const text = `${START}\n{${[...FIRST_THREE, member('summary', synopsisOnly), member('movements', movements)].join(',')},"friction":"The ch`;
    const decoded = decodeCut(text);
    expect(decoded.report?.repairs).toContain('misnested-member');
    expect(decoded.withheld).toEqual([{ lens: 'summary', reason: LIGHTBOX_CUT_OFF_REASON }]);
  });

  it('control: cut inside a root friction after a summary holding its own, the summary is read', async () => {
    const text = `${START}\n{${[...FIRST_THREE, member('summary', E.summary)].join(',')},"friction":"A second fri`;
    const decoded = decodeCut(text);
    expect(decoded.blocks).toEqual(clean.blocks);
    expect(decoded.report?.cutWithin).toBe('root-member');
    const { logged } = await readWorkedReply('E', text, 'length');
    expect(logged).toContain('4 blocks finished, cut inside a root member that is not a block');
  });

  it('cut inside a block the call did not ask for, the report says so without naming anything of the model\'s', () => {
    const text = `${START}\n${before.replace(member('summary', summaryWithout), member('summary', E.summary))},"spark":{"items":[{"ti`;
    const decoded = decodeLightboxGroup(text, { ...context, end: 'ceiling' });
    expect(decoded.blocks).toEqual(clean.blocks);
    expect(decoded.report?.cutWithin).toBe('unrequested-block');
  });
});

describe('N-01: a guard that cannot be checked moves nothing, and fails no sibling block', () => {
  // Deep enough that writing it out overflows the stack under Node 18 and Node 22 alike (each gives out between about
  // 4,000 and 7,000 levels at the top of a process, and sooner inside a test), yet a reply far under the 384,000-character ceiling.
  const DEPTH = 20_000;
  const deep = `${'['.repeat(DEPTH)}${']'.repeat(DEPTH)}`;
  /** Group E with a valid, ignored, deeply nested field in its template, and the summary's friction placed as given. */
  const withDeepField = (summaryMembers: string) => {
    const template = JSON.stringify({ ...E.template, canaryDeep: 0 }).replace('"canaryDeep":0', `"canaryDeep":${deep}`);
    const rest = Object.entries(E).filter(([key]) => key !== 'template' && key !== 'summary').map(([key, value]) => member(key, value));
    return [START, `{${rest[0]},"template":${template},${rest.slice(1).join(',')},${summaryMembers}}`, END].join('\n');
  };
  const slipped = withDeepField(`${member('summary', summaryWithout)},${member('friction', friction)}`);

  it('is a witness: valid JSON, under the ceiling, that the guard cannot write out', () => {
    const json = slipped.split('\n')[1];
    expect(slipped.length).toBeLessThan(384_000);
    const root = JSON.parse(json) as Body;
    expect(() => JSON.stringify(root)).toThrow();
  });

  it('reads the template, pressure and artifacts, and withholds only the summary that lacks its friction', async () => {
    const decoded = decodeLightboxGroup(slipped, context);
    expect(decoded.report).toEqual({ repairs: [], clipped: 0, ignored: 2, cutOff: false });
    expect(decoded.blocks).toEqual(clean.blocks.slice(0, 3));
    expect(decoded.withheld).toEqual([{ lens: 'summary', reason: NO_FRICTION }]);
    const { outcome, capture } = await readWorkedReply('E', slipped);
    expect(outcome.status).toBe('ok');
    expect(outcome.tiles.map((tile) => tile.lens)).toEqual(expect.arrayContaining(['template', 'pressure', 'artifacts']));
    expect(capture).not.toHaveBeenCalled();
  });

  it('control: the same deep field with the friction inside its block reads every block', () => {
    const decoded = decodeLightboxGroup(withDeepField(member('summary', E.summary)), context);
    expect(decoded.blocks).toEqual(clean.blocks);
    expect(decoded.report).toEqual({ repairs: [], clipped: 0, ignored: 1, cutOff: false });
  });

  it('returns the root as it came when the guard cannot be checked', () => {
    const root = JSON.parse(slipped.split('\n')[1]) as Body;
    const renest = renestLightboxMembers(root, Object.keys(root));
    expect(renest.moved).toBe(0);
    expect(renest.root).toBe(root);
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
