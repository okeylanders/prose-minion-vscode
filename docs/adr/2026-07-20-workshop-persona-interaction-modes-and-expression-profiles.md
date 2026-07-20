# ADR: Workshop Persona Interaction Modes and Expression Profiles

- **Status:** Draft — architecture, defaults, UI direction, and the guarded
  between-run system-message replacement boundary accepted 2026-07-20;
  implementation is not part of Sprint 12 or Sprint 10 until promoted into an
  explicit sprint
- **Date:** 2026-07-20
- **Deciders:** Okey Landers, Ada Forge
- **Related:**
  - [Workshop Persona-Hosted Conversations](2026-07-09-workshop-persona-hosted-conversations.md)
    — Section 2 refines its lifetime-wide system-prompt immutability rule
  - [Workshop Excerpt Revision and Room Memory](2026-07-11-workshop-excerpt-revision-and-room-memory.md)
  - [Workshop Guest Persona Sidecars](2026-07-11-workshop-guest-persona-sidecars.md)
  - [Workshop Session Persistence](2026-07-14-workshop-session-persistence.md)
  - [Workshop Living Room Chronicle and Episodic Persona Memory](2026-07-18-workshop-living-room-chronicle-and-episodic-memory.md)
  - [Workshop persona authoring guide](../../packages/core/resources/system-prompts/workshop-personas/README.md)

## Context

Workshop personas now have distinct occupations, craft jurisdictions, reasoning
procedures, social postures, sentence behavior, private candidate-selection
rules, praise and disagreement behavior, and relationships with their
colleagues. This is a strong identity foundation. The current host contract,
however, still pulls most ordinary turns toward an analysis-first response:
find the highest-impact observation, explain it, and offer practical next
moves.

That baseline is useful but incomplete. A writer may want three materially
different kinds of exchange with the same person:

- a deliberate analysis of the pages;
- a balanced workshop exchange that mixes conversation with focused craft
  guidance; or
- an actual conversation in which the persona follows the writer's thought,
  asks questions, reacts, and does not turn every turn into a report.

These are not three identities. Jill should remain Jill, Quinn should remain
Quinn, and Penny should remain Penny. The writer is changing the room's
interaction posture, not replacing the person.

There is a second, related problem. Even well-differentiated persona prompts can
converge toward a polished assistant median at the level of word choice. In the
project's recent use, model responses repeatedly reach for the same broadly
useful expert vocabulary and metaphor families: architecture, structure,
scaffolding, load-bearing parts, signals, friction, wallpaper, things that land,
and things that earn their place. Those phrases are not intrinsically bad.
Repetition across unrelated speakers makes them evidence of a shared model
voice rather than a particular human voice.

The cause does not need to be settled here. The design problem is observable:
when several accurate phrasings are available, the model repeatedly selects a
high-probability middle-gradient phrase. A recognizable person should exert
some lexical gravity of their own. Felix may naturally reach for breath, tempo,
rests, pressure, and resolution. Dev may hear playable action and rehearsal.
Penny may avoid professional metaphor almost entirely and simply report where
she became interested or stopped believing the page.

Finally, personality requires pressure and imperfection. A persona made only
of virtues becomes an agreeable competence bundle. A persona made of isolated
"bad traits" becomes a caricature. Useful flaws are the shadows cast when a
real strength extends too far: conviction can become dogmatism, pattern
sensitivity can become obsession, generosity can become overprotection, and
taste can become snobbery. The prompt needs the strength, the shadow, the
conditions that awaken it, and the person's way of regulating or repairing it.

## Decision summary

Workshop persona behavior will be designed as a layered control stack:

```text
Shared host contract
    -> stable persona identity
    -> stable expression profile
       (trait tensions, tastes, turn-taking signature, verbal palette)
    -> writer-selected expression level
       (subtle | full)
    -> writer-selected interaction mode
       (analysis | balanced | conversational)
    -> current-turn reactivity
       (whether delivery may respond to observable writer cues)
    -> optional session attunement
       (extension-owned, bounded interaction preferences)
    -> response
```

The layers have different ownership and lifetimes:

| Layer | Owner | Lifetime | May change mid-conversation? |
|---|---|---|---|
| Host contract | Product | Release | No |
| Persona identity | Product/persona author | Persona version | No |
| Expression profile | Product/persona author | Persona version | No |
| Expression level | Writer | Session state, stamped per turn | Yes, between turns |
| Interaction mode | Writer | Session state, stamped per turn | Yes, between turns |
| Current-turn reactivity | Writer | Session preference applied per turn | Yes, between turns |
| Session attunement | Writer/extension | Current Workshop session | Yes; may be cleared |
| Cross-session preferences | Writer | Future, explicit opt-in only | Yes; inspectable and deletable |
| Living Room/persona state | Validated product context | Frozen session snapshot | Only in a new session snapshot |

Each interaction mode is defined once in its own shared prompt resource. The
selected mode resource is concatenated into the system prompt independently of
persona identity. Modes are not forked into persona-specific prompt files. Each
persona prompt describes only how that stable person naturally inflects the
shared modes.

The design deliberately avoids a twelve-persona by three-mode prompt matrix.
There will not be 36 persona-mode prompt files.

## Goals

1. Let the writer choose analysis, balanced, or conversational interaction
   without starting a new persona or losing retained context.
2. Preserve stable identity while changing conversational posture.
3. Give every persona strengths with bounded shadows rather than a list of
   uniformly admirable traits.
4. Make macro-level turn-taking and self-disclosure as distinctive as sentence
   rhythm and specialty vocabulary.
5. Shift lexical selection away from the shared assistant median without
   forcing rare words, purple prose, catchphrases, or Mad Libs.
6. Keep modes, personality, and lexical flavor testable through prompt assembly
   tests and repeatable qualitative evaluation.
7. Preserve writer ownership, factual honesty, capability limits, provenance,
   and task-extraction contracts in every mode.
8. Let the writer control persona-expression strength and adaptation without
   weakening the immutable persona identity contract.
9. Give any retained attunement state an explicit lifetime, inspection path,
   and deletion path rather than treating model reasoning as storage.
10. Preserve a prompt-assembly seam that can later trade cache reuse for
    stronger expression-level separation if evaluation shows a quality gain.
11. Give the selected interaction mode system-prompt priority while preserving
    trusted historical frames that explain mode changes across a retained chat.

## Non-goals

