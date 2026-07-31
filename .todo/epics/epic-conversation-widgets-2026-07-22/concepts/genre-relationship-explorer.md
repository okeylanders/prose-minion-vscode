# Concept Spring: Genre Relationship Explorer

**Status**: Concept spring
**Priority candidate**: Medium
**Classification**: Conversation Widget (chapter-scale exploration surface)
**Likely rail**: One-shot thread artifact **+ optional standing influence** (the
pin nests inside the commit — see [Bring + Pin](#bring--pin-the-position-as-a-standing-influence))
**Depends on**: Widget host + Gesture Playground (Sprint 01); the standing rail
from Lexical Gravity (Sprint 02) for the pin
**Design source**: `Prose Minion - Genre Relationship Explorer.html` — Spread 09
(remote only; not pulled into `docs/design/`)

## Product idea

**Genre Relationship Explorer** holds a whole chapter against its shelf-neighbors.
The writer surveys which genres the chapter is already in conversation with,
picks one, and derives the relationship: where the chapter **matches**,
**departs from**, and **subverts** that genre's expectations, each anchored to a
verbatim span with a paragraph address.

It is [Topic Relationship Explorer](topic-relationship-explorer.md) one scale up
— same rail, same dossier grammar, same span discipline — with two changes that
the scale forces.

**The load-bearing sentence: the dossier grades resemblance, never quality.**
*Departs* is not a deficiency and *matches* is not a grade. "Failing a genre" is
a sentence this surface cannot construct.

## What the scale changes

**1. The lifecycle grows a step.** A `genre-survey` call proposes 3–6 candidate
genres; the writer then chooses which to `genre-dossier`. One call per genre,
cached for the session, so clicking back to a derived genre is free.

**2. Every tell is two-sided.** The genre's **expectation** (a claim about a
population of books — no address, and it never pretends to have one) against the
chapter's **evidence** (a verbatim span + ¶ address, checked). The card renders
that asymmetry instead of flattening it: the expectation side is dashed and
unchecked, the evidence side solid and verified. **That asymmetry is the honesty
design of this widget.**

## Inputs

- **The chapter is a source card, not an input.** Every prior widget carried its
  text in a textarea; six thousand words don't fit in a panel and shouldn't
  pretend to. The chapter stays on the desk and the card states the consequence:
  every claim comes back with a ¶ address.
- **No posture control.** A topic can meet a passage three ways; a genre
  relationship has one honest posture — comparison — and the stance enum
  expresses the outcomes. Fewer controls is what the narrower question affords.
- The writer may add their own genre; it is surveyed, not humored, and can come
  back at 0.11. The field refuses only categories that aren't shelves (*fiction*
  would match everything and mean nothing).
- POV pill persists — constraint, never variable.

**The survey is a press, not a side effect of opening.** Spending is always
explicit; the panel opens *onto* the survey button with the cost stated.

## The survey shelf

3–6 candidates, each with a **claimed affinity** — labelled as a claim, because
nothing deterministic can measure "how noir" a chapter is. The number wears its
epistemics (*a hypothesis, not a measurement*); the dossier is where hypotheses
get anchored to addresses.

**Low affinity is drawn, not hidden.** A near-miss teaches: the furniture
matches, the reader promise doesn't. A survey returning only flattering numbers
would be the genre version of a dossier with no distortion block. The survey
describes the neighborhood; it never recommends moving.

## Generated workup — `genre-dossier v0`

Spread 08's deserialization contract, reused: block index → frame slot,
one-to-one, streamable, withheld-by-name on per-block failure.

| # | Block | Bounds | Guard |
|---|---|---|---|
| 1 | `verdict` | exactly 1, ≤240 chars | length bound; restates the claimed affinity it argues for |
| 2 | `tell` | 4–6; expectation ≤160; note ≤220 | span **+ ¶ address** verified; `dimension` and `stance` enums; withheld on failure |
| 3 | `friction` | 1–2, ≤240 | count bound; **the dossier fails without one** |
| 4 | `question` | exactly 1, ≤180 | exactly one; a frame, not a verdict |
| 5 | `neighbors` | 0–3 | genre names only, never prose |

- `dimension` ∈ `diction & register · rhythm & pacing · subject & topic ·
  structure & convention · imagery & motif · reader promise`
- `stance` ∈ `matches · departs · subverts`

**Why the ¶ address.** Verbatim matching alone weakens as the haystack grows —
"she smiled" appears nine times in a chapter. Span + paragraph address keeps the
guard deterministic and every claim clickable.

**Why stance needs three values.** Matches/departs is a checklist; *subverts* —
the convention invoked and declined on purpose — is the finding writers are
actually hunting.

**Why `reader promise` earns the widget.** Style tells are surface; the promise
tell is contractual. It's where "what genre is this?" becomes "what have I told
the reader to expect?" — a revision question, not a taxonomy question.

