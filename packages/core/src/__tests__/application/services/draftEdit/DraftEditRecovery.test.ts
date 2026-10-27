/**
 * PR #171 F-06: an unreadable reply is called "saved for recovery" only when
 * the recovery store saved it. Through the production recovery store (its
 * file system a stand-in whose writes succeed or fail on cue), the
 * ProofreadService, the DraftEditUseCase and the summary. The engine, the
 * document watch and the annotator are stand-ins; nothing reaches a provider.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  // One at a time, in order, so each chunk's capture finishes before the next call.
  default: () => {
    let chain: Promise<unknown> = Promise.resolve();
    return (fn: () => Promise<unknown>) => {
      const run = chain.then(fn);
      chain = run.catch(() => undefined);
      return run;
    };
  }
}));

import { DraftEditApplier } from '@/application/services/draftEdit/DraftEditApplier';
import { DraftEditUseCase } from '@/application/services/draftEdit/DraftEditUseCase';
import { describeDraftEditOutcome } from '@/application/services/draftEdit/draftEditSummary';
import { FileType, type FileSystem } from '@/platform';
import { RejectedModelResponseRecoveryStore } from '@/infrastructure/storage/RejectedModelResponseRecoveryStore';
import { ProofreadService } from '@services/proofread/ProofreadService';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { createFakeWorkspace } from '@/__tests__/mocks/platform';
import { ALICE_OPENING_SEEDED, ALICE_RABBIT_SEEDED } from '@/__tests__/utils/draftEdit/proofreadFixtures';

const URI = 'file:///workspace/chapter-01.txt';

/** A paragraph repeated past half the chunk budget, so two of them are two chunks. */
const long = (paragraph: string) => {
  const words = paragraph.split(/\s+/).length;
  return Array.from({ length: Math.ceil((PROMPT_BUDGETS.proofread.chunkWords * 0.6) / words) }, () => paragraph).join(' ');
};
const TEXT = `${long(ALICE_OPENING_SEEDED)}\n\n${long(ALICE_RABBIT_SEEDED)}`;

/** Runs two chunks, each answered unreadably; `writable[i]` says whether chunk i's capture can be written. */
async function summaryWith(writable: readonly boolean[]) {
  let failing = false;
  const fileSystem: FileSystem = {
    readFile: async () => { throw new Error('ENOENT'); },
    writeFile: jest.fn(async () => {
      if (failing) {
        throw Object.assign(new Error('EACCES: synthetic'), { code: 'EACCES' });
      }
    }),
    rename: jest.fn(async () => undefined),
    delete: jest.fn(async () => undefined),
    readDirectory: async () => [],
    stat: async () => ({ type: FileType.File, ctime: 0, mtime: 0, size: 0 }),
    createDirectory: async () => undefined
  };
  const log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
  const store = new RejectedModelResponseRecoveryStore(fileSystem, createFakeWorkspace(), '/extension/storage', log);
  let call = 0;
  const runInitial = jest.fn(async () => {
    failing = !writable[call++];
    return { content: 'Not the framed reply.', usedGuides: [], requestedResources: [], artifacts: [], finishReason: 'stop' };
  });
  const presenter = { present: jest.fn(async () => undefined) };
  const service = new ProofreadService(
    { ensureInitialized: async () => undefined, getEngine: () => ({ runInitial, getModel: () => 'placeholder/proofread-model' }) } as never,
    { loadPrompts: async () => 'SYSTEM' } as never,
    { alwaysReasons: async () => undefined },
    store,
    presenter,
    log as never
  );
  const documents = {
    watch: (uri: string, version: number) => ({
      ended: () => false,
      settle: () => ({ kind: 'open' as const, snapshot: { uri, version, text: TEXT, languageId: 'plaintext' }, edits: [] }),
      dispose: () => undefined
    }),
    applyEdits: async () => ({ kind: 'closed' as const })
  };
  const annotations = { show: () => true, remove: jest.fn(), clear: jest.fn(), current: () => undefined };
  const useCase = new DraftEditUseCase(service, documents, annotations, new DraftEditApplier(documents), log);
  const outcome = await useCase.run(
    { uri: URI, version: 1, text: TEXT, languageId: 'plaintext', relativePath: 'chapter-01.txt' },
    { kind: 'proofread', output: 'flag' }
  );
  await new Promise((resolve) => setImmediate(resolve));
  return { outcome, summary: describeDraftEditOutcome(outcome, 'chapter-01.txt'), presenter, runInitial, log };
}

describe('the summary of an unreadable reply and its recovery copy (PR #171 F-06)', () => {
  it('says saved when the store saved every capture, and presents recovery once', async () => {
    const { outcome, summary, presenter, runInitial } = await summaryWith([true, true]);

    expect(runInitial).toHaveBeenCalledTimes(2);
    expect(outcome).toMatchObject({ kind: 'completed', rejectedChunks: { saved: 2, unsaved: 0 } });
    expect(summary.message).toBe('Proofread chapter-01.txt: no issues found · 2 parts unreadable, saved for recovery');
    expect(presenter.present).toHaveBeenCalledTimes(1);
  });

  it('never says saved when the store could write no capture, and presents nothing', async () => {
    const { outcome, summary, presenter, log } = await summaryWith([false, false]);

    expect(outcome).toMatchObject({ kind: 'completed', rejectedChunks: { saved: 0, unsaved: 2 } });
    expect(summary).toEqual({
      level: 'warning',
      message: 'Proofread chapter-01.txt: no issues found · 2 parts unreadable and not saved for recovery (see the Prose Minion output)',
      hasFlags: false
    });
    expect(presenter.present).not.toHaveBeenCalled();
    expect(log.appendLine).toHaveBeenCalledWith(expect.stringContaining('[RejectedModelResponseRecovery] Failed to save proofread response'));
  });

  it('says which were saved when one capture was written and one was not', async () => {
    const { outcome, summary, presenter } = await summaryWith([false, true]);

    expect(outcome).toMatchObject({ kind: 'completed', rejectedChunks: { saved: 1, unsaved: 1 } });
    expect(summary.message).toBe(
      'Proofread chapter-01.txt: no issues found · 2 parts unreadable: 1 saved for recovery, 1 not saved (see the Prose Minion output)'
    );
    expect(presenter.present).toHaveBeenCalledTimes(1);
  });
});
