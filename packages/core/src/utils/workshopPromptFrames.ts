/** Encode reserved Workshop persona frame markers inside quoted content. */
// `workshop-interaction-transition` precedes `workshop-interaction` so the
// longer reserved name cannot be split by a first-alternative partial match
// (ADR 2026-07-20: behavior frames are extension-authored only).
const RESERVED_PERSONA_FRAME =
  /<\/?(?:pinned-excerpt|context-attachments?|writer-message|workshop-tool-evidence|workshop-host-update|workshop-todo-snapshot|writer-owned-task|workshop-capability-result|workshop-transcript|workshop-room-catch-up|workshop-guest-catch-up|workshop-guest-handoff|workshop-excerpt-source|workshop-open-conversation|workshop-analysis-scope|workshop-interaction-transition|workshop-behavior-activation|workshop-interaction|workshop-writer-profile|workshop-session-attunement|workshop-time-context|workshop-widget-recommendation-contract|workshop-widget-recommendation|widget-id|target-phrase|subject-passage|writer-instructions|surrounding-context|source-references|character-notes|must-survive|must-not-change|creative-aim|sampling-distance|take-count|lens-slug|weight|reach|metaphor-pull|thread-artifact|prose-directive|agent-artifact|prose-minion-tool-call)(?=[\s/]|>)[^>]*>/gi;

export function neutralizeReservedPersonaPromptDelimiters(value: string): string {
  // Global escape: the frame's [^>]* filler admits nested '<' characters, so
  // one matched delimiter can carry a second reserved-tag fragment inside it
  // (PR #72 review #4). Every '<'/'>' in the match must be encoded.
  return value.replace(RESERVED_PERSONA_FRAME, (delimiter) =>
    delimiter.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  );
}

/**
 * The open-conversation honesty frame (Sprint 13A §11).
 *
 * An excerpt-free room is a real scope, not a blank excerpt — so the persona is
 * told plainly what it has NOT seen and what this conversation is for.
 * Extension-authored; the tag is reserved above, so
 * writer prose can neither forge nor close one.
 *
 * It lives here rather than in WorkshopPromptBuilder because the INITIAL
 * envelope is assembled in the infrastructure layer, which must not import the
 * application layer (same reason `neutralizeReservedPersonaPromptDelimiters`
 * and the writer-profile frame live under `@/utils`).
 */
export function buildWorkshopOpenConversationFrame(personaLabel: string): string {
  return [
    '<workshop-open-conversation>',
    `You are ${personaLabel}, and this is an open conversation.`,
    'No excerpt has been provided. You have not read any of the writer\'s pages in this session.',
    'Do not claim or imply that you have read a passage, do not describe or summarize prose you have not been shown, and do not invent quotations from one. If a question depends on text you do not have, say so plainly and ask for it.',
    'This conversation is for planning, ideation, craft discussion, or simply getting to know how you work. Treat it as real work, not as a holding pattern.',
    'Any context attachments below ARE available to you and were chosen by the writer; only the excerpt is missing.',
    'This room will remain excerpt-free. If the writer wants to workshop a passage, they must start a new passage session.',
    '</workshop-open-conversation>'
  ].join('\n');
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
