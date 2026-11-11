/**
 * Between a stored card and the gateway (ADR 2026-11-05 D8, D10): the staged
 * edit taken from the card alone, each gateway state's settlement, and the
 * session setter that holds every settlement to the codec. *Alice*.
 */
import {
  workshopFileEditRetryReasonOf,
  workshopFileEditSettlementOf,
  workshopStagedFileEditOf
} from '@/application/services/workshop/fileEdits/WorkshopFileEditSettlements';
import { resolveWorkshopReplyFileEdits } from '@/application/services/workshop/fileEdits/WorkshopReplyFileEditProposals';
import { workshopTurnForWebview } from '@/application/services/workshop/fileEdits/WorkshopFileEditWebviewView';
import type { FileEditApplyOutcome } from '@/domain/models/FileEdit';
import type { WorkshopFileEditProposal } from '@messages';
import { fakeFileEditStaging, fileEditFrame, URI_SENTINEL } from './fileEditFixtures';
import { ScriptedWorkshopRoom } from '../session/ScriptedWorkshopRoom';

const outcome = (fields: Partial<FileEditApplyOutcome> & Pick<FileEditApplyOutcome, 'state'>): FileEditApplyOutcome => ({
  operations: [{ index: 0, outcome: 'landed' }], revealed: false, message: '', ...fields
});

describe('workshopFileEditSettlementOf', () => {
  it.each<[string, FileEditApplyOutcome, object]>([
    ['applied', outcome({ state: 'applied', landed: [{ operation: 0, beforeSha256: 'a'.repeat(64), afterSha256: 'b'.repeat(64) }] }),
      { state: 'applied', outcomes: ['landed'], landed: [{ operation: 0 }] }],
    ['partial', outcome({ state: 'partial', operations: [{ index: 0, outcome: 'landed' }, { index: 1, outcome: 'refused', reason: 'markup' }, { index: 2, outcome: 'unknown' }] }),
      { state: 'partial', outcomes: ['landed', 'not-applied', 'unknown'] }],
    ['unknown', outcome({ state: 'unknown', operations: [{ index: 0, outcome: 'unknown' }, { index: 1, outcome: 'not-applied' }] }),
      { state: 'unknown', reason: 'outcome-unknown', outcomes: ['unknown', 'not-applied'] }],
    ['a discarded review', outcome({ state: 'declined' }), { state: 'pending' }],
    ['stale', outcome({ state: 'stale', reason: 'baseline-changed' }), { state: 'stale', reason: 'baseline-changed' }],
    ['refused', outcome({ state: 'refused', reason: 'protected' }), { state: 'refused', reason: 'protected' }],
    ['the boundary lost (superseded)', outcome({ state: 'refused', reason: 'superseded' }), { state: 'pending' }],
    ['the boundary lost (authority-changed)', outcome({ state: 'refused', reason: 'authority-changed' }), { state: 'pending' }],
    ['transient: the catalog unreadable at Apply', outcome({ state: 'refused', reason: 'catalog-unreadable' }), { state: 'pending' }],
    ['transient: the host failed with nothing written', outcome({ state: 'refused', reason: 'host-failed' }), { state: 'pending' }],
    ['control: unreadable stays refused', outcome({ state: 'refused', reason: 'unreadable' }), { state: 'refused', reason: 'unreadable' }]
  ])('%s', (_label, given, expected) => {
    expect(workshopFileEditSettlementOf(given)).toMatchObject(expected);
    if ((expected as { state: string }).state === 'pending') {
      // A pending card holds nothing else: no reason, no outcomes.
      expect(workshopFileEditSettlementOf(given)).toEqual({ state: 'pending' });
    }
  });

  it('gives a transient refusal\'s reason for the answer, and none for any other outcome', () => {
    expect(workshopFileEditRetryReasonOf(outcome({ state: 'refused', reason: 'catalog-unreadable' }))).toBe('catalog-unreadable');
    expect(workshopFileEditRetryReasonOf(outcome({ state: 'refused', reason: 'host-failed' }))).toBe('host-failed');
    for (const other of [
      outcome({ state: 'refused', reason: 'superseded' }),
      outcome({ state: 'refused', reason: 'unreadable' }),
      outcome({ state: 'declined' }),
      outcome({ state: 'unknown', reason: 'host-failed' })
    ]) {
      expect(workshopFileEditRetryReasonOf(other)).toBeUndefined();
    }
  });
});

