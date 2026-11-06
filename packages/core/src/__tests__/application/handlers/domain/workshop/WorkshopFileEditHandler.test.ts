/**
 * A file-edit card's routes (ADR 2026-11-05 D8–D10; epic Slice 4a): the
 * claim taken before any await and keyed by room generation, joined
 * duplicates, Decline while claimed, terminal replay, the durable checkpoint
 * before any write, the boundary predicate, outcomes by generation, the
 * card's settlement, the rewrite preview, and logs and answers that carry no
 * path, URI or text. A real session, fake gateway and checkpoint, made-up
 * text: *Alice*.
 */
import { WorkshopFileEditHandler } from '@handlers/domain/workshop/WorkshopFileEditHandler';
import { resolveWorkshopReplyFileEdits } from '@/application/services/workshop/fileEdits/WorkshopReplyFileEditProposals';
import type { WorkshopFileEditCheckpointResult } from '@/application/services/workshop/fileEdits/WorkshopFileEditCheckpoint';
import type { FileEditApplyOptions, FileEditApplyOutcome, StagedFileEdit } from '@/domain/models/FileEdit';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  MessageType,
  type WorkshopFileEditAction,
  type WorkshopFileEditResultPayload,
  type WorkshopFileEditsMode,
  type WorkshopTurn
} from '@messages';
import {
  fakeFileEditApply,
  fakeFileEditStaging,
  fileEditFrame,
  QUOTE_SENTINEL,
  URI_SENTINEL,
  WITH_SENTINEL,
  WHY_SENTINEL,
  sentinelFileEditFrame
} from '@/__tests__/application/services/workshop/fileEdits/fileEditFixtures';
import { ScriptedWorkshopRoom } from '@/__tests__/application/services/workshop/session/ScriptedWorkshopRoom';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const landedAll = (staged: StagedFileEdit): FileEditApplyOutcome => ({
  state: 'applied',
  operations: staged.operations.map((_, index) => ({ index, outcome: 'landed' as const })),
  landed: staged.operations.map((_, index) => ({
    operation: index, before: 'Alice is seven', after: 'Alice is ten', contextBefore: '', contextAfter: '.', versionAfter: 2
  })),
  revealed: true,
  document: { uri: `file:///ws/${URI_SENTINEL}/characters/alice.md`, version: 2 },
  message: 'Applied. The file is not saved yet.'
});

async function roomWithCards(frames: string[] = [fileEditFrame()]) {
  const room = new ScriptedWorkshopRoom().start();
  room.hostMessage('Read this.');
  const reply = `Her age changes here.\n\n${frames.join('\n')}`;
  room.fileEdits = await resolveWorkshopReplyFileEdits({ reply, open: true, staging: fakeFileEditStaging() });
  const turn = room.hostMessage('Change her age.', { reply });
  expect(turn.fileEditProposals?.length).toBe(frames.length);
  return { room, turn };
}