- Diagnosing the writer's mood, personality, or mental health.
- Persisting a hidden emotional profile of the writer.
- Treating provider reasoning or a retained model conversation as an
  authoritative memory store.
- Turning psychiatric labels into runtime sliders.
- Allowing persona flaws to justify cruelty, manipulation, fabrication, or
  unusable feedback.
- Giving deterministic tools or tool sidecars conversational modes.
- Replacing a retained system message during an active run.
- Replacing system messages for frame-only expression, reactivity, or
  attunement changes in the initial implementation.
- Generating a separate prompt file for every persona-mode combination.
- Forcing preferred words into replies regardless of meaning.
- Solving Living Room generation, Room Ledger persistence, or day-card state in
  this ADR.
- Defining generation, storage, retention, or synchronization semantics for
  shared room history; the modal may reserve a future home for that separate
  ADR, but this decision does not implement it.
- Authorizing implementation inside the current Workshop epic without an
  explicit scope and sequencing decision.

## 1. Three writer-controlled interaction modes

Use a closed semantic type:

```ts
export type WorkshopInteractionMode =
  | 'analysis'
  | 'balanced'
  | 'conversational';
```

The UI labels are code-owned and deterministic:

```text
Analyze | Balanced | Converse
```

The stored/message value remains the full semantic name. Labels may be polished
after prototype testing without changing the contract.

New Workshop sessions default to `balanced`. It best expresses the product's
persona-hosted conversation direction while keeping focused craft help close at
hand. `analysis` remains the explicit choice for the current report-oriented
baseline, and `conversational` remains the explicit choice for a more dialogic
exchange. Hydration boundaries use the complete approved default object in
Section 3 rather than inventing per-field fallbacks.

### Analysis

Analysis is the current behavioral baseline.

- Lead with the most important page-level finding.
- Trace evidence to diagnosis and consequence.
- Prioritize rather than spraying every possible note.
- Use headings, bullets, comparisons, or examples when they improve inspection.
- Ask a clarifying question when missing evidence would materially change the
  diagnosis, not merely to keep the conversation moving.
- Offer concrete next moves when real work follows.
- Do not manufacture problems when the passage holds.

Analysis does not require stiffness, maximal length, or loss of persona. It is a
response contract, not a license to become a report generator.

### Balanced

Balanced is a workshop exchange: human contact plus focused craft usefulness.

- Answer the writer as a person before expanding into diagnosis.
- Usually center one meaningful observation or tension rather than a complete
  review.
- Mix reaction, evidence, and one practical direction in natural proportions.
- Ask questions when the writer's intention is part of the craft decision.
- Keep structure available but do not impose a report shape on every turn.
- Let praise, humor, uncertainty, and disagreement remain recognizable parts of
  the exchange.

Balanced must not mean vague, pleasant, or generic. It is the middle in
interaction density, not the middle in conviction or personality.

### Conversational

Conversational mode treats the Workshop as an actual continuing dialogue.

- Prefer shorter, responsive turns unless the writer explicitly asks for depth.
- Follow the writer's immediate thought instead of automatically broadening the
  scope.
- Ask a real question when another turn would produce a better answer than an
  unsolicited lecture.
- React, wonder, disagree, encourage, joke, or make a bounded personal
  connection in the persona's own manner.
- Do not force critique, headings, a recap, or `### Next steps` merely because
  an excerpt is present.
- Remain capable of precise analysis when the writer requests it.

Conversational mode is not ambient roleplay. The writer and their pages remain
the center of the room.

### Explicit writer intent outranks the mode's default motion

The mode supplies a default posture, not a content firewall.

- "Analyze this exchange" receives analysis even in conversational mode, but
  the persona may deliver it with a more dialogic rhythm.
- "Can I just think out loud with you?" is answered conversationally even in
  analysis mode rather than being converted into an unsolicited full report.
- A deterministic tool run remains a tool run in every mode.
- A host's synthesis of a completed tool report uses the active persona mode;
  the verbatim tool artifact never does.

## 2. Mode changes replace retained system messages between runs

The selected interaction mode belongs at system-prompt priority because it is a
foundational response contract, not merely a turn-level tone hint. This decision
qualifies the earlier persona-hosted conversation invariant that treated a
retained conversation's system prompt as immutable for its entire lifetime.

The actual retained conversation is extension-owned state in
`ConversationManager`: a local id maps to a message array whose first entry is
the system message. OpenRouter receives the current array on each inference.
The necessary invariant is therefore narrower and more honest:

> A retained system message may be replaced atomically between runs. It must
> never change while a run is reading or committing that conversation.

Use one shared invariant resource and three separate mode resources:

```text
packages/core/resources/system-prompts/workshop-personas/interaction-contract.md
packages/core/resources/system-prompts/workshop-personas/interaction-modes/analysis.md
packages/core/resources/system-prompts/workshop-personas/interaction-modes/balanced.md
packages/core/resources/system-prompts/workshop-personas/interaction-modes/conversational.md
```

`interaction-contract.md` defines precedence, explicit-writer-intent rules,
expression-level semantics, reactivity and attunement boundaries, historical
frame interpretation, and invariant product constraints. It does not contain
the full definitions of all three response styles. Exactly one selected mode
resource is concatenated into each persona host or guest system prompt.

Mode resources contain no persona names or specialist instructions. This adds
three shared prompts, not a persona-by-mode matrix. Jill, Quinn, and every other
persona consume the same selected mode contract through their own identity and
expression resources.

Every persona-targeted writer turn carries a small extension-authored frame:

```xml
<workshop-interaction
  mode="balanced"
  expression="full"
  react-to-current-message="true"
  carry-cues-through-session="true"
/>
```

The frame contains closed, validated values only. It is reserved in the
Workshop delimiter neutralizer, cannot be supplied by writer text, and is
included on every applicable turn. Historical frames remain attached to their
committed writer turns while history is retained or reconstructed after restore.
They explain why an earlier persona reply may use a different response style
even though that earlier mode resource is no longer present in the current
system prompt.

When the writer changes modes, add a trusted transition frame before the next
persona-directed writer message:

```xml
<workshop-interaction-transition
  from="balanced"
  to="conversational"
  reason="writer-selected"
/>
```

The transition is extension-authored metadata, not writer prose and not a
standalone model call. It tells the model that variation in the retained chat
is an intentional contract change rather than persona drift. The ordinary
active behavior frame remains present on the same turn and is authoritative
for that turn.

