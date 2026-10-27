/**
 * Continuity in a Craft Flags run (ADR 2026-10-21, Amendment 2026-10-26:
 * Slice 3c part 4). A pair is placed on both sides, the flag on the later,
 * the earlier its related place; it is dropped when a section starts inside
 * it, when either side touches speech or a protected region, or when its
 * sides are out of order; and the earlier side follows the writer's edits as
 * the flag does. A section is the chapter's own, never one in code (PR #180
 * F-01); the whole pair lies in one, from its earlier side's start to its
 * later side's end (F-03); and a section the writer adds during the run
 * divides it too (F-02). Text adapts public-domain *Alice*, with slips of
 * continuity added.
 */
import type { CraftFlagFinding } from '@/domain/models/CraftFlag';
import { decodeCraftFlagsReply, readCraftFlagsFrame, CRAFT_FLAGS_CLOSING_SENTINEL, CRAFT_FLAGS_OPENING_SENTINEL } from '@services/craftFlags/CraftFlagsResponseCodec';
import { MODEL, PASS, flag, read, setup } from '@/__tests__/application/services/draftEdit/craftFlagsHarness';

const pair = (later: string, earlier: string, extra: Partial<CraftFlagFinding> = {}): CraftFlagFinding => flag(later, {
  category: 'continuity',
  kind: 'body',
  why: 'The eyes are pink as it runs by and blue when it checks its watch',
  suggestion: undefined,
  earlier: { quote: earlier },
  holds: 'earlier',
  ...extra
});

const BANK = 'A White Rabbit with pink eyes ran close by her.';
const WATCH = 'It took a watch out of its waistcoat-pocket, and its blue eyes blinked.';
const CHAPTER = [BANK, WATCH, '* * *', 'In the evening, Alice sat by the well with green eyes.'].join('\n\n');