async function setup(options: {
  frames?: string[];
  apply?: (staged: StagedFileEdit, options: FileEditApplyOptions) => Promise<FileEditApplyOutcome> | FileEditApplyOutcome;
  checkpoint?: () => Promise<WorkshopFileEditCheckpointResult>;
} = {}) {
  const { room, turn } = await roomWithCards(options.frames);
  const session = room.session;
  const gate = { run: false, mode: 'ask' as WorkshopFileEditsMode };
  const gateway = fakeFileEditApply(options.apply ?? landedAll);
  const checkpoints: Array<{ generation: number; turnId: string; index: number; state?: string }> = [];
  const checkpoint = {
    checkpointFileEdit: jest.fn(async (generation: number, turnId: string, index: number) => {
      checkpoints.push({ generation, turnId, index, state: session.readRoomLedger().find((each) => each.id === turnId)?.fileEditProposals?.[index]?.state });
      return options.checkpoint ? options.checkpoint() : { ok: true as const };
    })
  };
  const posted: Array<{ type: MessageType; payload: any }> = [];
  const log: string[] = [];
  const effects = { postSessionState: jest.fn(), markDirty: jest.fn(), reportError: jest.fn() };
  const handler = new WorkshopFileEditHandler(
    session,
    gateway,
    checkpoint,
    { isRoomRunActive: () => gate.run, fileEditsMode: () => gate.mode },
    effects,
    async (message) => { posted.push(message as never); },
    { appendLine: (line) => log.push(line), show: () => undefined, clear: () => undefined }
  );
  const act = (action: WorkshopFileEditAction, requestId: string, extra: Record<string, unknown> = {}) => handler.handleAction({
    type: MessageType.WORKSHOP_FILE_EDIT_ACTION,
    source: 'webview.workshop',
    payload: { requestId, roomRevision: session.readRoomRevision(), turnId: turn.id, index: 0, action, ...extra },
    timestamp: 0
  } as never);
  const preview = (requestId: string) => handler.handlePreview({
    type: MessageType.WORKSHOP_FILE_EDIT_PREVIEW,
    source: 'webview.workshop',
    payload: { requestId, roomRevision: session.readRoomRevision(), turnId: turn.id, index: 0 },
    timestamp: 0
  } as never);
  const results = () => posted.filter((each) => each.type === MessageType.WORKSHOP_FILE_EDIT_RESULT).map((each) => each.payload as WorkshopFileEditResultPayload);
  const card = (from: readonly WorkshopTurn[] = session.readRoomLedger()) => from.find((each) => each.id === turn.id)?.fileEditProposals?.[0];
  return { room, session, turn, gate, gateway, checkpoint, checkpoints, posted, log, effects, handler, act, preview, results, card };
}

