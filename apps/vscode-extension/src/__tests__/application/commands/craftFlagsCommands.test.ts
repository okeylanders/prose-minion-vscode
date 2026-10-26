/**
 * Craft Flags commands (Draft Edit Slice 3c; ADR 2026-10-21, Amendment
 * 2026-10-26): what is refused before anything is sent, the priced
 * confirmation every run asks, how an outcome is presented, and Clear and
 * Dismiss. The host and the runner are fakes, so no VS Code API is mocked.
 * Text is public domain (Lewis Carroll, 1865).
 */

// The whole core barrel cannot load under jest (an ESM dependency), so the
// runtime values these commands use are required from their modules.
jest.mock('@prose-minion/core', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the mocked barrel's export names.
  CRAFT_FLAG_CATEGORIES: jest.requireActual('@/domain/models/CraftFlag').CRAFT_FLAG_CATEGORIES,
  // eslint-disable-next-line @typescript-eslint/naming-convention -- the mocked barrel's export name.
  DRAFT_EDIT_LANGUAGE_IDS: jest.requireActual('@/domain/models/DraftEdit').DRAFT_EDIT_LANGUAGE_IDS,
  describeCraftFlagsOutcome: jest.requireActual('@/application/services/draftEdit/craftFlagsSummary').describeCraftFlagsOutcome,
  describeCraftFlagsPlan: jest.requireActual('@/application/services/draftEdit/craftFlagsSummary').describeCraftFlagsPlan
}));

import type { CraftFlagsOutcome, CraftFlagsRunPlan, DraftEditTarget } from '@prose-minion/core';
import { OPEN_SETTINGS_COMMAND, SHOW_PROBLEMS_COMMAND, type ProofreadEditorSnapshot } from '@app/application/commands/proofreadCommands';
import {
  clearCraftFlags,
  dismissCraftFlag,
  runCraftFlags,
  type CraftFlagsCommandHost,
  type CraftFlagsRunner
} from '@app/application/commands/craftFlagsCommands';

const TEXT = 'When the Rabbit took a watch out of its waistcoat-pocket, a chill ran down her spine.';
const READY: CraftFlagsRunPlan = {
  kind: 'ready', words: 16, reads: 'document', selection: false,
  estimate: { model: 'anthropic/claude-sonnet-5', calls: 1, inputTokens: 900, outputTokens: 1500, usd: 0.031 }
};
const COMPLETED: CraftFlagsOutcome = {
  kind: 'completed', flagged: 1, reads: 'document',
  dropped: { unanchored: 0, protected: 0, dialogue: 0, overlapping: 0, stale: 0, malformed: 0 },
  notesWithheld: 0, rejectedCalls: { saved: 0, unsaved: 0 }, calls: { total: 1, completed: 1 }
};

const editor = (overrides: Partial<ProofreadEditorSnapshot> = {}): ProofreadEditorSnapshot => ({
  uri: 'file:///workspace/chapter-01.md', version: 4, text: TEXT, languageId: 'markdown', label: 'chapter-01.md', ...overrides
});

function setup(options: { active?: ProofreadEditorSnapshot; plan?: CraftFlagsRunPlan; confirm?: boolean; outcome?: CraftFlagsOutcome; choice?: string } = {}) {
  const calls: string[] = [];
  const host = {
    activeEditor: jest.fn(() => options.active),
    confirm: jest.fn(async (message: string, action: string) => {
      calls.push(`confirm:${message}|${action}`);
      return options.confirm ?? false;
    }),
    withProgress: jest.fn(async <T>(title: string, task: (signal: AbortSignal, report: (message: string) => void) => Promise<T>) => {
      calls.push(`progress:${title}`);
      return task(new AbortController().signal, () => undefined);
    }),
    showInformation: jest.fn(async () => options.choice),
    showWarning: jest.fn(async () => options.choice),
    executeCommand: jest.fn()
  } satisfies CraftFlagsCommandHost;
  const runner = {
    plan: jest.fn(async (): Promise<CraftFlagsRunPlan> => options.plan ?? READY),
    run: jest.fn(async (_target: DraftEditTarget): Promise<CraftFlagsOutcome> => options.outcome ?? COMPLETED),
    dismiss: jest.fn(),
    clear: jest.fn()
  } satisfies CraftFlagsRunner;
  return { host, runner, calls };
}

const flushed = () => new Promise((resolve) => setImmediate(resolve));

