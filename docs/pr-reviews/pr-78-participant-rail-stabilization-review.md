# MR Review — fix(workshop): stabilize participant rail layout

**Author:** okeylanders · PR #78 · base `epic/workshop-editor-tab` ← `sprint/workshop-editor-tab-11b-context-budget-visibility`

Reviewed by a 10-persona panel + an accessibility guest seat + Sensei. Draft PR; Sprint 11b of the Workshop epic — the composer band learns to hold still while someone is talking.

---

## Resolution ledger

Status is the reviewer's **initial recommendation**, not a verdict — update the `Status`
column as findings are addressed so this file stays a living record. Legend: **Open** =
act before merge · **Deferred** = real issue, safe to punt for a stated reason (track it)
· **Addressed** = fixed · **Partially addressed** = fixed with a noted remainder · **N/A**
= out of scope or superseded.

| # | Sev | Finding | Reviewers | Consensus | Status |
|---|-----|---------|-----------|-----------|--------|
| 1 | 🟠 High | Rail (dismiss included) unlocks at wire-complete (`phase: 'settled'`), deterministically one webview-message-tick before the assistant turn lands — "until the run completes" holds for the wire, not the transcript; the thread already computes the wider predicate (`showLiveTurn`, `WorkshopApp.tsx:289`) and the lock doesn't reuse it | Sam, Bria *(Blake dissents: same boundary `canMessage` always used; host state stays consistent)* | 🎯 | **Open** — one-line: lock on the `showLiveTurn` condition (or hoist it and share) |
| 2 | 🟠 High | Locked chips still advertise clickable copy — `title` still says "Talk to X" / "Back to Jill" and the dismiss `aria-label` is silent about the lock, while the component's own `unavailable` branch demonstrates self-explaining disabled copy two lines away | Marcus, Oliver, Quinn | 🎯🎯 | **Open** — add a `disabled` branch to the four title ternaries + dismiss `aria-label` ("Available once the response finishes") |
| 3 | 🟠 High | "disables every control" test renders 3 of 5 control kinds — no guest chip, no dismiss button (the one control that got new CSS this PR and the one with host-side stakes); `disabled` and a live guest never co-occur anywhere in the suite | Marcus, Sam, Cal | 🎯🎯 | **Open** — add one live guest to the fixture; assert guest chip + `Dismiss` button disabled |
| 4 | 🟡 Standard | App-level wiring untested: the unit test hand-passes `disabled`/`showInviteGuest`, no `WorkshopApp` test exists (searched — none), and the PR's own named regression shape (Jill-only room: empty sidecars/guests, invite-only rail) is never rendered. *(One sub-claim normalized in compilation: the feared mid-run null window from `sessionReady` settling doesn't exist — the host snapshot delivers `sessionReady` + `activeRequestId` in one message and React batches the updates.)* | Cal, Bria | 🎯 | **Open** — add the empty/empty + `showInviteGuest` + `disabled` component case; App-level render test is a fair follow-up |
| 5 | 🟡 Standard | Focus falls to `<body>` when a focused rail control flips to native `disabled`; no focus management added (searched component/App/test — none). *(Compilation note: the click-chip-then-send path moves focus off the rail before the lock lands; the realistic narrow path is modal return-focus onto the now-disabled invite chip after starting a guest-join run.)* | Sam, Quinn | 🎯 | **Open** — cheap catch: `tabIndex={-1}` + ref on the toolbar div, refocus it when `disabled` flips true while it contains `activeElement` |
| 6 | 🟡 Standard | `role="toolbar"` with every child natively disabled is unreachable to keyboard/AT users mid-run — "visible but locked" is delivered to sighted mouse users only; the `aria-disabled` + click-guard alternative would introduce a pattern with no precedent in this codebase | Quinn | — | **Deferred** — deliberate pattern decision; house pattern is native `disabled`, lock is transient, ticker still narrates run state |
| 7 | 🟡 Standard | Stuck-lock has no self-heal: every clearing signal is a fire-and-forget `postMessage` (no ack, no visibility-change resync, one-shot session request on mount), and in that same scenario Cancel silently no-ops on requestId mismatch (host logs "Cancel ignored", sends nothing back). Pre-existing delivery-layer gap; this PR changes its face — chips now sit dimmed-forever instead of absent | Oliver | — | **Deferred** *(filed High; normalized — infrastructure, untouched by this diff)* — a visibility-change `requestSession()` resync would close it |
| 8 | 🟡 Standard | `WORKSHOP_SET_CHAT_TARGET` is the one mutating rail action never revalidated against an active run — invite and dismiss both consult `activeRun`/`preemptActiveRun()`; `handleSetChatTarget` and `WorkshopSessionService.setChatTarget` check target validity only. DOM path is genuinely blocked by this PR; message-channel path isn't. Pre-existing, bounded consequence (routing-focus display race) | Patricia | — | **Deferred** — mirror the `preemptActiveRun()` pattern in a follow-up |
| 9 | 🟡 Standard | Dismiss-to-cancel granularity lost: pre-PR, dismissing the streaming guest was a working, host-supported cancel path (`handleDismissGuest` still preempts that exact run — the branch is now UI-unreachable during runs). Blunt composer Cancel remains. Deliberate simplification or unexamined loss — the PR body doesn't say | Bria | — | **Open** — product call: confirm intentional and say so in the PR body (or scope dismiss-disable to non-running guests) |
| 10 | 🟡 Standard | `disabled` prop's doc comment ("Keep the participant map visible…") narrates the **caller's** visibility fix, not the prop's mechanism — the prop has no hand in visibility; the null-guard + the removed `!isRunning` term in `WorkshopApp` do that work. Future maintainer chasing "rail vanished" reads it and looks in the wrong file | Parker | — | **Open** — one-line comment rewrite |
| 11 | 🟡 Standard | Invite-visibility rule is an unnamed 4-line inline boolean in JSX; the same file already demonstrates the fix (`showLiveTurn`: hoisted, named, one-line-commented, reused) | Parker | — | **Open** — hoist to `canInviteGuest` |
| 12 | 🟡 Standard | Load-bearing `22px` lands uncommented while the sibling rules in this exact ticker→rail→budget band all explain their numbers; the two halves of the gap contract live in two files (`index.css` / `workshop.css`) with no cross-reference | Parker | — | **Open** — one comment |
| 13 | 🟡 Standard | Prop named `disabled` (modal family: multi-cause, folded by caller) though the wiring is a bare single-cause `workshop.isRunning` passthrough — exactly the shape `ExcerptPanel` in the same band names `isRunning` *(Parker dissents: the name matches the modals and mechanically that's all it does — genuine panel split)* | Stan | — | **Deferred** — naming decision; either is defensible, pick one and note it |
| 14 | 🟡 Standard | `renderRail` helper not extended — second test now bypasses it with inline JSX; `WorkshopPersonaBrowserModal.test.tsx:11` shows the destructured-options-param pattern that solves this | Stan | — | **Deferred** — next touch of the file |
| 15 | 🟢 Nit | Component header comment still narrates only pre-lock chip semantics; `ExcerptPanel`'s header got a sentence when comparable interaction behavior landed (commit 6868cf2) | Stan | — | **Open** — trivial |
| 16 | 🟢 Nit | Remaining perf surface (prop threading, O(2) guest filter, margin swap) is all noise at n≈17 — informational, no action | Tim | — | **N/A** |
| 17 | 🟢 Praise | Visibility (structural: excerpt, capacity) vs interactivity (temporal: `isRunning`) separated into independent props — the actual root-cause fix, not symptom paper | Marcus | — | **N/A** |
| 18 | 🟢 Praise | The lock provably always releases: every run-exit path (success, cancel, error, zombie-discard, invite failure, tool handoff) clears both trackers via three redundant signals — traced independently by two reviewers, and the code comments show the lesson was learned structurally | Blake, Oliver | 🎯 | **N/A** |
| 19 | 🟢 Praise | Keeping the rail mounted deletes a real per-run double reflow — the unmount/remount cycle was the actual layout cost; verified no path reaches the null-guard mid-run | Tim | — | **N/A** |
| 20 | 🟢 Praise | Native `disabled` is real enforcement (blocks mouse, keyboard, and programmatic clicks; the suite proves the programmatic case); no injection surface — labels trace to static persona constants, JSX-escaped attributes only | Patricia | — | **N/A** |

Deferred rows 6, 7, 8, 13, 14 are follow-up candidates for the sprint's tech-debt list — no tracking file created in this pass.

---

## Blast Radius

- 5 files changed · +34 / −5 lines
- New files: 0 · Migrations: n/a · New services/components: none
- Surgical UI-state PR: one boolean prop threaded five ways, two CSS rules, one margin, one unit test

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | C+ |
| 🛡️ Security | B+ |
| 🧪 Tests | C |
| 📖 Quality | B− |
| ⚡ Performance | A− |
| 🎯 Domain | C+ |

*(Grades are mechanical from finding severity — the C-band grades all trace to the three consensus Highs, each of which has a one-line-to-one-fixture fix. The underlying design drew five praises.)*

---

## Executive Briefing

🟠 **[Sam · Bria 🎯]** Unlocks one tick early, every run — `isRunning` flips false at wire-close (`'settled'`), before the assistant turn lands; the dismiss button for the guest whose reply is still typing itself onto screen becomes clickable in that window. The thread already computes the right predicate (`showLiveTurn`) — the lock just doesn't use it. *(Blake dissents: same boundary `canMessage` always used, host-safe either way.)*

🟠 **[Marcus · Oliver · Quinn 🎯🎯]** Locked chips lie on hover — every tooltip still reads "Talk to X" while the control refuses the click; the component's own `unavailable` branch two lines away shows exactly how disabled states self-explain here.

🟠 **[Marcus · Sam · Cal 🎯🎯]** The regression test can't cash its title — "disables every control" renders 3 of 5 control kinds; the guest chip and dismiss button (the control this PR restyled, with host-side stakes) are never asserted disabled anywhere in the suite.

---

## 🏛️ Marcus · Architecture & Design

"The Cartographer of Layer Boundaries"

### 🟢 Praise — Eligibility and temporal lock are finally two separate variables

`WorkshopApp.tsx:687` — The bug existed because "should this be visible" and "should this be interactive" were one conflated expression — `showInviteGuest` carried `!workshop.isRunning`, so a Jill-only room mid-run had zero eligible chips and hit the early return at `WorkshopParticipantRail.tsx:57`, collapsing the band. The fix draws the correct boundary: `showInviteGuest` (688–693) now answers a purely structural question (excerpt, readiness, capacity) while `disabled` (687) answers a purely temporal one, threaded uniformly to all five controls rather than re-derived per chip. That's the root cause closed, not the symptom papered.

### 🟠 High — `disabled` changes interactivity everywhere but none of the four tooltip strings know it exists [🎯🎯 Strong Consensus — with Oliver, Quinn]

`WorkshopParticipantRail.tsx:144` — Every explanatory string — host `title` (83), guest `title` (102–106), tool `title` (140–146), invite `title` (158), dismiss `aria-label` (114) — derives only from `active`/`unavailable`. Mid-run, a locked-but-live tool chip still reads "Talk directly to X about its latest report" — copy that invites the exact click the control now refuses — and the two states are visually identical at the same 0.45 opacity. The `unavailable` branch in the same ternary already self-explains ("…conversation is no longer available"). The PR extended the interactivity half of the contract without the explanatory half; a `disabled ? 'Available once the run finishes' : …` branch per title closes it.

### 🟡 Standard — The compound-disabled branch is unverified [🎯🎯 — detailed under Cal]

`WorkshopParticipantRail.test.tsx:104` — The two controls with the most complex disabling logic in the diff (guest chip's `disabled || unavailable`, dismiss's bare `disabled`) never render in the locked test. Across all 7 tests, `disabled` and a live guest never co-occur — and the guest/dismiss path is the one with real host-side stakes.

> *"The map now separates 'can be seen' from 'can be touched' — a genuine boundary fix. Extend that same honesty to the tooltips and the test fixture, or the map quietly stops matching the territory."* — Marcus

---

## 🔥 Blake · Staff Engineer

"She's Been Paged for This Before"

Wiring intact — both handlers still passed, `disabled` at 687, `showInviteGuest` matches the diff. No dropped handler. I traced the one path that would page someone — a stuck-disabled rail — and it doesn't reproduce.

### 🟢 Praise — The scary path — disable-everything-during-run — is provably reversible [🎯 Consensus — with Oliver]

`WorkshopApp.tsx:687` — `isRunning` cannot stick true: every active-run terminus clears both trackers. Send-message errors/aborts (`WorkshopHandler.ts:673–703`) run `abandonRun` → `sendStreamComplete(cancelled)` → `postSessionState` → `settleActiveRun` in `finally`; invite mirrors it (371–383); the documented wire order COMPLETE → SESSION_STATE → STATUS covers preemption. STREAM_COMPLETE clears the webview `liveRun`, the trailing SESSION_STATE clears `activeToolId` — its only writer. `disabled` always falls back to false. Rail-unmount-mid-run is genuinely fixed, and the fix doesn't trade one wrong-state for a worse one. The settled-window wrinkle the others flagged is the same boundary `canMessage` always used, and host-side it's race-safe.

> *"I went looking for the 3am page in this one and came back empty — the rail locks hard and unlocks clean; merge it."* — Blake

---

## 🔍 Sam · Bug Hunter

"What if the list is empty, though?"

### 🟠 High — Rail (dismiss included) unlocks during the 'settled' phase, before the turn lands [🎯 Consensus — with Bria]

`WorkshopApp.tsx:687` — Traced it to the wire: on STREAM_COMPLETE, `handleStreamComplete` sets `liveRun = {requestId, phase: 'settled'}` (`useWorkshop.ts:384`) and `currentRequestId` goes null immediately; for host/guest turns `activeToolId` is never populated, so `isRunning` flips false a full message-tick before the turn lands. Host-side, `streamCompleted` and `turnCompleted` fire back-to-back but cross the extension↔webview boundary as two separate events — the webview genuinely renders an intermediate frame: rail enabled, turn not yet in `turns[]`. In that window the dismiss button (`:115`) is live again, so a user can dismiss the very guest whose reply is still the on-screen live bubble — the action the PR says stays locked "until the run completes." `WorkshopApp.tsx:289` already computes `showLiveTurn` for the thread to cover this exact gap; the rail's `disabled` doesn't reuse it. No test drives a STREAM_COMPLETE→pre-TURN sequence.

### 🟡 Standard — Disabling a focused rail chip drops keyboard focus to `<body>` [🎯 Consensus — with Quinn; fix sketch in Quinn's section]

`WorkshopParticipantRail.tsx:77` — A natively disabled button leaves the tab order, and a focused element that becomes disabled blurs to `<body>` with no hand-off; nothing in the diff adds focus management (searched — none). *(Compilation note: the commonest flow moves focus off the rail before the lock lands — sending requires composer focus; the realistic narrow path is the persona modal returning focus to the invite chip that opened it, after the guest-join run has already disabled that chip.)*

### 🟡 Standard — New test never includes a persona guest [🎯🎯 — detailed under Cal]

`WorkshopParticipantRail.test.tsx:113` — `toHaveLength(3)` pins host + tool + invite only; guest chip (`disabled || unavailable` — an OR of two independently-varying booleans, exactly the kind that regresses silently) and dismiss (`disabled`, deliberately not gated by `unavailable`) never execute under the locked test.

> *"Chased the 'settled' window all the way to the wire — turns out the dismiss button unlocks for exactly the beat where dismissing it would be the most dramatic possible timing, right as the guest's own words are still typing themselves onto the screen."* — Sam

---

## 📖 Parker · Code Quality

"Code is Communication, Not Instruction"

### 🟡 Standard — `disabled`'s doc comment describes WorkshopApp's fix, not this prop's job

`WorkshopParticipantRail.tsx:38` — The name is fine — it matches the modals, and mechanically that's all it does: disable five buttons. But the comment ("Keep the participant map visible…") describes a visibility outcome this prop has no hand in — the null-guard at 57 ignores `disabled` entirely; what keeps the rail mounted is the sibling edit in `WorkshopApp` dropping `!isRunning` from `showInviteGuest`. A maintainer chasing "rail vanished mid-run" would trust this comment and look in the wrong place. Scope it to the mechanism: *"Disables every rail control without unmounting the rail — visibility is governed by the guard above and the caller's showInviteGuest."*

### 🟡 Standard — `showInviteGuest` recomputes an unnamed rule inline — the file already has the pattern that fixes this

`WorkshopApp.tsx:688` — A four-line anonymous boolean chaining existence, readiness, and an inline `.filter().length` comparison. This file already knows the fix: `showLiveTurn` (289) is exactly this shape, hoisted to a named, commented const. `const canInviteGuest = …` with a one-line comment ("Invite is offered once context is loaded and the room has an open guest seat") gives the rule a name instead of making every reader re-derive it.

### 🟡 Standard — New 22px gap lands uncommented, in the one band that otherwise explains its numbers

`index.css:173` — `22px` is the entire fix for "context bar shouldn't press the divider," and nothing says why 22 or that it's load-bearing — while the ticker's "reserved height" note and the rail's header comment explain non-obvious choices in this same stack. The margin's counterpart geometry lives in a different file (`workshop.css`), so the link is invisible without a side-by-side diff. One comment closes it: *"Constant gap above the budget whether or not the participant rail is mounted above it — don't let this drift back to a rail-only margin."*

> *"I had to cross two files and trace a removed clause in WorkshopApp just to learn that `disabled`'s doc comment is narrating someone else's fix — that's a lot of spelunking for a one-line prop."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

"Confidence Levels, Not Coverage Numbers"

### 🟠 High — "disables every control" is true only of the three controls this fixture happens to produce [🎯🎯 Strong Consensus — with Marcus, Sam]

`WorkshopParticipantRail.test.tsx:99` — The fixture omits `personaGuests`, so the guest chip and dismiss button never render — `toHaveLength(3)` locks in host + tool + invite only. The dismiss button is simultaneously the one control that got new CSS this PR (`:disabled` opacity, hover guard), and no test anywhere passes `disabled` alongside a live guest. Break `disabled={disabled}` on either control and CI stays green while the title's claim quietly stops being true. Fix: add one live guest to the fixture (mirror the one from "exposes the explicit guest invitation") and assert the guest chip and `getByRole('button', { name: /Dismiss/ })` are disabled.

### 🟡 Standard — The wiring the diff actually changes has zero test coverage [🎯 Consensus — with Bria]

`WorkshopApp.tsx:687` — Searched `packages/core/src/__tests__` for `WorkshopApp` — no test file exists; `showInviteGuest`'s only hit is the rail's own test, where both props are hand-passed. So the suite proves the component honors `disabled` when handed it — nothing proves `WorkshopApp` computes and forwards it. Reverting the `!isRunning` removal or dropping the pass-through leaves CI green. The PR's own named regression shape — Jill-only room, empty sidecars/guests, invite-only rail — is also never rendered (the locked test seeds a sidecar, so the null-guard was never at risk in it). *(Compilation normalized one sub-claim: the feared mid-run transient where `sessionReady` hasn't settled doesn't exist — the host snapshot delivers `sessionReady` and `activeRequestId` in one message, batched into one render. The missing-shape test is still worth adding.)*

> *"A test titled 'disables every control' that never renders the dismiss button isn't pinning a regression — it's writing a check nobody can cash."* — Cal

---

## 🗂️ Stan · Codebase Standards

"He Has Every Pattern Memorized"

### 🟡 Standard — `disabled` breaks from the isRunning-passthrough name this exact wiring shape already uses next door

`WorkshopParticipantRail.tsx:39` — Two naming families coexist on purpose: the modals take `disabled` because WorkshopApp folds multiple causes into it (`disabled={!toolsEnabled}`, `disabled={mode === 'host' ? isPersonaSelectionLocked : isRunning}`). `ExcerptPanel` — in this same composer band — takes `isRunning: boolean` fed by a bare `isRunning={workshop.isRunning}` passthrough, no folding. The rail's wiring is single-cause, matching ExcerptPanel's shape exactly, but borrowed the other family's name. `isRunning` was sitting right there. *(Parker dissents: the modal-family name is fine and mechanically accurate — panel split, either is defensible; pick one and note it.)*

### 🟡 Standard — New locked-state test inlines render() instead of extending renderRail

`WorkshopParticipantRail.test.tsx:100` — `renderRail` covers 5 of 7 tests but has no param for `disabled`/`showInviteGuest`, so this test — like the guest test before it — falls back to full inline JSX; that's two of seven bypassing the helper. `WorkshopPersonaBrowserModal.test.tsx:11` had the same problem and solved it reusably: a destructured-options param with defaults, so new props extend the helper instead of orphaning it.

### 🟢 Nit — Header doc-comment wasn't updated to narrate the new locked-while-running behavior

`WorkshopParticipantRail.tsx:38` — The file header still describes only pre-lock chip semantics; `ExcerptPanel`'s header got a sentence when comparable interaction behavior landed (commit 6868cf2). The prop-level comment carries the new behavior alone — a smaller unit than the header treatment the sibling got.

> *"ExcerptPanel is right there in the same composer band, taking the exact same `workshop.isRunning` value under the name `isRunning` — we didn't have to invent a convention for this PR, just look one component up."* — Stan

---

## ⚡ Tim · Performance

"O(n²) at Scale is an Incident Waiting to Happen"

### 🟢 Praise — Keeping the rail mounted removes a real per-run reflow, not just a cosmetic disable

`WorkshopApp.tsx:688` — Pre-PR, any run started before the session had a sidecar or guest — the first tool run in a fresh session, the common case — flipped `showInviteGuest` false at run start, satisfied the null-guard, and unmounted a `role="toolbar"` row out of the flex band, then remounted it at run end: two forced reflows of everything below (budget + composer) per run — exactly the layout thrash the ticker's "reserved height, always mounted" pattern was built to avoid one component over. Verified the fix closes it for all states: `toolsEnabled` and `canMessage` both gate `isRunning` behind excerpt+sessionReady, and the capacity branch requires guests that independently block the null-guard. No path reaches the unmount while running. The `disabled` line reads like the headline; the mount stabilization is the one deleting render cost.

### 🟢 Nit — Everything else is noise at n≈17

`WorkshopParticipantRail.tsx:77` — The component isn't memo'd and already re-renders per streamed chunk; threading one derived boolean that flips twice per run into ≤17 buttons is O(17) attribute diffs on a subtree being reconciled anyway. The guest filter is O(2) and predates the PR; the margin is a static stylesheet value. None rise above noise.

> *"Seventeen chips and a boolean that flips twice a run — that's not the O(n²) you're looking for; the mount/unmount cycle it deleted was the actual reflow, and it's gone."* — Tim

---

## 🛡️ Patricia · Security

"She Reads Code Like an Attacker Would"

### 🟡 Standard — WORKSHOP_SET_CHAT_TARGET is the one mutating rail action the host never revalidates against an active run

`WorkshopHandler.ts:415` — Walked it end to end: `handleInviteGuest` and `handleDismissGuest` both consult `this.activeRun` and preempt before mutating — mid-run invite/dismiss is deliberate, host-enforced. `handleSetChatTarget` validates target shape against the allowlists and calls `session.setChatTarget` — never touches run state, and the session layer only checks target availability. A `WORKSHOP_SET_CHAT_TARGET` mid-run is accepted end-to-end. Practical scope: the rail's DOM can no longer send it (native `disabled` genuinely blocks all activation paths), so the only route is a stale/desynced webview posting directly; consequence is bounded — the in-flight run captured its target at start, so this is a routing-focus display race, not exposure. Pre-existing (0 of this PR's 5 files) — flagged because the new comment "a run temporarily locks routing" is true for the DOM path and quietly not true for the message channel on this one action. Follow-up: mirror `preemptActiveRun()` like its two siblings.

