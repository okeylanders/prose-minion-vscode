# Sprint 06B: Agent-Run Engine and Resource Catalogs

**Status**: Planned
**Priority**: High
**Branch**: `sprint/workshop-editor-tab-06b-agent-run-engine` → PR into `epic/workshop-editor-tab`
**Estimated Effort**: 5–8 days
**Depends on**: Sprint 06 tool side-pass
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
  06B builds the seam Sprint 07 consumes.

## Tasks

### Lifecycle and route inventory

- [ ] Characterize each existing caller and publish a route matrix: caller,
      policy, resource catalog, retention, visible artifact, cleanup owner.
- [ ] Move all bundle initialization/rebuild ownership into `AIResourceManager`;
      expose/test generation identity and config-change behavior.
- [ ] Prove an unrelated service initialization cannot strand a retained
      Workshop or sidebar conversation.

### Engine and catalog extraction

- [ ] Define typed `RunPolicy`, `AgentCapability`, and resource-catalog policy
      contracts in core without VS Code imports.
- [ ] Extract one initial-run engine for request assembly, streaming,
      cancellation, retention, token accounting, cleanup, and bounded rounds.
- [ ] Implement Guide and Context-file capability adapters with explicit parse,
      fulfill, delivery, and limit policy differences.
- [ ] Buffer candidate directives until validation and keep raw protocol/file
      contents out of visible streamed output.

### Migration and deletion

- [ ] Migrate Assistant, Dictionary, Category Search, Context, and Workshop
      callers onto the engine and declare their catalog policies explicitly.
- [ ] Preserve direct retained continuation as an explicit history operation.
- [ ] Delete temporary adapters, duplicate loops, and obsolete tests before the
      branch merges into `epic/workshop-editor-tab`.

### Verification

- [ ] Add a caller-to-policy regression matrix plus focused capability,
      lifecycle, streaming, cancellation, retention, and visibility tests.
- [ ] Run full tests, typecheck, lint, build, bundle verification, and F5 smoke
      for sidebar analysis/context/dictionary/category and Workshop host/tool
      continuation paths.

## Acceptance Criteria

- A reviewer can identify every agent route from one route matrix and one
  policy declaration.
- Context agents retain their configured project-resource scope; analysis agents
  retain their craft-guide scope; no caller sees an accidental union.
- One lifecycle owner rebuilds resources, and retained conversations survive
  unrelated service activity.
- No temporary public façade or duplicated orchestration loop remains at merge.
- Visible chat never leaks raw directives or full loaded files by default.
