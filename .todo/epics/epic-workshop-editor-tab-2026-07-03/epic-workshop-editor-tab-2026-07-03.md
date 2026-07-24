# Epic: Assistant as a Full Editor Tab (the Workshop)

**Created**: 2026-07-06
**Status**: In Progress
**Progress**: Sprints 01–09 merged (Sprint 09 [PR #76](https://github.com/okeylanders/prose-minion-vscode/pull/76)); Sprints 11, 11B, and 12 are integrated. Relational Depth and Writer Profile are integrated. Sprint 10 seamless session persistence is implemented in [draft PR #85](https://github.com/okeylanders/prose-minion-vscode/pull/85) with automated verification and CI complete; manual Extension Host continuity verification and PR review remain. (Sprint 01 [PR #66](https://github.com/okeylanders/prose-minion-vscode/pull/66); Sprint 02 [PR #67](https://github.com/okeylanders/prose-minion-vscode/pull/67); Sprint 03 [PR #68](https://github.com/okeylanders/prose-minion-vscode/pull/68); Sprint 04 [PR #69](https://github.com/okeylanders/prose-minion-vscode/pull/69))
**Design source**: [Direction B — Split & Pinned](../../../docs/design/Prose%20Minion%20-%20Assistant%20Tab.html)
**ADRs**: [2026-07-03 — Assistant as a Full Editor Tab](../../../docs/adr/2026-07-03-assistant-editor-tab.md); [2026-07-09 — Workshop Persona Host, Tool Sidecars, and Capabilities](../../../docs/adr/2026-07-09-workshop-persona-hosted-conversations.md); [2026-07-11 — Workshop Excerpt Revision and Room Memory](../../../docs/adr/2026-07-11-workshop-excerpt-revision-and-room-memory.md); [2026-07-11 — Workshop Guest Persona Sidecars](../../../docs/adr/2026-07-11-workshop-guest-persona-sidecars.md); [2026-07-14 — Workshop Session Persistence and the Session Browser](../../../docs/adr/2026-07-14-workshop-session-persistence.md); [2026-07-16 — Workshop Retained-Context Observability](../../../docs/adr/2026-07-16-inference-context-observability.md); [2026-07-20 — Workshop Persona Interaction Modes and Expression Profiles](../../../docs/adr/2026-07-20-workshop-persona-interaction-modes-and-expression-profiles.md)
**Related active behavior features**: [Amplified Persona Expression](../../features/feature-workshop-amplified-expression/README.md); [Relational Depth](../../features/feature-workshop-relational-depth/README.md); [Writer Profile](../../features/feature-workshop-writer-profile/README.md)
**Integration branch**: `epic/workshop-editor-tab`

## Goal

Reframe the Assistant from a one-shot, 350px sidebar into a full VS Code
**editor-tab** surface — working title **Workshop** — where the working
excerpt stays pinned in a left rail while tool runs and free-text follow-ups
stream into a conversational thread on the right. The core writing loop
("analyze → variations → tighten → compare") happens in one place instead of
one button-press at a time.

The ADR's thesis: the genuinely new code is **one provider, one handler, one
service, one hook, one React root**. Everything else — the 14 tools, streaming,
cancellation, token tracking, balance, model scoping — already exists and is
reused, not reinvented.

After Sprint 04, the Workshop expands from **tool-first conversation** to
**persona-hosted conversation**. A user should be able to pin an excerpt, pick a
Writers' Room host (Jill by default; Margot, Quinn, Wren, and the other
specialists as sharper lenses), and start chatting before running a tool. Tool
runs remain isolated deterministic actions; their verbatim reports feed back
into the permanent persona host as side-pass evidence instead of replacing its
voice. A writer may temporarily talk directly to a retained tool sidecar, and
personas can later invoke bounded capabilities such as the Writer's Dictionary.

## Sequencing

The ADR proposed three sprints. We split its dense middle sprint (which bundled
messages + handler + service + multi-turn + streaming + follow-ups + seeding +
tests into one un-bisectable change) into two: **Session spine** (single turn)
and **Multi-turn** (continuation). The one genuinely novel mechanism —
driving `ConversationManager` multi-turn from a handler — is thereby isolated
in its own sprint.

Each sprint is independently shippable behind the (initially unregistered)
`prose-minion.openWorkshop` command, and lands as its own PR into
`epic/workshop-editor-tab`.

| # | Branch | Sprint | Proves |
|---|--------|--------|--------|
| 1 | `claude/sprint-01-workshop-editor-tab-u49fd5` ([PR #66](https://github.com/okeylanders/prose-minion-vscode/pull/66)) | [Shell](sprints/01-shell.md) | The second surface exists and boots. Zero AI. |
| 2 | `claude/sprint-02-session-spine-skndyo` ([PR #67](https://github.com/okeylanders/prose-minion-vscode/pull/67)) | [Session spine](sprints/02-session-spine.md) | Host-side session state + one streaming turn into the thread. |
| 3 | `feat/workshop-s3-multiturn` ([PR #68](https://github.com/okeylanders/prose-minion-vscode/pull/68)) | [Multi-turn](sprints/03-multiturn.md) | Follow-ups continue the same conversation. The "now tighten it" loop. |
| 4 | `feat/workshop-s4-actions-polish` ([PR #69](https://github.com/okeylanders/prose-minion-vscode/pull/69)) | [Actions & polish](sprints/04-actions-polish.md) | The approved prototype's feel: quick actions, cards, toasts. |
| 5 | `sprint/workshop-editor-tab-05-persona-chat` | [Persona host and browser](sprints/05-persona-chat.md) | The user can browse/select Jill or a specialist and start a retained host conversation before running a tool. |
| 6A | `sprint/workshop-editor-tab-06a-agent-run-engine` | [Agent-run engine and resource catalogs](sprints/06a-agent-run-engine.md) | Sidebar and Workshop routes share one lifecycle/capability engine while declaring deliberate resource policies. |
| 6B | `sprint/workshop-editor-tab-06b-tool-side-pass` | [Retained tool sidecars and direct mode](sprints/06b-tool-side-pass.md) | Every tool run preserves a verbatim report, feeds the host, and remains available for explicit direct follow-up. |
| 6C | `sprint/workshop-editor-tab-06c-excerpt-revision-loop` | [Excerpt revision loop and room memory](sprints/06c-excerpt-revision-loop.md) | Replacing the excerpt preserves host memory via versioned revision frames; tools stay stateless instruments. |
| 7 | `sprint/workshop-editor-tab-07-persona-capabilities` | [Persona-callable capabilities](sprints/07-persona-capabilities.md) | Personas autonomously invoke bounded Writer's Dictionary and analysis capabilities through the proven typed host boundary. |
| 8 | `sprint/workshop-editor-tab-08-actionable-tool-todos` | [Actionable tool To-do List](sprints/08-actionable-tool-todos.md) | Writers promote attributable tool findings into a durable task list the persona can see as bounded evidence. |
| 9 | `sprint/workshop-editor-tab-09-persona-guest-sidecars` | [Guest persona sidecars](sprints/09-persona-guest-sidecars.md) | Writers summon a bounded second-opinion persona seeded with a labeled transcript snapshot and cursor-based catch-up. |
| 10 | `sprint/workshop-editor-tab-10-session-persistence` | [Seamless session persistence, save, and browser](sprints/10-session-persistence.md) | The final persistence pass: sessions survive restarts as workspace JSON records; retained persona histories are remapped into live conversations, with transcript-only restore reserved for degraded recovery. |
| 11 | `sprint/workshop-editor-tab-11-persona-file-access` | [Persona file access](sprints/11-persona-file-access.md) | The host persona searches and reads allowlisted project resources through the Sprint 07 capability boundary — after the markdown-sanitization gate lands as its opening task. |
| 11B | `sprint/workshop-editor-tab-11b-context-budget-visibility` | [Context budget visibility and inference telemetry](sprints/11b-context-budget-visibility.md) | Workshop shows the current retained context separately from multi-call and cumulative processed usage; the gauge follows the active host, guest, or tool conversation. |
| 12 | `sprint/workshop-editor-tab-12-context-excerpt-intake` | [Excerpt & context intake rework + polish](sprints/12-context-excerpt-intake-polish.md) | Intent-button intake replaces "pinning"; context becomes multiple visible attachments; the live session shape and shared browser shell stabilize before persistence. |

The planned remaining-feature sequence is complete: Relational Depth → Writer
Profile → Sprint 10. Sprint 10 now serializes the completed Workshop session,
final `relationalDepth` turn shape, and restore-time personal-context boundary
without manufacturing an immediate schema migration. Manual product exercises
and integration PR review are the remaining closeout work.

Sprint 10 also establishes the additive, typed persistence seams future
Conversation Widgets need—stable turn/artifact/config ids, exact session-owned
configs and standing directives, logical conversation-history remapping, a
shared ordered autosave seam, and browser summaries decoupled from full payload
hydration—without guessing a generic widget blob.

The shared markdown-sanitization gate moves forward into Sprint 11's opening
tasks (persona file access sharpens that risk — see Known Risks). Final step
after Sprint 10 merges: open one PR `epic/workshop-editor-tab → main`.

## Architectural Invariants (hold across every sprint)

- **Nothing is `new`-ed in the provider or handler.** All services come from
  the `CoreServices` bundle built in `extension.ts`. The ADR 2026-06-18
  architecture witness (`__tests__/architecture/`) must stay green.
- **Session state lives host-side**, in `WorkshopSessionService`, never in
  React state. A webview reload/reopen restores the thread.
- **One bundle, two roots.** The panel reuses `dist/webview.js`; the entry
  point renders `<WorkshopApp/>` or `<App/>` off a `data-pm-surface` flag. No
  second build pipeline.
- **Quick actions are deterministic.** Static `toolId → labels → prompt
  templates` map in code. The LLM produces content, never button labels.
- **Personas are deterministic lenses, not runtime filesystem dependencies.**
  Their catalog and packaged prompt resources live under this repo (for
  example `packages/core/resources/system-prompts/workshop-personas/`), even if
  their source material begins in Okey's `zsh-setup` prompt-library.
- **The persona is the permanent host; tools are isolated sidecars.** System
  prompts are immutable per retained conversation. Tool reports render verbatim
  before persona synthesis, and direct-tool routing is explicit UI state.
- **Personas are not tools, but may invoke capabilities.** Persona-generated
  requests cross a closed, typed, host-validated application boundary; they do
  not call handlers, fabricate messages, or bypass existing tool/dictionary
  services.
- **Domain mirroring stays honest**: `useWorkshop` ↔ `WorkshopHandler`,
  registered in `MessageHandler` exactly like the other 11 domains (workshop
  is the 12th).

## Out of Scope for v1 (tracked, filed as `.todo` in Sprint 4)

- **Apply to draft** (write-back into the source file) — needs its own design
  for ranges/dirty buffers; routes through `FileOperationsHandler` later.
- **Branch board** (Direction C) and branching semantics on variation cards.
- ~~**Session persistence across VS Code restarts** (`WebviewPanelSerializer`)~~ —
  pulled back into scope as Sprint 10 and intentionally executed after Sprints
  11–12 ([ADR 2026-07-14](../../../docs/adr/2026-07-14-workshop-session-persistence.md)).
- **Sidebar reskin** and the **Model Browser** — separate follow-ups. A
  temporary look divergence between sidebar and Workshop is acceptable in alpha.

## Planned Persona Expansion (Sprints 05-07)

The Writers' Room personas come from Okey's existing prompt-library source
material:

- Jill: `/Users/okeylanders/Documents/GitHub/zsh-setup/prompt-library/claude-personas/CLAUDE-Jill.md`
- Specialists: `/Users/okeylanders/Documents/GitHub/zsh-setup/prompt-library/claude-skills/`
  (`agnes`, `cliff`, `dev`, `edna`, `felix`, `harper`, `margot`, `penny`,
  `quinn`, `theo`, `wren`)

Those paths are **authoring sources only**. Runtime Workshop resources must be
copied, transformed, or curated into the Prose Minion repo so the extension is
portable and packageable.

Target behavior:

- A pinned excerpt plus selected persona can start a retained conversation
  before any tool has run.
- Jill is the default general Workshop host; specialists are selected from a
  tool-browser-style persona modal with a person outline, focus icon, specialty,
  and description.
- The composer is enabled when an excerpt is pinned and a persona is selected,
  even if `selectedToolId` is still empty.
- Triggering a tool never replaces the persona system prompt. The isolated tool
  report renders verbatim, enters the host conversation as structured evidence,
  and remains retained for an explicit temporary direct-tool mode.
- Starting with a tool still uses the selected persona as host: deterministic
  progress, verbatim tool report, then persona synthesis.
- Personas may autonomously formulate Writer's Dictionary lookups/full entries
  and analysis requests. The host validates a closed capability schema, applies
  per-turn budgets, renders inspectable artifacts, and returns results to the
  persona for synthesis.
- Context starts compact: pinned excerpt, source provenance, and any existing
  context brief. Sprint 11 added on-demand allowlisted project-resource catalog,
  search, and read operations through the retained host capability boundary;
  empty catalogs remain honestly unavailable.
- Context-window pressure is measured from provider-reported usage, not inferred
  from cumulative processed traffic. Sprint 11B stores the latest committed
  context beside each independent Workshop host/guest/tool conversation before
  Sprint 12 expands context intake. One-shot sidebar tools intentionally have no
  conversation gauge.

## Known Risks

- `retainContextWhenHidden` keeps the panel process alive in the background —
  acceptable for a single panel; revisit with the serializer.
- Two React roots grow `dist/webview.js` — measure before splitting entries.
- `ConversationManager` has never been driven multi-turn by a handler. It
  *supports* continuation (`startConversation` / `addMessage` / `getMessages`),
  but token budgeting across turns, system-prompt handling on continuation, and
  conversation disposal on reset are unproven. Sized in Sprint 3.
- Multiple retained participants require explicit ownership and disposal.
  `WorkshopSessionService` must track the permanent host, latest sidecar per
  tool, optional direct target, and delivery cursor without exposing
  conversation ids to React.
- Tool side-pass integration can blur model roles if implemented as “the
  persona pretends to be the tool.” Preserve the exact report as an artifact,
  then inject it as evidence into the host.
- Autonomous capability calls can multiply cost/latency or loop. Sprint 07 must
  enforce strict schemas, call/turn budgets, cancellation, nested usage
  accounting, and visible progress from its first implementation.
- Cumulative usage and logical-turn totals double-count resent history and
  therefore cannot represent context-window pressure. Sprint 11B separates the
  Workshop conversation's retained context from turn processed traffic,
  cumulative processed usage, and provider compression disclosure.
- ~~`ConversationManager` still logs via raw `console.*`~~ — migrated to the
  injected `LogSink` in Sprint 02 (PR #67).
- **Markdown sanitization (resolved in Sprint 11, 2026-07-15)**: the shared
  renderer now sanitizes model/workspace Markdown through DOMPurify's HTML-only
  profile, removes images and executable markup, and the shared webview CSP no
  longer permits bare `https:` under `img-src`. This closes PR #67 review #13's
  injected-file-content → image-beacon exfil chain before persona file access
  ships.

## Related

- [ADR 2026-06-16 — Monorepo Ports & Adapters](../../../docs/adr/2026-06-16-monorepo-ports-and-adapters.md)
- [ADR 2026-06-18 — MessageHandler Composition-Root Consolidation](../../../docs/adr/2026-06-18-messagehandler-composition-root-consolidation.md)
- [feature-full-tab-conversation-agent](../../features/feature-full-tab-conversation-agent/README.md)