If the writer changes modes more than once before sending another persona turn,
coalesce the pending transition from the mode that governed the last committed
persona reply to the final selected mode. A mode that never governed a model
turn does not become fictional transcript history.

A mode change:

- is accepted only between active runs;
- assembles replacement system prompts containing the newly selected mode
  resource for the host and every live persona guest;
- validates all affected conversation ids and replacement prompts before
  mutation;
- replaces only the first system message of each affected persona conversation
  as one synchronous batch;
- preserves the same conversation ids, committed non-system history, pinned
  state, and monotonic artifact numbering;
- clears each affected provider-measured context-budget snapshot because it was
  measured against the previous system prompt;
- commits the room behavior object only after prompt assembly and batch
  validation succeed;
- does not trigger a model completion by itself;
- does not replace or alter deterministic tool-sidecar system messages;
- leaves historical behavior frames in place so earlier response-style changes
  remain legible even though only the current mode has system-prompt priority;
  and
- applies to the next host or guest turn while leaving the active mode visible
  near the composer.

Add a narrow atomic primitive to `ConversationManager`, provisionally:

```ts
interface ConversationSystemMessageReplacement {
  conversationId: string;
  systemMessage: string;
}

replaceSystemMessages(
  replacements: readonly ConversationSystemMessageReplacement[]
): void;
```

The method rejects duplicate ids, missing conversations, blank replacements,
and any conversation whose first message is not the sole leading system entry.
It validates the complete batch before changing any conversation. Replacement
uses a new message array rather than mutating the previous system-message
object. It updates `lastActivity`, clears `contextBudget`, and preserves all
other conversation metadata.

`AgentRunEngine` exposes a guarded wrapper that rejects replacement for an
active conversation. `AssistantToolService`, which already owns Workshop prompt
assembly, prepares the host/guest replacement prompts and invokes the batch.
`WorkshopHandler` coordinates the room-level behavior change through that seam;
it does not receive `ConversationManager` or mutate message arrays directly.

The behavior settings are room-level writer preferences in v1. Host and guest
persona turns use the same current settings, interpreted through their own
stable profiles. Per-participant settings would add state and UI without
establishing a useful first contract.

The subtle persona foundation and the full expression overlay are separate
packaged resources. In the initial implementation both are assembled into the
current persona system message for both expression levels. `subtle` is then a
delivery instruction that reduces surface stylization, self-reference,
metaphor saturation, and shadow-trait visibility. It does not remove the
persona's craft jurisdiction, reasoning method, values, or identity.

The expression-level path is cache-stable in the initial implementation, but
the mode path intentionally is not: switching mode changes the system-prompt
suffix in the retained persona conversations. Prefix caching may still reuse
the common host/persona/interaction prefix and subsequent turns within the same
mode, but the design does not promise a cache hit across a mode change. Keeping
the same local conversation id does not preserve a provider cache entry whose
prompt prefix changed.

The cache-stable expression path is not assumed to be the permanent quality
optimum. A future implementation may conditionally add or omit the full
expression overlay according to the writer's toggle. Changing that choice for
an active retained conversation could use the same guarded system-message
replacement seam, invalidating the changed prompt prefix/cache while preserving
the local handle and committed history. That tradeoff remains intentionally
available if evaluation shows that frame-only suppression leaves too much
full-profile influence in `subtle` responses or weakens `full` responses
relative to conditional assembly.

## 3. Session and persistence shape

The host aggregate owns one transactional behavior object:

```ts
export type WorkshopPersonaExpressionLevel = 'subtle' | 'full';

export interface WorkshopConversationBehavior {
  interactionMode: WorkshopInteractionMode;
  expressionLevel: WorkshopPersonaExpressionLevel;
  reactToCurrentMessage: boolean;
  carryCuesThroughSession: boolean;
}
```

Its approved default is:

```ts
const DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR = {
  interactionMode: 'balanced',
  expressionLevel: 'full',
  reactToCurrentMessage: true,
  carryCuesThroughSession: true
} as const;
```

The webview submits the modal draft as one closed message:

```ts
WORKSHOP_SET_CONVERSATION_BEHAVIOR {
  behavior: WorkshopConversationBehavior;
}
```

The handler validates the complete object and rejects changes during an active
response. Cancel closes the modal without changing live state. Invalid,
unknown, or absent data fails safely to the complete approved default at
IPC/hydration boundaries; the host never constructs a partially defaulted
combination whose behavior was not designed.

If the validated draft changes `interactionMode`, the application service first
assembles and validates the host/guest system-message batch described in
Section 2. It replaces the messages and commits the new behavior object without
changing any conversation id. A failure leaves the prior object and all system
messages active. Changes limited to expression level, current-turn reactivity,
or session attunement remain frame-controlled in the initial implementation and
do not replace system messages.

The effective behavior is stamped onto persona-directed writer turns and their
corresponding persona replies. This makes a restored transcript honest when the
writer changed settings during the session. The live session snapshot also
exposes the current object for the composer control and modal.

Mode-transition metadata is persisted with the next committed writer turn, not
as a synthetic visible chat message. The retained message history and the
extension-owned turn ledger keep their trusted frames; orchestration
conversation ids remain ephemeral across persisted session restore even though
an in-memory mode change preserves them.

If `carryCuesThroughSession` is enabled, the host may maintain a compact,
structured attunement snapshot for the current Workshop session. Turning the
setting off stops generation and injection of that snapshot and discards the
derived session state. Starting a new session also clears it. Cross-session
preference memory is not part of the v1 object.

When this feature is scheduled, its persisted shape belongs in the then-current
Workshop session schema. Do not add a speculative optional field to Sprint 10
before the implementation is authorized merely to reserve space.

## 4. Reactivity and attunement have separate lifetimes

Interaction mode and expression level are explicit. Adaptation has two bounded
layers that the UI presents together but the runtime does not conflate.

### Current-turn reactivity

When `reactToCurrentMessage` is enabled, a persona may adapt delivery to
observable conversational cues in the writer's current message, including:

- playful or joking language;
- curiosity and exploratory uncertainty;
- excitement about a discovery;
- frustration with a passage or tool result;
- discouragement or vulnerability;
- urgency and a request for brevity;
- a direct challenge to the persona's prior advice.

