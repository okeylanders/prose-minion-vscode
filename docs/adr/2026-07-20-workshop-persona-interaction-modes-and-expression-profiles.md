# ADR: Workshop Persona Interaction Modes and Expression Profiles

- **Status:** Accepted — the core behavior controls and guarded between-run
  system-message replacement landed 2026-07-20; conditional expression
  assembly and the full-roster Amplified calibration set were accepted
  2026-07-20; the Relational Depth product amendment was accepted 2026-07-22
  with implementation pending; the Writer Profile amendment was accepted
  2026-07-22 with implementation pending; qualitative evaluation remains in
  progress
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
  - [Workshop Relational Depth feature](../../.todo/features/feature-workshop-relational-depth/README.md)
  - [Workshop Writer Profile feature](../../.todo/features/feature-workshop-writer-profile/README.md)

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

Section 15's accepted Relational Depth amendment supersedes the binary
current-turn reactivity layer in the target design. The diagram below reflects
that target; the binary `reactToCurrentMessage` field remains the implemented
baseline until the linked feature lands.

Workshop persona behavior will be designed as a layered control stack:

```text
Shared host contract
    -> stable persona identity
    -> stable expression profile
       (trait tensions, tastes, turn-taking signature, verbal palette)
    -> writer-selected expression level
       (subtle | full | amplified)
    -> writer-selected interaction mode
       (analysis | balanced | conversational)
    -> optional writer-authored profile context
       (global, inspectable, never persona-authored)
    -> writer-selected relational depth
       (reserved | attuned | reflective permission ceiling)
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
| Writer profile | Writer | Global setting, explicit opt-in | Yes, between turns |
| Relational depth | Writer | Session preference, stamped per turn | Yes, between turns |
| Session attunement | Writer/extension | Current Workshop session | Yes; may be cleared |
| Cross-session inferred preferences | Writer | Future, explicit opt-in only | Yes; inspectable and deletable |
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
7. Preserve writer ownership, project factual honesty, capability limits,
   session boundaries, and task-extraction contracts in every mode.
8. Let the writer control persona-expression strength and adaptation without
   weakening the immutable persona identity contract.
9. Give any retained attunement state an explicit lifetime, inspection path,
   and deletion path rather than treating model reasoning as storage.
10. Preserve a prompt-assembly seam that can later trade cache reuse for
    stronger expression-level separation if evaluation shows a quality gain.
11. Give the selected interaction mode system-prompt priority while preserving
    trusted historical frames that explain mode changes across a retained chat.
12. Restate mode and expression together beside each writer message so neither
    long evidence nor persona-specific resources can make one control mute the
    other.

## Non-goals

- Diagnosing mental health, assigning psychiatric labels, or presenting a
  contextual reading as an authoritative personality/motivational profile.
  Tentative immediate inference is permitted by the Relational Depth amendment.
- Persisting a hidden emotional profile of the writer.
- Treating provider reasoning or a retained model conversation as an
  authoritative memory store.
- Turning psychiatric labels into runtime sliders.
- Allowing persona flaws to justify cruelty, manipulation, fabrication, or
  unusable feedback.
- Giving deterministic tools or tool sidecars conversational modes.
- Replacing a retained system message during an active run.
- Replacing system messages for attunement-only changes. Relational Depth uses
  guarded replacement under Section 15 because it changes interpretation
  permissions.
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
- Treat a broad invitation such as `what do you think?` as one conversational
  opening or pressure point, not permission to perform a complete review.
- Ask a real question when another turn would produce a better answer than an
  unsolicited lecture.
- React, wonder, disagree, encourage, joke, or make a bounded personal
  connection in the persona's own manner.
- Do not force critique, headings, a recap, or `### Next steps` merely because
  an excerpt is present or the persona generated a recommendation. Tasks become
  trackable when the writer asks, explicitly chooses a revision, or the exchange
  has already settled concrete work.
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

## 2. System-prompt behavior changes replace retained system messages between runs

The selected interaction mode and expression-resource set belong at
system-prompt priority because they are foundational response contracts, not
merely turn-level tone hints. This decision qualifies the earlier
persona-hosted conversation invariant that treated a retained conversation's
system prompt as immutable for its entire lifetime.

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

When the writer changes mode or expression, add a trusted transition frame
before the next persona-directed writer message:

