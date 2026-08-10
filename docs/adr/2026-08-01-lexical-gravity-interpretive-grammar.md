# ADR 2026-08-01: Lexical Gravity Interpretive Grammar

- **Status**: Accepted; amended 2026-08-07 with first-class Lexical gear,
  independent Tell/Blend/Show evidence mode, and checkpoint recovery; amended
  2026-08-10 to replace planned dominance-weighted blending with a
  model-selected lens stack — implementation verified by interactive F5
  acceptance for the delivered v2 grammar
- **Decision owner**: Okey
- **Extends**: [ADR 2026-07-22 — Conversation Widgets](2026-07-22-conversation-widgets.md)
- **Delivery**: [Sprint 02B-B — Lexical Gravity interpretive grammar](../../.todo/epics/epic-conversation-widgets-2026-07-22/sprints/02b-b-lexical-gravity-interpretive-grammar.md)
- **Implementation gate**: Lifted 2026-08-06 after [Workshop Architecture Refactor Phase 7](../../.todo/epics/epic-workshop-architecture-refactor-2026-08-03/sprints/07-architecture-closure.md) closed and Okey explicitly resumed feature work

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

This must be corrected before a later Lexical Gravity stack or another standing
widget copies the current contract. Selecting among lexical inventories before
lenses have inferential structure would produce weighted vocabulary, not
meaningful alternative world-views.

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

The six writer-facing controls retain narrow meanings:

- **Lens** chooses the interpretive grammar.
- **Application gear** is a hard switch among `lexical`, `interpret`, and
  `recompose`. Lexical applies only the surface word field, preserving the v1
  ability to change diction and imagery without applying Lens Logic. Interpret
  preserves the passage's recognizable arrangement while sharpening its
  semantic reading locally. Recompose retains that inspectable reading but may
  use it as a plan for beat order, attention, revelation, syntax, rhythm, and
  paragraph shape. No gear may invent scene facts.
- **Evidence mode** is an independent `tell | blend | show` instruction for how
  Lexical Gravity's own influence becomes legible. Tell permits direct naming,
  explanation, and compression; Blend chooses a proportionate mixture; Show
  enacts the lens through action, image, behavior, spatial relation, sequence,
  silence, and consequence. It does not replace application gear and does not
  own Prose Controller's independent narrative-handling instruction.
- **Weight** controls how strongly or frequently that grammar influences prose;
  it is not a stakes or consequence value. Its writer-facing bands were redrawn
  from four to five (`trace`, `subtle`, `forward`, `insistent`, `saturating`)
  because the widened scope now includes composition as well as lexical
  realization; this recalibrates the labels, not the control's meaning.
- **Reach** controls lexical distance into the source domain. It does not disable
  Lens Logic in Interpret/Recompose; the explicit Lexical gear is what elects
  not to apply that logic.
- **Metaphor pull** controls permission for explicit cross-domain comparison;
  it does not select whether Lens Logic is active.

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

The two interpretive gears return the same inspectable semantic artifact. In
`interpret`, the rewritten prose enacts it through restrained local revision.
In `recompose`, the rewritten prose must enact it compositionally: at high
Weight, an honest mapping produces a visibly different arrangement rather than
an unchanged passage with domain commentary inserted into it. The evidence mode
governs whether either gear states that interpretation directly, blends
statement with embodiment, or shows it through observable consequence.
`recompose` must not default to explanatory narration merely because the
semantic mapping is available. `lexical` returns no semantic positions,
dynamic, or entailment and demonstrates only the selected surface field, but
its vocabulary may still land through direct statement, a blend, or embodied
detail. Application gear and evidence mode are both part of `configKey`, so
changing either invalidates an earlier preview.

The locked contract is:

