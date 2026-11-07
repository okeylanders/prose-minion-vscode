/**
 * Which optional trailer grammars the persona prompts were last built with
 * (project memory, ADR 2026-11-04 D8; file edits, ADR 2026-11-05 D9; persona
 * reactions, ADR 2026-11-07 Q8). Each is read live from its setting; a
 * change between off and on rebuilds the prompts, as every settings change
 * does, and only then is the new state recorded.
 */

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
