# Workshop Session V2 Migration Runway

**Date:** 2026-08-24
**Status:** Approved for implementation
**Decision owner:** Okey Landers
**Prepared by:** Ada Forge
**Scope:** Standing-directive removal persistence and the released Workshop session v1-to-v2 boundary
**Branch / release:** `release/v2.2.0`
**Audience and reading budget:** Maintainer/implementer; 30 seconds, 2 minutes, or 10 minutes
**Implementation gate:** Open

## 0. Change Card — 30 seconds

### Change thesis

> Because the current aggregate can persist a removed standing directive that
> its own integrity validator rejects, and v2.2 still writes the released v1
> schema number after adding persisted widget state, change the terminal
> standing-link invariant and the outer session codec version, while preserving
> fail-closed validation, participant-local conversation degradation, and atomic
> writes, so that public pre-widget sessions migrate safely and new v2.2 files
> carry an honest compatibility clock.

### Architecture moves

| Move | Before | After | Why now | Confidence |
|---|---|---|---|---|
| 1 | A committed standing config is valid only while its directive is active. | A config may instead terminate at one coherent `removed` marker. | Current removal writes this state (`WorkshopSessionService.ts:834-885`) but integrity rejects it (`WorkshopSessionStateV1Integrity.ts:525-544`). | STRONG |
| 2 | Outer reads and writes require `schemaVersion: 1`. | Reads dispatch v1 through an explicit adjacent migration; writes emit v2 only. | ADR release gate requires this at the first persisted-widget release (`docs/adr/2026-07-30-workshop-session-codec-evolution.md:43-60`). | STRONG |
| 3 | Current aggregate normalization also carries pre-release checkpoint repairs. | Formal v1-to-v2 envelope migration remains separate; current normalization runs afterward without weakening validators. | Preserves the declared public-vs-beta boundary. | STRONG |
| 4 | Compatibility is demonstrated mainly by synthesized current-shape tests. | A frozen released-v1 pre-widget fixture proves v1 input becomes current v2 with empty widget collections. | Required by the ADR release gate. | STRONG |

### Scope and highest risks

| Affected boundary | Why affected | Highest failure mode | Risk |
|---|---|---|---|
| Aggregate integrity | Must recognize a legitimate terminal standing lifecycle. | Accepting a corrupt or mismatched removed marker. | HIGH |
| Persisted envelope | Public compatibility clock changes. | Writing v1 again or accepting unsupported versions. | HIGH |
| Storage/coordinator typing | All current writes become v2. | A stale v1 type masks the wrong writer. | MODERATE |
| Beta checkpoints | They also claim schema v1 but contain unreleased widgets. | Broad repair weakens current integrity. | HIGH; explicitly out of scope |

### Human decisions required

| Decision | Options | Recommendation | Status |
|---|---|---|---|
| Public schema version | Keep evolving v1 / bump to v2 | Bump to v2 with explicit v1 migration. | Approved by Okey |
| Beta checkpoint handling | Auto-repair all / best-effort current normalization / manual repair | Keep current narrowly recognized normalization; manually repair remaining local beta files later. | Approved by Okey |

### Gate

**State:** `APPROVED`
**Blockers:** None. Public migration, failure behavior, tests, and beta negative scope are explicit.

## 1. Architecture Delta Map — 2 minutes

### 1.1 Affected tree before

```text
WorkshopSessionService
  -> writes removed marker and repoints config commit
WorkshopSessionStateV1Integrity
  -> requires every directive-linked config to have an active directive
WorkshopPersistedSession
  -> accepts v1 only; writes v1 only
WorkshopSessionPersistenceCoordinator
  -> captures WorkshopPersistedSessionV1
WorkshopSessionStore
  -> atomically reads/writes WorkshopPersistedSessionV1
```

### 1.2 Target tree

Legend: `[+]` add · `[~]` modify · `[=]` unchanged boundary

```text
[=] WorkshopSessionService
    -> keeps the existing truthful removed marker
[~] WorkshopSessionStateV1Integrity
    -> recognizes active standing linkage OR coherent terminal removal linkage
[+] WorkshopPersistedSessionV1ToV2Migration
    -> adjacent, deterministic outer-envelope migration
[~] WorkshopPersistedSession
    -> version dispatcher; current strict parser/writer is v2
[~] WorkshopSessionPersistenceCoordinator
    -> captures WorkshopPersistedSessionV2
[~] WorkshopSessionStore
    -> atomically reads current v2 after migration; writes v2 only
[=] WorkshopSessionCheckpointNormalization
    -> remains the narrow beta/current-checkpoint repair owner
```