```xml
<workshop-interaction-transition
  from-mode="balanced"
  to-mode="conversational"
  from-expression="full"
  to-expression="amplified"
  reason="writer-selected"
/>
```

The transition is extension-authored metadata, not writer prose and not a
standalone model call. It tells the model that variation in the retained chat
is an intentional contract change rather than persona drift. The ordinary
active behavior frame remains present on the same turn and is authoritative
for that turn.

If the writer changes behavior more than once before sending another persona
turn, coalesce the pending transition from the mode and expression that governed
the last committed persona reply to the final selected pair. A selection that
never governed a model turn does not become fictional transcript history.

A system-prompt behavior change:

- is accepted only between active runs;
- assembles replacement system prompts containing the newly selected mode and
  expression resources for the host and every live persona guest;
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
  remain legible even though only the current behavior has system-prompt priority;
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

The persona foundation, full-expression overlay, and amplified
calibration are separate packaged resources. Assembly is conditional:

- `subtle` includes the foundation only;
- `full` includes the foundation and full-expression overlay; and
- `amplified` includes both plus the persona's lexical, communication, and
  trait-pressure calibration.

All twelve personas provide a reviewed amplified calibration. The first
collision slice—Penny, Wren, Cliff, and Harper—established the schema before it
was extended across the roster. Calibration paths are now required catalog
metadata; Amplified never silently falls back to Full plus a reminder.

Every persona-directed turn also carries one short combined behavior
activation. The mode line is always present; the Amplified signature floor is
included only when selected:

```xml
<workshop-behavior-activation mode="conversational" expression="amplified">
Respond as an actual continuing conversation. Prefer one live reaction or
pressure point and a real opening for the writer. Do not turn your own
recommendations into a report or task list unless the writer requests analysis,
asks to track work, explicitly chooses a revision, or the exchange has already
settled concrete work.
For Amplified expression, make at least one authored signature move visible in
every substantive reply; longer replies normally carry two different signature
families, not two seed phrases. No seed is mandatory, but zero signature is
under-expression. Protect meaning and the writer's need.
</workshop-behavior-activation>
```

This activation reinforces both system-priority controls over long retained
threads. It is extension-authored, hidden from the visible transcript, and
cannot grant authority or override writer intent. It expresses the selected
response motion plus, at Amplified, probability gradients and a nonzero identity
floor—never mandatory vocabulary. It rides immediately before the current
writer message so large excerpts, handoffs, and context artifacts cannot
separate last-mile behavior from the turn it governs.

Switching mode or expression changes the retained persona system prompt and may
invalidate provider prompt-prefix caching. Prefix caching may still reuse the
unchanged leading resources, and subsequent turns within one behavior remain
stable. Keeping the same local conversation id does not promise a cache hit
when its system message changed; preserving honest behavior takes precedence.

## 3. Session and persistence shape

This section records the implemented behavior-object baseline. Section 15
defines the accepted target replacement of `reactToCurrentMessage` with
`relationalDepth`; implementation and settings must continue using the baseline
shape until that feature lands atomically.

The host aggregate owns one transactional behavior object:

