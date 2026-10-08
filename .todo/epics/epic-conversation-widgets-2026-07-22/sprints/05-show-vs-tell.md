# Sprint 05: Show vs. Tell Playground

**Status**: Planned
**Priority**: Medium
**Branch**: `sprint/conversation-widgets-05-show-vs-tell` -> PR into `epic/conversation-widgets`
**Depends on**: [Sprint 03 — Creative Variations](03-creative-variations.md) proving the bounded one-shot variation workup, and [Sprint 04 — Prose Controller](04-prose-controller.md) establishing the durable narrative-handling vocabulary
**Concept**: [Show vs. Tell Playground](../concepts/show-v-tell-playground.md)
**Design source**: [Spread 04 — Show vs. Tell Playground](../../../../docs/design/Prose%20Minion%20-%20Show%20vs%20Tell.html) (`pm-svt.css` / `pm-svt.js`, pulled 2026-10-08; see [docs/design/README.md](../../../../docs/design/README.md)). The page is the approved visual reference. Its fixture variants, readout table, and simulated generation delay are design evidence; this sprint governs runtime behavior where the two differ (see [Design reconciliation](#design-reconciliation)).

## Goal

Let the writer explore one selected beat along a five-position continuum from
compressed explanation to embodied dramatization, see the gain and cost of each
move, choose useful local directions, and commit a one-shot artifact. Showing
and telling are both tools; the UI must never pretend the continuum is a virtue
slider.

The widget reuses Sprint 01's one-shot rail and Sprint 03's commit, chip, and
clone mechanics. Everything new is in the pre-commit surface: a named
continuum, a deterministic tradeoff readout, and a workup grouped by kind.

## Locked decisions

### Product posture

- **A specialized Creative Variations sibling.** Sprint 03 may provide a
  mechanical typed-workup/selection seam, but this feature owns the continuum,
  channel vocabulary, prompts, response interpretation, and tradeoff readout.
  It is not a generic Creative Variations skin. (Spread 07's ladder: Show vs.
  Tell is "Creative Variations with one axis welded on". A specialized widget
  is worth it only when its axis can be taught.)
- **One-shot, not standing.** Prose Controller's broad narrative-handling bias
  and this feature's local beat experiment share vocabulary but never state.
  No selected variation silently changes an active Controller directive. If
  both are live, the committed playground artifact is a local instruction about
  one beat for one turn: local wins for that beat only.
- **Writer selects the useful comparison.** Personas may recommend or prefill;
  they cannot generate, select, or commit. Comparison is the product, so there
  is no auto-commit.
- **Never touches editor text.** No insert, no replace, no "apply to editor".
  Commit hands the room the writer's chosen directions and variants; the
  persona still writes the prose. The footer says so: *Nothing is inserted into
  the editor — commit hands directions to the room.*
- **Never a knob on the participant.** Show/tell is a property of the work. No
  persona identity, lens, mode, or behavior is touched.
- **Not a morality slider.** No good/bad colouring, no score, no "best" badge,
  and no ordering that implies improvement anywhere: not in the continuum,
  the readout, the workup, or the catalog copy.

### The continuum

- **Five named positions, not a percentage.** The control is a five-step
  segmented continuum between the end labels `compress / explain` and
  `dramatize / embody`. Each step shows its name and subtitle; the selected step
  shows a one-line tradeoff sentence beneath. Copy is fixed by the design:

  | # | Position | Subtitle | Tradeoff line | Controller lever |
  |---|---|---|---|---|
  | 1 | **State it** | direct tell | Gets the reader across the room in nine words. Spends nothing, teaches nothing. | summary allowed |
  | 2 | **Summarize** | compressed narrative | Buys a year in a clause — right when the beat is a bridge to somewhere else. | summary allowed |
  | 3 | **Hinge** | tell the bridge, show the fulcrum | Tells the year, shows the second. Usually the working answer — so distrust it once. | mixed |
  | 4 | **Evidence** | observable action & sense | Nothing is claimed, so nothing can be argued with. The most ambiguous position, on purpose. | scene only |
  | 5 | **Inhabit** | full scene time | The room becomes the argument. Costs the most page of anything here. | scene only |

  The tradeoff lines in the design quote the fixture beat ("nine words", "a
  year"). The shipped lines must be generic or explicitly illustrative;
  settle the final copy at kickoff. New drafts default to **Hinge**.

- **Deterministic seven-dimension tradeoff readout.** Under the continuum, a
  table of seven dimensions, each a four-segment bar in **one accent colour**.
  It re-weighs instantly when the position changes, makes no model call, and is
  captioned *deterministic tradeoff readout · no model call · no bar is a
  score*. The table is a versioned, feature-owned constant (0–4 filled
  segments):

  | Dimension | State it | Summarize | Hinge | Evidence | Inhabit |
  |---|---|---|---|---|---|
  | reader speed | 4 | 4 | 3 | 2 | 1 |
  | fact clarity | 4 | 4 | 3 | 2 | 2 |
  | intimacy | 1 | 1 | 2 | 3 | 4 |
  | page emphasis | 1 | 2 | 3 | 3 | 4 |
  | ambiguity | 0 | 1 | 2 | 4 | 3 |
  | scene time | 0 | 1 | 2 | 3 | 4 |
  | reader work | 0 | 1 | 3 | 4 | 3 |

  *Ambiguity* and *reader work* deliberately peak at **Evidence**, not at
  Inhabit: this is a craft claim the readout is allowed to make. Tests pin both
  non-monotonic rows.

- **Shared vocabulary line.** Beneath the readout:
  *shared vocabulary → Prose Controller ch. 06 narrative handling · show : tell
  = **{lever}***, using the mapping in the table above. Five local positions map
  onto the Controller's three values, never the reverse. The mapping is one
  shared constant that both surfaces import. Neither surface invents its own
  words.

### Inputs

- **Selected beat** (required). A single-line field seeded from the editor
  selection or a persona/Learner prefill, labelled with honest provenance
  (`seeded from selection`, persona custody, or pasted). Uses Sprint 03's
  `dispatchWorkshopSelectionData` intake and display-safe provenance rules.
- **Surrounding passage** (read-only context). Taken from the room excerpt with
  the beat highlighted and labelled with its source. It grounds POV and meaning
  for generation. It never rides the commit.
- **POV constraint.** Shown as a tag on the beat label (design: `POV: close
  third · his`). POV is a **constraint, not a channel**. The generation is told
  that interiority may only be the POV character's own perception and
  inference, never another character's mind. The panel says so in a hint under
  the channels. A writer-editable POV field (mode plus optional focal character,
  defaulting to unspecified) is staked here. Whether it can be pre-seeded from
  excerpt metadata is a kickoff question.
- **Must survive every variation** (required). The fact, emotion, or turn that
  every variant has to carry. This is the invariant, not a style note, and it
  is the first constraint line of the committed payload. Unlike Creative
  Variations, the field is required: "the same beat at five distances" has no
  meaning without a declared "same".
- **Must *not* change** (optional). Hard boundaries such as "no flashback; stay
  in the kitchen, stay in tonight". A blank field declares no constraint, and
  the model does not infer one.
- **Channels to emphasize.** A multi-select of five channels: `observable
  action`, `sensory evidence`, `interiority` (sub-label names the POV limit,
  e.g. *his inference only*), `dialogue / subtext`, and `summary / exposition`.
  At least one stays selected: the last selected channel cannot be turned off.
  New drafts default to `observable action` + `sensory evidence`.
- **Length budget.** A single-select of `tighter`, `same length`,
  `+1 sentence`, or `+1 paragraph`. New drafts default to `same length`.

All of the above are deterministic and free. Changing any input that feeds
generation invalidates the current workup the same way Sprint 03 invalidates
on input change. The continuum position is the exception: moving it re-weighs
the readout and changes what commits, without discarding the workup.

### The workup

- **One explicit model seam: `Generate the workup`.** Copy under the button:
  *everything above is deterministic scaffold · one model call, fast tier ·
  commit never re-runs it*. Busy state: *One fast model call…*, cancellable.
  After the first workup the button becomes a ghost `Regenerate the workup`.
  The call uses the widget model selector established by Sprint 03. "Fast tier"
  is the design's default intent, not a hard-coded model.
- **Grouped by kind, not ranked.** The closed response has four fixed groups,
  always rendered in this order. Each group has a header and a sub-label:

  | Group | Sub-label |
  |---|---|
  | Told, cleanly | compress / explain |
  | Shown as evidence | observable action & sense |
  | Shown from inside | POV-legal — the POV character's read, not another's mind |
  | Mixed — tell the bridge, show the fulcrum | the hinge |

  Every group is always present. The workup spans the whole continuum so the
  comparison is honest. Position, channels, budget, and POV steer the variants
  *within* groups; they do not remove the told end. The bound is 1–2 variants
  per group and 4–8 in total; the design fixture has seven (2 · 2 · 2 · 1).
- **Typed variant shape.** Each variant carries: proposed prose (multi-line
  allowed for dialogue), the channel(s) it uses, a **gains / costs** craft note,
  and a **direction**: an abstract, reusable instruction that is strictly
  shorter than the prose (the design fixture runs 0.36–0.66 of the prose
  length). Word count is computed host-side for display (`N w`), not supplied by
  the model. Ids are host-minted after validation, never supplied by the model.
  As in Sprint 03, a closed parser validates counts, group membership, character
  limits, and the shorter-than-prose rule atomically, and an exact normalized
  duplicate rejects the whole workup.
- **The mixed group exists because it is usually the answer**, and its craft
  note says so and then says to distrust it once. The generation prompt
  requires this framing.
- **Invariant warnings follow Sprint 03.** A variant may carry typed
  `advisory-risk | hard-conflict` flags against a non-blank invariant field
  (`hard-conflict` only against *must not change*). They render passively,
  never block selection or commit, and ride the artifact for selected variants.
  The design does not draw flags. Reuse Creative Variations' passive warning
  treatment.
- **Multi-select keep.** Clicking a variant card toggles it kept (check box,
  selected styling). Kept variants show a per-variant **carry** toggle:
  `commit as  prose variant | direction only`.
- **Note to the room** (optional) is a single-line field below the workup
  (placeholder *e.g. the tell can stay if the fulcrum is shown*).
- **Regeneration** mints a fresh workup id and atomically clears kept
  variants and carry modes before the new cards settle (Sprint 03 rule).

### Payload, ceiling, and commit

- **Live "What commits" strip.** Under the workup it previews the exact
  artifact lines and a character counter `N / 600 chars` with a meter. With
  nothing kept it reads *nothing kept yet — commit stays off*.
- **Hard 600-character ceiling, visible as it's spent.** Past 600 the counter
  and meter turn red and **commit is blocked**, with an accessible blocker
  that explains the fix (switch variants to direction only, keep fewer, or
  shorten the note). The host independently re-checks the budget before
  mutation. Direction-only carry exists so a writer who keeps five variants
  still fits. Count against the same deterministic artifact projection the
  host compiles (Sprint 03's `CreativeVariationsArtifact` pattern), not an
  approximation.
- **Commit requires at least one kept variant.** Footer shows `N kept ·`.
  Buttons: `Cancel`, plus `Commit to thread` (or `Commit as new turn` when
  re-opened from a chip).
- **Committed frame.** Staged through the existing rail
  (`pendingMessageAttachments → buildWorkshopThreadArtifactFrame`); rides
  exactly one turn and is never re-shipped:

  ```text
  <thread-artifact id="ta-N" kind="widget:show-vs-tell">
  beat: "She hadn't trusted him since the funeral."
  position: hinge · tell the bridge, show the fulcrum
  must survive: the distrust is old and funeral-rooted —
  and she never says it out loud
  must not change: …            (only when non-blank)
  keep: "<prose of a variant carried as prose>"
  direction: <direction of a variant carried as direction>
  note: the tell can stay if the fulcrum is shown   (only when non-blank)
  </thread-artifact>
  ```

  One `keep:` or `direction:` line per kept variant, in workup order. Selected
  variants' invariant warnings ride as in Sprint 03. **Thrown away at commit**
  and never shipped: the unkept variants, every craft note, the readout,
  channel emphasis, length budget, the POV hint text, and the surrounding
  passage.
- **Reserved frame.** If `widget:show-vs-tell` needs any new reserved
  frame or tag, it registers with the prompt-delimiter neutralizer in the same
  change that ships it.
- **Writer turn.** Carries the bounded display-safe beat preview so the
  directions have a referent (Sprint 03 rule). Design copy: *Ran the {beat}
  through the playground at {position} — here's how I want the beat carried —
  {note}.*
- **Chip.** Presentation-only, with zero model context: eye icon,
  `Show vs. Tell`, then `{N} kept · {M} as direction · re-open` (the direction
  clause is omitted when M = 0).

### Persistence, reopen, and clone

- **Config, not just output, persists.** The full draft is stored by stable id
  in `WorkshopSessionService`: beat + provenance, POV constraint, both
  invariant fields, channels, budget, position, the generated workup, kept
  variants **and their carry modes**, and the note. Focus, scroll, and the busy
  state are ephemeral. (The prototype's reopen drops channels and budget. That
  is a prototype gap, not the contract.)
- **Clone-and-recommit, exactly as Sprint 03.** The chip reopens the exact
  draft with the clone banner (*Re-opened from a committed turn. The old chip
  stays as history — committing again creates a **new** turn at the head.*).
  Recommitting mints a new config, artifact, and turn and records
  `clonedFromConfigId`.
- **Codec.** A feature-local draft codec plus a closed widget-lifecycle
  registry arm, following the
  [codec evolution ADR](../../../../docs/adr/2026-07-30-workshop-session-codec-evolution.md).
  The configs are unshipped, so no migration arm is needed.

### Recommend and prefill

- **Persona recommendation chip.** A Host or Guest turn may carry a strict
  Show vs. Tell recommendation frame through the Sprint 03 Slice 6 registry
  (its own codec, exact frame ceiling, and production availability policy).
  The chip reads `Show vs. Tell Playground · prefilled · {short subject}`.
  Opening it shows the seed banner (*Recommended and prefilled by {persona}.
  … she proposes and prefills, you decide what commits.*, with pronouns
  derived from the persona, not hard-coded). The seed is **input-only**:
  beat, optional surrounding context source, must survive, optional must not
  change, and optionally a suggested position, channels, and budget. It never
  carries a workup, selections, or a note, and opening it never auto-generates.
- **Diagnosis, not verdict.** The recommendation prompt teaches personas to
  frame a told beat as a choice in the panel's vocabulary (design: *"It isn't a
  bad sentence — it's a choice you haven't made yet. That line buys you a year
  in nine words…"*), never as a correction.
- **Widgets browser entry.** `show-vs-tell` goes live in the Playgrounds group
  (`live: true`, `tag: 'Sprint 05'`). The current blurb (*Recast a told beat
  as shown alternatives…*) treats showing as the destination, which breaks the
  "not a morality slider" rule. Replace it with neutral copy, for example
  *Move one beat between telling and showing — see what each distance gains
  and costs, keep what lands.* Decide the Host-preparation door at kickoff,
  matching Creative Variations.

## Scope / deliverables

1. Feature-owned contracts, draft codec, hydration/integrity, and the closed
   lifecycle registry arm.
2. Authoring surface: beat intake with provenance, surrounding-passage context,
   POV constraint, must-survive (required) and must-not-change fields, the five
   channels, the four-step length budget, the five-position continuum with
   tradeoff line, the deterministic seven-dimension readout, and the Controller
   vocabulary line.
3. One cancellable, typed generation with a closed four-group response schema,
   atomic validation (count, groups, lengths, direction-shorter-than-prose,
   exact duplicates, flag grammar), progress and failure states, and
   stale-result correlation.
4. Grouped workup cards with gains/costs notes and word counts, multi-select
   keep, per-variant prose/direction carry, the note field, a live payload
   preview with an exact 600-character meter, and the over-ceiling commit
   block.
5. Compact one-shot commit through the shared Sprint 03 coordinator, the
   presentation-only chip, exact reopen, and clone-and-recommit.
6. Persona recommendation codec and prefill (Host and Guest only), live catalog
   entry, and neutral browser copy.
7. Shared vocabulary: one constant for the five positions → three Controller
   values, imported by both surfaces. Tests prove Show vs. Tell stays
   independent of Lexical Gravity's application gear and evidence mode, and
   complements Prose Controller's narrative-handling chapter without sharing
   state.

## Implementation slices (proposed)

Mirrors Sprint 03's review-gated slices; finalize at kickoff.

| Slice | Review boundary |
|---|---|
| 0 | Freeze the contract; pin the design reconciliation decisions below; confirm Sprint 04's narrative-handling lever values. |
| 1 | Contracts, budgets, codec, lifecycle arm, and integrity. Shared continuum/readout/vocabulary constants. |
| 2 | Prompt bundle, strict four-group response codec, cancellation, and correlation. |
| 3 | Intake, authoring controller, continuum, readout, grouped cards, carry, and payload meter. Catalog goes live for hands-on testing. |
| 4 | Commit, chip, reopen, and clone-and-recommit. |
| 5 | Persona recommendation and prefill. |
| 6 | Architecture witnesses, production-policy route matrix, full verification, and docs. |

## Design reconciliation

Spread 04 was drawn before Sprint 03 shipped. Where the prototype and Sprint 03's
accepted rules disagree, this sprint follows Sprint 03 unless kickoff decides
otherwise:

| Prototype behavior | Sprint 05 contract | Why |
|---|---|---|
| A newly kept variant defaults to **prose** carry | Defaults to **direction only**; prose is a per-variant promotion | Sprint 03 locked decision. A direction is about half the characters, so the ceiling fits more kept variants by default |
| Over 600 chars turns red but commit stays enabled | Commit is **blocked** over the ceiling, and the host re-checks | The design calls it a "hard ceiling". Sprint 03's host rejects over-budget artifacts |
| Regenerate keeps selections | Regenerate clears kept variants and carry modes atomically | Sprint 03 locked decision; a new workup has new cards |
| Reopen restores position, kept variants, carry, and note | Also restores channels, budget, POV, invariants, and the workup | §1 and §5 of the design say "re-hydrates the whole draft"; the fixture code just doesn't |
| *Must not change* is collected but omitted from the payload | Rides the artifact when non-blank | Sprint 03 carries non-blank declared invariants; a hard boundary the room never sees is not a boundary |
| No invariant warnings drawn | Sprint 03's passive advisory and hard-conflict warnings | Completion criteria require constraint breaks to be visible |
| Hard-coded "Jill … she" banner and "his" POV labels | Derived from the persona and the POV field | Fixture copy |

## Out of scope

- Editor replacement, insert/copy-to-editor, automatic rewriting, or a standing
  show/tell directive.
- **Promote to standing**: turning a kept direction into a Prose Controller
  shift. It is the obvious next request and would need the Controller's shift
  marker, not this rail.
- **Learner launch.** The design's `learner` banner (*Launched from Learner —
  The Storytelling Craft…*) and the drill prefill (beat, invariant, target
  position) wait for the Learner concept to be promoted. The prefill seam
  built here should accept that seed shape without changes.
- A general-purpose variation framework that absorbs the feature's craft
  semantics.
- Lens-stack behavior; Lexical Gravity selection remains Sprint 06 work.

## Open questions for kickoff

- **Sprint 04 vocabulary.** The design pins `show : tell = summary allowed |
  mixed | scene only` as Controller ch. 06 values. Sprint 04 currently
  describes narrative handling as scene ↔ summary and related axes, but names
  no such three values. Either Sprint 04 adopts these three values, or this
  mapping is re-drawn to whatever Sprint 04 ships. Do not let the two surfaces
  diverge.
- **Tradeoff-line copy.** Keep the fixture-flavoured lines as illustrative
  examples, or write generic ones?
- **POV source.** Is the POV field writer-only, persona-prefillable, or seeded
  from excerpt metadata?
- **Variant bounds.** Confirm 1–2 per group and 4–8 in total, and the
  per-field character limits.

## Completion criteria

- A writer can intentionally choose explanation, summary, a hinge, evidence,
  or inhabitation and understand the pacing, clarity, intimacy, ambiguity, and
  scene-time tradeoffs from the deterministic readout. Nothing on the surface
  scores, ranks, or colour-codes either end as better.
- A generated workup always spans all four groups. Every variant shows its
  gains/costs note, word count, and a direction shorter than its prose.
- All generated and committed variants preserve the declared constraints or
  show a visible warning the writer can weigh. No variation is silently treated
  as canon, and no model warning vetoes the writer's choice.
- The payload meter matches the host's artifact projection exactly. An
  over-ceiling draft cannot commit, and switching a variant to direction only
  always lowers the count.
- Commit never touches editor text. The persisted draft reopens exactly, and
  recommitting a reopened draft mints a new config, artifact, and turn.
- The five-position → Controller mapping is one shared constant, pinned by a
  test that both surfaces depend on.
- The feature reuses only truthful mechanical variation seams and remains a
  separately named, independently testable widget slice. Creative Variations
  does not learn continuum or channel vocabulary.
- Architecture witnesses, focused tests, typechecks, lint, build, and
  `git diff --check` pass.
