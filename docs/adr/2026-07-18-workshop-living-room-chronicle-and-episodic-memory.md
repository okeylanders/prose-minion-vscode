# ADR: Workshop Living Room Chronicle and Episodic Persona Memory

- **Status:** Draft
- **Date:** 2026-07-18
- **Deciders:** Okey Landers, Ada Forge
- **Related:**
  - [Workshop Persona-Hosted Conversations](2026-07-09-workshop-persona-hosted-conversations.md)
  - [Workshop Excerpt Revision and Room Memory](2026-07-11-workshop-excerpt-revision-and-room-memory.md)
  - [Workshop Guest Persona Sidecars](2026-07-11-workshop-guest-persona-sidecars.md)
  - [Workshop Session Persistence](2026-07-14-workshop-session-persistence.md)
  - [Workshop Thread Artifacts and Context Compaction](2026-07-18-workshop-thread-artifacts-and-context-compaction.md)
  - [Verbalized Sampling for Creative Diversity](2025-10-26-verbalized-sampling-for-creative-diversity.md)

## Context

Workshop personas now have distinct occupations, craft jurisdictions, reasoning
procedures, conversational behavior, and private candidate-selection rules.
Those prompts make the hosts recognizably different, but their identity remains
fundamentally static. Given similar inputs over time, even a stochastic model
continues to favor high-probability responses and high-probability invented
backstory. Asking the model to "make up something random that happened
yesterday" does not solve this: repeated model-authored randomness regresses
toward statistically ordinary events.

The desired product behavior is richer:

- a host can carry a small residue from yesterday into today's conversation;
- events can involve several Workshop colleagues and become shared history;
- the same event lands differently on different people;
- externally supplied entropy pushes events away from the model's average;
- consequences persist, so novelty becomes biography rather than disposable
  improvisation;
- daily life colors a host without displacing the writer or manuscript.

The governing insight is:

> Randomness creates novelty. Persistence turns novelty into biography.

This feature is provisionally called the **Workshop Living Room**. Its durable
record is the **Room Ledger**.

## Decision summary

Build the feature as four layers:

```text
Deterministic external entropy (The Diffuser)
    -> canonical shared events (The Chronicler)
    -> persona-specific lived perspectives (Day Cards)
    -> bounded, session-stable prompt projection
```

The Room Ledger will be stored as schema-versioned files in the host
application's **extension-private global data directory**, not in the writer's
open project and not in a VS Code Memento. In the VS Code adapter this directory
is rooted at `ExtensionContext.globalStorageUri`; a future desktop adapter will
use its application-data directory.

The persisted ledger may retain complete daily records. Prompt injection is
bounded independently: a Workshop session receives only recent day-card
material plus compact durable relationship memory. **Context pressure is solved
by projection, not by deleting history.**

This ADR defines the target architecture only. It does not authorize an
implementation sprint, background model spend, or a default-on rollout.

## Goals

1. Create externally diffused, persona-consistent events that do not collapse
   toward the model's first generic idea.
2. Maintain one canonical shared reality when personas have events together.
3. Let each persona retain a different emotional and interpretive residue from
   the same event.
4. Preserve long-term history without growing every Workshop prompt forever.
5. Keep generated room lore out of the writer's manuscript repository by
   default.
6. Remain host-agnostic: core owns the domain; app shells provide private
   storage.
7. Make generation cost, provenance, reset, and export visible and controllable.

## Non-goals

- Turning Workshop into an autonomous life simulator.
- Letting ambient lore override craft jurisdiction or factual evidence.
- Feeding manuscript text, context attachments, or writer-private project facts
  into the chronicle generator.
- Generating a new personal history independently for every host.
- Requiring a persona to mention yesterday in every response.
- Persisting or exposing model chain-of-thought.
- Synchronizing the Room Ledger across machines in v1.
- Implementing cross-restart provider conversation memory.

## Architecture

### 1. The Diffuser supplies external entropy

Random selection is deterministic code, not a request for the model to "be
random." A UUID-backed seed drives a reproducible pseudorandom selection from
curated lexical and event-shape dictionaries.

```ts
interface EntropyPaletteV1 {
  schemaVersion: 1;
  seed: string;
  verbs: string[];
  concreteNouns: string[];
  adjectives: string[];
  names: string[];
  objects: string[];
  placeQualities: string[];
  socialPressures: string[];
}
```

The dictionaries are stratified rather than sampled uniformly from an
unabridged dictionary. Useful bands include:

- actions;
- concrete objects and props;
- places and spatial conditions;
- sensory qualities;
- social complications;
- emotional pressures;
- minor inconveniences;
- names and temporary occupations;
- rare-but-plausible event shapes.

The palette is mandatory inspiration for the Chronicler, not a list of words
the eventual persona must literally say. Literal forced insertion would turn
the feature into Mad Libs and make ambient lore invade manuscript critique.

The seed and selected palette are persisted with the generated record. A failed
or surprising generation can therefore be inspected and reproduced at the
deterministic-input boundary even though model completion remains stochastic.

### 2. One Chronicler creates canonical shared facts

A single stateless pre-agent receives:

- canonical persona prompts and relationship metadata;
- the recent Room Ledger projection;
- durable relationship summaries;
- local date, time, and timezone;
- the externally selected entropy palette;
- a strict structured-output contract.

It produces one or more shared events plus affected personas' perspectives in
one generation. It does **not** receive the current excerpt, configured project
resources, context attachments, transcript, todos, or writer message.

Generating the shared event once prevents split reality. Quinn and Cliff may
remember the same café incident differently, but they cannot independently
invent different cafés, dates, or outcomes.

```ts
interface RoomEventV1 {
  id: string;
  occurredAt: string;
  participantIds: WorkshopPersonaId[];
  summary: string;
  sourcePalette: EntropyPaletteV1;
  relationshipEffects: RelationshipEffectV1[];
  persistence: 'ambient' | 'short-lived' | 'durable-candidate';
}

interface PersonaDayCardV1 {
  personaId: WorkshopPersonaId;
  eventIds: string[];
  livedSummary: string;
  emotionalResidue?: string;
  currentPreoccupation?: string;
  relationshipShifts: RelationshipEffectV1[];
  mentionPolicy: 'ambient-only' | 'relevant-only' | 'may-volunteer';
}
```

The stored artifact contains structured results and provenance, never hidden
reasoning or discarded candidates.

### 3. Day Cards turn fact into individual experience

The Chronicler produces one shared event and distinct Day Cards. A card is not
a new version of reality; it is the event's effect on one person.

For example, a seeded palette such as:

```text
misplace / receipt / ceremonial / Evelyn / umbrella
```

might yield a shared incident involving a misplaced prop-rental receipt and an
overly formal umbrella return. Quinn carries the unresolved handoff chain;
Dev remembers the theatrical ceremony; Cliff remembers that three adults
required six exchanges to return one umbrella. The facts agree. Attention,
emotion, and future conversational availability differ.

Day Cards may influence:

- mood and conversational temperature;
- immediately available metaphors;
- patience, amusement, distraction, or energy;
- relationship texture;
- which adjacent detail catches the persona's attention.

They do not change:

- craft jurisdiction;
- evidence standards;
- Workshop capabilities;
- manuscript canon;
- system safety and provenance rules.

### 4. The Room Ledger is append-oriented and schema-versioned

The ledger is logically append-only: completed historical days are immutable.
The current day may acquire additional event batches as time advances. Derived
durable summaries may be rewritten because they are projections that can be
rebuilt from source events.

Proposed layout:

```text
<private-global-storage>/workshop-living-room/v1/
  manifest.json
  days/
    2026/
      07/
        2026-07-17.json
        2026-07-18.json
  durable/
    relationships.json
    personas/
      agnes.json
      cliff.json
      ...
```

Each file carries its own `schemaVersion`, generation timestamp, local timezone,
prompt-version identifier, model id, and source event ids. API keys, provider
headers, raw model responses, manuscript text, and hidden reasoning are never
stored.

Day files are small, inspectable, and naturally enumerable. They avoid one
ever-growing blob and confine corruption or migration failure to a bounded
period. The current day is written through a temporary sibling and promoted
only after validation where the adapter can provide safe replacement semantics.
Malformed files are logged and skipped; they never prevent Workshop use.

### 5. Prompt projection is bounded; storage is not destructively windowed

V1 keeps raw daily records indefinitely by default. At the expected scale,
small structured day files cost far less than manuscript session snapshots.
No automatic "drop the oldest head" policy is adopted.

The prompt projector builds a compact `RoomContextSnapshot` from:

- yesterday's relevant Day Card;
- events that occurred today before the session snapshot time;
- a bounded durable relationship/persona summary;
- stable event ids and ledger revision for observability.

It does not ship the full ledger. Old daily records can remain on disk without
occupying model context. If storage growth later becomes material, add explicit
archive/export controls or lossless file compression before considering
destructive retention.