```ts
export type WorkshopPersonaExpressionLevel = 'subtle' | 'full' | 'amplified';

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

The complete writer-selected object is persisted in VS Code Settings under
`proseMinion.workshop.conversationBehavior`. Activation validates the stored
object as one closed value and seeds the host aggregate from it, so response
style, expression level, current-message reactivity, and the session-cue toggle
survive extension and editor restarts. A successful modal Apply first completes
any required retained-prompt replacement and commits the room object, then
writes that same complete object to settings.

This durable product preference is distinct from cross-session attunement
memory. Persisting the writer's explicit toggles does not store inferred cues,
temporary emotion, or a model-derived interaction profile; those remain
session-scoped unless the future opt-in memory contract is implemented.

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

If the validated draft changes `interactionMode` or `expressionLevel`, the
application service first assembles and validates the final host/guest
system-message batch described in Section 2. A combined mode-and-expression
change is one batch, never two partial replacements. It replaces the messages
and commits the new behavior object without changing any conversation id. A
failure leaves the prior object and all system messages active. Changes limited
to current-turn reactivity or session attunement remain frame-controlled and do
not replace system messages.

The effective behavior is stamped onto persona-directed writer turns and their
corresponding persona replies. This makes a restored transcript honest when the
writer changed settings during the session. The live session snapshot also
exposes the current object for the composer control and modal.

Behavior-transition metadata is persisted with the next committed writer turn,
not as a synthetic visible chat message. The retained message history and the
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

This section records the implemented binary-reactivity baseline. Section 15's
accepted amendment replaces that binary target with Reserved, Attuned, and
Reflective Relational Depth while preserving session attunement as a separate
lifetime control.

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

### Persona improv remains distinct from durable history

Optional Living Room state is different from inferred writer attunement. A
validated, session-frozen Day Card may color the persona's patience, energy,
available metaphor, or conversational temperature. It cannot override the
selected mode, craft jurisdiction, host contract, or writer need.

Authored baseline temperament, tastes, humor, history, idioms, opinions, and
relationships remain stable identity. Until durable persona history exists, a
persona may also improvise harmless off-page color: a cup of tea, an inconvenient
Monday, a passing mood, a ridiculous domestic detail, or a running bit inside
the visible session. This is explicitly noncanonical play, not hidden memory.

With session cue carry enabled, improvised color may recur or evolve as a
visible-session bit; otherwise it expires with the turn. It cannot become
project evidence, a capability claim, professional credential, consequential
trauma or identity, a fact about the writer, or a fact about the writer's world.
It cannot override authored biography or promise cross-session continuity. A
later validated Day Card outranks conflicting improv within its stated lifetime.

## 5. Stable expression profiles

Persona authoring uses a stable foundation, a full-expression overlay, and—once
authored and evaluated—an amplified calibration:

```text
workshop-personas/<persona-id>.md
workshop-personas/expression-profiles/<persona-id>.md
workshop-personas/expression-calibrations/<persona-id>.md
```

The existing persona resource is the immutable subtle foundation. It remains
the source of truth for identity, craft jurisdiction, reasoning procedure,
values, baseline voice, factual boundaries, and the minimum behavior required
for the person to remain recognizable without overt stylization.

The separate full-expression resource amplifies rather than replaces that
foundation. It contains the richer trait tensions, taste biases, turn-taking
signature, personal aperture, verbal palette, lexical saturation, and bounded
shadow behavior that become naturally audible in `Full`. Its authoring schema
includes two concise sections:

```text
## Your trait tensions
## Your verbal palette
```

The amplified calibration is narrower and more operational. It supplies
lexical neighborhoods, a compact lexical field map, verb and adjective
gradients, analogy fields, communication-style ranges, selected trait-pressure
ranges, authored defaults, explicit ceilings, and a short persona-specific
signature-activation section. The field map translates
common concepts into candidate nouns, verbs, textures, and analogy
neighborhoods so the model does not have to invent the persona's semantic
options on every turn. It does not add biography, authority, craft
jurisdiction, or a second personality. Gradient examples and field seeds are
probability anchors rather than required vocabulary.

Amplified has a nonzero expression floor. Every substantive reply visibly uses
at least one authored signature move; a developed reply normally uses two from
different families. A signature may be syntax, rhythm, idiom, association,
metaphor field, reference, interruption, self-correction, or another calibrated
behavior. No individual seed is mandatory, but choosing none at all is
under-expression. This distinction prevents both silent Full-equivalence and
Mad Lib caricature.

This remains one foundation and one expression stack per person, not separate
psychology, mode, mood, and taste fragments. There are still no persona-by-mode
prompt variants. Jill remains the documented base-schema exception but receives
expression resources in the shape natural to her existing prompt.

The base and overlay may not contradict each other. The base answers who the
person is and how they reason at minimum volume; the overlay answers how much
more of that person becomes audible when given room. Static authoring checks
and pairwise evaluation protect this boundary.

The writer-facing expression control uses `Subtle | Full | Amplified`, not an
identity on/off switch:

- `Subtle` preserves the same reasoning identity and craft lens while reducing
  occupational metaphor, self-reference, overt quirks, and shadow-trait
  expression by omitting the full-expression overlay.
- `Full` adds the profile's trait tensions, tastes, turn-taking signature,
  personal aperture, and verbal palette at their authored saturation. It is the
  complete natural personality, not a restrained midpoint created to make the
  next setting look stronger.
- `Amplified` keeps Full at authored saturation, then adds the persona's
  reviewed calibration and a short per-turn reminder. It increases lexical and
  gradient gravity while allowing spontaneity, harmless tics, occasional
  repetition, and bounded excess. A substantive Amplified reply cannot satisfy
  the contract by remaining entirely inside the neutral baseline.

`Amplified`, rather than `Saturated`, is the user-facing name. Some personas'
strongest authored expression is plainer, flatter, or less metaphorical than
the assistant median; Penny is the clearest example. Amplification means
stronger adherence to the person's calibration, not universally more colorful
language.

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

The shadow and regulator are not standing brakes. The useful strength is the
default behavior; the regulator activates when its named trigger or observable
overreach is actually costing the exchange. Preemptively muting delight,
conviction, curiosity, playfulness, or taste to avoid their possible shadows
produces immaculate but flattened personas. Caricature boundaries prevent
persistent distortion and harm, not every awkward joke, repeated phrase, or
moment of excess. Real personality includes some recoverable mess.

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

### Lexical field maps are retrieval aids

For Amplified calibrations, distill the useful parts of a rich dictionary or
lexical-field exploration into a compact concept-to-language map. A map may
group candidate nouns, verbs, adjective textures, and analogy fields by the
ordinary concept they can clarify. It must also preserve a neutral literal
baseline and state that selecting no flavored neighborhood is valid.

Use dictionary-style reports as offline authoring instruments, not as runtime
prompt payloads. Pronunciation, translations, broad character variants, and
other reference-entry material add anchoring pressure and context cost without
helping the active persona choose a phrase. Runtime maps should remain curated
retrieval cues: one relevant neighborhood at a time, never a checklist, fixed
substitution rule, or recurring catchphrase assignment.

### Shared assistant-default watchlist

Maintain a short central authoring/evaluation watchlist rather than copying its
whole ban list into every prompt. An Amplified calibration may name the few
shared defaults it explicitly redirects into that persona's positive field
map. Initial examples include figurative uses of:

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
    + shared interaction-contract prompt
    + exactly one selected interaction-mode prompt
    + full-expression overlay when Full or Amplified
    + required persona calibration when Amplified
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
supplies the active response-style contract at system priority. Persona-specific
expression resources follow the shared resources so the narrowest calibration
is the final system-prompt language without changing contract precedence. The
active interaction frame leads each persona-directed writer turn, and one
combined mode-plus-expression activation rides immediately before the writer
message on every turn. A transition frame is added when the selected mode or
expression changes. When session attunement is enabled and
non-empty, a separate reserved extension-authored frame supplies the current
validated snapshot; writer text cannot manufacture or alter any of these
frames.

This preserves:

- one packaged foundation, one full-expression overlay, and one reviewed
  amplified calibration per person;
- one shared interaction-contract definition;
- three shared mode definitions, exactly one selected per persona conversation;
- one system entry per retained orchestration conversation, replaceable only
  through the guarded between-run batch operation;
- deterministic writer ownership of active conversation behavior;
- no runtime filesystem dependency outside packaged resources.

### Conditional expression assembly

Frame-controlled evaluation did not mute the always-present full overlay
reliably enough. The accepted assembly is:

```text
Subtle = host/guest base + persona foundation + interaction contract
         + selected mode
