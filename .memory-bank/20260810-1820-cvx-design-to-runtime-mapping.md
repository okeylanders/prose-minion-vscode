# Creative Variations — Design Comp → Sprint 03 Runtime Mapping

**Date:** 2026-08-10
**Author:** Fable-Ada (design sync + presentation workstream)
**Branch:** `fable/s03-creative-variations-design` (from `e02e7702`)
**Design sync commit:** `d281a808` — `docs(design): sync Creative Variations Explorer comp`
**Status:** Waiting at the Phase B contract gate — Codex-Ada's Creative
Variations contract commit (`shared/types/messages/workshop/creativeVariations.ts`
et al., runway Slice 2) does not exist on any branch yet.

Behavior truth: [Sprint 03](../.todo/epics/epic-conversation-widgets-2026-07-22/sprints/03-creative-variations.md)
and the [implementation runway](../docs/architecture/2026-08-10-creative-variations-implementation-runway.md).
The comp (`docs/design/Prose Minion - Creative Variations Explorer.html` +
`pm-cvx.css` + `pm-cvx.js`) is design evidence only.

## Prototype states inventoried

| # | Comp state (mount) | What it shows |
|---|---|---|
| 1 | `cvxStage` live flow | Jill recommend → prefilled open (`banner:'seed'`) → generate → keep → commit → chip → clone reopen (`banner:'clone'`) |
| 2 | `cvxPaste` | Input state with pasted provenance: amber `pasted · no surrounding passage` pill + honest no-context copy |
| 3 | `cvxOpen` (`dist:3`) | Open sampling dial at Far tail; four named distances with p-band subtitles + explanatory line |
| 4 | `cvxBound` | Bound four-menu frame (pressure / narrative distance / carrier / commitment) |
| 5 | `cvxMenu` | Generated workup: 5 cards, 2 kept (`o3`,`o4`), `o4` carried as direction, one flag accepted, comparison open, note filled |
| 6 | `cvxDup` (`dup:true`) | Collapse failure: low set-distinctness bar, amber pair warning, **Regenerate the pair** |
| 7 | Committed chip | `Creative Variations · 2 kept · 1 as direction · re-open` |

## Mapping: keep / adapt / reject

### Kept from the comp (visual + interaction language)

- Modal shell posture, eyebrow (`one-shot · thread-artifact` rail badge), title
  block, and the "comparison studio, not a rewrite button" subtitle stance.
- Two-column body: passage left; `Must survive` (required) and
  `Must not change` (optional) right.
- Provenance pills: green `from excerpt · <label>` vs amber
  `pasted · no surrounding passage`, plus the honest-context caption under the
  passage. Display-safe only (relativePath + optional line bounds, or pasted).
- Distance control: four named steps `Familiar / Adjacent / Tail / Far tail`
  with p-band subtitles and the per-distance explainer line. Default **Tail**.
- Count control: exactly 3 / 4 / 5 with the "a cloud is not a comparison" caption.
- Card grammar: checkbox + named approach + word count, prose body,
  gains/costs tradeoff, footer with flags and carry control revealed on select.
- Carry control: per-selected-card `direction / prose` pill pair (defaults
  flipped — see rejects).
- Comparison tray: kept cards side by side with `must survive` pinned above.
- Payload strip: "What commits" projection + character ceiling + meter, with
  the honest empty line ("nothing kept yet — commit stays off…").
- Note to the room (optional input).
- Banners as prop-driven variants: `seed` (persona prefill — Slice 6 wiring),
  `clone` (reopened from chip; commit button reads "Commit as new turn"),
  `paste` (no-context honesty).
- Generate → busy → "Regenerate the workup" ghost-button progression.

### Adapted (comp shape kept, semantics corrected to the locked contract)

| Comp | Locked behavior | Presentation consequence |
|---|---|---|
| No custom aim field exists in the comp | Required custom aim (D1) | Add an aim field (comp's `cw-field` styling); generation unavailable with an accessible reason while blank |
| Per-card fixture `distinct 0.81` scores | Pairwise **textual overlap** matrix + maximum pair; never similarity/quality/rank | Replace per-card score chips with pairwise overlap evidence; copy says "textual overlap" and never implies meaning |
| Set-distinctness bar = fixture **average** | Maximum pair reported, never an average (runway §2.5.7) | Strip shows the maximum-overlap pair; high overlap warns without hiding/ranking/removing |
| One flag per card, single toggle, rides only when carry=prose | Typed flags: `advisory-risk` needs per-risk acceptance (rides in **either** carry mode); `hard-conflict` (vs `must not change` only) is commit-ineligible | Flags render as a list; per-risk accept affordance; hard-conflict card visibly blocked from commit with reason, never hidden |
| POV shown as a standalone pill control | No POV field in the contract; hard boundaries live in `must not change` | POV pill dropped as a control; it was fixture copy |
| Payload omits `must not change` | Both declared invariant fields project (runway §3.1) | Payload strip shows both fields |
| Cancel button closes the modal | Idle / generating / **cancellable** / failed / generated are distinct states | Cancel-generation is its own action during the generating state; failure state gets a drawn presentation (comp lacks one — reuse the amber warn pattern) |
| Copy is promised in annotations but no button exists on cards | Full-variation copy action required | Copy button per card (semantic callback; clipboard is the host's job) |
| Client-side `CVX_CEIL=700` count | Budgets are host-owned calibration constants (Slice 2/3) | Meter renders from typed props; no constant duplicated in components |

### Rejected (prototype behavior that contradicts the locked contract)

1. **Bound frame mode + mode tabs** — D1 locks one open aim + verbalized
   distance for the first release. No mode tabs; no four-menu frame.
2. **Partial pair regeneration** ("Regenerate the pair") — out of scope;
   whole-workup regeneration only, which atomically clears selections, carry,
   and acceptances (controller/handler concern, not presentation).
3. **Prose as default carry** — locked default is **direction**; full prose is
   an explicit per-card promotion (D2).
4. **Fixture data and fake timers** — passages, cards, scores, the 1s busy
   simulation, and prototype state management do not port.
5. **Report-prefill banner** (`banner:'report'`) — report handoff is
   explicitly deferred.
6. **"distinct"/"similar" vocabulary** — replaced by "textual overlap"
   evidence language throughout.
7. **Accepted-flag-rides-only-with-prose rule** — accepted advisory risks ride
   in either carry mode.

## Presentation-ownership notes for Phase B

Components (`WorkshopCreativeVariationsModal` / `CreativeVariationCard` /
`CreativeVariationsComparison` + `creativeVariations.css`) stay controlled:
typed props + semantic callbacks only; no `useVSCodeApi`, `postMessage`,
`MessageType`, storage, editor writes, correlation, or commit rules. No generic
`VariationExplorer`. Workshop tokens replace `pm-mock.css` custom properties;
existing focus-visible and reduced-motion conventions apply; comparison
degrades to stacked columns on narrow widths.

## Gate status

Phase B begins only after rebasing/merging Codex-Ada's contract commit. Do not
invent a second persisted schema or local draft types in the component
directory.
