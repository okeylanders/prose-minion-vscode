/**
 * Which optional trailer grammars the persona prompts were last built with
 * (project memory, ADR 2026-11-04 D8; file edits, ADR 2026-11-05 D9; persona
 * reactions, ADR 2026-11-07 Q8). Each is read live from its setting; a
 * change between off and on rebuilds the prompts, as every settings change
 * does, and only then is the new state recorded.
 */

import type { SettingsStore } from '@/platform';
import {
  coerceWorkshopMemorySuggestionLevel,
  WORKSHOP_MEMORY_SUGGESTIONS_SETTING,
  type WorkshopMemorySuggestionLevel
} from '@shared/constants/workshopMemorySuggestions';

export type WorkshopPromptGrammar = 'projectMemory' | 'fileEdits' | 'personaReactions';

/** A grammar's name, as its log line says it. */
const LABELS: Readonly<Record<WorkshopPromptGrammar, string>> = {
  projectMemory: 'Project memory',
  fileEdits: 'File edits',
  personaReactions: 'Persona reactions'
};

export interface WorkshopPromptGrammarChange {
  readonly grammar: WorkshopPromptGrammar;
  readonly on: boolean;
}

export class WorkshopPromptedGrammars {
  private readonly prompted = new Map<WorkshopPromptGrammar, boolean>();

  constructor(private readonly reads: Readonly<Record<WorkshopPromptGrammar, () => boolean>>) {
    for (const grammar of Object.keys(reads) as WorkshopPromptGrammar[]) {
      this.prompted.set(grammar, reads[grammar]());
    }
  }

  /** The grammars whose setting moved since the prompts were last built. */
  changes(): WorkshopPromptGrammarChange[] {
    return [...this.prompted].flatMap(([grammar, was]) => {
      const on = this.reads[grammar]();
      return on === was ? [] : [{ grammar, on }];
    });
  }

  /** Record that the prompts were rebuilt for `changes`, one log line each. */
  commit(changes: readonly WorkshopPromptGrammarChange[], log: (line: string) => void): void {
    for (const { grammar, on } of changes) {
      this.prompted.set(grammar, on);
      log(`${LABELS[grammar]} ${on ? 'on' : 'off'}; persona prompts rebuilt`);
    }
  }
}

/** `proseMinion.workshop.memory.suggestions` as the setting holds it now: unset or unknown reads Sparingly. */
export function readWorkshopMemorySuggestionLevel(settings: Pick<SettingsStore, 'get'>): WorkshopMemorySuggestionLevel {
  return coerceWorkshopMemorySuggestionLevel(
    settings.get<unknown>(WORKSHOP_MEMORY_SUGGESTIONS_SETTING.section, WORKSHOP_MEMORY_SUGGESTIONS_SETTING.key)
  );
}

/**
 * A prompt choice that is one of several, not on or off: which level's file
 * the persona prompts were last built with (the memory-suggestion level,
 * Everyday Conveniences Round Two, item B). Read live, like a grammar.
 *
 * A change rebuilds the prompts only while the level is taught at all
 * (`taught`: project memory on). While it is not, the prompts hold no such
 * file, so the new level is recorded and nothing is rebuilt; turning memory
 * on rebuilds them with the level as it then stands.
 */
export interface WorkshopPromptLevelChange<Level extends string> {
  readonly level: Level;
  /** Whether the prompts hold the level's file now, so must be rebuilt. */
  readonly rebuild: boolean;
}

export class WorkshopPromptedLevel<Level extends string> {
  private prompted: Level;

  constructor(
    private readonly label: string,
    private readonly read: () => Level,
    private readonly taught: () => boolean
  ) {
    this.prompted = read();
  }

  /** The level, when the setting moved since the prompts were last built. */
  change(): WorkshopPromptLevelChange<Level> | undefined {
    const level = this.read();
    return level === this.prompted ? undefined : { level, rebuild: this.taught() };
  }

  /** Record the level the prompts now stand at; one log line when they were rebuilt for it. */
  commit(change: WorkshopPromptLevelChange<Level> | undefined, log: (line: string) => void): void {
    if (!change) {
      return;
    }
    this.prompted = change.level;
    if (change.rebuild) {
      log(`${this.label} ${change.level}; persona prompts rebuilt`);
    }
  }
}