### 1.3 Responsibility ledger

| Module / file | Primary responsibility before | Responsibility after | Ownership delta | Pattern / smell | Evidence |
|---|---|---|---|---|---|
| `WorkshopSessionService.ts` | Whole-session mutation boundary. | Unchanged; its removed marker remains the historical truth. | None. | Aggregate facade. | `834-885` |
| `WorkshopSessionStateV1Integrity.ts` | Cross-record persisted invariants. | Admit an exact terminal-removal arm beside the active-directive arm. | One invariant branch. | Discriminated lifecycle validation. | `522-546` |
| `WorkshopPersistedSessionV1ToV2Migration.ts` | Absent. | Own only the v1 envelope-to-v2 adjacent transform and public defaults. | New formal migration owner. | Adjacent schema migration. | ADR `43-60` |
| `WorkshopPersistedSession.ts` | Single-version envelope parser. | Dispatch versions and strictly validate/write current v2. | Version routing enters. | Codec dispatcher. | `126-188` |
| Store/coordinator | Persist the nominal v1 current type. | Persist the nominal v2 current type. | Type/name correction only. | Repository + application coordinator. | Store `854-899`; coordinator `571-590` |

### 1.4 Structural view

**Question answered:** Who owns public migration versus beta normalization?
**Scope:** Stored JSON through live aggregate.
**Abstraction:** Component/file.
**Legend:** arrows label data flow; brackets name responsibility.

```text
stored JSON
   -> [WorkshopPersistedSession: inspect schema]
      -> v1 -> [V1ToV2Migration: public adjacent transform]
      -> v2 ------------------------------+
                                             |
                                             v
      [CheckpointNormalization: narrow recognized beta drift]
         -> [Current shape + integrity]
            -> [WorkshopSessionService hydration]
               -> [Store: atomic v2 writes only]
```

### 1.5 Representative runtime flows

**Public upgrade:** v2.1.1 pre-widget JSON → v1 parser/migration → empty current widget collections and counters → current normalization/integrity → hydrate → next atomic write is schema v2.

**Standing removal:** active directive → remove mutation writes one `removed` marker and retains its config history → integrity recognizes that terminal marker without requiring an active directive → save/reload succeeds.

### 1.6 Blast-radius summary

| Dimension | Direct | Main failure | Witness | Risk |
|---|---|---|---|---|
| Structure | Codec, integrity, store/coordinator types. | Duplicate migration ownership. | Architecture boundary test plus imports. | MODERATE |
| Runtime | Remove/save/reopen; v1 open. | Session cannot reopen. | Round-trip service and decoder tests. | HIGH |
| Contract | `schemaVersion` 1→2. | Wrong version emitted or unsupported version admitted. | Exact decoder/writer tests. | HIGH |
| Data/state | Widget collections and terminal linkage. | Silent data loss or broad repair. | Deep equality and exact linkage assertions. | HIGH |
| Operations | Protected current and atomic rename remain unchanged. | Partial overwrite. | Existing store tests. | MODERATE |
| Coordination | Release branch only; beta files untouched. | Local beta data mistaken for public v1. | Real-file read-only audit and explicit negative scope. | MODERATE |

## 2. Reviewer Packet — 10 minutes

### 2.1 Working definition and real job

The persisted-session codec owns the public JSON compatibility clock and the
transition from untrusted stored data to a current validated aggregate. It does
not own feature-specific beta repair, provider conversation recovery, or file
mutation policy. Standing-directive integrity owns relationships among configs,
turn markers, and the active directive ledger; the mutation service owns the
truthful lifecycle events.

### 2.2 Declared intent, observed behavior, and open meaning

| Topic | [Declared] | [Observed] | [Inferred] | [Unknown] |
|---|---|---|---|---|
| Public migration | Changed persistence requires adjacent migration and authentic prior fixture. | Current reader/writer still hard-code v1. | v2.2 is the first schema bump. | None decision-reversing. |
| Beta repair | Development drift normalizes narrowly, feature-owned where semantic. | 7/12 beta widget files decode; five fail closed. | Leave those five for explicit later repair. | Exact future repair for two linkage files. |
| Removed directive | Removal appends a coherent marker and removes active ledger entry. | Integrity requires the now-absent active entry. | Validator is narrower than aggregate truth. | None. |

