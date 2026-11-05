# Slice 2: The gateway

**Status:** Built, in review.
**Branch:** `epic/workshop-persona-file-edits-slice-2-gateway` (from Slice 1's head)
**Decision:** [ADR 2026-11-05](../../../docs/adr/2026-11-05-workshop-persona-file-edits.md) D4–D6, D11

Host only: no persona, no prompt, no UI.

## Scope

- **Port.** `DocumentEditor.open(uri)` loads a buffer without showing it.
  `DocumentEditor.reveal(uri)` shows a document in a preview tab, without
  focus, unless an editor already shows it (D6). The VS Code adapter uses
  `workspace.openTextDocument` and `window.showTextDocument`.
- **Domain.** `domain/models/FileEdit.ts` holds:
  - `FileEditRequest { target, operations, source }`;
  - `FileEditTarget`: `{ kind: 'resource', group, path }` or
    `{ kind: 'excerpt', excerptVersion }`;
  - `FILE_EDIT_GROUP_KINDS`, a `Record` over every group, so the compiler
    checks each has a kind;
  - `FILE_EDIT_TARGET_POLICIES` (D5);
  - the refusal and fault names.
- **Budgets.** `PROMPT_BUDGETS.workshopFileEdits`: `appendWords` 400,
  `rewriteCeilingShare` 0.6, and `fileBytes` 2 MiB (`resource.read`'s
  source ceiling).
- **The gateway** is `application/services/fileEdits/`:
  - `ProjectFileEditGateway`: open, plan, apply, report and reveal;
  - `fileEditTargets`: fresh resolution;
  - `fileEditPolicyChecks`: the passage bound and the rewrite ceiling;
  - `fileEditCopy`: the writer's words.

  It is built only in `extension.ts` over the same `DraftEditApplier`
  Proofread uses, and reached through `CoreServices.projectFileEditGateway`.
- **The excerpt.** `WorkshopExcerptFileEditSource` reads the room's excerpt
  from session state when an edit is asked for. It authorizes the source
  through `WorkshopContextIntakeService.authorizeExcerptReread`, the rule
  "Re-read from file" uses.
- **Boundaries** (`boundaries.test.ts`):
  - only Draft Edit's runs and the gateway import the applier;
  - only the applier calls `applyEdits` (unchanged);
  - the gateway joins the document-port allowlist;
  - no Workshop module names `DocumentEditor`, the applier, or the gateway,
    or calls a document port;
  - nothing in `fileEdits/` names a file system or a save.

## Tests

- `ProjectFileEditGateway.test.ts` runs with fake ports, the real applier
  and *Alice*:
  - **Notes:** rewrite after front matter, with the file revealed; replace,
    append and prepend together; a structure change; front matter refused.
  - **Prose:**
    - a replace with a line break;
    - a paragraph split, a merge, and an appended paragraph;
    - an appended heading refused;
    - rewrite refused;
    - the passage word bound, at and over;
    - the rewrite ceiling;
    - a structure change and a protected region refused.
  - **Live text:**
    - a missing quote makes the card stale;
    - a stale version (the writer types during review);
    - a closed document, both before the apply and during it;
    - a partial apply (one entry ticked in review);
    - NUL text;
    - CRLF line endings.
  - **Targets:**
    - not configured, an unsafe path, a URI given as a path, an unknown group;
    - outside the workspace, binary, over the size bound;
    - the excerpt at its version, stale by version, stale by text, manual,
      unauthorized, missing, and outside the workspace.
  - **What it leaves:** logs carry no text, quote or path, and the document
    is never saved.
- `VsCodeDocumentEditor.open.test.ts`: open loads without showing and
  answers undefined on failure; reveal shows a hidden document without
  focus and leaves a visible one where it is.
- `WorkshopExcerptFileEditSource.test.ts`, `markdownFrontMatterEnd.test.ts`.
- `reconcileEdits.test.ts`: a pure insertion reads back as applied.
- `markdownStructure.test.ts`: paragraphs may merge, split or be added only
  when asked, and a heading, a list or new inline markup is still refused.

## Implementation note

- **Two Draft Edit fixes this slice needed**, flagged for review:
  1. **Read-back of a pure insertion.** `reconcileEdits` moved a zero-width
     edit past its own inserted text, so an append or prepend that landed
     read as `unknown`. Proofread never makes a pure insertion. The fix
     counts an insertion's own text as the edit, not as text before it.
  2. **Paragraphs under "structure preserved".** D5 says prose keeps its
     Markdown structure, but its paragraphs may merge or split, and append
     and prepend add paragraphs. `editsChangingStructure` compared paragraph
     counts, so all three were refused as `markup`. A new opt-in,
     `paragraphsMayMergeOrSplit`, reads a top-level run of paragraphs as one
     paragraph with their inline tokens in order. It is on the applier's
     policy and the prose (and notes) policy rows; Proofread never sets it.
     New inline markup (emphasis, links) in prose is still refused.
- **The excerpt is stale** when the room's excerpt version is not the one
  the proposal names, or the live document no longer holds the excerpt's
  text exactly. A pasted excerpt has no file. An editor-selection excerpt is
  authorized like a file one.
- **Rules the planner gets:**
  - `skipLeading` is the front matter's end, by the rule that protects it
    (`markdownFrontMatterEnd`, Markdown only);
  - the separator is a blank line in the document's own line ending;
  - in a CRLF document, a model's `\n` in quotes and written text becomes
    `\r\n`.
- **The rewrite ceiling** sums every replace's changed characters (past the
  common start and end of quote and replacement) over the characters of
  the blank-line paragraphs they touch. Past 60%, every replace is refused.
- **Report.** One `FileEditOutcome`:
  - `refused`, before any plan;
  - `not-planned`, with per-operation faults (a quote not found or
    ambiguous is the stale card);
  - `settled`, with each operation's landing from the applier, the document
    version after, and whether it was revealed.

  Each outcome carries a message in the writer's words that names no path
  and quotes nothing.
- **Reveal** only after something landed, for direct and preview alike.
- **Narrower dependencies.** The applier and Proofread's run take
  `Pick<DocumentEditor, 'watch' | 'applyEdits'>`, and Craft Flags' run takes
  `Pick<DocumentEditor, 'watch'>`. Each asks only for what it uses, so their
  test doubles need no `open` or `reveal`, and Craft Flags still names no
  write.
- **Test fake.** `FakeDocuments` had an `open` boolean, which the new port
  method shadows. It is now `isOpen`: four mechanical lines in
  `CraftFlagsUseCase.test.ts`. No assertion changed.
