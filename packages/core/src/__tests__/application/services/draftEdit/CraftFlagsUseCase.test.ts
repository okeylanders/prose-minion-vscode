/**
 * CraftFlagsUseCase (ADR 2026-10-21, Amendment 2026-10-26: Slice 3c): one
 * Craft Flags run, from a gesture's target to flags on the document, with no
 * way to write. The gesture is held from its first read to its end (PR #177
 * F-02), runs at the model the writer approved (F-01), and leaves speech
 * alone in the live text, with protected syntax set aside (F-03). The pass
 * is a stand-in returning chosen flags; the document and its annotator are
 * the shared fakes. Text adapts public-domain *Alice*, with clichés added.
 */
import type { CraftFlagFinding } from '@/domain/models/CraftFlag';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { CraftFlagsCallResult, CraftFlagsRunRequest } from '@services/craftFlags/CraftFlagsService';
import { CRAFT_FLAGS_CLOSING_SENTINEL, CRAFT_FLAGS_OPENING_SENTINEL, decodeCraftFlagsReply, readCraftFlagsFrame } from '@services/craftFlags/CraftFlagsResponseCodec';
import { withPhraseScanLimit } from '@/__tests__/utils/craftFlags/phraseScanLimit';
import { CHAPTER, ESTIMATE, MODEL, PASS, flag, rangeOf, read, setup } from '@/__tests__/application/services/draftEdit/craftFlagsHarness';

