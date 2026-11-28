import { samePath } from '@/application/services/fileEdits/fileEditIdentity';
import type { MessageRouter } from '@handlers/MessageRouter';
import {
  MessageType, type WorkshopAnswerHighlightPromptMessage, type WorkshopHighlightIdentity,
  type WorkshopHighlightMessage, type WorkshopHighlightPrompt
} from '@messages';
import type { WorkshopIntakeCatalogScope } from '@/application/services/workshop/WorkshopIntakeCatalogScope';
import type { WorkshopContextIntakeService } from '@/application/services/workshop/WorkshopContextIntakeService';
import type { WorkshopOpenRoomInstancePort } from '@/application/services/workshop/WorkshopOpenRoomInstance';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type { WorkshopHighlightEditor } from '@/application/services/workshop/highlights/WorkshopHighlightEditor';
import type { WorkshopHighlightProposal } from './WorkshopHighlightProposal';
import type { WorkshopHighlightRestore, WorkshopHighlightRestorePlan } from './WorkshopHighlightRestore';

type DrawResult = { placed: number; skipped: number } | 'unavailable' | 'open-failed' | undefined;
type Gesture = { current(fsPath?: string): boolean; dispose(): void };

export class WorkshopHighlightHandler {
  private readonly pending = new Map<string, symbol>();
  private readonly stopListening: () => void;
  private disposed = false;

  constructor(
    private readonly session: Pick<WorkshopSessionService, 'readRoomRevision' | 'readRoomTurn' | 'readHighlightTurnIds'>,
    room: Pick<WorkshopOpenRoomInstancePort, 'onRoomReplaced'>,
    private readonly intake: Pick<WorkshopContextIntakeService, 'authorizeExcerptReread'>,
    private readonly editor: WorkshopHighlightEditor | undefined,
    private readonly status: (message: string) => void,
    private readonly prompts?: { proposal: WorkshopHighlightProposal; restore: WorkshopHighlightRestore }
  ) {
    this.stopListening = room.onRoomReplaced(({ rewound }) => {
      this.cancel();
      this.editor?.retain(rewound ? this.session.readHighlightTurnIds() : new Set());
    });
  }

  private cancel(): void {
    this.pending.clear();
    this.prompts?.restore.cancel();
    this.prompts?.proposal.cancel();
  }

