/**
 * Session-owned passage and scope state machine.
 *
 * WorkshopSessionService remains the aggregate root. This collaborator owns
 * only the pinned/shelved passage, its revision state, and pending excerpt
 * delivery. Participant memory, turns, manifests, and persistence I/O remain
 * outside this boundary and are supplied only as scalar facts when needed.
 */

import {
  WorkshopExcerpt,
  WorkshopExcerptSource,
  WorkshopSelectableSessionScope,
  WorkshopSessionScope
} from '@messages';
import type {
  WorkshopExcerptInput,
  WorkshopParticipantSubjectStatus,
  WorkshopScopeTransition
} from '@/application/services/workshop/WorkshopSessionRecords';

/** Passage-only facts needed by the aggregate to coordinate a replacement. */
export interface WorkshopPassageReplacement {
  /** False when this was the first passage rather than a revision. */
  replaced: boolean;
  excerpt: WorkshopExcerpt;
  replacementCount: number;
  /** The one-slot shelf entry displaced by this pin, if any. */
  discardedShelvedExcerpt?: WorkshopExcerpt;
}

export interface WorkshopPassageScopeState {
  excerpt?: WorkshopExcerpt;
  scope: WorkshopSessionScope;
  shelvedExcerpt?: WorkshopExcerpt;
  excerptVersion: number;
  replacementCount: number;
  pendingRevisionVersion?: number;
}

/**
 * Domain refusal for an attempted path change after participant memory exists.
 * Presentation adapters decide how to explain the recovery path to a writer.
 */
export class WorkshopScopeLockedError extends Error {
  readonly code = 'workshop-scope-locked';

  constructor(readonly attempt: string) {
    super(`Cannot ${attempt}: this room already has a conversation`);
    this.name = 'WorkshopScopeLockedError';
  }
}

export function workshopParticipantSubjectStatus(
  scope: WorkshopSessionScope,
  excerpt?: Pick<WorkshopExcerpt, 'text'>
): WorkshopParticipantSubjectStatus {
  if (scope === null) {
    return { ready: false, reason: 'scope-unchosen' };
  }
  if (scope === 'open') {
    return { ready: true };
  }
  return excerpt && excerpt.text.trim().length > 0
    ? { ready: true }
    : { ready: false, reason: 'excerpt-missing' };
}

export class WorkshopPassageScope {
  private excerpt?: WorkshopExcerpt;
  private scope: WorkshopSessionScope = null;
  private shelvedExcerpt?: WorkshopExcerpt;
  private excerptVersion = 0;
  private replacementCount = 0;
  private pendingRevisionVersion?: number;

  constructor(private readonly now: () => number) {}

  getScope(): WorkshopSessionScope {
    return this.scope;
  }

  getExcerpt(): WorkshopExcerpt | undefined {
    return this.excerpt ? cloneExcerpt(this.excerpt) : undefined;
  }

  getShelvedExcerpt(): WorkshopExcerpt | undefined {
    return this.shelvedExcerpt ? cloneExcerpt(this.shelvedExcerpt) : undefined;
  }

  getExcerptVersion(): number {
    return this.excerptVersion;
  }

  getReplacementCount(): number {
    return this.replacementCount;
  }

  getPendingRevisionVersion(): number | undefined {
    return this.pendingRevisionVersion;
  }

  /**
   * Choose or change the session path. Reconciliation with the current path is
   * safe even after memory exists, so the no-op check must precede the lock.
   */
  setSessionScope(
    scope: WorkshopSelectableSessionScope,
    locked: boolean
  ): WorkshopScopeTransition {
    if (this.isIdempotentScopeRequest(scope)) {
      return this.scopeTransition(false);
    }
    this.requireUnlockedScope(
      locked,
      scope === 'open'
        ? 'set this session to an open conversation'
        : 'start a passage session'
    );

    if (scope === 'open') {
      const shelved = this.excerpt;
      this.scope = 'open';
      if (shelved) {
        this.shelvedExcerpt = shelved;
        this.excerpt = undefined;
        this.pendingRevisionVersion = undefined;
      }
      return this.scopeTransition(true);
    }

    const restored = this.excerpt ?? this.shelvedExcerpt;
    if (!restored) {
      throw new Error('Cannot start a passage session without an excerpt');
    }
    this.adoptShelvedExcerpt(restored);
    this.scope = 'excerpt';
    return this.scopeTransition(true);
  }

