/** Encode reserved Workshop persona frame markers inside quoted content. */
// `workshop-interaction-transition` precedes `workshop-interaction` so the
// longer reserved name cannot be split by a first-alternative partial match
// (ADR 2026-07-20: behavior frames are extension-authored only).
const RESERVED_PERSONA_FRAME =
  /<\/?(?:pinned-excerpt|context-attachments?|writer-message|workshop-tool-evidence|workshop-host-update|workshop-todo-snapshot|writer-owned-task|workshop-capability-result|workshop-transcript|workshop-guest-catch-up|workshop-guest-handoff|workshop-excerpt-source|workshop-interaction-transition|workshop-expression-amplification|workshop-interaction|workshop-session-attunement|thread-artifact|agent-artifact|prose-minion-tool-call)(?=[\s/]|>)[^>]*>/gi;

export function neutralizeReservedPersonaPromptDelimiters(value: string): string {
  // Global escape: the frame's [^>]* filler admits nested '<' characters, so
  // one matched delimiter can carry a second reserved-tag fragment inside it
  // (PR #72 review #4). Every '<'/'>' in the match must be encoded.
  return value.replace(RESERVED_PERSONA_FRAME, (delimiter) =>
    delimiter.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  );
}

const AGENT_ARTIFACT_ID = /^art-\d+$/;

/**
 * Wrap one injected capability-evidence entry in its addressable artifact
 * frame (ADR 2026-07-18). The id is host-minted (`art-N`, per retained
 * conversation) and is the ONLY stable address for tombstone surgery and the
 * Phase 7 manifest — array indices shift, ids do not. Evidence arrives from
 * capability adapters that already neutralized quoted material; this wrapper
 * adds addressing, not another trust boundary.
 */
export function wrapAgentFetchedArtifactEvidence(id: string, evidence: string): string {
  if (!AGENT_ARTIFACT_ID.test(id)) {
    throw new Error(`Agent artifact ids must match art-<n>; received ${JSON.stringify(id)}`);
  }
  return [`<agent-artifact id="${id}">`, evidence, '</agent-artifact>'].join('\n');
}