  highlightPrompt(): WorkshopHighlightPrompt | undefined {
    if (this.disposed || !this.prompts || !this.editor) { return; }
    const restore = this.prompts.restore.current();
    return this.prompts.proposal.current() ?? restore;
  }

  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.WORKSHOP_SHOW_HIGHLIGHTS, (message: WorkshopHighlightMessage) => this.show(message.payload));
    router.register(MessageType.WORKSHOP_CLEAR_HIGHLIGHTS, async (message: WorkshopHighlightMessage) => {
      const turn = this.lookup(message.payload);
      if (turn?.highlights) {
        this.pending.delete(turn.id);
        this.editor?.clear(turn.id);
      }
    });
    router.register(MessageType.WORKSHOP_ANSWER_HIGHLIGHT_PROMPT, async (message: WorkshopAnswerHighlightPromptMessage) => {
      const answer = message.payload;
      if (!this.prompts || this.disposed || !answer || answer.roomRevision !== this.session.readRoomRevision()
        || Object.keys(answer).length !== 3 || typeof answer.promptId !== 'string' || typeof answer.choice !== 'string') { return; }
      // The writer may have answered a visible restore just before a newer proposal reached the pane.
      if (this.prompts.proposal.current()?.promptId === answer.promptId) {
        this.prompts.proposal.answer(answer);
        return;
      }
      const plan = this.prompts.restore.take(answer);
      if (plan) { await this.restore(plan); }
    });
  }

  private lookup(identity: WorkshopHighlightIdentity | undefined) {
    if (this.disposed || !identity || identity.roomRevision !== this.session.readRoomRevision()
      || typeof identity.turnId !== 'string'
      || Object.keys(identity).some((key) => key !== 'turnId' && key !== 'roomRevision')) { return; }
    return this.session.readRoomTurn(identity.turnId);
  }

  private gesture(editor: WorkshopHighlightEditor): Gesture {
    const generation = editor.clearGeneration;
    // Start before authorization, including the excerpt check for a batch whose file may have moved.
    const tabs = editor.captureTabClosures?.();
    return {
      current: path => !this.disposed && generation === editor.clearGeneration && (!path || !tabs || tabs.current(path)),
      dispose: () => tabs?.dispose()
    };
  }

  private async show(identity: WorkshopHighlightIdentity): Promise<void> {
    if (!this.lookup(identity)?.highlights) { return; }
    if (!this.editor) { this.status('Workshop highlights are unavailable in this editor.'); return; }
    const token = Symbol();
    this.pending.set(identity.turnId, token);
    const gesture = this.gesture(this.editor);
    try {
      const result = await this.draw(identity, token, gesture.current);
      if (result === 'unavailable') { this.status('The excerpt file is no longer available for highlights.'); }
      else if (result === 'open-failed') { this.status('The excerpt file could not be opened for highlights.'); }
      else if (result) { this.reportShown(result.placed, result.skipped); }
    } finally {
      gesture.dispose();
      this.finish(identity.turnId, token);
    }
  }

  private async restore(plan: WorkshopHighlightRestorePlan): Promise<void> {
    if (!this.editor || !plan.current()) { return; }
    const token = Symbol();
    // Clear a single set, or deliberately Show it again, even before the batch reaches that turn.
    for (const id of plan.turnIds) { this.pending.set(id, token); }
    const gesture = this.gesture(this.editor);
    const current = () => plan.current() && gesture.current(plan.fsPath);
    try {
      const scope = plan.freshScope();
      const file = await this.intake.authorizeExcerptReread({ kind: 'file', ...plan.source }, scope);
      if (!current()) { return; }
      if (file.kind !== 'authorized' || !samePath(file.fsPath, plan.fsPath)) {
        this.status('The excerpt file is no longer available for highlights.');
        return;
      }
      let placed = 0;
      let skipped = 0;
      for (const turnId of plan.turnIds) {
        if (!current()) { return; }
        const identity = { turnId, roomRevision: plan.roomRevision };
        const result = await this.draw(identity, token, current, { path: plan.fsPath, scope });
        if (result && typeof result === 'object') { placed += result.placed; skipped += result.skipped; }
        else if (result) { skipped += this.lookup(identity)?.highlights?.set.places.length ?? 0; }
      }
      if (current()) { this.reportShown(placed, skipped); }
    } catch {
      if (current()) { this.status('The excerpt file could not be opened for highlights.'); }
    } finally {
      gesture.dispose();
      for (const id of plan.turnIds) { this.finish(id, token); }
    }
  }

  private finish(id: string, token: symbol): void {
    if (this.pending.get(id) === token) { this.pending.delete(id); }
  }

  private async draw(
    identity: WorkshopHighlightIdentity, token: symbol, isDrawCurrent: (path?: string) => boolean, batch?: { path: string; scope: WorkshopIntakeCatalogScope }
  ): Promise<DrawResult> {
    const turn = this.lookup(identity);
    if (!this.editor || !turn?.highlights) { return; }
    const { source, set } = turn.highlights;
    let authorizedPath: string | undefined;
    const current = () => this.pending.get(turn.id) === token && !!this.lookup(identity)?.highlights && isDrawCurrent(authorizedPath);
    if (!current()) { return; }
    try {
      const saved = { kind: 'file' as const, ...source };
      const auth = batch ? await this.intake.authorizeExcerptReread(saved, batch.scope) : await this.intake.authorizeExcerptReread(saved);
      if (auth.kind === 'authorized') { authorizedPath = auth.fsPath; }
      if (!current()) { return; }
      if (auth.kind !== 'authorized' || (batch && !samePath(batch.path, auth.fsPath))) { return 'unavailable'; }
      const result = await this.editor.show(turn.id, batch?.path ?? auth.fsPath, turn.personaLabel ?? 'Persona', set, current);
      if (!current()) { return; }
      return result ? { placed: result.placed, skipped: set.places.length - result.placed } : 'open-failed';
    } catch {
      return current() ? 'open-failed' : undefined;
    }
  }

  private reportShown(placed: number, skipped: number): void {
    this.status(`Shown ${placed} ${placed === 1 ? 'highlight' : 'highlights'}${skipped ? ` · ${skipped} skipped` : ''}.`);
  }

  dispose(): void {
    this.disposed = true;
    this.stopListening();
    this.cancel();
    this.editor?.retain(new Set());
  }
}
