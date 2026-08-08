/**
 * Workshop domain messages (ADR 2026-07-03; Sprint 2 session spine, Sprint 3
 * multi-turn).
 *
 * The Workshop editor tab runs the EXISTING analysis tools (dialogue, prose,
 * and the twelve WritingToolsFocus modes) against an excerpt pinned host-side
 * in WorkshopSessionService. These contracts carry tool ids and completed
 * turns — never raw model prompts and never the API key.
 *
 * Sprint 06B adds a selected persona host and retained per-tool sidecars.
 * WORKSHOP_SEND_MESSAGE starts/continues the host unless an explicit direct
 * target is selected; provider ids remain host-private.
 *
 * The contracts are split by responsibility behind this stable barrel. Wire
 * shapes, MessageType values, and the public @messages surface are unchanged.
 */

export * from './participants';
export * from './settings';
export * from './context';
export * from './gesturePlayground';
export * from './lexicalGravity';
export * from './standingDirectives';
export * from './widgets';
export * from './recovery';
export * from './session';
