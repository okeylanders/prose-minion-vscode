/**
 * Proofread commands (Draft Edit Slices 1 to 3; ADR 2026-10-21 D5, D6, D7, D8):
 * what is refused before anything is sent, the long-file confirmation, how
 * an outcome is presented, how Fix and the quick fixes ask core, and the
 * writer's spelling convention and word list. The host and the runner are fakes, so no
 * VS Code API is mocked. Passages are public domain (Lewis Carroll, 1865).
 */

// The whole core barrel cannot load under jest (an ESM dependency), so the
// runtime values these commands use are required from their modules.
jest.mock('@prose-minion/core', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the mocked barrel's export name.
  DRAFT_EDIT_LANGUAGE_IDS: jest.requireActual('@/domain/models/DraftEdit').DRAFT_EDIT_LANGUAGE_IDS,
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the mocked barrel's export name.
  DRAFT_EDIT_PASS_POLICIES: jest.requireActual('@/domain/models/DraftEdit').DRAFT_EDIT_PASS_POLICIES,
  reasoningLevelOf: jest.requireActual('@/domain/models/ReasoningLevel').reasoningLevelOf,
  describeDraftEditOutcome: jest.requireActual('@/application/services/draftEdit/draftEditSummary').describeDraftEditOutcome,
  describeQuickFixOutcome: jest.requireActual('@/application/services/draftEdit/draftEditSummary').describeQuickFixOutcome,
  isProofreadSpellingConvention: jest.requireActual('@/domain/models/DraftEdit').isProofreadSpellingConvention,
  proofreadWordList: jest.requireActual('@/utils/proofread/proofreadWordList').proofreadWordList
}));

import type {
  DraftEditBegin,
  DraftEditGesture,
  DraftEditOutcome,
  DraftEditQuickFixOutcome,
  DraftEditRunHooks,
  DraftEditRunPlan,
  DraftEditTarget,
  ProofreadPass
} from '@prose-minion/core';
import {
  OPEN_SETTINGS_COMMAND,
  REVIEW_HINT,
  SHOW_PROBLEMS_COMMAND,
  clearProofreadFlags,
  dismissProofreadIssue,
  fixAllProofreadIssues,
  proofreadAndFix,
  proofreadAndFlag,
  replaceProofreadIssue,
  type ProofreadCommandHost,
  type ProofreadEditorSnapshot,
  type ProofreadRunner
} from '@app/application/commands/proofreadCommands';

const TEXT = 'Alice was beginning to get very tired of sitting by her sister on the bank.';
const NONE = { unanchored: 0, protected: 0, overlapping: 0, stale: 0, malformed: 0, accepted: 0 };
const COMPLETED: DraftEditOutcome = {
  kind: 'completed', flagged: 2, judgmentCalls: 1, dropped: NONE, rejectedChunks: { saved: 0, unsaved: 0 }, chunks: { total: 1, completed: 1 }
};

const editor = (overrides: Partial<ProofreadEditorSnapshot> = {}): ProofreadEditorSnapshot => ({
  uri: 'file:///workspace/chapter-01.md',
  version: 4,
  text: TEXT,
  languageId: 'markdown',
  label: 'chapter-01.md',
  ...overrides
});