```typescript
interface WorkshopLexicalGravitySemanticPosition {
  element: string;
  roleId: string;
  axisId: string | null;
  axisPosition: string | null;
  significance: string;
}

interface WorkshopLexicalGravityPreview {
  version: 2;
  configKey: string;
  sourceText: string;
  semanticPositions: WorkshopLexicalGravitySemanticPosition[];
  selectedDynamicId: string | null;
  openEntailment: string | null;
  text: string;
}

type WorkshopLexicalGravityApplicationMode = 'lexical' | 'interpret' | 'recompose';
type WorkshopLexicalGravityEvidenceMode = 'tell' | 'blend' | 'show';

interface WorkshopLexicalGravityDraft {
  lensSlug: string;
  applicationMode: WorkshopLexicalGravityApplicationMode;
  evidenceMode: WorkshopLexicalGravityEvidenceMode;
  weight: number;
  reach: 1 | 2 | 3;
  metaphorPull: boolean;
  resolvedLens: WorkshopLexicalGravityLens;
  preview?: WorkshopLexicalGravityPreview;
}
```

`roleId`, `axisId`, and `selectedDynamicId` must refer to ids declared by the
resolved lens. `axisId` and `axisPosition` are either both present or both null.
An empty positioning list requires a null dynamic and null entailment. The host
adds `configKey` and `sourceText`; the model returns only the versioned semantic
positions, selected dynamic id, open entailment, and rewritten text.

### 6. Project v1 does not become an interpretive runtime path; session v1 recovers lexically

This is alpha software. Built-ins and generated project lens resources become
v2 together. A v1 project resource is left untouched during discovery and
reported as incompatible with an actionable rebuild message; it is not
heuristically upgraded because inferential structure cannot be reconstructed
deterministically from a word list.

Session-embedded v1 resolved-lens snapshots are different: they are the exact
authoring state a prior Workshop chat used. The feature codec recognizes the
strict old shape and recovers it under the first-class `lexical` gear, preserving
its word field and original standing-frame behavior without inventing Lens
Logic. It defaults evidence mode to Blend, the neutral representation of the
previously unconstrained renderer. Current v2 checkpoints written before the
field existed receive the same deterministic default. Unknown or partially
recognizable shapes still fail closed. See the
[Widget Codec Recovery Mode plan](../../.todo/epics/epic-conversation-widgets-2026-07-22/sprints/02b-b-widget-codec-recovery-mode.md).

Catalog reads report incompatible project resources without editing them:

```typescript
interface WorkshopLexicalGravityLensIncompatibility {
  resourceName: string;
  foundVersion: number | null;
  rebuildQuery: string;
  message: string;
}

interface WorkshopLexicalGravityLensesDataPayload {
  lenses: WorkshopLexicalGravityLens[];
  incompatibleResources: WorkshopLexicalGravityLensIncompatibility[];
  storagePath?: string;
  error?: string;
}
```

A version-1 resource remains byte-for-byte untouched during catalog load. The
writer may explicitly send its exact cataloged filename through **Build lens**,
choose exactly one generated v2 take, and atomically overwrite that file in
place. The repository revalidates that the target is still v1 immediately
before an overwrite, rejects traversal or arbitrary filenames, and preserves
the old file unless temporary-file publication succeeds. This is an authored
replacement, not heuristic migration. Corrupt or unrelated invalid JSON remains
a logged skip rather than being mislabeled as a rebuildable v1 resource.

## CDD reference fixtures

The following fixtures make the complete proposed
`WorkshopLexicalGravityLens` v2 shape concrete for UI design and contract work.
They are intentionally verbose: a Lens Logic view must remain legible with real
content, not only labels and placeholder strings. Photography and Music are v2
forms of built-in lenses. Streetball is adapted from the project-generated
`basketball-streetball-friction` lens and demonstrates that the contract works
for an irregular, socially charged source domain.

The object shape is normative. The specific wording is an acceptance fixture
and may be refined during implementation as long as the distinctions among
premise, attention, axes, roles, dynamics, entailments, affordances, guardrails,
and lexical realization remain intact.

### Shared source passage