describe('A continuity pair (Slice 3c part 4)', () => {
  it('sits on the later side, links the earlier, and says which version the chapter keeps, with no phrase count', async () => {
    const { runOnce, annotations } = setup(CHAPTER, [read(pair('blue eyes', 'pink eyes'))]);
    expect(await runOnce()).toMatchObject({ kind: 'completed', flagged: 1 });

    const [shown] = annotations.shown;
    expect(annotations.flaggedText()).toEqual(['blue eyes']);
    expect(shown).toMatchObject({
      code: 'craft.continuity',
      severity: 'info',
      message: 'The eyes are pink as it runs by and blue when it checks its watch. The rest of the chapter keeps the earlier version.'
    });
    expect(shown.fix).toBeUndefined();
    const pink = CHAPTER.indexOf('pink eyes');
    expect(shown.related).toEqual([{ start: pink, end: pink + 'pink eyes'.length, message: 'The other side of this pair: “pink eyes”' }]);
  });

  it('carries no phrase count, though its words recur: a count says nothing about a contradiction', async () => {
    const text = `${BANK}\n\n${WATCH} Its blue eyes shone.`;
    const { runOnce, annotations } = setup(text, [read(pair('blue eyes', 'pink eyes', { anchor: { quote: 'blue eyes', before: 'and its ' } }))]);
    await runOnce();
    expect(annotations.flaggedText()).toEqual(['blue eyes']);
    expect(annotations.shown[0].message).not.toMatch(/appears/);
  });

  it('sends the chapter\'s breaks with the request, and prices them', async () => {
    const { useCase, target, requests, pass } = setup(CHAPTER, [read(pair('blue eyes', 'pink eyes'))]);
    const begun = useCase.begin(target(), PASS);
    if (begun.kind !== 'gesture') {
      throw new Error('no gesture');
    }
    await useCase.plan(begun.gesture);
    await useCase.run(begun.gesture, { model: MODEL });
    expect(pass.estimate).toHaveBeenCalledWith(expect.objectContaining({ breaks: ['* * *'] }));
    expect(requests[0].breaks).toEqual(['* * *']);
  });

  it('masks protected text in a break line, as the passage does', async () => {
    const text = `${BANK}\n\n## The \`hidden\` hall\n\n${WATCH}`;
    const { runOnce, requests } = setup(text, []);
    await runOnce();
    expect(requests[0].breaks).toHaveLength(1);
    expect(requests[0].breaks?.[0]).toMatch(/^## The .+ hall$/);
    expect(requests[0].breaks?.[0]).not.toContain('hidden');
  });

  it('leaves alone a pair across a scene break, and counts it', async () => {
    const { runOnce, annotations } = setup(CHAPTER, [read(pair('green eyes', 'blue eyes'))]);
    expect(await runOnce()).toMatchObject({ kind: 'completed', flagged: 0, dropped: { acrossBreak: 1 } });
    expect(annotations.shown).toEqual([]);
  });

  it('leaves alone a pair either side of which is speech', async () => {
    const spoken = `${BANK}\n\n“My eyes are blue,” said the Rabbit. ${WATCH}`;
    const { runOnce } = setup(spoken, [read(pair('blue eyes', 'pink eyes'), pair('eyes are blue', 'pink eyes'))]);
    expect(await runOnce()).toMatchObject({ kind: 'completed', flagged: 1, dropped: { dialogue: 1 } });
  });

  it('drops a pair whose earlier side does not come first, or does not anchor, as not placed', async () => {
    const { runOnce } = setup(CHAPTER, [read(pair('pink eyes', 'blue eyes'), pair('blue eyes', 'grey eyes'), pair('blue eyes', 'blue eyes'))]);
    expect(await runOnce()).toMatchObject({ kind: 'completed', flagged: 0, dropped: { unanchored: 3 } });
  });

  it('shows a selection run\'s pair whose later side is in the selection, wherever its earlier side is', async () => {
    const { runOnce, target, annotations } = setup(CHAPTER, [read(pair('blue eyes', 'pink eyes'))]);
    const start = CHAPTER.indexOf(WATCH);
    expect(await runOnce(target({ start, end: start + WATCH.length }))).toMatchObject({ kind: 'completed', flagged: 1 });
    expect(annotations.shown[0].related?.[0].start).toBe(CHAPTER.indexOf('pink eyes'));
  });

  it('moves both sides through the writer\'s edits, and drops the pair when an edit touches its earlier side', async () => {
    const moved = setup(CHAPTER, [read(pair('blue eyes', 'pink eyes'))], {
      beforeReply: (documents) => documents.edit([{ offset: 0, length: 0, text: 'Look! ' }])
    });
    await moved.runOnce();
    expect(moved.annotations.shown[0].related?.[0].start).toBe(CHAPTER.indexOf('pink eyes') + 'Look! '.length);

    const touched = setup(CHAPTER, [read(pair('blue eyes', 'pink eyes'))], {
      beforeReply: (documents) => documents.edit([{ offset: CHAPTER.indexOf('pink'), length: 4, text: 'red' }])
    });
    expect(await touched.runOnce()).toMatchObject({ kind: 'completed', flagged: 0, dropped: { stale: 1 } });
  });

  it('drops a pair whose earlier side the writer puts in quotation marks or in code during the run, though its text is untouched', async () => {
    const pink = CHAPTER.indexOf('pink eyes');
    const quoted = setup(CHAPTER, [read(pair('blue eyes', 'pink eyes'))], {
      beforeReply: (documents) => documents.edit([{ offset: pink, length: 0, text: '“' }, { offset: pink + 'pink eyes'.length, length: 0, text: '”' }])
    });
    expect(await quoted.runOnce()).toMatchObject({ kind: 'completed', flagged: 0, dropped: { dialogue: 1 } });

    const fenced = setup(CHAPTER, [read(pair('blue eyes', 'pink eyes'))], {
      beforeReply: (documents) => documents.edit([{ offset: 0, length: 0, text: '```\n' }, { offset: BANK.length, length: 0, text: '\n```' }])
    });
    expect(await fenced.runOnce()).toMatchObject({ kind: 'completed', flagged: 0, dropped: { protected: 1 } });
  });
});

const PINK = 'Alice had pink eyes.';
const BLUE = 'Alice had blue eyes.';
const TWO = `${PINK}\n\n${BLUE}`;

/** A continuity reply's findings, read through the production frame and codec. */
function replied(flags: unknown[]): readonly CraftFlagFinding[] {
  const frame = `${CRAFT_FLAGS_OPENING_SENTINEL}\n${JSON.stringify({ version: 1, flags })}\n${CRAFT_FLAGS_CLOSING_SENTINEL}`;
  const reply = decodeCraftFlagsReply(readCraftFlagsFrame(frame).root, 'continuity');
  expect(reply.malformed).toBe(0);
  return reply.findings;
}
const why = 'The eyes are pink at first and blue later, with nothing between to change them.';

describe('A continuity pair and the chapter\'s sections (PR #180)', () => {
  it('reads the scene break a heading in code would hide, and leaves the pair across it alone (F-01)', async () => {
    const text = [PINK, '```markdown', '# Fake chapter', '```', '* * *', BLUE].join('\n\n');
    const { runOnce, requests } = setup(text, [read(pair('blue eyes', 'pink eyes'))]);
    expect(await runOnce()).toMatchObject({ kind: 'completed', flagged: 0, dropped: { acrossBreak: 1 } });
    expect(requests[0].breaks).toEqual(['* * *']);
  });

  it('chooses the heading level from the headings outside code (F-01)', async () => {
    const text = [PINK, '```', '# Fake chapter', '```', '## The Pool of Tears', BLUE].join('\n\n');
    const { runOnce, requests } = setup(text, [read(pair('blue eyes', 'pink eyes'))]);
    expect(await runOnce()).toMatchObject({ kind: 'completed', flagged: 0, dropped: { acrossBreak: 1 } });
    expect(requests[0].breaks).toEqual(['## The Pool of Tears']);
  });

  it.each([
    ['a fenced block\'s line', '---'],
    ['a fenced block\'s plain text', 'not an underline']
  ])('reads the scene break whatever %s under prose says, and leaves the pair across it alone (F-01 re-review)', async (_name, fenced) => {
    const text = ['Opening words.', `A caption\n\`\`\`\n${fenced}\n\`\`\``, PINK, '* * *', BLUE].join('\n\n');
    const { runOnce, requests } = setup(text, [read(pair('blue eyes', 'pink eyes'))]);
    expect(await runOnce()).toMatchObject({ kind: 'completed', flagged: 0, dropped: { acrossBreak: 1 } });
    expect(requests[0].breaks).toEqual(['* * *']);
  });

  it.each([
    ['a scene break', '* * *'],
    ['a heading', '## New scene'],
    ['a chapter line', 'Chapter Two']
  ])('drops a pair that %s the writer added between its sides during the run divides (F-02)', async (_name, marker) => {
    const { runOnce, annotations } = setup(TWO, [read(pair('blue eyes', 'pink eyes'))], {
      beforeReply: (documents) => documents.edit([{ offset: TWO.indexOf(BLUE), length: 0, text: `${marker}\n\n` }])
    });
    expect(await runOnce()).toMatchObject({ kind: 'completed', flagged: 0, dropped: { acrossBreak: 1, stale: 0 } });
    expect(annotations.shown).toEqual([]);
  });

  it.each([
    ['a paragraph of prose between its sides', TWO.indexOf(BLUE), 'She walked away.\n\n'],
    ['a break inside code between its sides', TWO.indexOf(BLUE), '```\n\n* * *\n\n```\n\n'],
    ['a break after both its sides', TWO.length, '\n\n* * *\n\nShe slept.']
  ])('keeps a pair through %s, its later side moved with the edit (F-02)', async (_name, offset, inserted) => {
    const { runOnce, annotations } = setup(TWO, [read(pair('blue eyes', 'pink eyes'))], {
      beforeReply: (documents) => documents.edit([{ offset, length: 0, text: inserted }])
    });
    expect(await runOnce()).toMatchObject({ kind: 'completed', flagged: 1 });
    expect(annotations.flaggedText()).toEqual(['blue eyes']);
    expect(annotations.shown[0].related?.[0].start).toBe(TWO.indexOf('pink eyes'));
  });

  it('drops a selection run\'s pair that a break the writer added during the run divides (F-02)', async () => {
    const { runOnce, target, annotations } = setup(TWO, [read(pair('blue eyes', 'pink eyes'))], {
      beforeReply: (documents) => documents.edit([{ offset: TWO.indexOf(BLUE), length: 0, text: '* * *\n\n' }])
    });
    const start = TWO.indexOf(BLUE);
    expect(await runOnce(target({ start, end: start + BLUE.length }))).toMatchObject({ kind: 'completed', flagged: 0, dropped: { acrossBreak: 1 } });
    expect(annotations.shown).toEqual([]);
  });

  it('drops a pair whose later quote starts before a break and holds the fact after it (F-03)', async () => {
    const text = [PINK, 'She walked away.', '* * *', BLUE].join('\n\n');
    const findings = replied([{ original: 'She walked away.\n\n* * *\n\nAlice had blue eyes.', kind: 'body', why, earlier: { original: 'pink eyes' }, holds: 'earlier' }]);
    const { runOnce, requests } = setup(text, [read(...findings)]);
    expect(await runOnce()).toMatchObject({ kind: 'completed', flagged: 0, dropped: { acrossBreak: 1, unanchored: 0 } });
    expect(requests[0].breaks).toEqual(['* * *']);
  });

  it('places a pair against the sections its reply was read with, though a heading added later reads the break as none (F-03)', async () => {
    const text = [PINK, 'She walked away.', '* * *', BLUE].join('\n\n');
    const findings = replied([{ original: 'She walked away.\n\n* * *\n\nAlice had blue eyes.', kind: 'body', why, earlier: { original: 'pink eyes' } }]);
    // A heading after the pair: the live text's signal is headings, and the break divides nothing there.
    const { runOnce } = setup(text, [read(...findings)], {
      beforeReply: (documents) => documents.edit([{ offset: text.length, length: 0, text: '\n\n## Afterword\n\nShe slept.' }])
    });
    expect(await runOnce()).toMatchObject({ kind: 'completed', flagged: 0, dropped: { acrossBreak: 1 } });
  });

  it('drops a pair whose later quote runs on past a break, or whose earlier quote holds one (F-03)', async () => {
    const tail = [PINK, BLUE, '* * *', 'She slept.'].join('\n\n');
    const later = replied([{ original: 'Alice had blue eyes.\n\n* * *\n\nShe slept.', kind: 'body', why, earlier: { original: 'pink eyes' } }]);
    expect(await setup(tail, [read(...later)]).runOnce()).toMatchObject({ kind: 'completed', flagged: 0, dropped: { acrossBreak: 1 } });

    const head = [PINK, '* * *', `She walked away. ${BLUE}`].join('\n\n');
    const earlier = replied([{ original: 'blue eyes', kind: 'body', why, earlier: { original: 'pink eyes.\n\n* * *\n\nShe walked' } }]);
    expect(await setup(head, [read(...earlier)]).runOnce()).toMatchObject({ kind: 'completed', flagged: 0, dropped: { acrossBreak: 1 } });
  });

  it('shows a pair whose broad later quote lies in its earlier side\'s section', async () => {
    const text = [PINK, `She walked away. ${BLUE}`, '* * *', 'She slept.'].join('\n\n');
    const findings = replied([{ original: 'She walked away. Alice had blue eyes.', kind: 'body', why, earlier: { original: 'pink eyes' }, holds: 'earlier' }]);
    const { runOnce, annotations } = setup(text, [read(...findings)]);
    expect(await runOnce()).toMatchObject({ kind: 'completed', flagged: 1 });
    expect(annotations.flaggedText()).toEqual(['She walked away. Alice had blue eyes.']);
  });
});
