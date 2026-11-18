# Opening a Room Rebuilds the Project Catalog Once per Context File

**Date:** 2026-11-18
**Status:** Open
**Priority:** Medium-High. Okey notices the slow opens. The cost grows with attachments × project files, so the rooms that work hardest are the slowest to open.
**Found by:** Okey, from the output log of opening a 348-turn room

## What the log shows

Opening a named session (`turns=348`): between the context scan's start and
end (`workshop_session_context_scan`), the resolver logs the same line 28
times:

```
[ContextResourceResolver] Indexed 346 context resource(s) across 8 group(s).
```

That's the whole project catalog, all 8 groups, built 28 times, apparently
once per file-backed context attachment. Each build gives the same answer.

## Why

Open re-checks every file-backed context attachment for changes, and each
check rebuilds the catalog from scratch:

1. `WorkshopSessionMessageHandler` opens the session, then `scanContextFiles`.
2. `WorkshopContextHandler.refreshChangedContextFiles` loops over the
   attachments. For each one, it calls
   `WorkshopContextIntakeService.authorizeExcerptReread(source)`.
3. That calls `resolveConfiguredSource`, which calls **`openCatalog()`**.
4. `openCatalog` calls `ContextResourceResolver.createProvider(all 8 groups)`,
   and `collectResources` then:
   - runs `findFiles` for **every pattern**, in every group and workspace
     folder (the defaults hold 35 patterns);
   - `stat`s **every match** for its size (346 here).

So one Open runs about 28 × 35 ≈ 980 file searches and 28 × 346 ≈ 9,700
`stat`s, to answer 28 lookups that one catalog could answer.

### The same shape elsewhere

The pinned-context reader opens one catalog for a whole read
(`WorkshopPinnedContextFileReader.readAll`). But a pinned file read from
the workspace rather than a catalog row is authorized through
`authorizeExcerptReread`, which opens a fresh catalog for that file. So a
New room, a full reset or Attach missing pays the same per-file cost, on
those files.

## Fix

1. **One catalog per operation.** A scan opens the catalog once and passes
   it to each authorization, e.g. `authorizeExcerptReread(source, { catalog })`
   or a scan-scoped intake.
   - **Nothing about authorization weakens.** The checks that guard each
     read still run per file: containment and no symbolic link
     (`validateWorkspaceRereadPath`), then `loadFile`'s bounds.
   - **The snapshot lives only for that operation,** then is dropped. There
     is no cache to invalidate, and the next operation opens a fresh one.
   - **A file added to the project mid-scan** simply isn't seen until the
     next operation, which is no change from what a scan means today.
2. **The pinned reader passes its catalog** to its per-file authorizations
   the same way.
3. **Maybe: skip sizes when only paths are needed.** Authorization needs the
   catalog's paths, not its sizes. A paths-only listing would skip the 346
   `stat`s. Measure step 1 first.
4. **Maybe: read the changed-file checks a few at a time** rather than one
   after another. Leaning no until 1 is measured: it adds ordering questions
   to a room operation for little gain.

**Not a long-lived cache.** A project catalog kept across operations would
need file-watching to stay true, and would put a stale-catalog bug class
under every authorization. One catalog per operation gets the gain without
that.

## Completion Criteria

- [ ] Opening a room with N file-backed attachments builds the catalog
      once, not N times. A test counts `createProvider` (or `findFiles`)
      calls through a fake workspace.
- [ ] The same holds for a pinned-context seed and Attach missing.
- [ ] Every authorization outcome is unchanged. The existing reread and
      pinned-context tests pass as they are, refusals included.
- [ ] The scan logs one line with its counts and duration (attachments
      checked, changed, refused; milliseconds), never a path or a name.
- [ ] A before-and-after timing on a large project (Okey's: 346 files, 28
      attachments) is recorded in the PR.

## Related Files

- `packages/core/src/application/handlers/domain/workshop/WorkshopSessionMessageHandler.ts`
  (`scanContextFiles`)
- `packages/core/src/application/handlers/domain/workshop/WorkshopContextHandler.ts`
  (`refreshChangedContextFiles`)
- `packages/core/src/application/services/workshop/WorkshopContextIntakeService.ts`
  (`authorizeExcerptReread`, `resolveConfiguredSource`, `openCatalog`)
- `packages/core/src/infrastructure/context/ContextResourceResolver.ts`
  (`createProvider`, `collectResources`, `forEachMatch`)
- `packages/core/src/application/services/workshop/pinnedContext/WorkshopPinnedContextFileReader.ts`
  (`readAll`, `readWorkspaceFile`)