### 🟢 Praise — The native `disabled` is real enforcement, and the suite proves it

`WorkshopParticipantRail.tsx:77` — All five locked controls are real `<button disabled>` — not `aria-disabled` decoys, not `pointer-events: none`. Native `disabled` suppresses mouse, Enter/Space, and `.click()`/`dispatchEvent()` alike, and the suite actually exercises the programmatic case (fireEvent.click on a disabled chip, callback never invoked). No injection surface: no `dangerouslySetInnerHTML` anywhere in the directory; `personaLabel` reaches only JSX-escaped `title`/`aria-label` attributes, and provenance traces to the static persona catalog keyed by validated ids — not free text, not model output.

> *"The rail's buttons don't just look locked, they are — the one open door is a message type the DOM never used anyway, which is a robustness gap worth a follow-up, not an emergency."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

"Would This Failure Leave a Trail at 2am?"

### 🟡 Standard — The lock's only real failure mode is a dropped message with no timeout — and Cancel can silently no-op in that exact scenario *(filed High; normalized — pre-existing delivery-layer gap)*

`useWorkshop.ts:413–419` — The app logic isn't the gap: every host-triggered failure pairs `sendError` with STREAM_COMPLETE(cancelled) plus a fresh SESSION_STATE, and those DO clear the lock. The exposure is delivery: every clearing signal is `void this.postMessage(...)` — no ack, no retry — and the webview's only resync fires once on mount (no visibility-change or reconnect listener anywhere in the tree). In that same divergence, `cancelRun()` lands in the handler's mismatch branch, which logs "Cancel ignored" to the output channel and sends nothing back — the button visibly does nothing. This PR raises the stakes on the pre-existing gap: a stuck run used to mean the chips disappeared; now they sit at 0.45 opacity looking mid-thought, and a "rail's stuck" report finds nothing webview-side because the message that would have logged it is the one that got lost.

