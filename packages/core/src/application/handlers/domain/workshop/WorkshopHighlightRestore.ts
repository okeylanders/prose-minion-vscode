import { samePath } from '@/application/services/fileEdits/fileEditIdentity';
import { randomUUID } from 'crypto';
import type { WorkshopHighlightPrompt, WorkshopHighlightPromptAnswer } from '@messages';
import type { WorkshopSessionPersistenceCoordinator } from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type { WorkshopContextIntakeService } from '@/application/services/workshop/WorkshopContextIntakeService';
import { workshopIntakeCatalogScope, type WorkshopIntakeCatalogScope } from '@/application/services/workshop/WorkshopIntakeCatalogScope';

type RestorePrompt = Extract<WorkshopHighlightPrompt, { kind: 'restore' }>;
type Persistence = Pick<WorkshopSessionPersistenceCoordinator, 'takeHighlightRestoreOpening' | 'markDirty'>;
type Opening = NonNullable<ReturnType<Persistence['takeHighlightRestoreOpening']>>;
type Source = { sourceUri: string; relativePath: string };

export interface WorkshopHighlightRestorePlan {
  turnIds: string[];
  roomRevision: number;
  fsPath: string;
  source: Source;
  current(): boolean;
  freshScope(): WorkshopIntakeCatalogScope;
}

/** One transient offer for an authentic disk opening in this pane. Its quotes and file identities stay in the host. */
export class WorkshopHighlightRestore {
  private offer?: { prompt: RestorePrompt; plan: WorkshopHighlightRestorePlan };
  private generation = 0;

  constructor(
    private readonly session: Pick<WorkshopSessionService, 'getExcerpt' | 'readRoomRevision' | 'suppressHighlightPrompts'>,
    private readonly persistence: Persistence,
    private readonly intake: Pick<WorkshopContextIntakeService, 'authorizeExcerptReread' | 'toDisplayPath' | 'openCatalog' | 'workspaceRoots'>,
    private readonly changed: () => void
  ) {}

  current(): RestorePrompt | undefined {
    const opening = this.persistence.takeHighlightRestoreOpening();
    if (opening) {
      this.cancel();
      if (opening.candidates.length) { void this.prepare(opening, this.generation); }
    }
    if (this.offer && !this.offer.plan.current()) { this.cancel(); }
    return this.offer?.prompt;
  }

  cancel(): void {
    this.generation++;
    this.offer = undefined;
  }

  private async prepare(opening: Opening, generation: number): Promise<void> {
    const excerpt = this.session.getExcerpt();
    if (!excerpt || excerpt.version !== opening.excerptVersion || excerpt.source.kind === 'manual') { return; }
    const { sourceUri, relativePath } = excerpt.source;
    const current = () => generation === this.generation && opening.roomRevision === this.session.readRoomRevision()
      && this.session.getExcerpt()?.version === opening.excerptVersion;
    try {
      const scope = workshopIntakeCatalogScope(this.intake);
      const source = { sourceUri, relativePath };
      const file = await this.intake.authorizeExcerptReread({ kind: 'file', ...source }, scope);
      if (!current() || file.kind !== 'authorized') { return; }
      // Moved workspaces may have several old URIs for this same file. Resolve each distinct
      // saved identity once, while keeping the approved turns in their original ledger order.
      const key = (saved: Source) => JSON.stringify([saved.sourceUri, saved.relativePath]);
      const matches = new Map([[key(source), true]]);
      const turnIds: string[] = [];
      let count = 0;
      for (const candidate of opening.candidates) {
        const id = key(candidate.source);
        if (!matches.has(id)) {
          const resolved = await this.intake.authorizeExcerptReread({ kind: 'file', ...candidate.source }, scope)
            .catch(() => undefined);
          if (!current()) { return; }
          matches.set(id, resolved?.kind === 'authorized' && samePath(resolved.fsPath, file.fsPath));
        }
        if (matches.get(id)) { turnIds.push(candidate.turnId); count += candidate.count; }
      }
      if (!turnIds.length) { return; }
      this.offer = {
        prompt: { kind: 'restore', promptId: randomUUID(), roomRevision: opening.roomRevision,
          displayPath: file.source.configuredResource?.path ?? this.intake.toDisplayPath(file.fsPath), count, setCount: turnIds.length },
        plan: { turnIds, roomRevision: opening.roomRevision, fsPath: file.fsPath, source, current,
          freshScope: () => workshopIntakeCatalogScope(this.intake) }
      };
      this.changed();
    } catch {
      // A failed authority check establishes no file for this opening.
    }
  }

  take(answer: WorkshopHighlightPromptAnswer): WorkshopHighlightRestorePlan | undefined {
    const offer = this.offer;
    if (!offer || !offer.plan.current() || offer.prompt.promptId !== answer.promptId
      || offer.prompt.roomRevision !== answer.roomRevision || !['restore', 'suppress', 'not-now'].includes(answer.choice)) { return; }
    this.offer = undefined;
    if (answer.choice === 'suppress' && this.session.suppressHighlightPrompts(answer.roomRevision, offer.plan.turnIds)) {
      this.persistence.markDirty('highlight restore prompts suppressed');
    }
    this.changed();
    return answer.choice === 'restore' ? offer.plan : undefined;
  }
}
