# Sprint 05: Persona Host and Browser

**Status**: In Progress — implementation and automated verification complete; interactive F5 smoke pending
**Priority**: High
**Branch**: `sprint/workshop-editor-tab-05-persona-chat` -> PR into `epic/workshop-editor-tab`
**Estimated Effort**: 4-6 days
**Depends on**: Sprint 04 ([PR #69](https://github.com/okeylanders/prose-minion-vscode/pull/69), merged into `epic/workshop-editor-tab`)
**ADR**: [2026-07-09 — Workshop Persona Host, Tool Sidecars, and Capabilities](../../../../docs/adr/2026-07-09-workshop-persona-hosted-conversations.md)
**Readiness reviewed**: 2026-07-09 on `epic/workshop-editor-tab` (`2c9c31a`)

## Goal

Give every Workshop session a Writers' Room host. A writer pins an excerpt,
opens a persona browser, leaves Jill selected or chooses a specialist, and can
start chatting before running a tool.

Sprint 05 establishes the host/persona foundation that Sprint 06 will extend
with retained tool sidecars. Personas are conversation hosts, not tools. Their
identity and system prompt stay stable for the life of their retained
conversation.

## Current Reality

- `WORKSHOP_SEND_MESSAGE` only works after a successful tool run creates a
  retained conversation.
- `WorkshopSessionService` stores one bare conversation id and assumes it came
  from the last successful tool run.
- `WorkshopApp` has a tools browser modal but no persona browser or host model.
- `AIResourceOrchestrator.executeWithoutCapabilities` accepts
  `retainConversation` in `AIOptions` but always deletes its conversation.
- Sprint 04 is merged into the integration branch. At the readiness baseline,
  64 suites / 553 tests, all three typechecks, lint (0 errors), production
  build, resource staging, and bundle verification pass.
- Persona authoring sources exist outside this repo:
  - Jill: `/Users/okeylanders/Documents/GitHub/zsh-setup/prompt-library/claude-personas/CLAUDE-Jill.md`
  - Specialists: `/Users/okeylanders/Documents/GitHub/zsh-setup/prompt-library/claude-skills/`
- Runtime must not depend on those paths. Prompts need product-safe curation and
  must travel through the existing staged-resource pipeline.

## Locked Decisions

- Jill is the default host. A writer can choose a different host before the
  host conversation begins. New session preserves the excerpt and restores
  Jill.
- Persona selection uses a browser modal visually parallel to the tool browser,
  not a native dropdown.
- Each browser card shows a person-outline/avatar, a presentation-only focus
  icon badge, persona name, specialty, and concise description.
- Add a shared `person` glyph to the existing `Icon` set. Use this deterministic
  v1 focus mapping unless the approved visual pass produces a clearer existing
  glyph: Jill=`sparkle`, Agnes=`sparkle`, Cliff=`repeat`, Dev=`dialogue`,
  Edna=`target`, Felix=`wave`, Harper=`sprout`, Margot=`eye`, Penny=`book`,
  Quinn=`search`, Theo=`bolt`, Wren=`pen`.
- `WorkshopPersonaId` remains separate from `WorkshopToolId`.
- `WORKSHOP_SELECT_PERSONA` persists validated selection host-side.
  `WORKSHOP_SEND_MESSAGE` starts the selected host when no host conversation
  exists and continues it afterward. Do not add `WORKSHOP_START_CHAT`.
- `WORKSHOP_SET_CHAT_TARGET` carries `{ kind: 'host' } | { kind: 'tool',
  toolId }`; it is the single deterministic enter/exit direct-mode action.
- The session participant contract is implemented now for one persona host,
  latest sidecar per tool, and optional direct target. Conversation ids remain
  private to the host.
- Persona selection locks once a host run/conversation exists. Cross-persona
  handoff is not part of v1; reset is the explicit switch boundary.
- Sprint 05 preserves tool-first chat without a second temporary session model:
  a successful pre-host tool run is adopted into its sidecar slot and becomes
  the explicit direct target; composer follow-ups continue it. “Back to Jill”
  clears the target and lets the next message start/continue the host. Sprint 05
  does not yet inject the old report into Jill.
- Once a persona conversation is active, new tool runs are disabled/rejected in
  Sprint 05 so they cannot replace its prompt. Sprint 06 removes this guard and
  adds universal report -> host synthesis plus bounded direct-mode handoff.
- Runtime prompts live under
  `packages/core/resources/system-prompts/workshop-personas/` and are assembled
  from a shared base prompt plus one persona prompt through `PromptLoader`.
- Prompt curation preserves voice/craft remit and removes skill frontmatter,
  invocation/tooling directions, absolute paths, manuscript-specific canon,
  and unavailable multi-agent choreography.
- Initial context is pinned excerpt + compact provenance + writer message (+ an
  existing context brief if present). Workspace resource requests remain the
  separately tracked context-loading feature.

## Tasks

### Contracts and catalog

- [x] Add `WorkshopPersonaId` and participant snapshot types to
      `shared/types/messages/workshop.ts`; export them through `@messages`.
- [x] Add `WORKSHOP_SELECT_PERSONA` to `MessageType`, its typed payload/message,
      the webview-to-extension union, router registration, and route-count tests.
- [x] Add `WorkshopChatTarget` and `WORKSHOP_SET_CHAT_TARGET` with the exact
      host/tool discriminated payload above; validate live sidecar existence
      host-side rather than trusting the webview.
- [x] Add `packages/core/src/shared/constants/workshopPersonas.ts` with exactly
      Jill plus `agnes`, `cliff`, `dev`, `edna`, `felix`, `harper`, `margot`,
      `penny`, `quinn`, `theo`, and `wren`.
- [x] Catalog entries contain id, label, specialty, concise description, and
      relative prompt path. Export a `DEFAULT_WORKSHOP_PERSONA_ID` of `jill`, an
      `isWorkshopPersonaId` guard, and lookup helpers.
- [x] Keep React/icon types out of the shared catalog. Add `person` to the
      shared `IconName`/path set and put the focus mapping above in a
      presentation-only exhaustive map beside the Workshop components.

### Packaged prompts

- [x] Add `packages/core/resources/system-prompts/workshop-personas/base.md`
      plus one curated prompt per catalog entry.
- [x] The base prompt marks excerpt/context as quoted data, establishes the
      Workshop host role, forbids invented project facts, and does not advertise
      Sprint 07 capabilities yet.
- [x] Curate rather than mechanically copy the external sources. Remove local
      canon/tooling assumptions while preserving each persona's distinctive
      remit, boundaries, voice, and response behavior.
- [x] Extend resource/catalog tests to prove every catalog path is relative,
      unique, path-contained, staged, loadable through the real `PromptLoader`,
      non-empty, and free of YAML skill frontmatter/known absolute source paths.

### Orchestration and session

- [x] Make `AIResourceOrchestrator.executeWithoutCapabilities` pin immediately
      when retention is requested, retain only a completed non-cancelled
      user/assistant exchange, return its id, and delete on cancel/error or when
      unretained. Mirror the proven agent-capabilities lifecycle.
- [x] Add `AssistantToolService.startWorkshopPersonaConversation(...)` on the
      captured assistant-orchestrator generation. It loads base + persona
      prompts, builds the bounded initial user message, streams, and returns an
      `AnalysisResult` with the retained conversation id.
- [x] Refactor `WorkshopSessionService` from one implicit tool-owned id to the
      participant structure: host `{ personaId, conversationId? }`, latest
      sidecar per tool, and optional direct target. Never expose ids in snapshots.
- [x] Add pure session operations for selecting the host, beginning a persona
      message, atomically adopting its successful conversation, clearing a lost
      conversation, reset-to-Jill, and excerpt replacement.
- [x] Add minimal sidecar/direct-target operations needed to migrate the current
      tool-first path without a legacy second model: adopt/replace a successful
      tool conversation, select/clear the direct target, and dispose all
      conversations on reset/excerpt replacement/resource loss.
- [x] Reject invalid persona ids and selection changes while any run or host
      conversation is active.

### Handler and presentation

- [x] Route `WORKSHOP_SEND_MESSAGE` to the direct tool when a direct target is
      set; otherwise start/continue the persona host. Preserve preemption,
      cancellation, API-key warning, zombie-completion, config-loss, stream
      ordering, status, token, and disposal semantics.
- [x] Attribute persona assistant turns with persona id/label. Persona turns do
      not inherit tool quick actions or tool save-name provenance.
- [x] Add `WorkshopPersonaBrowserModal` matching the tool browser's visual
      language and accessibility contract. If the modal framing/keyboard code
      is truly identical, extract only a focused shared browser-modal shell.
- [x] Add the header trigger with person outline + focus badge + active persona
      name. The modal cards show focus badge, specialty, and description.
- [x] Enable the composer when the host snapshot is ready, a non-empty excerpt
      exists, and no run is active—even before a conversation exists. Update
      placeholder/title copy for “Message Jill” versus “Continue with Jill.”
- [x] Preserve the pre-host tool-first interaction as explicit direct mode:
      show “Talking directly to <tool>” plus “Back to Jill.” Returning does not
      inject tool history yet; that bounded handoff belongs to Sprint 06.
- [x] Disable/lock persona selection after host conversation start and restore
      the selected host correctly on webview reload.
- [x] Keep the transitional Sprint 05 tool guard honest: a crafted tool run
      cannot replace an active persona conversation, and the UI explains that
      integrated tool runs land in Sprint 06.

### Tests and documentation

- [x] Cover catalog completeness/uniqueness/default/resource loading.
- [x] Cover plain-conversation retention success, cancellation, error, discard,
      pinning, and continuation on the same captured orchestrator generation.
- [x] Cover session default/select/lock/adopt/loss/reset/excerpt lifecycle and
      defensive snapshot copying, plus sidecar/direct-target replacement and
      disposal.
- [x] Cover handler start/follow-up/cancel/preempt/zombie/config-loss/API-key/
      tool-guard/direct-tool/back-to-host behavior and exact message order.
- [x] Cover hook selection, reload, pre-conversation composer enablement,
      persona attribution, and error reconciliation.
- [x] Cover browser rendering, icon/description/name, selection, disabled state,
      keyboard dismissal/focus return to the extent supported by the existing
      modal test harness.
- [x] Update architecture/session comments and `docs/ARCHITECTURE.md` where the
      former “last tool owns the conversation” policy is described.

## Verification Notes — 2026-07-09

- `npm test -- --runInBand`: 66 suites / 538 tests passed.
- `npm run typecheck`: core, webview, and VS Code adapter passed.
- `npm run lint`: 0 errors (the repository retains pre-existing warnings).
- `npm run build`: resource staging, production webpack build, and
  `verify:bundle` passed. Produced `extension.js` at 2,272,301 bytes and
  `webview.js` at 579,100 bytes; the generated `dist/` directory is ignored.
- `git diff --check`: passed.
- Interactive F5 smoke remains pending. Launching VS Code in extension-dev
  mode was blocked by the execution environment's usage-limit approval, not by
  a build or test failure. When available, exercise Jill/specialist start,
  follow-up, cancel, reload, reset, tool-first direct follow-up, Back to Jill,
  and the guarded tool click.

## Acceptance Criteria

- A writer can pin an excerpt, leave Jill selected, type a message, and receive
  a streamed retained Jill response without running a tool first.
- Before the conversation starts, the writer can open a tool-browser-style
  persona modal and select any of the 12 deterministic persona entries.
- Each persona card visibly combines a person outline, a focus icon, specialty,
  and description; the header reflects the selected host.
- Follow-ups continue the same persona conversation and system prompt.
- Selection locks after host conversation start; New session preserves the
  excerpt, disposes the conversation, clears the thread, and restores Jill.
- Reload/reopen restores selected persona, host state, thread, and in-flight
  request identity, sidecar availability, and direct target without exposing
  conversation ids.
- Persona turns never receive stale tool quick actions or tool result naming.
- Runtime prompts are repo-owned, staged, path-contained, loadable, and contain
  no skill frontmatter, absolute authoring paths, unavailable agent/tool
  directions, or manuscript-specific canon assumptions.
- Until Sprint 06, a live persona conversation cannot be silently replaced by
  a tool run; the transitional UI/handler guard is explicit.
- A tool-first run remains directly followable, and “Back to Jill” lets the next
  message start the host without discarding the retained tool conversation.
- Lint, typecheck, focused/full tests, build, bundle verification, resource
  staging, and `git diff --check` pass. Record webview/extension bundle deltas.

## Suggested Implementation Order

1. Wire types, catalog, icon map, and curated resources with invariant tests.
2. Add plain-conversation retention to the orchestrator and persona-start seam
   to `AssistantToolService`.
3. Migrate the session aggregate to the participant shape and exhaust host,
   sidecar, target, and disposal lifecycle tests.
4. Add selection/start/continuation/direct-target/back-to-host/tool-guard paths.
5. Build the persona browser/header/composer integration and hook tests.
6. Run the full verification matrix and manual F5 smoke: Jill start, specialist
   start, follow-up, cancel, reload, reset, tool-first direct follow-up, Back to
   Jill, and guarded tool click during persona chat.

## Handoff Notes for the Implementation Agent

- Start from `epic/workshop-editor-tab` after the readiness-doc commit, not
  `main` or the old Sprint 04 branch.
- Preserve staged/user changes and keep the diff focused; do not begin Sprint
  06 sidecar orchestration or Sprint 07 capability calls here.
- Follow existing semantic aliases and `@messages` barrel imports. Core must
  remain free of `vscode`; construction stays in `extension.ts`.
- Do not place new workflow branching in `WorkshopApp`. Host policy belongs in
  `WorkshopSessionService`; AI lifecycle belongs in orchestration/service;
  `WorkshopHandler` translates messages and coordinates the use case.
- Reuse the existing tool modal's conventions, but do not force tool/persona
  cards through one abstraction if only their outer dialog shell is shared.
- If prompt curation exposes a product/canon choice not covered above, stop and
  document the exact ambiguity rather than silently preserving Okey-specific
  assumptions.