### 🟡 Standard — Run-locked chips lie about themselves [🎯🎯 — detailed under Marcus]

`WorkshopParticipantRail.tsx:102–106` — The title ternary branches on `unavailable`, never on `disabled` — one line below where the run-lock lands. Half of "greyed out" is self-documenting, half isn't, and hovering can't tell you which you're looking at.

### 🟢 Praise — The clear path for isRunning is genuine defense-in-depth, and the code says so out loud [🎯 Consensus — with Blake]

`useWorkshop.ts:423` — Traced every clear site for both disjuncts: every exit — success, cancel, API-key-missing, retention-failure, zombie-discard, guest-invite failure, the two-phase tool handoff — calls `abandonRun`/`completeRun` AND re-posts SESSION_STATE AND sends STREAM_COMPLETE, redundantly. `RunWorkshopToolSidePass.ts:271–272` documents why. Someone already had this exact 2am ticket and fixed it structurally.

> *"The clear paths are all solid — it's the message that never arrives, and the timer nobody set to notice, that'll be the one paging me."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

"Does This Code Actually Do What the Ticket Asked?"

### 🟠 High — "Until the run completes" unlocks at wire-complete, not transcript-complete — deterministically, every run [🎯 Consensus — with Sam]

`useWorkshop.ts:422–423` — This isn't a race: `WorkshopRunCompletion.ts:144–145` calls `streamCompleted` strictly before `turnCompleted` on every successful run, so on every run there's a guaranteed window where `disabled` has gone false — chips, dismiss, invite clickable, `canMessage` already true — while `showLiveTurn` is still true and the transcript still shows the live bubble. Is "the run completes" the wire or the transcript? The PR's own "Why" section frames the original bug in transcript/band terms, which argues for the latter — but the lock uses the former.