describe('Apply: the claim, the checkpoint and the outcome', () => {
  it('sets the card applying, checkpoints it, applies the stored operations, and records the outcome with what landed', async () => {
    const fixture = await setup();
    const generation = fixture.session.readRoomRevision();
    await fixture.act('apply', 'r1', { operations: [{ op: 'rewrite', text: 'Injected' }] });

    expect(fixture.checkpoints).toEqual([{ generation, turnId: fixture.turn.id, index: 0, state: 'applying' }]);
    expect(fixture.gateway.applies).toHaveLength(1);
    const { staged, options } = fixture.gateway.applies[0];
    // The stored card's operations, never the request's.
    expect(staged.operations).toEqual([{ op: 'replace', find: 'Alice is seven', with: 'Alice is ten' }]);
    expect(staged).toMatchObject({ class: 'notes', source: { kind: 'proposal', turnId: fixture.turn.id, index: 0 } });
    expect(options.review).toBe('direct');
    expect(fixture.card()).toMatchObject({ state: 'applied', outcomes: ['landed'], landed: [{ operation: 0, versionAfter: 2 }] });
    expect(fixture.results()).toEqual([expect.objectContaining({
      requestId: 'r1', roomRevision: generation, answer: 'settled', state: 'applied', message: 'Applied. The file is not saved yet.'
    })]);
    expect(fixture.effects.markDirty).toHaveBeenCalled();
  });

  it('Review in editor… goes through the review', async () => {
    const fixture = await setup();
    await fixture.act('review', 'r1');
    expect(fixture.gateway.applies[0].options.review).toBe('preview');
  });

  it('joins a second Apply, with the same and with a different request id, to the one claim: one write, one outcome for each', async () => {
    const release = deferred<void>();
    const fixture = await setup({ apply: async (staged) => { await release.promise; return landedAll(staged); } });
    const first = fixture.act('apply', 'r1');
    const sameId = fixture.act('apply', 'r1');
    const otherId = fixture.act('apply', 'r2');
    const review = fixture.act('review', 'r3');
    release.resolve();
    await Promise.all([first, sameId, otherId, review]);

    expect(fixture.checkpoint.checkpointFileEdit).toHaveBeenCalledTimes(1);
    expect(fixture.gateway.applies).toHaveLength(1);
    expect(fixture.results().map(({ requestId, answer, state }) => [requestId, answer, state])).toEqual([
      ['r1', 'settled', 'applied'], ['r1', 'joined', 'applied'], ['r2', 'joined', 'applied'], ['r3', 'joined', 'applied']
    ]);
  });

  it('control: an Apply after the first settled replays applied and writes nothing', async () => {
    const fixture = await setup();
    await fixture.act('apply', 'r1');
    fixture.effects.markDirty.mockClear();
    await fixture.act('apply', 'r2');
    expect(fixture.gateway.applies).toHaveLength(1);
    expect(fixture.effects.markDirty).not.toHaveBeenCalled();
    expect(fixture.results()[1]).toMatchObject({ requestId: 'r2', answer: 'replayed', state: 'applied' });
  });

  it('Apply racing Decline: Decline while claimed is held, changes nothing, and the Apply lands once', async () => {
    const release = deferred<void>();
    const fixture = await setup({ apply: async (staged) => { await release.promise; return landedAll(staged); } });
    const applying = fixture.act('apply', 'r1');
    await fixture.act('decline', 'r2');
    expect(fixture.card()?.state).toBe('applying');
    release.resolve();
    await applying;
    expect(fixture.gateway.applies).toHaveLength(1);
    expect(fixture.card()?.state).toBe('applied');
    expect(fixture.results().map(({ requestId, answer, state }) => [requestId, answer, state])).toEqual([
      ['r2', 'held', 'applying'], ['r1', 'settled', 'applied']
    ]);
  });

  it('control: Decline first declines the card, and an Apply after it replays declined and writes nothing', async () => {
    const fixture = await setup();
    await fixture.act('decline', 'r1');
    await fixture.act('apply', 'r2');
    expect(fixture.card()?.state).toBe('declined');
    expect(fixture.gateway.applies).toHaveLength(0);
    expect(fixture.checkpoint.checkpointFileEdit).not.toHaveBeenCalled();
    expect(fixture.results().map(({ answer, state }) => [answer, state])).toEqual([['settled', 'declined'], ['replayed', 'declined']]);
  });

  it('every terminal state replays and writes nothing', async () => {
    for (const state of ['applied', 'partial', 'declined', 'stale', 'refused', 'unknown'] as const) {
      const fixture = await setup();
      const settlement = state === 'applied' ? { state, outcomes: ['landed' as const], landed: [{ operation: 0, beforeSha256: 'a'.repeat(64), afterSha256: 'b'.repeat(64) }] }
        : state === 'partial' ? undefined
          : state === 'unknown' ? { state, reason: 'outcome-unknown', outcomes: ['unknown' as const] }
            : state === 'declined' ? { state } : { state, reason: 'not-found' };
      if (!settlement) {
        continue; // One operation can't be partial; the codec's rule. Partial replays like the rest (below).
      }
      fixture.session.setFileEditProposalState(fixture.turn.id, 0, settlement);
      await fixture.act('apply', 'r1');
      await fixture.act('decline', 'r2');
      expect(fixture.gateway.applies).toHaveLength(0);
      expect(fixture.card()?.state).toBe(state);
      expect(fixture.results().map(({ answer }) => answer)).toEqual(['replayed', 'replayed']);
    }
  });

  it('a partial card replays partial', async () => {
    const fixture = await setup({ frames: [fileEditFrame({ body: ['<find>Alice is seven</find>', '<replace-with>Alice is ten</replace-with>', '<append>Alice grows.</append>'] })] });
    fixture.session.setFileEditProposalState(fixture.turn.id, 0, {
      state: 'partial', outcomes: ['landed', 'not-applied'], landed: [{ operation: 0, beforeSha256: 'a'.repeat(64), afterSha256: 'b'.repeat(64) }]
    });
    await fixture.act('apply', 'r1');
    expect(fixture.gateway.applies).toHaveLength(0);
    expect(fixture.results()[0]).toMatchObject({ answer: 'replayed', state: 'partial' });
  });
});