### 2.3 Contracts and invariants

| Contract / invariant | Target owner | Change? | Failure if broken | Witness |
|---|---|---|---|---|
| Current writes always carry schema v2. | Persisted-session codec/store types. | Yes. | Ambiguous future compatibility. | Store serialization test. |
| Public v1 pre-widget state becomes current empty widget state. | V1ToV2 migration. | Yes. | v2.1.1 users lose sessions. | Frozen v1 fixture. |
| Unsupported versions fail closed. | Codec dispatcher. | Preserved. | Unknown data interpreted incorrectly. | version 0/3 tests. |
| Removed standing configs point to one matching removal marker and no active directive. | Integrity validator. | Expanded exact union. | Corruption accepted or legitimate history rejected. | install→remove→parse round trip plus negative mutations. |
| Conversation-entry corruption degrades locally. | Existing import path. | Preserved. | Whole session lost for one participant archive. | Existing persistence tests. |
| Beta files are not rewritten during this work. | Task scope. | Preserved. | Irreversible local-data churn. | `git status`; read-only audit. |

### 2.4 Negative space

| Generic owner | May know | Must not know | Next-feature edit surface | Verdict |
|---|---|---|---|---|
| V1ToV2 migration | Released v1 envelope and current v2 structural defaults. | Gesture, Lexical Gravity, or Creative semantic repair. | Only a future top-level schema migration. | Honest. |
| Checkpoint normalizer | Named pre-release omissions and closed widget recovery dispatch. | Public version sequencing. | Closed normalization union/feature codec. | Honest. |
| Integrity validator | Cross-record linkage grammar. | UI presentation or provider runtime IDs. | New persisted linkage arm only. | Honest. |

### 2.5 Quality scenarios

| Type | Source | Stimulus | Environment | Artifact | Expected response | Response measure |
|---|---|---|---|---|---|---|
| Change | v2.1.1 user | Opens pre-widget session in v2.2. | Normal workspace. | v1 JSON. | Hydrates with no widgets; later writes v2. | Exact fixture decode and captured schema assertion. |
| Runtime | v2.2 user | Installs then removes a standing directive and restarts. | No active run. | v2 JSON. | Full history remains, active rail is empty, reload succeeds. | Round-trip test. |
| Failure | User | Opens unsupported schema. | Any. | version 0/3 JSON. | Fail closed; current autosave protected. | Decoder error + existing coordinator protection test. |
| Recovery | Beta user | Opens one of five malformed widget checkpoints. | Local beta data. | schema-1 widget JSON. | Remains rejected without mutation until manually repaired. | Read-only decoder audit. |

**Sensitivity points:** terminal-linkage predicate; schema dispatch order; writer type.
**Tradeoff points:** best-effort beta acceptance improves convenience but must not weaken public/current integrity.
**Risk themes:** ambiguous v1 meaning and cross-record linkage.

### 2.6 Alternatives and tradeoffs

| Alternative | Benefits | Costs / risks | Verdict |
|---|---|---|---|
| Minimal: only relax standing validator; keep schema 1. | Small diff. | Violates accepted release gate; compatibility clock lies. | Reject. |
| Recommended: exact terminal arm + adjacent outer migration + v2 writes. | Honest versioning, narrow ownership, public fixture. | Mechanical type churn across store tests. | Adopt. |
| Generalized migration framework/plugin registry. | Ready for many future versions. | Only one adjacent transition exists; abstraction would do theater. | Defer until V2→V3. |

### 2.7 Principle and quality tensions

| Principle / quality | Status | Support | Tension / consequence | Witness | Confidence |
|---|---|---|---|---|---|
| Responsibility/cohesion | STRONG | Migration, normalization, integrity, and storage stay separate. | More named files/types. | Boundary/import review. | STRONG |
| Naming truthfulness | STRONG | Current outer type becomes V2. | Internal aggregate retains historical `StateV1` name because top-level clock is public owner. | Typecheck and ADR wording. | MODERATE |
| Reliability | STRONG | Fail-closed validation and atomic writes remain. | Successful later autosave has no automatic backup. | Existing store/protection tests; manual backup guidance. | STRONG |
| Change isolation | ACCEPTABLE | Feature semantics stay outside public migration. | Store/coordinator type rename touches several tests. | Full suite. | STRONG |