function setup(options: {
  active?: ProofreadEditorSnapshot;
  plan?: Partial<DraftEditRunPlan>;
  /** Why no gesture could be taken; absent, one is. */
  refused?: Exclude<DraftEditBegin, { kind: 'gesture' }>;
  confirm?: boolean;
  outcome?: DraftEditOutcome;
  choice?: string;
  fixReview?: 'preview' | 'apply';
  spelling?: string;
  wordList?: unknown;
  reasoning?: unknown;
  quickFix?: DraftEditQuickFixOutcome;
} = {}) {
  const calls: string[] = [];
  const host = {
    activeEditor: jest.fn(() => options.active),
    document: jest.fn((uri: string) => (options.active?.uri === uri ? options.active : undefined)),
    fixReview: jest.fn(() => options.fixReview ?? 'preview'),
    spellingConvention: jest.fn(() => options.spelling),
    wordList: jest.fn(() => options.wordList),
    proofreadReasoning: jest.fn(() => options.reasoning),
    confirm: jest.fn(async () => {
      calls.push('confirm');
      return options.confirm ?? false;
    }),
    withProgress: jest.fn(async <T>(title: string, task: (signal: AbortSignal, report: (message: string) => void) => Promise<T>) => {
      calls.push(`progress:${title}`);
      return task(new AbortController().signal, (message) => calls.push(`report:${message}`));
    }),
    showInformation: jest.fn(async () => options.choice),
    showWarning: jest.fn(async () => options.choice),
    executeCommand: jest.fn()
  } satisfies ProofreadCommandHost;
  const gesture: DraftEditGesture = { uri: 'file:///workspace/chapter-01.md' };
  let begun: ProofreadPass | undefined;
  const runner = {
    begin: jest.fn((target: DraftEditTarget, pass: ProofreadPass): DraftEditBegin => {
      calls.push('begin');
      begun = pass;
      return options.refused ?? {
        kind: 'gesture',
        gesture,
        plan: { words: 14, chunks: 1, wholeFile: target.range === undefined, needsConfirmation: false, ...options.plan }
      };
    }),
    run: jest.fn(async (_gesture: DraftEditGesture, _signal?: AbortSignal, hooks?: DraftEditRunHooks) => {
      if (begun?.output === 'fix') {
        hooks?.onReview?.(2);
      }
      return options.outcome ?? COMPLETED;
    }),
    release: jest.fn(() => {
      calls.push('release');
    }),
    applyShown: jest.fn(async (): Promise<DraftEditQuickFixOutcome> => options.quickFix ?? {
      kind: 'done', refused: 0, review: 'direct', answer: 'submitted', applied: 1, notApplied: 0, unknown: 0
    }),
    dismiss: jest.fn(),
    clear: jest.fn()
  } satisfies ProofreadRunner;
  return { host, runner, calls, gesture };
}