  repinShelvedExcerpt(locked: boolean): WorkshopScopeTransition {
    const shelved = this.shelvedExcerpt;
    if (!shelved) {
      throw new Error('No Workshop excerpt is on the shelf');
    }
    if (this.excerpt) {
      throw new Error('An excerpt is already pinned in this Workshop session');
    }
    this.requireUnlockedScope(locked, 're-pin the set-aside excerpt');
    this.adoptShelvedExcerpt(shelved);
    this.scope = 'excerpt';
    return this.scopeTransition(true);
  }

  setExcerpt(input: WorkshopExcerptInput): WorkshopExcerpt {
    this.excerptVersion += 1;
    this.excerpt = {
      text: input.text,
      version: this.excerptVersion,
      source: cloneExcerptSource(input.source),
      truncation: input.truncation ? { ...input.truncation } : undefined,
      sourceFingerprint: input.sourceFingerprint,
      pinnedAt: this.now()
    };
    this.scope = 'excerpt';
    this.shelvedExcerpt = undefined;
    return cloneExcerpt(this.excerpt);
  }

  /**
   * Replace only passage state. The aggregate uses the returned facts to
   * retire sidecars/manifests and append the visible revision boundary.
   */
  replaceExcerpt(input: WorkshopExcerptInput, locked: boolean): WorkshopPassageReplacement {
    if (this.scope === 'open') {
      this.requireUnlockedScope(locked, 'add an excerpt to this open conversation');
    }

    const displaced = this.shelvedExcerpt;
    const replaced = (this.excerpt ?? displaced) !== undefined;
    const excerpt = this.setExcerpt(input);
    if (replaced) {
      this.replacementCount += 1;
    }

    return {
      replaced,
      excerpt,
      replacementCount: this.replacementCount,
      discardedShelvedExcerpt: displaced ? cloneExcerpt(displaced) : undefined
    };
  }

  /** Queue the current revision only when a retained host received a prior pin. */
  queueExcerptDelivery(
    hasHostConversation: boolean,
    hostDeliveredExcerptVersion: number | undefined
  ): void {
    if (!hasHostConversation || hostDeliveredExcerptVersion === undefined || !this.excerpt) {
      return;
    }
    this.pendingRevisionVersion = this.excerpt.version;
  }

  collectPendingExcerptDelivery(): WorkshopExcerpt | undefined {
    return this.excerpt !== undefined
      && this.pendingRevisionVersion === this.excerpt.version
      ? cloneExcerpt(this.excerpt)
      : undefined;
  }

  /** Clear only the exact excerpt generation that a successful frame shipped. */
  commitPendingExcerptDelivery(deliveredExcerptVersion: number): boolean {
    if (deliveredExcerptVersion !== this.pendingRevisionVersion) {
      return false;
    }
    this.pendingRevisionVersion = undefined;
    return true;
  }

  clearPendingExcerptDelivery(): void {
    this.pendingRevisionVersion = undefined;
  }

  /** Running a tool against a carried passage chooses the excerpt path. */
  chooseExcerptScopeIfUnchosen(): void {
    this.requireExcerpt();
    if (this.scope === null) {
      this.scope = 'excerpt';
    }
  }

  getParticipantSubjectStatus(): WorkshopParticipantSubjectStatus {
    return workshopParticipantSubjectStatus(this.scope, this.excerpt);
  }

