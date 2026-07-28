# MR Review — feat(workshop): widen the startup notice and give the tour pictures

**Author:** Okey Landers · PR #94 · reviewed 2026-07-27
**Branch:** `claude/notifications-modal-design-ityo8d` → `epic/workshop-editor-tab`

---

## Resolution ledger

Status is the reviewer's **initial recommendation**, not a verdict — update the `Status`
column as findings are addressed so this file stays a living record. Legend: **Open** =
act before merge · **Deferred** = real issue, safe to punt for a stated reason (track it)
· **Addressed** = fixed · **Partially addressed** = fixed with a noted remainder · **N/A**
= out of scope or superseded.

| # | Sev | Finding | Reviewers | Consensus | Status |
|---|-----|---------|-----------|-----------|--------|
| 1 | 🟠 High | Shipped screenshots captured against the live daily-driver setup — manuscript working title + OpenRouter balance | Patricia | — | **Partially addressed** — manuscript title destructively redacted in *both* committed copies, pinned by `noticeScreenshotRedaction.test.ts`. **Balance intentionally left** (Okey's call: not worth acting on). See note below |
| 2 | 🟠 High | `WorkshopConfigureGuide` hand-copies the shell's focus/Escape effect — and the two managers fight, jumping focus out of the modal on every guide round trip | Marcus, Parker, Stan, Sam | 🎯🎯 Strong | **Addressed** — extracted to `useOverlayDismiss`; both overlays consume it, and an overlay handoff now leaves focus alone entirely |
| 3 | 🟠 High | The "cannot half-land" test never checks the PNG exists on disk | Cal, Oliver, Blake | 🎯🎯 Strong | **Addressed** — set equality against the folder + a size floor, both directions |
| 4 | 🟡 Standard | A broken `<img>` leaves no trail — bubble-phase error handler structurally cannot see it, no `onError` anywhere | Oliver, Blake | 🎯 | **Addressed** — capture-phase listener posts the failed asset; verified firing in Chromium |
| 5 | 🟡 Standard | Trailing-period bug (`guideLink.trail`) has no regression test; the API shape invites the bug | Parker, Cal | 🎯 | **Addressed** — renderer owns spacing; both sentences pinned by full-`textContent` assertions |
| 6 | 🟡 Standard | Four shipped PNGs oversampled 2–2.3× — ~600 KB recoverable by resize, no visible quality loss | Tim | — | **Deferred** — package-size optimization with no meaningful user impact at the current scale; not worth acting on before merge |
| 7 | 🟡 Standard | All 10 shipped PNGs are byte-identical duplicates of `docs/design/uploads/` — repo carries 1.6 MB twice, permanently | Tim | — | **Deferred** — repository hygiene only, with no runtime or package-size impact; not worth acting on before merge |
| 8 | 🟡 Standard | Comp deviation #2 (figure widths) has no doc entry and no test, unlike deviation #1 | Bria | — | **Addressed** — README "Notice-layout reconciliation" + a test pinning 180/340 and both ratios |
| 9 | 🟡 Standard | PR description caveat "typecheck was already red" does not reproduce — it passes clean | Blake | — | **Addressed** — Blake was right; caveat was an artifact of an `npx`-fetched TS 7.x before `npm ci`. Removed from the PR body |
| 10 | 🟡 Standard | Media well scroll offset survives a page change it should reset for | Sam | — | **Addressed** — `key` on the scroller, so each page opens at the top |
| 11 | 🟡 Standard | Guide round-trip tests never exercise the boundary page (Notice 6) | Cal | — | **Addressed** — Notice 6 now round-trips and asserts `6 / 6` + next-disabled |
| 12 | 🟡 Standard | `NoticeCallout` is an interface, `NoticeLegendRow` a positional tuple — same conceptual data, two shapes | Parker | — | **Addressed** — `NoticeLegendRow` is now an interface with named fields |
| 13 | 🟡 Standard | Guide nested inside the notice modal; every other overlay is a flat `WorkshopApp` sibling | Marcus | — | **Deferred** — works, and auto-closing with the notice is a genuine benefit; revisit if a third entry point appears |
| 14 | 🟡 Standard | `proseMinonAssets` typo preserved against the alpha no-compat policy; the cached-shell rationale doesn't hold | Stan | — | **Addressed** — renamed to `proseMinionAssets` everywhere; stale rationale replaced with why it was safe |
| 15 | 🟡 Standard | Full-surface guide is opaque but not `inert` — Tab reaches the hidden composer | Blake | — | **Deferred** — pre-existing hole in `WorkshopModalShell` too; `useOverlayDismiss` now makes it a one-place fix, in its own commit |
| 16 | 🟢 Nit | Barrel omits `WORKSHOP_STARTUP_NOTICE_VERSION` / `_DISMISSED_KEY` while adding its siblings | Stan | — | **Addressed** |
| 17 | 🟢 Nit | "Fill in one glob per field" — three of eight rows have two globs | Bria | — | **Addressed** — now "Fill in the fields with globs", body says when to comma-separate |
| 22 | 🟠 High | *Found while fixing #4:* the shell's pre-existing error bridge silently stopped forwarding once React booted — `acquireVsCodeApi()` throws on the second call and its `try/catch` swallowed it | — (Ada, prompted by Oliver) | — | **Addressed** — shell acquires once into `window.__pmVsCodeApi`; `getVSCodeApi()` prefers that handle |

### Note on #1 — redaction instead of re-shoot

Resolved by redacting rather than re-shooting, which changes the shape of the
remaining items:

- **The manuscript title is gone from both copies.** It sat in
  `vscode-open-folder.png` *and*, byte-identically, in
  `docs/design/uploads/Screenshot 2026-07-27 at 12.06.02 PM.png` — that folder is
  as public as the `.vsix`, so redacting only the shipped asset would have left
  the title one directory away. The band is mosaicked then blurred (a Gaussian
  alone can be partly inverted for known text; a coarse mosaic cannot), verified
  unreadable at full resolution, and the modal still renders with call-out 1
  landing on "Open Folder…".
- **The `$1.09` balance stays.** Raised and declined — it's a trivial figure on
  Okey's own account, and unlike the title it isn't tied to unpublished work.
  Recorded here so the decision is visible rather than looking like an oversight.
- **The remote design project still holds the unredacted original**, so the most
  likely future edit to that file is a re-pull that silently restores the title.
  Patricia's finding therefore got a test, not a paragraph — Sensei's Lesson 5,
  applied to the one file where it had teeth.
- Also worth stating plainly: the unredacted bytes were already committed and
  pushed in `5d9b109`, and git does not forget. Redaction stops this shipping in
  the package and makes it the version anyone reads from here on; it does not
  retroactively un-disclose the earlier commit.
- **Other eight shipped shots audited** while in there, since the review named
  only two. `controller-about-you.png` was the one worth checking — it shows the
  writer-profile fields — and it holds demo data ("Emma", "hobby fiction
  writer"), not real identity. The rest are product chrome. No further action.

### Notes on the deferred asset items (#6, #7)

Both are real but intentionally deferred: neither has meaningful user impact at
the current scale, and neither is worth holding the PR open for.

- Redaction (see #1) leaves all four of Tim's oversampled files in place, so
  a future resize pass remains safe and mechanical. Targets: roughly **2× the
  rendered width**,
  `vscode-open-folder` ≈ **580px** (it renders ~290px effective after the
  161.3% crop), and the three `controller-*` tabs ≈ **336px** each. For contrast,
  `project-layout` and `settings-resource-locations` are already correct at their
  native widths; leave those alone.
- The 1.6 MB duplication stands: nine of the ten shipped shots are still the
  comp's exact bytes, and the tenth is now redacted in both places rather than
  in one. Still repo hygiene only — no user impact — but no longer blocked on
  anything.

Blake's blast-radius note stands either way: git never shrinks a committed blob,
so the current bytes are permanent regardless. The win is in not compounding it.
| 18 | 🟢 Praise | Asset-bridge `declare global` consolidation is the right boundary move | Marcus | — | **N/A** |
| 19 | 🟢 Praise | Escape sequencing and empty-`src` degradation are both genuinely correct | Blake | — | **N/A** |
| 20 | 🟢 Praise | Web-research privacy sentence verified accurate against the implementation | Patricia | — | **N/A** |
| 21 | 🟢 Praise | Per-page media scoping — no eager decode of all six pages | Tim | — | **N/A** |

---

## Blast Radius

- 44 files changed · +2045 / −187 lines
- New files: 3 source (`WorkshopConfigureGuide.tsx`, `proseMinionAssets.ts`, `WorkshopConfigureGuide.test.tsx`) + 26 PNGs + 1 design comp
- Migrations: no · New services/handlers: none
- **10 PNGs (1.6 MB) newly shipped inside the `.vsix`**; 16 more (2.4 MB) committed to `docs/design/uploads/`
- `workshop.css` +463 lines · notice version `v2` → `v3` (re-shows the tour once per machine, by design)
- Presentation-layer PR with one host-side seam: the `WORKSHOP_NOTICE_SHOTS` asset bridge through the core barrel

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | C |
| 🛡️ Security | C |
| 🧪 Tests | C |
| 📖 Quality | C |
| ⚡ Performance | B− |
| 🎯 Domain | B |

No F: nothing here is a blocker. The C's are a cluster of "should fix before merge" items,
most of which share one root cause and one fix.

---

## Executive Briefing

🟠 **[Patricia]** **Screenshots were shot against the live setup, not a fixture** — `vscode-open-folder.png` carries an unreleased manuscript's working title in the title bar; `sidebar-settings-gear.png` shows a real OpenRouter balance. Both ship in the `.vsix` and sit in a public repo. `project-layout.png` in the same batch correctly used a staged template — the right pattern existed and wasn't applied to the rest.

🟠 **[Marcus · Parker · Stan · Sam]** 🎯🎯 **The guide's copied focus logic is an actual defect, not just duplication** — React flushes effect cleanups before setups, so the shell returns focus to the page *before* the guide captures it. Focus visibly leaves the modal and comes back on every guide round trip, and the guide's return-focus ref never holds the link the user clicked.

🟠 **[Cal · Oliver · Blake]** 🎯🎯 **"A test walks the list so it cannot half-land" is a promise the test doesn't keep** — the fake `asWebviewUri` is string concatenation. Add a name, forget the PNG: typecheck green, 1504 tests green, ships broken. One line of `fs.existsSync` closes it.

🟡 **[Oliver · Blake]** 🎯 **And if it does break, nothing anywhere says so** — `asWebviewUri` does no existence check, the `''` fallback never fires because a URI *was* resolved, and the existing global error handler is bubble-phase so an `<img>` failure structurally cannot reach it.

🟡 **[Blake]** **The PR description's "typecheck was already red" caveat doesn't reproduce** — verified clean across all three projects. Worth removing so it doesn't mislead the next reader.

---

## 🏛️ Marcus · Architecture & Design

"The Cartographer of Layer Boundaries"

### 🟠 High — Guide reimplements the focus/Escape logic the shell exists to prevent duplicating [🎯🎯 Strong Consensus]

`packages/core/src/presentation/webview/components/workshop/WorkshopConfigureGuide.tsx:84`

`WorkshopModalShell`'s own docstring states its purpose in one sentence: "Owns everything the persona/tools/context modals were duplicating — backdrop with outside-click close, Escape handling… capture the opener, focus the close button on open, return focus on close." `WorkshopConfigureGuide` hand-rolls that identical mechanism — `returnFocusRef`, `closeButtonRef`, `document.activeElement` capture, the keydown listener, and the cleanup that restores focus — the same shape as `WorkshopModalShell.tsx:39-56`. This is exactly the tech debt (`2026-07-10-workshop-browser-modal-shell`) the shell was built to close, reopened by the newest component in the same directory. The `variant="sheet"` option already renders a fixed-header/scrolling-body/docked-footer surface. If that genuinely wasn't enough for the two tall screenshots, the right move was a new `variant` on the shell, not a parallel implementation of its a11y contract.

### 🟡 Standard — Guide breaks the flat top-level-overlay composition convention

`packages/core/src/presentation/webview/components/workshop/WorkshopNoticeModal.tsx:541`

Every other Workshop overlay is mounted as a flat sibling in `WorkshopApp.tsx` with its open/close state lifted there. `WorkshopConfigureGuide` instead lives nested inside `WorkshopNoticeModal` with `guideOpen` as private state, its visibility derived from the parent's `open`. Not unworkable — the derivation is even a little clever, since the guide auto-closes if the notice does — but it's the first Workshop overlay to abandon the pattern, and a future reader looking for "how are Workshop modals composed" now has to know to look inside another modal's file for this one.

### 🟢 Praise — Asset-bridge consolidation is exactly the right shape

`packages/core/src/presentation/webview/utils/proseMinionAssets.ts:26`

Pulling the `declare global` for `window.proseMinonAssets` out of `LoadingIndicator.tsx` into one typed module, with a single accessor and a `getNoticeShotUri` that degrades to `''` instead of throwing, is the correct boundary move — it's the one place two components could have declared conflicting shapes for the same global, and now can't. Threading `WORKSHOP_NOTICE_SHOTS` through the core barrel so `webviewHtml.ts` is the only place turning names into `vscode-webview://` URIs respects the host/core split cleanly.

> *"The bones are good, but the newest room in the house rebuilt its own door hinges instead of borrowing the ones the last renovation installed for exactly this purpose."* — Marcus

---

## 🔥 Blake · Critical / Blocking Issues

"She's Been Paged for This Before"

**No blockers.** Two things she expected to be bugs turned out to be correct — see the praise finding.

### 🟡 Standard — The "cannot half-land" test never checks the PNG exists [🎯🎯 Strong Consensus]

`apps/vscode-extension/src/__tests__/application/providers/webviewHtml.test.ts:106`

This test walks `WORKSHOP_NOTICE_SHOTS` and asserts the shell contains a URI string for each name. `webview.asWebviewUri` mints a URI for any path — existing or not — and the test's `fakeWebview` just string-concatenates. Failure path: add `'foo-bar'` to the list, forget the PNG. Typecheck green, 1504 tests green, snapshot updated, ships. The writer's first screen gets a broken picture. Same for a `git rm` of an existing shot, or `.vscodeignore` drift — that file's protection is currently a comment, not an assertion. Searched both test trees for `existsSync` / `readdirSync` against `workshop-notices` — not found. Fix is one line inside the same loop.

### 🟡 Standard — Full-surface guide is opaque but not inert; Tab walks into the hidden composer

`packages/core/src/presentation/webview/components/workshop/WorkshopConfigureGuide.tsx:108`

`.pm-ws-guide` is `position: fixed; inset: 0` with an opaque background, rendered as the last sibling in the tree. It declares `aria-modal="true"` but nothing is `inert` and there's no focus trap. The guide has exactly one focusable control (Back); Tab from it continues past the guide, wraps to the top of the document, and lands on the Workshop header and composer — invisible under the overlay. Keystrokes then go into a composer the user cannot see, and Enter sends. Per Rule B: `WorkshopModalShell` has the identical gap, so this is a pre-existing convention hole, not a regression this PR introduces — downgraded accordingly. It's worse here only because a modal box leaves the backdrop visible so a lost user can see where they went; an opaque full-surface overlay does not.

### 🟢 Praise — The Escape and empty-`src` traces both hold

`packages/core/src/presentation/webview/components/workshop/WorkshopNoticeModal.tsx:429`

Two things that looked like bugs and aren't. **(1) Escape with the guide up:** the shell's effect early-returns when `open` is false, so passing `open={open && !guideOpen}` tears its keydown listener down before the guide registers its own. Exactly one Escape listener is live at any moment — no double-close. **(2) `getNoticeShotUri` returning `''`:** an empty `src` fires a *non-bubbling* error at the element, and the global handler at `webviewHtml.ts:101` is bubble-phase, so it cannot see it — which matters, because that handler does `el.textContent = 'Webview error: …'` on `#root` and would otherwise wipe the entire Workshop over one missing screenshot. "Broken picture, not a broken tour" is accurate. Also verified: all 10 PNGs are git-tracked, `localResourceRoots` resolves, CSP `img-src` covers them, the crop math (`797/1217` with `cropWidthPercent: 161.3` against a 1286×1560 source) is exactly right, and **`npm run typecheck` is clean on this branch** — the PR's "already red, out of scope" caveat does not reproduce.

> *"Nothing here pages me at 3am — but 'a test walks the list so it cannot half-land' is a promise that test doesn't keep, and I'd rather you fix the one line than find out from a screenshot in a bug report."* — Blake

---

## 🔍 Sam · Bug Hunter

"What if the list is empty, though?"

### 🟠 High — Guide round trip steals focus onto the page behind the modal, twice [🎯🎯 Strong Consensus]

`packages/core/src/presentation/webview/components/workshop/WorkshopConfigureGuide.tsx:88-99`

Traced what happens when the shell (`open={open && !guideOpen}`) and the guide (`open={open && guideOpen}`) toggle in the same render, then verified it empirically with a jest spy on an element focused before the modal ever opened.

React flushes **all** passive-effect *cleanups* for a commit before running **any** new *setups*. So when `guideOpen` flips true: the shell's cleanup fires first — `returnFocusRef.current?.focus()` — refocusing whatever had focus *before the notice modal ever opened*. Only then does the guide's effect run, capturing `document.activeElement`, which is now that background element, into its own `returnFocusRef`. The same inversion happens in reverse on close.

The spy confirms it: `opener.focus()` fires exactly once when the guide opens and once when it closes. A background element outside the dialog gets focus, transiently, on every trip through the guide. For screen-reader and keyboard users that's a real, perceptible jump out of the modal and back — and it corrupts the very return-focus chain the shell's docstring promises: the guide's `returnFocusRef` never holds "the guide link the user clicked," it holds whatever the shell's cleanup happened to refocus first. No test asserts on `document.activeElement`, so this ships invisible to the suite.

### 🟡 Standard — Media-well scroll position survives a page change it should reset for

`packages/core/src/presentation/webview/components/workshop/WorkshopNoticeModal.tsx:444`

The scrollable well (`max-height: min(56vh, 470px); overflow: auto`) wraps `<NoticeMediaWell>` directly, with no `key` tied to `index`. Confirmed via a real render that this is the *same DOM node* across a page transition — only the children swap. So if a writer scrolls partway down on a page whose figures overflow (the setup page, with two tall stacked figures, is the one the code comments admit is cramped), then pages forward, the new page's well opens at the old scroll offset instead of at the top. On a short editor window the writer can land on a notice with its lead screenshot above the fold and no affordance saying to scroll up.

> *"Found the trap door — two independently-focus-managing overlays stacked on top of each other, each dutifully returning focus to whatever the OTHER one just accidentally focused first."* — Sam

---

## 📖 Parker · Code Quality

"Code is Communication, Not Instruction"

### 🟠 High — Guide re-implements the shell's focus/Escape effect verbatim [🎯🎯 Strong Consensus]

`packages/core/src/presentation/webview/components/workshop/WorkshopConfigureGuide.tsx:84`

The guide needs a full-surface page, not the shell's boxed chrome, so it (reasonably) skips `<WorkshopModalShell>` — but then hand-copies the identical `useRef`/`useEffect`/keydown/focus-return block character-for-character; only the ref names and JSX differ. This is duplicated *knowledge*, not just duplicated text: fix the Escape or focus-return logic once in future and you must remember to fix it twice. Pull the ref setup + keydown listener + focus return into a small hook — `useModalFocusTrap(open, onClose)` returning `closeButtonRef` — and have both consume it. The shell keeps its backdrop chrome; the guide keeps its full-surface layout; neither hand-maintains the same effect. (This also fixes Sam's focus defect, since only one manager would remain.)

### 🟡 Standard — Same call-out data, two incompatible shapes

`packages/core/src/presentation/webview/components/workshop/WorkshopNoticeModal.tsx:33`

`NoticeCallout` is a proper interface with named fields. `NoticeLegendRow` — describing the legend that annotates the *same* call-outs — is `[label, term, detail]`, a positional tuple with named-element sugar that's compile-time only. Both describe "the thing a numbered call-out points at"; one reads by property, the other by position. A contributor adding a fifth legend field has to renumber a tuple; adding a fifth callout field is just another named property. Make `NoticeLegendRow` an interface too. Same information, same modal, same file — it should read the same way.

### 🟡 Standard — `guideLink.trail` is a footgun the comments apologize for instead of fixing [🎯]

`packages/core/src/presentation/webview/components/workshop/WorkshopNoticeModal.tsx:82`

The type comment admits `trail` "carries its own leading space when it needs one — otherwise a closing period lands as 'Locations .'." That's a caller contract easy to get wrong silently — a missing leading space is a visible spacing bug, not a compile error — and the two call sites now differ by eye (`' for the whole walkthrough.'` leads with a space; `'.'` doesn't), with nothing enforcing the rule. Have the renderer always insert the separating space itself and let the call site supply only trailing punctuation, so no caller can produce "Locations ." by forgetting a space. The bug is small; the fix belongs in the type and the renderer, not in a comment reminding people to type a space correctly.

> *"I had to open two files and diff them by eye to confirm the guide's Escape handler wasn't hiding a real behavior difference from the shell's — it wasn't, it was just pasted, and that's a tax every reader after me now pays too."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

"Confidence Levels, Not Coverage Numbers"

### 🟠 High — The list-walking test proves string formatting, not that the screenshot exists [🎯🎯 Strong Consensus]

`apps/vscode-extension/src/__tests__/application/providers/webviewHtml.test.ts:106`

The PR description claims this test means "adding a screenshot cannot half-land." It can't back that up: `fakeWebview.asWebviewUri` is `(uri) => \`https://webview.test${uri.path}\`` — pure string concatenation, no filesystem access. The test only proves `getWebviewHtml` emits a URI string for every name already in the list; it would pass identically whether or not the PNG exists on disk. That's precisely the failure mode the docstring above the test says it prevents. Cheap fix: `fs.existsSync` each `assets/workshop-notices/${name}.png` in the same loop.

### 🟡 Standard — The one Chromium-caught bug jsdom *could* have caught has no regression test [🎯]

`packages/core/src/presentation/webview/components/workshop/WorkshopNoticeModal.tsx:326`

The trailing-period bug ("Locations .") is exactly the class of thing `@testing-library` text assertions catch without a layout engine. Every test touching `guideLink` locates the button with a loose regex and never asserts the surrounding paragraph's full text. Nothing pins `<p>` textContent to `"Project-file reading depends on the paths set in Project Resource Locations."` A future edit to `trail` reintroducing a leading space would regress silently — no test in the suite would go red.

### 🟡 Standard — Guide round-trip tests never exercise the boundary page

`packages/core/src/__tests__/presentation/webview/components/workshop/WorkshopNoticeModal.test.tsx:158`

Both round-trip assertions drive through Notice 2 (index 1). The other entry point — Notice 6, the last page (index 5) — is exercised only to check the guide opened; it never clicks "Back to the tour" and asserts the pager lands back on `6 / 6`. Off-by-one bugs in a `PAGES.length - 1` boundary or an index-reset effect are exactly what hides at the last element and passes at an interior one. One added assertion in the existing test, not a whole new one.

> *"Two round-trips through the middle of the tour and zero at the edges — the boundary is always the one nobody clicked back from."* — Cal

---

## 🗂️ Stan · Codebase Standards

"He Has Every Pattern Memorized"

### 🟠 High — The guide hand-rolls the chrome `WorkshopModalShell` exists to own [🎯🎯 Strong Consensus]

`packages/core/src/presentation/webview/components/workshop/WorkshopConfigureGuide.tsx:84`

Ten modals in this directory import `WorkshopModalShell` — `WorkshopChooseHostModal`, `WorkshopConfirmDialog`, `WorkshopInviteGuestModal`, `WorkshopConversationBehaviorModal`, `WorkshopSaveSessionModal`, `WorkshopTextSheet`, `WorkshopWidgetsModal`, `WorkshopToolsModal`, `WorkshopSessionBrowserModal`, and `WorkshopNoticeModal` itself. That shell exists *specifically* to resolve tech-debt `2026-07-10-workshop-browser-modal-shell`, filed because the persona/tools/context modals were duplicating this effect. `WorkshopConfigureGuide` is the only overlay in the directory that reproduces it instead. The stated reason ("shrinking into a modal box makes it unreadable") argues against the shell's *backdrop-box sizing*, not against reusing its focus/Escape logic — and the shell already has a `variant` prop (`'panel' | 'sheet'`) for exactly this kind of layout fork.

### 🟡 Standard — The preserved `proseMinonAssets` typo cuts against the alpha no-compat policy

`packages/core/src/presentation/webview/utils/proseMinionAssets.ts:26`

CLAUDE.md's Alpha Development Guidelines are explicit: "Remove Dead Code Aggressively," "Breaking Changes Are Free," don't keep things "for backward compatibility." This PR touches every call site of `window.proseMinonAssets` to centralize the bridge — the exact opportunity to fix the spelling in one pass. The justification in the file comment ("renaming would break any webview loaded from a cached HTML shell") doesn't hold up against how the surface is built: `getWebviewHtml` regenerates the full HTML string, including the global stamp, fresh on every panel creation. There's no persisted shell to go stale. Worth a one-line follow-up rename rather than a permanent apology comment.

### 🟢 Nit — Barrel omits the notice constants' siblings

`packages/core/src/index.ts:27`

This PR adds a named-export block for `workshopNotices.ts` but re-exports only the two symbols it just introduced, leaving the pre-existing `WORKSHOP_STARTUP_NOTICE_VERSION` and `WORKSHOP_STARTUP_NOTICE_DISMISSED_KEY` un-barreled. Since `index.ts`'s own doc rule is "NAMED re-export so the public API is visible at a glance," touching this file was the natural moment to surface the other two.

> *"We have a whole shell class built to stop exactly this kind of hand-rolled dialog chrome — it's sitting right there in the same folder, one import away, and this component walked past it anyway."* — Stan

---

## ⚡ Tim · Performance

"O(n²) at Scale is an Incident Waiting to Happen"

### 🟡 Standard — ~770 KB of the shipped payload is 2–2.3× oversampled for its display size

`packages/core/src/presentation/webview/components/workshop/WorkshopNoticeModal.tsx:139`

Did the displayed-vs-source math on the worst offenders:

- `vscode-open-folder.png` — 454 KB at native **1286×1560**, rendered in a figure box of `maxWidthPx: 180` with `cropWidthPercent: 161.3`, so on-screen width is ~290px. Even at a generous 2× retina budget that needs ~580px of native resolution — it ships **2.2× more linear resolution (≈4.9× the pixels)** than any display can use, and it's the largest file in the set.
- The three Conversation Controller thumbnails (130 + 104 + 85 KB = 319 KB) render inside `.pm-ws-notice-thumb { max-width: 168px }`. A 2× budget needs ~336px native; these ship at 2.1–2.3× that.

Resized to a real 2× target, those four land near 20% of current weight — roughly **550–600 KB off**, ≈35% of the whole asset set, with no visible quality loss. **Contrast:** `project-layout.png` and `settings-resource-locations.png` (44% of the total weight) are *not* part of this — they render at ~500–595px panel width, almost exactly a correct 2× fit for their native width. Their weight is genuine detail, not oversampling; don't lump them in.

**Does it matter at current scale?** For one extension install, 600 KB won't move anyone's day. But it's a free mechanical win (`sips`/`oxipng`, no design re-pull) sitting right next to a shipped-asset decision this PR already made deliberately — worth doing before merge because it's cheap, not worth blocking on for the same reason.

### 🟡 Standard — The 10 shipped PNGs are byte-identical duplicates already in `docs/design/uploads/`

Ran `shasum` across both directories. All ten match a SHA-1 in `docs/design/uploads/` exactly — not near-duplicates, the same bytes renamed:

```
9d80443a…  sidebar-settings-gear.png        == Screenshot 2026-07-27 at 1.46.23 PM.png
d2674ecc…  header-cluster.png               == Screenshot 2026-07-27 at 12.02.06 PM.png
e7319b50…  talking-to-rail.png              == Screenshot 2026-07-27 at 12.02.15 PM.png
960ad41e…  composer-controls.png            == Screenshot 2026-07-27 at 12.02.37 PM.png
fa9d180a…  settings-resource-locations.png  == Screenshot 2026-07-27 at 12.05.25 PM.png
facea67e…  vscode-open-folder.png           == Screenshot 2026-07-27 at 12.06.02 PM.png
69c7269c…  project-layout.png               == Screenshot 2026-07-27 at 12.25.15 PM.png
d64ebb7d…  controller-about-you.png         == Screenshot 2026-07-27 at 12.48.45 PM.png
8fd0474f…  controller-advanced.png          == Screenshot 2026-07-27 at 12.49.00 PM.png
4c1aa457…  controller-behavior.png          == Screenshot 2026-07-27 at 12.51.13 PM.png
```

`docs/design/uploads/` isn't gitignored, so this PR commits the same ~1.6 MB twice. Git history never shrinks a committed blob without a rewrite, so that's permanent weight on every future clone. Doesn't affect the `.vsix` or any user — pure repo hygiene — but it compounds every time a design drop lands this way, and the fix is nearly free right now.

### 🟢 Praise — Per-page media scoping, and the churn concerns genuinely don't apply

`NoticeMediaWell` receives `page.media` — the active page's entries only — so switching pages unmounts the previous page's images. No eager decode of all six pages, and no `loading="lazy"`, correctly: these are disk-backed `vscode-webview://` URIs, decode is single-digit ms, and only one page is ever in the DOM. Re-render churn is gated behind user clicks on a 6-page dataset — not a hot path. The +463 CSS lines gzip to a few KB. All noise at this scale.

> *"Four files are burning 2× more pixels than any screen will show — resize them, and the other 44% of the payload, already sized exactly right for retina, tells you the difference between weight and waste."* — Tim

---

## 🛡️ Patricia · Security

"She Reads Code Like an Attacker Would"

### 🟠 High — Shipped screenshots were captured against the live setup, not a scrubbed fixture

`apps/vscode-extension/assets/workshop-notices/vscode-open-folder.png`

> **Orchestrator's note on severity:** Patricia filed this as 🔴 Blocking. I verified both images directly and the observations are factually correct — but I've adjusted it to 🟠 High. This is Okey's *own* manuscript title and his *own* trivial account balance: not third-party PII, not a credential, no exploit path. It's a judgment call about what he wants permanently attached to a public Marketplace listing, not a policy breach. It leads the briefing because publishing is irreversible, not because it's a security hole.

`vscode-open-folder.png` — shipped inside every installed `.vsix` and committed in the clear to a public repo — shows the VS Code title bar reading `…-the-heart-parchment-chronicles — The Boo[k…]`, a real and presumably unpublished manuscript's working title, along with the project's folder tree (`ToDo`, `Writing-Theory-and-Technique`, `.clineignore`, `AGENTS.md`). Those folder names match, item for item, the glob values visible in `settings-resource-locations.png`, which confirms both were captured live against a real active project rather than a staged fixture.

What makes this worth acting on: a *different* screenshot in the same batch, `project-layout.png`, deliberately uses a staged `PROSE-MINION-BOOK-TEMPLATE` fixture. The correct pattern existed and was applied to one shot but not the others. Nothing in CI inspects screenshot content, so no test catches this class of thing.

**Recommend:** re-shoot `vscode-open-folder.png` (and any other shot sourced from the real project) against the template fixture before merge. Note that a public-repo commit isn't un-disclosed by amending — but you can at least stop compounding it in the published package.

### 🟡 Standard — A shipped screenshot discloses a live OpenRouter balance

`apps/vscode-extension/assets/workshop-notices/sidebar-settings-gear.png`

Shows the sidebar header reading `OpenRouter · $1.09`, read live from a real account. A minor dollar figure, not a secret — but it's a real financial detail tied to an actual account, permanently baked into a public artifact, and part of the same "captured against the daily driver" pattern rather than an isolated slip. Re-shoot against a throwaway key or a mocked balance.

### 🟢 Praise — The web-research privacy disclosure holds up against the implementation

`packages/core/src/presentation/webview/components/workshop/WorkshopNoticeModal.tsx:220-225`

Traced the retained sentence against `AssistantToolService.workshopWebSearchTools()` (attaching `type: 'openrouter:web_search'`) and `OpenRouterClient` (a single POST to `/chat/completions` with `tools` in the body). The claims check out: there's no direct third-party search call bypassing OpenRouter, and the one request already carries the assembled system prompt, persona and writer-profile context, any pinned excerpt, and retained history. So "search queries may use active room context and run through OpenRouter and search providers" is accurate, not overstated. Good call keeping this when the comp dropped it — it's the one piece of copy in this PR doing real information-security work for the user, and it survived the re-pull with a pinned test.

> *"The disclosure copy passes the read; the screenshots don't — a Marketplace install isn't the place to leave your working title on the file menu."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

"Would This Failure Leave a Trail at 2am?"

### 🟡 Standard — A broken `<img>` leaves no trail anywhere [🎯]

`apps/vscode-extension/src/application/providers/webviewHtml.ts:101`

Traced the full path from a PNG missing at package time: `asWebviewUri` mints a URI regardless of whether the file exists (no disk check — `grep -rn existsSync` across the providers and asset code returns nothing), the host stamps it into `noticeShots`, `getNoticeShotUri` returns it (the `''` fallback never fires, because a URI *was* resolved), and the `<img>` 404s.

That failure is invisible end to end: **(1)** resource-load errors fire at the element and do not bubble, so `window.addEventListener('error', handler)` with no third argument — bubble-phase only — structurally cannot see it, even though it's already wired to forward to the Output Channel via `WEBVIEW_ERROR`; **(2)** no `<img>` in either new component has an `onError`; **(3)** nothing writes to the Output Channel. A user reporting "the tour looks weird" gives the developer literally nothing — not even the loud path this codebase already built for other webview errors.

Cheap to close: a capture-phase listener (`addEventListener('error', handler, true)`) or a per-image `onError` posting the failed shot name through the `WEBVIEW_ERROR` channel already wired up.

### 🟡 Standard — The "cannot half-land" test doesn't cover the scenario it's cited for [🎯🎯 Strong Consensus]

`apps/vscode-extension/src/__tests__/application/providers/webviewHtml.test.ts:106`

The test never touches the filesystem, so it can't detect a PNG missing via `.vscodeignore` drift, a rename, or a packaging change. Confirmed the current 10 files on disk match the 10 names exactly — so today the sets agree, but nothing enforces that going forward, and this is precisely the undiagnosable case above: a URI still resolves, the test still passes, and the break shows up only as a silent 404 in a shipped `.vsix`.

> *"The tour pages past a broken picture without a sound — and the one error listener we built for this can't hear it either. See you in the incident retro."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

"Does This Code Actually Do What the Ticket Asked?"

### 🟡 Standard — The two deliberate deviations are protected very unequally

`packages/core/src/presentation/webview/components/workshop/WorkshopNoticeModal.tsx:136`

The author names two intentional departures from the comp. **Deviation 1** (Notice 4 keeps the web-research privacy sentence) is fenced three ways: a sprint-spec amendment bullet, a `docs/design/README.md` "Notice-copy reconciliation" section reading "do not 'fix' the delta in either direction," and a dedicated test asserting `/comfortable sharing/`. **Deviation 2** (`maxWidthPx: 180`/`340` against the comp's `216`/`400`) is recorded nowhere but an inline code comment — grepped the sprint amendment and the README's design-drop bullets, neither mentions it; grepped the test file for `180`/`340`/`maxWidthPx`, no hits.

The README itself frames re-pulls as a live risk ("Update the remote design when convenient"). When that happens, deviation 1 is fenced by a failing test; deviation 2 has nothing stopping someone from "fixing" it back to the comp's wider values and silently reintroducing the scrolling problem the page was narrowed to avoid. Intentional asymmetry, or should it get the same treatment as its sibling?

### 🟢 Nit — "Fill in one glob per field," but three of eight rows have two

`packages/core/src/presentation/webview/components/workshop/WorkshopConfigureGuide.tsx:50`

`FIELD_PATTERNS` gives `Draft Chapters & Outlines`, `Project Brief Materials`, and `General References` two comma-separated globs each, and the very next line of body copy correctly says "Comma-separate multiple patterns" — so the mechanism is documented, but the step's title reads singular and undersells that three of the eight rows in the table right below it are two-pattern examples. A first-run walkthrough is exactly the copy where "field" vs. "pattern" precision saves a support question.

> *"One deviation got a doc note, a README essay, and a test with its name on it; the other got a comment and a prayer — technically documented, correct that it's not documented equally."* — Bria

**Verified accurate** (orchestrator): the "fourteen analyses" count matches `WORKSHOP_TOOL_CATALOG` exactly (14 entries), and all three models named in Notice 3 — Gemini 3.6 Flash, GPT-5.6 Terra, GPT-5.6 Sol — exist under those exact names in `OpenRouterModels.ts`.

---

## 🎓 Sensei · The Teacher

"The Review Is the Lesson. The Code Is the Practice."

### Lesson 1 — You Cannot Decline an Abstraction Partway; Name the Axis You're Rejecting

Illuminated by: Marcus, Stan, Parker, Sam

`WorkshopModalShell` was built to own exactly one thing across eleven overlays — focus capture, Escape, focus return — and the guide walked away from all of it because *one* thing didn't fit: the box sizing. When a shared component almost works, the instinct to reimplement is really a failure to name which axis is wrong; had the sentence been "the shell's layout doesn't fit" rather than "the shell doesn't fit," the answer would have been the `variant` prop that already existed. And note what Sam found: two components owning the same invariant don't merely drift over time, they fight *immediately* — React's cleanup-before-setup ordering turned two correct focus implementations into one visibly broken one. Duplicated knowledge isn't always a debt that comes due later; sometimes it's a defect that ships today.

→ Carry forward: Before copying logic out of a shared component, finish this sentence out loud: *"I'm opting out of its ______."* If the blank is narrower than the whole component — and it usually is — the work is a parameter, not a fork.

### Lesson 2 — A Question That Cannot Return "No" Is Not a Question

Illuminated by: Cal, Blake, Oliver

Two different mechanisms here were believed to be watching for a missing screenshot, and neither is structurally capable of noticing. The test walks the shot list and asserts a URI appears — but the fake `asWebviewUri` is string concatenation, so it asks the code to confirm its own arithmetic and can never answer "the file isn't there." At runtime the same blindness repeats: `asWebviewUri` mints URIs for nonexistent paths, the `''` fallback never fires because a URI *was* produced, and the global error listener is bubble-phase so an `<img>` failure can't reach it. Every layer keeps its own narrow promise; nobody promised there is a picture.

→ Carry forward: For any check you're about to trust, ask *"What would have to be true in the world for this to fail?"* If the only possible answer is "nothing outside this process," you have a mirror, not a test — and the same question works on runtime guards.

### Lesson 3 — The Eye Finds It; Only a Test Remembers It

Illuminated by: Cal, Parker, Blake

Rendering all six pages in Chromium was excellent practice and caught three bugs no unit test could see — that's exactly what manual verification is *for*. But manual verification is a discovery instrument, not a retention one; it finds the bug once and then forgets it forever. One of those three, the "Locations ." trailing period, was well within jsdom's reach and left the PR with no assertion pinning it. The deeper note: an API whose type comment has to apologize for a footgun ("remember your leading space") is telling you the footgun belongs in the code, not the comment.

→ Carry forward: After every bug you catch by eye, run a two-second triage — *"could a cheap automated check have held this?"* If yes, write it before you move on. And when a doc comment starts explaining how to avoid misusing an API, treat that sentence as a bug report against the API's shape.

### Lesson 4 — Irreversible Outputs Deserve a Different Checklist

Illuminated by: Patricia, Tim

Most mistakes in software are cheap because they're revocable — edit, redeploy, gone. Screenshots committed to a public repo and packaged into a `.vsix` are not that: a manuscript's working title and a live balance are now in git history and on every installed copy, and the duplicated 1.6 MB will sit in the object store forever whether or not the files are deleted tomorrow. What makes this worth sitting with is that the correct pattern was *already in the batch* — `project-layout.png` used a staged fixture. This wasn't missing knowledge; it was a missing checkpoint at the one boundary where the cost of being wrong doesn't decay.

→ Carry forward: When a change crosses a one-way door — public repo, published package, anything binary — ask two questions: *"What is in the frame besides the subject?"* and *"If this is wrong, can I actually take it back?"* Then apply the strictest rule in the batch to every item in the batch.

### Lesson 5 — A Written Rationale Has an Expiration Date

Illuminated by: Bria, Blake, Stan

Three artifacts here assert facts that are no longer, or never were, true: the caveat that typecheck was already red (it passes clean), the comment defending `proseMinonAssets` because renaming "would break a cached HTML shell" (the shell is regenerated on every panel creation), and two deliberate deviations protected in wildly asymmetric ways — one fenced by a spec amendment, a README section, and a test; the other resting on an inline comment. Prose captures the *reasoning* at a moment; it doesn't re-check its premise, and it doesn't resist the pressure that will eventually push against it. Comments and PR notes age into confident-sounding fiction — which is precisely why a test is a better fence than a paragraph.

→ Carry forward: When you write "because X" in a comment or PR description, verify X right then — and ask what force will push against this decision later, and whether your protection is proportional to it. If the README says a design re-pull is coming, an inline comment is not a fence.

> *"Nothing here failed loudly, and that is the whole review — the code kept every promise it made to itself, and you were the only one in the room expecting it to make promises to the reader."* — Sensei

---

## The Closer

### 🎬 Movie tagline

> In a world where every control had a name but no face…
> one modal dared to show the writer where to click.
> It brought pictures. It brought call-outs. It brought a legend.
> It also brought your manuscript's title to sixty thousand strangers.
>
> **THE TOUR** — this summer, look before you shoot.

---

## Summary

This is careful, well-argued work — the kind of PR where the description does real reviewing
for you, the tricky parts (Escape sequencing, empty-`src` degradation, crop math, the retained
privacy sentence) hold up under scrutiny, and the manual Chromium pass caught three real bugs.
No blockers. Two reviewers went looking for landmines and came back with praise instead.

What the panel converged on is narrower than it looks: **one duplication that turned into a
real focus defect, one test that promises more than it checks, and one batch of screenshots
shot against a live machine.** The first two share a fix apiece — extract the focus effect into
a hook both overlays consume; add one `fs.existsSync` line to the existing loop. The third is a
re-shoot against the template fixture that's already used elsewhere in the same batch.

Nearly there. Land items 1–3, take Tim's free 600 KB while you're in there, and the rest can
follow as their own cleanup commits.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
