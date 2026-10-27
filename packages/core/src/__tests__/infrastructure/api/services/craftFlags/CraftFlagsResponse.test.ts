/**
 * Reading a Craft Flags reply (ADR 2026-10-21, Amendment 2026-10-26: Slice
 * 3c): the shared frame, and the codec's rule (forgiving per reply,
 * fail-closed per flag), with every note held to the phrasing fence, a
 * register reply's line naming the register its flags shift from (part 2),
 * and gesture strain's own kinds (part 3). Replies are about public-domain
 * *Alice*.
 */
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  CRAFT_FLAGS_CLOSING_SENTINEL,
  CRAFT_FLAGS_OPENING_SENTINEL,
  craftFlagHostWhy,
  decodeCraftFlagsReply,
  readCraftFlagsFrame
} from '@services/craftFlags/CraftFlagsResponseCodec';
import { DraftEditFrameError } from '@services/draftEdit/DraftEditResponseFrame';

const CHILL = {
  original: 'a chill ran down her spine',
  before: 'of its waistcoat-pocket,',
  after: ', and burning',
  kind: 'cliche',
  why: 'A borrowed shiver stands in for what the watch means to her.',
  suggestion: 'the drowsy afternoon falling away from her all at once'
};
const frameOf = (body: unknown) =>
  `${CRAFT_FLAGS_OPENING_SENTINEL}\n${typeof body === 'string' ? body : JSON.stringify(body)}\n${CRAFT_FLAGS_CLOSING_SENTINEL}`;
const read = (flags: unknown[], extra: Record<string, unknown> = {}) =>
  decodeCraftFlagsReply(readCraftFlagsFrame(frameOf({ version: 1, flags, ...extra })).root, 'cliche');

describe('readCraftFlagsFrame', () => {
  it('reads its own sentinels through the shared frame reader, with its tolerances', () => {
    expect(readCraftFlagsFrame(frameOf({ version: 1, flags: [] }))).toEqual({ root: { version: 1, flags: [] }, repairs: [] });
    expect(readCraftFlagsFrame(`\`\`\`\n${frameOf({ version: 1, flags: [] })}\n\`\`\``).repairs).toEqual(['code-fence']);
    expect(readCraftFlagsFrame(`${CRAFT_FLAGS_OPENING_SENTINEL}\n{"version":1,"flags":[]}`).repairs).toEqual(['missing-closing-sentinel']);
    expect(() => readCraftFlagsFrame('===PROOFREAD_V1===\n{"version":1,"issues":[]}\n===END_PROOFREAD_V1===')).toThrow(DraftEditFrameError);
    expect(() => readCraftFlagsFrame('x'.repeat(PROMPT_BUDGETS.craftFlags.responseCharacters + 1))).toThrow('runs past');
  });
});

