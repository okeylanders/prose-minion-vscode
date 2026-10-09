# Show vs. Tell — Slice 7 Handoff (design edits D1–D4)

**Date:** 2026-10-09 21:00 UTC

**Branch:** `epic/conversation-widgets-sprint-05-slice-7-design-edits`, cut from
`epic/conversation-widgets` at `16320d6` (the Slice 6 merge). One PR into the
epic. Not merged.

**Sprint:** [Sprint 05 — Show vs. Tell](../.todo/epics/epic-conversation-widgets-2026-07-22/sprints/05-show-vs-tell.md),
section "Design edits (writer decisions, 2026-10-09)".

**Previous:** [Sprint 05 complete (Slice 6)](20261009-1915-show-vs-tell-sprint05-complete.md)

**Current gate:** Slice 7 is ready for review. It is the writer's post-testing
revision of the authoring sheet; nothing in the commit rail, the chip, or the
recommendation registry mechanics changed shape beyond what D2 and D3 require.

## What landed

Three code commits, each green on its own, then this docs commit.

1. **Host (D2–D4).**
   - `WorkshopShowVsTellSurroundingContext` is `{ writerText, sourceReferences }`,
     mirroring Creative Variations. `showVsTellSourceReferences` 1 → 8; new
     `showVsTellRecommendationContextCharacters` 20,000. Both pinned in
     `promptBudgets.test.ts`. The aggregate frame ceiling stays 51,500 (it is
     the largest single frame, Creative Variations'); Show vs. Tell's own
     frame is now 25,700 and pinned.
   - Codec: writer text ≤ 250,000; references 0–8; blank must survive and
     zero channels accepted. Integrity: references unique **and canonical**
     (excerpt first, then attachments by `ctx-N` ordinal). The comparator
     `compareShowVsTellSourceReferences` lives in `ShowVsTellDerivations`
     (webview-safe) and is shared by integrity, the controller, and the
     recommendation parser.
   - Service: the writer text plus every resolved source is bounded by the one
     context allowance and both travel to the model as
     `surroundingContext.{writerText, resolvedSources}`.
   - Artifact: `must survive:` omitted when blank. Line keys unchanged;
     585 ≤ 600 is now the maximum case.
   - Recommendation: `surrounding-context` tag (already reserved) between
     `chip-subject` and `source-references`; `must-survive` optional; up to 8
     references in any order, stored canonically; Blocks A and B verbatim.
     Instruction length 12,523 → 13,098 (pinned).
   - **Checkpoint repair** `defaulted-widget-show-vs-tell-surrounding-passage-text`
     (see below).
2. **Prompt bundle.** `00-show-vs-tell.md` names `writerText` beside the
   resolved sources and reads them as one passage; a blank `mustSurvive`
   declares no invariant and the model invents none; an empty `channels` list
   means no emphasis, choose freely and vary across variants, and two variants
   in a group should not share a channel set. Prompt-sync tests pin each
   sentence in `ShowVsTellPromptExample.test.ts`.
3. **Webview (D1, D2, D4).**
   - Layout: beat → [POV + must survive (optional pill) + must not change |
     channels + length budget] → full-width Surrounding passage text box with
     Use excerpt / Use selection, a `N / 250,000 chars` counter, and an honest
     truncation notice → full-width Context checkboxes → continuum.
   - New selection target `workshop_show_vs_tell_passage`, routed through
     `dispatchWorkshopSelectionData` and `useWorkshopAppMessageRouter`.
   - Controller API: `toggleSourceReference` replaces `selectSourceReference`;
     new `changePassageText`, `usePassageFromExcerpt`,
     `requestPassageSelection`, `handlePassageSelection`, `passageNotice`,
     `canUsePassageFromExcerpt`. Generate blocker `must-survive-required` is gone.
   - Size: `useShowVsTellIntake` (beat + passage intake, source toggles),
     `showVsTellSourceRules` (pure passage/source/blocker rules), and
     `ShowVsTellSheetHeader` keep the controller (497), rules (363), and modal
     (473) under 500. `ShowVsTellConstraintsPanel` holds POV + invariants;
     `ShowVsTellSurroundingPanel` holds the passage box and the context list.
   - Channels: no lock, no `aria-disabled`, no dimming; a "No emphasis" hint
     shows at zero; the POV-constraint hint stays.

## The checkpoint normalization

Okey's saved sessions hold Show vs. Tell drafts in the pre-Slice-7 shape:
`surroundingContext: { sourceReferences }` with no `writerText`, at most one
reference, must survive non-blank, at least one channel. D3 and D4 only relax
rules, so that data is valid under them. D2 adds a required field, so the
Show vs. Tell codec's `normalizeShowVsTellDraftForHydration` now accepts the
old shape at the checkpoint boundary (`assertShowVsTellDraftCheckpointShape`
makes `writerText` optional), fills `''`, names the repair
`defaulted-widget-show-vs-tell-surrounding-passage-text`, and re-asserts the
strict current shape before cloning. The persistence coordinator logs the
name with the other normalizations. The strict write boundary emits the
current shape only, so a second hydration repairs nothing (tested).

It is **not** a version migration (ADR 2026-07-30): the Slice 1–6 shape never
shipped on the Marketplace, so `schemaVersion` is unchanged and no released
codec migration was added. The seed's new `contextText` is optional, so a seed
saved before Slice 7 needs no repair (tested).

Fixtures: `ShowVsTellConfigCodec.test.ts` (repair at the codec),
`ShowVsTellPersistence.test.ts` (session hydrate, named normalization, no
re-repair), `WorkshopRoomHandler.showVsTellMatrix.test.ts` (hydrate an
old-shape save, reopen the config, clone-recommit through the real route),
`ShowVsTellRecommendationPersistence.test.ts` (old-shape seed round-trips with
no Show vs. Tell repair).

## Design judgment calls

- **Where channels and budget landed.** Beside the constraints in the existing
  two-column intake grid (constraints left, channels + budget in the 272px
  right column), above the full-width passage. D1 fixed the order of the
  constraints, passage, and context; the design reference's sheet keeps a
  narrow right column, and the chips read best next to the POV field whose
  constraint their interiority sub-label repeats.
- **The beat highlight.** Dropped. A `<textarea>` cannot carry a `<mark>`, and
  an overlay that mirrors the text would be a second source of truth. The
  panel's pill now says what the passage does (`grounds generation · never
  rides the commit`) instead of where it came from.
- **Canonical reference order enforced, not just uniqueness.** The brief said
  "unique and canonically ordered, as Creative Variations does"; Creative
  Variations only rejects duplicates. Enforcing the order at integrity gives a
  selection one persisted representation and makes `toEqual` assertions
  honest. The controller sorts on toggle and the parser sorts on accept, so a
  writer or a persona can click or list in any order.
- **Use excerpt copies text; it does not tick the excerpt as a source.** The
  two are different inputs (text the writer can edit versus a reference the
  host resolves live), and mixing them would double the excerpt in the prompt.
- **Passage intake drops while an attempt is in flight**, as beat intake
  already did, and during a pending commit (Slice 4, F-01). Typing in the box
  still cancels an attempt like any generation input.
- **Lint.** +3 warnings (1,115 vs the 1,112 baseline): the two new component
  constants (`ShowVsTellConstraintsPanel`, `ShowVsTellSheetHeader`) and the
  `PmLogo` mock in the new full-app test. Each is the same naming-convention
  warning every sibling component and full-app test already carries.

## Verification

- `npm run typecheck`: core, webview, ext clean.
- `npm run lint`: 0 errors, 1,115 warnings (baseline 1,112; see above).
- `npm test`: **298 suites / 4,247 tests / 2 snapshots, all passing**
  (Slice 6: 296 / 4,190 / 2).
- `npm run build`: compiled; `verify-bundle` OK.
- `git diff --check`: clean.
- `grep -rn "from 'vscode'" packages/core/src`: no source hits.

## Open follow-ups

- The live-provider quality pass and the interactive smoke test filed at Slice
  6 still stand; the zero-channel "vary across variants" instruction is the
  newest prompt rule with no live run behind it.
- A rendered screenshot of the new layout (production bundle, headless
  Chromium, VS Code API stubbed) is at
  `.todo/epics/epic-conversation-widgets-2026-07-22/sprints/assets/05-show-vs-tell-slice7-sheet.png`
  and linked from the PR body. It is not an Extension Development Host run;
  the interactive smoke test is still open.