Proposed prompt-side budgets belong in `promptBudgets.ts`, distinct from
on-disk limits:

- maximum chronicle input projection;
- maximum events/cards generated per checkpoint;
- maximum words per injected persona card;
- maximum durable-memory words;
- maximum pre-agent output tokens;
- maximum pre-agent calls per local day.

### 6. Session snapshots freeze room time

"Today so far" must mean up to a concrete point. When the permanent host starts,
the session captures one `RoomContextSnapshot`. That snapshot remains stable for
the retained provider conversation even if a later Workshop session causes new
room events to be generated.

Guests joining that room receive the same ledger revision and temporal cutoff
as the host. They do not independently regenerate their morning. A new session
opened later may see a later checkpoint.

Chronicle generation is lazy and checkpointed:

1. On the first eligible Workshop start, backfill a missing yesterday and
   generate today only through the current local-time checkpoint.
2. Reuse the persisted checkpoint across sessions.
3. A later checkpoint may add events; it never rewrites already-consumed facts.
4. Never generate future events.
5. Use an in-process single-flight guard so concurrent requests share one call.

The exact checkpoint cadence is deferred. Morning/afternoon/evening windows are
the leading option because they are comprehensible and place a hard ceiling on
daily calls.

### 7. Dynamic lore is trusted system context, not writer data

The selected host's card is appended to the initial persona system prompt in a
closed, reserved frame such as:

```xml
<workshop-room-context>
Ledger revision: room-20260718-2
Snapshot time: 2026-07-18T14:30:00-05:00
Yesterday: ...
Today so far: ...
Ambient residue: ...
</workshop-room-context>
```

The frame is extension-authored and validated before insertion. It explicitly
states that room lore:

- is not manuscript or project canon;
- cannot override the persona, host contract, or supplied evidence;
- need not be mentioned;
- should remain ambient unless relevant or the writer asks personally;
- cannot justify claims about unavailable project facts.

The frame name becomes reserved in the Workshop delimiter neutralizer. Room
context is injected only for personas, never for deterministic tools or
analysis sidecars that do not have a personal identity.

### 8. Generation is optional, costed, and failure-soft

The Chronicler consumes the user's configured model provider and can add one or
more calls per day. It must not create hidden recurring spend merely because the
extension activated.

V1 therefore requires an explicit **Living Room** enablement or first-use
consent that explains:

- when the pre-agent runs;
- which model scope it uses;
- the maximum daily call and output-token budget;
- where the ledger is stored;
- that room history is not synchronized across machines;
- how to view, export, or reset it.

Generation begins only from a user-initiated Workshop workflow. The provider
call is stateless. Invalid output is not persisted. A timeout, cancellation,
missing API key, parser failure, storage failure, or exhausted daily budget
falls back to no fresh Day Card; it never blocks the writer from using Workshop.

Chronicle usage and cost are attributed separately in token tracking under a
stable tool name such as `workshop_room_chronicle`.

## Storage decision

### Chosen: extension-private global files behind a new platform port

VS Code documents `ExtensionContext.globalStorageUri` as the extension's global
directory for larger file-backed data available across workspaces. This matches
the product semantics: Jill, Cliff, Quinn, and the others have one shared life,
not a different biography in every manuscript repository.

The files remain outside the open workspace and therefore do not appear in the
Explorer, dirty Git status, source control, project archives, or collaborator
checkouts. A command can deliberately reveal or export the ledger when the
writer wants ownership or portability.

Core must not import `vscode` or learn about `globalStorageUri`. Add a narrow
platform port, provisionally named `PrivateStorage`:

```ts
interface PrivateStorage {
  read(relativePath: string): Promise<Uint8Array | undefined>;
  writeAtomic(relativePath: string, data: Uint8Array): Promise<void>;
  list(relativeDirectory: string): Promise<Array<[string, FileType]>>;
  delete(relativePath: string): Promise<void>;
}
```

The VS Code adapter roots all operations at `context.globalStorageUri` and uses
`vscode.workspace.fs` with the original URI scheme. Relative paths are
containment-checked; callers cannot escape the private root. The desktop adapter
will root the same port in its application-data directory.

Do not reuse the current `FileSystem` port by passing
`context.globalStorageUri.fsPath`. `VsCodeFileSystem` reconstructs every input
with `vscode.Uri.file(...)`, which forces the `file:` scheme and loses URI
fidelity for virtual or remote storage. The new port keeps storage-root and URI
translation in the app adapter where they belong.

