/**
 * Session-owned Conversation Widget authoring-state ledger.
 *
 * WorkshopSessionService remains the aggregate root and delegates config
 * lifecycle mechanics here. The ledger never owns turns, thread-artifact ids,
 * delivery, persistence I/O, or cross-record integrity.
 */

import {
  WorkshopGestureDraft,
  WorkshopWidgetConfigSnapshot,
  WorkshopWidgetConfigSummary,
  WorkshopWidgetId
} from '@messages';

export interface WorkshopWidgetConfigLedgerState {
  counter: number;
  configs: WorkshopWidgetConfigSnapshot[];
}

/** Widget-specific draft behavior injected by the session composition boundary. */
export interface WorkshopWidgetDraftOperations {
  cloneDraft(widgetId: WorkshopWidgetId, draft: WorkshopGestureDraft): WorkshopGestureDraft;
  summarizeDraft(
    widgetId: WorkshopWidgetId,
    draft: WorkshopGestureDraft
  ): Pick<WorkshopWidgetConfigSummary, 'targetPhrase' | 'selectionCount'>;
}

export class WorkshopWidgetConfigLedger {
  private configs: WorkshopWidgetConfigSnapshot[] = [];
  private counter = 0;

  constructor(
    private readonly now: () => number,
    private readonly draftOperations: WorkshopWidgetDraftOperations
  ) {}

  create(input: {
    widgetId: WorkshopWidgetId;
    draft: WorkshopGestureDraft;
    clonedFromConfigId?: string;
  }): WorkshopWidgetConfigSnapshot {
    this.counter += 1;
    const config: WorkshopWidgetConfigSnapshot = {
      id: `wc-${this.counter}`,
      widgetId: input.widgetId,
      revision: 1,
      draft: this.draftOperations.cloneDraft(input.widgetId, input.draft),
      clonedFromConfigId: input.clonedFromConfigId,
      createdAt: this.now()
    };
    this.configs.push(config);
    return this.cloneWidgetConfig(config);
  }

  get(id: string): WorkshopWidgetConfigSnapshot | undefined {
    const config = this.configs.find((candidate) => candidate.id === id);
    return config ? this.cloneWidgetConfig(config) : undefined;
  }

  recordCommit(configId: string, linkage: { turnId: string; artifactId: string }): void {
    const config = this.configs.find((candidate) => candidate.id === configId);
    if (!config) {
      throw new Error(`Unknown widget config ${configId}`);
    }
    config.committedTurnId = linkage.turnId;
    config.artifactId = linkage.artifactId;
  }

  summariesFor(configIds: ReadonlySet<string>): WorkshopWidgetConfigSummary[] {
    return this.configs
      .filter((config) => configIds.has(config.id))
      .map((config) => this.widgetConfigSummary(config));
  }

  exportState(): WorkshopWidgetConfigLedgerState {
    return {
      counter: this.counter,
      configs: this.configs.map((config) => this.cloneWidgetConfig(config))
    };
  }

  /**
   * Perform every potentially throwing clone before aggregate hydration starts
   * mutating live session fields.
   */
  prepareState(state: WorkshopWidgetConfigLedgerState): WorkshopWidgetConfigLedgerState {
    return {
      counter: state.counter,
      configs: state.configs.map((config) => this.cloneWidgetConfig(config))
    };
  }

  /** Install only a state returned by `prepareState`; this phase must not throw. */
  installPreparedState(state: WorkshopWidgetConfigLedgerState): void {
    this.configs = state.configs;
    this.counter = state.counter;
  }

  reset(): void {
    this.configs = [];
    this.counter = 0;
  }

  private cloneWidgetConfig(
    config: WorkshopWidgetConfigSnapshot
  ): WorkshopWidgetConfigSnapshot {
    return {
      ...config,
      draft: this.draftOperations.cloneDraft(config.widgetId, config.draft)
    };
  }

  private widgetConfigSummary(
    config: WorkshopWidgetConfigSnapshot
  ): WorkshopWidgetConfigSummary {
    const { draft, ...identity } = config;
    return {
      ...identity,
      ...this.draftOperations.summarizeDraft(config.widgetId, draft)
    };
  }
}