describe('Apply: nothing is written unless applying is durable and authority holds', () => {
  it.each([
    'room-changed', 'run-active', 'store-unavailable', 'checkpoint-failed', 'mirror-failed', 'not-applying'
  ] as const)('a checkpoint refused (%s) writes nothing and returns the card to pending', async (reason) => {
    const fixture = await setup({ checkpoint: async () => ({ ok: false, reason }) });
    await fixture.act('apply', 'r1');
    expect(fixture.gateway.applies).toHaveLength(0);
    expect(fixture.card()?.state).toBe('pending');
    expect(fixture.results()[0]).toMatchObject({ answer: 'refused', state: 'pending', reason });
    expect(fixture.results()[0].message).not.toBe('');
  });

  it('a deferred checkpoint (a reply running) writes nothing, says when to apply, and the card applies once the reply finishes', async () => {
    let answer: WorkshopFileEditCheckpointResult = { ok: false, reason: 'run-active' };
    const fixture = await setup({ checkpoint: async () => answer });
    await fixture.act('apply', 'r1');
    expect(fixture.gateway.applies).toHaveLength(0);
    expect(fixture.results()[0].message).toBe('Apply after the current reply finishes.');
    answer = { ok: true };
    await fixture.act('apply', 'r2');
    expect(fixture.gateway.applies).toHaveLength(1);
    expect(fixture.card()?.state).toBe('applied');
  });

  it('refuses before any checkpoint while a reply runs, or with the setting off', async () => {
    const running = await setup();
    running.gate.run = true;
    await running.act('apply', 'r1');
    const off = await setup();
    off.gate.mode = 'off';
    await off.act('apply', 'r1');
    for (const fixture of [running, off]) {
      expect(fixture.checkpoint.checkpointFileEdit).not.toHaveBeenCalled();
      expect(fixture.gateway.applies).toHaveLength(0);
      expect(fixture.card()?.state).toBe('pending');
    }
    expect(running.results()[0]).toMatchObject({ answer: 'refused', reason: 'run-active' });
    expect(off.results()[0]).toMatchObject({ answer: 'refused', reason: 'file-edits-off' });
  });

  it('refuses an action shown in another room, even with matching ids', async () => {
    const fixture = await setup();
    await fixture.act('apply', 'r1', { roomRevision: fixture.session.readRoomRevision() - 1 });
    expect(fixture.checkpoint.checkpointFileEdit).not.toHaveBeenCalled();
    expect(fixture.results()[0]).toMatchObject({ answer: 'room-changed' });
  });

  it('stillCurrent holds the claim, the generation and the setting: each lost makes it false', async () => {
    const seen: boolean[] = [];
    const fixture = await setup({ apply: (staged, options) => { seen.push(options.stillCurrent()); return landedAll(staged); } });
    await fixture.act('apply', 'r1');
    expect(seen).toEqual([true]);

    const settingOff = await setup({ apply: (staged, options) => {
      settingOff.gate.mode = 'off';
      return options.stillCurrent()
        ? landedAll(staged)
        : { state: 'refused', reason: 'superseded', operations: [{ index: 0, outcome: 'refused', reason: 'superseded' }], revealed: false, message: '' };
    } });
    await settingOff.act('apply', 'r1');
    // A refusal at the boundary wrote nothing: the card is pending again.
    expect(settingOff.card()?.state).toBe('pending');
    expect(settingOff.results()[0]).toMatchObject({ answer: 'settled', state: 'pending' });
  });

  it('the same session reopened while the old action is paused: the old action cannot continue, and its outcome is dropped', async () => {
    const paused = deferred<void>();
    let authority: boolean | undefined;
    const fixture = await setup({ apply: async (staged, options) => {
      await paused.promise;
      authority = options.stillCurrent();
      return authority ? landedAll(staged) : { state: 'refused', reason: 'superseded', operations: [{ index: 0, outcome: 'refused' }], revealed: false, message: '' };
    } });
    const saved = fixture.session.exportCommittedState();
    const applying = fixture.act('apply', 'r1');
    await Promise.resolve();
    // Reopen the same saved session: the same turn and card ids, a new generation.
    fixture.session.hydrateCommittedState(saved, { host: 'host-conversation' }, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);
    paused.resolve();
    await applying;

    expect(authority).toBe(false);
    expect(fixture.card()?.state).toBe('pending');
    expect(fixture.results()[0]).toMatchObject({ requestId: 'r1', answer: 'room-changed' });
    expect(fixture.log.some((line) => line.includes('outcome dropped'))).toBe(true);
  });

  it('control: an outcome that lands in the room it was asked in is recorded', async () => {
    const paused = deferred<void>();
    const fixture = await setup({ apply: async (staged) => { await paused.promise; return landedAll(staged); } });
    const applying = fixture.act('apply', 'r1');
    paused.resolve();
    await applying;
    expect(fixture.card()?.state).toBe('applied');
  });
});

