/**
 * A scripted Workshop room for retained-history tests (ADR 2026-09-30).
 *
 * It drives a real `WorkshopSessionService`, a real `ConversationManager`
 * standing in for the provider store, the real room-delivery service, and the
 * production completion boundary (`completeWorkshopRun`,
 * `WorkshopAnalysisSidePass.adoptWriterReport`) with the same sequencing the
 * room handler uses:
 *
 *   prepare room delivery → begin the run → [capability evidence] →
 *   commit provider history → complete with settlement → mark
 *
 * After every step that leaves the room at rest it captures an oracle snapshot
 * of BOTH halves — the exported aggregate and the conversation archive — the
 * same pair `capture()` persists. Sprint 01 proves marks exact at every rest
 * point; Sprint 02 rewinds to each one and compares (the equivalence oracle).
 */

import {
  completeWorkshopRun,
  workshopMessageCompletionCopy,
  workshopSynthesisCompletionCopy,
  WorkshopRunCompletionEvents
} from '@/application/services/workshop/WorkshopRunCompletion';
import { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
import { WorkshopRoomDeliveryService } from '@/application/services/workshop/WorkshopRoomDeliveryService';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type {
  WorkshopConversationLogicalKey,
  WorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1';
import type { WorkshopMessageAttachment } from '@/application/services/workshop/WorkshopSessionRecords';
import type { AnalysisResult } from '@/domain/models/AnalysisResult';
import {
  ConversationArchiveEntryV1,
  ConversationManager
} from '@orchestration/ConversationManager';
import type { OpenRouterMessage } from '@providers/OpenRouterClient';
import type { AssistantToolService } from '@services/analysis/AssistantToolService';
import type {
  ContextSourceEntry,
  WorkshopChatTarget,
  WorkshopPersonaId,
  WorkshopToolId,
  WorkshopTurn
} from '@messages';
import type { LogSink } from '@/platform';

export interface ScriptedRestPoint {
  label: string;
  headTurnId: string;
  workshop: WorkshopSessionStateV1;
  archive: ConversationArchiveEntryV1<WorkshopConversationLogicalKey>[];
}

export interface ScriptedAttachment {
  label: string;
  content: string;
}

const toolConversationName = (toolId: WorkshopToolId): string =>
  toolId === 'dialogue'
    ? 'dialogue-microbeat-assistant'
    : toolId === 'prose'
      ? 'prose-assistant'
      : `writing-tools-${toolId}`;

const silentEvents = (): WorkshopRunCompletionEvents => ({
  streamCompleted: () => undefined,
  turnCompleted: () => undefined,
  status: () => undefined,
  error: () => undefined,
  widgetRecommendationRejected: () => undefined
});

export class ScriptedWorkshopRoom {
  readonly session: WorkshopSessionService;
  readonly conversations = new ConversationManager();
  readonly delivery: WorkshopRoomDeliveryService;
  readonly restPoints: ScriptedRestPoint[] = [];
  /** Completion-boundary log lines, for asserting mark diagnostics. */
  readonly log: string[] = [];
  private clock = 1_000;
  private runCounter = 0;
  private readonly sidePass: WorkshopAnalysisSidePass;

  constructor() {
    this.session = new WorkshopSessionService(() => ++this.clock);
    this.delivery = new WorkshopRoomDeliveryService(this.session);
    const assistant = {
      readWorkshopRetainedHistory: (id: string) =>
        this.conversations.getCommittedHistoryCounts(id),
      discardConversation: (id: string) => this.conversations.deleteConversation(id)
    } as unknown as AssistantToolService;
    const sink: LogSink = {
      appendLine: (line: string) => this.log.push(line),
      clear: () => undefined,
      show: () => undefined
    };
    this.sidePass = new WorkshopAnalysisSidePass(assistant, this.session, sink);
  }

  /** A fresh excerpt-scoped room: start marker plus a pinned passage. */
  start(excerpt = 'The first cup waits on the sill.'): this {
    this.session.recordSessionMarker('start', 'Session started.');
    this.session.setExcerpt({ text: excerpt, source: { kind: 'manual' } });
    this.session.setSessionScope('excerpt');
    return this.rest('start');
  }

  hostMessage(
    text: string,
    options: { capabilityRounds?: number; attachment?: ScriptedAttachment } = {}
  ): WorkshopTurn {
    const staged = this.stage(options.attachment);
    const requestId = this.requestId('host');
    const roomDelivery = this.delivery.prepare({ kind: 'host' });
    const pendingHostUpdates = this.session.collectPendingHostUpdates();
    const writerTurn = this.session.beginPersonaMessage(requestId, text, this.refs(staged));
    const evidence = this.recordCapabilityEvidence(requestId, options.capabilityRounds ?? 0);
    const conversationId = this.commitHistory(
      this.session.getHostConversationId(),
      `workshop_persona_${this.session.getSelectedPersonaId()}`,
      `[host] ${text}`,
      `Host reply to "${text}".`,
      evidence
    );
    const reply = this.complete(requestId, 'Jill', conversationId, `Host reply to "${text}".`, () => {
      this.delivery.commit(roomDelivery);
      if (pendingHostUpdates) {
        this.session.commitPendingHostUpdates(pendingHostUpdates);
      }
      this.shipAttachments(staged, writerTurn, { kind: 'host' }, true);
    });
    this.rest(`host reply: ${text}`);
    return reply;
  }

  /** Writer-requested tool run: report (sidecar commit) then host synthesis. */
  toolRun(toolId: WorkshopToolId): { report: WorkshopTurn; synthesis: WorkshopTurn } {
    const toolRequestId = this.requestId(`tool-${toolId}`);
    this.session.beginToolRun(toolId, toolRequestId);
    const toolConversationId = this.commitHistory(
      undefined,
      toolConversationName(toolId),
      `[tool ${toolId}] analyze the excerpt`,
      `${toolId} report.`
    );
    const completion = this.sidePass.adoptWriterReport({
      requestId: toolRequestId,
      content: `${toolId} report.`,
      conversationId: toolConversationId,
      toolId
    });
    if (!completion) {
      throw new Error(`Scripted ${toolId} report was refused`);
    }
    // The aggregate holds no run between the report commit and synthesis.
    this.rest(`${toolId} report`);

    const roomDelivery = this.delivery.prepare({ kind: 'host' });
    const pendingHostUpdates = this.session.collectPendingHostUpdates();
    const synthesisRequestId = this.requestId(`synthesis-${toolId}`);
    this.session.beginPersonaSynthesis(synthesisRequestId, completion.turn.id);
    const hostConversationId = this.commitHistory(
      this.session.getHostConversationId(),
      `workshop_persona_${this.session.getSelectedPersonaId()}`,
      `[host] synthesize ${toolId}`,
      `Host synthesis of ${toolId}.`
    );
    const synthesis = completeWorkshopRun({
      session: this.session,
      requestId: synthesisRequestId,
      label: 'Jill synthesis',
      result: this.result(`Host synthesis of ${toolId}.`, hostConversationId),
      aborted: false,
      createsRetainedConversation: false,
      copy: workshopSynthesisCompletionCopy('Jill', toolId),
      discardConversation: (id) => this.conversations.deleteConversation(id),
      readRetainedHistory: (id) => this.conversations.getCommittedHistoryCounts(id),
      settleCommittedRun: () => {
        this.delivery.commit(roomDelivery);
        if (pendingHostUpdates) {
          this.session.commitPendingHostUpdates(pendingHostUpdates);
        }
      },
      log: (line) => this.log.push(line),
      events: silentEvents()
    });
    if (!synthesis) {
      throw new Error(`Scripted ${toolId} synthesis was refused`);
    }
    this.rest(`${toolId} synthesis`);
    return { report: completion.turn, synthesis };
  }

  directToolMessage(
    toolId: WorkshopToolId,
    text: string,
    options: { attachment?: ScriptedAttachment } = {}
  ): WorkshopTurn {
    const staged = this.stage(options.attachment);
    const requestId = this.requestId(`direct-${toolId}`);
    this.session.setChatTarget({ kind: 'tool', toolId });
    const writerTurn = this.session.beginDirectToolMessage(toolId, requestId, text, this.refs(staged));
    const conversationId = this.commitHistory(
      this.session.getToolSidecarConversationId(toolId),
      toolConversationName(toolId),
      `[tool ${toolId}] ${text}`,
      `${toolId} follow-up to "${text}".`
    );
    // Direct tool messages are private: they never publish room artifacts.
    const reply = this.complete(requestId, toolId, conversationId, `${toolId} follow-up to "${text}".`, () => {
      this.shipAttachments(staged, writerTurn, { kind: 'tool', toolId }, false);
    });
    this.rest(`${toolId} follow-up: ${text}`);
    return reply;
  }

  inviteGuest(personaId: WorkshopPersonaId, opening: string): WorkshopTurn {
    const requestId = this.requestId(`join-${personaId}`);
    const joinStart = this.session.beginPersonaGuestJoin(personaId, requestId, opening);
    const joinTurns = this.delivery.prepareJoinSnapshot(
      { kind: 'personaGuest', personaId },
      joinStart.turn.id
    );
    const conversationId = this.commitHistory(
      undefined,
      `workshop_guest_${personaId}`,
      `[join ${personaId}] ${joinTurns.length} room turns; ${opening}`,
      `${personaId} joins.`
    );
    const reply = completeWorkshopRun({
      session: this.session,
      requestId,
      label: personaId,
      result: this.result(`${personaId} joins.`, conversationId),
      aborted: false,
      createsRetainedConversation: true,
      copy: workshopMessageCompletionCopy(personaId),
      discardConversation: (id) => this.conversations.deleteConversation(id),
      readRetainedHistory: (id) => this.conversations.getCommittedHistoryCounts(id),
      settleCommittedRun: () => {
        this.session.recordRoomThreadArtifactDeliveries(
          joinTurns.map((turn) => turn.id),
          { kind: 'personaGuest', personaId }
        );
      },
      log: (line) => this.log.push(line),
      events: silentEvents()
    });
    if (!reply) {
      throw new Error(`Scripted ${personaId} join was refused`);
    }
    this.session.setChatTarget({ kind: 'personaGuest', personaId });
    this.rest(`${personaId} joined`);
    return reply;
  }

  guestMessage(personaId: WorkshopPersonaId, text: string): WorkshopTurn {
    const requestId = this.requestId(`guest-${personaId}`);
    this.session.setChatTarget({ kind: 'personaGuest', personaId });
    const roomDelivery = this.delivery.prepare({ kind: 'personaGuest', personaId });
    this.session.beginPersonaGuestMessage(personaId, requestId, text);
    const conversationId = this.commitHistory(
      this.session.getPersonaGuestConversationId(personaId),
      `workshop_guest_${personaId}`,
      `[guest ${personaId}] ${text}`,
      `${personaId} reply to "${text}".`
    );
    const reply = this.complete(requestId, personaId, conversationId, `${personaId} reply to "${text}".`, () => {
      this.delivery.commit(roomDelivery);
    });
    this.rest(`${personaId} reply: ${text}`);
    return reply;
  }

  dismissGuest(personaId: WorkshopPersonaId): this {
    const conversationId = this.session.dismissPersonaGuest(personaId);
    if (conversationId) {
      this.conversations.deleteConversation(conversationId);
    }
    return this.rest(`${personaId} dismissed`);
  }

  /** Revise the pinned passage: retires tool sidecars and queues the host frame. */
  reviseExcerpt(text: string): this {
    const replacement = this.session.replaceExcerpt({ text, source: { kind: 'manual' } });
    replacement.disposedConversationIds.forEach((id) => this.conversations.deleteConversation(id));
    return this.rest(`excerpt revised to v${replacement.excerpt.version}`);
  }

  addContext(label: string, content: string): this {
    this.session.addContextAttachment({
      kind: 'text',
      origin: 'writer',
      label,
      words: content.split(/\s+/).length,
      content
    });
    return this.rest(`context added: ${label}`);
  }

  /** A host message the writer cancels before any provider history commits. */
  cancelledHostMessage(text: string): WorkshopTurn {
    const requestId = this.requestId('cancelled-host');
    const writerTurn = this.session.beginPersonaMessage(requestId, text);
    completeWorkshopRun({
      session: this.session,
      requestId,
      label: 'Jill',
      result: this.result('', this.session.getHostConversationId()),
      aborted: true,
      createsRetainedConversation: false,
      copy: workshopMessageCompletionCopy('Jill'),
      discardConversation: (id) => this.conversations.deleteConversation(id),
      readRetainedHistory: (id) => this.conversations.getCommittedHistoryCounts(id),
      log: (line) => this.log.push(line),
      events: silentEvents()
    });
    this.rest(`cancelled: ${text}`);
    return writerTurn;
  }

  /** Both persisted halves exactly as `capture()` would pair them. */
  archive(): ConversationArchiveEntryV1<WorkshopConversationLogicalKey>[] {
    const state = this.session.exportCommittedState();
    const targets: Array<{ key: WorkshopConversationLogicalKey; conversationId: string }> = [];
    const hostId = this.session.getHostConversationId();
    if (state.participants.host.conversationKey && hostId) {
      targets.push({ key: 'host', conversationId: hostId });
    }
    for (const sidecar of state.participants.toolSidecars) {
      const id = this.session.getToolSidecarConversationId(sidecar.toolId);
      if (id) {
        targets.push({ key: sidecar.conversationKey, conversationId: id });
      }
    }
    for (const guest of state.participants.personaGuests) {
      const id = this.session.getPersonaGuestConversationId(guest.personaId);
      if (guest.conversationKey && guest.liveness === 'live' && id) {
        targets.push({ key: guest.conversationKey, conversationId: id });
      }
    }
    return this.conversations.exportConversations(targets);
  }

  rest(label: string): this {
    const headTurnId = this.session.readRoomLedger().at(-1)?.id;
    if (!headTurnId) {
      throw new Error(`Scripted rest point "${label}" has an empty ledger`);
    }
    this.restPoints.push({
      label,
      headTurnId,
      workshop: this.session.exportCommittedState(),
      archive: this.archive()
    });
    return this;
  }

  private complete(
    requestId: string,
    label: string,
    conversationId: string,
    content: string,
    settle: () => void
  ): WorkshopTurn {
    const turn = completeWorkshopRun({
      session: this.session,
      requestId,
      label,
      result: this.result(content, conversationId),
      aborted: false,
      createsRetainedConversation: false,
      copy: workshopMessageCompletionCopy(label),
      discardConversation: (id) => this.conversations.deleteConversation(id),
      readRetainedHistory: (id) => this.conversations.getCommittedHistoryCounts(id),
      settleCommittedRun: settle,
      log: (line) => this.log.push(line),
      events: silentEvents()
    });
    if (!turn) {
      throw new Error(`Scripted run ${requestId} was refused`);
    }
    return turn;
  }

  /**
   * One committed provider turn, as the engine would write it: the user
   * message, a request/evidence pair per capability round, and the final
   * reply, plus one manifest row per round. A missing conversation starts
   * fresh, as a first host, tool, or guest run does.
   */
  private commitHistory(
    conversationId: string | undefined,
    toolName: string,
    userMessage: string,
    reply: string,
    evidence: string[] = []
  ): string {
    const id = conversationId ?? this.conversations.startConversation(toolName, `${toolName} system`);
    const messages: OpenRouterMessage[] = [{ role: 'user', content: userMessage }];
    const sources: ContextSourceEntry[] = [];
    for (const [round, request] of evidence.entries()) {
      const artifactId = this.conversations.nextArtifactId(id);
      messages.push(
        { role: 'assistant', content: `<capability-request>${request}</capability-request>` },
        { role: 'user', content: `<agent-evidence id="${artifactId}">${request} result</agent-evidence>` }
      );
      sources.push({
        kind: 'resource',
        origin: 'host',
        label: `Characters/scripted-${this.runCounter}-${round}.md`,
        sizeChars: 120,
        isEstimate: true,
        deliveredAt: this.clock,
        artifactId
      });
    }
    messages.push({ role: 'assistant', content: reply });
    this.conversations.addMessages(id, messages);
    if (sources.length > 0) {
      this.conversations.appendContextSources(id, sources);
    }
    return id;
  }

  /** Visible capability cards the host's run leaves in the ledger. */
  private recordCapabilityEvidence(requestId: string, rounds: number): string[] {
    const requests: string[] = [];
    for (let round = 0; round < rounds; round += 1) {
      const summary = `Continuity check ${round + 1}`;
      const recorded = this.session.recordCapabilityArtifact({
        requestId,
        excerptVersion: this.session.getExcerptVersion(),
        toolId: 'continuity',
        details: {
          operation: 'analysis.run',
          status: 'success',
          requestSummary: summary,
          requestedByPersonaId: this.session.getSelectedPersonaId(),
          invokedBy: { kind: 'host' },
          metadata: { toolId: 'continuity' }
        },
        result: {
          capability: 'analysis.run',
          status: 'success',
          requestSummary: summary,
          content: `${summary}: the cup changes hands twice.`
        }
      });
      if (!recorded) {
        throw new Error(`Scripted capability round ${round} was refused`);
      }
      requests.push(summary);
    }
    return requests;
  }

  private stage(attachment: ScriptedAttachment | undefined): WorkshopMessageAttachment[] {
    if (!attachment) {
      return [];
    }
    const staged = this.session.addMessageAttachment({
      label: attachment.label,
      words: attachment.content.split(/\s+/).length,
      content: attachment.content
    });
    if (!staged.ok) {
      throw new Error(`Scripted attachment ${attachment.label} was refused: ${staged.reason}`);
    }
    return this.session.collectMessageAttachments();
  }

  private refs(staged: readonly WorkshopMessageAttachment[]) {
    return staged.map(({ content: _content, sourceUri: _sourceUri, ...ref }) => ref);
  }

  private shipAttachments(
    staged: readonly WorkshopMessageAttachment[],
    writerTurn: WorkshopTurn,
    target: WorkshopChatTarget,
    publishesRoomArtifacts: boolean
  ): void {
    if (staged.length === 0) {
      return;
    }
    if (publishesRoomArtifacts) {
      this.session.recordRoomThreadArtifacts(
        writerTurn.id,
        staged.map((attachment) => ({
          id: attachment.id,
          name: attachment.label,
          content: attachment.content
        }))
      );
    }
    this.session.commitMessageAttachments(staged.map((attachment) => attachment.id), target);
  }

  private result(content: string, conversationId: string | undefined): AnalysisResult {
    return { toolName: 'scripted', content, conversationId } as AnalysisResult;
  }

  private requestId(kind: string): string {
    this.runCounter += 1;
    return `${kind}-${this.runCounter}`;
  }
}

/**
 * The canonical script: every commit type, every discard, and every rest
 * shape the retained-history epic cares about, in one room.
 */
export function runCanonicalScriptedRoom(): ScriptedWorkshopRoom {
  const room = new ScriptedWorkshopRoom().start();
  room.hostMessage('What is this scene doing?', { capabilityRounds: 2 });
  room.toolRun('prose');
  room.directToolMessage('prose', 'Which sentence drags?', {
    attachment: { label: 'draft-notes.md', content: 'The second sentence runs long.' }
  });
  room.inviteGuest('margot', 'Margot, read this with us.');
  room.guestMessage('margot', 'How does the voice sound?');
  room.reviseExcerpt('The first cup waits on the cold sill.');
  room.addContext('Continuity note', 'The cup was blue in chapter two.');
  room.hostMessage('Does the revision land?', {
    attachment: { label: 'beat-sheet.md', content: 'Beat one: the cup. Beat two: the sill.' }
  });
  room.dismissGuest('margot');
  room.inviteGuest('margot', 'Margot, back for another look?');
  room.cancelledHostMessage('Never mind that.');
  room.hostMessage('Where should the chapter end?', { capabilityRounds: 1 });
  return room;
}
