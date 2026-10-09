# Sprint 05: Show vs. Tell Playground

**Status**: Slice 3 ready for review. Slices 1 (#134) and 2 (#135) merged. Slice 3 (authoring surface, artifact projection, catalog flip) is on one branch and one PR; commit stays disabled until Slice 4, so the epic must not merge into `main` before it.
**Priority**: Medium
**Branches**: one per slice, `epic/conversation-widgets-sprint-05-slice-<N>-<desc>`, each cut from `epic/conversation-widgets` and merged back into it by PR (see [Branching](#branching))
**Depends on**: [Sprint 03 — Creative Variations](03-creative-variations.md), complete and merged into `epic/conversation-widgets` (PR #112). [Sprint 04 — Prose Controller](04-prose-controller.md) is **not** a build dependency: this sprint owns the shared narrative-handling vocabulary constant, and Sprint 04 adopts it (see [Kickoff decisions](#kickoff-decisions-slice-0-2026-10-08)).
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
  shows a one-line tradeoff sentence beneath. Copy is frozen (Slice 0):

  | # | Id | Position | Subtitle | Tradeoff line (shipped copy) | Controller lever |
  |---|---|---|---|---|---|
  | 1 | `state-it` | **State it** | direct tell | Gets the fact across in the fewest words. Spends nothing, teaches nothing. | `summary-allowed` |
  | 2 | `summarize` | **Summarize** | compressed narrative | Buys a stretch of time in a clause — right when the beat is a bridge to somewhere else. | `summary-allowed` |
  | 3 | `hinge` | **Hinge** | tell the bridge, show the fulcrum | Tells the bridge, shows the moment that turns. Usually the working answer — so distrust it once. | `mixed` |
  | 4 | `evidence` | **Evidence** | observable action & sense | Nothing is claimed, so nothing can be argued with. The most ambiguous position, on purpose. | `scene-only` |
  | 5 | `inhabit` | **Inhabit** | full scene time | The scene becomes the argument. Costs the most page of anything here. | `scene-only` |

  The tradeoff lines are generic, so they read true for any beat. The design's
  lines quoted its fixture ("nine words", "a year") and stay in the design
  file as illustration only. New drafts default to **Hinge**.

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

  **Owner and location.** This sprint creates
  `packages/core/src/shared/constants/narrativeHandlingVocabulary.ts` in
  Slice 1. It is named after the shared concept, not after either widget, and
  exports exactly three things: the five position ids, the three Controller
  show:tell values (`summary-allowed | mixed | scene-only`, with their display
  labels `summary allowed | mixed | scene only`), and the total, frozen
  position → value mapping. Position names, subtitles, tradeoff lines, and the
  readout are **not** shared. They stay feature-owned, because Prose Controller
  teaches the lever in its own words. Sprint 04 imports the values and mapping
  from this file and must not redeclare them.

### Inputs

- **Selected beat** (required, at most 160 characters). A beat, not a passage:
  passages and paragraphs belong in Creative Variations. A single-line field seeded from the editor
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
  the channels. The POV field is writer-editable: a mode (`unspecified`,
  `first`, `close third`, `distant third`, `second`, `omniscient`) plus an
  optional focal character, defaulting to `unspecified`. With `unspecified`,
  the prompt still forbids head-hopping but names no focal character, and the
  interiority sub-label reads *POV character's inference only*. A persona
  recommendation seed may prefill the field (it shows as persona-prepared
  until the writer edits it). Excerpts have no POV metadata today, so seeding
  from excerpt metadata is deferred to
  [tech debt](../../../tech-debt/2026-10-08-excerpt-pov-metadata.md).
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
  allowed for dialogue), the channel(s) it uses (one or two of the five), a
  **gains / costs** craft note as two separate plain-text fields (`gains`,
  `costs`; no Markdown or HTML, and the UI supplies the bold labels), and a
  **direction**: an abstract, reusable instruction that is strictly
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
- **What the 600 counts (frozen at Slice 0).** The counted string is the
  artifact body exactly as compiled: the `beat:`, `position:`, `must survive:`,
  optional `must not change:`, `keep:`/`direction:`, and optional `note:`
  lines, with their keys, joined by `\n`. It uses the same character measure
  as `CreativeVariationsArtifact`. Two things are **not** counted: the
  host-minted `<thread-artifact …>` envelope, and the host-appended invariant
  warning lines. Warnings have their own fixed bound (flags per variant × flag
  note length). The writer cannot shorten a model's warning, so it must never
  be the reason commit is blocked. The webview meter imports the host's
  projection function rather than re-implementing it.
- **Fit guarantee.** Field limits are set so that a maximal beat, a maximal
  must survive, a maximal must not change, the longest position line, and
  **one** maximal direction-only variant still fit under 600. A Slice 1 budget
  test pins this arithmetic, so a later budget change cannot make commit
  impossible.
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
  invariant fields, the surrounding-passage source reference (a reference only;
  the passage text is never stored), channels, budget, position, the generated
  workup, kept
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
  change, and optionally a suggested POV, position, channels, and budget. It never
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
  and costs, keep what lands.*
- **Host-preparation door: enabled, matching Creative Variations.** The
  Widgets browser's Host-preparation door seeds an editable request to the
  Host that expressly forbids generating, selecting, or committing. The Host
  may only return a recommendation frame.

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

## Budgets (frozen at Slice 0)

Add these to `PROMPT_BUDGETS` in
`packages/core/src/shared/constants/promptBudgets.ts` with a `showVsTell`
prefix, as Sprint 03 did with `creative*`. A slice may tighten a limit. To
loosen one, re-run the fit-guarantee arithmetic and update this table in the
same commit.

| Budget | Value | Why |
|---|---|---|
| `showVsTellBeatCharacters` | 160 | A beat, not a passage. The writer-turn preview is the whole beat |
| `showVsTellContextCharacters` | 250,000 | Parity with `creativeContextCharacters` (room excerpt) |
| `showVsTellSourceReferences` | 1 | One surrounding passage; zero means none (Q1, Slice 2b) |
| `showVsTellSourceReferenceCharacters` | 500 | Parity with `creativeSourceReferenceCharacters` (a `ctx-N` id bound) |
| `showVsTellProvenancePathCharacters` | 500 | Parity with Creative Variations |
| `showVsTellPovFocalCharacterCharacters` | 80 | A name, not a description |
| `showVsTellMustSurviveCharacters` | 120 | Rides the artifact; the fixture is 76 |
| `showVsTellMustNotChangeCharacters` | 80 | Rides the artifact when non-blank; the fixture is 51 |
| `showVsTellNoteCharacters` | 160 | Writer-controlled; the blocker tells the writer to shorten it |
| `showVsTellWorkupIdCharacters` | 64 | Parity with Creative Variations |
| `showVsTellVariantsPerGroupMinimum` / `showVsTellVariantsPerGroup` | 1 / 2 | Confirmed |
| `showVsTellVariantsMinimum` / `showVsTellVariants` | 4 / 8 | Confirmed; four groups always present |
| `showVsTellChannelsPerVariant` | 2 (minimum 1) | The fixture's richest variant is `summary + action` |
| `showVsTellProseCharacters` | 1,200 | Covers the `+1 paragraph` budget |
| `showVsTellDirectionCharacters` | 120 | Also strictly shorter than its prose; the fixture's longest is about 60 |
| `showVsTellGainsCharacters` / `showVsTellCostsCharacters` | 160 / 160 | One sentence each |
| `showVsTellFlagsPerVariant` / `showVsTellFlagNoteCharacters` | 4 / 160 | Bounds the uncounted warning lines |
| `showVsTellOutputTokens` | 16,000 | Eight variants is about 13k characters of payload, plus headroom |
| `showVsTellResponseCharacters` | 48,000 | Closed-parser ceiling |
| `showVsTellArtifactCharacters` | 600 | The writer-visible ceiling (see *What the 600 counts*) |
| `showVsTellRecommendationSubjectCharacters` | 60 | The chip's `{short subject}` |
| `showVsTellRecommendationFrameAllowanceCharacters` | 1,200 | A seed is input-only and small |

Fit-guarantee arithmetic (Slice 1 pins it): `beat: "…"` 168 + the longest
position line (`position: hinge · tell the bridge, show the fulcrum`) 51 +
`must survive: …` 134 + `must not change: …` 97 + one `direction: …` 131 +
4 newlines = **585 ≤ 600**.

## Implementation slices

Follows Sprint 03's review-gated slices. Each slice gets its own branch, and
its PR into the epic **is** that slice's review gate.

### Branching

```text
main ─────────────────────────────────────────────●  (releases)
  └─ epic/conversation-widgets  (integration; fast-forwarded to main at Slice 0)
       ├─ epic/conversation-widgets-sprint-05-slice-1-contracts   → PR → epic
       ├─ epic/conversation-widgets-sprint-05-slice-2-generation  → PR → epic
       ├─ … one branch per slice, each cut from the epic *after* the previous slice merged
       └─ epic/conversation-widgets → main   (when the epic or a release is ready)
```

- **Name**: `epic/conversation-widgets-sprint-05-slice-<N>-<desc>`. A `/`
  after `conversation-widgets` is impossible because Git cannot nest refs
  under an existing branch name.
- **Cut each slice from the current epic**, after the previous slice's PR has
  merged. Slices are sequential, and no slice branches off another slice
  branch.
- **One PR per slice into `epic/conversation-widgets`.** Open it, don't merge
  it. The writer merges after review (Opus review for Sonnet slices). Prefer a
  merge commit or rebase over squash, so the slice's commit-by-commit history
  survives for review.
- **The epic never merges into `main` mid-sprint between Slices 3 and 4.**
  Slice 3 flips the catalog live while commit is still disabled.
- **Keeping the epic current**: if `main` moves (a release or hotfix), merge
  `main` into the epic *between* slices, never while a slice branch is open.

| Slice | Review boundary | Model | Opus review focus |
|---|---|---|---|
| 0 | ✅ Contract frozen; kickoff decisions recorded; design reconciliation accepted; Sprint 04 adopts the shared vocabulary; baseline recorded. | Opus | — |
| 1 | Contracts, budgets (with the fit-guarantee test), feature-local draft codec, lifecycle registry arm, and integrity. The shared `narrativeHandlingVocabulary.ts` and the feature-owned continuum and readout constants, with tests pinning the two non-monotonic readout rows. | **Opus** | — |
| 2 | **2a — prompt bundle** (`system-prompts/show-vs-tell/`). **2b — strict four-group response codec, cancellation, and stale-result correlation.** | 2a **Opus**; 2b **Sonnet** | Correlation tests; the direction-shorter-than-prose rule; group-membership rejection |
| 3 | Intake, authoring controller, continuum, readout, POV field, channels, budget, grouped cards, carry, note, and payload meter. **The catalog goes live here, intentionally, for hands-on testing.** Commit stays disabled until Slice 4 wires it, and the epic does not merge into `main` until Slice 4 has landed. | **Sonnet** | The meter imports the host projection; moving the position does not invalidate the workup, but every other generation input does; no score, rank, or good/bad colour anywhere |
| 4 | Commit through the shared Sprint 03 coordinator; host re-check of the 600 ceiling; `widget:show-vs-tell` registered with the prompt-delimiter neutralizer; chip, exact reopen, and clone-and-recommit. | **Sonnet** | Host ceiling re-check; neutralizer registration; nothing touches the editor |
| 5 | Persona recommendation codec and prefill (Host and Guest), the Host-preparation door, and neutral browser copy. | **Sonnet** (mechanics); **Opus** writes the recommendation prompt's "diagnosis, not verdict" copy | Seed is input-only; opening never auto-generates; pronouns are derived |
| 6 | Architecture witnesses, the production-policy route matrix, full verification, and current-state docs. Shared-vocabulary tests (deliverable 7). | **Sonnet**; **Haiku** for docs, inventory counts, and verification summaries | Independence from Lexical Gravity's gear and evidence mode |

**Model routing rule.** Sonnet slices treat [Locked decisions](#locked-decisions)
and [Design reconciliation](#design-reconciliation) as a **divergence list**
from Creative Variations. Mirror Creative Variations' mechanics, never its
vocabulary. In particular, Show vs. Tell has no `aim`, no sampling distance,
no textual-overlap readout, and no advisory-risk acceptance gate. Its warnings
are passive.

### Implementation map

Each Creative Variations file is the template for its Show vs. Tell
counterpart. Folder: `showVsTell/`; type and file prefix: `ShowVsTell`;
widget id: `show-vs-tell`.

| Layer | Creative Variations template | Show vs. Tell file | Slice |
|---|---|---|---|
| Contracts | `shared/types/messages/workshop/creativeVariations.ts` | `…/workshop/showVsTell.ts` (+ the `workshop/index.ts` barrel) | 1 |
| Shared vocabulary | — | `shared/constants/narrativeHandlingVocabulary.ts` | 1 |
| Codec / integrity / derivations | `application/services/workshop/widgets/creativeVariations/CreativeVariations{ConfigCodec,ConfigIntegrity,Derivations,WorkupId}.ts` | `…/widgets/showVsTell/ShowVsTell{ConfigCodec,ConfigIntegrity,Derivations,WorkupId}.ts` | 1 |
| Readout and continuum constants | — | `…/widgets/showVsTell/ShowVsTellContinuum.ts` (feature-owned, versioned) | 1 |
| Prompts | `resources/system-prompts/creative-variations/` | `resources/system-prompts/show-vs-tell/` | 2a |
| Service and response codec | `infrastructure/api/services/widgets/creativeVariations/CreativeVariations{Service,ResponseCodec}.ts` | `…/widgets/showVsTell/ShowVsTell{Service,ResponseCodec}.ts` | 2b |
| Handler | `handlers/domain/workshop/widgets/creativeVariations/WorkshopCreativeVariationsHandler.ts` | `…/widgets/showVsTell/WorkshopShowVsTellHandler.ts` | 2b–4 |
| Hooks | `hooks/domain/workshop/widgets/creativeVariations/useCreativeVariations.ts`; `…/controllers/creativeVariations/useCreativeVariationsAuthoring.ts` | `…/widgets/showVsTell/useShowVsTell.ts`; `…/controllers/showVsTell/useShowVsTellAuthoring.ts` | 3 |
| Components | `components/workshop/widgets/creativeVariations/*` | `…/widgets/showVsTell/` (modal, continuum, readout, grouped card, payload meter, CSS) | 3 |
| Artifact and commit | `CreativeVariations{Artifact,CommitEligibility,OneShotCommit}.ts` | `ShowVsTell{Artifact,CommitEligibility,OneShotCommit}.ts` | 4 |
| Recommendation | `CreativeVariationsRecommendation.ts` | `ShowVsTellRecommendation.ts` | 5 |

**Closed registries and shared touch points** (each already has a
`creative-variations` arm; add the `show-vs-tell` arm beside it): `index.ts`
barrel; `shared/streamingCancelMessages.ts`; `messages/index.ts`,
`messages/workshop/{index,widgets,recovery}.ts`;
`constants/workshopWidgets.ts` (catalog, `live` flip, browser copy);
`MessageHandler.ts`, `MessageHandlerContracts.ts`,
`WorkshopSliceComposition.ts`, `WorkshopRouteContracts.ts`;
`WorkshopSessionStateV1Shape.ts`, `WorkshopSessionRecords.ts`,
`WorkshopRunCompletion.ts`;
`widgets/Workshop{WidgetRecommendationOperations,OneShotWidgetCommitOperations,WidgetConfigOperations,WidgetPersistenceLifecycle,WidgetConfigLedger}.ts`;
`utils/workshopPromptFrames.ts` (neutralizer); webview
`WorkshopApp.tsx`, `WorkshopTurnBubble.tsx`, `workshopWidgetIcons.ts`,
`workshopWidgetAskPrefill.ts`, `useWorkshopAppMessageRouter.ts`,
`dispatchWorkshop{WidgetActionResult,SelectionData}.ts`,
`useWorkshopWidgetOpening.ts`; the composition root
`apps/vscode-extension/src/extension.ts`. Architecture guards that list
Creative Variations: `__tests__/architecture/{boundaries,promptBudgets,workshopStyles,workshopWidgetPersistenceLifecycle}.test.ts`.
Existing tests that use `show-vs-tell` as the example of an *unavailable*
widget (`WorkshopRoomHandler.seams`, `WorkshopWidgetRecommendationOperations`,
`WorkshopWidgetConfigs`, `workshopWidgetAskPrefill`) must switch to another
non-live widget id when the catalog flips in Slice 3.

### Baseline witness (Slice 0, `main` @ `7031b7ee`)

`npx jest`: **267 suites / 3,535 tests / 2 snapshots, all passing** (50 s).
Jest reports one known worker that fails to exit gracefully. It predates this
sprint, so it is not a regression signal.

## Design reconciliation

Spread 04 was drawn before Sprint 03 shipped. Where the prototype and Sprint 03's
accepted rules disagree, this sprint follows Sprint 03. **Every row below was
accepted at Slice 0 (2026-10-08).**

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

## Kickoff decisions (Slice 0, 2026-10-08)

The four open kickoff questions are closed:

- **Sprint 04 vocabulary → Sprint 05 owns it, Sprint 04 adopts it.** Prose
  Controller is not built yet. Sprint 05 creates
  `narrativeHandlingVocabulary.ts` with the show:tell values `summary-allowed
  | mixed | scene-only`. [Sprint 04](04-prose-controller.md) now records that
  its narrative-handling chapter imports that constant. Sprint 04 is
  therefore no longer a build dependency of this sprint.
- **Tradeoff-line copy → generic.** The shipped lines are frozen in the
  continuum table above.
- **POV source → writer-editable, persona-prefillable.** Excerpt-metadata
  seeding is deferred to
  [tech debt](../../../tech-debt/2026-10-08-excerpt-pov-metadata.md).
- **Variant bounds → 1–2 per group, 4–8 in total, confirmed.** Per-field
  limits are frozen in [Budgets](#budgets-frozen-at-slice-0).

Also decided at Slice 0:

- **Catalog flip stays at Slice 3**, intentionally. The epic stays off
  `main` until Slice 4 lands (see the slice table).
- **One branch per slice**, cut from the epic and PR'd back into it (see
  [Branching](#branching)).
- **The Host-preparation door is enabled**, matching Creative Variations.
- **The 600 ceiling counts the artifact body only.** The envelope and warning
  lines are excluded, and a fit guarantee is pinned by a test.
- **Gains and costs are two plain-text fields**, not one Markdown note.

### Slice 1 contract questions (writer decisions, 2026-10-09)

The three questions raised in the [Slice 1 handoff](../../../../.memory-bank/20261009-0627-show-vs-tell-slice1-handoff.md#contract-questions-also-in-the-pr):

- **Q1, surrounding passage → persist a source now.** Slice 2b adds
  `surroundingContext: { sourceReferences }` to the draft and the generate
  payload. The host resolves the source's text at generation time; passage
  text never crosses from the webview, is never persisted, and never rides
  the commit. **Implemented in 2b.**
- **Q2, line breaks → multi-line allowed.** No validator rejects line breaks
  in `direction`, `gains`, `costs`, flag notes, or the invariants. The 2a
  prompt does not forbid them; it still asks for one sentence each in
  `gains` and `costs` and a compact `direction`. **Slice 4's artifact
  projection must define a continuation-line format for multi-line values**
  and redo the fit-guarantee arithmetic if that format adds characters.
- **Q3, POV custody → open.** Whether "persona-prepared" survives reopen is
  decided at Slice 5.

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