### 🟡 Standard — New test pins the disabled-prop contract, not the Jill-only regression the ticket names [🎯 — detailed under Cal]

`WorkshopParticipantRail.test.tsx:104–108` — The fixture seeds a non-empty sidecar, so the null-guard was never at risk regardless of `showInviteGuest`; and `disabled`/`showInviteGuest` are hand-passed, so nothing exercises WorkshopApp's actual derivation. Reintroduce `&& !workshop.isRunning` tomorrow and this suite stays green.

### 🟡 Standard — Dismiss-to-cancel a running guest is gone, and the backend branch for it is now unreachable — not named in the ticket

`WorkshopHandler.ts:399–401` — The blanket lock is acknowledged in the PR body, but not this: pre-PR, dismissing the actively-streaming guest was a working, intentional cancel path — the host still checks `activeRun?.guestPersonaId === personaId` and preempts specifically that run. Post-PR the dismiss button is disabled unconditionally for every guest during any run — not scoped to the guest actually running — and the webview has no other producer of WORKSHOP_DISMISS_GUEST. The preempt branch is now dead code from the UI. A user who wants to stop one guest's answer loses that granularity; Cancel remains, but it's the blunter instrument. Deliberate simplification, or a capability that fell out of scope unexamined?

> *"The ticket said 'until the run completes' — the code checked out the moment the wire went quiet, and nobody told the transcript it was leaving early."* — Bria