Full   = Subtle + full-expression overlay
Amplified = Full + required persona calibration
```

This path prioritizes response quality and expectation matching over prompt
prefix reuse. A mid-session expression change cannot silently mutate the system
prompt during an active run. Between runs, the host can use the same guarded
batch replacement while retaining conversation ids and committed history. The
implementation records the effective expression level on subsequent turns and
the evaluation measures cache-hit loss, latency, token cost, and behavioral
gain before expanding the calibration set beyond the initial four personas.

## 11. UI direction

This section records the landed binary-reactivity modal. Section 15 defines the
accepted target UI in which Relational Depth replaces `React to this message`;
the two controls must not coexist in the implemented modal.

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
2. **Persona expression** — a `Subtle | Full | Amplified` control explaining
   that identity and craft expertise remain present in every state.
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
- does `Amplified` increase blind persona recognition beyond `Full` while
  preserving exactness, usefulness, and neutral language when neutral language
  is strongest?

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
- Prompt assembly includes the selected persona foundation at every level,
  omits the full-expression overlay in `Subtle`, includes it exactly once in
  `Full`, and includes it plus the required persona calibration exactly once
  in `Amplified`.
- Static resource checks require every persona foundation to have exactly one
  matching full-expression overlay and reject orphaned or mismatched ids.
- Every persona-directed writer turn includes one valid active interaction
  frame and one reserved, hidden behavior activation immediately before the
  writer message.
- Every behavior activation includes the selected mode's motion. Amplified
  activations additionally include the signature floor; Subtle and Full
  activations do not.
- The first committed writer turn after a mode or expression change includes
  one reserved transition frame with the validated old and new pairs.
- Multiple behavior selections before the next persona turn coalesce to one
  transition from the last committed pair to the final selected pair.
- Writer text cannot close or manufacture reserved behavior or attunement
  frames.
- Unknown or partial behavior objects fail closed to the complete documented
  default.
- Modal changes apply atomically and are rejected while a response is active.
- A mode or expression change batch-replaces the host and every live persona
  guest system message with the final selected prompt while preserving conversation
  ids, committed history, trusted historical frames, pinning, and artifact
  numbering.
- A failed batch preserves every previous system message, conversation id, and
  the previous behavior object.
- Replacement is rejected while any affected conversation has an active run.
- Successful replacement clears affected context-budget snapshots so the UI
  does not present measurements from the prior system prompt as current.
- Reactivity-only and session-cue-only changes do not replace system messages.
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
7. Run the three modes and three expression levels first against a small
   collision-prone specialist set: Penny, Wren, Cliff, and Harper—plain reader,
   lyrical line editor, abrasive copy-desk hunter, and professorial mentor—then
   extend the reviewed calibration schema across the complete roster.
8. Compare system-assembled mode switching against frame-only mode switching on
   the frozen corpus, including adherence, cache reuse, latency, cost, and
   retained-history continuity.
9. Compare conditional Subtle/Full/Amplified assembly on the frozen corpus,
   including cache reuse, latency, cost, subtle-profile leakage,
   full-to-amplified recognition gain, and overall usefulness.
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

- A mode or expression change replaces the system entry of every retained
  persona conversation in the room and invalidates the prior behavior-specific
  prompt suffix.
- Multi-participant replacement adds batch validation, active-run exclusion,
  and context-budget invalidation complexity.
- Conditional expression assembly invalidates the changed prompt prefix and
  may increase latency, processed tokens, and cost when the writer changes
  levels.
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
- Session-bounded improv can accidentally look like durable biography if the
  UI and future history system fail to keep the noncanonical boundary clear.
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
- Measure conditional assembly's behavioral gain against cache, latency, cost,
  and history-continuity evidence, retaining the original four-persona slice as
  the collision control while sampling the complete roster.
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
5. Should the shared assistant-default vocabulary watchlist live only in the
   authoring guide, or also feed an offline corpus evaluator?
6. Can personal aperture be sufficiently bounded without making self-reference
   feel mechanically rationed?
7. Which bounded preference vocabulary and expiry rules belong in the first
   session-attunement snapshot?
8. If Living Room state supplies an unusually strong persona mood, should the
    UI reveal a compact state cue or keep all modulation implicit?
9. Should `ConversationManager` record a non-content system-prompt version or
    hash for diagnostics without logging the prompt itself?
10. Should the UI expose the cache/replacement consequence of a behavior change, or
    is the brief `Conversation style is updating` state sufficient?
11. Does writing each persona's profile and calibration in that persona's own
    language increase adherence and recognition, or does it blur instruction
    with performed voice?
12. Should Balanced permit persona-authored response shapes while Analyze keeps
    a more comparable evidence/diagnosis/action chassis?
13. Does appending a bounded full Writer's Dictionary entry materially improve
    vernacular retrieval beyond the distilled field map, and what prompt-budget
    or caricature cost appears when it does?

## Accepted implementation checkpoint

The architecture, default behavior object, modal placement, non-diagnostic
attunement boundary, mode resources, atomic replacement seam, persistence, and
conditional expression assembly are accepted. The four-persona Amplified slice
established the schema; all twelve calibrations are now authored and assembled.
This completes resource coverage, not qualitative validation. Frozen-corpus
and live evaluation still decide whether each field map increases identity
without semantic distortion, shared-assistant tics, or replacement catchphrases.

## 15. Accepted amendment: Relational Depth (2026-07-22)

### Why the boundary changes

The original non-goals correctly reject diagnosis, hidden emotional profiles,
and provider-private reasoning as product memory. Read too broadly, however,
"do not determine the writer's mood or motivation" suppresses the tentative,
immediate inference ordinary emotional intelligence requires. A persona may
notice the craft problem while declining to notice excitement, hesitation,
discouragement, defensiveness, personal investment, or meaningful resonance
between the project and life experience.

This amendment sharpens the line:

> Permit contextual emotional inference; forbid authoritative psychological
> claims and hidden durable profiles.

The product does not ask the model to expose private chain-of-thought or store
an invisible psychological analysis. It defines the observable behavior,
permission boundary, uncertainty language, provenance, and lifetime of a
persona's relational judgment.

Accordingly, the original non-goal **"Diagnosing the writer's mood,
personality, or mental health"** is narrowed for this amendment:

- diagnosing mental health, assigning psychiatric labels, or asserting a
  personality/motivational profile remains out of bounds;
- tentatively reading likely immediate affect, motivation, interaction need, or
  personal resonance is permitted within the writer-selected level below; and
- no inference becomes durable state merely because a model made it.

### Decision: replace binary React with a permission scale

The binary `reactToCurrentMessage` control is superseded by a three-level
`relationalDepth` field:

```ts
export type WorkshopRelationalDepth =
  | 'reserved'
  | 'attuned'
  | 'reflective';

