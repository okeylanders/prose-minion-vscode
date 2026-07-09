# Epic: Assistant as a Full Editor Tab (the Workshop)

**Created**: 2026-07-06
**Status**: In Progress
**Progress**: 3/6 sprints merged; Sprint 04 complete on branch; Sprints 05-06 planned (Sprint 01 merged 2026-07-06, [PR #66](https://github.com/okeylanders/prose-minion-vscode/pull/66); Sprint 02 merged 2026-07-07, [PR #67](https://github.com/okeylanders/prose-minion-vscode/pull/67); Sprint 03 merged 2026-07-07, [PR #68](https://github.com/okeylanders/prose-minion-vscode/pull/68))
**Design source**: [Direction B — Split & Pinned](../../design/Prose%20Minion%20-%20Assistant%20Tab.html)
**ADR**: [2026-07-03 — Assistant as a Full Editor Tab](../../adr/2026-07-03-assistant-editor-tab.md)
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
runs remain deterministic actions; when triggered inside a persona chat, their
results should feed back into the active persona conversation as side-pass
material instead of replacing the persona's voice.

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
| 4 | `feat/workshop-s4-actions-polish` | [Actions & polish](sprints/04-actions-polish.md) | The approved prototype's feel: quick actions, cards, toasts. |
| 5 | `sprint/workshop-editor-tab-05-persona-chat` | [Persona-hosted chat](sprints/05-persona-chat.md) | The user can start a retained Workshop chat with Jill or a Writers' Room specialist before running a tool. |
| 6 | `sprint/workshop-editor-tab-06-tool-side-pass` | [Tool side-pass integration](sprints/06-tool-side-pass.md) | Tool runs inside a persona chat become structured side-pass material injected back into the persona conversation. |

Final step after Sprint 6 merges: one PR `epic/workshop-editor-tab → main`.

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
  example `packages/core/resources/workshop-personas/`), even if their source
  material begins in Okey's `zsh-setup` prompt-library.
- **Personas are not tools.** Tools remain structured actions mapped to the
  existing analysis contracts; persona chat owns the conversational voice and
  follow-up loop.
- **Domain mirroring stays honest**: `useWorkshop` ↔ `WorkshopHandler`,
  registered in `MessageHandler` exactly like the other 11 domains (workshop
  is the 12th).

## Out of Scope for v1 (tracked, filed as `.todo` in Sprint 4)

- **Apply to draft** (write-back into the source file) — needs its own design
  for ranges/dirty buffers; routes through `FileOperationsHandler` later.
- **Branch board** (Direction C) and branching semantics on variation cards.
- **Session persistence across VS Code restarts** (`WebviewPanelSerializer`) —
  v1 persists within the window via host-side state + `retainContextWhenHidden`.
- **Sidebar reskin** and the **Model Browser** — separate follow-ups. A
  temporary look divergence between sidebar and Workshop is acceptable in alpha.

## Planned Persona Expansion (Sprints 05-06)

The Writers' Room personas come from Okey's existing prompt-library source
material:

- Jill: `/Users/okey.landers/GitHub/zsh-setup/prompt-library/claude-personas/CLAUDE-Jill.md`
- Specialists: `/Users/okey.landers/GitHub/zsh-setup/prompt-library/claude-skills/`
  (`agnes`, `cliff`, `dev`, `edna`, `felix`, `harper`, `margot`, `penny`,
  `quinn`, `theo`, `wren`)

Those paths are **authoring sources only**. Runtime Workshop resources must be
copied, transformed, or curated into the Prose Minion repo so the extension is
portable and packageable.

Target behavior:

- A pinned excerpt plus selected persona can start a retained conversation
  before any tool has run.
- Jill is the default general Workshop host; specialist personas are selected
  from a dropdown when the writer wants a narrower craft lens.
- The composer is enabled when an excerpt is pinned and a persona is selected,
  even if `selectedToolId` is still empty.
- Triggering a tool during persona chat does not replace the persona system
  prompt. The tool result is presented to the active persona as structured
  side-pass evidence, and the persona responds in the same conversation.
- Context loading starts compact: pinned excerpt, source provenance, and a
  concise context/catalog summary. Additional files should be loaded on demand
  through existing resource-request patterns instead of eagerly stuffing the
  prompt.

## Known Risks

- `retainContextWhenHidden` keeps the panel process alive in the background —
  acceptable for a single panel; revisit with the serializer.
- Two React roots grow `dist/webview.js` — measure before splitting entries.
- `ConversationManager` has never been driven multi-turn by a handler. It
  *supports* continuation (`startConversation` / `addMessage` / `getMessages`),
  but token budgeting across turns, system-prompt handling on continuation, and
  conversation disposal on reset are unproven. Sized in Sprint 3.
- Persona-first chat introduces a second valid conversation origin: a persona
  prompt rather than a completed tool run. `WorkshopSessionService` must make
  that origin explicit so follow-up enablement does not depend on
  `selectedToolId`.
- Tool side-pass integration can accidentally blur model roles if implemented
  as "the persona pretends to be the tool." Keep tool execution deterministic
  and inject the result as evidence into the active persona conversation.
- ~~`ConversationManager` still logs via raw `console.*`~~ — migrated to the
  injected `LogSink` in Sprint 02 (PR #67).
- **Markdown sanitization (shared `MarkdownRenderer`)**: untrusted model
  output renders via `marked()` + `dangerouslySetInnerHTML` with no
  sanitizer, on BOTH surfaces, and the CSP's `img-src https:` permits the
  classic markdown-image-beacon exfil for prompt-injected responses
  (PR #67 review #13, Patricia). Inherited surface, deliberately not fixed
  inside the Workshop sprints — sanitize ONCE in the shared renderer
  (DOMPurify or disable raw-HTML passthrough) as its own follow-up before
  the epic's final merge to main.

## Related

- [ADR 2026-06-16 — Monorepo Ports & Adapters](../../adr/2026-06-16-monorepo-ports-and-adapters.md)
- [ADR 2026-06-18 — MessageHandler Composition-Root Consolidation](../../adr/2026-06-18-messagehandler-composition-root-consolidation.md)
- [feature-full-tab-conversation-agent](../../features/feature-full-tab-conversation-agent/README.md)
