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
import {
  cloneGesturePlaygroundDraft,
  summarizeGesturePlaygroundDraft
} from '@/application/services/workshop/widgets/GesturePlaygroundConfigCodec';

export interface WorkshopWidgetConfigLedgerState {
  counter: number;
  configs: WorkshopWidgetConfigSnapshot[];
}

export class WorkshopWidgetConfigLedger {
  private configs: WorkshopWidgetConfigSnapshot[] = [];
  private counter = 0;

  constructor(private readonly now: () => number) {}

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
      draft: cloneGesturePlaygroundDraft(input.draft),
      clonedFromConfigId: input.clonedFromConfigId,
      createdAt: this.now()
    };
    this.configs.push(config);
    return cloneWidgetConfig(config);
  }

  get(id: string): WorkshopWidgetConfigSnapshot | undefined {
    const config = this.configs.find((candidate) => candidate.id === id);
    return config ? cloneWidgetConfig(config) : undefined;
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
      .map(widgetConfigSummary);
  }

  exportState(): WorkshopWidgetConfigLedgerState {
    return {
      counter: this.counter,
      configs: this.configs.map(cloneWidgetConfig)
    };
  }

  replaceState(state: WorkshopWidgetConfigLedgerState): void {
    const configs = state.configs.map(cloneWidgetConfig);
    this.configs = configs;
    this.counter = state.counter;
  }

  reset(): void {
    this.configs = [];
    this.counter = 0;
  }
}

function cloneWidgetConfig(config: WorkshopWidgetConfigSnapshot): WorkshopWidgetConfigSnapshot {
  return {
    ...config,
    draft: cloneGesturePlaygroundDraft(config.draft)
  };
}

function widgetConfigSummary(config: WorkshopWidgetConfigSnapshot): WorkshopWidgetConfigSummary {
  const { draft, ...identity } = config;
  return {
    ...identity,
    ...summarizeGesturePlaygroundDraft(draft)
  };
}
