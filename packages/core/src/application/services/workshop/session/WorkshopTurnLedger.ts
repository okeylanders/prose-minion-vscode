/**
 * Session-owned Workshop turn identity and append-order ledger.
 *
 * `WorkshopSessionService` remains the aggregate root and constructs and
 * interprets every turn. This collaborator deliberately knows no artifact
 * vocabulary: it owns only monotonic identity, ordering, lookup, defensive
 * copies, and prepared hydration state.
 */

import type { WorkshopTurn, WorkshopTurnRole } from '@messages';
import { cloneTurn } from '@/application/services/workshop/WorkshopSessionRecords';

export interface WorkshopTurnLedgerState {
  counter: number;
  turns: WorkshopTurn[];
}

export class WorkshopTurnLedger {
  private counter = 0;
  private turns: WorkshopTurn[] = [];

  constructor(private readonly now: () => number) {}

  nextId(role: WorkshopTurnRole): string {
    return `turn-${++this.counter}-${role}-${this.now()}`;
  }

  append(turn: WorkshopTurn): void {
    if (this.contains(turn.id)) {
      throw new Error(`Duplicate Workshop turn ${turn.id}`);
    }
    this.turns.push(cloneTurn(turn));
  }

  find(id: string): WorkshopTurn | undefined {
    const turn = this.turns.find((candidate) => candidate.id === id);
    return turn ? cloneTurn(turn) : undefined;
  }

  contains(id: string): boolean {
    return this.turns.some((turn) => turn.id === id);
  }

  head(): WorkshopTurn | undefined {
    const turn = this.turns.at(-1);
    return turn ? cloneTurn(turn) : undefined;
  }

  all(): WorkshopTurn[] {
    return this.turns.map(cloneTurn);
  }

  count(): number {
    return this.turns.length;
  }

  window(limit: number): WorkshopTurn[] {
    if (!Number.isInteger(limit) || limit < 0) {
      throw new Error(`Workshop turn window must be a non-negative integer; received ${limit}`);
    }
    if (limit === 0) {
      return [];
    }
    return this.turns.slice(-limit).map(cloneTurn);
  }

  /**
   * Apply aggregate-owned semantics to a defensive candidate, then replace
   * the stored record without permitting its stable identity to change.
   */
  update(id: string, mutate: (turn: WorkshopTurn) => void): WorkshopTurn | undefined {
    const index = this.turns.findIndex((turn) => turn.id === id);
    if (index < 0) {
      return undefined;
    }
    const candidate = cloneTurn(this.turns[index]);
    mutate(candidate);
    if (candidate.id !== id) {
      throw new Error(`Cannot change Workshop turn identity ${id} to ${candidate.id}`);
    }
    this.turns[index] = cloneTurn(candidate);
    return cloneTurn(this.turns[index]);
  }

  /** Remove an aggregate-approved set of provisional turns without reusing ids. */
  removeByIds(ids: ReadonlySet<string>): WorkshopTurn[] {
    if (ids.size === 0) {
      return [];
    }
    const removed: WorkshopTurn[] = [];
    this.turns = this.turns.filter((turn) => {
      if (!ids.has(turn.id)) {
        return true;
      }
      removed.push(cloneTurn(turn));
      return false;
    });
    return removed;
  }

  exportState(): WorkshopTurnLedgerState {
    return {
      counter: this.counter,
      turns: this.turns.map(cloneTurn)
    };
  }

  /**
   * Perform every defensive copy before aggregate hydration begins replacing
   * live state. `installPreparedState` can therefore remain assignment-only.
   */
  prepareState(state: WorkshopTurnLedgerState): WorkshopTurnLedgerState {
    return {
      counter: state.counter,
      turns: state.turns.map(cloneTurn)
    };
  }

  /** Install state produced by this ledger's prepare phase; this must not throw. */
  installPreparedState(state: WorkshopTurnLedgerState): void {
    this.counter = state.counter;
    this.turns = state.turns;
  }

  /** A fresh room clears history but never reuses a turn identity counter. */
  reset(): void {
    this.turns = [];
  }
}
