# Sprint 06A: Agent-Run Engine and Resource Catalogs

**Status**: Implementation complete — automated verification complete; manual F5 route confirmation pending
**Priority**: High
**Branch**: `sprint/workshop-editor-tab-06a-agent-run-engine` → PR into `epic/workshop-editor-tab`
**Estimated Effort**: 5–8 days
**Depends on**: Sprint 05 persona host and browser
**ADR**: [2026-07-10 — Agent-Run Engine and Resource Catalog Policies](../../../../docs/adr/2026-07-10-agent-run-engine-and-resource-catalogs.md)

## Goal

Replace the orchestrator's overlapping execution loops with one reviewable
agent-run engine and explicit resource-catalog policies, without changing user
visible behavior across the sidebar or Workshop.

## Locked Decisions

- `AIResourceManager` is the only initialization/rebuild owner and exposes
  generation identity.
- A caller explicitly chooses `guides`, `projectContext`, or `none`; do not
  advertise every project file to every agent.
- Configured project-context groups remain Settings-owned. The shared engine
  validates requests, reads allow-listed resources, records provenance, and
  delivers evidence.
- Existing public orchestrator methods are branch-local migration adapters only.
  Every caller migrates and duplicated legacy methods are deleted before merge.
- Raw directives and full file content do not stream into visible chat by
  default. Compact attributed artifacts make loaded evidence inspectable.
- No persona file-read or dictionary capability behavior lands in this sprint;
  06A builds the seam Sprint 07 consumes.

## Tasks

### Lifecycle and route inventory

- [x] Characterize each existing caller and publish a route matrix: caller,
      policy, resource catalog, retention, visible artifact, cleanup owner.
- [x] Move all bundle initialization/rebuild ownership into `AIResourceManager`;
      expose/test generation identity and config-change behavior.
- [x] Prove an unrelated service initialization cannot strand a retained
      Workshop or sidebar conversation.

#### Caller-to-policy route matrix (implemented)

| Caller | Policy | Catalog | Retention | Visible artifact | Cleanup owner |
| --- | --- | --- | --- | --- | --- |
| Sidebar dialogue, prose, and writing tools | `assistant` (`assistantWithoutResources` when guides are disabled) | `guides` or explicit `none` | Discard | Final analysis; guide loads stay in status/evidence | Engine |
| Workshop tool run | `workshopTool` (`workshopToolWithoutResources` when guides are disabled) | `guides` or explicit `none` | Retain | Final tool report; guide loads stay in status/evidence | Workshop session |
| Workshop persona-host start | `workshopHost` | `none` | Retain | Final host turn | Workshop session |
| Dictionary lookup and parallel blocks | `dictionary` | `none` | Discard | Final dictionary result | Engine |
| Category-search batches | `categorySearch` | `none` | Discard | Final matching result | Engine |
| Context assistant | `context` | `projectContext` | Discard | Final context brief; configured-file loads stay in status/evidence | Engine |

The executable source of truth is
`infrastructure/api/orchestration/AgentRunPolicies.ts`; its matrix regression
test prevents a caller from silently inheriting another route's catalog.

### Engine and catalog extraction

- [x] Define typed `RunPolicy`, `AgentCapability`, and resource-catalog policy
      contracts in core without VS Code imports.
- [x] Extract one initial-run engine for request assembly, streaming,
      cancellation, retention, token accounting, cleanup, and bounded rounds.
- [x] Implement Guide and Context-file capability adapters with explicit parse,
      fulfill, delivery, and limit policy differences.
- [x] Buffer candidate directives until validation and keep raw protocol/file
      contents out of visible streamed output.

### Migration and deletion

- [x] Migrate Assistant, Dictionary, Category Search, Context, and Workshop
      callers onto the engine and declare their catalog policies explicitly.
- [x] Preserve direct retained continuation as an explicit history operation.
- [x] Delete temporary adapters, duplicate loops, and obsolete tests before the
      branch merges into `epic/workshop-editor-tab`.

### Verification

- [x] Add a caller-to-policy regression matrix plus focused capability,
      lifecycle, streaming, cancellation, retention, and visibility tests.
- [x] Run full tests, typecheck, lint, build, resource staging, and bundle
      verification.
- [ ] Manually confirm the F5 routes: sidebar analysis/context/dictionary/category
      and Workshop host/tool continuation paths.

#### Verification notes (2026-07-10)

- Focused engine/capability/service/Workshop matrix: 9 suites / 38 tests passed.
- Full Jest: 71 suites / 521 tests passed.
- `npm run typecheck`: core, webview, and VS Code adapter passed.
- `npm run lint`: 0 errors; 606 repository warnings remain (none introduced by
  the implementation after correcting the new test warning).
- `npm run build`: resource staging and `verify:bundle` passed. Produced
  `extension.js` at 2.16 MiB and `webview.js` at 566 KiB (the latter retains
  the existing webpack size warning).
- `git diff --check`: passed.
- VS Code was launched with the Extension Development Host arguments, but this
  environment has no GUI inspection or input channel for the required manual
  sidebar and Workshop click-through. Treat the F5 route checklist above as a
  manual confirmation, not an implementation failure.

## Acceptance Criteria

- A reviewer can identify every agent route from one route matrix and one
  policy declaration.
- Context agents retain their configured project-resource scope; analysis agents
  retain their craft-guide scope; no caller sees an accidental union.
- One lifecycle owner rebuilds resources, and retained conversations survive
  unrelated service activity.
- No temporary public façade or duplicated orchestration loop remains at merge.
- Visible chat never leaks raw directives or full loaded files by default.