describe('CraftFlagsUseCase.run', () => {
  it('reads the whole document, protected regions masked, and shows its flags with no quick fix', async () => {
    const { runOnce, requests, annotations } = setup(CHAPTER, [read(flag('a chill ran down her spine', { before: 'waistcoat-pocket, ' }))]);
    const outcome = await runOnce();

    expect(requests[0].passage).not.toContain('```\na chill ran down her spine');
    expect(requests[0].passage).toContain('⟦protected⟧');
    expect(requests[0].categories).toEqual(['cliche', 'register', 'gesture']);
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

  describe('a register shift (Slice 3c part 2)', () => {
    const LINE = 'A wry, formal English, plain and unhurried';
    const shift = (quote: string, extra: Partial<CraftFlagFinding> & { before?: string } = {}) => flag(quote, {
      category: 'register',
      kind: 'slang',
      why: 'A casual phrase in a narration that keeps a formal English',
      suggestion: 'she grew weary of the bank',
      register: LINE,
      ...extra
    });

    it('shows its note with the register its reply says the narration keeps, then the host\'s count', async () => {
      const text = 'Alice was totally over sitting by her sister on the bank. Later, she was totally over the daisies too.';
      const { runOnce, annotations } = setup(text, [read(shift('totally over', { before: 'Alice was ' }))]);
      expect(await runOnce()).toMatchObject({ kind: 'completed', flagged: 1 });

      expect(annotations.flaggedText()).toEqual(['totally over']);
      expect(annotations.shown[0]).toMatchObject({
        code: 'craft.register',
        severity: 'info',
        message: 'A casual phrase in a narration that keeps a formal English. One way it could go: she grew weary of the bank.'
          + ' The chapter\'s narration: A wry, formal English, plain and unhurried. This phrase appears 2 times in this document.'
      });
    });

    it('shows its note without the line when the fence withheld it', async () => {
      const { runOnce, annotations } = setup(CHAPTER, [read(shift('time stood still', { before: 'on the bank, and ', register: undefined }))]);
      await runOnce();
      expect(annotations.shown[0].message).not.toMatch(/narration:/);
    });

    it('leaves a character\'s register alone: a shift in speech is dropped and counted', async () => {
      const { runOnce, annotations } = setup(CHAPTER, [read(shift('I am as busy as a bee'), shift('My heart was in my throat'))]);
      expect(await runOnce()).toMatchObject({ kind: 'completed', flagged: 0, dropped: { dialogue: 2 } });
      expect(annotations.shown).toEqual([]);
    });

    it('keeps a cliché and a register shift on the same words: overlaps are weighed within a category', async () => {
      const { runOnce, annotations } = setup(CHAPTER, [
        read(flag('a chill ran down her spine', { before: 'waistcoat-pocket, ' })),
        read(shift('a chill ran down her spine', { before: 'waistcoat-pocket, ', kind: 'ornate' }))
      ]);
      expect(await runOnce()).toMatchObject({ kind: 'completed', flagged: 2, dropped: { overlapping: 0 } });
      expect(annotations.shown.map((annotation) => annotation.code).sort()).toEqual(['craft.cliche', 'craft.register']);
    });
  });

  it('sends every call to the model the writer approved (PR #177 F-01)', async () => {
    const { useCase, target, requests } = setup(CHAPTER, []);
    const begun = useCase.begin(target(), PASS);
    if (begun.kind !== 'gesture') {
      throw new Error('no gesture');
    }
    await useCase.run(begun.gesture, { model: 'placeholder/the-approved-model' });
    expect(requests[0].model).toBe('placeholder/the-approved-model');
  });

  it('says how often the phrase stands in the narration, speech and protected regions left out', async () => {
    const { runOnce, annotations } = setup(CHAPTER, [read(flag('time stood still', { before: 'on the bank, and ' }))]);
    await runOnce();

    expect(annotations.shown[0].message).toMatch(/ This phrase appears 2 times in this document\.$/);
  });

  it('counts the phrase in the live text, once the run has settled (PR #177 N-01)', async () => {
    const text = 'Alice thought time stood still. Later, time stood still.';
    const { runOnce, annotations } = setup(text, [read(flag('time stood still', { before: 'Alice thought ' }))], {
      beforeReply: (documents) => documents.edit([{ offset: text.indexOf(' Later'), length: ' Later, time stood still.'.length, text: '' }])
    });
    await runOnce();

    expect(annotations.flaggedText()).toEqual(['time stood still']);
    expect(annotations.shown[0].message).not.toMatch(/appears/);
  });

  // The second re-review's witness: a reply quoting a phrase that opens on an astral letter
  // never finished its run, because the repeat count resumed inside a surrogate pair. Each
  // run here is bounded by the scan count, never by a clock.
  it.each([
    ['once', 'Alice thought 𝓽𝓲𝓶𝓮 stood still.', undefined],
    ['twice', 'Alice thought 𝓽𝓲𝓶𝓮 stood still. Later, 𝓽𝓲𝓶𝓮 stood still.', 2]
  ])('finishes a run whose flag opens on an astral letter, standing %s (PR #177 F-04)', async (_case, text, repeats) => {
    const reply = `${CRAFT_FLAGS_OPENING_SENTINEL}\n${JSON.stringify({ version: 1, flags: [
      { original: '𝓽𝓲𝓶𝓮 stood still', before: 'Alice thought ', after: '.', kind: 'cliche', why: 'A stopped clock stands in for the jolt.', suggestion: 'the pink eyes, as she sees them' }
    ] })}\n${CRAFT_FLAGS_CLOSING_SENTINEL}`;
    const decoded = decodeCraftFlagsReply(readCraftFlagsFrame(reply).root, 'cliche');
    const { runOnce, annotations } = setup(text, [{ kind: 'read', findings: decoded.findings, malformed: decoded.malformed, notesWithheld: decoded.notesWithheld }]);

    const { result: outcome } = await withPhraseScanLimit(20, runOnce);
    expect(outcome).toMatchObject({ kind: 'completed', flagged: 1 });
    expect(annotations.flaggedText()).toEqual(['𝓽𝓲𝓶𝓮 stood still']);
    if (repeats) {
      expect(annotations.shown[0].message).toMatch(new RegExp(` This phrase appears ${repeats} times in this document\\.$`, 'u'));
    } else {
      expect(annotations.shown[0].message).not.toMatch(/appears/);
    }
  });

  it('leaves speech alone: a flag in double- or single-quoted speech is dropped and counted', async () => {
    const { runOnce, annotations } = setup(CHAPTER, [read(flag('as busy as a bee'), flag('My heart was in my throat'), flag('a chill ran down her spine', { before: 'pocket, ' }))]);
    const outcome = await runOnce();

    expect(outcome).toMatchObject({ kind: 'completed', flagged: 1, dropped: { dialogue: 2 } });
    expect(annotations.flaggedText()).toEqual(['a chill ran down her spine']);
  });

  describe('speech in the live text, protected syntax set aside (PR #177 F-03)', () => {
    const NARRATION = 'Alice said time stood still. Then she left.';

    it.each([
      ['curly double', '“', '”'],
      ['straight double', '"', '"'],
      ['curly single', '‘', '’']
    ])('drops a flag the writer put in %s quotation marks while the run read, its words untouched', async (_kind, open, close) => {
      const { runOnce, annotations } = setup(NARRATION, [read(flag('time stood still'))], {
        beforeReply: (documents) => documents.edit([
          { offset: NARRATION.indexOf('time'), length: 0, text: open },
          { offset: NARRATION.indexOf(' Then'), length: 0, text: close }
        ])
      });
      const outcome = await runOnce();

      expect(outcome).toMatchObject({ kind: 'completed', flagged: 0, dropped: { dialogue: 1, stale: 0 } });
      expect(annotations.flaggedText()).toEqual([]);
    });

    it('keeps the flag when the narration stays narration: the control', async () => {
      const { runOnce, annotations } = setup(NARRATION, [read(flag('time stood still'))], {
        beforeReply: (documents) => documents.edit([{ offset: NARRATION.length, length: 0, text: ' The bank was warm.' }])
      });
      expect(await runOnce()).toMatchObject({ kind: 'completed', flagged: 1, dropped: { dialogue: 0 } });
      expect(annotations.flaggedText()).toEqual(['time stood still']);
    });

    it('never lets a quotation mark inside protected syntax end the speech around it', async () => {
      const text = '“She typed `"` and time stood still,” said Alice.';
      const { runOnce, annotations } = setup(text, [read(flag('time stood still'))]);

      expect(await runOnce()).toMatchObject({ kind: 'completed', flagged: 0, dropped: { dialogue: 1 } });
      expect(annotations.flaggedText()).toEqual([]);
    });

    // The re-review's witness: markup right before a single opener must not hide the speech.
    it.each([
      ['a tag', '<em>‘time stood still,’</em> said Alice.'],
      ['a comment', '<!--note-->‘time stood still,’ said Alice.'],
      ['inline code', '`x`‘time stood still,’ said Alice.']
    ])('drops a flag in single-quoted speech right after %s', async (_case, text) => {
      const { runOnce, annotations } = setup(text, [read(flag('time stood still'))]);

      expect(await runOnce()).toMatchObject({ kind: 'completed', flagged: 0, dropped: { dialogue: 1 } });
      expect(annotations.flaggedText()).toEqual([]);
    });

    it('drops a flag the writer put in tagged single quotation marks while the run read', async () => {
      const { runOnce, annotations } = setup(NARRATION, [read(flag('time stood still'))], {
        beforeReply: (documents) => documents.edit([
          { offset: NARRATION.indexOf('time'), length: 0, text: '<em>‘' },
          { offset: NARRATION.indexOf(' Then'), length: 0, text: '’</em>' }
        ])
      });

      expect(await runOnce()).toMatchObject({ kind: 'completed', flagged: 0, dropped: { dialogue: 1, stale: 0 } });
      expect(annotations.flaggedText()).toEqual([]);
    });

    it.each([
      ['tagged narration', '<em>time stood still</em> and then she left.'],
      ['a word\'s mark beside markup', 'Ali<b>ce</b>’s watch stopped, and time stood still.']
    ])('still flags %s: the control', async (_case, text) => {
      const { runOnce, annotations } = setup(text, [read(flag('time stood still'))]);

      expect(await runOnce()).toMatchObject({ kind: 'completed', flagged: 1, dropped: { dialogue: 0 } });
      expect(annotations.flaggedText()).toEqual(['time stood still']);
    });

    it('still flags narration beside protected syntax holding a quotation mark: the control', async () => {
      const text = 'She typed `"` and time stood still. Then she left.';
      const { runOnce, annotations } = setup(text, [read(flag('time stood still'))]);

      expect(await runOnce()).toMatchObject({ kind: 'completed', flagged: 1, dropped: { dialogue: 0 } });
      expect(annotations.flaggedText()).toEqual(['time stood still']);
    });
  });

  it('drops and counts a quote that does not anchor once, or overlaps an earlier flag', async () => {
    const { runOnce } = setup(CHAPTER, [read(
      flag('time stood still'),
      flag('a white rabbit with pink eyes'),
      flag('a chill ran down her spine', { before: 'pocket, ' }),
      flag('ran down her spine, and', { kind: 'weighted' })
    )]);
    const outcome = await runOnce();

    expect(outcome).toMatchObject({ kind: 'completed', flagged: 1, dropped: { unanchored: 2, overlapping: 1 } });
  });

  it('flags only inside a selection, reading the whole chapter, and keeps the earlier flags outside it', async () => {
    const first = setup(CHAPTER, [read(flag('time stood still', { before: 'on the bank, and ' }), flag('a chill ran down her spine', { before: 'pocket, ' }))]);
    await first.runOnce();
    expect(first.annotations.flaggedText()).toEqual(['time stood still', 'a chill ran down her spine']);

    const selection = rangeOf(CHAPTER, 'When the Rabbit took a watch out of its waistcoat-pocket, a chill ran down her spine, and time stood still.');
    (first.pass.flag as jest.Mock).mockResolvedValueOnce({ kind: 'completed', calls: [read(flag('time stood still', { before: 'on the bank, and ' }), flag('time stood still', { before: 'her spine, and ' }))] });
    const outcome = await first.runOnce(first.target(selection));

    expect((first.pass.flag as jest.Mock).mock.calls[1][0].passage).toContain('Alice was beginning');
    expect(outcome).toMatchObject({ kind: 'completed', flagged: 1, reads: 'document', kept: 1 });
    // The bank's flag, outside the selection, was kept; the selection's own flags replaced the chill.
    expect(first.annotations.flaggedText()).toEqual(['time stood still', 'time stood still']);
  });

  it('reads a selection alone when the document is over the word ceiling, and refuses a whole file over it', async () => {
    const long = `${'Alice sat by her sister on the bank. '.repeat(Math.ceil(PROMPT_BUDGETS.craftFlags.chapterWords / 8) + 10)}\n\nAnd then a chill ran down her spine.`;
    const { useCase, runOnce, target, requests, pass } = setup(long, [read(flag('a chill ran down her spine'))]);

    expect(useCase.begin(target(), PASS)).toEqual({ kind: 'too-long', words: expect.any(Number), limit: PROMPT_BUDGETS.craftFlags.chapterWords });
    expect(pass.flag).not.toHaveBeenCalled();

    const outcome = await runOnce(target(rangeOf(long, 'And then a chill ran down her spine.')));
    expect(requests[0].passage).toBe('And then a chill ran down her spine.');
    expect(outcome).toMatchObject({ kind: 'completed', flagged: 1, reads: 'selection' });
  });

  it('drops a flag the writer edits during the run as stale, and moves the others with their text', async () => {
    const { runOnce, annotations } = setup(
      CHAPTER,
      [read(flag('time stood still', { before: 'on the bank, and ' }), flag('a chill ran down her spine', { before: 'pocket, ' }))],
      { beforeReply: (documents) => documents.edit([{ offset: CHAPTER.indexOf('time stood still'), length: 4, text: 'the clock' }]) }
    );
    const outcome = await runOnce();

    expect(outcome).toMatchObject({ kind: 'completed', flagged: 1, dropped: { stale: 1 } });
    expect(annotations.flaggedText()).toEqual(['a chill ran down her spine']);
  });

  it('shows nothing when the document closes during the run', async () => {
    const { runOnce, annotations } = setup(CHAPTER, [read(flag('a chill ran down her spine'))], { beforeReply: (documents) => documents.close() });
    expect(await runOnce()).toMatchObject({ kind: 'closed', rejectedCalls: { saved: 0, unsaved: 0 } });
    expect(annotations.shows).toEqual([]);
  });

  it('takes no gesture for a document that changed before it, an empty one, or one already held', () => {
    const changed = setup();
    const stale = changed.target();
    changed.documents.edit([{ offset: 0, length: 0, text: 'So ' }]);
    expect(changed.useCase.begin(stale, PASS)).toEqual({ kind: 'changed' });

    const empty = setup('   \n\n  ');
    expect(empty.useCase.begin(empty.target(), PASS)).toEqual({ kind: 'empty' });

    const held = setup();
    const first = held.useCase.begin(held.target(), PASS);
    expect(first.kind).toBe('gesture');
    expect(held.useCase.begin(held.target(), PASS)).toEqual({ kind: 'busy' });
    if (first.kind === 'gesture') {
      held.useCase.release(first.gesture);
    }
    expect(held.useCase.begin(held.target(), PASS).kind).toBe('gesture');
  });

  it('counts rejected calls and the notes the fence held back', async () => {
    const { runOnce } = setup(CHAPTER, [{ kind: 'rejected', saved: true }]);
    expect(await runOnce()).toMatchObject({ kind: 'completed', flagged: 0, rejectedCalls: { saved: 1, unsaved: 0 } });

    const withheld = setup(CHAPTER, [{ ...read(flag('a chill ran down her spine')), notesWithheld: 1 } as CraftFlagsCallResult]);
    expect(await withheld.runOnce()).toMatchObject({ notesWithheld: 1 });
  });

  it('dismisses one flag and clears a document\'s, through its own annotator only', async () => {
    const { useCase, runOnce, target, annotations } = setup(CHAPTER, [read(flag('time stood still', { before: 'on the bank, and ' }), flag('a chill ran down her spine', { before: 'pocket, ' }))]);
    await runOnce();
    useCase.dismiss(target().uri, annotations.shown[0].id);
    expect(annotations.flaggedText()).toEqual(['a chill ran down her spine']);
    useCase.clear(target().uri);
    expect(annotations.shown).toEqual([]);
  });
});

describe('CraftFlagsUseCase: the gesture held from its first read (PR #177 F-02)', () => {
  /** A gesture whose price is held until the test lets it go. */
  function heldPricing() {
    const context = setup(CHAPTER, [read(flag('a chill ran down her spine', { before: 'pocket, ' }))]);
    let release: () => void = () => undefined;
    (context.pass.estimate as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => {
      release = () => resolve(ESTIMATE);
    }));
    const begun = context.useCase.begin(context.target(), PASS);
    if (begun.kind !== 'gesture') {
      throw new Error('no gesture');
    }
    return { ...context, gesture: begun.gesture, letPricingGo: () => release() };
  }

  it('prices a ready gesture, naming the model it priced', async () => {
    const { useCase, gesture, pass, letPricingGo } = heldPricing();
    const planned = useCase.plan(gesture);
    letPricingGo();
    expect(await planned).toEqual({ kind: 'ready', words: expect.any(Number), reads: 'document', selection: false, estimate: ESTIMATE });
    expect(pass.estimate).toHaveBeenCalledWith({ passage: expect.stringContaining('⟦protected⟧'), categories: ['cliche', 'register', 'gesture'] });
  });

  it('shows no confirmation when the document closes and reopens at its version while it is priced', async () => {
    const { useCase, gesture, documents, pass, letPricingGo } = heldPricing();
    const planned = useCase.plan(gesture);
    documents.close();
    documents.open = true;
    letPricingGo();

    expect(await planned).toEqual({ kind: 'changed' });
    expect(pass.flag).not.toHaveBeenCalled();
  });

  it('sends nothing when the lifetime ends after the confirmation, before the calls go out', async () => {
    const { useCase, gesture, documents, pass, annotations, letPricingGo } = heldPricing();
    const planned = useCase.plan(gesture);
    letPricingGo();
    expect((await planned).kind).toBe('ready');
    documents.close();
    documents.open = true;

    expect(await useCase.run(gesture, { model: MODEL })).toEqual({ kind: 'changed' });
    expect(pass.flag).not.toHaveBeenCalled();
    expect(annotations.shows).toEqual([]);
  });

  it('sends nothing when the lifetime ends while the prompts load, just before the calls go out', async () => {
    const context = setup(CHAPTER, [read(flag('a chill ran down her spine', { before: 'pocket, ' }))]);
    (context.pass.flag as jest.Mock).mockImplementationOnce(async (request: CraftFlagsRunRequest) => {
      context.documents.close();
      context.documents.open = true;
      return request.stillCurrent?.() === false ? { kind: 'ended' } : { kind: 'completed', calls: [] };
    });
    expect(await context.runOnce()).toEqual({ kind: 'changed' });
    expect(context.annotations.shows).toEqual([]);
  });

  it('follows edits made while it was priced, as it follows edits made while the model read', async () => {
    const { useCase, gesture, documents, annotations, letPricingGo } = heldPricing();
    const planned = useCase.plan(gesture);
    documents.edit([{ offset: 0, length: 0, text: 'So, ' }]);
    letPricingGo();
    await planned;

    expect(await useCase.run(gesture, { model: MODEL })).toMatchObject({ kind: 'completed', flagged: 1 });
    expect(annotations.flaggedText()).toEqual(['a chill ran down her spine']);
  });

  it('ends a released gesture: it frees its document and refuses to run', async () => {
    const { useCase, gesture, target, letPricingGo } = heldPricing();
    const planned = useCase.plan(gesture);
    letPricingGo();
    await planned;
    useCase.release(gesture);
    useCase.release(gesture);

    await expect(useCase.run(gesture, { model: MODEL })).rejects.toThrow('already run or been released');
    expect(useCase.begin(target(), PASS).kind).toBe('gesture');
  });

  it('runs a gesture once, and frees its document however the run ends', async () => {
    const context = setup(CHAPTER, []);
    const begun = context.useCase.begin(context.target(), PASS);
    if (begun.kind !== 'gesture') {
      throw new Error('no gesture');
    }
    (context.pass.flag as jest.Mock).mockRejectedValueOnce(new Error('prompts missing'));
    await expect(context.useCase.run(begun.gesture, { model: MODEL })).rejects.toThrow('prompts missing');
    await expect(context.useCase.run(begun.gesture, { model: MODEL })).rejects.toThrow('already run or been released');
    expect(context.useCase.begin(context.target(), PASS).kind).toBe('gesture');
  });

  it('says a gesture is unconfigured when the estimate names no model, and ends it', async () => {
    const { useCase, target, pass } = setup();
    (pass.estimate as jest.Mock).mockResolvedValueOnce({ calls: 1, inputTokens: 900, outputTokens: 1500 });
    const begun = useCase.begin(target(), PASS);
    if (begun.kind !== 'gesture') {
      throw new Error('no gesture');
    }
    expect(await useCase.plan(begun.gesture)).toEqual({ kind: 'unconfigured' });
    expect(useCase.begin(target(), PASS).kind).toBe('gesture');
  });
});