describe('Apply: outcomes on the card (D8, D10)', () => {
  const twoOperations = [fileEditFrame({ body: ['<find>Alice is seven</find>', '<replace-with>Alice is ten</replace-with>', '<append>Alice grows.</append>'] })];

  it('a review with an entry unticked is partial, by operation, with a record for what landed', async () => {
    const fixture = await setup({ frames: twoOperations, apply: () => ({
      state: 'partial',
      operations: [{ index: 0, outcome: 'landed' }, { index: 1, outcome: 'not-applied' }],
      landed: [{ operation: 0, before: 'Alice is seven', after: 'Alice is ten', contextBefore: '', contextAfter: '.', versionAfter: 3 }],
      revealed: false,
      message: ''
    }) });
    await fixture.act('review', 'r1');
    expect(fixture.card()).toMatchObject({ state: 'partial', outcomes: ['landed', 'not-applied'], landed: [{ operation: 0 }] });
    expect(fixture.results()[0]).toMatchObject({ state: 'partial', message: expect.stringContaining('Some of the changes') });
  });

  it('a review whose document closed is unknown, with no Apply offered again', async () => {
    const fixture = await setup({ apply: () => ({ state: 'unknown', operations: [{ index: 0, outcome: 'unknown' }], revealed: false, message: '' }) });
    await fixture.act('review', 'r1');
    expect(fixture.card()).toMatchObject({ state: 'unknown', reason: 'outcome-unknown', outcomes: ['unknown'] });
    await fixture.act('apply', 'r2');
    expect(fixture.gateway.applies).toHaveLength(1);
    expect(fixture.results()[1]).toMatchObject({ answer: 'replayed', state: 'unknown' });
  });

  it('a discarded review wrote nothing: the card is pending again', async () => {
    const fixture = await setup({ apply: () => ({ state: 'declined', operations: [{ index: 0, outcome: 'not-applied' }], revealed: false, message: '' }) });
    await fixture.act('review', 'r1');
    expect(fixture.card()?.state).toBe('pending');
    expect(fixture.card()?.outcomes).toBeUndefined();
  });

  it('stale and refused keep their reason, and no outcomes', async () => {
    const stale = await setup({ apply: () => ({ state: 'stale', reason: 'not-found', operations: [{ index: 0, outcome: 'stale' }], revealed: false, message: '' }) });
    await stale.act('apply', 'r1');
    expect(stale.card()).toEqual(expect.objectContaining({ state: 'stale', reason: 'not-found' }));
    expect(stale.card()?.outcomes).toBeUndefined();
    expect(stale.results()[0].message).toBe('The text to change is no longer in the file.');

    const refused = await setup({ apply: () => ({ state: 'refused', reason: 'protected', operations: [{ index: 0, outcome: 'refused' }], revealed: false, message: '' }) });
    await refused.act('apply', 'r1');
    expect(refused.card()).toMatchObject({ state: 'refused', reason: 'protected' });
  });

  it('a gateway that throws leaves the card unknown, never pending', async () => {
    const fixture = await setup({ apply: () => { throw new Error(`boom ${URI_SENTINEL}`); } });
    await fixture.act('apply', 'r1');
    expect(fixture.card()).toMatchObject({ state: 'unknown', outcomes: ['unknown'] });
  });
});