### Why not write the ledger into the open project?

Workspace files are correct for writer-owned session records: they contain the
writer's excerpt and are intentionally inspectable and portable. Ambient room
lore has different ownership and scope:

- it is application state, not manuscript material;
- it should follow the personas across projects;
- it should not create source-control noise;
- collaborators opening the same repository should not silently inherit one
  user's fictional room history;
- a project archive should not accidentally include unrelated persona lore.

Project files remain a useful **explicit export format**, not the default
working store.

### Why not `workspaceState` or `globalState`?

Mementos fit small key/value state. The Room Ledger needs file enumeration,
schema migrations, per-day records, export, corruption isolation, and potentially
years of history. Storing one growing JSON value would require repeatedly
rewriting the whole ledger and eventually force destructive windowing. It also
makes inspection and recovery unnecessarily opaque.

Small coordination facts may still live in `globalState` if implementation
proves that useful, but it is not the ledger's source of truth.

### Why global rather than workspace-private storage?

`ExtensionContext.storageUri` would keep files out of the project while scoping
them to one workspace. That solves repository cleanliness but fragments the
personas' life by manuscript. The feature's premise is a standing room whose
history crosses projects, so `globalStorageUri` is the closer semantic match.

A future scope setting may support separate rooms or project-specific casts;
v1 chooses one room per extension installation/profile.

## Memory lifecycle

Persistence classifies event consequences without deleting their source:

- **Ambient:** eligible for today's tone; normally absent from later prompt
  projections.
- **Short-lived:** eligible for yesterday/today projection and a small number
  of subsequent sessions.
- **Durable candidate:** may update a relationship or persona summary after
  validation/compaction.

Durable summaries are derived indexes, not substitutes for the raw event files.
They record source event ids so a future rebuild, audit, or corrected compaction
can trace every claim. A summary update never manufactures a relationship change
that is absent from the ledger.

Long-term promotion should be rare. Otherwise a month of umbrellas becomes as
important as the persona's defining history. Candidate promotion can be decided
by deterministic thresholds plus a bounded summarization pass, but the exact
policy is deferred.

## Consistency, concurrency, and atomicity

- Chronicle generation and persistence are a two-phase operation: generate and
  validate first; persist the complete batch second.
- Slot ids are deterministic from room id, local date, and checkpoint. Retries
  cannot intentionally create a second canonical slot.
- One extension-host process uses a single-flight promise per slot.
- Previous day files are immutable after rollover.
- Derived summaries carry a monotonically increasing ledger revision.
- A session stores the revision and event ids it consumed.

Multiple VS Code windows may run separate extension-host processes against the
same global storage directory. `workspace.fs` does not expose a portable
compare-and-swap primitive. Cross-process duplicate generation therefore
requires an implementation spike. Candidate approaches include a short lease
record, immutable attempt files followed by deterministic reconciliation, or a
small adapter-level lock where the host supports one. This is a correctness and
cost concern, but not a reason to put lore in the project. V1 must document and
test its chosen reconciliation rule before rollout.

## Privacy and trust boundaries

1. The Chronicler receives no manuscript, attachment, transcript, todo, or
   configured project-resource content.
2. Randomly selected names and invented background characters are namespaced to
   room lore and cannot become project canon.
3. Day Cards are extension-authored model output and are validated as data before
   prompt insertion.
4. No API keys, secrets, raw provider payloads, or hidden reasoning are stored.
5. The writer can view metadata, export the ledger, reset the room, and disable
   future generation.
6. Reset is explicit, confirmed, and destructive; export should be offered first.
7. Logs contain event ids, revisions, counts, latency, and failures—not the full
   generated vignette by default.

## Domain and composition boundaries

Proposed core components:

```text
application/services/workshop/living-room/
  EntropyDiffuser
  RoomChronicleService
  RoomChronicleValidator
  RoomContextProjector

infrastructure/workshop/living-room/
  RoomLedgerStore          # consumes PrivateStorage
  LivingRoomGenerator      # stateless model adapter/orchestrator seam

domain/models/workshop/living-room/
  EntropyPalette
  RoomEvent
  PersonaDayCard
  RoomDay
  DurableRoomMemory
```

Exact paths may follow the codebase's eventual Workshop extraction, but the
dependency direction is fixed:

- domain models know nothing about storage or VS Code;
- the application service owns lifecycle and orchestration;
- infrastructure implements ledger serialization and model generation;
- the VS Code adapter implements `PrivateStorage`;
- `extension.ts` remains the only composition root.