All three lenses interpret the same beat from *The Heart-Parchment Chronicles*,
Chapter 3.1:

> “So your invisible friend is perfectly rational,” he interrupted, pressing
> harder into the wound he'd just opened, “but mine means I need help?”
>
> He pressed his thumbnail into the seam of his jeans until it bit. Eyes fixed
> on the window reflection, not the view.
>
> Quiet. The kind that bruises.

This passage is useful because its consequence already exists in scene fact:
Nate crosses a boundary to escape exposure, Ava does not immediately repair the
rupture, and their relationship carries a new condition forward. The lenses may
organize that change differently; none may invent a new action or secret.

### Example 1: Photography

```typescript
const photographyLensV2: WorkshopLexicalGravityLens = {
  version: 2,
  slug: 'photography',
  name: 'Photography',
  source: 'built-in',
  description:
    'Interprets perception and relationship through selection, exposure, latent traces, and the making of durable records.',
  logic: {
    premise:
      'Perception is selective record-making: what is framed and exposed becomes evidence, while what falls outside the frame still shapes the truth by its absence.',
    attention: {
      foregrounds: [
        'what an observer selects from a larger field',
        'boundaries that include one fact and exclude another',
        'changes in visibility, legibility, and exposure',
        'traces that can become evidence or memory'
      ],
      backgrounds: [
        'the fantasy of a complete and neutral view',
        'detail that does not alter selection or interpretation',
        'visual decoration without an observer or consequence'
      ]
    },
    axes: [
      {
        id: 'visibility',
        name: 'Visibility',
        poles: ['concealed', 'exposed']
      },
      {
        id: 'selection',
        name: 'Selection',
        poles: ['outside the frame', 'inside the frame']
      },
      {
        id: 'record-state',
        name: 'Record state',
        poles: ['fleeting impression', 'fixed record']
      }
    ],
    roles: [
      {
        id: 'observer',
        name: 'Observer',
        description:
          'The perceiver whose position, attention, and choices determine what can be seen.'
      },
      {
        id: 'subject',
        name: 'Subject',
        description:
          'The person, object, or truth placed under attention and made available to interpretation.'
      },
      {
        id: 'frame',
        name: 'Frame',
        description:
          'The chosen boundary that grants relevance to what it includes and obscures what it excludes.'
      },
      {
        id: 'record',
        name: 'Record',
        description:
          'The durable impression left after a transient perception has been selected and fixed.'
      }
    ],
    dynamics: [
      {
        id: 'focus',
        operation: 'Focus',
        movement: 'diffuse field -> selected subject',
        entailment:
          'The selected detail gains explanatory weight, and competing details lose immediate authority.',
        narrativeAffordance:
          'Creates a question about why this detail was selected and what the observer is refusing to see.'
      },
      {
        id: 'expose',
        operation: 'Expose',
        movement: 'latent or protected truth -> visible evidence',
        entailment:
          'Once the truth is legible, ignorance becomes harder to claim and response becomes more obligatory.',
        narrativeAffordance:
          'Stores pressure in the gap between what is now known and what a character is willing to acknowledge.'
      },
      {
        id: 'crop',
        operation: 'Crop',
        movement: 'context-rich field -> bounded account',
        entailment:
          'The account becomes clearer but less complete; excluded context may challenge its fairness.',
        narrativeAffordance:
          'Creates asymmetry between the persuasive image a character presents and the larger truth around it.'
      },
      {
        id: 'fix-record',
        operation: 'Fix the record',
        movement: 'transient impression -> durable memory',
        entailment:
          'A passing act becomes part of how the relationship will be interpreted later.',
        narrativeAffordance:
          'Makes repair answerable to a remembered injury rather than allowing the moment to evaporate.'
      }
    ],
    guardrails: [
      'Do not treat the observer as neutral; framing is always a selection.',
      'Do not invent a camera, photograph, or visual fact that the passage does not contain.',
      'Do not equate concealment with guilt or exposure with moral truth.',
      'Prefer consequences of attention and record-making over decorative light imagery.'
    ]
  },
  degrees: {
    1: {
      nouns: ['aperture', 'exposure', 'frame', 'shutter', 'negative'],
      verbs: ['focus', 'expose', 'frame', 'develop', 'capture'],
      modifiers: ['overexposed', 'blurred', 'sharp', 'backlit']
    },
    2: {
      nouns: ['grain', 'contrast', 'darkroom', 'silhouette', 'light-leak'],
      verbs: ['crop', 'burn', 'fix', 'enlarge'],
      modifiers: ['grainy', 'high-contrast', 'sepia', 'unfocused']
    },
    3: {
      nouns: ['silver bath', 'ghosting', 'latency', 'contact sheet'],
      verbs: ['bracket', 'dodge', 'redevelop'],
      modifiers: ['halated', 'solarized', 'undeveloped']
    }
  },
  gradient: [
    'glance',
    'look',
    'gaze',
    'study',
    'frame',
    'exposure',
    'contact print'
  ],
  cliches: [
    { worn: 'picture-perfect', fresh: 'framed too carefully to trust' },
    { worn: 'a snapshot in time', fresh: 'one frame pulled from the reel' },
    { worn: 'rose-tinted lenses', fresh: 'printed warmer than it was shot' },
    { worn: 'the big picture', fresh: 'the whole contact sheet' }
  ],
  substitutions: {
    plan: 'framing',
    conflict: 'glare',
    agreement: 'focus',
    turning: 'the develop',
    ending: 'the final print'
  },
  metaphor: 'the whole evening a contact sheet he would never print',
  sample:
    'Nate narrowed the whole argument to one exposed frame: her invisible friend against his. When Ava said nothing, the silence fixed the image; whatever apology came next would have to answer what it showed.'
};
```

