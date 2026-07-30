# Conversation Widgets — Sprint 01 implemented (Gesture Playground + widget host)

**Date**: 2026-07-29
**Branch**: `claude/gesture-playground-widget-201u8p` (pushed; PR not yet opened)
**Epic**: `.todo/epics/epic-conversation-widgets-2026-07-22/`
**ADR**: `docs/adr/2026-07-22-conversation-widgets.md` — authored this session,
Accepted, with the architecture-lane (Marcus) review verdicts folded into a
"Sprint 01 concretions" section.

## What landed

1. **Design sync**: Conversation Widgets Spreads 00 (widget system) + 01
   (Gesture Playground) pulled from the Claude Design project into
   `docs/design/`, plus `pm-gravity.css` (stylesheet dep) and a `pm-widgets.js`
   re-pull. Remote now keeps one page per widget; the README's not-pulled
   inventory lists them (incl. Writer's Dictionary, added 2026-07-28, now a
   one-shot **report widget** — resolves the epic's dictionary-participant
   divergence flag).
2. **ADR decisions worth remembering**:
   - Widget commits share the `ta-N` counter + `buildWorkshopThreadArtifactFrame`
     but **never touch `pendingMessageAttachments`** — one atomic
     `WORKSHOP_COMMIT_WIDGET` route; the persisted `wc-N` config is the retry
     token. (Phase 6B doctrine: the pending list belongs to composer sends.)
   - `<thread-artifact id kind="widget:<registry id>">` — `kind` host-minted,
     builder throws on non-registry kinds; house rule comment amended in place.
     No new reserved frame name in Sprint 01.
   - Fifth `ModelScope` `'widget'` (`proseMinion.widgetModel`, default
     `anthropic/claude-sonnet-5`).
   - `WorkshopWidgetHandler` constructed **inside** `WorkshopHandler`
     (WorkshopSessionMessageHandler mold, closure-injected `sendRoomMessage`
     over `executeMessage`, which now returns `{committed, userTurnId}`).
   - `widgetCommit` turn field is rail-discriminated; configs carry
     `revision: 1`; snapshots ship lightweight configs for visible turns and
     fetch the full Draft on demand when a chip opens.
   - Standing directives (Sprint 02) get their OWN reserved frame, not the
     attachment budget; personas may propose standing state, never install it;
     LG/PC precedence is stated to the model, not silently resolved.
3. **Registry**: canonical table in `shared/constants/workshopWidgets.ts`
   (id union in `messages/workshop.ts`, mirroring workshopTools); presentation
   keeps icons + sheet mapping only. Canonical id `gesture-playground`; kind
   derived `widget:<id>`; only live ids launch/commit/recommend.
4. **Persona protocol**: `### Try a widget` single-item contract on every
   persona system message (`utils/workshopWidgetRecommendation.ts` — utils, not
   application, for the infrastructure-assembles-initial-envelope layering
   rule); fail-closed parse; typed `widgetRecommendation` on persona turns.
5. **Persistence**: `widgetConfigs` + `counters.widgetConfig` optional in the
   frozen V1 grammar (absent hydrates empty); integrity rules mirror `ta-N`
   (counter-never-trails, committedTurnId referential, self-clone rejection).
6. **Webview**: live Widgets browser (honest disabled comps),
   `WorkshopGesturePlaygroundModal` (PendingApply posture: freeze on commit,
   close only on host ok), stateless **More gestures** plus explicit
   **Regenerate all**, commit chip + recommend chip on turns
   (QuickActionBar mount pattern), `pm-ws-gesture-*` / `pm-ws-widget-*` CSS.

## Verification

`npx jest` 147 suites / 1,688 tests green (architecture witnesses included);
`npm run typecheck` green ×3; `npm run lint` 0 errors; `npm run build` +
bundle verify green. Route-count witness updated 38 → 42.

## Known follow-ups

- Editor-selection seeding of `targetPhrase` (needs a small host round-trip;
  SELECTION_DATA is paste-verification only).
- Snapshot bound for `widgetConfigs` when volumes grow (stated in ADR).
- The sprint plan's stale pointer (`workshop.ts:419-447` is the artifact type
  union, not the handler) — corrected implicitly by the ADR's seam list.
- PR into `epic/conversation-widgets` (or as directed) still to be opened.