No domain handler or persona prompt constructs the Chronicler, ledger store, or
platform adapter.

## Observability

Record structured, content-light telemetry in the output channel:

- slot id and ledger revision;
- palette seed id, not necessarily the complete palette;
- model id and prompt version;
- call count, prompt/completion tokens, and cost;
- validation result and rejected-field counts;
- event/card counts and affected persona ids;
- persistence latency and file size;
- fallback reason when no fresh card is available.

The Workshop context-budget surface should report injected Room Context tokens
as a distinct category. A writer debugging unexpected persona behavior must be
able to see that a Day Card was present and open the relevant event by id.

## User controls

V1 should expose:

- Enable/disable Living Room generation.
- View current day and recent history.
- Export the Room Ledger to a writer-selected location.
- Reset the room with confirmation.
- Show generation usage/cost.

Potential later controls:

- regenerate the current unconsumed checkpoint;
- pin or promote an event to durable memory;
- dismiss an ambient event from prompt projection without deleting history;
- maintain multiple named rooms;
- import an exported ledger;
- choose global versus project-specific room scope.

Regeneration after a session has consumed an event cannot silently rewrite that
session's past. It must create a new ledger revision and preserve the original
event record.

## Alternatives considered

### 1. Ask each persona to invent yesterday independently

**Rejected.** It costs up to eleven calls, creates contradictory shared events,
and lets each generation drift toward the same high-probability daily life.

### 2. Ask one model for random events without external entropy

**Rejected.** Stochastic output varies, but repeated requests still favor the
model's typical event distribution. The Diffuser must perturb the input outside
the model.

### 3. Force random dictionary words into visible persona replies

**Rejected.** It produces novelty theater, contaminates manuscript critique,
and makes the mechanism more visible than the person. Random words shape the
chronicle; lived consequences shape the reply.

### 4. Store the Room Ledger under `prose-minion/` in the workspace

**Rejected as the default; retained for export.** It is visible and portable but
pollutes repositories, binds one life to one project, and risks committing
unrelated application state.

### 5. Store a rolling JSON blob in `workspaceState`

**Rejected.** It is workspace-scoped, difficult to enumerate or recover, and
invites deleting old history as the value grows.

### 6. Store one growing JSON blob in `globalState`

**Rejected.** Global scope is correct, but the Memento abstraction is wrong for
an append-oriented, enumerable, exportable, schema-versioned history.

### 7. Store files under `storageUri`

**Rejected for v1.** It keeps files private but creates a different Workshop
life for each workspace. This may become an optional room scope later.

### 8. Store one monolithic file under `globalStorageUri`

**Rejected.** Every update rewrites the full history, corruption has a large
blast radius, and partial migration is difficult. Bounded day files plus derived
summaries have cleaner lifecycle semantics.

### 9. Use SQLite

**Deferred.** Transactions, locking, and queries are attractive, but a native or
WASM database adds dependency, packaging, remote/web-host, and migration cost
before the data volume justifies it. Schema-versioned files are the well-labeled
shed.

### 10. Keep no durable history

**Rejected.** Random events without persistence are disposable color, not lived
experience. The feature's value depends on consequence.

## Consequences

### Gains

- Personas accumulate particular histories instead of endlessly regenerating
  an average personality.
- One event can deepen several relationships without breaking shared reality.
- External entropy produces reproducible creative perturbation.
- The writer's repository stays clean.
- Complete history can remain available without consuming complete prompt
  history.
- The platform boundary supports a future desktop host naturally.
- Event provenance makes surprising behavior inspectable rather than mystical.

### Costs and risks

- At least one additional model call is introduced on eligible checkpoints.
- The first Workshop turn after a missing checkpoint may have extra latency.
- A new platform port and storage schema require migrations and adapter tests.
- Global private files are installation/profile-local and are not automatically
  portable or synchronized.
- Cross-window generation requires explicit reconciliation.
- Excessive lore can turn useful editors into self-involved improv characters.
- Weak lexical curation can produce offensive, incoherent, or monotonously odd
  event seeds.
- A durable fictional history needs reset, export, inspection, and corruption
  recovery UX.

### Mitigations

- Explicit enablement and hard daily budgets.
- Failure-soft Workshop startup.
- One shared call rather than per-persona calls.
- Ambient mention policies and prompt instructions that keep pages first.
- Curated and tested lexical sources.
- Structured validation before persistence or injection.
- Bounded prompt projection independent of retained storage.
- Content-light observability plus user-facing ledger inspection.