---

## ♿ Quinn · Accessibility — Guest Seat

*Seated for this review: the PR is pure interaction-state UI, and the rail already shows deliberate a11y craft worth holding it to.*

### 🟡 Standard — `role="toolbar"` with every child natively disabled is a toolbar nobody can tab into

`WorkshopParticipantRail.tsx:71` — "Keep the participant map visible while a run temporarily locks routing" is true visually; native `disabled` pulls every chip from the tab sequence, so a keyboard/AT user has zero reachable stops in the toolbar during exactly the moment they'd most want to confirm who's in the room. Weighed fairly: `unavailable` used native `disabled` pre-PR (house pattern), and it only ever grounds out individual dead chips — the host chip and live ones stayed tabbable; the run-lock blankets the entire toolbar at once. The fix that scopes to just the run-lock: `aria-disabled={disabled || unavailable}` + `disabled={unavailable}` + a click-guard on all five controls, with `[aria-disabled="true"]` added beside the `:disabled` CSS this diff touches — noting this would introduce a pattern with no precedent in the codebase, which is why it's a decision, not a demand.

### 🟡 Standard — Chip loses focus to `<body>` the instant a run starts, with no restoration [🎯 Consensus — with Sam]

`WorkshopParticipantRail.tsx:77` — Searched the component, WorkshopApp, and the test for focus management tied to the rail — none (the persona modal has its own `returnFocusRef` pattern; nothing here mirrors it). Self-contained catch: `ref={railRef} tabIndex={-1}` on the toolbar div plus `useEffect(() => { if (disabled && railRef.current?.contains(document.activeElement)) railRef.current.focus(); }, [disabled])`.

