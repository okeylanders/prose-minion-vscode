# MR Review — Sprint 14: Design catch-up & release candidate

**Author:** Okey Landers · PR [#92](https://github.com/okeylanders/prose-minion-vscode/pull/92) · `sprint/workshop-editor-tab-14-design-catchup-release-candidate` → `epic/workshop-editor-tab`

---

## Resolution ledger

Status is the reviewer's **initial recommendation**, not a verdict — update the `Status` column as
findings are addressed so this file stays a living record. Legend: **Open** = act before merge ·
**Deferred** = real issue, safe to punt for a stated reason (track it) · **Addressed** = fixed ·
**Partially addressed** = fixed with a noted remainder · **N/A** = out of scope or superseded.

| # | Sev | Finding | Reviewers | Consensus | Status |
|---|-----|---------|-----------|-----------|--------|
| 1 | 🟠 High | Inline `onClose` arrow re-runs the modal shell's focus effect on every render | Blake | — | **Addressed** |
| 2 | 🟠 High | `useStartupNotice` has no test — the dismissal guard is undriven | Cal | — | **Addressed** |
| 3 | 🟡 Standard | Host persists the webview-claimed version instead of its own constant | Blake, Patricia | 🎯 | **Addressed** |
| 4 | 🟡 Standard | `RequestStartupNoticePayload` re-spells the documented zero-payload idiom | Parker, Stan | 🎯 | **Addressed** |
| 5 | 🟡 Standard | "The six the rail keeps at hand" copy change rests on a miscount | Bria | — | **Addressed** |
| 6 | 🟡 Standard | `handleStartupNoticeRequest` logs nothing; failure log omits the version | Oliver | — | **Addressed** |
| 7 | 🟡 Standard | `variant="sheet"` already exists — sheet geometry hand-rolled in CSS instead | Stan | — | **Addressed** |
| 8 | 🟡 Standard | Shared sheet browser didn't absorb the reset-on-open duplication | Parker | — | **Deferred** — real, but a prop-shape decision better made when a third consumer lands |
| 9 | 🟡 Standard | Same affordance ships as `kicker` and `eyebrow` in one PR | Parker | — | **Addressed** |
| 10 | 🟡 Standard | Card highlight and footer summary diverge on cross-group id collisions | Sam | — | **Deferred** — dormant; both registries are unique today, revisit when Widgets goes live |
| 11 | 🟡 Standard | `globalState.update` failure path unreachable by the test double | Cal | — | **Addressed** |
| 12 | 🟡 Standard | "Plain close records nothing" asserted at the wrong seam (`onClose` never fired) | Cal | — | **Addressed** |
| 13 | 🟡 Standard | Sheet browser's public data contract lives inside the component file | Marcus | — | **Deferred** — no third consumer yet; split when one appears |
| 14 | 🟢 Nit | Notice dot pager keys on page title rather than a stable id | Sam | — | **Addressed** |
| 15 | 🟢 Nit | `GlobalStateStore` omits the `(ADR 2026-06-16)` citation both sibling ports carry | Stan | — | **Addressed** |
| 16 | 🟢 Nit | `findItem` unmemoized over 12–14 items | Tim | — | **N/A** — measured and explicitly not worth acting on |
| 17 | 🟢 Praise | `GlobalStateStore` follows the `SecretStore` precedent honestly | Marcus | — | **N/A** |
| 18 | 🟢 Praise | Composer draft state kept local — no per-keystroke tree re-render | Tim | — | **N/A** |
| 19 | 🟡 Standard | Direct instrument follow-ups have no durable audience/persona-boundary indicator | Okey, Ada | — | **Addressed** |

### Resolution pass — 2026-07-26

- Stabilized the startup notice's plain-close callback so the modal shell's focus
  effect remains mounted across unrelated Workshop renders.
- Added direct hook coverage for the show/hide result, plain close, opted-in
  dismissal, host-version echo, and the pre-version guard. The notice modal now
  also proves that its X affordance calls `onClose` without calling `onDismiss`.
- Made the host authoritative for the startup-notice version: an unexpected
  webview claim is rejected, and a valid request persists the imported host
  constant. Notice checks and persistence failures now log the current version;
  a failed write also returns a typed `ui.startup_notice` error to the webview.
- Made the global-state fake failure-injectable and exercised the rejected-write
  path.
- Restored the house `Record<string, never>` zero-payload idiom, the literal
  six-tool rail copy, the existing `variant="sheet"` geometry, the shared
  `eyebrow` vocabulary, stable numeric notice-dot identity, and the platform
  ADR citation.
- Added an always-visible audience note while an instrument is targeted and
  audience labels on both sides of every stored direct-tool exchange. The copy
  states both directions of isolation, distinguishes private follow-ups from
  the Room-visible original report, and states that persona voice, Writer
  Profile, and Conversation Controller settings do not apply to instruments.
- Verification: 1,472 Jest tests / 137 suites / 1 snapshot passed; all core,
  webview, and extension typechecks passed; lint completed with zero errors and
  the repository's existing warnings; production build and bundle sentinel
  passed; `git diff --check` passed.

---

## Blast Radius

- 44 files changed · +2,480 / −119 lines
- New files: 9 · Migrations: no · New platform ports: 1 (`GlobalStateStore`)
- ~1,120 of the diff is `docs/design/**` — a re-pulled HTML/CSS/JS design comp, reviewed as *spec*, not as shipped code
- New message types: 3 (`REQUEST_STARTUP_NOTICE` / `STARTUP_NOTICE_DATA` / `DISMISS_STARTUP_NOTICE`)
- `workshop.css` grew +500 lines; `apps/vscode-extension` touched by exactly 2 lines (composition root + package.json enum)

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | A− |
| 🛡️ Security | B |
| 🧪 Tests | C |
| 📖 Quality | B− |
| ⚡ Performance | A |
| 🎯 Domain | B |

---

## Executive Briefing

🟠 **[Blake]** **Unstable `onClose` steals focus from the notice modal** — `WorkshopApp.tsx:1387` passes a fresh inline arrow; `WorkshopModalShell`'s a11y effect is keyed `[onClose, open]`, so it tears down and re-focuses the Close button on *every* parent render. This is the one modal that opens automatically, during the noisiest moment of boot.

🟠 **[Cal]** **The hook that implements the whole feature has no test** — `useStartupNotice.ts` is undriven by any test. Its single `&&` guard is what makes "plain close records nothing" true. Invert it and all 1,462 tests stay green.

🟡🎯 **[Blake + Patricia]** **The host persists the version the webview claims**, not its own imported constant — validation is `typeof === 'string'`, notably weaker than the path-containment checks its three sibling handlers apply to webview input.

🟡🎯 **[Parker + Stan]** **A documented convention got re-drifted** — `workshop.ts:1192` spells out the zero-payload `Record<string, never>` idiom in plain English, citing 9 siblings and the prior review that established it.

🟡 **[Bria]** **The deliberate copy divergence rests on a miscount** — "the six the rail keeps at hand" referred to `RAIL_TOOL_IDS` (six tools since PR #66), not the modal's three-card Primary group. The comp was right.

---

## 🏛️ Marcus · Architecture & Design

"The Cartographer of Layer Boundaries"

### 🟢 Praise — GlobalStateStore is the real thing, not a knockoff

`packages/core/src/platform/GlobalStateStore.ts`

This is what "follows the `SecretStore` precedent" should mean, and it actually does. The interface shape matches `vscode.Memento` exactly (`get<T>(key)`, `get<T>(key, default)`, `update`), the doc comment gives an honest reason it isn't `SettingsStore` (not user config, must not ride Settings Sync), core stays vscode-free, and `extension.ts` wires the native object in with one line at the single composition root — no adapter class invented for ceremony's sake. `MessageHandler.ts` threads only `this.platform.globalState` into `UIHandler`, not the whole `Platform` bundle, which respects the "leaf consumers depend on specific ports" rule stated in `Platform.ts`'s own header.

### 🟡 Standard — WorkshopSheetBrowser's data types live inside a component file

`packages/core/src/presentation/webview/components/workshop/workshopWidgets.ts:6`

`WorkshopSheetGroup`/`WorkshopSheetItem`/`WorkshopSheetTag` are the public data contract two independent modals build against, but they're defined inside `WorkshopSheetBrowser.tsx` rather than a types-only module. Harmless today — TS type-only imports erase at compile time, and `workshopWidgets.ts` is presentation-layer data with no vscode-boundary risk. But as a load-bearing wall: if a third consumer ever wants these shapes without pulling in the component's React import graph (a future non-webview preview list, a test fixture builder), the coupling is there. Worth a `WorkshopSheetTypes.ts` split if a third consumer shows up — not now.

> *"The bones are good, and for once someone actually read the load-bearing wall before hanging a new port off it — GlobalStateStore earns its keep; the sheet browser earns its reuse; I went looking for a boundary violation and mostly found receipts."* — Marcus

---

## 🔥 Blake · Critical / Blocking Issues

"She's Been Paged for This Before"

### 🟠 High — Inline `onClose` arrow makes the notice modal steal focus on every render

`packages/core/src/presentation/webview/WorkshopApp.tsx:1387`

```tsx
onClose={() => startupNotice.dismissStartupNotice(false)}
```

`WorkshopModalShell`'s a11y effect is keyed `[onClose, open]` (`WorkshopModalShell.tsx:56`). Every other modal in this file passes a `useCallback`-stable handler (`closeToolsModal`, `closeWidgetsModal`, `closeBehaviorModal`). The notice passes a fresh arrow each render, so the effect tears down and re-runs on **every** `WorkshopApp` re-render — cleanup fires `returnFocusRef.current?.focus()`, then the body fires `closeButtonRef.current?.focus()`.

Traced path: `WorkshopApp` mounts and fans out `REQUEST_MODEL_DATA`, `REQUEST_API_KEY`, `WORKSHOP_REQUEST_SESSION`, sessions (220ms debounce), account balance. `STARTUP_NOTICE_DATA` lands, the tour opens, and each of those five-plus responses re-renders `WorkshopApp` and yanks focus back onto the X button. A keyboard user who has tabbed to the "Don't show again" checkbox gets focus moved to Close mid-read; pressing Space/Enter now closes the box instead of toggling the checkbox — the dismissal is never recorded and the tour returns next launch, which is precisely the contract this feature exists to honor. It also re-arms the Escape/backdrop listeners on every render.

Fix:

```tsx
const closeStartupNotice = React.useCallback(
  () => startupNotice.dismissStartupNotice(false),
  [startupNotice.dismissStartupNotice]
);
```

`dismissStartupNotice` is already stable (`useCallback` on `[vscode]`; `useVSCodeApi` is a `useMemo` singleton). Tests do not cover this: `WorkshopNoticeModal.test.tsx` builds `props` once and renders a single time, so the modal is never re-rendered with a new `onClose` identity and the effect never re-runs.

### 🟡 Standard — Dismissal records the version the webview claims, not the host's own constant [🎯 Consensus]

`packages/core/src/application/handlers/domain/UIHandler.ts:92`

```ts
await this.globalState.update(WORKSHOP_STARTUP_NOTICE_DISMISSED_KEY, version);
```

The host already imports `WORKSHOP_STARTUP_NOTICE_VERSION` and compares against it in `handleStartupNoticeRequest`. On dismissal it writes back whatever string the webview sent instead. Today the two are the same constant in the same bundle so the round-trip closes, but the write path accepts any non-empty string across a trust boundary — a stale or wrong echo persists a value that can never equal the current version, and the box then re-shows forever with no way for the user to stop it and no log line saying why. Write `WORKSHOP_STARTUP_NOTICE_VERSION` and keep the payload's version as a validation check only. The host should be the authority on its own version; the existing tests assert the round-trip but not divergence.

> *"The one modal that opens itself, unattended, at the noisiest moment of boot is the one you handed an unstable callback — I'll see you in the accessibility bug queue."* — Blake

---

## 🔍 Sam · Bug Hunter

"What if the list is empty, though?"

### 🟡 Standard — Card highlighting and footer summary disagree on cross-group id collisions

`packages/core/src/presentation/webview/components/workshop/WorkshopSheetBrowser.tsx:64-68, 111`

The per-card highlight (`isSelected`, line 111) is computed independently inside each group's render loop by comparing `selectedId` to that card's own `item.id` — so if two groups ever contain items sharing an `id`, *both* cards light up as selected. Meanwhile the footer summary (line 91, `findItem`) resolves the same `selectedId` via `flatMap().find()`, which always returns the *first* match across all groups — so the footer shows one item's name/tag/costNote while two cards visually claim selection.

Today this is dormant: `WORKSHOP_TOOL_CATALOG` (14 ids) and `WORKSHOP_WIDGET_GROUPS` (12 ids) are both globally unique, confirmed by grep. But nothing enforces uniqueness at the type or runtime level, and the PR's own docs say the Widgets registry is the exact surface the next epic will keep extending. A future widget added with a copy-pasted `id` produces a silent UI split rather than a crash. Either scope `id` uniqueness per-consumer in a comment, or have `findItem` and the highlight check share one lookup so they can't drift.

### 🟢 Nit — Dot pager keys on page title (content), not identity

`packages/core/src/presentation/webview/components/workshop/WorkshopNoticeModal.tsx:156`

All six `PAGES` titles are currently distinct, so reconciliation is fine today. But the key is derived from copy, not from a stable identifier, so a future edit that reuses a title across two pages (easy when copy-editing six paragraphs of onboarding prose) would collapse two dots to one React key — duplicate-key warning at best, misattributed `aria-current`/`dot-on` styling at worst. `key={dotIndex}` or a numeric `id` on `NoticePage` makes this immune to copy changes rather than coincidentally safe.

> *"Nothing's broken yet — but 'the ids happen to be unique' is exactly the kind of promise nobody writes a test for, and it's precisely the promise the next epic is about to lean on."* — Sam

---

## 📖 Parker · Code Quality

"Code is Communication, Not Instruction"

### 🟡 Standard — `RequestStartupNoticePayload` breaks the house zero-payload idiom it sits three files away from [🎯 Consensus]

`packages/core/src/shared/types/messages/ui.ts:171-173`

`workshop.ts:1191-1194` spells out the convention in so many words: *"Zero-payload messages use the house `Record<string, never>` idiom directly (9 prior siblings; PR #67 review #9) — unlike an empty interface, it actually rejects smuggled fields."* Nine siblings across `publishing.ts`, `configuration.ts`, `sources.ts`, `warnings.ts`, and `workshop.ts` all write `extends MessageEnvelope<Record<string, never>>` inline — no named interface at all. This PR mints a new named `RequestStartupNoticePayload` with a raw index-signature body. Structurally equivalent, so nothing breaks — but it's a second spelling of a pattern the codebase already named and documented, sitting in the same barrel a `@messages` import away. The next reader has to work out whether it means something `Record<string, never>` doesn't.

### 🟡 Standard — Same UI affordance, two names, same PR — `kicker` vs. `eyebrow`

`packages/core/src/presentation/webview/components/workshop/WorkshopSheetBrowser.tsx:44,97`

The small-caps label above the modal title has been called "eyebrow" everywhere in this codebase — `pm-ws-eyebrow`, used by the very `WorkshopToolsModal` markup this PR deletes, and by the brand-new `WorkshopNoticeModal` shipped in this same diff. `WorkshopSheetBrowser` renames the identical concept `kicker` / `pm-ws-sb-kick`. Both names ship in the same PR, for the same visual element, in sibling files a reader will open back to back. Pick one — `eyebrow` already has two call sites' worth of institutional memory — or leave a one-line comment saying why the sheet browser needed its own term.

### 🟡 Standard — The shared browser didn't absorb the reset-on-open duplication it was built to prevent

`packages/core/src/presentation/webview/components/workshop/WorkshopWidgetsModal.tsx:19-26`

`WorkshopToolsModal.tsx:75-83` carries the near-identical shape: local `selectedId` state plus a `useEffect` reseeding it whenever `open` flips true, each with its own hand-written comment justifying the same lifecycle rule. `WorkshopSheetBrowser` is billed in its own header as "the shared select-then-launch sheet," but it only takes `selectedId`/`onSelect` as controlled props — it never owns the "reset when I open" behavior that both of its only two consumers need identically. That's duplicated *knowledge*, not just text. A `resetSelectionOnOpen` prop, or keying the browser on `open` internally, would let both modals drop their local effect.

> *"It works, but I read `kicker`, `eyebrow`, and `RequestStartupNoticePayload` three times each before I trusted they weren't secretly different things — that's a tax on everyone who reads this forever."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

"Confidence Levels, Not Coverage Numbers"

### 🟠 High — The hook that actually implements the dismissal contract has zero tests

`packages/core/src/presentation/webview/hooks/domain/useStartupNotice.ts:57-70`

There is no `useStartupNotice.test.ts` anywhere in the tree (confirmed — no match). This is the load-bearing piece of the whole feature: it decides whether `DISMISS_STARTUP_NOTICE` gets posted at all, and with which version. But look at how the two adjacent test files cover it — `WorkshopNoticeModal.test.tsx` asserts a jest mock was called with `true`/`false`; it never calls the real hook. `UIHandler.test.ts` hand-constructs a `DISMISS_STARTUP_NOTICE` envelope directly; it never goes through `dismissStartupNotice`.

So the actual guard — `dontShowAgain && noticeVersionRef.current !== null`, the exact mechanism implementing "plain close records nothing" and "don't-show-again echoes the right version" — is asserted by neither test. Flip that `&&` to `||`, or forget the null check, or transpose the payload fields, and the full suite (1,462 tests, 13 new) stays green. It's the one function in this feature doing real logic, and it's the one function nobody drives.

### 🟡 Standard — `globalState.update` failure path is unreachable by construction of the test double

`packages/core/src/__tests__/mocks/platform.ts:46-55`

`UIHandler.handleStartupNoticeDismiss` wraps the write in try/catch specifically because a rejected write shouldn't crash the router — *"worst case the notice shows again next launch — log, never throw."* That's a real, documented contract. But `createFakeGlobalState`'s `update` unconditionally succeeds, and unlike every sibling fake in the same file — `createFakeFileSystem(overrides, files)`, `createFakeWorkspace(overrides)`, `createFakeShellService(overrides)`, `createFakeEditorContext(overrides)` — it takes no `overrides` param, so there's no way to make it reject without hand-building a `GlobalStateStore` inline. `UIHandler.test.ts` never does, so the catch branch has never executed under test.

### 🟡 Standard — "Plain close never records" is asserted at the wrong seam

`packages/core/src/__tests__/presentation/webview/components/workshop/WorkshopNoticeModal.test.tsx:37-41`

`WorkshopNoticeModal` takes two genuinely distinct callbacks — `onClose` (X/Escape/backdrop: "never records anything") and `onDismiss` (checkbox-gated). The suite exercises `onDismiss` in both checkbox states but never fires `onClose` at all — no click on the shell's CloseButton, no Escape, nothing asserting `onDismiss` was *not* called that way. Per Rule B I won't blame this file for re-testing Escape/backdrop plumbing `WorkshopModalShell` owns generically — but there's no `WorkshopModalShell.test.tsx` either, so that mechanism isn't proven anywhere, and the two-callback split is specific to this component, not shared chrome. Nobody has clicked the X in this feature's tests.

> *"Happy path only. I've seen this movie. The edge case is always the one we didn't test — and here it isn't even an edge case, it's the whole hook nobody drove."* — Cal

---

## 🗂️ Stan · Codebase Standards

"He Has Every Pattern Memorized"

### 🟡 Standard — New empty payload skips the documented house idiom [🎯 Consensus]

`packages/core/src/shared/types/messages/ui.ts:171`

`workshop.ts:1192` literally has a code comment spelling out the convention: *"Zero-payload messages use the house `Record<string, never>` idiom directly (9 prior siblings; PR #67 review #9)."* Nine existing zero-payload messages across `configuration.ts`, `publishing.ts`, `sources.ts`, `ui.ts` itself (`OpenWorkshopMessage`), and `workshop.ts` all write it inline. We wrote the rule down after a past PR review specifically to stop this drift, and this PR just re-drifted.

### 🟡 Standard — Sheet-shaped modals get a `variant="sheet"` — the new browsers reinvented it in CSS

`packages/core/src/presentation/webview/components/workshop/WorkshopToolsModal.tsx:100`

`WorkshopModalShell` already has `variant?: 'panel' | 'sheet'` (`WorkshopModalShell.tsx:28,74`) adding `.pm-ws-modal-sheet` — the shared class carrying flex/width/height/padding/overflow for locked-head-and-foot sheets. `WorkshopChooseHostModal.tsx:73` and `WorkshopInviteGuestModal.tsx:186` both use it. The new `WorkshopToolsModal`/`WorkshopWidgetsModal` pass only `className="pm-ws-browser-modal"` with the default `variant="panel"`, then hand-roll a near-duplicate ruleset at `workshop.css:4531` — the exact same properties, just different numbers. Two sheet geometries now do the same job by coincidence instead of composition.

### 🟢 Nit — New platform port drops the ADR citation its own doc comment says it's following

`packages/core/src/platform/GlobalStateStore.ts:2`

`SecretStore.ts:2` and `SettingsStore.ts:2` both open with `platform port for X (ADR 2026-06-16)` — that ADR is the whole reason these ports don't need adapter classes. `GlobalStateStore.ts`'s header explains the no-adapter mechanics in the same voice ("exactly like `SecretStore`") but never cites the ADR. Small, but this is the file explicitly modeling itself on the precedent — it should say which precedent.

> *"We have a comment on line 1192 of workshop.ts that spells out the payload rule in plain English, and this PR is the reason that comment had to get written a second time."* — Stan

---

## ⚡ Tim · Performance

"O(n²) at Scale is an Incident Waiting to Happen"

### 🟢 Praise — Composer draft stays local — no app-wide re-render tax per keystroke

`packages/core/src/presentation/webview/components/workshop/WorkshopComposer.tsx:119`

I went looking for the thing that usually bites composer components: draft text lifted into shared state so every keystroke re-renders the whole tree (including the dozen sibling modals rendered unconditionally in `WorkshopApp.tsx`). That's not what happens. The draft is deliberately local, so a keystroke re-renders exactly one component. `onOpenWidgets` being a stable `useCallback` is therefore moot either way — there's no cascade to protect against. Correct call, and it's the one that would actually have mattered at scale.

### 🟢 Nit — `WorkshopSheetBrowser.findItem` — the math, for the record

`packages/core/src/presentation/webview/components/workshop/WorkshopSheetBrowser.tsx:64`

Counted both registries: `WORKSHOP_WIDGET_GROUPS` is 12 items across 5 groups; `TOOL_GROUPS` is 14 across 3. `findItem` allocates a fresh flattened array and linear-scans — worst case 14 comparisons — and only runs while its owning modal is open. That's O(14) triggered by explicit clicks, not a hot path, not per-keystroke, not per-frame. I'd flag it at N=1,000; at N=14 it's below the engine's own allocation jitter. No action — flagged only so the next reviewer doesn't redo the arithmetic when the widget registry grows past "preview."

> *"Linear scan over fourteen items triggered by a mouse click isn't a performance finding, it's a rounding error — save the outrage for when someone lifts that composer draft into shared state."* — Tim

---

## 🛡️ Patricia · Security

"She Reads Code Like an Attacker Would"

### 🟡 Standard — Startup-notice dismissal validation is weaker than its sibling handlers [🎯 Consensus]

`packages/core/src/application/handlers/domain/UIHandler.ts:85-90`

`handleOpenGuideFile`, `handleOpenDocsFile`, and `handleOpenResource` all run webview-supplied strings through `isPathWithinRoot` containment checks before touching disk. `handleStartupNoticeDismiss` only checks `typeof === 'string' && length > 0` before writing the value verbatim into per-machine `globalState` — no upper bound on length, no charset restriction, no comparison against a known version.

Being honest about severity: I traced where this value goes and it terminates at a single `!==` comparison on the read path. It is never used as a path, shell argument, URL, or rendered as markup, and I confirmed `context.globalState` is never passed through `setKeysForSync`, so it doesn't ride Settings Sync or leave the machine. The realistic attack also requires the webview to already be running attacker-controlled JS capable of arbitrary `postMessage` — at which point an unbounded string in local `globalState` is the least of the damage. I grepped the whole `workshop/` component directory for `dangerouslySetInnerHTML` and found none; both sheet-browser consumers pass static developer-authored registries. So this is genuinely theoretical, not practical.

Still — for consistency with the "validate everything from the webview" posture the rest of the file enforces, a length cap (reject anything over ~64 chars, matching the `'v1'` format) costs nothing and closes the inconsistency before a later refactor gives this key a more sensitive purpose.

> *"Passes the scanner, passes the attacker too this time — but 'weaker than its neighbors' is how a boundary earns its reputation for being the one that eventually doesn't."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

"Would This Failure Leave a Trail at 2am?"

### 🟡 Standard — The one handler most likely to generate a bug report is the only silent one

`packages/core/src/application/handlers/domain/UIHandler.ts:71-83`

`handleStartupNoticeRequest` never calls `this.outputChannel.appendLine(...)` — not on entry, not with the resolved decision. Every sibling handler in this same file (`handleOpenGuideFile`, `handleOpenDocsFile`, `handleOpenResource`, `handleWebviewError`) logs both attempt and outcome, even though their failure modes (missing file) are rarer and far less support-sensitive than this one's — versioning logic a writer will actually notice and complain about ("the notice keeps coming back").

When that report lands, the Output Channel shows nothing: not the stored `dismissedVersion`, not the current `WORKSHOP_STARTUP_NOTICE_VERSION`, not the computed `shouldShow`. The developer can't diagnose from a bug report; they have to reproduce locally with a debugger. One line would make this diagnosable from the log alone, matching the density of every neighboring method:

```ts
this.outputChannel.appendLine(
  `[UIHandler] Startup notice check: dismissed=${dismissedVersion ?? 'none'}, ` +
  `current=${WORKSHOP_STARTUP_NOTICE_VERSION}, shouldShow=${shouldShow}`
);
```

### 🟡 Standard — Dismissal-persistence failure is swallowed with no version and no user feedback

`packages/core/src/application/handlers/domain/UIHandler.ts:94-99`

Catch-and-log-not-throw is the right call — a failed Memento write shouldn't crash message routing. But two gaps hurt the 2am read. First, the failure log omits `version`, while the success branch two lines up includes it (`Startup notice ${version} dismissed`) — so a dev correlating *which* version failed to persist can't. Second, `dismissStartupNotice` on the webview side (`useStartupNotice.ts:59`) calls `setNoticeOpen(false)` *before* the postMessage goes out, so the UI looks like a clean dismiss regardless of whether the host write later fails. The writer who checked "Don't show again" gets no error, sees the modal close, and has no reason to suspect anything went wrong until it reappears next launch. `sendError` exists on this class and every sibling handler uses it on failure; this catch is the only one in the file that doesn't.

> *"The handler with real business logic is the quiet one — the file-not-found paths get four log lines each and this gets zero; wrong things are getting the airtime."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

"Does This Code Actually Do What the Ticket Asked?"

### 🟡 Standard — "The six the rail keeps at hand" copy change is based on a miscount — the six is real

`packages/core/src/presentation/webview/components/workshop/WorkshopToolsModal.tsx:31-34`

The sprint doc (§2) specifies this string verbatim: *"The daily passes — the **six** the rail keeps at hand."* The shipped code deliberately drops "six" for "ones," with an inline comment arguing the comp's own Primary *catalog group* holds three tools (dialogue, prose, gestures — confirmed in `workshopTools.ts`).

But that compares against the wrong list. `WorkshopApp.tsx:130-137` already implements a literal "keeps at hand" feature: a rail-level `Tools` quick-launch section (`RAIL_TOOL_IDS`) with exactly six entries — `dialogue, prose, gestures, choreography, cliche, show-and-tell` — a byte-for-byte match of the design comp's own `RAIL_TOOLS` constant (`docs/design/pm-workshop.js:43`). That six-tool rail section even carries a prior comment attributing its provenance to a Bria review on PR #66.

So "the six the rail keeps at hand" was accurate all along — it just doesn't refer to the tools-modal's Primary group, it refers to a different, already-shipped rail affordance. Worth restoring the literal "six" (or at minimum fixing the comment's reasoning) so a future reader doesn't inherit the wrong mental model of what "the rail keeps at hand" means.

> *"You changed the copy because the count looked wrong — but you checked the modal's grouping, not the rail's actual quick-launch list, which has had exactly six tools sitting right there since PR #66."* — Bria

---

## 🎓 Sensei · The Teacher

"The Review Is the Lesson. The Code Is the Practice."

### Lesson 1 — The Contract You Wrote Is the One Least Likely to Be Tested

Illuminated by: Cal, with Blake's focus-steal and the version echo as corroboration

Coverage accumulates around the code that is easy to reach; the load-bearing logic tends to be the small conditional in the middle, guarded by nothing. Here 1,462 green tests surround a hook whose single `&&` implements the entire user promise — flip it to `||` and the suite stays silent. A test that asserts against a mock of the thing you wrote is a mirror, not a witness; the handler test that hand-builds the envelope and the modal test that stubs the hook both testify about their own fixtures. Ask not "is this file covered" but "which line, if inverted, would embarrass us in front of a user — and does anything execute it for real?"

→ **Carry forward:** When you finish a feature, name the one boolean expression that *is* the feature. If you cannot point to a test that drives that expression through real code, write it before you write anything else.

### Lesson 2 — Consistency Is a Load-Bearing Wall, Not a Decorative One

Illuminated by: Blake, Stan ×2, Parker ×2, Oliver

Six findings in this PR are the same finding wearing different clothes: an inline arrow where every sibling passes `useCallback`; a `className` where `variant="sheet"` already exists; `kicker` where the file next door says `eyebrow`; a named payload interface where nine siblings and a comment say `Record<string, never>`; a silent handler among logging ones. None is a bug in isolation — but the divergent one is where the focus gets stolen and where the on-call engineer finds no trail. Convention is compressed, hard-won knowledge; when you step outside it, you step outside its protections too, usually without noticing. The `workshop.ts` comment is the sharpest evidence: it exists *because a prior review caught this exact drift*, which means the convention had already paid for itself once and still didn't get read.

→ **Carry forward:** Before writing a new component, prop, name, or interface — open the nearest sibling and read how it does the same job. If you diverge, say why in the diff. If you can't articulate a why, you've found a bug you haven't met yet.

### Lesson 3 — Verify the Referent, Not the Reasoning

Illuminated by: Bria, echoed by the Blake/Patricia version-echo consensus

The strongest failure in this PR is a *careful* one. The author noticed an apparent contradiction between spec and comp, reasoned it through, documented the rationale inline, and changed the copy — and was checking the wrong noun. "The six the rail keeps at hand" pointed at `RAIL_TOOL_IDS`, which has held exactly six since PR #66; the rationale audited the modal's grouping instead. Sound logic applied to a misidentified subject produces a confident, well-commented wrong answer — far more durable than a careless one, because the comment discourages the next reader from re-checking. The version echo is the same shape at a different scale: the host asked the webview what the host's own version is, and got a right answer for a wrong reason.

→ **Carry forward:** When a spec and an implementation seem to disagree, before you resolve it, grep for the thing the spec actually names and count it yourself. Cite the constant and line in your rationale — "six, per `RAIL_TOOL_IDS` (WorkshopApp.tsx:130)" is falsifiable; "the comp contradicts itself" is not.

### Lesson 4 — An Extraction That Leaves the Duplication Behind Has Only Moved the Furniture

Illuminated by: Parker (reset-on-open, sheet-geometry duplicate), Marcus, Sam

`WorkshopSheetBrowser` was built as the shared sheet — and both of its only two consumers implement identical reset-on-open logic, each with its own comment justifying it. The signature moved; the knowledge did not. That is the tell: when every caller of your abstraction writes the same five lines afterward, those five lines belong *inside*. The same instinct explains the second sheet geometry hand-rolled beside `variant="sheet"` — deduplicating shapes while leaving behaviors and styles behind is how you end up with two things that do one job by coincidence. Sam's dormant duplicate-id case is the postscript: an abstraction that doesn't own its invariants is a promise its next consumer will unknowingly break.

→ **Carry forward:** After extracting a shared component, look at what each call site wrote *around* it. Duplicated setup, duplicated teardown, or a repeated justifying comment is the abstraction telling you where its real boundary is.

### Lesson 5 — Trust Your Own Rigor Enough to Point It at the Quiet Places

Illuminated by: Marcus and Tim's praise, read against Oliver and Cal

This PR shows genuine engineering maturity in the places most people get wrong — `GlobalStateStore` earns its precedent honestly, the composer's draft state is local for exactly the right reason, and the description names its own out-of-scope items and pending gates without flinching. That same rigor thinned at the edges: the automatically-opening modal got the inline handler, the only handler with real business logic got no logging, the load-bearing hook got no test. Discipline reliably follows the parts that feel *architectural*, and thins where work feels like plumbing — but plumbing is where users live. Care is not a fixed budget you spend down; it's a direction you keep having to re-aim.

→ **Carry forward:** Before opening a PR, list the three pieces you thought about least. That list is your review checklist — and it's usually where the reviewer's highest finding is waiting.

> *"The most instructive mistake in this diff was made carefully, with a comment explaining it — which is worth remembering the next time your own reasoning feels finished."* — Sensei

---

## The Closer

### 🚪 Knock knock

> **Knock knock.**
> *Who's there?*
> **The beta notice.**
> *The beta notice who?*
> **The beta notice you already checked "Don't show again" on — but focus jumped to the X mid-tab, so Space closed the box instead of ticking the checkbox, so here I am again, and I'll be here tomorrow, and the Output Channel will have absolutely nothing to say about it.**

---

## Summary

This is a strong PR carrying a real design drop and three genuine features, and the panel's praise is not consolation — `GlobalStateStore` is a textbook port extension and the composer's render discipline is the performance call that actually mattered. Nothing here blocks on correctness of *data*; the two 🟠 High findings are a focus-management bug on the one auto-opening modal and a completely untested load-bearing hook, and both are small, mechanical fixes.

The through-line worth noting is that every finding above lives in the seams — an inline arrow where siblings use `useCallback`, a payload interface where nine siblings use the documented idiom, a hand-rolled sheet geometry beside an existing `variant="sheet"`, a silent handler among logging ones. Fix Blake #1 and Cal #1, decide on the host-authoritative version write, and this is merge-ready; the rest is convention cleanup that would be cheaper now than after the Widgets epic builds on top of it.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