Illustrative Preview interpretation:

- **Positioning**: Nate is the observer/editor; Ava's faith becomes the selected
  subject; his false equivalence is the frame; Ava's silence begins converting
  the exchange from a fleeting injury into a record.
- **Selected dynamic**: `fix-record` — transient impression -> durable memory.
- **Open entailment**: Ava now has evidence that Nate may weaponize what she
  holds sacred when cornered. Later repair must answer that knowledge; ordinary
  banter cannot simply put the moment outside the frame.
- **Rewritten passage**: “Nate narrowed the whole argument to one exposed
  frame: her invisible friend against his. When Ava said nothing, the silence
  fixed the image; whatever apology came next would have to answer what it
  showed.”

### Example 2: Music

```typescript
const musicLensV2: WorkshopLexicalGravityLens = {
  version: 2,
  slug: 'music',
  name: 'Music',
  source: 'built-in',
  description:
    'Interprets relationship through patterned time, expectation, countervoice, interruption, resonance, and resolution withheld or achieved.',
  logic: {
    premise:
      'Meaning unfolds in time: voices establish patterns, answer or interrupt one another, create expectations, and make silence active whenever resolution is delayed.',
    attention: {
      foregrounds: [
        'timing between action and response',
        'repetition, variation, and broken patterns',
        'how separate voices support, compete with, or interrupt one another',
        'silence and delay as active parts of an exchange'
      ],
      backgrounds: [
        'isolated statements detached from their sequence',
        'silence treated as empty space',
        'emotional intensity without rhythm, expectation, or response'
      ]
    },
    axes: [
      {
        id: 'relation',
        name: 'Voice relation',
        poles: ['consonance', 'dissonance']
      },
      {
        id: 'time',
        name: 'Temporal pressure',
        poles: ['pulse', 'suspension']
      },
      {
        id: 'closure',
        name: 'Closure',
        poles: ['unresolved', 'resolved']
      }
    ],
    roles: [
      {
        id: 'voice',
        name: 'Voice',
        description:
          'A character, desire, or claim that establishes a distinct line in the exchange.'
      },
      {
        id: 'countervoice',
        name: 'Countervoice',
        description:
          'A responding line whose agreement, resistance, or independence changes the meaning of the first.'
      },
      {
        id: 'pulse',
        name: 'Pulse',
        description:
          'The established timing or repeated pattern against which changes become perceptible.'
      },
      {
        id: 'rest',
        name: 'Rest',
        description:
          'A bounded absence of sound or response that holds expectation rather than erasing it.'
      }
    ],
    dynamics: [
      {
        id: 'syncopate',
        operation: 'Syncopate',
        movement: 'expected response -> displaced or interrupted response',
        entailment:
          'The established pattern can no longer predict what comes next.',
        narrativeAffordance:
          'Creates alertness and instability by making a familiar relationship miss its expected beat.'
      },
      {
        id: 'modulate',
        operation: 'Modulate',
        movement: 'established tonal center -> new tonal center',
        entailment:
          'Earlier words remain present but acquire a different emotional meaning under the new relation.',
        narrativeAffordance:
          'Turns an apparently familiar exchange into a new kind of conversation whose rules are not yet settled.'
      },
      {
        id: 'introduce-dissonance',
        operation: 'Introduce dissonance',
        movement: 'compatible voices -> strained interval',
        entailment:
          'The voices can coexist, but their relation now produces pressure that asks for continuation or resolution.',
        narrativeAffordance:
          'Stores energy in a disagreement that neither silence nor forward motion has yet answered.'
      },
      {
        id: 'hold-rest',
        operation: 'Hold the rest',
        movement: 'active exchange -> charged silence',
        entailment:
          'The missing response becomes meaningful, and the initiating voice must remain exposed inside the pause.',
        narrativeAffordance:
          'Makes withheld reply an unresolved event that changes the next permissible beat.'
      }
    ],
    guardrails: [
      'Do not make every exchange harmonious; dissonance can be structurally honest.',
      'Do not invent audible music, instruments, or performance where the passage supplies none.',
      'Do not treat silence as consent, forgiveness, or emotional emptiness.',
      'Prefer timing and relation among voices over ornamental sound vocabulary.'
    ]
  },
  degrees: {
    1: {
      nouns: ['tempo', 'chord', 'key', 'refrain', 'cadence'],
      verbs: ['tune', 'resolve', 'swell', 'hum'],
      modifiers: ['off-key', 'muted', 'resonant', 'minor']
    },
    2: {
      nouns: ['dissonance', 'downbeat', 'tremolo', 'rest', 'interval'],
      verbs: ['modulate', 'syncopate', 'harmonize', 'transpose'],
      modifiers: ['staccato', 'legato', 'atonal']
    },
    3: {
      nouns: ['coda', 'attack', 'decay', 'overtone', 'cadenza'],
      verbs: ['orchestrate', 'improvise', 'retune'],
      modifiers: ['contrapuntal', 'unresolved', 'polyphonic']
    }
  },
  gradient: [
    'plan',
    'outline',
    'pattern',
    'sequence',
    'arrangement',
    'composition',
    'score'
  ],
  cliches: [
    { worn: 'struck a chord', fresh: 'resonated in a minor key' },
    { worn: 'music to my ears', fresh: 'landed like a held note' },
    {
      worn: 'marching to their own drum',
      fresh: 'keeping a time signature nobody else could count'
    },
    { worn: 'change their tune', fresh: 'modulate mid-phrase' }
  ],
  substitutions: {
    plan: 'score',
    conflict: 'dissonance',
    agreement: 'harmony',
    turning: 'key change',
    ending: 'coda'
  },
  metaphor: 'her patience a held note going flat',
  sample:
    'Nate cut across her sentence and drove the argument into a harsher key. Ava\'s answer never arrived; the rest held between them, unresolved, and the old cadence of their friendship could not simply resume.'
};
```

