/**
 * Slice 4a's acceptance (ADR 2026-11-05 D7, D8, D10; PR #226 F-04 and its
 * re-review): the file-edit handler over the real session, the real
 * persistence coordinator and store (in memory), the real staging, gateway
 * and applier (over `FakeDocuments`). Each case writes the document at most
 * once, or not at all, and leaves one truthful card, with a control beside
 * it. Then one round trip, the combined integration gate's Apply: stage,
 * reply, Apply, a card `applied` with what landed, saved and reopened.
 * Made-up paths and text: *Alice*.
 */
import { DraftEditApplier } from '@/application/services/draftEdit/DraftEditApplier';
import { FileEditStagingService } from '@/application/services/fileEdits/FileEditStagingService';
import { ProjectFileEditGateway } from '@/application/services/fileEdits/ProjectFileEditGateway';
import { resolveWorkshopReplyFileEdits } from '@/application/services/workshop/fileEdits/WorkshopReplyFileEditProposals';
import { WorkshopFileEditHandler } from '@handlers/domain/workshop/WorkshopFileEditHandler';
import {
  MessageType,
  type WorkshopFileEditAction,
  type WorkshopFileEditResultPayload,
  type WorkshopFileEditsMode,
  type WorkshopTurn
} from '@messages';
import { fileEditFrame } from '@/__tests__/application/services/workshop/fileEdits/fileEditFixtures';
import { ScriptedWorkshopRoom } from '../workshop/session/ScriptedWorkshopRoom';
import { HARNESS_ROOT, scriptedCheckpoint, setupCoordinator } from '../workshop/session/WorkshopCoordinatorHarness';
import { applyAll, applyTicked, FakeDocuments, firstThen, writerTypes, type HostBehavior } from '../draftEdit/fakeDocuments';
import { candidate, hostFakes, ports, uriOf } from './fileEditFixtures';

const NOTE = `${HARNESS_ROOT}/characters/alice.md`;
const NOTE_TEXT = '---\ntitle: Alice\n---\n\nAlice is seven.\n\nShe follows the White Rabbit.\n';
const REPLACE = fileEditFrame({ group: 'characters', path: 'characters/alice.md' });
const REPLACE_AND_APPEND = fileEditFrame({
  group: 'characters',
  path: 'characters/alice.md',
  body: ['<find>Alice is seven.</find>', '<replace-with>Alice is ten.</replace-with>', '<append>She is late.</append>']
});

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

interface Options {
  frame?: string;
  host?: HostBehavior;
  named?: boolean;
  /** Hold the gateway's catalog read, or its open, until released. */
  pause?: 'catalog' | 'open';
}