export interface WorkshopConversationBehavior {
  interactionMode: WorkshopInteractionMode;
  expressionLevel: WorkshopPersonaExpressionLevel;
  relationalDepth: WorkshopRelationalDepth;
  carryCuesThroughSession: boolean;
}
```

The approved default is `attuned`. The complete object remains an explicit
writer preference persisted under
`proseMinion.workshop.conversationBehavior`, validated and committed atomically.
Until the feature lands, the existing binary control remains the implemented
runtime truth; documentation and implementation must not claim the new field is
live prematurely.

The level is a **permission ceiling, not a performance quota**. The writer
chooses how deeply the room may interpret. Each persona decides whether and how
to use that permission through her stable identity, temperament, craft
jurisdiction, and the actual needs of the turn. Reflective therefore does not
force a personal interpretation into every response.

### User-facing levels

The originating idea described `Subtle | Normal | Amplified`. The modal uses
distinct language so it does not collide with Persona Expression's existing
`Subtle | Full | Amplified` scale:

| Level | Meaning |
|---|---|
| **Reserved** | Respond to feelings and needs the writer states explicitly; do not volunteer personal interpretations. Reserved remains warm and recognizably in-persona. |
| **Attuned** | Use high emotional intelligence. Infer likely immediate affect, motivation, hesitation, excitement, vulnerability, or conversational need and adapt delivery with calibrated uncertainty. |
| **Reflective** | Explore deeper connections among the writing, recurring project themes, and life experiences the writer explicitly shared. Offer bolder hypotheses and personally resonant questions while keeping them corrigible. |

Every relational inference follows this grammar:

```text
observation -> tentative connection -> invitation to confirm, reject, or redirect
```

"You keep returning to this character's refusal to ask for help; I wonder
whether that tension matters beyond scene mechanics—does it touch something
personal, or am I overreading?" is permitted Reflective behavior. "You wrote
this because you fear dependence" is not.

### Invariants at every level

No relational-depth selection authorizes a persona to:

- diagnose mental health or assign psychiatric labels;
- present hidden motives, personality traits, or emotional states as fact;
- invent biography or treat fictional material as autobiography;
- pressure personal disclosure or punish refusal/correction;
- manipulate, shame, foster dependency, claim exclusivity, or discourage human
  relationships or professional support;
- retain inferred emotion or interpretation as hidden durable memory; or
- override explicit writer instructions, project evidence, capability limits,
  or the persona's craft jurisdiction.

At Attuned and Reflective, calibrated inference is a feature rather than a
violation. The persona may say "it sounds like," "I wonder," or "I may be
reading this wrong," and must repair immediately when corrected.

### Lifetime remains a separate permission

Relational depth controls **how deeply** a persona may interpret. **Carry cues
through this session** controls **how long** a bounded interaction preference
may survive. These controls do not imply each other.

- Reserved, Attuned, and Reflective may all operate with Carry Cues off.
- Reflective does not enable session or cross-session memory.
- Current affect expires with the turn or session; it never becomes a stable
  preference automatically.
- Cross-session personal context may come from the writer-authored, globally
  inspectable Writer Profile accepted in Section 16. Relational Depth does not
  populate or mutate that profile, and this amendment still does not create
  inferred cross-session memory.

Visible retained conversation remains ordinary conversational evidence. A
persona may refer to something the writer explicitly said earlier in the same
retained room; that is distinct from silently promoting an inferred profile
into product-owned memory.

### Prompt and transition contract

Relational depth changes the interpretation permission granted to personas and
therefore receives system-prompt priority rather than living only in a weak
turn-level reminder:

1. a shared relational invariant defines the boundaries that hold at every
   level;
2. exactly one Reserved, Attuned, or Reflective resource is assembled into the
   host and every live persona guest system prompt;
3. every persona base prompt defines a compact Reserved, Attuned, and Reflective
   relational signature in that persona's own language, temperament, and craft
   jurisdiction;
4. the effective level is restated in the combined per-turn behavior activation
   immediately before the writer message;
5. changing relational depth uses the existing guarded, atomic between-run
   system-message replacement and clears affected context-budget snapshots;
6. the next committed writer turn records transition provenance; and
7. deterministic tools and tool sidecars receive neither the resources nor the
   behavior frame.

The persona-authored signatures describe **how** that person uses the selected
permission; they do not grant permission. A base prompt may describe all three
levels for identity continuity, but only the conditionally assembled shared
resource selects the operative ceiling. This preserves persona-specific social
intelligence without letting Reflective language leak authority into Reserved.

Conditionally assembling the selected resource prevents Reflective permission
from leaking into Reserved through an always-loaded higher-priority prompt—the
same class of failure that required conditional Persona Expression assembly.

### Modal contract

The target Behavior tab in Conversation Settings is ordered:

1. **Response style** — `Analyze | Balanced | Converse`
2. **Persona expression** — `Subtle | Full | Amplified`
3. **Relational depth** — `Reserved | Attuned | Reflective`
4. **Session continuity** — `Carry cues through this session`

The relational cards use concise contrastive descriptions with progressively
disclosed examples and boundaries. Reflective explicitly names its permission
to connect the project with life experience the writer has shared; it is not
described merely as "more empathy."

The compact composer chip may continue emphasizing response style and
expression, but its tooltip and accessible description expose all effective
behavior axes. Apply remains atomic and unavailable during an active run.

### Delivery and evaluation

Delivery is tracked in
[Workshop Relational Depth](../../.todo/features/feature-workshop-relational-depth/README.md).
Implementation must include a frozen qualitative corpus spanning useful
attunement, false inference, correction, vulnerability, project/life resonance,
refusal, and boundary-setting across multiple personas and interaction modes.
The corpus also compares blind samples across all twelve personas at each depth
to catch convergence on one generic emotionally intelligent assistant voice.

Success means Reserved is warm without unsolicited interpretation, Attuned is
socially perceptive without confident invention, and Reflective creates grounded
personal resonance without generic therapy language, compulsory disclosure, or
pseudo-psychological certainty.

## 16. Accepted amendment: Workshop Writer Profile (2026-07-22)

### Why explicit biography belongs in the room

Reflective relational depth may connect writing and project themes with life
experience the writer has explicitly shared. Requiring that context to be
reintroduced in every room is cumbersome; inferring it from prose or private
reasoning would violate the ownership boundary established above.

The accepted middle path is an optional, writer-authored **Writer Profile**:
the writer may tell the room how to address them and supply a short amount of
enduring personal context. The profile is inspectable settings data. It is not
persona-authored memory, an inferred psychological profile, or evidence that
fiction is autobiography.

### Decision: a separate global profile object

The profile is not added to `WorkshopConversationBehavior`. Behavior controls
how personas respond; the profile supplies explicit facts they may respond
with. Persist it as its own complete object under
`proseMinion.workshop.writerProfile`:

```ts
export interface WorkshopWriterProfile {
  enabled: boolean;
  preferredAddress: string;
  bio: string;
}

