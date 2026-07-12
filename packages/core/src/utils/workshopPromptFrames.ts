/** Encode reserved Workshop persona frame markers inside quoted content. */
const RESERVED_PERSONA_FRAME =
  /<\/?(?:pinned-excerpt|context-brief|writer-message|workshop-tool-evidence|workshop-host-update)(?=[\s/]|>)[^>]*>/gi;

export function neutralizeReservedPersonaPromptDelimiters(value: string): string {
  // Global escape: the frame's [^>]* filler admits nested '<' characters, so
  // one matched delimiter can carry a second reserved-tag fragment inside it
  // (PR #72 review #4). Every '<'/'>' in the match must be encoded.
  return value.replace(RESERVED_PERSONA_FRAME, (delimiter) =>
    delimiter.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  );
}