### 2.8 Ranked findings

| ID | Severity | Finding | Evidence | Smallest fix | Blocks |
|---|---|---|---|---|---|
| F1 | HIGH | Current removal output is rejected by current standing-config integrity. | Service `834-885`; integrity `525-544`; real beta file. | Validate an exact coherent removal terminal arm. | release |
| F2 | HIGH | v2.2 persisted state still writes public schema v1. | `WorkshopPersistedSession.ts:59-60,188`; ADR `43-60`. | Adjacent migration and v2-only writer. | release |
| F3 | MEDIUM | No frozen released-v1 pre-widget fixture witnesses the release gate. | Test search and ADR `57-58`. | Add fixture-based decode test. | release |
| F4 | LOW | Five beta files need separate repair. | Read-only audit: 32/37 pass. | Manual/narrow follow-up only. | nothing public |

**What survived.** The current decoder already accepts all 25 audited
pre-widget sessions; all 37 search summaries parse; failed current restoration
protects rolling autosave; storage writes remain temporary-file plus atomic
rename. Those boundaries do not need redesign.

### 2.9 Implementation slices

| Slice | Purpose | Files / owners | Verification | Depends on | Rollback seam |
|---|---|---|---|---|---|
| 0 | Characterize removed terminal state and v1 fixture. | Existing service/codec tests. | Tests fail before fixes. | None. | Test-only. |
| 1 | Make removal round-trip valid without weakening active linkage. | Integrity validator and standing tests. | Positive round trip + mismatched negative cases. | Slice 0. | Revert one predicate branch. |
| 2 | Introduce v2 contract and adjacent migration. | New migration, persisted codec, store/coordinator/search types, barrel. | Fixture, versions, strict current writes. | Slice 0. | Decoder still fails closed; atomic store unchanged. |
| 3 | Verify public and beta boundaries. | Full tests/build; read-only 37-file audit. | 25/25 public-style pass; same explicitly deferred beta failures only. | Slices 1–2. | No session files written. |

### 2.10 Unknowns that can reverse the decision

None. The user explicitly chose formal v2 migration and manual beta repair;
the code and ADR settle ownership and failure behavior.

## 3. Self-review and Re-plan Verdict

### 3.1 Contradictions found

| Artifact pair | Contradiction | Resolution |
|---|---|---|
| ADR ↔ current codec | ADR requires versioned release migration; codec still evolves v1. | Add adjacent outer migration now. |
| Removal flow ↔ integrity | Aggregate records removal as terminal history; validator demands active state. | Add exact removed-terminal arm, not a broad optional directive rule. |
| Public migration ↔ beta convenience | Both currently claim schema v1. | Keep public migration structural and beta normalization separate; no broad repairs. |

### 3.2 Prospective failure review

| Failure story | Cause | Prevention / witness |
|---|---|---|
| Corrupt config passes as retired. | Predicate checks only absent directive. | Require matching committed removal turn, IDs, widget, and revision. |
| New files still say v1. | One capture/store type remains stale. | Type rename plus store serialization assertion. |
| Public v1 loses turns/conversations. | Migration rebuilds rather than clones. | Defensive clone and deep equality except named v2 defaults/version. |
| Beta repair contaminates public migration. | Feature fields handled in adjacent migrator. | Negative-space review and separate normalization call. |

### 3.3 Reproduction test

**Plausible next variant:** a future v2→v3 session contract.
**Files it adds:** one adjacent `V2ToV3Migration`.
**Shared files it edits:** version dispatcher/current version constant and tests.
**Existing feature files it edits:** none unless that feature's persisted shape actually changes.
**Verdict:** The adjacent migration seam scales without inventing a generalized registry today.

### 3.4 Re-plan Verdict

**Verdict:** `REFINED`

**Initial plan:**

1. Relax standing linkage after removal.
2. Bump schema to v2 and migrate v1.

**Final plan:**

1. Recognize an exact terminal-removal linkage arm while preserving active linkage strictness.
2. Add a named adjacent outer-envelope migration, v2-only writes, and a frozen released-v1 fixture; keep beta normalization downstream and separate.

