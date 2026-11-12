import { WorkshopPromptedGrammars } from '@/application/services/workshop/WorkshopPromptedGrammars';

describe('WorkshopPromptedGrammars (ADR 2026-11-04 D8, 2026-11-05 D9, 2026-11-07 Q8)', () => {
  it('reports only the grammars whose setting moved, and records them once rebuilt', () => {
    const live = { projectMemory: false, fileEdits: true, personaReactions: true };
    const grammars = new WorkshopPromptedGrammars({
      projectMemory: () => live.projectMemory,
      fileEdits: () => live.fileEdits,
      personaReactions: () => live.personaReactions
    });
    expect(grammars.changes()).toEqual([]);

    live.personaReactions = false;
    const changes = grammars.changes();
    expect(changes).toEqual([{ grammar: 'personaReactions', on: false }]);
    const log: string[] = [];
    grammars.commit(changes, (line) => log.push(line));
    expect(log).toEqual(['Persona reactions off; persona prompts rebuilt']);
    expect(grammars.changes()).toEqual([]);
  });
});