  requireParticipantSubject(): void {
    const status = this.getParticipantSubjectStatus();
    if (status.ready) {
      return;
    }
    if (status.reason === 'scope-unchosen') {
      throw new Error('Choose how to start this Workshop session before messaging');
    }
    this.requireExcerpt();
  }

  requireExcerpt(): void {
    if (!this.excerpt || this.excerpt.text.trim().length === 0) {
      throw new Error('Cannot run a Workshop conversation without a pinned excerpt');
    }
  }

  exportState(): WorkshopPassageScopeState {
    return {
      excerpt: this.getExcerpt(),
      scope: this.scope,
      shelvedExcerpt: this.getShelvedExcerpt(),
      excerptVersion: this.excerptVersion,
      replacementCount: this.replacementCount,
      pendingRevisionVersion: this.pendingRevisionVersion
    };
  }

  /** Perform every potentially throwing clone before aggregate installation begins. */
  prepareState(state: WorkshopPassageScopeState): WorkshopPassageScopeState {
    return {
      excerpt: state.excerpt ? cloneExcerpt(state.excerpt) : undefined,
      scope: state.scope,
      shelvedExcerpt: state.shelvedExcerpt ? cloneExcerpt(state.shelvedExcerpt) : undefined,
      excerptVersion: state.excerptVersion,
      replacementCount: state.replacementCount,
      pendingRevisionVersion: state.pendingRevisionVersion
    };
  }

  /** Install state produced by this scope's prepare phase; this must not throw. */
  installPreparedState(state: WorkshopPassageScopeState): void {
    this.excerpt = state.excerpt;
    this.scope = state.scope;
    this.shelvedExcerpt = state.shelvedExcerpt;
    this.excerptVersion = state.excerptVersion;
    this.replacementCount = state.replacementCount;
    this.pendingRevisionVersion = state.pendingRevisionVersion;
  }

  /**
   * Start a new room. An ordinary reset restores the one-slot shelf and keeps
   * its passage revision; a full reset clears the working set and its revision.
   */
  reset(options: { clearWorkingSet?: boolean } = {}): void {
    if (options.clearWorkingSet) {
      this.excerpt = undefined;
      this.shelvedExcerpt = undefined;
      this.excerptVersion = 0;
    } else {
      if (!this.excerpt && this.shelvedExcerpt) {
        this.excerpt = this.shelvedExcerpt;
      }
      this.shelvedExcerpt = undefined;
    }
    this.scope = null;
    this.replacementCount = 0;
    this.pendingRevisionVersion = undefined;
  }

  private isIdempotentScopeRequest(scope: WorkshopSelectableSessionScope): boolean {
    return scope === 'open'
      ? this.scope === 'open' && this.excerpt === undefined
      : this.scope === 'excerpt' && this.excerpt !== undefined;
  }

  private adoptShelvedExcerpt(excerpt: WorkshopExcerpt): void {
    this.excerpt = excerpt;
    this.shelvedExcerpt = undefined;
    this.pendingRevisionVersion = undefined;
  }

  private scopeTransition(changed: boolean): WorkshopScopeTransition {
    return {
      scope: this.scope,
      changed,
      excerpt: this.getExcerpt(),
      shelvedExcerpt: this.getShelvedExcerpt()
    };
  }

  private requireUnlockedScope(locked: boolean, attempt: string): void {
    if (locked) {
      throw new WorkshopScopeLockedError(attempt);
    }
  }
}

function cloneExcerptSource(source: WorkshopExcerptSource): WorkshopExcerptSource {
  if (source.kind === 'manual') {
    return { kind: 'manual' };
  }
  return {
    ...source,
    configuredResource: source.configuredResource ? { ...source.configuredResource } : undefined
  };
}

function cloneExcerpt(excerpt: WorkshopExcerpt): WorkshopExcerpt {
  return {
    ...excerpt,
    source: cloneExcerptSource(excerpt.source),
    truncation: excerpt.truncation ? { ...excerpt.truncation } : undefined
  };
}