### 🟢 Nit — Chip tooltips stay silent about the lock [🎯🎯 — detailed under Marcus]

`WorkshopParticipantRail.tsx:102–106` — Native `disabled` already tells AT the control is unavailable independent of the title string, so this half is a hover-copy mismatch for sighted/low-vision users — same three-line ternary shape `unavailable` already establishes.

> *"Keeping the rail mounted during a run was the right call — now make it reachable during the run too, not just visible."* — Quinn

---

## 🎓 Sensei · The Teacher

"The Review Is the Lesson. The Code Is the Practice."

### Lesson 1 — "Done" Is a Word Wearing Several Clocks

Illuminated by: Sam & Bria's wire-close High; Blake's boundary tracing; Marcus's praise of the structural/temporal split

In an async UI, completion is a procession, not an event — the wire closes, the render settles, the words finish arriving before the user's eyes — and any guard on user action silently picks one of those clocks. The fix itself already made the deep cut (visibility is structural, interactivity is temporal); the remaining opportunity is noticing that the temporal axis has layers, and that the thread rendering had already named the widest one. The phrase "until the run completes" felt precise while quietly meaning "until the wire closes" — the note was released, but the room was still ringing.

→ Carry forward: When gating anything on a lifecycle flag, ask: "Completed according to whom — the wire, the renderer, or the user's eyes?" If the answers differ, reach for the broadest predicate the codebase has already built.