/** Let the notification's `.then` run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('proofreadAndFlag', () => {
  it('refuses with no editor, or a language it does not read, sending nothing', async () => {
    const none = setup();
    await expect(proofreadAndFlag(none.host, none.runner)).resolves.toEqual({
      kind: 'refused', message: 'Open a Markdown or plain-text file to proofread.'
    });
    const json = setup({ active: editor({ languageId: 'json' }) });
    await expect(proofreadAndFlag(json.host, json.runner)).resolves.toEqual({
      kind: 'refused', message: 'Proofread reads Markdown and plain-text files.'
    });
    expect(json.host.showWarning).toHaveBeenCalledWith('Proofread reads Markdown and plain-text files.');
    expect(json.runner.run).not.toHaveBeenCalled();
  });

  it.each(['markdown', 'plaintext'])('proofreads a whole %s document captured at the gesture, flagging only', async (languageId) => {
    const { host, runner, calls, gesture } = setup({ active: editor({ languageId }) });
    await proofreadAndFlag(host, runner);

    expect(runner.begin).toHaveBeenCalledWith(
      { uri: 'file:///workspace/chapter-01.md', version: 4, text: TEXT, languageId, relativePath: 'chapter-01.md' },
      { kind: 'proofread', output: 'flag', reasoning: 'light' }
    );
    expect(runner.run).toHaveBeenCalledWith(gesture, expect.any(AbortSignal), expect.any(Object));
    expect(calls).toEqual(['begin', 'progress:Proofreading chapter-01.md…', 'release']);
    expect(host.confirm).not.toHaveBeenCalled();
  });

  it('passes a selection as the target range', async () => {
    const { host, runner, calls } = setup({ active: editor({ selection: { start: 6, end: 9 } }) });
    await proofreadAndFlag(host, runner);

    expect(runner.begin.mock.calls[0]).toEqual([expect.objectContaining({ range: { start: 6, end: 9 } }), expect.anything()]);
    expect(calls).toEqual(['begin', 'progress:Proofreading chapter-01.md (selection)…', 'release']);
  });

  it('asks before a long whole-file run, naming words and calls, and sends nothing when declined', async () => {
    const { host, runner } = setup({ active: editor(), plan: { words: 16_250, chunks: 14, needsConfirmation: true } });
    await expect(proofreadAndFlag(host, runner)).resolves.toEqual({ kind: 'declined' });

    expect(host.confirm).toHaveBeenCalledWith(
      'Proofread all 16,250 words of chapter-01.md? That is 14 requests to your Proofread model.',
      'Proofread'
    );
    expect(runner.run).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalledTimes(1);
  });

  it('runs a long whole-file run once confirmed', async () => {
    const { host, runner } = setup({ active: editor(), plan: { needsConfirmation: true }, confirm: true });
    await expect(proofreadAndFlag(host, runner)).resolves.toEqual({ kind: 'ran', outcome: COMPLETED });
    expect(runner.run).toHaveBeenCalledTimes(1);
  });

  it('takes the gesture before the confirmation is awaited, and releases it however the command ends (PR #183 F-02)', async () => {
    const declined = setup({ active: editor(), plan: { needsConfirmation: true } });
    await proofreadAndFlag(declined.host, declined.runner);
    expect(declined.calls).toEqual(['begin', 'confirm', 'release']);

    const confirmed = setup({ active: editor(), plan: { needsConfirmation: true }, confirm: true });
    await proofreadAndFix(confirmed.host, confirmed.runner);
    expect(confirmed.calls).toEqual(['begin', 'confirm', 'progress:Proofreading chapter-01.md…', `report:${REVIEW_HINT}`, 'release']);

    const failing = setup({ active: editor(), plan: { needsConfirmation: true }, confirm: true });
    failing.runner.run.mockRejectedValueOnce(new Error('provider down'));
    await expect(proofreadAndFlag(failing.host, failing.runner)).rejects.toThrow('provider down');
    expect(failing.runner.release).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ kind: 'changed' } as const, 'showWarning', 'chapter-01.md changed before Proofread could start, so nothing was sent. Run it again.'],
    [{ kind: 'busy' } as const, 'showInformation', 'Proofread is already running on chapter-01.md.'],
    [{ kind: 'empty' } as const, 'showInformation', 'Nothing to proofread in chapter-01.md.']
  ])('says why no gesture could be taken (%p), asking and sending nothing', async (refused, method, message) => {
    const { host, runner } = setup({ active: editor(), plan: { needsConfirmation: true }, refused });
    await expect(proofreadAndFlag(host, runner)).resolves.toEqual({ kind: 'ran', outcome: refused });

    expect(host[method as 'showWarning' | 'showInformation']).toHaveBeenCalledWith(message);
    expect(host.confirm).not.toHaveBeenCalled();
    expect(host.withProgress).not.toHaveBeenCalled();
    expect(runner.run).not.toHaveBeenCalled();
    expect(runner.release).not.toHaveBeenCalled();
  });

  it('offers Show Problems when flags were shown', async () => {
    const { host, runner } = setup({ active: editor(), choice: 'Show Problems' });
    await proofreadAndFlag(host, runner);
    await settle();

    expect(host.showInformation).toHaveBeenCalledWith('Proofread chapter-01.md: 2 issues flagged (1 needs your judgment)', 'Show Problems');
    expect(host.executeCommand).toHaveBeenCalledWith(SHOW_PROBLEMS_COMMAND);
  });

  it('offers no action when nothing was flagged', async () => {
    const { host, runner } = setup({ active: editor(), outcome: { ...COMPLETED, flagged: 0, judgmentCalls: 0 } });
    await proofreadAndFlag(host, runner);
    expect(host.showInformation).toHaveBeenCalledWith('Proofread chapter-01.md: no issues found');
  });

  it('offers Open Settings when there is no API key', async () => {
    const { host, runner } = setup({ active: editor(), outcome: { kind: 'unconfigured' }, choice: 'Open Settings' });
    await proofreadAndFlag(host, runner);
    await settle();

    expect(host.showWarning).toHaveBeenCalledWith('Proofread needs an OpenRouter API key.', 'Open Settings');
    expect(host.executeCommand).toHaveBeenCalledWith(OPEN_SETTINGS_COMMAND);
  });

  it('says what to change when reasoning off meets a model that always reasons (PR #181 F-01)', async () => {
    const { host, runner } = setup({ active: editor(), outcome: { kind: 'reasoning-required', model: 'test/always-reasons' } });
    await proofreadAndFlag(host, runner);

    expect(host.showWarning).toHaveBeenCalledWith(
      'Proofread sent nothing: the model catalog says test/always-reasons always reasons, so it cannot be asked for reasoning off. '
        + 'Set proseMinion.proofread.reasoning to light or higher, or choose another model in proseMinion.proofreadModel.'
    );
    expect(host.executeCommand).not.toHaveBeenCalled();
  });

  it('warns when the run was interrupted', async () => {
    const interrupted = { cause: 'provider' as const, message: 'OpenRouter is rate limiting requests.' };
    const { host, runner } = setup({ active: editor(), outcome: { ...COMPLETED, interrupted } });
    await proofreadAndFlag(host, runner);
    expect(host.showWarning).toHaveBeenCalledWith(expect.stringContaining('OpenRouter is rate limiting requests.'), 'Show Problems');
  });
});

describe('clearProofreadFlags and dismissProofreadIssue', () => {
  it('clears the given document, else the active one, else every document', () => {
    const withEditor = setup({ active: editor() });
    clearProofreadFlags(withEditor.host, withEditor.runner, 'file:///workspace/other.md');
    clearProofreadFlags(withEditor.host, withEditor.runner);
    const without = setup();
    clearProofreadFlags(without.host, without.runner);

    expect(withEditor.runner.clear.mock.calls).toEqual([['file:///workspace/other.md'], ['file:///workspace/chapter-01.md']]);
    expect(without.runner.clear.mock.calls).toEqual([[undefined]]);
  });

  it('dismisses one flag, ignoring arguments that are not strings', () => {
    const { runner } = setup();
    dismissProofreadIssue(runner, 'file:///workspace/chapter-01.md', 'proofread-2');
    dismissProofreadIssue(runner, 42, 'proofread-2');
    expect(runner.dismiss.mock.calls).toEqual([['file:///workspace/chapter-01.md', 'proofread-2']]);
  });
});

describe('proofreadAndFix (Slice 2)', () => {
  it('runs the Fix pass through review by default, and says how to take the fixes while the preview is open', async () => {
    const { host, runner, calls } = setup({ active: editor() });
    await proofreadAndFix(host, runner);

    expect(runner.begin).toHaveBeenCalledWith(
      expect.objectContaining({ uri: 'file:///workspace/chapter-01.md', version: 4 }),
      { kind: 'proofread', output: 'fix', review: 'preview', reasoning: 'light' }
    );
    expect(runner.run).toHaveBeenCalledWith(expect.anything(), expect.any(AbortSignal), expect.objectContaining({ onReview: expect.any(Function) }));
    expect(calls).toEqual(['begin', 'progress:Proofreading chapter-01.md…', `report:${REVIEW_HINT}`, 'release']);
  });

  it('applies directly when the writer chose to', async () => {
    const { host, runner } = setup({ active: editor(), fixReview: 'apply' });
    await proofreadAndFix(host, runner);

    expect(runner.begin.mock.calls[0][1]).toEqual({ kind: 'proofread', output: 'fix', review: 'direct', reasoning: 'light' });
  });

  it('refuses a language it does not read, as Flag does', async () => {
    const { host, runner } = setup({ active: editor({ languageId: 'json' }) });
    await expect(proofreadAndFix(host, runner)).resolves.toMatchObject({ kind: 'refused' });
    expect(runner.run).not.toHaveBeenCalled();
  });
});

describe('the spelling convention (Slice 3)', () => {
  it.each(['american', 'british', 'canadian', 'australian'])('sends %s with Flag and with Fix, read at the gesture', async (spelling) => {
    const { host, runner } = setup({ active: editor(), spelling });
    await proofreadAndFlag(host, runner);
    await proofreadAndFix(host, runner);

    expect(runner.begin.mock.calls.map((call) => call[1])).toEqual([
      { kind: 'proofread', output: 'flag', spelling, reasoning: 'light' },
      { kind: 'proofread', output: 'fix', review: 'preview', spelling, reasoning: 'light' }
    ]);
  });

  it.each([['auto'], [undefined], ['irish'], ['British']])('names none for %p, so the passage keeps its own', async (spelling) => {
    const { host, runner } = setup({ active: editor(), spelling });
    await proofreadAndFlag(host, runner);

    expect(runner.begin.mock.calls[0][1]).toEqual({ kind: 'proofread', output: 'flag', reasoning: 'light' });
  });
});

describe('the word list (Slice 3b)', () => {
  it('sends the writer\'s words with Flag and with Fix, read at the gesture and normalized', async () => {
    const { host, runner } = setup({ active: editor(), spelling: 'british', wordList: ['Dinah', ' Mad Hatter ', 'dinah', 42, 'Dinah’s'] });
    await proofreadAndFlag(host, runner);
    await proofreadAndFix(host, runner);

    const wordList = ['Dinah', 'Mad', 'Hatter'];
    expect(runner.begin.mock.calls.map((call) => call[1])).toEqual([
      { kind: 'proofread', output: 'flag', spelling: 'british', wordList, reasoning: 'light' },
      { kind: 'proofread', output: 'fix', review: 'preview', spelling: 'british', wordList, reasoning: 'light' }
    ]);
    expect(host.wordList).toHaveBeenCalledTimes(2);
  });

  it.each([[undefined], [[]], ['Dinah'], [[' ', '—']], [{ word: 'Dinah' }]])('names none for %p', async (wordList) => {
    const { host, runner } = setup({ active: editor(), wordList });
    await proofreadAndFlag(host, runner);

    expect(runner.begin.mock.calls[0][1]).toEqual({ kind: 'proofread', output: 'flag', reasoning: 'light' });
  });
});

describe('the reasoning level (2026-10-27)', () => {
  it.each(['off', 'light', 'standard', 'deep'])('sends %s with Flag and with Fix, read at the gesture', async (reasoning) => {
    const { host, runner } = setup({ active: editor(), reasoning });
    await proofreadAndFlag(host, runner);
    await proofreadAndFix(host, runner);

    expect(runner.begin.mock.calls.map((call) => call[1])).toEqual([
      { kind: 'proofread', output: 'flag', reasoning },
      { kind: 'proofread', output: 'fix', review: 'preview', reasoning }
    ]);
    expect(host.proofreadReasoning).toHaveBeenCalledTimes(2);
  });

  it.each([[undefined], ['Light'], ['high'], [3], [['deep']]])('reads %p as the default, light', async (reasoning) => {
    const { host, runner } = setup({ active: editor(), reasoning });
    await proofreadAndFlag(host, runner);

    expect(runner.begin.mock.calls[0][1]).toEqual({ kind: 'proofread', output: 'flag', reasoning: 'light' });
  });
});

describe('the quick fixes (Slice 2)', () => {
  const document = { uri: 'file:///workspace/chapter-01.md', version: 4, text: TEXT, languageId: 'markdown' };

  it('applies one fix at once, reading the document the code action names, and says nothing when it landed', async () => {
    const { host, runner } = setup({ active: editor() });
    await replaceProofreadIssue(host, runner, 'file:///workspace/chapter-01.md', 'proofread-3');
    await settle();

    expect(runner.applyShown).toHaveBeenCalledWith(document, { issueIds: ['proofread-3'] }, 'direct');
    expect(host.showInformation).not.toHaveBeenCalled();
    expect(host.showWarning).not.toHaveBeenCalled();
  });

  it('applies every fix Proofread would make, reviewed as the setting says, and counts them', async () => {
    const { host, runner } = setup({
      active: editor(),
      quickFix: { kind: 'done', refused: 0, review: 'preview', answer: 'submitted', applied: 4, notApplied: 1, unknown: 0 }
    });
    await fixAllProofreadIssues(host, runner, 'file:///workspace/chapter-01.md');

    expect(runner.applyShown).toHaveBeenCalledWith(document, 'all-fixes', 'preview');
    expect(host.showInformation).toHaveBeenCalledWith('Proofread chapter-01.md: 4 fixes applied · 1 left as flags.');
  });

  it('says why a fix did not land', async () => {
    const { host, runner } = setup({ active: editor(), quickFix: { kind: 'nothing' } });
    await replaceProofreadIssue(host, runner, 'file:///workspace/chapter-01.md', 'proofread-3');

    expect(host.showInformation).toHaveBeenCalledWith('That Proofread fix is no longer there: its flag was dismissed, or its text edited.');
  });

  it('ignores a code action for a document no longer open, or without an issue id', async () => {
    const { host, runner } = setup({ active: editor() });
    await replaceProofreadIssue(host, runner, 'file:///workspace/other.md', 'proofread-3');
    await replaceProofreadIssue(host, runner, 'file:///workspace/chapter-01.md', undefined);
    await fixAllProofreadIssues(host, runner, 42);

    expect(runner.applyShown).not.toHaveBeenCalled();
  });
});