describe('the rewrite preview (D6, D9)', () => {
  const rewrite = [fileEditFrame({ body: ['<rewrite>Alice is ten.</rewrite>'] })];

  it('answers before and after while the baseline holds, and never a URI', async () => {
    const fixture = await setup({ frames: rewrite });
    fixture.gateway.preview = async () => ({ kind: 'rewrite', before: 'Alice is seven.', after: 'Alice is ten.' });
    await fixture.preview('p1');
    const answer = fixture.posted.find((each) => each.type === MessageType.WORKSHOP_FILE_EDIT_PREVIEW_RESULT)?.payload;
    expect(answer).toMatchObject({ requestId: 'p1', preview: { kind: 'rewrite', before: 'Alice is seven.', after: 'Alice is ten.' } });
    expect(JSON.stringify(fixture.posted)).not.toContain(URI_SENTINEL);
    expect(fixture.card()?.state).toBe('pending');
  });

  it('answers stale once the baseline no longer holds, and the card turns stale', async () => {
    const fixture = await setup({ frames: rewrite });
    fixture.gateway.preview = async () => ({ kind: 'stale', reason: 'baseline-changed' });
    await fixture.preview('p1');
    expect(fixture.posted.at(-1)?.payload.preview).toMatchObject({ kind: 'stale', reason: 'baseline-changed' });
    expect(fixture.card()).toMatchObject({ state: 'stale', reason: 'baseline-changed' });
  });

  it('a preview whose room was replaced while it read answers room-changed, and marks nothing', async () => {
    const fixture = await setup({ frames: rewrite });
    const saved = fixture.session.exportCommittedState();
    fixture.gateway.preview = async () => {
      fixture.session.hydrateCommittedState(saved, { host: 'host-conversation' }, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);
      return { kind: 'stale', reason: 'baseline-changed' };
    };
    await fixture.preview('p1');
    expect(fixture.posted.at(-1)?.payload.preview).toMatchObject({ kind: 'refused', reason: 'room-changed' });
    expect(fixture.card()?.state).toBe('pending');
  });
});

describe('logs and answers', () => {
  it('carry no path, URI, quote, replacement or why', async () => {
    const fixture = await setup({ frames: [sentinelFileEditFrame()] });
    await fixture.act('apply', 'r1');
    await fixture.act('decline', 'r2');
    await fixture.preview('p1');
    for (const line of fixture.log) {
      for (const secret of [URI_SENTINEL, QUOTE_SENTINEL, WITH_SENTINEL, WHY_SENTINEL, 'characters/alice.md', 'file:']) {
        expect(line).not.toContain(secret);
      }
    }
    const answers = JSON.stringify(fixture.results());
    for (const secret of [URI_SENTINEL, QUOTE_SENTINEL, WITH_SENTINEL, WHY_SENTINEL, 'file:']) {
      expect(answers).not.toContain(secret);
    }
  });

  it('report a malformed request without acting on it', async () => {
    const fixture = await setup();
    await fixture.handler.handleAction({ type: MessageType.WORKSHOP_FILE_EDIT_ACTION, source: 'x', payload: { requestId: 'r1', turnId: fixture.turn.id, index: 0, action: 'apply' }, timestamp: 0 } as never);
    await fixture.act('auto' as WorkshopFileEditAction, 'r2');
    expect(fixture.effects.reportError).toHaveBeenCalledTimes(2);
    expect(fixture.gateway.applies).toHaveLength(0);
  });
});
