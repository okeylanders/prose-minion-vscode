# Epic: Assistant as a Full Editor Tab (the Workshop)

**Created**: 2026-07-06
**Status**: In Progress
**Progress**: 1/4 sprints complete (Sprint 01 merged 2026-07-06, [PR #66](https://github.com/okeylanders/prose-minion-vscode/pull/66))
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
| 2 | `feat/workshop-s2-session-spine` | [Session spine](sprints/02-session-spine.md) | Host-side session state + one streaming turn into the thread. |
| 3 | `feat/workshop-s3-multiturn` | [Multi-turn](sprints/03-multiturn.md) | Follow-ups continue the same conversation. The "now tighten it" loop. |
| 4 | `feat/workshop-s4-actions-polish` | [Actions & polish](sprints/04-actions-polish.md) | The approved prototype's feel: quick actions, cards, toasts. |

Final step after Sprint 4 merges: one PR `epic/workshop-editor-tab → main`.

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

## Known Risks

- `retainContextWhenHidden` keeps the panel process alive in the background —
  acceptable for a single panel; revisit with the serializer.
- Two React roots grow `dist/webview.js` — measure before splitting entries.
- `ConversationManager` has never been driven multi-turn by a handler. It
  *supports* continuation (`startConversation` / `addMessage` / `getMessages`),
  but token budgeting across turns, system-prompt handling on continuation, and
  conversation disposal on reset are unproven. Sized in Sprint 3.
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
