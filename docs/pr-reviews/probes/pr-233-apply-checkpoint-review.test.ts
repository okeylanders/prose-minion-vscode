/**
 * Independent PR #233 review witnesses for implementation d0c172b7.
 * Copy to packages/core/src/__tests__/application/services/fileEdits/pr233IndependentReview.test.ts
 * and run the single file with Jest. This artifact is outside normal CI discovery.
 * The mixed partial message assertion records the current wording defect;
 * it is not a desired-behavior regression expectation.
 * Fixture assembly reuses the PR's production-stack integration harness.
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
import { applyAll, FakeDocuments, type HostBehavior } from '../draftEdit/fakeDocuments';
import { candidate, hostFakes, ports, uriOf } from './fileEditFixtures';

const NOTE = `${HARNESS_ROOT}/characters/alice.md`;
const NOTE_TEXT = '---\ntitle: Alice\n---\n\nAlice is seven.\n\nShe follows the White Rabbit.\n';
const REPLACE = fileEditFrame({ group: 'characters', path: 'characters/alice.md' });
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


describe('Independent PR 233 review probes', () => {
  it('mixed landed/unknown preserves uncertainty but the result wrongly promises the rest were not applied', async () => {
    const frame = fileEditFrame({ group: 'characters', path: 'characters/alice.md', body: [
      '<find>Alice is seven.</find>', '<replace-with>Alice is ten.</replace-with>',
      '<find>She follows the White Rabbit.</find>', '<replace-with>She greets the White Rabbit.</replace-with>'
    ] });
    const f = await harness({ frame, host: (edits, _review, document) => {
      document.edit(edits.map((e, i) => ({ offset: e.start, length: e.end - e.start,
        text: i === 0 ? e.newText : 'She sees something else.' })));
      return { kind: 'submitted' };
    }});
    await f.act('review', 'r1');
    expect(f.card()).toMatchObject({ state: 'partial', outcomes: ['landed', 'unknown'] });
    expect(f.results()[0].message).toBe('Some of the changes were applied; the rest were not. The file is not saved yet.');
    await f.coordinator.flush();
    expect(await f.savedCard()).toMatchObject({ state: 'partial', outcomes: ['landed', 'unknown'] });
  });

  it('current read-back without the applying card refuses before dispatch', async () => {
    const f = await harness();
    const read = f.store.readCurrentWithRecovery.bind(f.store);
    jest.spyOn(f.store, 'readCurrentWithRecovery').mockImplementationOnce(async () => {
      const value = await read();
      const turn = value!.session.workshop.turns.find(t => t.id === f.turn.id)!;
      turn.fileEditProposals = [{ ...turn.fileEditProposals![0], state: 'pending' }];
      return value;
    });
    await f.act('apply', 'r1');
    expect(f.documents.applyCalls).toHaveLength(0);
    expect(f.card()?.state).toBe('pending');
    expect(f.results()[0]).toMatchObject({ reason: 'checkpoint-failed' });
  });

  it('named mirror read-back without applying refuses before dispatch', async () => {
    const f = await harness({ named: true });
    const read = f.store.readCurrentWithRecovery.bind(f.store);
    jest.spyOn(f.store, 'readCurrentWithRecovery').mockImplementationOnce(async () => {
      const value = await read();
      const turn = value!.session.workshop.turns.find(t => t.id === f.turn.id)!;
      turn.fileEditProposals = [{ ...turn.fileEditProposals![0], state: 'pending' }];
      return value;
    });
    await f.act('apply', 'r1');
    expect(f.documents.applyCalls).toHaveLength(0);
    expect(f.results()[0]).toMatchObject({ reason: 'mirror-failed' });
  });

  it('setting turned off during delayed resolution prevents the first dispatch', async () => {
    const f = await harness({ pause: 'open' });
    const applying = f.act('apply', 'r1');
    await f.reached.open.promise;
    f.gate.mode = 'off';
    f.gates.open.resolve();
    await applying;
    expect(f.documents.applyCalls).toHaveLength(0);
    expect(f.card()?.state).toBe('pending');
  });

  it('append duplicates are single-use live and after persistence', async () => {
    const f = await harness({ frame: fileEditFrame({ group: 'characters', path: 'characters/alice.md', body: ['<append>She is late.</append>'] }), pause: 'catalog' });
    const a = f.act('apply', 'r1');
    await f.reached.catalog.promise;
    const b = f.act('apply', 'r2');
    f.gates.catalog.resolve();
    await Promise.all([a, b]);
    await f.coordinator.flush();
    await f.act('apply', 'r3');
    expect(f.documents.text.split('She is late.')).toHaveLength(2);
    expect(f.documents.applyCalls).toHaveLength(1);
    expect(await f.savedCard()).toMatchObject({ state: 'applied' });
  });

  it('a dispatched review settling after room replacement remains unknown in the source session', async () => {
    const reached = deferred();
    const release = deferred();
    const f = await harness({ named: true, host: async (edits, review, document) => {
      reached.resolve(); await release.promise;
      return applyAll(edits, review, document);
    }});
    const pending = f.act('review', 'r1');
    await reached.promise;
    await f.coordinator.resetSession({ start: 'empty' });
    release.resolve();
    await pending;
    expect(f.documents.applyCalls).toHaveLength(1);
    expect(f.documents.text).toContain('Alice is ten.');
    expect(f.results()[0]).toMatchObject({ answer: 'room-changed' });
    expect(await f.savedCard('named')).toMatchObject({ state: 'applying' });
    await f.coordinator.openNamed('alice');
    expect(f.card()).toMatchObject({ state: 'unknown', reason: 'applying-on-reopen' });
    await f.act('apply', 'r2');
    expect(f.documents.applyCalls).toHaveLength(1);
  });

  it('old generation requests never claim a newly reopened same-id card', async () => {
    const f = await harness({ named: true });
    const old = f.session.readRoomRevision();
    await f.coordinator.openNamed('alice');
    await f.act('apply', 'r1', old);
    expect(f.results()[0]).toMatchObject({ answer: 'room-changed' });
    expect(f.documents.applyCalls).toHaveLength(0);
    expect(f.card()?.state).toBe('pending');
  });

  it('a discarded editor review returns to pending and can be applied once later', async () => {
    const f = await harness({ host: () => ({ kind: 'declined' }) });
    await f.act('review', 'r1');
    expect(f.card()?.state).toBe('pending');
    f.documents.host = applyAll;
    await f.act('apply', 'r2');
    expect(f.documents.text).toContain('Alice is ten.');
    expect(f.card()?.state).toBe('applied');
  });
});
