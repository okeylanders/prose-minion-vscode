# Gate 00: Decisions and Fitness Baseline

**Status:** Planned

**Proposed branch:** `gate/workshop-multimodal-composer-00-decisions`

**Depends on:** Epic and architecture-runway review

**Blocks:** Sprints 01-04 and the release qualification gate

## Gate objective

Close the product decisions that alter contracts or storage, promote the ADR
seed, and install characterization/architecture witnesses before changing the
current text-only behavior.

## Deliverables

1. Accept or revise every product decision in the ADR seed: paste threshold,
   attachment-only turns, item/byte limits, formats, capability-unknown policy,
   previews, and damaged-asset behavior.
2. Accept or revise the durable ownership contract: the asset repository is the
   only binary-byte owner; room artifacts and participant history may repeat an
   immutable reference; `WorkshopThreadArtifact.kind` remains widget-only; and
   widgets share the committed artifact rail without joining composer staging.
3. Promote the accepted ADR into `docs/adr/` and link it from the epic.
4. Characterize current short-paste, typed-send, staged-file, quick-action,
   cancellation, retry, room catch-up, direct-tool privacy, restore, duplicate,
   and delete behavior.
5. Add red/green architecture witnesses for the future rules:
   - no raw bytes/base64/data URLs in IPC or persisted session types;
   - only the provider adapter may emit OpenRouter multimodal wire parts;
   - core remains `vscode`-free;
   - media dispatch requires a host-side capability verdict;
   - asset paths are constructed only by the asset repository.
6. Record tiny synthetic fixtures for each accepted media format. Do not add
   copyrighted or personal media.

## Exit criteria

- [ ] ADR status is Accepted and the epic has no architecture-reversing unknown.
- [ ] Byte/reference ownership and widget-versus-composer lifecycle boundaries
      are explicit and accepted.
- [ ] Current attachment semantics are protected before the type migration.
- [ ] Each fitness witness fails against a deliberate violating fixture.
- [ ] Limits and MIME/format mappings have one named owner.
- [ ] No provider request or Marketplace action occurs in this gate.
- [ ] Focused tests, typecheck, lint, and `git diff --check` pass.

## Rollback seam

Documentation and characterization tests only. Revert this gate without data
or runtime migration.