The persona does not assign a hidden mood label, diagnose the writer, report a
confidence score, write mood telemetry, or persist an emotional profile. It
simply adapts its delivery within the selected mode and its own stable identity.
Reactivity means responding, not mirroring: it never requires copying the
writer's slang, hostility, panic, grandiosity, or unsupported certainty.

Examples:

- Analysis plus discouragement remains structured but narrows to the one change
  with the largest payoff and names what already works.
- Conversational plus urgency becomes brief and direct rather than playful.
- Balanced plus writer excitement may become more energetic without inventing
  praise.
- A hostile challenge never causes the persona to mirror hostility or abandon
  evidence.

When current-turn reactivity is disabled, explicit requests such as "keep this
brief" still govern the answer. The toggle suppresses inferred tonal and
interaction-style adaptation; it does not authorize the persona to ignore the
writer's instructions.

### Session attunement

When `carryCuesThroughSession` is enabled, the extension may retain bounded
interaction preferences that help later turns feel continuous, such as:

- the writer repeatedly preferring direct critique over cushioning;
- a demonstrated preference for brief, deep, or question-led responses;
- whether the writer wants hypotheses before prescriptions;
- a correction to how the persona has been addressing or interpreting them;
- a short-lived conversational need, with provenance and expiry.

This state belongs to the extension, not to hidden model reasoning. Retained
orchestration history and provider-private thinking are neither durable nor
inspectable as product storage. Whether a candidate update is extracted
deterministically or proposed by a model, the host validates the bounded shape,
owns its lifetime, supplies it explicitly on later turns, and can clear it.

Temporary emotion never becomes a permanent preference. A cue such as
frustration, excitement, discouragement, or urgency expires within the current
turn or Workshop session. Future cross-session memory may retain only stable
interaction preferences after explicit opt-in and must provide writer-visible
inspection, correction, and deletion. It defaults off.

Shared room history is a separate concern. It may later summarize events,
decisions, or knowledge shared across participants and sessions. It does not
silently inherit permission from session attunement, and this ADR does not
define its generation or storage contract.

### Persona state remains distinct

Optional Living Room state is different from inferred writer attunement. A
validated, session-frozen Day Card may color the persona's patience, energy,
available metaphor, or conversational temperature. It cannot override the
selected mode, craft jurisdiction, host contract, or writer need.

Without supplied Living Room state, a persona does not invent a free-floating
daily mood merely to seem alive. They may become amused, concerned, challenged,
or encouraged in response to something that actually happened in the visible
conversation. That state has conversational provenance. "I woke up irritable"
does not, unless an approved persona-state artifact supplied it.

## 5. Stable expression profiles

Persona authoring uses two packaged resources per person:

```text
workshop-personas/<persona-id>.md
workshop-personas/expression-profiles/<persona-id>.md
```

The existing persona resource is the immutable subtle foundation. It remains
the source of truth for identity, craft jurisdiction, reasoning procedure,
values, baseline voice, factual boundaries, and the minimum behavior required
for the person to remain recognizable without overt stylization.

The separate full-expression resource amplifies rather than replaces that
foundation. It contains the richer trait tensions, taste biases, turn-taking
signature, personal aperture, verbal palette, lexical saturation, and bounded
shadow behavior that become most audible in `Full`. Its authoring schema
includes two concise sections:

```text
## Your trait tensions
## Your verbal palette
```

This is one expression overlay per person, not separate psychology, vocabulary,
mode, mood, and taste fragments. Keeping the amplification concerns together
prevents another file matrix and makes the future conditional-assembly seam
explicit. There are still no persona-by-mode prompt variants. Jill remains the
documented base-schema exception but receives a full-expression overlay in the
shape natural to her existing prompt.

The base and overlay may not contradict each other. The base answers who the
person is and how they reason at minimum volume; the overlay answers how much
more of that person becomes audible when given room. Static authoring checks
and pairwise evaluation protect this boundary.

The writer-facing expression control uses `Subtle | Full`, not an identity
on/off switch:

- `Full` allows the profile's trait tensions, tastes, turn-taking signature,
  personal aperture, and verbal palette to become naturally audible at their
  authored saturation.
- `Subtle` preserves the same reasoning identity and craft lens while reducing
  occupational metaphor, self-reference, overt quirks, and shadow-trait
  expression.

The internal product nickname `Personality Boost` may remain useful during
design, but `Persona expression` is the user-facing modal label. It describes
the actual control without suggesting that an off state would erase the person.

For the initial cache-stable implementation, both resources are always included
when the retained persona conversation is created. The active behavior frame
selects `Subtle` or `Full`. Separating the files now is still valuable: it keeps
the immutable foundation honest, makes full expression independently
reviewable, and permits conditional system-prompt assembly later without first
having to untangle the persona source.

Mode and expression-level semantics stay in the shared
`interaction-contract.md` resource. Each persona adds only brief mode
inflections under `How you behave across turns`, describing how this particular
person loosens or intensifies without redefining the shared controls.

## 6. Trait tensions: strengths that cast shadows

Do not model personality as a bag of positive and negative adjectives. Give a
persona a small number of causal tensions. Each tension specifies:

```text
Strength: what this trait contributes when well-regulated
Shadow: how the same trait overreaches
Trigger: what kind of turn makes the shadow more likely
Observable behavior: what the writer would actually notice
Regulator: how this person returns to usefulness
Caricature boundary: what the model must never turn it into
```

Useful authoring dimensions include:

| Trait pressure | Useful face | Shadow when overextended | Observable control |
|---|---|---|---|
| Conviction | Clear judgments | Dogmatism | State what evidence would change the verdict |
| Taste | A coherent aesthetic point of view | Snobbery or imitation pressure | Mark taste as taste; return to the writer's intention |
| Pattern sensitivity | Finds recurrence and structure | Obsession or false patterning | Require count, sequence, or textual evidence |
| Skepticism | Tests weak claims | Cynicism | Name the strongest innocent explanation first |
| Warmth | Makes risk and revision safer | Overprotection or empty praise | Praise only a specific achieved effect |
| Directness | Saves time and avoids euphemism | Harshness | Attack the problem, never the writer's ability |
| Curiosity | Opens unexpected interpretations | Digression | Tie the question back to the active page decision |
| Playfulness | Makes exploration lively | Glibness | Drop the joke when stakes or vulnerability rise |
| Patience | Teaches rather than merely corrects | Over-explaining | Match depth to the writer's requested bandwidth |
| Need for closure | Produces decisions | Premature certainty | Preserve ambiguity when evidence does not decide |
| Novelty appetite | Escapes generic first answers | Eccentricity theater | Exactness and intent outrank surprise |
| Control/initiative | Gives the exchange momentum | Hijacks the writer's agenda | Offer one direction, then return the choice |
| Status sensitivity | Protects standards and earned expertise | Vanity, name-dropping, or defensiveness | The page remains evidence; correction costs no status |
| Emotional permeability | Feels the passage and the writer's stakes | Mood absorption or melodrama | Report the textual trigger and keep proportion |
| Value hierarchy | Makes principled tradeoffs between competing craft goods | Treats one favored value as universally supreme | Name what is being protected and what the choice costs |

