# Feature: A Basic Writing Editor for Markdown

**Date Identified:** 2026-11-07
**Status:** Idea. Large: the extension's first custom editor and its first editor library. ADR first.
**Priority:** Medium
**Origin:** Okey, 2026-11-07

## In Okey's words

> Basic WYSIWYG editor for users, that allows the users to write and edit
> Markdown.

## Problem

Writers draft in VS Code's text editor: Markdown with its markup showing,
in a programmer's font, with VS Code's Markdown preview as a separate pane.
Many writers would rather see headings as headings and emphasis as
emphasis while they write, without `#` and `*` in the way.

## What exists today

- **No custom editor.** `apps/vscode-extension/package.json` contributes no
  `customEditors`, and nothing registers one.
- **One Markdown library,** `marked`, used for reading structure (Draft
  Edit's structure checks and protected regions), not for editing.
- **Everything that touches the manuscript assumes VS Code's text editor:**
  - the selection port (`VsCodeEditorContext`, `onDidChangeTextEditorSelection`);
  - the editor context menu's `when` clauses (`editorContextMenu.test.ts`);
  - Proofread's and Craft Flags' flags, which are diagnostics in a
    `DiagnosticCollection`, drawn by the text editor;
  - Draft Edit's writes, which are `WorkspaceEdit`s through `DocumentEditor`.

## The key choice: source-preserving, not convert-and-save

There are two ways to build a WYSIWYG Markdown editor, and they differ on
the writer's file.

| | Rich document (ProseMirror, TipTap, Milkdown) | Live preview (CodeMirror 6, Obsidian-style) |
|---|---|---|
| How it works | Parses Markdown into a document model, and writes Markdown back out from it | Keeps the text. Styles it, and hides markup away from the cursor |
| The writer's file | Rewritten to the serializer's taste on the first edit: `_` becomes `*`, list markers change, line wraps go, escapes are added, reference links are inlined | Changes only where the writer types |
| Draft Edit's anchors and protected regions | Can shift under a rewrite the writer never made | Untouched: the text is the text |
| Feel | Closest to a word processor | Very close. Markup shows only on the line being edited |

**Leaning: live preview.** A file a writer opens and nudges must not come
back rewritten. That is the writer-data rule the Lightbox's saved boards and
the session codec already keep. Live preview gives most of the WYSIWYG feel,
and every edit stays an ordinary text edit.

## Shape (for the ADR)

- **A `CustomTextEditorProvider`** for `.md`, contributed with priority
  `option`. It never becomes the default: a writer chooses it with "Reopen
  Editor With…", or with a Prose Minion command. It is backed by VS Code's
  own `TextDocument`, so save, undo, dirty state, Git and Draft Edit's writes
  all work as they do now.
- **The editor in a webview,** on CodeMirror 6 with Markdown highlighting,
  within the Chromium 114 floor (`webviewCssFloor.test.ts`), built by the
  existing webpack config.
- **"Basic" means:**
  - headings, bold, italic, quotes, lists, links and scene breaks;
  - a small toolbar (B, I, H1–H3, quote, list) and the usual keys;
  - a word count;
  - front matter, code, HTML comments and tags shown as raw blocks, using
    the same regions Draft Edit protects.
- **Keep what already works:**
  - **Selection.** The editor reports its selection through the
    `EditorContext` port, so Send Selection to Workshop, dictionary lookup,
    the Lightbox and Proofread on a selection all work from it.
  - **Flags.** Diagnostics don't draw in a webview, so the editor draws
    Proofread's and Craft Flags' flags itself, read through a port, and their
    quick fixes go through the same commands into core.
  - **The menu.** The Prose Minion submenu needs a `when` for the new editor
    (`activeCustomEditorId`).

## Open questions

- **Live preview or rich?** The table above is the case for live preview.
  Is the word-processor feel worth a rewritten file?
- **Which files?** Every `.md`, or only files in the project's manuscript
  folders?
- **How much of Prose Minion lives in it?** A "Send to Workshop" button on
  the selection, Lightbox on the file, flags in the margin? Or a plain
  editor first?
- **Writing comforts:** focus mode, typewriter scrolling, a reading width,
  a writer's font. In v1, or later?
- **The dependency.** CodeMirror 6 is modular. The ADR names exactly which
  packages, and their bundle cost.

## Completion Criteria

- [ ] An ADR picks live preview or rich editing, the provider and its
      priority, the library and its bundle cost, and how selection and flags
      reach the editor.
- [ ] Opening a `.md` with the editor and saving with no edits leaves the
      file byte-identical. One edit changes only the text edited, tested on
      fixtures with every construct the protected regions know.
- [ ] Undo, save, dirty state and external changes behave as in the text
      editor.
- [ ] Send Selection to Workshop and the selection-based tools read the
      editor's selection.
- [ ] Proofread and Craft Flags flags show in the editor, and their fixes go
      through Draft Edit's one door.
- [ ] It is never the default editor for `.md`.

## Related

- [ADR 2026-10-21: Draft Edit](../../../docs/adr/2026-10-21-draft-edit-engine-and-document-write-back.md):
  protected regions, the one door for writes, flags as annotations.
- [ADR 2026-10-21: VS Code Engine Floor](../../../docs/adr/2026-10-21-vscode-engine-floor.md):
  the Chromium 114 floor.
- [Send the Editor Selection With Each Message](../feature-workshop-send-selection-with-message/README.md):
  the same selection port, which this editor must feed.

## Related Files

- `apps/vscode-extension/package.json` (`contributes`: a `customEditors` entry, menus)
- `packages/core/src/platform/EditorContext.ts` and `IssueAnnotator` (the ports the editor must feed and read)
- `apps/vscode-extension/src/platform/vscode/VsCodeEditorContext.ts`
- `packages/core/src/utils/draftEdit/protectedRegions.ts`, with
  `markdownBlockRegions.ts` and `markdownInlineRegions.ts` (the regions the
  editor shows raw)
- `apps/vscode-extension/webpack.config.js`
