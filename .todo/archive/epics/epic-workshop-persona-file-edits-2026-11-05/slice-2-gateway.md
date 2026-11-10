# Slice 2: Staging and the gateway

**Status:** Built, in review. Reworked to the revised ADR after the PR #226
review (F-02, F-03, F-05, F-06).
**Branch:** `epic/workshop-persona-file-edits-slice-2-gateway`, from Slice 1's
head, with the revised spec merged in.
**Decision:** [ADR 2026-11-05](../../../../docs/adr/2026-11-05-workshop-persona-file-edits.md)
D4–D7, D13.

Host only: no persona, no routes, no claim (the claim is Slice 4's).

## Scope

- **Every candidate (D4.1).** `ContextResourceResolver.listCandidates(groups)`
  keeps every match: group, workspace folder, relative path and absolute
  path. It runs the catalog's containment and symbolic-link checks. The
  catalog (`createProvider`) is unchanged; both share one walk
  (`forEachMatch`).
- **Staging (D4–D6).** `FileEditStagingService` implements `FileEditStaging`,
  whose types are in `domain/models/FileEditStaging.ts`, agreed with the
  Slice 3 thread.
  - **The target.** `{ group, path }`, matched without letter case, must name
    one physical file, or the stage is refused as `ambiguous-target`. Equal
    paths in two roots and two spellings both count as ambiguous; nested-root
    aliases count as one file.
  - **The excerpt** is the room's at staging. It must be a `file` or
    `editor-selection` source inside a workspace folder, with no link on the
    way; otherwise it is refused as `excerpt-not-a-file` or
    `outside-workspace`.
  - **The identity** is the file's `file:` URL plus its display path.
  - **The class** comes from every membership: `chapters` or `manuscript`
    through any group or root, or being an excerpt document, makes it prose.
  - **The baseline** is the content's SHA-256 and length. It is read from the
    live buffer when the document is open (`DocumentEditor.peek`), else from
    the file, with the byte-order mark stripped.
- **The applier (D5, D7.6).**
  - `structure: 'strict' | 'prose-paragraphs' | 'free'` replaces
    `preservesMarkdownStructure`. Proofread and Craft Flags take `strict`,
    and their expectations are unchanged.
  - `beforeAttempt(document, edits)` runs synchronously, immediately before
    every `applyEdits`, the direct retry included. A reason refuses the
    attempt (outcome `before-attempt`): nothing more is written, and no
    further attempt is made.
- **Structure modes.** `editsChangingStructure(…, { mode })`.
  `prose-paragraphs` reads a top-level run of paragraphs as one paragraph
  with their inline tokens in order, and reads emphasis and strong as their
  text, so prose may take italics. Everything else compares as `strict`
  does: links, images, code spans, autolinks and inline HTML included.
- **The authority epoch (D7.6).** `FileEditAuthorityEpoch` is a platform
  port: a counter. `VsCodeFileEditAuthorityEpoch` moves it on any
  workspace-folder change, and on any change to `proseMinion.contextPaths`.
  It is built in `extension.ts` and disposed with the extension.
- **The gateway (D7).** `ProjectFileEditGateway.apply(staged, { review,
  stillCurrent })`:
  1. re-authorizes the identity: a catalog member in a fresh candidate read
     (for a file), inside a workspace folder with no link;
  2. recomputes the class, and prose wins;
  3. opens the document, whose URI must name the identity;
  4. plans, checks freshness and the class policy, then the ceiling;
  5. runs the last boundary, synchronously, with nothing awaited before the
     applier:
     - the caller's authority predicate `stillCurrent()`: the claim, the
       room generation, the setting;
     - the epoch captured at re-authorization;
     - containment;
  6. applies with `beforeAttempt`, which runs the same authority checks, then
     freshness, the insertion bounds and the ceiling on the live text, before
     every attempt;
  7. reports by operation and state (`applied`, `partial`, `declined`,
     `stale`, `refused`, `unknown`);
  8. reveals the document.
- **Budgets.** `PROMPT_BUDGETS.workshopFileEdits`: `insertWords` 400,
  `insertCharacters` 4,000, `rewriteCeilingShare` 0.6,
  `rewriteFloorCharacters` 300, `fileBytes` 2 MiB, `rewriteFileBytes`
  32 KiB.
- **Port.** `DocumentEditor` gains `open` (load without showing), `peek` (an
  open buffer, never loading one) and `reveal` (a preview tab without focus,
  only when no editor shows the document). The VS Code adapter finds a
  document by its parsed URI, so a `file:` URL and VS Code's own spelling
  agree.
- **Composition.** Staging and the gateway are built only in `extension.ts`,
  over Proofread's applier, the resolver and
  `workshopExcerptFileEditDocument` (the room's excerpt, authorized as
  "Re-read from file"). `CoreServices` holds `fileEditStaging` and
  `projectFileEditGateway`.
- **Boundaries** (`boundaries.test.ts`):
  - only Draft Edit's runs and the gateway import the applier;
  - staging and the gateway join the document-port allowlist;
  - no Workshop module names a document port, the applier or the gateway;
  - `fileEdits/` names no write, rename, delete or save.

## Tests

- **`FileEditStagingService.test.ts`:**
  - the identity and baseline, from the buffer, from the file, and with a
    byte-order mark;
  - letter case;
  - equal paths in two roots, two spellings, nested roots;
  - overlapping globs that give a note prose rules;
  - the excerpt and an excerpt alias;
  - an excerpt with no file, outside the workspace, or behind a link;
  - every refusal;
  - log sentinels.
- **`ProjectFileEditGateway.test.ts`:**
  - **Notes:**
    - a rewrite after front matter, revealed;
    - a rewrite after the note changed (stale);
    - a rewrite over protected syntax or past 32 KiB;
    - structure free;
    - front matter protected.
  - **Prose:**
    - rewrite refused;
    - paragraphs split, merged and added;
    - a heading or code refused;
    - insertion bounds;
    - italics allowed;
    - the ceiling, past and under its floor;
    - the F-06 retry over the floor, which writes nothing;
    - Astra's 18-character control, which lands on the retry.
  - **Identity at Apply:**
    - a class turned prose by a glob or by becoming the excerpt;
    - no longer configured;
    - root removed or linked;
    - roots reordered;
    - an excerpt identity outside the catalog;
    - unopenable;
    - another URI;
    - `stillCurrent` false;
    - authority moving between attempts (the predicate, or the epoch): no
      second `applyEdits`, with a control that lands;
    - the epoch moving after re-authorization.
  - **Read-back:**
    - a missing quote;
    - a stale version in review;
    - partial;
    - declined;
    - closed;
    - CRLF;
    - unsaved;
    - log sentinels with no text, quote, path or URI.
- **`markdownStructure.test.ts`:**
  - Astra's four witnesses: refused under `strict`, kept under
    `prose-paragraphs`;
  - the single-newline control;
  - a paragraph removed;
  - emphasis and strong free in prose, refused in strict;
  - every other block and inline construct still refused.
- **`DraftEditApplier.test.ts`:** Astra's shrink-the-paragraph retry refused
  by `beforeAttempt` with nothing written, and a first-attempt refusal asks
  nothing.
- **`VsCodeFileEditAuthorityEpoch.test.ts`:** the epoch moves on a folder
  change and a context-path setting, never on another setting.
- **Other tests:**
  - `ContextResourceResolverCandidates.test.ts`;
  - `VsCodeDocumentEditor.open.test.ts` (open, peek, reveal);
  - `WorkshopExcerptFileEditDocument.test.ts`;
  - `markdownFrontMatterEnd.test.ts`;
  - `reconcileEdits.test.ts` (a pure insertion).

## Implementation note

- **A Draft Edit read-back fix, flagged.** `reconcileEdits` moved a
  zero-width edit past its own inserted text, so a landed append or prepend
  read back as `unknown`. Proofread never inserts. The fix counts an
  insertion's own text as the edit.
- **Narrower dependencies.** The applier and Proofread's run take
  `Pick<DocumentEditor, 'watch' | 'applyEdits'>`; Craft Flags' run takes
  `Pick<DocumentEditor, 'watch'>`. Existing doubles need no new methods, and
  Craft Flags names no write.
- **Policy-type renames in tests.** Replacing `preservesMarkdownStructure`
  changed three test lines (`DraftEditApplier.test.ts` ×2,
  `proofreadGuard.test.ts`) from `preservesMarkdownStructure: true` to
  `structure: 'strict'`. No expectation changed.
- **Test fake.** `FakeDocuments.open` (a boolean) is now `isOpen`, because
  the port method shadows it; that touched four lines in
  `CraftFlagsUseCase.test.ts`.
- **An excerpt identity at Apply** is not required to be a catalog member,
  since the excerpt may come from a file no glob lists. It must still lie in
  a workspace folder with no link. A `file` identity must be a member.
- **The front-matter skip** follows the file's extension (`.md`), for both
  the baseline and the plan, so staging, which may read the file, and Apply,
  which reads the buffer, agree.
- **A partial applier refusal is not partial.** Edits the applier refuses
  before the host is asked (protected, markup, line break) make the card
  `refused` when nothing else landed. When some operations land and others
  are refused, the card is `partial`.
- **The ceiling's measure** (the coordinator's call; the ADR will follow).
  `changed` is each replace's characters past the common start and end of
  its quote and replacement, summed. It is refused only when `changed` is
  over 300 and over 0.6 × touched. Where a replace stands moves with its
  edit between attempts; how much it changes does not.