describe('Craft Flags', () => {
  it('refuses, sending nothing, with no editor or outside Markdown and plain text', async () => {
    const none = setup();
    expect(await runCraftFlags(none.host, none.runner)).toEqual({ kind: 'refused', message: 'Open a Markdown or plain-text file for Craft Flags.' });
    const code = setup({ active: editor({ languageId: 'javascript' }) });
    expect(await runCraftFlags(code.host, code.runner)).toEqual({ kind: 'refused', message: 'Craft Flags reads Markdown and plain-text files.' });
    expect(code.runner.plan).not.toHaveBeenCalled();
  });

  it('asks every run first, naming what it reads, the model and the price; Cancel sends nothing', async () => {
    const { host, runner, calls } = setup({ active: editor(), confirm: false });
    expect(await runCraftFlags(host, runner)).toEqual({ kind: 'declined' });
    expect(calls).toEqual(['confirm:Craft Flags reads all 16 words of chapter-01.md. That is 1 request to claude-sonnet-5 (≈ $0.03).|Run Craft Flags']);
    expect(runner.run).not.toHaveBeenCalled();
  });

  it('runs the gesture\'s target, a selection included, with every category, under a cancellable progress', async () => {
    const selection = { start: 58, end: 84 };
    const { host, runner, calls } = setup({ active: editor({ selection }), confirm: true });
    const result = await runCraftFlags(host, runner);

    expect(runner.plan).toHaveBeenCalledWith(expect.objectContaining({ range: selection, version: 4 }), { kind: 'craft', categories: ['cliche'] });
    expect(runner.run).toHaveBeenCalledWith(
      { uri: 'file:///workspace/chapter-01.md', version: 4, text: TEXT, languageId: 'markdown', relativePath: 'chapter-01.md', range: selection },
      { kind: 'craft', categories: ['cliche'] },
      expect.any(AbortSignal)
    );
    expect(calls[1]).toBe('progress:Craft Flags: reading chapter-01.md (selection)…');
    expect(result).toEqual({ kind: 'ran', outcome: COMPLETED });
  });

  it('says why a run that is not ready sends nothing, and asks nothing', async () => {
    const tooLong = setup({ active: editor(), plan: { kind: 'too-long', words: 30000, limit: 25000 } });
    expect(await runCraftFlags(tooLong.host, tooLong.runner)).toEqual({ kind: 'ran', outcome: { kind: 'too-long', words: 30000, limit: 25000 } });
    expect(tooLong.host.confirm).not.toHaveBeenCalled();
    expect(tooLong.host.showWarning).toHaveBeenCalledWith(expect.stringContaining('reads up to 25,000 at once'));
    expect(tooLong.runner.run).not.toHaveBeenCalled();
  });

  it('offers Open Settings with no key, and Show Problems when flags were shown', async () => {
    const unconfigured = setup({ active: editor(), plan: { kind: 'unconfigured' }, choice: 'Open Settings' });
    await runCraftFlags(unconfigured.host, unconfigured.runner);
    await flushed();
    expect(unconfigured.host.showWarning).toHaveBeenCalledWith('Craft Flags needs an OpenRouter API key.', 'Open Settings');
    expect(unconfigured.host.executeCommand).toHaveBeenCalledWith(OPEN_SETTINGS_COMMAND);

    const flagged = setup({ active: editor(), confirm: true, choice: 'Show Problems' });
    await runCraftFlags(flagged.host, flagged.runner);
    await flushed();
    expect(flagged.host.showInformation).toHaveBeenCalledWith('Craft Flags chapter-01.md: 1 flag', 'Show Problems');
    expect(flagged.host.executeCommand).toHaveBeenCalledWith(SHOW_PROBLEMS_COMMAND);
  });

  it('clears the active document\'s Craft Flags, or every document\'s, and dismisses one by its handle', () => {
    const active = setup({ active: editor() });
    clearCraftFlags(active.host, active.runner);
    expect(active.runner.clear).toHaveBeenCalledWith('file:///workspace/chapter-01.md');
    clearCraftFlags(active.host, active.runner, 'file:///workspace/other.md');
    expect(active.runner.clear).toHaveBeenLastCalledWith('file:///workspace/other.md');
    const none = setup();
    clearCraftFlags(none.host, none.runner);
    expect(none.runner.clear).toHaveBeenCalledWith(undefined);

    dismissCraftFlag(active.runner, 'file:///workspace/chapter-01.md', 'craft-3');
    dismissCraftFlag(active.runner, 'file:///workspace/chapter-01.md', 3);
    expect(active.runner.dismiss).toHaveBeenCalledTimes(1);
    expect(active.runner.dismiss).toHaveBeenCalledWith('file:///workspace/chapter-01.md', 'craft-3');
  });
});