describe('decodeCraftFlagsReply', () => {
  it('reads a well-formed flag, its context clipped nearest the quote', () => {
    const long = 'x'.repeat(PROMPT_BUDGETS.craftFlags.contextCharacters + 20);
    expect(read([{ ...CHILL, before: `${long}end`, after: `start${long}` }])).toEqual({
      findings: [{
        anchor: {
          quote: CHILL.original,
          before: `${long}end`.slice(-PROMPT_BUDGETS.craftFlags.contextCharacters),
          after: `start${long}`.slice(0, PROMPT_BUDGETS.craftFlags.contextCharacters)
        },
        category: 'cliche',
        kind: 'cliche',
        why: CHILL.why,
        suggestion: CHILL.suggestion
      }],
      malformed: 0,
      notesWithheld: 0,
      ignoredFields: 0
    });
  });

  it('ignores and counts a field the format does not define, a replacement among them: a flag never carries an edit', () => {
    const reply = read([{ ...CHILL, replacement: 'a shiver', confidence: 0.9 }], { model: 'x' });
    expect(reply.ignoredFields).toBe(3);
    expect(reply.findings[0]).not.toHaveProperty('replacement');
  });

  it.each([
    ['a kind outside its category (an idiom is familiar, not a fault)', { ...CHILL, kind: 'idiom' }],
    ['a stock phrase', { ...CHILL, kind: 'stock' }],
    ['no kind', { ...CHILL, kind: undefined }],
    ['an empty quote', { ...CHILL, original: '  ' }],
    ['a quote longer than a phrase', { ...CHILL, original: 'x'.repeat(PROMPT_BUDGETS.craftFlags.quoteCharacters + 1) }],
    ['no why', { ...CHILL, why: ' ' }],
    ['a context that is not a string', { ...CHILL, before: 3 }],
    ['a suggestion that is not a string', { ...CHILL, suggestion: ['the eyes'] }],
    ['not an object', 'a chill']
  ])('drops and counts a flag with %s', (_case, flag) => {
    expect(read([flag, CHILL])).toMatchObject({ malformed: 1, findings: [{ anchor: { quote: CHILL.original } }] });
  });

  it('reads a weighted phrase as a cliché flag\'s kind', () => {
    expect(read([{ ...CHILL, original: 'burning with curiosity', kind: 'weighted' }]).findings[0].kind).toBe('weighted');
  });

  it('replaces a why that breaks the fence with the host\'s line for its kind, and keeps the flag', () => {
    const reply = read([{ ...CHILL, why: 'You should name the cold.' }, { ...CHILL, original: 'burning with curiosity', kind: 'weighted', why: 'It appears 3 times.' }]);
    expect(reply.findings.map((finding) => finding.why)).toEqual([craftFlagHostWhy('cliche'), craftFlagHostWhy('weighted')]);
    expect(craftFlagHostWhy('cliche')).toBe('A phrase worn smooth by use, standing in for something the scene could name exactly.');
    expect(reply.notesWithheld).toBe(2);
  });

  it('withholds a suggestion that breaks the fence, and keeps the flag and its why', () => {
    const reply = read([{ ...CHILL, suggestion: 'Try “the drowsy afternoon”.' }]);
    expect(reply.findings[0]).toEqual(expect.objectContaining({ why: CHILL.why }));
    expect(reply.findings[0]).not.toHaveProperty('suggestion');
    expect(reply.notesWithheld).toBe(1);
  });

  it('counts a flag whose why and suggestion both break the fence once', () => {
    expect(read([{ ...CHILL, why: 'It must go.', suggestion: 'Cut it.' }]).notesWithheld).toBe(1);
  });

  it('reads an empty or absent suggestion as none, and clips long notes', () => {
    const why = `A borrowed shiver ${'and more '.repeat(60)}`;
    const [blank, long] = read([{ ...CHILL, suggestion: '  ' }, { ...CHILL, original: 'time stood still', why }]).findings;
    expect(blank).not.toHaveProperty('suggestion');
    expect(long.why).toHaveLength(PROMPT_BUDGETS.craftFlags.whyCharacters);
    expect(long.why.endsWith('…')).toBe(true);
  });

  it('rejects only a root of the wrong shape', () => {
    expect(() => read([], { version: 2 })).toThrow('version 1');
    expect(() => decodeCraftFlagsReply({ version: 1, issues: [] }, 'cliche')).toThrow('a flags array');
    expect(read([], {}).findings).toEqual([]);
  });
});