- **CRLF.** In a CRLF document, a model's `\n` becomes `\r\n`, and the
  separator is a CRLF blank line.

## Review fixes (PR #229, Astra at `778a09a6`)

- **F-01 (P1): an incomplete candidate read failed open.**
  - `listCandidates` is now authoritative. A search that fails for any group,
    root or pattern rejects the whole read, and so does a match whose
    metadata cannot be read (`ContextCandidateReadIncomplete`). A linked or
    outside match is still excluded, as before.
  - Staging and Apply refuse on a rejected read as `catalog-unreadable`,
    before anything is dispatched.
  - The catalog's tolerant walk is unchanged, for browsing.
  - Both walks share `forEachMatch` (modes `browse` and `authoritative`) and
    one verdict function (`inspectWorkspaceResource`).
- **F-02 (P2): paragraphs at structural boundaries.**
  - In `prose-paragraphs`, a top-level plain paragraph is no block. Its
    inline constructs (links, images, code spans, autolinks, inline HTML)
    still count, in order among the blocks.
  - So a paragraph may appear or go anywhere: in an empty chapter, beside a
    heading or a break, or as the last one.
  - Every other block keeps its kind, order and nesting. `strict` is
    unchanged.
- **F-03 (P2): a refused retry erased earlier outcomes.**
  - A `before-attempt` refusal now applies only to the edits still waiting
    for that attempt. Landed and `unknown` from earlier attempts stand.
  - The card's state is derived from what stands: `partial` with a known
    landing, else `unknown` with an unknown operation, else the refusal.
