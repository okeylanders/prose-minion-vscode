# Sprint 05: Persona-Hosted Chat

**Status**: Planned
**Priority**: High
**Branch**: `sprint/workshop-editor-tab-05-persona-chat` -> PR into `epic/workshop-editor-tab`
**Estimated Effort**: 2-4 days
**Depends on**: Sprint 04

## Goal

Let a writer start a Workshop conversation before running a tool. The flow is:
pin an excerpt, choose a Writers' Room persona, then chat. Jill is the default
Workshop host; specialists such as Margot, Quinn, Wren, Theo, and Dev provide
narrower craft lenses.

Personas are conversation hosts, not tools. They own voice, judgment, and the
retained conversation. The existing 14 tools remain deterministic actions.

## Current Reality

- Sprint 03 added `WORKSHOP_SEND_MESSAGE`, but it only works after a successful
  tool run creates a retained conversation.
- `WorkshopSessionService` treats conversation identity as "the last successful
  tool run." That is no longer enough once a persona can start the session.
- The persona source material currently lives outside this repo:
  - Jill: `/Users/okey.landers/GitHub/zsh-setup/prompt-library/claude-personas/CLAUDE-Jill.md`
  - Specialists: `/Users/okey.landers/GitHub/zsh-setup/prompt-library/claude-skills/`
- Runtime must not depend on those absolute paths. Curate/copy prompts into
  packageable resources under this repo.

## Tasks

- [ ] Add a deterministic persona catalog, likely
      `packages/core/src/shared/constants/workshopPersonas.ts`, with ids,
      labels, specialties, descriptions, and packaged prompt resource paths.
- [ ] Add packaged persona prompt resources under a repo-owned directory such
      as `packages/core/resources/workshop-personas/`.
- [ ] Include Jill plus the Writers' Room specialists:
      `agnes`, `cliff`, `dev`, `edna`, `felix`, `harper`, `margot`, `penny`,
      `quinn`, `theo`, `wren`.
- [ ] Add message contracts for selecting a persona and starting a chat, e.g.
      `WORKSHOP_SELECT_PERSONA` and `WORKSHOP_START_CHAT`, or a single
      start-chat payload carrying `personaId` and text.
- [ ] Extend `WorkshopSessionService` so a session has an explicit
      conversation origin (`persona` or `tool`) and selected persona id.
- [ ] Add an `AssistantToolService`/orchestration entry point that starts and
      retains a Workshop persona conversation from:
      - persona system prompt
      - pinned excerpt
      - source provenance
      - compact context/catalog summary
      - initial user message
- [ ] Enable the composer when an excerpt is pinned and a persona is selected,
      even when no tool conversation exists yet.
- [ ] Add a persona dropdown to the Workshop header/composer area. Default to
      Jill for new sessions.
- [ ] Persist selected persona in the host-side snapshot so reload/reopen
      restores the active host.
- [ ] Update status, stream, cancel, reset, and conversation-disposal paths for
      persona-origin conversations.
- [ ] Add tests for persona catalog invariants, session origin transitions,
      start-chat handler behavior, reload snapshot behavior, and composer
      enablement.

## Acceptance Criteria

- A writer can pin an excerpt, leave the default persona as Jill, type a
  message, and receive a streamed retained conversation response.
- A writer can switch to a specialist persona before starting the chat.
- Follow-up messages continue the persona conversation without requiring a
  prior tool run.
- Running reset clears the conversation while preserving the pinned excerpt
  according to the current Workshop reset semantics.
- Runtime persona prompts are loaded from this repo, not from Okey's absolute
  `zsh-setup` paths.
- Typecheck, focused Workshop tests, and bundle verification pass.

## Notes / Guardrails

- Do not model personas as `WorkshopToolId`. Keep `WorkshopPersonaId` separate.
- Do not let the model generate persona dropdown labels.
- Keep initial context compact. Do not eagerly pack a whole project or long
  source stack into the first prompt.
- If a persona asks for more context, route that through existing resource
  request patterns rather than inventing a new file-loading loop.
- Tool side-pass behavior is Sprint 06. This sprint may leave tool runs with
  existing replacement semantics if needed, as long as the UI is honest.
