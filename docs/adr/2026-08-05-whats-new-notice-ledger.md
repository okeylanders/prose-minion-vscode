# ADR 2026-08-05: What's New Notice Ledger (Sidebar + Workshop)

**Status:** Proposed
**Date:** 2026-08-05
**Supersedes:** the version-string startup-notice mechanism from Sprint 14 §5
(`WORKSHOP_STARTUP_NOTICE_VERSION` / `dismissedVersion` in
[workshopNotices.ts](../../packages/core/src/shared/constants/workshopNotices.ts))
**Scope:** Release-notice ("What's New") modals in both webviews, their message
contract, and host-side dismissal tracking

## Context

The Workshop has a six-page startup notice
([WorkshopNoticeModal.tsx](../../packages/core/src/presentation/webview/components/workshop/WorkshopNoticeModal.tsx))
gated by a single version string. Its semantics are all-or-nothing: revise the
copy → bump `'v3'` to `'v4'` → every machine sees the whole box once more, and
"Don't show again" wipes the slate for all pages at once. That model cannot
express the actual release cadence:

- Each Marketplace release wants to **append** one or more new notices without
  re-showing everything a writer already dismissed.
- Old notices should be **deprecable** — deleted from code once they are stale,
  without disturbing anyone's read position.
- The **sidebar** webview has no notice surface at all, and it needs one with
  read-tracking independent of the Workshop's.

The version-string design also conflates "content changed" with "everything is
unread again," which was acceptable for a one-off beta tour but is wrong for an
ongoing release-notes channel.

## Decision

Replace the version string with an **append-only notice ledger** per surface,
tracked by two integers:

| Concept | Name | Where it lives | Meaning |
|---|---|---|---|
| Floor | `startingIndex` | code (shared manifest) | lowest notice index still shipped; raise it to deprecate old entries |
| Ceiling | `latestIndex` | code (shared manifest, derived from the registry) | highest notice index shipped in this build |
| Watermark | `highestDismissedIndex` | GlobalStateStore (per machine, per surface) | highest index the writer has dismissed |

The visibility rule is one pure function:

```
firstVisibleIndex = max(startingIndex, highestDismissedIndex + 1)
shouldShow        = firstVisibleIndex <= latestIndex
```

An absent watermark (fresh machine) behaves as `startingIndex - 1`: the writer
sees every currently-shipped notice, and the floor is the knob that controls
how far back that backlog reaches. If `shouldShow` is false, the modal never
mounts — there is no empty state to design.

### Two surfaces, one mechanism

`sidebar` and `workshop` are independent **surfaces**. Each has its own
registry of notices, its own floor, and its own watermark key:

- `proseMinion.whatsNew.sidebar.highestDismissedIndex`
- `proseMinion.whatsNew.workshop.highestDismissedIndex`

The mechanism (manifest, resolver, messages, handler logic, hook) is shared;
only the content registries and the presentation skins differ. Both keys live
in the shared `GlobalStateStore`, so it does not matter which webview's
`MessageHandler` instance services the request.

### Content stays in code, split by kind

Notice **copy is presentation** and remains webview-side as JSX, exactly as the
current modal does (screenshots, callouts, rich formatting all stay possible).
Only **numbers** cross the message boundary. Concretely:

1. **Shared manifest** — `packages/core/src/shared/constants/whatsNew.ts`:

   ```ts
   export type WhatsNewSurface = 'sidebar' | 'workshop';

   export interface WhatsNewManifestEntry {
     startingIndex: number;  // the floor
     latestIndex: number;    // the ceiling
     stateKey: string;       // GlobalStateStore key for the watermark
   }

   export const WHATS_NEW_MANIFEST: Record<WhatsNewSurface, WhatsNewManifestEntry>;
   ```

   The host imports this and nothing else about notices.

2. **Per-surface registry** — webview-side, e.g.
   `presentation/webview/whatsnew/workshopWhatsNewEntries.tsx` and
   `sidebarWhatsNewEntries.tsx`:

   ```ts
   export interface WhatsNewEntry {
     index: number;              // ledger position; never reused, never reordered
     title: string;
     tag?: 'beta' | 'feature' | 'fix' | 'primer';
     body: React.ReactNode;      // copy, screenshots, callouts — whatever the skin renders
     media?: readonly NoticeMedia[];   // workshop skin reuses the existing media-well types
     legend?: readonly NoticeLegendRow[];
   }

   export const WORKSHOP_WHATS_NEW_ENTRIES: readonly WhatsNewEntry[];
   ```

   **One entry = one page.** The modal's pager walks entries, not sub-pages;
   there is no nested pagination. The existing six-page Workshop tour becomes
   entries `0`–`5` unchanged.

3. **Drift guard** — an architecture test asserts, per surface, that the
   registry's indexes are exactly the contiguous integer range
   `[startingIndex … latestIndex]` from the manifest, strictly ascending, no
   gaps, no duplicates. Appending a notice without bumping `latestIndex`, or
   deleting an old one without raising `startingIndex`, fails the build. This
   is the same lockstep discipline the session codec ADR uses for
   `schemaVersion`, applied to a much smaller contract.

### Message contract

The startup-notice trio is deleted (alpha freedom — no legacy routes) and
replaced by three surface-keyed messages in `@messages/ui.ts`:

| Message | Direction | Payload |
|---|---|---|
| `REQUEST_WHATS_NEW` | webview → host | `{ surface }` |
| `WHATS_NEW_DATA` | host → webview | `{ surface, shouldShow, firstVisibleIndex, latestIndex }` |
| `DISMISS_WHATS_NEW` | webview → host | `{ surface, throughIndex }` |