async function room() {
  const scripted = new ScriptedWorkshopRoom().start();
  scripted.hostMessage('Read this.');
  const reply = `Here.\n\n${fileEditFrame({ body: ['<find>Alice is seven</find>', '<replace-with>Alice is ten</replace-with>', '<append>She grows.</append>'] })}`;
  scripted.fileEdits = await resolveWorkshopReplyFileEdits({ reply, open: true, staging: fakeFileEditStaging() });
  const turn = scripted.hostMessage('Change it.', { reply });
  return { session: scripted.session, turn };
}

describe('setFileEditProposalState', () => {
  it('keeps the card\'s staging, operations and why; changes only its settlement', async () => {
    const { session, turn } = await room();
    const before = turn.fileEditProposals![0];
    const after = session.setFileEditProposalState(turn.id, 0, {
      state: 'partial', outcomes: ['landed', 'not-applied'],
      landed: [{ operation: 0, before: 'Alice is seven', after: 'Alice is ten', contextBefore: '', contextAfter: '', versionAfter: 2 }]
    }).fileEditProposals![0];
    const { state: _s, outcomes: _o, landed: _l, ...kept } = after;
    const { state: _bs, ...keptBefore } = before;
    expect(kept).toEqual(keptBefore);
    // A later settlement replaces it whole: pending again drops outcomes and landed records.
    expect(session.setFileEditProposalState(turn.id, 0, { state: 'pending' }).fileEditProposals![0]).toEqual(before);
  });

  it.each<[string, object]>([
    ['landed records on an unknown card', { state: 'unknown', outcomes: ['landed', 'unknown'] }],
    ['a reason on a declined card', { state: 'declined', reason: 'refused' }],
    ['outcomes on a stale card', { state: 'stale', outcomes: ['not-applied', 'not-applied'] }],
    ['an applied card missing a landed record', { state: 'applied', outcomes: ['landed', 'landed'] }]
  ])('refuses what the codec would refuse (%s), and leaves the card as it was', async (_label, settlement) => {
    const { session, turn } = await room();
    expect(() => session.setFileEditProposalState(turn.id, 0, settlement as never)).toThrow();
    expect(session.readRoomLedger().find((each) => each.id === turn.id)?.fileEditProposals?.[0].state).toBe('pending');
  });

  it('refuses a turn with no card there', async () => {
    const { session, turn } = await room();
    expect(() => session.setFileEditProposalState(turn.id, 3, { state: 'declined' })).toThrow(expect.objectContaining({ reason: 'no-card' }));
    expect(() => session.setFileEditProposalState('turn-nope', 0, { state: 'declined' })).toThrow(expect.objectContaining({ reason: 'no-card' }));
  });

  it('a settled card reaches the webview without its URI', async () => {
    const { session, turn } = await room();
    const settled = session.setFileEditProposalState(turn.id, 0, { state: 'declined' });
    expect(JSON.stringify(workshopTurnForWebview(settled))).not.toContain(URI_SENTINEL);
  });
});

describe('workshopStagedFileEditOf', () => {
  it('takes the identity, class, baseline and operations from the stored card', async () => {
    const { turn } = await room();
    const card = turn.fileEditProposals![0];
    expect(workshopStagedFileEditOf(turn.id, 0, card)).toEqual({
      target: card.target, class: 'notes', baseline: card.baseline, operations: card.operations, source: { kind: 'proposal', turnId: turn.id, index: 0 }
    });
  });

  it('has nothing to apply on a card refused at staging', () => {
    const refused: WorkshopFileEditProposal = { requested: { kind: 'excerpt' }, operations: [{ op: 'append', text: 'Alice.' }], why: 'Why.', state: 'refused', reason: 'excerpt-not-a-file' };
    expect(workshopStagedFileEditOf('turn-1', 0, refused)).toBeUndefined();
  });
});
