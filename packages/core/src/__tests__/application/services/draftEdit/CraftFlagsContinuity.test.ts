/**
 * Continuity in a Craft Flags run (ADR 2026-10-21, Amendment 2026-10-26:
 * Slice 3c part 4). A pair is placed on both sides, the flag on the later,
 * the earlier its related place; it is dropped across a section start, when
 * either side touches speech or a protected region, or when its sides are
 * out of order; and the earlier side follows the writer's edits as the flag
 * does. Text adapts public-domain *Alice*, with slips of continuity added.
 */
import type { CraftFlagFinding } from '@/domain/models/CraftFlag';
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