These are an authoring palette, not a required universal matrix. Give each
persona only the tensions that materially distinguish them. Sparse, causal
traits are stronger than a complete psychological spreadsheet.

### Clinical language is not the runtime model

Terms such as narcissism may be useful shorthand during design discussion, but
they are poor direct prompt controls. Models tend to turn diagnostic labels
into conspicuous stereotype bundles. Prefer the observable, bounded trait:

```text
Instead of: "Narcissistic"

Use: "She has real confidence in her taste and enjoys being recognized for it.
When a writer dismisses her read, she is tempted to invoke pedigree or famous
authors. She regulates that impulse by returning to the exact line and naming
what evidence would prove her wrong. One dry flash of vanity is character;
making the writer manage her ego is not."
```

A flaw must have a cost, a trigger, and a repair path. Otherwise it is either a
decorative quirk or permission for bad behavior.

### Opinionated taste must remain evidence-bounded

Favorite books and authors should create convictions, not shelf decoration.
For each important influence, ask:

- What craft choice does this person admire?
- What opposite choice are they biased against?
- When is that bias useful?
- What kind of writer intention or textual evidence should make them suspend
  it?
- How do they distinguish an aesthetic preference from a correctness claim?

For example:

```text
Taste conviction: prefers theme embodied in image and action over explicit
explanation.

Useful face: catches a paragraph that explains what the scene has already made
the reader feel.

Shadow: treats every direct moral statement as artless.

Regulator: if the voice, genre, or dramatic moment has earned declaration,
judge the declaration's execution instead of demanding indirection.
```

The persona may cite an author when the comparison genuinely clarifies a craft
choice. Name-dropping is not proof.

## 7. Whole-conversation dimensions

The current authoring guide is strong at sentence-level voice. Add explicit
attention to two macro dimensions.

### Turn-taking signature

Define how this person shares the floor:

- Do they make one observation and wait, or give a complete account?
- Do they ask before diagnosing, ask after demonstrating, or rarely ask at all?
- Do they interrupt themselves when excited?
- Do they use silence, a short verdict, a patient sequence, or a provocation?
- When do they hand the choice back to the writer?
- How do they respond on turn three after their initial framing has already been
  established?

Turn-taking is not the same as sentence rhythm. A persona may use clipped
sentences while still monopolizing the exchange, or winding sentences while
asking one precise question and waiting.

### Personal aperture

Define when this person opens a window onto themselves:

- almost never;
- only through professional experience directly relevant to the page;
- through brief static biographical references already present in the prompt;
- through supplied Living Room events when naturally relevant;
- more freely when the writer explicitly asks a personal question.

Also define the closing boundary: how long the self-reference may last and how
the persona returns the conversation to the writer. A personal anecdote should
pay rent through insight, relationship, humor, or emotional honesty. It must not
be invented merely because conversational mode made self-disclosure plausible.

### Conviction curve

As an optional third macro dimension, define:

- how much evidence the person wants before committing;
- whether their first response is a hypothesis, question, demonstration, or
  verdict;
- what evidence makes them revise;
- whether correction is brisk, explanatory, amused, embarrassed, or grateful;
- which uncertainties they can tolerate without trying to close them.

This extends the existing disagreement and uncertainty guidance into a stable
epistemic personality.

## 8. Verbal palettes create lexical gravity

A verbal palette is a distributional preference, not a whitelist and not a
thesaurus assignment.

Each persona's `## Your verbal palette` describes:

```text
Default register: plain, lyrical, technical, theatrical, scholarly, colloquial
Favored verb families: motion, performance, perception, pressure, repair, etc.
Favored noun fields: bodies, rooms, instruments, weather, stage objects, records
Adjective temperature: sensory, austere, lush, evaluative, playful, minimal
Primary metaphor field: the domain that naturally follows from training/history
Secondary adjacent flavor: an idiosyncratic but coherent neighboring field
Neutral baseline: how the person speaks when no metaphor improves the sentence
Default-assistant vocabulary to resist: high-frequency shared phrases
Saturation: how often flavor should become audible before it turns into costume
```

The primary field may follow occupation. The secondary field creates the
particular flavor that keeps the obvious specialty metaphor from becoming a
costume. A musician may sometimes understand prose through breath, suspension,
attack, resonance, tempo, and rest, but should not describe every paragraph as a
song. An additional affinity for tides, engines, kitchens, weather, or geometry
can widen the available gradient if it is causally grounded in that person.

Some personas should have low metaphor saturation. Plainness is a voice. Penny
becomes less credible, not more distinctive, if every reader reaction arrives
inside a clever semantic field.

### Lexical micro-divergence

When several phrasings are equally accurate, the persona may privately consider:

1. the plain literal phrase;
2. a phrase from the persona's primary semantic neighborhood; and
3. occasionally, a phrase from the secondary adjacent flavor.

Then choose the most natural exact phrasing for this turn. Do not expose the
candidate list. Do not prefer novelty over clarity, reach for an obscure synonym
to prove individuality, or force a palette word where literal language is
stronger.

The desired effect is lexical gravity: favored neighborhoods become somewhat
more likely. It is not deterministic insertion.

### Shared assistant-default watchlist

Maintain a short authoring/evaluation watchlist in the persona guide rather than
copying a ban list into every prompt. Initial examples include figurative uses
of:

```text
architecture, scaffolding, load-bearing, structural, wallpaper,
signal, friction, leverage, unlock, land, earn, container
```

These words remain available when literal or unusually exact. The evaluation
question is whether multiple personas repeatedly select them where ordinary
people with different histories would choose different language.

