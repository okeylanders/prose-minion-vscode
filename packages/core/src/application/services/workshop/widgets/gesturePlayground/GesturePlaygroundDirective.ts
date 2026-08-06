import { WorkshopGesturePlaygroundDraft } from '@messages';

/** Build the compact room directive for one committed Gesture Playground draft. */
export function buildGestureDirective(input: Pick<
  WorkshopGesturePlaygroundDraft,
  | 'targetPhrase'
  | 'selections'
  | 'note'
  | 'dictionaryMarkdown'
  | 'includeDictionaryInCommit'
>): string {
  return [
    `Gesture directions I want for "${input.targetPhrase.trim()}":`,
    ...input.selections.map((selection) => `· ${selection}`),
    input.note.trim().length > 0 ? `note: ${input.note.trim()}` : undefined,
    ...(input.includeDictionaryInCommit
      ? [
          '',
          'Full Gesture Dictionary shared by the writer as reference:',
          input.dictionaryMarkdown.trim()
        ]
      : [])
  ].filter((line): line is string => line !== undefined).join('\n');
}