**Friction is distortion, renamed for the sharper risk.** A topic lens misreads;
a genre lens *pushes* — toward the reveal, toward the payoff, toward the shelf.
The required block warns about pressure on the writing, not just error in the
reading.

A genre need not speak on every dimension; five-of-six returned is honest state,
and the header says so.

## Map mode

Trace at chapter scale. The passage doesn't fit on screen, so the **shape**
renders instead: one cell per paragraph, lit where a tell touches, colored by
stance. Click a lit cell for the evidence and its ¶ address.

**Distribution is a finding cards can't show** — five tells clustered in the
opening third means the chapter starts in genre and walks away. The ribbon is
deterministic given the dossier; no additional model claims are drawn. Flagging
from a card or a cell is the same flag: one candidate list, two doors.

## Commit and lifecycle

- One-shot `<thread-artifact kind="widget:genre-dossier">` carrying the verdict,
  the flagged tells with span + ¶ + stance, cautions, and the question. **The
  shelf never rides** — the other candidates, their affinity claims, the
  unflagged tells, the ribbon, and the refusal text are all discarded.
- Staged through `pendingMessageAttachments` →
  `buildWorkshopThreadArtifactFrame`, under one visible ceiling.
- Presentation-only chip re-opens survey + dossier; **¶ addresses are re-verified
  on hydrate**, and tells stale from chapter edits are withheld like failed ones.
- Jill proposes the survey; **she never picks the genre**. Choosing which
  neighbor to interrogate is the interesting decision.

### Bring + Pin: the position as a standing influence

The one place this widget diverges from its sibling's pure one-shot rail.

- **You pin the position, never the genre.** The standing artifact holds
  *"borrows the withholding, refuses the reveal"* — a stance the chapter is
  taking. "Write more noir" stays unbuildable: no affinity dial, no slider, no
  direction toward the shelf.
- **Pin nests inside bring; it is never a sibling.** A pin without the
  report-back would be invisible influence — the writing changes and the
  transcript never says why. The one-turn payload always ships; the pin is an
  *additional* scope on the same commit.
- **Pinning requires a commitment** — at least one *subverted* tell or accepted
  caution must be in the selection. You pin a position you've taken, not a vibe.
  The verdict alone can't pin; *matches* and *departs* never pin at all.
- **The killer use case is drift** — the model "helpfully" restoring the genre
  payoff. The pinned hold says *subverted on purpose; never restore*, every turn.
- Emits `<standing-influence kind="widget:genre-position">` on the Prose
  Controller rail: persistent frame, visible pinned chip above the composer,
  one per genre, ¶ re-verified per turn. **Unpinning is its own visible event.**

## Boundaries this keeps

- **Grades resemblance, never quality** — no stance is a deficiency, and no
  surface here can say "failing".
- **Never instructs the room to write toward a genre.** Deferred permanently, not
  provisionally; the pin is explicitly *not* that affordance.
- Never rewrites the writer's text. Bounded, visible payload. Closed ordered
  schemas for both calls with per-block validation, cancellation, and a drawn
  refusal state. Config persists by stable id in `WorkshopSessionService`. The
  new reserved frame registers with the neutralizer in the same change. Core
  stays host-agnostic.

## Smallest useful slice

Chapter source + one survey + per-genre derivation (cached) + two-sided
span-verified tells + stance enum + map ribbon + flags + opt-in bring + chip
re-open. Defer genre-vs-genre side-by-side (borrow the Explorer's comparison
tray, don't regrow one), multi-chapter surveys, and any "write toward this genre"
affordance — the last one permanently.

**Scope note:** the pin (§07 on the spread) is drawn but is a second slice. It
depends on Sprint 02's standing rail and should not be bundled into the first
promotion.

## Promotion gates

1. Sprint 01 host proven; Sprint 02 standing rail landed **if** the pin is in
   scope.
2. Both call results cross closed ordered schemas with per-block validation.
3. The ¶-address check is deterministic and re-runs on hydrate.
4. The refusal state (too-broad category) is drawn and implemented.
5. **Open — argue before promotion:** **who owns the dimension enum** (six is an
   editorial position, and the seventh candidate — *paratext & framing* — has a
   real constituency); whether claimed affinity should be visually distinguished
   from measured numbers **everywhere in the product**, not just here; and
   whether the survey may ever run on a whole manuscript, where "one press" stops
   being a meaningful cost statement.

## Relationship to other widgets

- **[Topic Relationship Explorer](topic-relationship-explorer.md)** is the
  sibling and the source of the dossier grammar. The two Relationship Explorers
  differ in relatum and scale, never in lifecycle.
- **Lexical Gravity / Prose Controller** own the standing rail this widget's pin
  borrows — it reuses that machinery rather than growing its own.
- **Creative Variations Explorer** owns the comparison tray any future
  genre-vs-genre view should use.