Illustrative Preview interpretation:

- **Positioning**: Nate and Ava are independent voices; their familiar
  back-and-forth is the pulse; his interruption breaks that pulse; her silence
  becomes a rest rather than an absent reaction.
- **Selected dynamic**: `hold-rest` — active exchange -> charged silence.
- **Open entailment**: Nate's accusation continues sounding inside the withheld
  answer. Their old conversational cadence cannot resume honestly until the
  dissonance is acknowledged.
- **Rewritten passage**: “Nate cut across her sentence and drove the argument
  into a harsher key. Ava's answer never arrived; the rest held between them,
  unresolved, and the old cadence of their friendship could not simply resume.”

### Example 3: Asphalt Friction & Streetball Energy

```typescript
const streetballFrictionLensV2: WorkshopLexicalGravityLens = {
  version: 2,
  slug: 'basketball-streetball-friction',
  name: 'Asphalt Friction & Streetball Energy',
  source: 'project',
  originQuery: 'basketball',
  variant: 'Streetball Friction',
  description:
    'Frames power struggles, reputation, and kinetic encounters through the rough texture, chain-link urgency, and improvised rules of playground basketball.',
  logic: {
    premise:
      'An encounter is an improvised contest for space, control, and witnessed legitimacy; without a referee, boundaries matter most when someone crosses one and the other person decides whether play can continue.',
    attention: {
      foregrounds: [
        'who controls the available space and pace',
        'feints that manipulate another person into committing',
        'contact, boundary violations, and what goes uncalled',
        'reputation created by how pressure is answered in public or remembered afterward'
      ],
      backgrounds: [
        'the assumption that formal rules will enforce fairness',
        'private intention when outward action has already changed the encounter',
        'motion that does not alter leverage, access, or respect'
      ]
    },
    axes: [
      {
        id: 'control',
        name: 'Control',
        poles: ['on defense', 'in possession']
      },
      {
        id: 'space',
        name: 'Available space',
        poles: ['contained', 'open lane']
      },
      {
        id: 'standing',
        name: 'Social standing',
        poles: ['exposed', 'respected']
      }
    ],
    roles: [
      {
        id: 'ballhandler',
        name: 'Ballhandler',
        description:
          'The actor with initiative who controls the immediate direction and risks losing credibility with the move.'
      },
      {
        id: 'defender',
        name: 'Defender',
        description:
          'The person forced to read intention, protect a boundary, and choose how much pressure to absorb.'
      },
      {
        id: 'court',
        name: 'Court',
        description:
          'The social or physical space whose constraints determine which moves are available and visible.'
      },
      {
        id: 'witness',
        name: 'Witness',
        description:
          'The audience or remembered future self before whom the encounter establishes reputation and consequence.'
      }
    ],
    dynamics: [
      {
        id: 'sell-feint',
        operation: 'Sell the feint',
        movement: 'declared direction -> committed opposite direction',
        entailment:
          'The other person acts on a false read, and apparent intention becomes less trustworthy afterward.',
        narrativeAffordance:
          'Creates future hesitation: the next sincere move may still be read as manipulation.'
      },
      {
        id: 'drive-lane',
        operation: 'Drive the lane',
        movement: 'contested boundary -> claimed interior space',
        entailment:
          'The defender must yield, collide, or expose another opening; neutrality is no longer available.',
        narrativeAffordance:
          'Forces a consequential response by turning pressure into an immediate boundary decision.'
      },
      {
        id: 'uncalled-foul',
        operation: 'Commit an uncalled foul',
        movement: 'accepted contest -> boundary violation without external judgment',
        entailment:
          'The injured party, not an authority, must decide whether the encounter can continue and on what terms.',
        narrativeAffordance:
          'Stores accountability in the absence of enforcement; continuation itself becomes conditional.'
      },
      {
        id: 'check-ball',
        operation: 'Check the ball',
        movement: 'stopped play -> mutually acknowledged restart',
        entailment:
          'Resumption requires a minimal exchange of recognition, but it does not erase the previous contact.',
        narrativeAffordance:
          'Makes renewed contact or conversation depend on consent that may be delayed or withheld.'
      }
    ],
    guardrails: [
      'Do not invent a game, crowd, court, or physical violence where the passage supplies none.',
      'Do not romanticize cruelty as toughness or treat injury as proof of weakness.',
      'Do not assume winning grants moral legitimacy.',
      'Prefer leverage, boundary, response, and reputation over dense basketball jargon.'
    ]
  },
  degrees: {
    1: {
      nouns: ['asphalt', 'hoop', 'chain-link', 'pavement', 'drive', 'dunk', 'foul'],
      verbs: ['slam', 'fake', 'hustle', 'dribble', 'challenge', 'juke', 'bounce'],
      modifiers: ['rough', 'relentless', 'gritty', 'bare-knuckle', 'fast', 'unpolished']
    },
    2: {
      nouns: ['blacktop', 'iron', 'pickup', 'isolation', 'trash-talk', 'stoppage', 'playground'],
      verbs: ['shake', 'bluff', 'crossover', 'call-check', 'strut', 'stutter-step', 'carve'],
      modifiers: ['double-teamed', 'uncalled', 'iron-hard', 'foul-mouthed', 'raw', 'asphalt-pitted']
    },
    3: {
      nouns: ['chain-mesh', 'half-court', 'handle', 'finger-roll', 'heat-check', 'ankle-breaker', 'brick'],
      verbs: ['freeze', 'sell', 'brick', 'sky', 'strip', 'disrobe', 'blast'],
      modifiers: ['street-tested', 'netless', 'off-grid', 'unforgiving', 'high-wire', 'chain-rattled']
    }
  },
  gradient: [
    'pavement',
    'hoop',
    'drive',
    'blacktop',
    'crossover',
    'chain-mesh',
    'ankle-breaker',
    'heat-check'
  ],
  cliches: [
    { worn: 'no harm, no foul', fresh: 'uncalled scrapes on rough asphalt' },
    { worn: 'take it to the house', fresh: 'carving straight into the iron' },
    { worn: 'game changer', fresh: 'a brutal ankle-breaker' },
    { worn: 'airball', fresh: 'a hollow miss past bare chain-link' }
  ],
  substitutions: {
    plan: 'playbook',
    conflict: 'clash',
    agreement: 'check-call',
    turning: 'breakdown',
    ending: 'game-shot'
  },
  metaphor:
    'social friction as an unrefereed blacktop game played against unforgiving iron',
  sample:
    'Cornered, Nate sold the feint and drove at the one boundary Ava expected him to respect. No whistle came. Her silence checked the game dead, leaving him to learn whether she would ever put the ball back in play.'
};
```

Illustrative Preview interpretation:

- **Positioning**: Nate is the ballhandler with conversational initiative; Ava
  defends the boundary around her faith; the car is the constrained court; each
  will remain a witness to what Nate does under pressure.
- **Selected dynamic**: `uncalled-foul` — accepted contest -> boundary violation
  without external judgment.
- **Open entailment**: No authority can reset the exchange for them. Ava now
  controls whether conversation resumes and on what terms; Nate cannot treat
  continued proximity as proof that the foul did no damage.
- **Rewritten passage**: “Cornered, Nate sold the feint and drove at the one
  boundary Ava expected him to respect. No whistle came. Her silence checked
  the game dead, leaving him to learn whether she would ever put the ball back
  in play.”

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
- A future model-selected stack can preserve several independent world-views
  without merging their word bags or pretending the writer supplied arithmetic
  dominance.
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
- **Keep every v1 project lens as a second installable lens variant.** Rejected:
  it creates two project-resource meanings of "lens," complicates lens stacking, and
  makes every downstream consumer branch on a temporary alpha representation.
  The amended decision instead makes Lexical a first-class application gear for
  current v2 lenses and permits only exact session-embedded v1 snapshots in a
  bounded recovery arm.
