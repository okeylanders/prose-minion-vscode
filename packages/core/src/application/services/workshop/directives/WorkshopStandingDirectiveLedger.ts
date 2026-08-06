/**
 * Session-owned ledger for passage-scoped standing prose directives.
 *
 * One active entry may exist per closed family. Mutations are prepared as
 * complete replacement states so application services can first replace every
 * retained persona system prompt, then atomically install the matching room
 * state. Provider history and session history therefore cannot disagree.
 */

import {
  WorkshopStandingDirectiveFamily,
  WorkshopStandingDirectiveSnapshot
} from '@messages';

export interface WorkshopStandingDirectiveLedgerState {
  counter: number;
  directives: WorkshopStandingDirectiveSnapshot[];
}

export interface WorkshopStandingDirectiveUpsertInput {
  family: WorkshopStandingDirectiveFamily;
  widgetId: WorkshopStandingDirectiveSnapshot['widgetId'];
  widgetConfigId: string;
  revision: number;
}

interface PreparedWorkshopStandingDirectiveMutationBase {
  directive: WorkshopStandingDirectiveSnapshot;
  state: WorkshopStandingDirectiveLedgerState;
}

export interface PreparedWorkshopStandingDirectiveUpsert
  extends PreparedWorkshopStandingDirectiveMutationBase {
  action: 'installed' | 'shifted';
}

export interface PreparedWorkshopStandingDirectiveRemoval
  extends PreparedWorkshopStandingDirectiveMutationBase {
  action: 'removed';
}

export type PreparedWorkshopStandingDirectiveMutation =
  | PreparedWorkshopStandingDirectiveUpsert
  | PreparedWorkshopStandingDirectiveRemoval;

const cloneDirective = (
  directive: WorkshopStandingDirectiveSnapshot
): WorkshopStandingDirectiveSnapshot => ({ ...directive });

export class WorkshopStandingDirectiveLedger {
  private counter = 0;
  private directives: WorkshopStandingDirectiveSnapshot[] = [];

  constructor(private readonly now: () => number) {}

  list(): WorkshopStandingDirectiveSnapshot[] {
    return this.directives.map(cloneDirective);
  }

  get(family: WorkshopStandingDirectiveFamily): WorkshopStandingDirectiveSnapshot | undefined {
    const directive = this.directives.find((candidate) => candidate.family === family);
    return directive ? cloneDirective(directive) : undefined;
  }

  prepareUpsert(
    input: WorkshopStandingDirectiveUpsertInput
  ): PreparedWorkshopStandingDirectiveUpsert {
    const existingIndex = this.directives.findIndex(
      (candidate) => candidate.family === input.family
    );
    const existing = existingIndex >= 0 ? this.directives[existingIndex] : undefined;
    const counter = existing ? this.counter : this.counter + 1;
    const directive: WorkshopStandingDirectiveSnapshot = {
      id: existing?.id ?? `pd-${counter}`,
      ...input,
      updatedAt: this.now()
    };
    const directives = this.directives.map(cloneDirective);
    if (existingIndex >= 0) {
      directives[existingIndex] = directive;
    } else {
      directives.push(directive);
    }
    return {
      action: existing ? 'shifted' : 'installed',
      directive: cloneDirective(directive),
      state: { counter, directives }
    };
  }

  prepareRemoval(
    family: WorkshopStandingDirectiveFamily
  ): PreparedWorkshopStandingDirectiveRemoval | undefined {
    const directive = this.directives.find((candidate) => candidate.family === family);
    if (!directive) {return undefined;}
    return {
      action: 'removed',
      directive: cloneDirective(directive),
      state: {
        counter: this.counter,
        directives: this.directives
          .filter((candidate) => candidate.family !== family)
          .map(cloneDirective)
      }
    };
  }

  exportState(): WorkshopStandingDirectiveLedgerState {
    return {
      counter: this.counter,
      directives: this.directives.map(cloneDirective)
    };
  }

  prepareState(
    state: WorkshopStandingDirectiveLedgerState
  ): WorkshopStandingDirectiveLedgerState {
    return {
      counter: state.counter,
      directives: state.directives.map(cloneDirective)
    };
  }

  /** Install state produced by this ledger's prepare phase; this must not throw. */
  installPreparedState(state: WorkshopStandingDirectiveLedgerState): void {
    this.counter = state.counter;
    this.directives = state.directives;
  }

  reset(): void {
    this.counter = 0;
    this.directives = [];
  }
}
