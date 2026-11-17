/**
 * `lens.*` through the persona capability and a committed run (ADR
 * 2026-11-17 D16, D19): the real engine runs a host turn and a guest's
 * join, each calling the family through real XML; the completion boundary
 * commits them; the room is saved and reopened.
 *
 * - The card: its artifact, family label and summary, for host and guest.
 * - Private in v1: never published, no manifest row.
 * - The evidence: escaped, framed as the writer's saved word field.
 * - A rejected request leaves a card; the shared call ceiling does too.
 * - The transcript (export and recall) names the request, never the lens.
 * - A session holding both artifacts saves and reopens (forward-only).
 * - Logs carry no slug a persona wrote, no subject and no lens text.
 */
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopPersonaCapabilityFactory } from '@/application/services/workshop/WorkshopPersonaCapability';
import {
  isWorkshopPublishableCapabilityEvidence,
  workshopTurnAudience
} from '@/application/services/workshop/WorkshopRoomAudience';
import { projectWorkshopTranscriptTurn } from '@/application/services/workshop/transcript/WorkshopTranscript';
import {
  WORKSHOP_LENS_EVIDENCE_FRAMING,
  WORKSHOP_LENS_FRAMING,
  WORKSHOP_LENS_REJECTED_COPY
} from '@/application/services/workshop/lens/WorkshopLensCopy';
import {
  decodeWorkshopPersistedSessionCheckpoint,
  parseWorkshopPersistedSession
} from '@/application/services/workshop/WorkshopPersistedSession';
import type { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
import type { WorkshopTranscriptRecallPort } from '@/application/services/workshop/recall/WorkshopTranscriptRecallCapability';
import type { DictionaryService } from '@services/dictionary/DictionaryService';
import type { ContextResourceProviderFactory } from '@/domain/models/ContextGeneration';
import type { WorkshopCapabilityRequest } from '@shared/types/workshopCapabilities';
import { WORKSHOP_TURN_ARTIFACTS } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { createRecallRunHarness, recallCall as call } from '@/__tests__/application/services/workshop/recall/workshopRecallRunHarness';
import { offProjectMemory } from '@/__tests__/application/services/workshop/memory/projectMemoryTestPorts';
import { aliceLens, lensLibrary } from '@/__tests__/application/services/workshop/lens/lensLibraryFixtures';
import type { WorkshopLensLibraryPort } from '@/application/services/workshop/lens/WorkshopLensCapability';

const NAME = 'NAME-MARKER Tea Party';
const SUBJECT = 'SUBJECT-MARKER a mad tea party';
const SAMPLE = 'SAMPLE-MARKER The Hatter <em>poured</em> from an empty pot.';
const MARKERS = ['NAME-MARKER', 'SUBJECT-MARKER', 'SAMPLE-MARKER', 'DESCRIPTION-MARKER'];
const LENS = { ...aliceLens('tea-party', { name: NAME, originQuery: SUBJECT, description: 'DESCRIPTION-MARKER cups and clocks.' }), sample: SAMPLE };
const LIBRARY = lensLibrary([LENS, aliceLens('croquet')]);

describe('a room whose host and guest read the lens library', () => {
  let room: ReturnType<typeof createRecallRunHarness>;
  afterEach(() => room.dispose());

  it('records private cards, frames the evidence, keeps the lens out of the transcript and the log, and reopens', async () => {
    room = createRecallRunHarness({ lenses: LIBRARY });
    const { session, coordinator, manager, log } = room;
    await coordinator.initialize();
    session.setSessionScope('open');

    const hostReply = await room.host('h-1', 'What lenses have I built?', [
      call('lens.catalog', ''),
      call('lens.read', '<lens>tea-party</lens>'),
      // Refused by the codec: a card is left, and the persona corrects itself.
      call('lens.read', '<lens>tea-party</lens><section>vocabulary</section>'),
      'HOST-FINAL: you have two lenses of your own; the tea-party one leans on cups and clocks.'
    ]);
    await room.join('cliff', 'j-cliff', 'What do you make of the tea-party lens?', [
      call('lens.read', '<lens>tea-party</lens><section>sample</section>'),
      'GUEST-FINAL: its sample pours from an empty pot.'
    ]);

    // The cards.
    const ledger = () => session.readRoomLedger();
    const cards = ledger().filter((turn) => turn.capability && turn.capability.operation.startsWith('lens.'));
    expect(cards.map((turn) => [turn.artifact, turn.toolLabel, turn.capability!.status, turn.capability!.requestSummary, turn.capability!.invokedBy.kind])).toEqual([
      ['lens_catalog', 'Lens Library', 'success', 'the lens library', 'host'],
      ['lens_read', 'Lens Library', 'success', 'tea-party', 'host'],
      ['lens_read', 'Lens Library', 'rejected', 'lens.read rejected (invalid-section: section)', 'host'],
      ['lens_read', 'Lens Library', 'success', 'tea-party: sample', 'personaGuest']
    ]);
    expect(cards[2].content).toContain(WORKSHOP_LENS_REJECTED_COPY.invalid);
    expect(cards[1].content.startsWith(WORKSHOP_LENS_FRAMING)).toBe(true);

    // Private in v1 (D16): committed, and still never published; each stays with the participant that asked.
    expect(hostReply.content).toContain('HOST-FINAL');
    for (const card of cards) {
      expect(card.capability!.publishedWithTurnId).toBeUndefined();
      expect(isWorkshopPublishableCapabilityEvidence(card.capability!)).toBe(false);
      expect(workshopTurnAudience(card)).toEqual({ kind: 'private', principal: card.capability!.invokedBy });
      // Even a card wrongly stamped published would not reach the room.
      expect(workshopTurnAudience({ ...card, capability: { ...card.capability!, publishedWithTurnId: hostReply.id } }))
        .toEqual({ kind: 'private', principal: card.capability!.invokedBy });
    }
    // No manifest row: the context-source kinds did not widen.
    expect(manager.getContextSources(session.getHostConversationId())).toEqual([]);
    expect(manager.getContextSources(session.getPersonaGuestConversationId('cliff'))).toEqual([]);

    // The evidence, as each provider request carried it: escaped, in the result frame, closed by the trust class.
    const sent = room.sent.join('\n');
    expect(sent).toContain('<workshop-capability-result name=\\"lens.read\\" status=\\"success\\"');
    expect(sent).toContain('<workshop-capability-result name=\\"lens.catalog\\" status=\\"success\\"');
    expect(sent).toContain('SAMPLE-MARKER The Hatter &lt;em&gt;poured&lt;/em&gt; from an empty pot.');
    expect(sent).not.toContain('<em>poured</em>');
    expect(sent).toContain(JSON.stringify(`</workshop-capability-result>\n${WORKSHOP_LENS_EVIDENCE_FRAMING}`).slice(1, -1));
    // The guest read its own copy; the host's conversation never received the guest's card, nor the reverse.
    const hostHistory = JSON.stringify(manager.getMessages(session.getHostConversationId()!));
    const guestHistory = JSON.stringify(manager.getMessages(session.getPersonaGuestConversationId('cliff')!));
    expect(hostHistory).toContain('NAME-MARKER');
    expect(guestHistory).toContain('SAMPLE-MARKER');
    expect(guestHistory).not.toContain('## logic');
    expect(hostHistory).not.toContain('GUEST-FINAL');

    // The transcript's one rule: a capability card is a one-line event naming the request, never its body.
    const transcript = ledger().map((turn) => projectWorkshopTranscriptTurn(turn)).filter(Boolean);
    const lines = JSON.stringify(transcript);
    expect(lines).toContain('Lens Library · tea-party · requested by Jill · success');
    expect(lines).toContain('Lens Library · the lens library · requested by Jill · success');
    for (const marker of [...MARKERS, 'Cups, clocks', '## logic', 'the table that never clears']) {
      expect([marker, lines.includes(marker)]).toEqual([marker, false]);
    }

    // Saved and reopened: the forward-only artifacts and operations read back.
    const saved = await coordinator.saveNamed('Lens room');
    await coordinator.resetSession({ start: 'full-reset' });
    expect(ledger().some((turn) => turn.artifact === 'lens_read')).toBe(false);
    await coordinator.openNamed(saved.sessionId);
    const reopened = ledger().filter((turn) => turn.capability && turn.capability.operation.startsWith('lens.'));
    expect(reopened.map((turn) => [turn.artifact, turn.capability!.operation, turn.capability!.status, turn.capability!.invokedBy.kind])).toEqual([
      ['lens_catalog', 'lens.catalog', 'success', 'host'],
      ['lens_read', 'lens.read', 'success', 'host'],
      ['lens_read', 'lens.read', 'rejected', 'host'],
      ['lens_read', 'lens.read', 'success', 'personaGuest']
    ]);
    expect(reopened.every((turn) => turn.capability!.publishedWithTurnId === undefined)).toBe(true);
    for (const artifact of WORKSHOP_TURN_ARTIFACTS.filter((name) => name.startsWith('lens_'))) {
      expect(reopened.map((turn) => turn.artifact)).toContain(artifact);
    }

    // Logs (D19): the operation, counts and outcomes; never a slug a persona wrote, a subject or lens text.
    const logged = (log.appendLine as jest.Mock).mock.calls.map(([line]) => String(line));
    const family = logged.filter((line) => /lens/i.test(line));
    expect(family.some((line) => line.startsWith('[WorkshopLensCapability] request=h-1 persona=jill catalog page=1 pages=1'))).toBe(true);
    expect(family.some((line) => line.includes('capability=lens.read input=slugChars=9; sections=all outcome=success'))).toBe(true);
    expect(family.some((line) => line.includes('lensMetrics=outcome=read;lenses=n/a;page=n/a/n/a;sections=7/7;'))).toBe(true);
    expect(family.some((line) => line.includes('capability=lens.read outcome=rejected rejectionReason=invalid-section'))).toBe(true);
    for (const fragment of [...MARKERS, 'tea-party', 'croquet', 'Cups, clocks', 'Hatter']) {
      expect([fragment, logged.filter((line) => line.includes(fragment))]).toEqual([fragment, []]);
    }
  });
});

describe('the persisted lists (D16)', () => {
  it('holds the two artifacts in the closed list, and an older build\'s list would refuse them', () => {
    expect(WORKSHOP_TURN_ARTIFACTS).toEqual(expect.arrayContaining(['lens_catalog', 'lens_read']));
    expect(WORKSHOP_TURN_ARTIFACTS.filter((name) => name.startsWith('lens_'))).toEqual(['lens_catalog', 'lens_read']);
  });

  it('refuses a saved turn whose artifact or operation the family does not have', async () => {
    const room = createRecallRunHarness({ lenses: LIBRARY });
    try {
      const { session, coordinator, store } = room;
      await coordinator.initialize();
      session.setSessionScope('open');
      await room.host('h-1', 'List my lenses.', [call('lens.catalog', ''), 'HOST-FINAL: listed.']);
      const saved = await coordinator.saveNamed('Lens room');
      const file = await store.readNamed(saved.sessionId);
      if (!file) {
        throw new Error('the saved session did not read');
      }
      const raw = JSON.parse(JSON.stringify(file));
      expect(() => parseWorkshopPersistedSession(JSON.parse(JSON.stringify(raw)))).not.toThrow();
      expect(() => decodeWorkshopPersistedSessionCheckpoint(JSON.parse(JSON.stringify(raw)))).not.toThrow();
      const tamper = (edit: (card: { artifact: string; capability: { operation: string } }) => void) => {
        const copy = JSON.parse(JSON.stringify(raw));
        edit(copy.workshop.turns.find((turn: { artifact?: string }) => turn.artifact === 'lens_catalog'));
        return copy;
      };
      expect(() => parseWorkshopPersistedSession(tamper((card) => { card.artifact = 'lens_search'; }))).toThrow();
      expect(() => parseWorkshopPersistedSession(tamper((card) => { card.capability.operation = 'lens.search'; }))).toThrow();
    } finally {
      room.dispose();
    }
  });
});

describe('what the thread and the turn ceiling say of a lens call', () => {
  function wire(library: WorkshopLensLibraryPort = LIBRARY) {
    const session = new WorkshopSessionService(() => Date.parse('2026-11-17T10:00:00.000Z'));
    session.setSessionScope('open');
    session.beginPersonaMessage('host-request', 'What lenses have I built?');
    const status = jest.fn();
    const capability = new WorkshopPersonaCapabilityFactory(
      {} as DictionaryService,
      {} as WorkshopAnalysisSidePass,
      { createProvider: jest.fn() } as unknown as ContextResourceProviderFactory,
      session,
      { appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() },
      {} as WorkshopTranscriptRecallPort,
      offProjectMemory,
      library
    ).create({
      requestId: 'host-request',
      excerptVersion: session.getExcerptVersion(),
      personaId: 'jill',
      owner: { kind: 'host' },
      signal: new AbortController().signal,
      events: { status, turnCompleted: jest.fn(), sessionChanged: jest.fn() }
    });
    return { session, capability };
  }
  const request = (xml: string, capability: ReturnType<typeof wire>['capability']): WorkshopCapabilityRequest => {
    const inspected = capability.inspectRequest(xml);
    if (inspected.kind !== 'request') {
      throw new Error(`expected a request, got ${JSON.stringify(inspected)}`);
    }
    return inspected.request;
  };

  it('names what the persona is doing without naming the lens', () => {
    const { capability } = wire();
    const read = request(call('lens.read', '<lens>tea-party</lens>'), capability);
    const catalog = request(call('lens.catalog', '<page>2</page>'), capability);
    expect(capability.statusMessage(read)).toBe('Jill is reading a Lexical Gravity lens…');
    expect(capability.statusTicker(read)).toBe('Lenses · read');
    expect(capability.statusMessage(catalog)).toBe('Jill is looking through the Lexical Gravity lenses…');
    expect(capability.statusTicker(catalog)).toBe('Lenses · catalog');
    expect(capability.requestLogSummary(read)).toBe('slugChars=9; sections=all');
    expect(capability.requestLogSummary(catalog)).toBe('page=2');
  });

  it('fulfills through the persona capability with the family\'s framing, one card and no manifest row', async () => {
    const { session, capability } = wire();
    const fulfillment = await capability.fulfill(request(call('lens.read', '<lens>tea-party</lens><section>sample</section>'), capability));
    expect(fulfillment.evidence.startsWith('<workshop-capability-result name="lens.read" status="success" excerpt-version="0">')).toBe(true);
    expect(fulfillment.evidence).toContain(`<content>${WORKSHOP_LENS_FRAMING}`);
    expect(fulfillment.evidence.endsWith(`</workshop-capability-result>\n${WORKSHOP_LENS_EVIDENCE_FRAMING}`)).toBe(true);
    expect(fulfillment.deliveredSources).toEqual([]);
    expect(fulfillment.deliveredItems).toEqual(['lens.read:success']);
    expect(fulfillment.usage).toBeUndefined();
    expect(fulfillment.artifacts).toHaveLength(1);
    expect(fulfillment.artifacts![0]).toMatchObject({ catalog: 'workshopPersona', label: 'Lens Library', category: 'lens.read' });
    expect(session.readRoomLedger().filter((turn) => turn.artifact === 'lens_read')).toHaveLength(1);
  });

  it('counts against the shared per-turn ceiling, and leaves a card when over it', () => {
    const { session, capability } = wire();
    expect(PROMPT_BUDGETS.workshopCapability.callsPerTurn).toBeGreaterThan(0);
    const artifacts = capability.handleCapabilityLimit(request(call('lens.catalog', ''), capability));
    expect(artifacts).toHaveLength(1);
    const [card] = session.readRoomLedger().filter((turn) => turn.artifact === 'lens_catalog');
    expect(card.capability).toMatchObject({ status: 'rejected', metadata: { rejectionReason: 'capability-call-limit' } });
    expect(card.content).toContain(WORKSHOP_LENS_REJECTED_COPY.limit);
  });
});
