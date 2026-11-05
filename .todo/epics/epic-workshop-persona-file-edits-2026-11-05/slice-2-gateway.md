# Slice 2: Staging and the gateway

**Status:** Built, in review. Reworked to the revised ADR after the PR #226
review (F-02, F-03, F-05, F-06).
**Branch:** `epic/workshop-persona-file-edits-slice-2-gateway`, from Slice 1's
head, with the revised spec merged in.
**Decision:** [ADR 2026-11-05](../../../docs/adr/2026-11-05-workshop-persona-file-edits.md)
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
  - `revalidate(document, edits)` runs before every ask, the direct retry
    included. A reason refuses the attempt, outcome `revalidation`, and
    nothing is written.
- **Structure modes.** `editsChangingStructure(…, { mode })`:
  `prose-paragraphs` reads a top-level run of paragraphs as one paragraph
  with their inline tokens in order. Everything else compares as `strict`.
- **The gateway (D7).** `ProjectFileEditGateway.apply(staged, { review,
  stillCurrent })`:
  1. re-authorizes the identity: a catalog member in a fresh candidate read
     (for a file), inside a workspace folder with no link;
  2. recomputes the class, and prose wins;
  3. opens the document, whose URI must name the identity;
  4. plans, checks freshness and the class policy, then the ceiling;
  5. runs the last boundary (`stillCurrent()` and a synchronous containment
     check), with nothing awaited before the applier;
  6. applies with `revalidate`, which checks freshness and the ceiling on
     each attempt;
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
    - the ceiling, past and under its floor;
    - the F-06 retry, which writes nothing.
  - **Identity at Apply:**
    - a class turned prose by a glob or by becoming the excerpt;
    - no longer configured;
    - root removed or linked;
    - roots reordered;
    - an excerpt identity outside the catalog;
    - unopenable;
    - another URI;
    - `stillCurrent` false.
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
  - every other block and inline construct still refused.
- **`DraftEditApplier.test.ts`:** Astra's shrink-the-paragraph retry refused
  by `revalidate` with nothing written, and a first-attempt refusal asks
  nothing.
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
- **Emphasis in prose.** New emphasis inside prose is still refused under
  `prose-paragraphs`, as under `strict`. The ADR's list names links, images,
  code spans, autolinks and inline HTML, and doesn't settle emphasis, so I
  kept the stricter reading.
- **CRLF.** In a CRLF document, a model's `\n` becomes `\r\n`, and the
  separator is a CRLF blank line.
