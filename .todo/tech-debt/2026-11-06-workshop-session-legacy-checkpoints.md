# Workshop sessions saved by development builds fail to open

- **Status:** Bug 1 fixed on `fix/workshop-session-legacy-checkpoints`; Bug 2 investigated, repair waiting on the session's linkage fields.
- **Priority:** High. These are sessions Okey is still working in.
- **Rule:** [ADR 2026-07-30](../../docs/adr/2026-07-30-workshop-session-codec-evolution.md).

## Problem

The session store skips four of Okey's saved sessions when it lists them, and
Open fails on them. His log, names shortened:

```
Skipped 20260814-…-jul-23-copy.json: Workshop session state.widgetConfigs[2].draft.selections[0] contains unknown field acceptedAdvisoryRiskIds.
Skipped 20260808-…-aug-8.json:       Workshop session state.widgetConfigs[0].draft.selections[0] contains unknown field acceptedAdvisoryRiskIds.
Skipped 20260724-…-jul-23.json:      Workshop session state.widgetConfigs[2].draft.selections[0] contains unknown field acceptedAdvisoryRiskIds.
Skipped 20260730-031813-…-gesture-explorer.json: Persisted Workshop thread widget turn-204-user-1785381309973 has invalid config linkage
```

## Bug 1: `acceptedAdvisoryRiskIds` on a Creative Variations selection

### Cause

- From `d14ab795` (2026-08-10) a Creative Variations draft selection saved
  `acceptedAdvisoryRiskIds`. It held the advisory risks the writer accepted
  for that card, under an exact-set commit-eligibility rule.
- `e28b3fbc` (2026-08-15, "complete Creative Variations sprint") made advisory
  flags passive warnings, removed the rule, and removed the field. The strict
  selection shape (`exactObject(['position', 'carryMode'])`) then refused any
  file that still held it.
- **No release wrote it.** `git grep acceptedAdvisoryRiskIds <tag> -- packages src`
  finds nothing in any tag. v2.1.1 (2026-08-03) predates the field; v2.2.0
  (2026-08-24) follows its removal.

### Repair and decision

It is a development-checkpoint shape, so under ADR 2026-07-30 it gets a named
normalization, not a `schemaVersion` migration.

- **Where.** `CreativeVariationsCheckpointNormalization.ts`, beside the codec,
  as Show vs. Tell's checkpoint repairs are. The checkpoint shape assertion and
  the hydration normalization moved there from `CreativeVariationsConfigCodec.ts`
  (494 lines before; it shrinks). The lifecycle registry imports both from the
  new module.
- **The parser.** The session parser already calls each widget's checkpoint
  shape, not its current shape (`WorkshopSessionStateV1Shape.ts`), and leaves
  repair to normalization, as the existing legacy repairs do. Creative
  Variations' checkpoint shape now accepts exactly one legacy key:
  `acceptedAdvisoryRiskIds` on a draft selection, as an array of strings. It
  removes the key and then runs the strict current shape, so every other
  unknown key, on the selection or anywhere else, is still refused.
- **Normalization.** It drops the key under
  `dropped-creative-variations-advisory-acceptance`. The coordinator logs it by
  name only: `Development checkpoint normalized (normalizations=…)`.
- **Writes** never emit it: `cloneCreativeVariationsDraft` copies only
  `position` and `carryMode`, and writes use the current shape.
- **Outside sessions** the Creative Variations codec's current shape is
  unchanged and still refuses the key. Only the session checkpoint boundary
  accepts it.
- **Nothing is lost.** The ids named advisory flags the writer had accepted.
  Since `e28b3fbc` those flags are passive and nothing reads an acceptance.

### Tests

`__tests__/application/services/workshop/WorkshopSessionLegacyCheckpoints.test.ts`:

- an *Alice* session file with the field on a selection, read through the real
  store and the persistence coordinator. It lists with nothing skipped, opens,
  logs the normalization by name with no text, ids or paths, saves in place
  without the field, and reopens with nothing left to normalize;
- control: another unknown key on the same selection is still skipped, with the
  usual reason;
- the codec boundary: the current shape refuses the key, the checkpoint shape
  accepts it; a wrong type, or the key outside a selection, is refused; the
  input is not mutated.

## Bug 2: "invalid config linkage" on a Gesture Playground session

### What history shows

- **The check.** `WorkshopSessionStateV1Integrity.ts` (thread-artifact
  `widgetCommit` → config) requires `committedTurnId === turn.id`,
  `artifactId === widgetCommit.artifactId` and no `directiveId`. All three
  clauses arrived together in `d14ab795` (2026-08-10) and have not changed
  since. Before it, a config with no link passed (`775cec7e`, 07-30: only "a
  link that is present names a real turn").
- **The 07-29/07-30 dev writer** (`7c11ac02`..`775cec7e`). The user turn
  carries `widgetCommit`. The config is created and autosaved before the send.
  `recordWidgetCommit` sets `committedTurnId` and `artifactId` only after the
  send commits; a failed or cancelled send keeps the user turn and never links
  the config.
- **Releases.** v2.0.3, v2.1.0 and v2.1.1 have no `widgetCommit` code. v2.2.0,
  the first release with widgets, already has today's check, and its writer
  links the config at room acceptance. So no release wrote this shape, and a
  repair is a development-checkpoint normalization, not a migration.

### Leading hypothesis (unconfirmed)

The config has neither `committedTurnId` nor `artifactId`: a send that failed
or was cancelled on the 07-30 build. A deterministic repair would copy both
from the turn's own `widgetCommit`, and only when:

- the config holds no link fields;
- exactly one turn names the config;
- the widget ids match;
- the artifact id is unique and within its counter.

That repair invents nothing. It is **not built**. It waits for the session's
linkage fields (the turn's `widgetCommit`; each config's `id`, `widgetId`,
`committedTurnId`, `artifactId`, `directiveId`) to confirm which clause fails.

If the data shows a link that cannot be derived, the fallback proposal is to
open the session with that one widget's linkage dropped and the turn kept. It
needs a go-ahead before it is built.

## Verification

Bug 1, Node 22, against a baseline taken on `origin/main` at `4cf03982`:

| Check | Baseline | With the fix |
|---|---|---|
| `npm run typecheck` | clean | clean |
| `npm run lint` | 0 errors, 1165 warnings | 0 errors, 1165 warnings (none new) |
| `npx jest` | 729 suites / 10,249 tests / 59 snapshots | 730 suites / 10,258 tests / 59 snapshots, all passing |

The 9 new tests are the regression file above. `CreativeVariationsConfigCodec.ts`
went from 494 to 466 lines; the new module is 110.
