import type { WorkshopTurn } from '@messages';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { decodeWorkshopPersistedSessionCheckpoint, parseWorkshopPersistedSession } from '@/application/services/workshop/WorkshopPersistedSession';
import { parseWorkshopSessionStateV1 } from '@/application/services/workshop/WorkshopSessionStateV1';
import { workshopTurnForWebview } from '@/application/services/workshop/fileEdits/WorkshopFileEditWebviewView';

const firstFile = { sourceUri: 'file:///book/first/page.md', relativePath: 'first/page.md' };
const secondFile = { sourceUri: 'file:///book/other/page.md', relativePath: 'other/page.md' };
const set = { title: 'Private title', places: [{ start: { quote: 'Private quote' }, note: 'Private note' }] };

function keep(session: WorkshopSessionService, request: string, source = firstFile) {
  session.beginPersonaMessage(request, 'What stands out?');
  const turn = session.completeRun(request, 'I kept a highlight.', undefined, false, undefined, [],
    undefined, undefined, undefined, [], [], [], undefined, undefined, undefined, undefined, undefined, undefined, { source, set });
  if (!turn?.highlights) {
    throw new Error('Expected a committed highlight set');
  }
  return turn.id;
}

function reopened(session: WorkshopSessionService) {
  const next = new WorkshopSessionService();
  const stored = parseWorkshopSessionStateV1(JSON.parse(JSON.stringify(session.exportCommittedState())));
  next.hydrateCommittedState(stored, {}, session.getConversationBehavior());
  return next;
}

describe('restore eligibility on the kept highlight set', () => {
  it('projects counts and exact saved sources in ledger order without exposing notes or mutable ledger data', () => {
    const session = new WorkshopSessionService(() => 42);
    session.setSessionScope('open');
    const first = keep(session, 'first');
    const other = keep(session, 'other', secondFile);
    const candidates = session.readHighlightPromptCandidates();
    expect(candidates).toEqual([
      { turnId: first, source: firstFile, count: 1 },
      { turnId: other, source: secondFile, count: 1 }
    ]);
    candidates[0].source.sourceUri = secondFile.sourceUri;
    candidates.pop();
    expect(session.readRoomTurn(first)?.highlights?.source).toEqual(firstFile);
    expect(session.readHighlightPromptCandidates()).toHaveLength(2);
  });

  it('suppresses exactly the offered sets across reopen and leaves new sets and manual Show eligible', () => {
    const session = new WorkshopSessionService(() => 42);
    session.setSessionScope('open');
    const offered = keep(session, 'offered');
    const other = keep(session, 'other', secondFile);
    const revision = session.readRoomRevision();
    const newer = keep(session, 'new-same-file');
    expect(session.suppressHighlightPrompts(revision, [offered, offered, 'missing'])).toBe(true);
    expect(session.suppressHighlightPrompts(revision, [offered])).toBe(false);
    const next = reopened(session);
    expect(next.readHighlightPromptCandidates().map(candidate => candidate.turnId)).toEqual([other, newer]);
    expect(next.readHighlightTurnIds()).toEqual(new Set([offered, other, newer]));
    const storedTurn = next.readRoomTurn(offered)!;
    expect(storedTurn.highlights).toEqual({ source: firstFile, set, suppressRestorePrompt: true });
    expect(workshopTurnForWebview(storedTurn)).toMatchObject({ highlightSummary: { title: set.title, count: 1 } });
    expect(workshopTurnForWebview(storedTurn)).not.toHaveProperty('highlights');
    expect(next.suppressHighlightPrompts(revision, [newer])).toBe(false);
    expect(next.readRoomTurn(newer)?.highlights?.suppressRestorePrompt).toBeUndefined();
    const acceptedAfterReopen = keep(next, 'accepted-after-reopen');
    expect(next.readHighlightPromptCandidates().map(candidate => candidate.turnId)).toEqual([other, newer, acceptedAfterReopen]);
  });

  const fixture = require('../../../../fixtures/workshop-session-v2-before-group-match.json');
  function savedRecord(patch: object) {
    const document = JSON.parse(JSON.stringify(fixture));
    const turn = document.workshop.turns.find((entry: WorkshopTurn) => entry.participant === 'host' && entry.role === 'assistant');
    turn.highlights = { source: firstFile, set, ...patch };
    return document;
  }

  it('retains an earlier saved highlight byte-for-byte and offers it after loading', () => {
    const old = savedRecord({});
    expect(JSON.stringify(parseWorkshopPersistedSession(old))).toBe(JSON.stringify(old));
    const session = new WorkshopSessionService();
    const { workshop } = decodeWorkshopPersistedSessionCheckpoint(old).session;
    session.hydrateCommittedState(workshop, {}, session.getConversationBehavior());
    expect(session.readHighlightPromptCandidates()).toEqual([{ turnId: expect.any(String), source: firstFile, count: 1 }]);
  });

  it.each([false, 1, 'true', null])('rejects a malformed persisted suppression choice %p', value => {
    expect(() => parseWorkshopPersistedSession(savedRecord({ suppressRestorePrompt: value }))).toThrow(/suppressRestorePrompt/);
  });
});