**What changed and why:** “Relax linkage” became an exact discriminated terminal
state after inspecting the removal marker. The schema bump gained a named
migration owner and fixture after reconciling the ADR release gate.
**Evidence:** Service/integrity contradiction and ADR `43-60`.
**Remaining uncertainty:** None decision-reversing; beta repair is explicitly deferred.

### 3.5 Implementation gate

| Gate condition | Pass / fail | Evidence |
|---|---|---|
| No unaccepted critical unknowns | PASS | None remain. |
| Contract consumers/migration/tests identified | PASS | Codec, store/coordinator/search types, fixture. |
| Persistence failure and rescue defined | PASS | Existing protected current plus atomic rename remain. |
| Runtime flows owned and testable | PASS | Public upgrade and remove/reload scenarios. |
| Negative-space and reproduction tests pass | PASS | Public migration has no feature semantics; future adjacent migration is named. |
| Tree/responsibilities/contracts/slices agree | PASS | Bands 1–3 reconciled. |
| Human decisions and coordination assigned | PASS | Okey approved schema v2 and deferred beta repair. |

**Final gate:** `OPEN`

## 4. Evidence Appendix — details on demand

### 4.1 Key file cards

#### `WorkshopSessionStateV1Integrity.ts` — `[~]`

- **Role:** Cross-record persisted-state validator.
- **Delta:** Add a terminal removal arm; retain strict active and one-shot arms.
- **Consumers:** Decoder, hydration, current-write parser.
- **Verification:** Install/remove/export/decode; mismatched removal IDs/revisions rejected.

#### `WorkshopPersistedSessionV1ToV2Migration.ts` — `[+]`

- **Role:** Adjacent public schema migration.
- **Delta:** Clone released v1 envelope, set schema 2, initialize absent first-widget collections/counters.
- **Must not know:** Widget draft internals or beta repair details.
- **Verification:** Frozen released-v1 fixture; no input mutation; exact current output.

#### `WorkshopPersistedSession.ts` — `[~]`

- **Role:** Public envelope codec and version dispatcher.
- **Delta:** Accept v1/v2, return v2, strictly parse writes as v2.
- **Failure:** Unsupported versions remain rejected.
- **Verification:** version matrix and defensive-clone tests.

#### `WorkshopSessionStore.ts` / coordinator — `[~]`

- **Role:** Atomic repository and application persistence orchestration.
- **Delta:** Current type becomes V2; runtime write mechanics unchanged.
- **Verification:** Existing store/coordinator suites plus schema assertion.

### 4.2 Fitness witnesses

| Rule | Automated witness | Failure signal |
|---|---|---|
| Remove/reload is coherent. | Standing directive round-trip test. | Invalid config linkage. |
| v1 public data migrates. | Released-v1 fixture decode. | Unsupported/missing widget defaults. |
| Writes are v2 only. | Store/capture assertions. | `schemaVersion` equals 1. |
| Unknown versions fail. | Decoder version table. | Unknown version accepted. |
| Beta data is not mutated. | Read-only audit + git status. | External file mtime/diff changes. |

### 4.3 ADR implementation note

The accepted 2026-07-30 ADR already contains the decision. Implementation
should update it only with the concrete v2 migration owner, current version,
fixture witness, and the explicit separation from beta checkpoint repair.

## 5. Reader Terms Appendix — fast reference

### 5.1 Technical terms

| Term | Local meaning | Status / evidence |
|---|---|---|
| Adjacent migration | One deterministic transform from public schema N to N+1; not a generic plugin system. | Proposed; ADR `43-47`. |
| Checkpoint normalization | Narrow repair for known pre-release/beta shape drift after version dispatch. | Current; normalization file `1-40`. |
| Compatibility clock | The outer `schemaVersion` that selects released migrations. | Current but stale at v1; ADR `39-47`. |
| Terminal linkage | A config whose final commit points to a coherent removal marker instead of an active directive. | Proposed exact integrity arm. |

### 5.2 Domain terms

| Term | Local meaning | Status / evidence |
|---|---|---|
| Standing directive | A persisted prose-control frame active across later Workshop turns until shifted or removed. | Current. |
| Widget config | Durable authoring record identified by `wc-N`, linked to a thread artifact or standing lifecycle. | Current. |
| Public v1 | The pre-widget Marketplace session shape shipped through v2.1.1. | Current historical contract. |
| Beta checkpoint | Local epic-build session that also says schema v1 but may contain unreleased widget fields. | Divergent: same number, non-public shape; manually repaired later. |
