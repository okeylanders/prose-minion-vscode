# Concept Spring: Topic Relationship Explorer

**Status**: Concept spring
**Priority candidate**: Medium
**Classification**: Conversation Widget (Learner-leaning exploration surface)
**Likely rail**: One-shot thread artifact
**Depends on**: Widget host + Gesture Playground (Sprint 01)
**Design source**: `Prose Minion - Topic Relationship Explorer.html` — Spread 08
(remote only; not pulled into `docs/design/`)

## Product idea

**Topic Relationship Explorer** lets a writer name any topic — *Jung*,
*accepted grief psychology*, *Heschel on the prophets* — and derive its
**relationship to the passage on the desk** in one model call. It is a hybrid of
the Learner and the Creative Variations Explorer that leans Learner: browsing
costs nothing, reading is the point, and bringing anything to the room is opt-in
at the very end. A dossier that is read, argued with, and left behind is a
successful session.

Its diagnosis is not sameness (the Explorer's) but *the writer has a frame in
mind and no way to hold it against the page*.

## The new problem it solves

The topic is a wide-open road, so **none of the content can be authored in
advance**. The Learner's answer — a versioned curriculum pack — is unavailable
here. The design's inversion is the load-bearing idea:

> the shell authors the **structure**, the model authors the **content**, and the
> passage anchors the **evidence**.

Trust therefore moves from content to structure. The schema, the span check, and
the grounding tags are what stand between this widget and a confident essay.

## Inputs

- **Topic** — free text, and it stays free text. No taxonomy, no topic picker,
  no curated list of Great Thinkers; a menu would misrepresent what the surface
  is for.
- **Posture** — three named positions, not a slider: *illuminate* (the topic
  reads the passage), *test* (the passage reads the topic), *collide* (neither
  yields). Verbalizes into instruction language the way the Explorer's distances
  do.
- **Scope** — narrowing to a selection narrows the *evidence field* (contacts
  must quote from inside it) while the topic stays whole. The asymmetry is the
  point: all of Jung can be held against two sentences.
- Recent topics appear as chips that re-fill the field — not a registry.

The seed states the anchor contract before the call is spent: every contact must
quote the passage verbatim.

## Generated workup — `topic-dossier v0`

One call returns an ordered, closed, per-block-validated structure that streams
and deserializes one-to-one into Learner frame slots. No Markdown-heading
parsing.

| # | Block | Bounds | Guard |
|---|---|---|---|
| 1 | `reading` | exactly 1, ≤240 chars | length bound; grounding enum |
| 2 | `contact` | 3–5; concept ≤40; reading ≤280 | span **string-matched** against the passage; `relation` and `grounding` enums; withheld by name on failure |
| 3 | `distortion` | 1–2, ≤240 | count bound; **the dossier fails without one** |
| 4 | `question` | exactly 1, ≤180 | exactly one; a frame, not a verdict |
| 5 | `further` | 0–3 | topic names only, never prose |

- `relation` ∈ `names · illuminates · complicates · contradicts · reframes`
- `grounding` ∈ `canonical · contested · extrapolated`

**Grounding is the honest answer to "heavily model-dependent".** The model may be
wrong about Jung, and the tag says how much to trust each claim. It is **not**
allowed to be wrong about what the passage says — that half is checked
deterministically.

**Distortion is required.** A dossier that only flatters its frame fails
validation; the honesty block is not optional on a good day.

## Reading surfaces

- **Dossier** — typed contact cards, each wearing three tags: relation (how the
  topic touches), grounding (how much to trust the touch), span-verified (the
  touch is real).
- **Trace** — Inspect, inverted: the Learner's scan drew *authored* categories
  deterministically; Trace draws *generated* claims at deterministically
  verified addresses. The honesty line under the passage states which half is
  which.
- **Ask** — one bounded follow-up, not a chat (the room is the chat). One in
  flight, ≤600 chars back, must cite a contact by number or decline. Ephemeral
  unless flagged.
- **No Practice tab.** Drills need authored rubrics; a generated rubric grading
  generated feedback is the model marking its own homework. The tab structure
  states what this surface can responsibly do.

## Drawn failure states

1. **Span doesn't match** — the card is withheld *by name*, struck through, with
   its reason and slot number; the rest of the dossier stands. Withholding beats
   repairing: a contact resting on fake evidence has nothing worth saving.
2. **Topic can't be grounded** — the dossier stops after block 1, tags grounding
   `none`, and offers two real paths (hand over the material labelled as the
   writer's own, or take a groundable neighbor). It never improvises a canon.

## Commit and lifecycle

- One-shot `<thread-artifact kind="widget:topic-dossier">` carrying only the
  selected reading, contacts, cautions, and question — **the dossier never
  rides**. Grounding tags ride inside the frame so the room inherits the
  epistemic labels, not just the claims.
- Staged through the existing rail: `pendingMessageAttachments` →
  `buildWorkshopThreadArtifactFrame`, under one visible character ceiling.
- Presentation-only chip re-opens the draft; **spans are re-verified on
  hydrate**, and contacts stale from passage edits are withheld like failed ones.
- Jill recommends topic + posture and derives nothing. Choosing what a frame is
  allowed to say about your scene stays with the writer.

## Boundaries this keeps

- **A dossier never becomes a lens.** "Keep reading my drafts through Jung" is
  standing behavior and belongs to Lexical Gravity's rail with its own weight and
  reach controls — never smuggled in via a one-shot.
- **The topic's vocabulary is quarantined from the prose.** Nothing on this
  surface can instruct the room to *write* Jungianly. What rides is a reading, a
  caution, a question.
- **No quotation of the topic's texts, ever** — the dossier paraphrases and
  relates.
- **Never a knob on the participant.** Deriving changes nothing about Jill.

## Smallest useful slice

Topic + posture + one ordered derivation + span-verified contacts + flags + one
bounded ask + opt-in bring + chip re-open. Defer dossier stacking, side-by-side
topic comparison, durable topic pages, and any dossier-to-Gravity promotion.

## Promotion gates

1. Sprint 01 has proven the widget host, typed config persistence, chip, and
   clone-and-recommit.
2. The ordered schema is closed, per-block validated, cancellable, and both
   failure states are drawn.
3. The span check is deterministic and re-runs on hydrate.
4. Commit payload is bounded, visible, and carries grounding tags into the frame.
5. **Open — argue before promotion:** whether the `relation` enum is the right
   five (it will want a sixth within a week — who owns additions?); whether a
   repeatedly-derived topic earns a Scratch Pad page; and whether Ask's
   must-cite-or-decline bound is enforceable enough to keep it from quietly
   becoming a second chat.

## Relationship to other widgets

- **Genre Relationship Explorer** ([sibling](genre-relationship-explorer.md)) is
  this widget one scale up: same rail, same dossier grammar, same span
  discipline, with a genre as the relatum instead of a thinker.
- **Learner** supplies the frame vocabulary (frame → evidence → caution →
  question) and the Inspect grammar that Trace inverts.
- **Creative Variations Explorer** supplies the posture dial's ancestry and the
  comparison tray any future dossier stacking should borrow rather than regrow.
- **Lexical Gravity** owns everything standing; this owns nothing standing.