async function harness(options: Options = {}) {
  const coordinated = setupCoordinator();
  const documents = new FakeDocuments(NOTE_TEXT, uriOf(NOTE), 'markdown', 1, options.host ?? applyAll);
  const fakes = hostFakes({ roots: [HARNESS_ROOT], candidates: [candidate('characters', 'characters/alice.md', HARNESS_ROOT)] });
  const hostPorts = ports(fakes);

  // A persona's reply, staged for real and recorded on its turn.
  const scripted = new ScriptedWorkshopRoom().start();
  scripted.hostMessage('Read Alice.');
  const reply = `Her age changes.\n\n${options.frame ?? REPLACE}`;
  scripted.fileEdits = await resolveWorkshopReplyFileEdits({
    reply, open: true, staging: new FileEditStagingService({ ...hostPorts, documents })
  });
  scripted.hostMessage('Change her age.', { reply });
  if (options.named) {
    await coordinated.store.saveNamed(scriptedCheckpoint('alice', scripted));
    await coordinated.coordinator.initialize();
    await coordinated.coordinator.openNamed('alice');
  } else {
    await coordinated.store.writeCurrent(scriptedCheckpoint('rolling', scripted));
    await coordinated.coordinator.initialize();
  }
  const { session, coordinator, store } = coordinated;
  const turn = session.readRoomLedger().find((each) => each.fileEditProposals?.length) as WorkshopTurn;
  expect(turn.fileEditProposals?.[0]).toMatchObject({ state: 'pending', class: 'notes' });

  const gates = { catalog: deferred(), open: deferred() };
  const reached = { catalog: deferred(), open: deferred() };
  const epoch = { value: 0 };
  const gateway = new ProjectFileEditGateway({
    ...hostPorts,
    candidates: {
      listCandidates: async () => {
        if (options.pause === 'catalog') {
          reached.catalog.resolve();
          await gates.catalog.promise;
        }
        return hostPorts.candidates.listCandidates();
      }
    },
    documents: {
      open: async (uri) => {
        if (options.pause === 'open') {
          reached.open.resolve();
          await gates.open.promise;
        }
        return documents.open(uri);
      },
      reveal: (uri) => documents.reveal(uri)
    },
    applier: new DraftEditApplier(documents),
    epoch: { current: () => epoch.value }
  });
  const gate = { run: false, mode: 'ask' as WorkshopFileEditsMode };
  const posted: Array<{ type: MessageType; payload: any }> = [];
  const handler = new WorkshopFileEditHandler(
    session,
    gateway,
    coordinator,
    { isRoomRunActive: () => gate.run, fileEditsMode: () => gate.mode },
    { postSessionState: () => undefined, markDirty: (reason) => coordinator.markDirty(reason), reportError: jest.fn() },
    async (message) => { posted.push(message as never); },
    { appendLine: () => undefined, show: () => undefined, clear: () => undefined }
  );
  const act = (action: WorkshopFileEditAction, requestId: string, roomRevision = session.readRoomRevision()) => handler.handleAction({
    type: MessageType.WORKSHOP_FILE_EDIT_ACTION,
    source: 'webview.workshop',
    payload: { requestId, roomRevision, turnId: turn.id, index: 0, action },
    timestamp: 0
  } as never);
  const card = () => session.readRoomLedger().find((each) => each.id === turn.id)?.fileEditProposals?.[0];
  const results = () => posted.filter((each) => each.type === MessageType.WORKSHOP_FILE_EDIT_RESULT).map((each) => each.payload as WorkshopFileEditResultPayload);
  const savedCard = async (where: 'current' | 'named' = 'current') => {
    const saved = where === 'current' ? await store.readCurrent() : await store.readNamed('alice');
    return saved?.workshop.turns.find((each) => each.id === turn.id)?.fileEditProposals?.[0];
  };
  return { ...coordinated, documents, gateway, gate, gates, reached, epoch, handler, act, card, results, savedCard, turn };
}