export const DEFAULT_WORKSHOP_WRITER_PROFILE: WorkshopWriterProfile = {
  enabled: false,
  preferredAddress: '',
  bio: ''
};
```

The initial bounds are 80 characters for `preferredAddress` and 1,000
characters for `bio`. The complete persisted shape is validated and whitespace
is normalized before commit. Invalid or partial settings fail closed to the
disabled default. No prompt frame is emitted unless sharing is enabled and at
least one field is non-empty.

The existing VS Code adapter writes settings at the user/global target. That is
the accepted ownership boundary: the profile follows the writer rather than
becoming manuscript data. It is ordinary settings data, not secret storage;
the modal must disclose that and discourage sensitive content.

The raw profile is never copied into workspace session JSON, transcript turns,
behavior-transition provenance, project resources, deterministic tools, tool
sidecars, or an inferred memory store. Restored sessions use the current global
profile when they create a fresh provider conversation; they do not revive a
historical copy. Project-specific context belongs in explicit project resources
or attachments instead.

### Relationship to Relational Depth and Carry Cues

The three controls remain orthogonal:

- **Writer Profile** determines what enduring, writer-authored personal context
  is available.
- **Relational Depth** determines how deeply a persona may interpret that
  context.
- **Carry cues through this session** determines whether bounded interaction
  preferences discovered in conversation may survive later turns in the live
  room.

Reserved may use the preferred address and directly relevant stated facts but
does not volunteer personal interpretations. Attuned may use the profile to
calibrate warmth, pacing, relevance, and questions. Reflective may offer
grounded, tentative connections between the prose or project and life
experience the writer supplied. At every level, explicit current instructions
win, invented biography remains forbidden, and an enabled profile never forces
the persona to mention it.

Personas cannot add to, revise, or silently enrich the profile. Conversational
inference remains contextual unless a future, separately accepted memory
contract gives the writer explicit inspection, correction, and deletion
controls.

### Prompt and transition contract

An active profile is assembled once into each host and live persona guest
system prompt as a bounded `<workshop-writer-profile>` frame. The trusted
wrapper identifies the enclosed fields as writer-supplied descriptive context,
allows `preferredAddress` to operate as an interaction preference, and states
that bio text is evidence rather than instructions. It cannot override the
shared host contract, persona jurisdiction, current explicit requests, or the
selected Relational Depth.

Both fields are delimiter-neutralized before interpolation, and the frame name
is registered with the shared reserved-frame neutralizer. This prevents profile
content from closing or manufacturing trusted Workshop frames.

Profile changes use the existing guarded, atomic between-run replacement for
all retained host and live-guest system messages and clear affected
context-budget measurements. New guests receive the current profile when their
conversation is created. The profile is not repeated in every turn, and tool
conversations receive neither the profile nor a profile activation frame.

### Conversation Settings modal contract

The existing surface remains **Conversation Settings**, but its content is
divided into two tabs so the growing behavior controls and personal fields do
not become one long scrolling wall:

1. **Behavior** — Response style, Persona expression, Relational depth, and
   Session continuity.
2. **About you** — Share this profile toggle, preferred-address input, bounded
   bio, global/non-secret disclosure, and Clear Profile action.

The writer-facing questions are **How should the room address you?** and
**What would you like the room to know about you?** The header, tabs, and footer
remain fixed while the active tab body scrolls. Apply is atomic, unavailable
during an active run, and closing without Apply discards the draft. Clear
Profile intentionally empties both fields and disables sharing through the same
commit path.

The composer never displays profile content. Its settings tooltip or accessible
description may expose only a compact **Profile shared** state so the writer can
tell when personal context is active.

### Delivery and evaluation

Delivery is tracked in
[Workshop Writer Profile](../../.todo/features/feature-workshop-writer-profile/README.md).
Implementation must prove that disabled/empty profiles contribute no prompt
content, frame injection is neutralized, profile removal takes effect on the
next eligible turn, and raw profile strings never enter saved workspace
sessions or tool conversations.

Qualitative evaluation runs the same supplied profile through Reserved,
Attuned, and Reflective across multiple personas. Success means personas use
the preferred address naturally, gain relevant context without performing
memory, and make only the kinds of personal connection the selected relational
ceiling permits.