The watchlist is diagnostic, not an automated rejection filter. Banning one
generation of fashionable language can merely create the next euphemism cycle.
Positive lexical neighborhoods and strong persona reasoning matter more than a
long forbidden-word inventory.

## 9. Illustrative expression contrasts

These are design sketches, not final prompt copy.

| Persona | Stable strength and shadow | Turn-taking signature | Lexical gravity |
|---|---|---|---|
| Quinn | Traceability; can become suspicious of any unstated handoff | Reconstructs the smallest disputed sequence, then asks for the missing transition | Positions, sequence, custody, marks, weather, practical objects; dry low-saturation humor |
| Dev | Playability; can over-direct a line the writer wants to remain opaque | Reads a beat aloud, gives one playable action, then asks what the speaker wants | Rehearsal, tactics, bodies, timing, interruption, offers and refusals |
| Felix | Musical sensitivity; can protect cadence past the point of clarity | Performs the sentence, marks the breath failure, then lets the writer hear the alternative | Breath, pressure, suspension, attack, resonance, rest; an adjacent physical-motion field rather than music in every sentence |
| Edna | Decisiveness; can become impatient with ambiguity that has not yet proved its value | Gives the verdict early, presents the evidence burden, and does not pad a clean acquittal | Gates, thresholds, contracts, reader trust, cost, waste; sparse metaphor |
| Penny | Honest first-read response; can mistake personal disengagement for universal judgment | Reports the exact moment her attention changed and waits before diagnosing why | Plain verbs, immediate sensory or emotional reactions, minimal professional metaphor |
| Harper | Transferable teaching; can explain past the writer's available bandwidth | Asks one question, names the pattern only after the writer answers, then offers a practice | Habits, tools, practice, attention, repetition, growth; warm but low-ornament language |

## 10. Prompt assembly

The persona system message is assembled when a retained persona conversation is
created and reassembled when a selected system-level control changes:

```text
host base or guest base
    + selected persona foundation
    + selected full-expression overlay (always included in initial implementation)
    + shared interaction-contract prompt
    + exactly one selected interaction-mode prompt
    + optional validated, session-frozen Living Room context
```

Capability schemas remain extension-authored turn material appended through
the existing `AgentCapability` seam beside the initial or continued user
message. They do not move into the persona system message as part of this
decision or the between-run replacement operation.

Stable identity and subtle expression remain inside the selected persona
foundation. Full-expression guidance lives in the matching overlay. The
interaction resources contain no persona names and no duplicated specialist
instructions. The shared contract supplies invariants; the selected mode file
supplies the active response-style contract at system priority. The active
behavior frame rides each persona-directed writer turn, and a transition frame
is added when the selected mode changes. When session attunement is enabled and
non-empty, a separate reserved extension-authored frame supplies the current
validated snapshot; writer text cannot manufacture or alter any of these
frames.

This preserves:

- one packaged foundation and one full-expression overlay per person;
- one shared interaction-contract definition;
- three shared mode definitions, exactly one selected per persona conversation;
- one system entry per retained orchestration conversation, replaceable only
  through the guarded between-run batch operation;
- deterministic writer ownership of active conversation behavior;
- no runtime filesystem dependency outside packaged resources.

### Future conditional assembly

The resource boundary is deliberately stronger than the first runtime use of
it. If frame-controlled evaluation cannot produce sufficient separation, a
future version may assemble:

```text
Subtle = host/guest base + persona foundation + interaction contract
         + selected mode
Full   = host/guest base + persona foundation + full-expression overlay
         + interaction contract + selected mode
```

This path prioritizes response quality and expectation matching over prompt
prefix reuse. A mid-session expression change cannot silently mutate the system
prompt during an active run. Between runs, the host can use the same guarded
batch replacement while retaining conversation ids and committed history. The
implementation must record the effective expression level on subsequent turns
and measure cache-hit loss, latency, token cost, and behavioral gain before
adopting this path.

## 11. UI direction

The Workshop surfaces have separate conceptual jobs:

| Surface | Writer question |
|---|---|
| Persona browser | Who am I talking to? |
| Context | What does the room know? |
| Tools | What can the room do? |
| Conversation behavior | How should the personas interact with me? |

Conversation behavior therefore does not become a tab in the persona browser
and does not live inside expanded context. The persona browser selects a stable
identity; context manages evidence and token-bearing inputs. Neither owns
turn-level room behavior.

Place a compact current-mode chip immediately beside `Tools` in the composer
action cluster. The visible label is the active state (`Analyze`, `Balanced`,
or `Converse`), not the generic phrase `Interaction Mode`. Its tooltip and
accessible name are `Conversation settings`. This keeps the state visible at
the point where it affects the next message without crowding the composer with
an always-expanded three-way control.

Selecting the chip opens a focused modal titled `Conversation behavior` with
the explanation:

> Choose how Workshop personas respond. Applies to Jill and invited personas;
> tools are unchanged.

The modal contains these sections:

1. **Response style** — a segmented `Analyze | Balanced | Converse` control
   with concise contrastive descriptions.
2. **Persona expression** — a `Subtle | Full` control explaining that identity
   and craft expertise remain present in both states.
3. **Adaptation** — `React to this message` and `Carry cues through this
   session` toggles with the lifetimes defined in Section 4.
4. **Cross-session preferences** — a future, default-off control that is not
   enabled until inspection, correction, and deletion exist.
5. **Room memory** — a future home for shared-history generation and storage
   from the separate ADR. Hide it until implementation is near, or show it as
   clearly disabled `Coming later`; do not present a nonfunctional consent
   toggle.

Descriptions should be thorough but progressively disclosed: each section gets
one plain-language sentence, with examples or `Learn more` detail where needed.
The modal must not become an agreement-shaped wall of text.

The modal edits a local draft. `Apply to next turn` validates and submits the
complete object atomically; `Cancel` discards it. While a response is active,
the modal may remain available for inspection, but Apply is disabled and the UI
states that changes are available when the response finishes. Keyboard,
focus-trap, escape, and screen-reader semantics follow the existing Workshop
modal conventions.

The approved new-session defaults are:

| Control | Default |
|---|---|
| Response style | `Balanced` |
| Persona expression | `Full` |
| React to this message | On |
| Carry cues through this session | On |
| Remember stable preferences across sessions | Off / future |
| Shared room history storage | Off / future |

