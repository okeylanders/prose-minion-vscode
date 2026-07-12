/** Encode reserved Workshop persona frame markers inside quoted content. */
const RESERVED_PERSONA_FRAME =
  /<\/?(?:pinned-excerpt|context-brief|writer-message|workshop-tool-evidence)(?=\s|>)[^>]*>/gi;

export function neutralizeReservedPersonaPromptDelimiters(value: string): string {
  return value.replace(RESERVED_PERSONA_FRAME, (delimiter) =>
    delimiter.replace('<', '&lt;').replace('>', '&gt;')
  );
}