describe('Apply lands at most once (F-04)', () => {
  it('double Apply, with the same and with different request ids: one write, one outcome for each', async () => {
    const fixture = await harness({ pause: 'catalog' });
    const first = fixture.act('apply', 'r1');
    const again = fixture.act('apply', 'r1');
    const other = fixture.act('apply', 'r2');
    await fixture.reached.catalog.promise;
    fixture.gates.catalog.resolve();
    await Promise.all([first, again, other]);

    expect(fixture.documents.applyCalls).toHaveLength(1);
    expect(fixture.documents.text).toBe(NOTE_TEXT.replace('Alice is seven', 'Alice is ten'));
    expect(fixture.results().map(({ requestId, state }) => [requestId, state])).toEqual([['r1', 'applied'], ['r1', 'applied'], ['r2', 'applied']]);
    expect(fixture.card()).toMatchObject({ state: 'applied', outcomes: ['landed'] });
  });

  it('Apply racing Decline: Decline is held while the Apply runs; the Apply lands once', async () => {
    const fixture = await harness({ pause: 'open' });
    const applying = fixture.act('apply', 'r1');
    await fixture.reached.open.promise;
    await fixture.act('decline', 'r2');
    fixture.gates.open.resolve();
    await applying;
    expect(fixture.documents.applyCalls).toHaveLength(1);
    expect(fixture.card()?.state).toBe('applied');
    expect(fixture.results()[0]).toMatchObject({ requestId: 'r2', answer: 'held', state: 'applying' });
  });

  it('the durable checkpoint: while the write is out, current.json holds the card applying (control for the refusals below)', async () => {
    const fixture = await harness({ pause: 'open' });
    const applying = fixture.act('apply', 'r1');
    await fixture.reached.open.promise;
    expect(await fixture.savedCard()).toMatchObject({ state: 'applying' });
    fixture.gates.open.resolve();
    await applying;
    await fixture.coordinator.flush();
    expect(await fixture.savedCard()).toMatchObject({ state: 'applied' });
  });

  it('a named room: the named file and current.json both hold applying before the write', async () => {
    const fixture = await harness({ named: true, pause: 'open' });
    const applying = fixture.act('apply', 'r1');
    await fixture.reached.open.promise;
    expect(await fixture.savedCard('named')).toMatchObject({ state: 'applying' });
    expect(await fixture.savedCard('current')).toMatchObject({ state: 'applying' });
    fixture.gates.open.resolve();
    await applying;
    expect(fixture.documents.applyCalls).toHaveLength(1);
  });

  it.each<[string, (fixture: Awaited<ReturnType<typeof harness>>) => void, string]>([
    ['current.json fails to write', ({ store }) => { jest.spyOn(store, 'writeCurrent').mockRejectedValueOnce(new Error('EIO')); }, 'checkpoint-failed'],
    ['a reply is running (autosave defers capture)', ({ session }) => { session.beginPersonaMessage('run-1', 'Another question.', []); }, 'run-active']
  ])('a checkpoint that fails or defers (%s) writes nothing; the card is pending', async (_label, arrange, reason) => {
    const fixture = await harness();
    arrange(fixture);
    await fixture.act('apply', 'r1');
    expect(fixture.documents.applyCalls).toEqual([]);
    expect(fixture.documents.opened).toEqual([]);
    expect(fixture.card()?.state).toBe('pending');
    expect(fixture.results()[0]).toMatchObject({ answer: 'refused', state: 'pending', reason });
  });

  it('a named room whose current.json mirror fails writes nothing', async () => {
    const fixture = await harness({ named: true });
    jest.spyOn(fixture.store, 'writeCurrent').mockRejectedValueOnce(new Error('EIO'));
    await fixture.act('apply', 'r1');
    expect(fixture.documents.applyCalls).toEqual([]);
    expect(fixture.results()[0]).toMatchObject({ answer: 'refused', reason: 'mirror-failed' });
  });

  it.each(['catalog', 'open'] as const)('the room replaced while the gateway\'s %s is paused: no write, the outcome dropped', async (pause) => {
    const fixture = await harness({ pause });
    const applying = fixture.act('apply', 'r1');
    await fixture.reached[pause].promise;
    await fixture.coordinator.resetSession({ start: 'empty' });
    fixture.gates[pause].resolve();
    await applying;
    expect(fixture.documents.applyCalls).toEqual([]);
    expect(fixture.documents.text).toBe(NOTE_TEXT);
    expect(fixture.results()[0]).toMatchObject({ answer: 'room-changed' });
  });

  it('the room replaced while the checkpoint is paused: no write', async () => {
    const fixture = await harness();
    const held = deferred();
    const reached = deferred();
    const write = fixture.store.writeCurrent.bind(fixture.store);
    jest.spyOn(fixture.store, 'writeCurrent').mockImplementationOnce(async (...args) => {
      reached.resolve();
      await held.promise;
      return write(...args);
    });
    const applying = fixture.act('apply', 'r1');
    await reached.promise;
    // A replacement is ordered behind the checkpoint, so it lands as the checkpoint settles; the generation it mints refuses the write.
    const replacing = fixture.coordinator.resetSession({ start: 'empty' });
    held.resolve();
    await Promise.all([applying, replacing]);
    expect(fixture.documents.applyCalls).toEqual([]);
    expect(fixture.results()[0]).toMatchObject({ answer: 'room-changed' });
  });

  it('the generation moved inside the checkpoint: the checkpoint refuses, and the document is never opened', async () => {
    const fixture = await harness();
    const saved = fixture.session.exportCommittedState();
    const write = fixture.store.writeCurrent.bind(fixture.store);
    jest.spyOn(fixture.store, 'writeCurrent').mockImplementationOnce(async (...args) => {
      // The same session installed again under the write: same ids, a new generation.
      fixture.session.hydrateCommittedState(saved, {}, fixture.session.getConversationBehavior());
      return write(...args);
    });
    await fixture.act('apply', 'r1');
    expect(fixture.documents.opened).toEqual([]);
    expect(fixture.documents.applyCalls).toEqual([]);
    expect(fixture.results()[0]).toMatchObject({ answer: 'room-changed' });
  });

  it('the same session reopened while an old action is paused: zero writes, and the reopened card reads unknown with no Apply', async () => {
    const fixture = await harness({ named: true, pause: 'open' });
    const applying = fixture.act('apply', 'r1');
    await fixture.reached.open.promise;
    // The named file holds `applying` (the durable checkpoint). Reopen it: same session, same turn and card ids, a new generation.
    await fixture.coordinator.openNamed('alice');
    fixture.gates.open.resolve();
    await applying;

    expect(fixture.documents.applyCalls).toEqual([]);
    expect(fixture.results()[0]).toMatchObject({ requestId: 'r1', answer: 'room-changed' });
    expect(fixture.card()).toMatchObject({ state: 'unknown', reason: 'applying-on-reopen' });
    await fixture.act('apply', 'r2');
    expect(fixture.documents.applyCalls).toEqual([]);
    expect(fixture.results()[1]).toMatchObject({ answer: 'replayed', state: 'unknown' });
  });

  it('retry authority lost: the setting turned off between the first attempt and its retry makes no second attempt', async () => {
    const quote = 'Alice is seven.';
    const fixture = await harness({
      host: (edits, review, document) => {
        fixture.gate.mode = 'off';
        return writerTypes([{ offset: document.text.length, length: 0, text: 'More.\n' }])(edits, review, document);
      }
    });
    await fixture.act('apply', 'r1');
    expect(fixture.documents.applyCalls).toHaveLength(1);
    expect(fixture.documents.text).toContain(quote);
    // Lost at the boundary before the retry: nothing landed, so the card is pending again.
    expect(fixture.card()?.state).toBe('pending');
  });

  it('control: with authority held, the retry lands', async () => {
    const fixture = await harness({ host: firstThen(writerTypes([{ offset: NOTE_TEXT.length, length: 0, text: 'More.\n' }]), applyAll) });
    await fixture.act('apply', 'r1');
    expect(fixture.documents.applyCalls).toHaveLength(2);
    expect(fixture.card()?.state).toBe('applied');
  });

  it('a review with an entry unticked: partial, by operation, with a record for what landed', async () => {
    const fixture = await harness({ frame: REPLACE_AND_APPEND, host: applyTicked((edit) => edit.newText.includes('ten')) });
    await fixture.act('review', 'r1');
    expect(fixture.documents.applyCalls).toHaveLength(1);
    expect(fixture.card()).toMatchObject({
      state: 'partial',
      outcomes: ['landed', 'not-applied'],
      landed: [{ operation: 0, before: 'Alice is seven.', after: 'Alice is ten.', versionAfter: 2 }]
    });
  });

  it('the document closed during review: unknown, with no Apply offered again', async () => {
    const fixture = await harness({ host: (_edits, _review, document) => { document.close(); return { kind: 'submitted' }; } });
    await fixture.act('review', 'r1');
    expect(fixture.card()).toMatchObject({ state: 'unknown', outcomes: ['unknown'] });
    await fixture.act('apply', 'r2');
    expect(fixture.documents.applyCalls).toHaveLength(1);
  });

  it('a card saved applying and reopened reads unknown, with no Apply', async () => {
    const fixture = await harness({ named: true, pause: 'open' });
    const applying = fixture.act('apply', 'r1');
    await fixture.reached.open.promise;
    const saved = await fixture.store.readNamed('alice');
    fixture.gates.open.resolve();
    await applying;

    const reopened = setupCoordinator();
    await reopened.store.saveNamed(saved!);
    await reopened.coordinator.initialize();
    await reopened.coordinator.openNamed('alice');
    const card = reopened.session.readRoomLedger().find((each) => each.id === fixture.turn.id)?.fileEditProposals?.[0];
    expect(card).toMatchObject({ state: 'unknown', reason: 'applying-on-reopen', outcomes: ['unknown'] });
  });
});

