/**
 * Session-owned Conversation Widget authoring-state ledger.
 *
 * WorkshopSessionService remains the aggregate root and delegates config
 * lifecycle mechanics here. The ledger never owns turns, thread-artifact ids,
 * delivery, persistence I/O, or cross-record integrity.
 */

import {
  WorkshopCreativeVariationsDraft,
  WorkshopGesturePlaygroundDraft,
  WorkshopLexicalGravityDraft,
  WorkshopWidgetConfigSnapshot,
  WorkshopWidgetConfigSummary
} from '@messages';

export interface WorkshopWidgetConfigLedgerState {
  counter: number;
  configs: WorkshopWidgetConfigSnapshot[];
}

export type WorkshopWidgetConfigInput =
  | { widgetId: 'gesture-playground'; draft: WorkshopGesturePlaygroundDraft }
  | { widgetId: 'lexical-gravity'; draft: WorkshopLexicalGravityDraft }
  | { widgetId: 'creative-variations'; draft: WorkshopCreativeVariationsDraft };

export interface WorkshopWidgetConfigIdentity {
  id: string;
  revision: number;
  clonedFromConfigId?: string;
  createdAt: number;
}

/** Widget-specific behavior injected by the session composition boundary. */
export interface WorkshopWidgetConfigOperations {
  createSnapshot(
    identity: WorkshopWidgetConfigIdentity,
    input: WorkshopWidgetConfigInput
  ): WorkshopWidgetConfigSnapshot;
  reviseSnapshot(
    current: WorkshopWidgetConfigSnapshot,
    input: WorkshopWidgetConfigInput
  ): WorkshopWidgetConfigSnapshot;
  cloneSnapshot(config: WorkshopWidgetConfigSnapshot): WorkshopWidgetConfigSnapshot;
  summarizeSnapshot(config: WorkshopWidgetConfigSnapshot): WorkshopWidgetConfigSummary;
}

export interface PreparedWorkshopWidgetConfigRevision {
  kind: 'revision';
  index: number;
  config: WorkshopWidgetConfigSnapshot;
}

export interface PreparedWorkshopWidgetConfigCreation {
  kind: 'creation';
  counter: number;
  config: WorkshopWidgetConfigSnapshot;
}

export type PreparedWorkshopWidgetConfigMutation =
  | PreparedWorkshopWidgetConfigCreation
  | PreparedWorkshopWidgetConfigRevision;

export class WorkshopWidgetConfigLedger {
  private configs: WorkshopWidgetConfigSnapshot[] = [];
  private counter = 0;

  constructor(
    private readonly now: () => number,
    private readonly operations: WorkshopWidgetConfigOperations
  ) {}

  create(
    input: WorkshopWidgetConfigInput & { clonedFromConfigId?: string }
  ): WorkshopWidgetConfigSnapshot {
    return this.installPreparedCreation(this.prepareCreation(input));
  }

  prepareCreation(
    input: WorkshopWidgetConfigInput & { clonedFromConfigId?: string }
  ): PreparedWorkshopWidgetConfigCreation {
    const counter = this.counter + 1;
    const config = this.operations.createSnapshot({
      id: `wc-${counter}`,
      revision: 1,
      clonedFromConfigId: input.clonedFromConfigId,
      createdAt: this.now()
    }, input);
    return { kind: 'creation', counter, config };
  }

  installPreparedCreation(
    prepared: PreparedWorkshopWidgetConfigCreation
  ): WorkshopWidgetConfigSnapshot {
    if (
      prepared.counter !== this.counter + 1
      || this.configs.some((candidate) => candidate.id === prepared.config.id)
    ) {
      throw new Error(`Stale widget config creation ${prepared.config.id}`);
    }
    this.counter = prepared.counter;
    this.configs.push(prepared.config);
    return this.operations.cloneSnapshot(prepared.config);
  }

  get(id: string): WorkshopWidgetConfigSnapshot | undefined {
    const config = this.configs.find((candidate) => candidate.id === id);
    return config ? this.operations.cloneSnapshot(config) : undefined;
  }

  prepareRevision(
    configId: string,
    input: WorkshopWidgetConfigInput
  ): PreparedWorkshopWidgetConfigRevision {
    const index = this.configs.findIndex((candidate) => candidate.id === configId);
    if (index < 0) {throw new Error(`Unknown widget config ${configId}`);}
    const current = this.configs[index];
    if (current.widgetId !== input.widgetId) {
      throw new Error(`Widget config ${configId} belongs to ${current.widgetId}`);
    }
    return {
      kind: 'revision',
      index,
      config: this.operations.reviseSnapshot(current, input)
    };
  }

  installPreparedRevision(prepared: PreparedWorkshopWidgetConfigRevision): WorkshopWidgetConfigSnapshot {
    this.configs[prepared.index] = prepared.config;
    return this.operations.cloneSnapshot(prepared.config);
  }

  installPreparedMutation(
    prepared: PreparedWorkshopWidgetConfigMutation
  ): WorkshopWidgetConfigSnapshot {
    return prepared.kind === 'creation'
      ? this.installPreparedCreation(prepared)
      : this.installPreparedRevision(prepared);
  }

  recordCommit(
    configId: string,
    linkage:
      | { turnId: string; artifactId: string; directiveId?: undefined }
      | { turnId: string; directiveId: string; artifactId?: undefined }
  ): void {
    const config = this.configs.find((candidate) => candidate.id === configId);
    if (!config) {
      throw new Error(`Unknown widget config ${configId}`);
    }
    config.committedTurnId = linkage.turnId;
    config.artifactId = linkage.artifactId;
    config.directiveId = linkage.directiveId;
  }

  summariesFor(configIds: ReadonlySet<string>): WorkshopWidgetConfigSummary[] {
    return this.configs
      .filter((config) => configIds.has(config.id))
      .map((config) => this.operations.summarizeSnapshot(config));
  }

  exportState(): WorkshopWidgetConfigLedgerState {
    return {
      counter: this.counter,
      configs: this.configs.map((config) => this.operations.cloneSnapshot(config))
    };
  }

  /**
   * Perform every potentially throwing clone before aggregate hydration starts
   * mutating live session fields.
   */
  prepareState(state: WorkshopWidgetConfigLedgerState): WorkshopWidgetConfigLedgerState {
    return {
      counter: state.counter,
      configs: state.configs.map((config) => this.operations.cloneSnapshot(config))
    };
  }

  /** Install state produced by this ledger's prepare phase; this must not throw. */
  installPreparedState(state: WorkshopWidgetConfigLedgerState): void {
    this.configs = state.configs;
    this.counter = state.counter;
  }

  reset(): void {
    this.configs = [];
    this.counter = 0;
  }
}