describe('decodeCraftFlagsReply: a register reply (Slice 3c part 2)', () => {
  const OKAY = {
    original: 'okay',
    before: 'deciding that it was probably',
    after: ', she ran across the',
    kind: 'period',
    why: 'A later, American word in a narration that keeps an older, formal English.',
    suggestion: 'that it could do no great harm'
  };
  const LINE = 'A wry, formal Victorian English, plain and unhurried, close on Alice.';
  const readRegister = (flags: unknown[], extra: Record<string, unknown> = {}) =>
    decodeCraftFlagsReply(readCraftFlagsFrame(frameOf({ version: 1, flags, ...extra })).root, 'register');

  it('carries the reply\'s register line on each of its findings', () => {
    const reply = readRegister([OKAY, { ...OKAY, original: 'leverage the situation', kind: 'jargon' }], { register: `  ${LINE}  ` });
    expect(reply).toMatchObject({ malformed: 0, notesWithheld: 0, ignoredFields: 0 });
    expect(reply.findings.map((finding) => [finding.kind, finding.register])).toEqual([['period', LINE], ['jargon', LINE]]);
  });

  it.each([[undefined], [''], ['   '], [7], [null]])('rejects a reply with flags and no register line to shift from (%j)', (register) => {
    expect(() => readRegister([OKAY], register === undefined ? {} : { register })).toThrow('must state the register the narration keeps');
  });

  it('counts a malformed flag as a flag: it too needs a line to shift from', () => {
    expect(() => readRegister([{ ...OKAY, kind: 'cliche' }])).toThrow('must state the register the narration keeps');
  });

  it('needs no register line for a reply with nothing to flag', () => {
    expect(readRegister([])).toEqual({ findings: [], malformed: 0, notesWithheld: 0, ignoredFields: 0 });
    expect(readRegister([], { register: LINE }).ignoredFields).toBe(0);
  });

  it('holds the line to the fence, but lets it name a period by its years', () => {
    expect(readRegister([OKAY], { register: 'A plain, cool narration of the 1920s.' }).findings[0].register).toBe('A plain, cool narration of the 1920s.');
    for (const broken of ['You should keep a formal register.', 'A “formal” Victorian English.', 'Keep it formal and plain.']) {
      const reply = readRegister([OKAY], { register: broken });
      expect(reply.findings).toHaveLength(1);
      expect(reply.findings[0]).not.toHaveProperty('register');
      expect(reply.notesWithheld).toBe(1);
    }
  });

  it('clips a long line to its ceiling', () => {
    const line = `A formal Victorian English ${'and plain '.repeat(40)}`;
    const [finding] = readRegister([OKAY], { register: line }).findings;
    expect(finding.register).toHaveLength(PROMPT_BUDGETS.craftFlags.registerCharacters);
    expect(finding.register?.endsWith('…')).toBe(true);
  });

  it('reads only its own kinds, and gives a withheld why its kind\'s definition', () => {
    const reply = readRegister([{ ...OKAY, kind: 'cliche' }, { ...OKAY, kind: 'ornate', why: 'It must go.' }], { register: LINE });
    expect(reply.malformed).toBe(1);
    expect(reply.findings.map((finding) => finding.why)).toEqual([craftFlagHostWhy('ornate')]);
    expect(craftFlagHostWhy('ornate')).toBe('A sudden heightened, ornate passage in narration that keeps a plain register.');
  });

  it('ignores and counts a register line on a cliché reply, a field the cliché format does not define', () => {
    const reply = read([CHILL], { register: LINE });
    expect(reply.ignoredFields).toBe(1);
    expect(reply.findings[0]).not.toHaveProperty('register');
  });
});

describe('decodeCraftFlagsReply: a gesture strain reply (Slice 3c part 3)', () => {
  const NOD = {
    original: 'nodded her head',
    before: 'said Alice. Her sister',
    after: 'and turned a page.',
    kind: 'redundant',
    why: 'The nod already holds the head, so the beat is told twice.',
    suggestion: 'her sister nodded and turned a page'
  };
  const readGesture = (flags: unknown[], extra: Record<string, unknown> = {}) =>
    decodeCraftFlagsReply(readCraftFlagsFrame(frameOf({ version: 1, flags, ...extra })).root, 'gesture');

  it('reads each of its four kinds, and no other category\'s', () => {
    const kinds = ['impossible', 'complicated', 'thin', 'redundant'];
    const reply = readGesture([...kinds.map((kind) => ({ ...NOD, kind })), { ...NOD, kind: 'cliche' }, { ...NOD, kind: 'slang' }]);
    expect(reply.findings.map((finding) => [finding.category, finding.kind])).toEqual(kinds.map((kind) => ['gesture', kind]));
    expect(reply.malformed).toBe(2);
  });

  it('gives a withheld why its kind\'s definition', () => {
    const reply = readGesture([{ ...NOD, kind: 'thin', why: 'This nod should go.' }]);
    expect(reply.findings[0].why).toBe(craftFlagHostWhy('thin'));
    expect(craftFlagHostWhy('thin')).toBe('A stock beat that carries nothing, where the chapter leans on it or it alone carries the feeling at a turn.');
    expect(reply.notesWithheld).toBe(1);
  });

  it('defines no root field of its own: a register line is ignored and counted, and none is needed', () => {
    const reply = readGesture([NOD], { register: 'A plain narration.' });
    expect(reply.ignoredFields).toBe(1);
    expect(reply.findings[0]).not.toHaveProperty('register');
    expect(readGesture([NOD]).findings).toHaveLength(1);
  });
});
