# Concept Spring: Genre Dictionary — the reference entry for a shelf

**Status**: Concept spring (no design spread yet; shape settled 2026-07-30)
**Priority candidate**: Medium
**Classification**: Conversation Widget — **report widget**, hybrid-sourced
**Likely rail**: One-shot thread artifact
**Depends on**: [Writer's Dictionary](writers-dictionary.md) for the
report-widget form; `PublishingStandardsRepository` for the deterministic half —
expanded per [Publishing Standards: genre data expansion](../../../features/feature-publishing-standards-genre-expansion/feature-publishing-standards-genre-expansion.md)
**Design source**: none yet — needs a spread

## Product idea

Look up a genre and get its **reference entry**: what the industry calls it and
under what code, what it is in plain description, who wrote the books everyone
means when they name it, what its measurable norms are, the characters that
recur in it, and the style conventions that constitute it.

**This is a lookup, not a comparison.** No passage, no chapter, no manuscript is
involved. That is the whole distinction from the
[Genre Relationship Explorer](genre-relationship-explorer.md), which overlays a
chapter and derives how *your* text relates to a shelf. This one describes the
shelf and never mentions you.

Both can exist because they answer different questions:

| | Genre Dictionary (this) | Genre Relationship Explorer |
|---|---|---|
| Question | "What *is* domestic suspense?" | "How does **my chapter** relate to it?" |
| Needs a manuscript | **No** | Yes — a whole chapter |
| Output | A reference entry | Two-sided tells with ¶ addresses |
| Useful when | Before there's a draft; when choosing a shelf; when writing jacket copy | During revision |

## The hybrid — this is the load-bearing idea

Unlike every other report widget, **the Genre Dictionary is not one model call.**
Roughly half its content already exists as **deterministic repository data**, and
half needs generation. Keeping the halves visibly separate is the design.

### Half one: already in the repo, already shipping

[`publishing_standards.json`](../../../../packages/core/resources/repository/publishing_standards.json)
carries per-genre, read via `PublishingStandardsRepository`:

- `word_count_range`, `page_count_range`, `words_per_page`, `page_sizes`
- `formatting` — font size, line spacing, margins
- `literary_statistics` — unique word count, **lexical density**, dialogue
  percentage, avg words/sentence, avg sentences/paragraph, reading time,
  chapter count, avg chapter length, word-length distribution
- `popular_examples` — title, author, and the same measured stats per book

That is the "prose stats for the genre" and a first cut of "well-known authors
and titles" **already sitting on disk, with real numbers, no model involved.**
Ten genres today: YA, Middle Grade, Literary, Romance, Thriller/Mystery, SFF,
Horror, Historical, Non-Fiction/Memoir, Children's Picture Books.

**These blocks must be rendered as repository facts, not regenerated.** A model
asked for Romance's typical word count will produce a plausible number; the repo
has the actual one the rest of the product compares against. Regenerating it
would let the Dictionary and `StandardsComparisonService` disagree about the same
genre in the same session — which is the worst failure this widget could have.

> Per the repo convention: **lexical density is the content-word ratio**
> (non-stopwords / total × 100) — not TTR. The Dictionary must carry that label
> correctly, because it is the surface most likely to teach a writer the wrong
> definition.

### The repository is being overhauled — design for that

**Decision, 2026-07-30: `publishing_standards.json` will be overhauled with many
more properties.** This spring should therefore assume the deterministic half
**grows** and the generated half shrinks. Concretely, most of "half two" below is
a candidate to become repository data rather than model output — description,
BISAC identity, archetypes, and conventions are all stable enough to author once
and read forever.

That makes the **provenance tag the most important thing in the schema**, because
it turns the migration into a non-event:

> A block moving from `generated` → `repository` changes its **tag and its
> source**, never its slot, its shape, or how it renders. The reader-facing entry
> is stable while the sourcing matures underneath it.

Two consequences for whoever does the overhaul:

- **`publishing_standards_schema.json` and `StandardsComparisonService` are
  downstream.** New properties must be additive; the comparison path reads the
  same file and must not break when the Dictionary's fields land.
- **Author for the widest consumer, not just this widget.** Description,
  archetypes, and conventions are equally useful to the Genre Relationship
  Explorer's `expectation` half — which today has *no* grounding at all. Genre
  data authored in the repository is the single highest-leverage way to make that
  half of the Explorer trustworthy.

The block table below tags provenance as of today. Expect the `generated` column
to shrink; the schema should not need to change when it does.

### Half two: needs sourcing (much of it destined for the repository)

- **BISAC code + official heading** — the industry classification (BISG's Book
  Industry Standards and Communications; e.g. `FIC027000` Fiction / Romance /
  General).

  **Mostly generated, and that needs a guard.** There are on the order of four
  thousand BISAC codes across a dozen prefixes; authoring the full list is not
  realistic and, given BISG's terms on redistributing the subject headings,
  probably not permissible either. So codes come from the repository where the
  overhaul covers a genre and are **generated on the fly** everywhere else.

  This is the single most hazardous field in the widget, because a fabricated
  code is *format-perfect and confidently wrong* — and it is the one value a
  writer might paste straight into a KDP or IngramSpark listing. Three
  mitigations, in order of strength:

  1. **Deterministic shape check.** A BISAC code is `^[A-Z]{3}\d{6}$` with a
     prefix from a small known set (`FIC`, `YAF`, `JUV`, `BIO`, `HIS`, …). A
     malformed code or an unknown prefix is **withheld by name** — the same
     discipline the Explorers apply to an unmatched span. Cheap, and it catches
     the sloppiest failures without any list.
  2. **Provenance tag, always visible.** `repository` codes render plainly;
     `generated` codes render tagged, with language that says *verify against
     the current BISAC list before using this on a listing*. Never present a
     generated code as authoritative.
  3. **Prefix + heading must agree.** If the model returns `FIC027000` but a
     heading that isn't Fiction, the block is withheld. A second cheap
     deterministic cross-check on data the model gave us.

  A shape check is not a correctness check, and the entry must not pretend
  otherwise — it proves the code is *well-formed*, not that it is *the right
  one*. Saying so plainly in the advisory block is the price of generating this
  field at all.
- **Description** — plain-language definition of the shelf.
- **Recurring characters / archetypes** — the roles that constitute the genre
  (the amateur sleuth, the reluctant chosen one), not characters from specific
  books.
- **Style conventions** — register, structure, pacing habits, the moves that
  make it recognizable.
- **Neighbors** — adjacent shelves and the axis of difference.

Those four are model-generated or authored; the BISAC code is authored only.

## Proposed schema — `genre-dictionary v0`

Every block carries a **provenance tag**, which is this widget's version of the
Explorers' grounding tags:

`repository` · `authored` · `generated`

| # | Block | Provenance | Notes |
|---|---|---|---|
| 1 | `identity` | repository **or** generated | Name, abbreviation, **BISAC code + official heading** — shape-checked and prefix/heading cross-checked either way; generated codes render tagged *verify before listing* |
| 2 | `description` | generated | What the shelf is, and the neighbor it's confused with |
| 3 | `reader promise` | generated | The contract — shares vocabulary with the Explorer's `dimension` enum |
| 4 | `norms` | **repository** | Word count, page count, chapter count, formatting — rendered from `publishing_standards.json`, never generated |
| 5 | `prose statistics` | **repository** | Lexical density, dialogue %, sentence/paragraph metrics, reading time, word-length distribution |
| 6 | `exemplars` | **repository** + generated | `popular_examples` verbatim with their measured stats; generated titles, if any, tagged separately and never mixed into the measured set |
| 7 | `archetypes` | generated | Recurring roles, not specific characters |
| 8 | `conventions` | generated | Tagged *load-bearing* vs *optional furniture* |
| 9 | `exhausted moves` | generated | Stale conventions **with why**, plus a function-based alternative (mirrors the Writer's Dictionary's clichés-tagged-*avoid* treatment) |
| 10 | `neighbors` | generated | Adjacent shelves + the axis of difference |
| 11 | `advisory` | **required** | What is repository fact, what is inference, what varies by market and era |

**A genre absent from the repository still returns a report** — blocks 4–6 are
withheld by name, the same rule every sibling applies to a failed block, and the
advisory says the norms are unavailable rather than guessed. That is the honest
behavior and it is also the pressure valve for the granularity problem below.

## The granularity problem — argue this before building

The repository holds **ten broad categories** (Romance, Thriller/Mystery). The
Genre Relationship Explorer surveys **fine-grained shelves** ("quiet domestic
noir", "second-chance romance"). These are not the same taxonomy, and BISAC is a
third one again.

Three ways out, in rough order of preference:

1. **Two-tier entry.** The Dictionary answers at whatever granularity is asked;
   repository blocks render from the nearest parent category and **say so**
   ("norms shown for Thriller/Mystery, the nearest category with measured
   standards"). Honest, and it makes the parent/child relationship visible —
   which is useful information in itself.
2. **Restrict to the ten.** Simplest, and immediately disappoints the writer who
   just met "quiet domestic noir" on the Explorer's shelf.
3. **Grow the repository.** Correct long-term — and now **live**, given the
   planned overhaul. The constraint is not effort but sourcing: *measured* stats
   at subgenre granularity ("quiet domestic noir") may simply not exist, whereas
   authored fields (description, conventions, archetypes, BISAC) scale to
   subgenres fine.

**Recommendation: (1) as the rendering rule, (3) as the data plan.** They compose
rather than compete — the parent-category fallback is what makes a partially
populated taxonomy honest while it fills in. Concretely: let a genre entry carry
its *authored* fields at any granularity, and fall back to the nearest parent for
*measured* fields with the disclosure text shown. A subgenre then improves
gradually instead of being all-or-nothing, and the widget never has to guess.

**Corollary for the overhaul:** the schema wants an explicit parent/child link
between genres, not a flat list of ten. That is the structural change to make
early — retrofitting a hierarchy after the properties land is the expensive
version.

## Commit and lifecycle

Standard report-widget rail, inherited unchanged from
[Writer's Dictionary](writers-dictionary.md):

- One-shot `<thread-artifact kind="widget:genre-dictionary">`, whole entry, cost
  disclosed before the press.
- Re-open restores the **input**, never the answer.
- **Never stands.** No pin, no weight, no lens. This is the invariant most at
  risk here — a genre reference is the most pinnable-*looking* thing in the
  registry, and pinning it would be "write more noir" wearing a document
  costume. The Genre *Explorer* may pin because there the writer authored a
  stance about their own chapter; a reference entry contains no such stance.
- **Describes conventions, never quality.** No genre is better; no book fails
  one.
- Save to a project file is the durable door.

## Smallest useful slice

Genre name in → identity + description + repository-backed norms, prose stats,
and exemplars + conventions + archetypes + advisory, with provenance tags and
withheld-by-name for genres outside the repository. Defer the BISAC full list
(carry codes for the ten known genres first), genre-vs-genre comparison, and any
"write toward this genre" affordance — the last one permanently.

## Promotion gates

1. A design spread exists, like every other member of the registry.
2. **The provenance split is enforced in code** — repository blocks read from
   `PublishingStandardsRepository` and are structurally incapable of being
   model-filled. This is the gate that matters; everything else is ordinary.
3. The BISAC guard is implemented — shape check, prefix/heading cross-check,
   provenance tag, and *verify before listing* language on generated codes. The
   licensing question only needs answering if a **list** is ever embedded;
   generating codes on the fly sidesteps redistribution but not the accuracy
   problem, which is what the guard is for.
4. The granularity decision above is made and the disclosure text is drawn.
5. Lexical density is labelled per the repo's definition, not as TTR.
6. Settled: whether the Dictionary is **reachable from the Explorer's survey**
   (click a candidate on the shelf → its entry). That is the obvious integration
   and probably the best discovery path for both widgets.

## Naming

The **Genre Relationship Explorer** name reads oddly now that a second
genre surface exists — "Explorer" suggests browsing, when what it actually does
is hold *one chapter* against *one shelf* and report where it matches, departs,
and subverts. The Dictionary is the browsing surface.

Candidates, if renaming: **Genre Alignment**, **Genre Positioning**, or
**Shelf Check**. *Genre Alignment* is the closest to what the widget does without
implying a verdict — though "alignment" risks sounding like a score, which its
own load-bearing sentence forbids. Worth deciding before either gets a sprint,
while renaming is still free. Not changed here.

## Relationship to the other dictionaries

See [the dictionary family](README.md#the-dictionary-family).
[Writer's Dictionary](writers-dictionary.md) maps a phrase's lexical field;
[Gesture Dictionary](gesture-dictionary-widget.md) maps a gesture's embodied
one; this maps a shelf's conventional and **measured** one. It is the only
member with a deterministic half — which makes it the best evidence that "report
widget" describes a *shape* (bounded subject, ordered document, no curation,
never standing) rather than a *sourcing strategy*.