### Lesson 2 — The File Is Already Teaching the Class

Illuminated by: `showLiveTurn` (Sam, Bria, Parker); the unavailable-chip tooltip (Marcus, Oliver, Quinn); ExcerptPanel's name (Stan); the self-explaining sibling CSS (Parker)

Nearly every pattern this panel surfaced had its answer already resident in the same file or a near sibling — a hoisted, commented condition for exactly this timing gap; a disabled state that already rewrites its own tooltip; a naming precedent; a band of numbers whose neighbors all explain themselves. A codebase is accumulated tuition, each solved problem a jig hanging on the shop wall, and new work that doesn't consult it forks the dialect so future readers must learn two. This reframes what review is for: not inventing standards, but reintroducing the code to itself.

→ Carry forward: Before writing a new condition, name, or state, spend sixty seconds asking: "Has this file met this problem before?" Follow the precedent, or say in the PR why you departed from it.

### Lesson 3 — Every Sentence You Ship Is Load-Bearing

Illuminated by: all three Highs read together; Parker's and Patricia's doc-comment findings; Bria's unstated capability trade

Notice the shape of this review: the mechanism drew five praises — real enforcement, provably clean release, root-cause separation — while every High lived in the gap between a sentence and the behavior beside it: the body's "completes," the tooltip's "Talk to X," the title's "every control," the comment's "locks routing." Prose attached to code is interface with no compiler, so it drifts unless you falsify it the way you falsify assertions. And silence is prose too: retiring the per-guest cancel path may be a sound simplification, but unstated, it reads as an accident rather than a decision.