Both webviews request on mount for their own surface. The host answers from
`resolveWhatsNewWindow(manifest[surface], watermark)` — the pure function
above, which lives beside the manifest so it is unit-testable without a
handler.

`DISMISS_WHATS_NEW` is the **only** write, and it expresses both dismiss
flavors:

- **Dismiss current** → `throughIndex = <index of the entry being viewed>`
- **Dismiss all** → `throughIndex = latestIndex`

The host clamps and never regresses:

```
next = min(max(existingWatermark ?? -Infinity, throughIndex), latestIndex)
```

The `max` makes writes idempotent and safe under two panels racing on the same
surface; the `min` refuses a webview claiming an index the build doesn't ship.
**Close** (X / Escape / backdrop) sends nothing — identical to today's
semantics: the box returns next launch.

### Watermark semantics are honest about implicit dismissal

Because tracking is a single high-water mark, dismissing entry *k* also marks
every entry below *k* as read. The UI must not pretend otherwise:

- Entries render **oldest → newest**, opening on `firstVisibleIndex`.
- The **Dismiss** button acts on the entry currently in view; if the writer
  paged ahead and dismisses from there, older undismissed entries go with it.
  The dot/pager row reflects this (dots at or below the session's dismissed
  watermark render in the "read" style).
- A counter shows position and volume: `2 / 4 new` — "how many are available"
  is `latestIndex − firstVisibleIndex + 1` at open time.
- After **Dismiss current**, the modal advances to the next entry, or closes
  when none remain. **Dismiss all** closes immediately.

The "Don't show again" checkbox is retired; Dismiss/Dismiss all subsume it
with finer grain.

### Webview architecture

One shared hook replaces `useStartupNotice`, parameterized by surface,
honoring the tripartite interface with an intentionally empty
`Persistence` (visibility is host-owned truth, as today):

```
useWhatsNew(surface: WhatsNewSurface):
  state:   { open, entries, currentIndex, availableCount, sessionWatermark }
  actions: { request, handleData, goTo, dismissCurrent, dismissAll, close }
  persistedState: {}
```

The hook owns transport (it is a domain hook, not a controller) and selects
its entries from the surface's registry, filtered to
`[firstVisibleIndex … latestIndex]`. Skins stay dumb:

- **Workshop** — `WorkshopNoticeModal` is reworked in place: keeps
  `WorkshopModalShell`, the wide media-well layout, callouts, and the
  configure-guide interlude; footer becomes *Dismiss* · *Dismiss all* ·
  pager · counter.
- **Sidebar** — a new compact single-column card in the sidebar's overlay
  idiom (Settings overlay is the pattern to match): title, tag chip, body,
  same footer controls. No media well unless a notice genuinely needs a
  small figure.

Routing registers `WHATS_NEW_DATA` in each app's message-route map
(`useAppMessageRouter` / `useWorkshopAppMessageRouter`).

### Host architecture

`UIHandler` keeps ownership (it already holds the startup-notice routes and
`globalState`). Its two methods generalize to take `surface` from the payload
and look everything up in `WHATS_NEW_MANIFEST`. No new services, no new
composition-root wiring — the handler's existing `GlobalStateStore` and
`MessageTransport` seams suffice.

### Migration

Alpha rules apply: the old message types, `useStartupNotice`, the
`WORKSHOP_STARTUP_NOTICE_VERSION` constant, and the `dismissedVersion` state
key are **deleted**, not shimmed. The orphaned `dismissedVersion` value is
harmless residue in GlobalState. Consequence: every machine re-sees the
Workshop tour (now entries 0–5) once — the same deliberate re-show a version
bump used to cause, and a fine moment for it, since the box gains its new
footer. The sidebar surface launches with floor `0` and whatever inaugural
notices the next release wants (an empty registry with
`latestIndex = startingIndex - 1` is legal and shows nothing).

### Release workflow (the part future-you actually touches)

- **Append:** add an entry with `index = latestIndex + 1` to the surface's
  registry; bump that surface's `latestIndex` in the manifest. The drift-guard
  test enforces the pair.
- **Deprecate:** delete entries below some index; raise `startingIndex` to the
  lowest surviving index. Same test enforces the pair. Indexes are never
  reused or renumbered.
- Screenshots follow the existing rule: named for what they show, referenced
  by entries, deleted when their last entry goes.

## Consequences

- ✅ Releases append notices without disturbing read state; deprecation is a
  two-line change guarded by a test.
- ✅ Sidebar and Workshop track independently with one mechanism and one
  contract; a third surface later is a manifest row + registry + skin.
- ✅ Dismissal is a monotonic integer with a clamp — no version-string
  comparisons, no re-show-everything cliff, idempotent under racing panels.
- ✅ Copy stays JSX in the webview; the host never sees content, only numbers.
- ⚠️ Watermark tracking cannot express "read #7 but not #6." Accepted
  deliberately (it is what keeps state one integer); the UI is designed so
  dismissal reads as "caught up through here."
- ⚠️ Registry contiguity means a notice can never be *inserted* between two
  shipped indexes. Accepted: it is a ledger, not a list.

## Test plan

- **Pure resolver:** window math over fresh-machine, mid-ledger, floor-above-
  watermark, all-read, and empty-ledger (`latest < floor`) cases.
- **Handler:** route registration; clamp behavior (no regress, no overshoot);
  per-surface key isolation.
- **Drift guard:** per-surface registry ↔ manifest contiguity (architecture
  test, fails the build).
- **Hook contract:** tripartite shape; dismissCurrent advances-or-closes;
  dismissAll sends `latestIndex`; close sends nothing.