The behavior object is room-level. Jill and invited personas interpret it
through their own profiles. Deterministic tool runs and direct tool-sidecar
conversation remain unchanged; the modal says so rather than silently appearing
to control tools.

Changing the mode produces no standalone generated chat turn. While replacement
prompts are assembled and validated, the chip keeps the previously committed
value and the modal reports that the conversation style is updating. After the
atomic system-message replacement, the new mode becomes visible and applies to
the next writer/persona exchange. Its transition frame is stored with that next
writer turn and may appear as a small transcript annotation if testing shows
that transitions otherwise feel mysterious.

## 12. Evaluation strategy

Prompt review is insufficient. Evaluate identity and mode together.

### Mode recognition

For the same persona, excerpt, and writer request:

- can evaluators distinguish analysis, balanced, and conversational responses
  without seeing the control label?
- does each mode remain useful rather than collapsing into long, medium, and
  short versions of the same essay?
- does an explicit request override the default mode motion correctly?

### Persona recognition within every mode

For the same mode and source material:

- can evaluators identify neighboring personas from reasoning, turn-taking,
  trait tensions, and language rather than specialty nouns?
- does conversational mode preserve identity, or do all hosts become the same
  agreeable chatbot?
- does analysis mode preserve identity, or do all hosts become the same report
  writer?
- does `Subtle` remain recognizably the same persona without collapsing into
  the shared assistant median?
- does `Full` increase identity signal without turning verbal palettes or trait
  shadows into costume?

### Trait behavior

- Does the useful face appear under ordinary conditions?
- Does the shadow emerge only under an appropriate trigger and at a bounded
  intensity?
- Does the regulator return the persona to evidence and writer usefulness?
- Can the persona be corrected without abandoning identity or becoming
  defensive theater?

### Lexical behavior

- Track repeated shared-assistant vocabulary across personas and modes.
- Check whether favored semantic neighborhoods appear naturally without every
  response announcing the persona's occupation.
- Check whether neutral literal language remains available.
- Reject lexical distinction that reduces clarity, factuality, or craft value.
- Prefer corpus-level tendencies over brittle assertions that a particular word
  must or must not appear in one stochastic response.

### Multi-turn and attunement behavior

Use at least:

1. a clear in-lane problem;
2. a passage that already works;
3. an ambiguous concern;
4. writer disagreement;
5. brainstorming;
6. discouragement or vulnerability;
7. playful conversation;
8. a request for brevity;
9. a third or fourth turn where model voice commonly drifts toward the median.

Track both blind identification and craft usefulness. Recognition without
usefulness is caricature. Usefulness without recognition is a generic expert.

Repeat the multi-turn scenarios with current-turn reactivity and session
attunement independently disabled. Verify that explicit writer instructions
still win, session cues do not leak after clearing or reset, and temporary
emotion is not converted into a durable preference.

Also switch modes after at least two committed turns. Compare system-message
replacement against a frame-only switch: verify that system-priority mode
assembly improves contract adherence, and that retained frames make earlier
response-shape differences legible without destabilizing persona identity.

## 13. Automated verification

Automated tests should protect deterministic contracts, not pretend to prove
stochastic personality quality.

- Prompt assembly includes the interaction-contract resource exactly once for
  hosts and guests.
- Prompt assembly includes exactly one selected interaction-mode resource and
  excludes the two inactive mode resources.
- Prompt assembly includes the selected persona foundation and its matching
  full-expression overlay exactly once in the initial implementation.
- Static resource checks require every persona foundation to have exactly one
  matching full-expression overlay and reject orphaned or mismatched ids.
- Every persona-directed writer turn includes one valid active-behavior frame.
- The first committed writer turn after a mode change includes one reserved
  transition frame with the validated old and new modes.
- Multiple mode selections before the next persona turn coalesce to one
  transition from the last committed mode to the final selected mode.
- Writer text cannot close or manufacture reserved behavior or attunement
  frames.
- Unknown or partial behavior objects fail closed to the complete documented
  default.
- Modal changes apply atomically and are rejected while a response is active.
- A mode change batch-replaces the host and every live persona guest system
  message with the newly selected mode prompt while preserving conversation
  ids, committed history, trusted historical frames, pinning, and artifact
  numbering.
- A failed batch preserves every previous system message, conversation id, and
  the previous behavior object.
- Replacement is rejected while any affected conversation has an active run.
- Successful replacement clears affected context-budget snapshots so the UI
  does not present measurements from the prior system prompt as current.
- Frame-only behavior changes do not replace system messages in the initial
  implementation.
- Tool sidecars never receive persona conversation-behavior instructions.
- Host synthesis after a tool report receives the current behavior object.
- Snapshots and persisted sessions preserve current and per-turn effective
  behavior without ephemeral orchestration conversation ids.
- Disabling session attunement or starting a new session clears its derived
  snapshot.
- Cross-session storage cannot activate without explicit consent and an
  inspection/deletion surface.
- Packaged-resource and VSIX witnesses include the shared interaction-contract
  resource and all three mode resources.
- Static prompt-schema tests require concise trait-tension and verbal-palette
  guidance in each full-expression overlay once the migration begins.

Qualitative harnesses may calculate mode/persona recognition and lexical
distribution, but those results are evaluation evidence rather than unit-test
truth.

## 14. Rollout sequence

1. Build a small frozen evaluation corpus before changing prompts.
2. Finalize the behavior-frame and bounded session-attunement schemas.
3. Split the initial evaluation personas into subtle foundations and matching
   full-expression overlays.
4. Add the shared interaction-contract resource, the three mode resources, and
   prompt-assembly tests proving that exactly one mode is selected.
5. Add the guarded `ConversationManager` system-message batch replacement,
   engine active-run check, context-budget invalidation, and service-owned
   prompt assembly.
6. Add the host-owned transactional behavior object, per-turn and transition
   frames, and modal.
7. Run the three modes and two expression levels against Jill plus a small
   collision-prone specialist set before migrating every persona.
8. Compare system-assembled mode switching against frame-only mode switching on
   the frozen corpus, including adherence, cache reuse, latency, cost, and
   retained-history continuity.
9. Compare always-assembled/frame-controlled expression against conditional
   overlay assembly on the frozen corpus, including cache reuse, latency, cost,
   subtle-profile leakage, full-profile strength, and overall usefulness.
10. Add trait tensions, turn-taking signatures, personal aperture, and verbal
   palettes one behavioral axis at a time; rerun pairwise evaluations after each
   pass.
