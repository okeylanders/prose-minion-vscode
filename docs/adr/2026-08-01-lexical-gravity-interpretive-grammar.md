# ADR 2026-08-01: Lexical Gravity Interpretive Grammar

- **Status**: Proposed
- **Decision owner**: Okey
- **Extends**: [ADR 2026-07-22 — Conversation Widgets](2026-07-22-conversation-widgets.md)
- **Delivery**: [Sprint 02B-B — Lexical Gravity interpretive grammar](../../.todo/epics/epic-conversation-widgets-2026-07-22/sprints/02b-b-lexical-gravity-interpretive-grammar.md)

## Context

Lexical Gravity currently names an interpretive lens but serializes mainly a
lexical field: three degrees of nouns, verbs, and modifiers; a gradient;
substitutions; cliché contrasts; a governing metaphor; and a sample. The
standing directive then asks that field to influence diction and imagery.

That contract can produce vivid language, but it leaves the important work
implicit. A Photography lens matters not because it contains *focus*, *frame*,
and *exposure*, but because focusing foregrounds one thing and excludes another;
framing selects; exposure reveals and creates responsibility; development makes
latent traces legible; and fixing turns a transient perception into a durable
record. Those relations and entailments are not represented in the v1 lens
codec. The model must rediscover them on every preview and prose turn.

The missing layer also limits narrative consequence. A word field can tint a
sentence without changing the reader's model of the scene. Consequence begins
when the lens positions scene elements in relation to one another, performs a
meaningful transition, and leaves an expectation, obligation, asymmetry, or
instability behind. The prose need not resolve that stored pressure, but it
should be able to create it deliberately.

This must be corrected before lens blending or another standing widget copies
the current contract. Blending lexical inventories before lenses have
inferential structure would produce weighted vocabulary, not layered
world-views.

## Decision

### 1. A lens is an interpretive grammar with a lexical realization layer

`WorkshopLexicalGravityLens` advances to version 2 and gains one required
`logic` object:

```typescript
interface WorkshopLexicalGravityLensLogic {
  premise: string;
  attention: {
    foregrounds: string[];
    backgrounds: string[];
  };
  axes: Array<{
    id: string;
    name: string;
    poles: [string, string];
  }>;
  roles: Array<{
    id: string;
    name: string;
    description: string;
  }>;
  dynamics: Array<{
    id: string;
    operation: string;
    movement: string;
    entailment: string;
    narrativeAffordance: string;
  }>;
  guardrails: string[];
}
```

The existing degrees, gradient, substitutions, cliché contrasts, metaphor, and
sample remain. They are explicitly the **lexical realization layer**, not the
definition of the lens.

The codec owns exact keys, bounded strings and collection sizes, slug-shaped
unique ids, a two-pole axis tuple, cloning, and prompt-budget safety. Bounds live
in `promptBudgets`; no model-facing limit is local to the codec or prompt
parser.

### 2. Semantic positioning is passage-specific and transient

The reusable lens stores possible roles, axes, and dynamics. It does **not**
store a mapping from a particular character or object to those positions.
During preview or prose generation, the model briefly maps facts already in the
current passage to the lens grammar. That semantic positioning is derived work,
not project-lens truth and not session-persisted widget configuration.

The committed session config continues to snapshot the resolved v2 lens so the
standing directive is historically stable.

### 3. Prose generation follows a fixed ordering

The standing directive instructs the model to:

1. Preserve scene facts, viewpoint, character voice, and requested meaning.
2. Position existing scene elements in the lens's roles or axes when the fit is
   genuine.
3. Select at most one useful lens dynamic for a local beat.
4. Let its entailment sharpen attention, relationship, expectation, or
   instability when that matters to a character concern.
5. Realize the result through the lexical field only after the semantic move is
   chosen.

If the passage offers no honest mapping, the model keeps the influence subtle or
does nothing. It must not invent a prop, secret, intention, or plot event merely
to demonstrate the lens.

### 4. Narrative charge is an affordance, not a new control or score

`narrativeAffordance` describes what kind of open pressure a dynamic *can*
create. It does not require suspense in every beat, quantify consequence, or
introduce a consequence meter.

The four writer-facing controls retain narrow meanings:

- **Lens** chooses the interpretive grammar.
- **Weight** controls how strongly or frequently that grammar influences prose;
  it is not a stakes or consequence value.
- **Reach** controls lexical distance into the source domain; it does not disable
  the lens logic.
- **Metaphor pull** controls permission for explicit cross-domain comparison;
  the interpretive grammar remains active when it is off.

### 5. Preview makes the interpretation inspectable

The preview model seam advances to a strict versioned composite response with:

- a bounded list of concise semantic-position mappings;
- the selected lens dynamic, if any;
- the open entailment or instability it creates, if any; and
- the rewritten passage.

These are writer-facing declarative artifacts, not hidden chain-of-thought. The
UI presents them as an explanation of what the lens noticed and moved, making it
possible to distinguish an interpretive change from vocabulary wearing a
costume.

### 6. Version 1 does not remain as a second runtime path

This is alpha software. The v2 codec replaces v1 rather than adding optional
logic or a compatibility union. Built-ins and generated project lenses become
v2 together. A v1 project resource is left untouched on disk and reported as
incompatible with an actionable regeneration message; it is not heuristically
upgraded because inferential structure cannot be reconstructed deterministically
from a word list. Pre-v2 development session snapshots are likewise not a
supported persistence contract.

## Accountability tests

A lens application passes only when these questions have answers:

1. What scene state or relationship existed before the sentence?
2. What lens-native movement occurred?
3. Why does that movement matter to a character concern or reader expectation?
4. What implication, obligation, asymmetry, or instability remains afterward?
5. If every conspicuous lens word is removed, does the interpretive effect
   remain?

The fifth question is the costume test. A rewrite that merely contains unusual
field vocabulary fails even if it is fluent.

## Consequences

### Positive

- The lens contract represents how a domain organizes attention and inference,
  not only which words belong to it.
- Preview becomes debuggable and writer-accountable.
- Narrative consequence can emerge from semantic movement without forcing plot
  invention or immediate resolution.
- Future dominance-weighted blends can layer world-views rather than merge word
  bags.
- `weight`, `reach`, and `metaphorPull` stop carrying ambiguous semantic jobs.

### Costs and risks

- Lens resources, the builder protocol, preview protocol, built-ins, directive
  frame, repository validation, UI, and tests change together.
- The standing frame grows; prompt budgets must be measured against worst-case
  validated lenses rather than raised speculatively.
- Generated logic can sound profound while saying nothing. Exact structure and
  the accountability tests reduce that risk but do not eliminate semantic
  judgment.
- Version 1 project lenses require explicit regeneration during alpha.

## Alternatives considered

- **Add stronger prose instructions without changing the codec.** Rejected: the
  model would still infer a different lens grammar on each run, and project
  lenses could not be inspected or validated.
- **Add consequence templates only.** Rejected: consequence without attention,
  roles, axes, and entailments becomes generic foreshadowing pasted over a word
  field.
- **Treat high weight as high consequence.** Rejected: lexical saturation and
  narrative potential are independent. One quiet attention reversal can carry
  more consequence than a paragraph saturated with lens terminology.
- **Preserve v1 as a lexical-only variant.** Rejected: it creates two meanings of
  "lens," complicates blending, and makes every downstream consumer branch on a
  temporary alpha representation.