describe('the combined integration gate: one Apply round trip', () => {
  it('stage, reply, Apply: the card is applied with what landed, and survives save and reopen', async () => {
    const fixture = await harness({ frame: REPLACE_AND_APPEND });
    await fixture.act('apply', 'r1');
    expect(fixture.documents.text).toBe('---\ntitle: Alice\n---\n\nAlice is ten.\n\nShe follows the White Rabbit.\n\nShe is late.\n');
    const landed = {
      state: 'applied',
      outcomes: ['landed', 'landed'],
      landed: [
        { operation: 0, before: 'Alice is seven.', after: 'Alice is ten.', contextBefore: '---\ntitle: Alice\n---\n\n', contextAfter: '\n\nShe follows the White Rabbit.\n\nShe is late.\n', versionAfter: 2 },
        { operation: 1, before: '', after: '\n\nShe is late.', contextBefore: expect.stringMatching(/White Rabbit\.$/), contextAfter: '\n', versionAfter: 2 }
      ]
    };
    expect(fixture.card()).toMatchObject(landed);
    expect(fixture.documents.revealed).toHaveLength(1);

    await fixture.coordinator.flush();
    const saved = await fixture.store.readCurrent();
    const reopened = setupCoordinator();
    await reopened.store.writeCurrent(saved!);
    await reopened.coordinator.initialize();
    const card = reopened.session.readRoomLedger().find((each) => each.id === fixture.turn.id)?.fileEditProposals?.[0];
    expect(card).toMatchObject(landed);
    expect(card?.target?.documentUri).toBe(uriOf(NOTE));
  });
});
