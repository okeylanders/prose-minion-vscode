/**
 * Proofread commands (Draft Edit Slice 1; ADR 2026-10-21 D5, D8): what is
 * refused before anything is sent, the long-file confirmation, and how an
 * outcome is presented. The host and the runner are fakes, so no VS Code API
 * is mocked. Passages are public domain (Lewis Carroll, 1865).
 */

// The whole core barrel cannot load under jest (an ESM dependency), so the
// two runtime values these commands use are required from their modules.
jest.mock('@prose-minion/core', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the mocked barrel's export name.
  DRAFT_EDIT_LANGUAGE_IDS: jest.requireActual('@/domain/models/DraftEdit').DRAFT_EDIT_LANGUAGE_IDS,
  describeDraftEditOutcome: jest.requireActual('@/application/services/draftEdit/draftEditSummary').describeDraftEditOutcome
}));

import type { DraftEditOutcome, DraftEditRunPlan, DraftEditTarget } from '@prose-minion/core';
import {
  OPEN_SETTINGS_COMMAND,
  SHOW_PROBLEMS_COMMAND,
  clearProofreadFlags,
  dismissProofreadIssue,
  proofreadAndFlag,
  type ProofreadCommandHost,
  type ProofreadEditorSnapshot,
  type ProofreadRunner
} from '@app/application/commands/proofreadCommands';

const TEXT = 'Alice was beginning to get very tired of sitting by her sister on the bank.';
const NONE = { unanchored: 0, protected: 0, overlapping: 0, stale: 0, malformed: 0 };
const COMPLETED: DraftEditOutcome = {
  kind: 'completed', flagged: 2, judgmentCalls: 1, dropped: NONE, rejectedChunks: 0, chunks: { total: 1, completed: 1 }
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
  confirm?: boolean;
  outcome?: DraftEditOutcome;
  choice?: string;
} = {}) {
  const calls: string[] = [];
  const host = {
    activeEditor: jest.fn(() => options.active),
    confirm: jest.fn(async () => options.confirm ?? false),
    withProgress: jest.fn(async <T>(title: string, task: (signal: AbortSignal) => Promise<T>) => {
      calls.push(`progress:${title}`);
      return task(new AbortController().signal);
    }),
    showInformation: jest.fn(async () => options.choice),
    showWarning: jest.fn(async () => options.choice),
    executeCommand: jest.fn()
  } satisfies ProofreadCommandHost;
  const runner = {
    plan: jest.fn((target: DraftEditTarget): DraftEditRunPlan => ({
      words: 14, chunks: 1, wholeFile: target.range === undefined, needsConfirmation: false, ...options.plan
    })),
    run: jest.fn(async () => options.outcome ?? COMPLETED),
    dismiss: jest.fn(),
    clear: jest.fn()
  } satisfies ProofreadRunner;
  return { host, runner, calls };
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
    const { host, runner, calls } = setup({ active: editor({ languageId }) });
    await proofreadAndFlag(host, runner);

    expect(runner.run).toHaveBeenCalledWith(
      { uri: 'file:///workspace/chapter-01.md', version: 4, text: TEXT, languageId, relativePath: 'chapter-01.md' },
      { kind: 'proofread', output: 'flag' },
      expect.any(AbortSignal)
    );
    expect(calls).toEqual(['progress:Proofreading chapter-01.md…']);
    expect(host.confirm).not.toHaveBeenCalled();
  });

  it('passes a selection as the target range', async () => {
    const { host, runner, calls } = setup({ active: editor({ selection: { start: 6, end: 9 } }) });
    await proofreadAndFlag(host, runner);

    expect(runner.run.mock.calls[0]).toEqual([expect.objectContaining({ range: { start: 6, end: 9 } }), expect.anything(), expect.anything()]);
    expect(calls).toEqual(['progress:Proofreading chapter-01.md (selection)…']);
  });

  it('asks before a long whole-file run, naming words and calls, and sends nothing when declined', async () => {
    const { host, runner } = setup({ active: editor(), plan: { words: 16_250, chunks: 14, needsConfirmation: true } });
    await expect(proofreadAndFlag(host, runner)).resolves.toEqual({ kind: 'declined' });

    expect(host.confirm).toHaveBeenCalledWith(
      'Proofread all 16,250 words of chapter-01.md? That is 14 requests to your Proofread model.',
      'Proofread'
    );
    expect(runner.run).not.toHaveBeenCalled();
  });

  it('runs a long whole-file run once confirmed', async () => {
    const { host, runner } = setup({ active: editor(), plan: { needsConfirmation: true }, confirm: true });
    await expect(proofreadAndFlag(host, runner)).resolves.toEqual({ kind: 'ran', outcome: COMPLETED });
    expect(runner.run).toHaveBeenCalledTimes(1);
  });

  it('offers Show Problems when flags were shown', async () => {
    const { host, runner } = setup({ active: editor(), choice: 'Show Problems' });
    await proofreadAndFlag(host, runner);
    await settle();

    expect(host.showInformation).toHaveBeenCalledWith('Proofread chapter-01.md: 2 issues flagged (1 tense or agreement)', 'Show Problems');
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
