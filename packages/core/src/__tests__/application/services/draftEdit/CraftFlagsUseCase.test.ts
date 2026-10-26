/**
 * CraftFlagsUseCase (ADR 2026-10-21, Amendment 2026-10-26: Slice 3c): one
 * Craft Flags run, from a gesture's target to flags on the document, with no
 * way to write. The pass is a stand-in returning chosen flags; the document
 * and its annotator are the shared fakes. Text adapts public-domain *Alice*,
 * with clichés added.
 */
import { CRAFT_FLAG_CATEGORIES, type CraftFlagFinding, type CraftFlagsPass } from '@/domain/models/CraftFlag';
import type { DraftEditTarget } from '@/domain/models/DraftEdit';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { CraftFlagsUseCase, type CraftFlagsPassPort } from '@/application/services/draftEdit/CraftFlagsUseCase';
import type { CraftFlagsCallResult, CraftFlagsRunRequest } from '@services/craftFlags/CraftFlagsService';
import { FakeAnnotations, FakeDocuments } from '@/__tests__/application/services/draftEdit/fakeDocuments';

const CHAPTER = [
  'Alice was beginning to get very tired of sitting by her sister on the bank, and time stood still.',
  '',
  '“Oh dear! Oh dear! I am as busy as a bee!” said the Rabbit. Alice said, \'My heart was in my throat!\' and laughed.',
  '',
  'When the Rabbit took a watch out of its waistcoat-pocket, a chill ran down her spine, and time stood still.',
  '',
  '```',
  'a chill ran down her spine',
  '```'
].join('\n');

const PASS: CraftFlagsPass = { kind: 'craft', categories: [...CRAFT_FLAG_CATEGORIES] };
const ESTIMATE = { model: 'placeholder/craft-model', calls: 1, inputTokens: 900, outputTokens: 1500, usd: 0.03 };

const flag = (quote: string, { before, ...extra }: Partial<CraftFlagFinding> & { before?: string } = {}): CraftFlagFinding => ({
  anchor: { quote, ...(before ? { before } : {}) },
  category: 'cliche',
  kind: 'cliche',
  why: 'A stopped clock stands in for the jolt.',
  suggestion: 'the pink eyes, as she sees them',
  ...extra
});

function setup(text = CHAPTER, calls: CraftFlagsCallResult[] = [], options: { beforeReply?: (documents: FakeDocuments) => void } = {}) {
  const documents = new FakeDocuments(text);
  const annotations = new FakeAnnotations(documents);
  const requests: CraftFlagsRunRequest[] = [];
  const pass: CraftFlagsPassPort = {
    estimate: jest.fn(async () => ESTIMATE),
    flag: jest.fn(async (request: CraftFlagsRunRequest) => {
      requests.push(request);
      options.beforeReply?.(documents);
      return { kind: 'completed' as const, calls, usage: { promptTokens: 900, completionTokens: 300, totalTokens: 1200, costUsd: 0.02 } };
    })
  };
  const log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
  const useCase = new CraftFlagsUseCase(pass, documents, annotations, log);
  const target = (range?: { start: number; end: number }): DraftEditTarget => ({
    uri: documents.uri,
    version: documents.version,
    text: documents.text,
    languageId: documents.languageId,
    relativePath: 'chapter-01.md',
    ...(range ? { range } : {})
  });
  return { documents, annotations, pass, requests, log, useCase, target };
}

const read = (...findings: CraftFlagFinding[]): CraftFlagsCallResult => ({ kind: 'read', findings, malformed: 0, notesWithheld: 0 });
const rangeOf = (text: string, part: string) => ({ start: text.indexOf(part), end: text.indexOf(part) + part.length });