- **N-01 (D13): the real resolver's logs.** The authoritative read logs only
  counts ("Candidate read: N candidate(s), M excluded match(es).") and
  throws errors that name no pattern, path or host message.
- **Tests.** `fileEditReviewWitnesses.test.ts` ports Astra's reproductions,
  now asserting the safe behavior.
  - **F-01**, through the real resolver, staging, gateway and applier:
    - a failed prose search;
    - a failed second-root search;
    - an unreadable match;
    - controls: a complete notes-only rewrite, and overlapping memberships
      reading as prose.
  - **F-02**:
    - append and prepend in an empty chapter, by a heading and by a break;
    - deleting the only paragraph;
    - refused controls: inserting a heading, list, quote, code or link, and
      deleting a heading or a link's paragraph.
  - **F-03**:
    - unknown plus standing, then authority lost, the epoch moved, or a text
      rule refused: the unknown stays, with one host call;
    - landed plus unknown plus refused reads as partial.
  - **N-01**: log sentinels for a private pattern, a host error naming a
    path, and linked and outside matches.

### Re-review: N-01 through the excerpt route (Astra at `72c47b2e` / `288da6e9`)

F-01 to F-03 closed. N-01 stayed open on the excerpt route, which staging
and Apply both reach:
`workshopExcerptFileEditDocument` → `authorizeExcerptReread` → the intake
service's catalog → the resolver's browse walk, which logged patterns, host
messages and linked paths.

- **Fix.** `ContextResourceResolver.countsOnly()` is a provider factory over
  the same tolerant catalog. It lists exactly what the catalog lists, but its
  diagnostics carry counts only: a failed search, a skipped match and a failed
  read are each logged without a pattern, path or message.
  - `extension.ts` builds the file-edit excerpt adapter over its own
    `WorkshopContextIntakeService(resolver.countsOnly(), …)`.
  - The writer's catalog, and every other intake flow, keep their detailed
    diagnostics.
  - The write checks are unchanged.
- **Tests:**
  - `fileEditExcerptLogging.test.ts` runs the real excerpt adapter, intake
    service and resolver, composed as `extension.ts` composes them. A staging
    run through a failing search and an Apply over a linked match each log no
    sentinel. A control shows the writer's own catalog keeps its detail.
  - The test fails against the old composition.
  - `providerAssembly.test.ts` pins the composition.