## Testing strategy

### Deterministic tests

- Seeded Diffuser output is reproducible.
- Sampling respects category, uniqueness, and allow/deny constraints.
- Relative storage paths cannot escape the private root.
- Schema readers tolerate unknown additive fields and reject malformed records.
- Slot ids are stable across retries.
- No future event can enter a session snapshot.
- Prompt projection respects word and item budgets.
- The same shared event id appears in every affected Day Card.
- Reset, export, corruption fallback, and revision behavior are deterministic.

### Model contract tests

- Structured Chronicler output validates against the schema.
- Generated events use palette influence without mechanically repeating every
  source word.
- Shared facts do not contradict recent ledger history.
- Persona perspectives differ while factual event fields remain identical.
- Manuscript/project facts never appear because they are absent from input.
- Invalid generations are discarded without partially advancing the ledger.

### Qualitative evaluation

- Blind identification remains at least as strong with Day Cards as without.
- Ambient lore improves perceived individuality without reducing craft utility.
- Unsolicited lore mentions remain rare.
- Multi-week simulations produce varied event types rather than a new average
  pattern.
- Relationship changes remain intelligible and do not accelerate into soap opera.
- Cost and latency remain acceptable under the configured daily ceiling.

### Storage soak test

Generate at least one simulated year of daily files and measure:

- total bytes and file count;
- listing and projection latency;
- migration time;
- corruption isolation;
- durable-summary rebuild time;
- whether a destructive retention policy is actually necessary.

Do not introduce head deletion from intuition; let the soak data decide.

## Implementation sequence

1. Finalize this ADR and the storage/concurrency spike.
2. Curate and test lexical entropy sources.
3. Add domain schemas and deterministic Diffuser.
4. Add `PrivateStorage` port plus VS Code and in-memory test adapters.
5. Implement schema-versioned `RoomLedgerStore` and year-scale soak tests.
6. Implement the stateless Chronicler contract and validator.
7. Implement checkpoint lifecycle, single-flight behavior, and reconciliation.
8. Implement bounded `RoomContextProjector` and prompt framing.
9. Add explicit settings, consent, inspection, export, reset, and cost surfaces.
10. Run blind-voice, intrusion, continuity, latency, and cost evaluations before
    considering default enablement.

## Open questions

1. Which model scope should power the Chronicler: assistant, context, or a new
   explicitly budgeted Living Room selection?
2. What are the checkpoint boundaries and maximum calls per local day?
3. Should missing inactive days be backfilled, summarized as uneventful, or left
   absent?
4. How are cross-window generation attempts reconciled without a portable CAS?
5. Which events qualify for durable promotion, and is promotion deterministic,
   model-assisted, or writer-confirmed?
6. Should v1 retain every raw day indefinitely, or ship an explicit archive
   threshold after the storage soak test?
7. How are random names curated to avoid collisions with Workshop personas,
   project characters, public figures, or culturally inappropriate combinations?
8. Should the writer be able to edit lore, or only inspect, export, dismiss from
   projection, and reset it?
9. Does one global room per extension profile provide the right identity, or do
   advanced users need named rooms?
10. How should exported ledgers handle schema versions and later re-import?
11. Should Living Room context be included in saved Workshop session files, and
    if so, should they store the consumed card snapshot or only event ids?
12. What is the acceptable unsolicited-lore mention rate in ordinary craft
    conversations?

## Decision checkpoints before implementation

This ADR remains Draft until all of the following are answered:

- storage/concurrency spike proves the `PrivateStorage` adapter and atomic-write
  strategy;
- lexical sources and safety filters are selected;
- prompt and daily cost ceilings are approved;
- consent/default behavior is approved;
- the RoomEvent and PersonaDayCard schemas are reviewed;
- session-snapshot interaction is reconciled with the session-persistence ADR;
- a manual evaluation corpus and success rubric exist.

## References

- [VS Code Extension API: Common Capabilities — Data Storage](https://code.visualstudio.com/api/extension-capabilities/common-capabilities#data-storage)
- [VS Code API: `ExtensionContext`](https://code.visualstudio.com/api/references/vscode-api#ExtensionContext)
- [VS Code Remote Extensions: storage locations](https://code.visualstudio.com/api/advanced-topics/remote-extensions)
- [Verbalized Sampling research summary](../../.research/verbalized-sampling-stanford-research.md)