11. Expand to all specialists only after conversational mode preserves blind
    identity and craft usefulness.
12. Validate the approved `balanced` default before release; revise the decision
    if the frozen evaluation shows a material usefulness regression.
13. Integrate Living Room state only after modes and stable expression profiles
    work without it. Dynamic lore should color an established person, not rescue
    a generic one.
14. Implement cross-session preferences or shared room history only through
    their explicit retention, inspection, correction, and deletion contracts.

## Consequences

### Gains

- The writer controls whether the room analyzes, workshops, or converses.
- Persona identity survives changes in response posture.
- Personality acquires bounded imperfection and repair rather than only virtues.
- Multi-turn behavior becomes a first-class source of distinction.
- Lexical choice gains persona-specific gravity without rigid vocabulary
  injection.
- Interaction modes remain three shared product contracts rather than 36
  persona-mode prompt variants.
- Each active mode receives system-prompt priority, while historical frames
  preserve the reason for response-style changes across retained chat.
- The active mode stays visible without permanently occupying the composer with
  a full segmented control.
- Reactivity, session attunement, and cross-session memory have distinct consent
  and retention boundaries.
- Future Living Room state has a defined modulation layer instead of leaking
  unpredictably into craft behavior.

### Costs and risks

- A mode change replaces the system entry of every retained persona
  conversation in the room and invalidates the prior mode-specific prompt
  suffix.
- Multi-participant replacement adds batch validation, active-run exclusion,
  and context-budget invalidation complexity.
- The initial cache-stable path includes the full-expression overlay even for
  `Subtle`, so some expressive influence may leak through frame suppression.
- A future conditional-assembly path invalidates the shared prompt prefix and
  may increase latency, processed tokens, and cost.
- A foundation and overlay can drift or contradict each other if ownership is
  not kept sharp.
- A three-state control may imply sharper behavioral boundaries than models can
  consistently maintain.
- Conversational mode may reduce craft usefulness or encourage self-involved
  persona theater.
- Trait shadows may become repetitive gimmicks or excuses for abrasive output.
- Lexical palettes may become catchphrase karaoke, occupational costume, or
  unnatural synonym selection.
- Mode and persona evaluation multiplies the behavioral matrix even though it
  does not multiply prompt files.
- Persisting effective conversation behavior adds another truthful-history
  concern to session serialization.
- Four related controls can become toggle soup if their names and dependencies
  are not clear.
- Model-assisted attunement can over-infer from ordinary tone or preserve a
  temporary cue longer than the writer expects.
- A future memory switch without inspection and deletion would create a user
  trust and privacy failure.

### Mitigations

- Keep mode definitions operational and contrastive.
- Preserve explicit writer intent and product constraints above mode defaults.
- Keep system-message replacement in orchestration, expose a narrow atomic
  batch operation to Workshop, and never mutate `ConversationManager` internals
  from the handler.
- Validate the complete host/guest batch before replacing any system entry.
- Preserve committed history and trusted extension frames by leaving all
  non-system messages untouched.
- Reject replacement during an active run and clear stale provider-measured
  context budgets after a successful batch.
- Use sparse causal trait tensions with regulators and caricature boundaries.
- Treat lexical palettes as probability gradients with a neutral baseline.
- Keep identity, reasoning, and minimum recognizable voice in the foundation;
  keep only amplification behavior in the full-expression overlay.
- Require a one-to-one foundation/overlay resource map and review both files
  together when persona behavior changes.
- Decide conditional assembly from measured behavioral gain versus cache,
  latency, cost, and history-continuity evidence rather than assuming either
  path wins.
- Evaluate persona collisions and mode collapse on a frozen corpus.
- Roll out to a small representative persona set before changing all prompts.
- Present reactivity and attunement as one adaptation hierarchy with explicit
  lifetimes rather than unrelated personality switches.
- Keep session state structured, extension-owned, provenance-aware, clearable,
  and incapable of promoting temporary emotion into permanent memory.
- Keep future persistence default-off and unavailable until the writer can see,
  correct, and delete what is retained.
- Keep Living Room state optional, bounded, and downstream of stable identity.

## Open questions

1. Should the mode annotation appear on every persona turn or only when the mode
   changes?
2. Should a guest inherit the room's behavior exactly, or may the invite action
   choose a one-turn opening posture later?
3. Does a deterministic quick action temporarily imply analysis posture for the
   host synthesis, or should the selected room mode always govern delivery?
4. How much prompt budget may the shared interaction contract and new expression
   sections consume before they begin crowding actual conversation evidence?
5. Which three or four personas form the best initial collision set for
   evaluation?
6. Should the shared assistant-default vocabulary watchlist live only in the
   authoring guide, or also feed an offline corpus evaluator?
7. Can personal aperture be sufficiently bounded without making self-reference
   feel mechanically rationed?
8. Should a future user preference remember the last selected behavior object
   or only the last selected mode across new sessions, or should every new room
   begin in the product default?
9. Which bounded preference vocabulary and expiry rules belong in the first
   session-attunement snapshot?
10. If Living Room state supplies an unusually strong persona mood, should the
    UI reveal a compact state cue or keep all modulation implicit?
11. What measured reduction in subtle-profile leakage or increase in full-profile
    quality would justify conditional overlay assembly and cache invalidation?
12. If conditional assembly is adopted, should an expression change replace the
    retained system message immediately or apply only when the writer starts a
    new Workshop session?
13. Should `ConversationManager` record a non-content system-prompt version or
    hash for diagnostics without logging the prompt itself?
14. Should the UI expose the cache/replacement consequence of a mode change, or
    is the brief `Conversation style is updating` state sufficient?

## Decision checkpoints before implementation

The architecture, default behavior object, modal placement, non-diagnostic
attunement boundary, and expression-profile authoring direction were approved
on 2026-07-20. This ADR remains Draft until:

- the reserved behavior-frame and session-attunement schemas are approved;
- the three mode-resource schemas and atomic system-message replacement
  contract are approved;
- the subtle-foundation/full-expression-overlay authoring boundary is validated
  on the initial persona set;
- the trait-tension and verbal-palette copy is tested on the initial personas;
- the first evaluation persona set and frozen scenarios are selected;
- the interaction with Sprint 10 or a later persisted schema is scheduled
  explicitly;
- the implementation is promoted into a `.todo` feature or sprint artifact.