→ Carry forward: Before requesting review, reread every sentence in the diff — titles, tooltips, comments, the PR body — asking of each, "What would make this false?" Then ask what you removed that no sentence admits.

### Lesson 4 — A Locked Door Still Needs Its Sign Changed

Illuminated by: the tooltip High (Marcus, Oliver, Quinn); the toolbar and focus findings; Patricia's enforcement praise

A state has two halves — enforcement and explanation — and native `disabled` shipped only the first: honest muscle (it blocks even programmatic clicks) behind a shop window where the OPEN sign is still lit. "Visible but locked" is also a promise made separately to each modality: the sighted mouse user received it; the keyboard user received a toolbar that left their reach entirely; focus can quietly fall to the floor. What this is telling us: perception is part of the feature, not a polish pass after it.

→ Carry forward: When you add a state, walk it three times — as a mouse user, a keyboard user, a screen-reader user — asking each time: "How do I learn this state exists, why it exists, and when it ends?"

### Lesson 5 — Revert the Fix in Your Head; Watch Which Test Goes Red

Illuminated by: the fixture High (Marcus, Sam, Cal); the untested wiring (Cal, Bria); the never-rendered Jill-only room

The new test proves the component honors `disabled` when handed it — but the fix lives in the handing, and hand-passed props mean the actual one-line wiring could revert with CI serene. Meanwhile the title promises "every control" over a fixture holding three of five, absent precisely the one this PR restyled and the one with host-side stakes. A regression test earns its name twice over: by rendering the bug's own shape (the Jill-only room arrived pre-named — that is a fixture spec, free of charge), and by failing the moment the fix disappears.

→ Carry forward: After writing a regression test, mentally revert the fix and ask which test fails; if the answer is none, the test documents the component but does not yet guard the change. And when a title says "every," count.

> *"A lock is only half-built when it holds — it is finished when the person standing outside understands the door."* — Sensei

---

## The Closer

### 🐾 Animal

If this MR were an animal, it would be a **Virginia opossum**, because its entire survival strategy is to stay visibly present and play dead until the danger passes — the rail no longer flees the composer band mid-run; it goes convincingly inert at 0.45 opacity and holds its ground. The mapping runs all the way down: playing dead only works if onlookers believe it (three reviewers caught the tooltips still chirping "Talk to me!" from a supposedly lifeless chip), and — true to the species — it wakes up on its own internal clock, one beat before the show is actually over.

---

## Summary

Nearly there. Zero blockers — Blake and Oliver independently proved the scary property (the lock always releases), and the core design (visibility structural, interactivity temporal) is the actual root-cause fix, praised across the panel. What stands between this and merge is polish with outsized consensus behind it: reuse the `showLiveTurn` predicate so "until the run completes" means the transcript (one line), teach the tooltips about the lock (one ternary branch × 4), and put a guest in the locked-rail fixture so the test's title stops overpromising (one fixture edit). Plus one product sentence: say out loud whether losing dismiss-to-cancel mid-run was a decision.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Quinn ♿ (guest) · Sensei 🎓*