describe('CraftFlagsUseCase.run', () => {
  it('reads the whole document, protected regions masked, and shows its flags with no quick fix', async () => {
    const { useCase, target, requests, annotations } = setup(CHAPTER, [read(flag('a chill ran down her spine', { before: 'waistcoat-pocket, ' }))]);
    const outcome = await useCase.run(target(), PASS);

    expect(requests[0].passage).not.toContain('```\na chill ran down her spine');
    expect(requests[0].passage).toContain('⟦protected⟧');
    expect(requests[0].categories).toEqual(['cliche']);
    expect(outcome).toMatchObject({ kind: 'completed', flagged: 1, reads: 'document', calls: { total: 1, completed: 1 } });
    expect(annotations.flaggedText()).toEqual(['a chill ran down her spine']);
    expect(annotations.shown[0]).toEqual({
      id: expect.stringMatching(/^craft-/),
      start: expect.any(Number),
      end: expect.any(Number),
      severity: 'info',
      code: 'craft.cliche',
      message: 'A stopped clock stands in for the jolt. One way it could go: the pink eyes, as she sees them.'
    });
    expect(annotations.shown[0]).not.toHaveProperty('fix');
  });

  it('says how often the phrase stands in the narration, speech and protected regions left out', async () => {
    const { useCase, target, annotations } = setup(CHAPTER, [read(flag('time stood still', { before: 'on the bank, and ' }))]);
    await useCase.run(target(), PASS);

    expect(annotations.shown[0].message).toMatch(/ This phrase appears 2 times in this document\.$/);
  });

  it('leaves speech alone: a flag in double- or single-quoted speech is dropped and counted', async () => {
    const { useCase, target, annotations } = setup(CHAPTER, [read(flag('as busy as a bee'), flag('My heart was in my throat'), flag('a chill ran down her spine', { before: 'pocket, ' }))]);
    const outcome = await useCase.run(target(), PASS);

    expect(outcome).toMatchObject({ kind: 'completed', flagged: 1, dropped: { dialogue: 2 } });
    expect(annotations.flaggedText()).toEqual(['a chill ran down her spine']);
  });

  it('drops and counts a quote that does not anchor once, or overlaps an earlier flag', async () => {
    const { useCase, target } = setup(CHAPTER, [read(
      flag('time stood still'),
      flag('a white rabbit with pink eyes'),
      flag('a chill ran down her spine', { before: 'pocket, ' }),
      flag('ran down her spine, and', { kind: 'weighted' })
    )]);
    const outcome = await useCase.run(target(), PASS);

    expect(outcome).toMatchObject({ kind: 'completed', flagged: 1, dropped: { unanchored: 2, overlapping: 1 } });
  });

  it('flags only inside a selection, reading the whole chapter, and keeps the earlier flags outside it', async () => {
    const first = setup(CHAPTER, [read(flag('time stood still', { before: 'on the bank, and ' }), flag('a chill ran down her spine', { before: 'pocket, ' }))]);
    await first.useCase.run(first.target(), PASS);
    expect(first.annotations.flaggedText()).toEqual(['time stood still', 'a chill ran down her spine']);

    const selection = rangeOf(CHAPTER, 'When the Rabbit took a watch out of its waistcoat-pocket, a chill ran down her spine, and time stood still.');
    (first.pass.flag as jest.Mock).mockResolvedValueOnce({ kind: 'completed', calls: [read(flag('time stood still', { before: 'on the bank, and ' }), flag('time stood still', { before: 'her spine, and ' }))] });
    const outcome = await first.useCase.run(first.target(selection), PASS);

    expect((first.pass.flag as jest.Mock).mock.calls[1][0].passage).toContain('Alice was beginning');
    expect(outcome).toMatchObject({ kind: 'completed', flagged: 1, reads: 'document', kept: 1 });
    // The bank's flag, outside the selection, was kept; the selection's own flags replaced the chill.
    expect(first.annotations.flaggedText()).toEqual(['time stood still', 'time stood still']);
  });

  it('reads a selection alone when the document is over the word ceiling, and refuses a whole file over it', async () => {
    const long = `${'Alice sat by her sister on the bank. '.repeat(Math.ceil(PROMPT_BUDGETS.craftFlags.chapterWords / 8) + 10)}\n\nAnd then a chill ran down her spine.`;
    const { useCase, target, requests, pass } = setup(long, [read(flag('a chill ran down her spine'))]);

    expect(await useCase.run(target(), PASS)).toEqual({ kind: 'too-long', words: expect.any(Number), limit: PROMPT_BUDGETS.craftFlags.chapterWords });
    expect(pass.flag).not.toHaveBeenCalled();

    const outcome = await useCase.run(target(rangeOf(long, 'And then a chill ran down her spine.')), PASS);
    expect(requests[0].passage).toBe('And then a chill ran down her spine.');
    expect(outcome).toMatchObject({ kind: 'completed', flagged: 1, reads: 'selection' });
  });

  it('drops a flag the writer edits during the run as stale, and moves the others with their text', async () => {
    const { useCase, target, annotations } = setup(
      CHAPTER,
      [read(flag('time stood still', { before: 'on the bank, and ' }), flag('a chill ran down her spine', { before: 'pocket, ' }))],
      { beforeReply: (documents) => documents.edit([{ offset: CHAPTER.indexOf('time stood still'), length: 4, text: 'the clock' }]) }
    );
    const outcome = await useCase.run(target(), PASS);

    expect(outcome).toMatchObject({ kind: 'completed', flagged: 1, dropped: { stale: 1 } });
    expect(annotations.flaggedText()).toEqual(['a chill ran down her spine']);
  });

  it('shows nothing when the document closes during the run', async () => {
    const { useCase, target, annotations } = setup(CHAPTER, [read(flag('a chill ran down her spine'))], { beforeReply: (documents) => documents.close() });
    expect(await useCase.run(target(), PASS)).toMatchObject({ kind: 'closed', rejectedCalls: { saved: 0, unsaved: 0 } });
    expect(annotations.shows).toEqual([]);
  });

  it('sends nothing for a document that changed before the run, an empty one, or one already running', async () => {
    const changed = setup();
    const stale = changed.target();
    changed.documents.edit([{ offset: 0, length: 0, text: 'So ' }]);
    expect(await changed.useCase.run(stale, PASS)).toEqual({ kind: 'changed' });

    const empty = setup('   \n\n  ');
    expect(await empty.useCase.run(empty.target(), PASS)).toEqual({ kind: 'empty' });

    let release: () => void = () => undefined;
    const busy = setup(CHAPTER, [], { beforeReply: () => undefined });
    (busy.pass.flag as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => {
      release = () => resolve({ kind: 'completed', calls: [] });
    }));
    const running = busy.useCase.run(busy.target(), PASS);
    expect(await busy.useCase.run(busy.target(), PASS)).toEqual({ kind: 'busy' });
    release();
    await running;
    expect(empty.pass.flag).not.toHaveBeenCalled();
    expect(changed.pass.flag).not.toHaveBeenCalled();
  });

  it('counts rejected calls and the notes the fence held back', async () => {
    const { useCase, target } = setup(CHAPTER, [{ kind: 'rejected', saved: true }]);
    expect(await useCase.run(target(), PASS)).toMatchObject({ kind: 'completed', flagged: 0, rejectedCalls: { saved: 1, unsaved: 0 } });

    const withheld = setup(CHAPTER, [{ ...read(flag('a chill ran down her spine')), notesWithheld: 1 } as CraftFlagsCallResult]);
    expect(await withheld.useCase.run(withheld.target(), PASS)).toMatchObject({ notesWithheld: 1 });
  });

  it('dismisses one flag and clears a document\'s, through its own annotator only', async () => {
    const { useCase, target, annotations } = setup(CHAPTER, [read(flag('time stood still', { before: 'on the bank, and ' }), flag('a chill ran down her spine', { before: 'pocket, ' }))]);
    await useCase.run(target(), PASS);
    useCase.dismiss(target().uri, annotations.shown[0].id);
    expect(annotations.flaggedText()).toEqual(['a chill ran down her spine']);
    useCase.clear(target().uri);
    expect(annotations.shown).toEqual([]);
  });
});

describe('CraftFlagsUseCase.plan', () => {
  it('prices a ready run, and names what it reads', async () => {
    const { useCase, target, pass } = setup();
    expect(await useCase.plan(target(), PASS)).toEqual({ kind: 'ready', words: expect.any(Number), reads: 'document', selection: false, estimate: ESTIMATE });
    expect(pass.estimate).toHaveBeenCalledWith({ passage: expect.stringContaining('⟦protected⟧'), categories: ['cliche'] });
  });

  it('says a run is unconfigured when the estimate names no model, and prices nothing that would not be sent', async () => {
    const { useCase, target, pass } = setup();
    (pass.estimate as jest.Mock).mockResolvedValueOnce({ calls: 1, inputTokens: 900, outputTokens: 1500 });
    expect(await useCase.plan(target(), PASS)).toEqual({ kind: 'unconfigured' });

    const empty = setup('\n\n');
    expect(await empty.useCase.plan(empty.target(), PASS)).toEqual({ kind: 'empty' });
    expect(empty.pass.estimate).not.toHaveBeenCalled();
  });
});
