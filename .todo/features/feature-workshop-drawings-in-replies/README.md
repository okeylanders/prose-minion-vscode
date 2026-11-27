# Feature: Personas Draw in Their Replies (SVG, then Mermaid)

**Date Identified:** 2026-11-27
**Status:** Idea. Medium. A short ADR: a new rendering path past the bubble's no-images rule.
**Priority:** Medium
**Origin:** Okey, 2026-11-27

## In Okey's words

> The model could include svg inline output and it render in the message
> bubble. That could make the more powerful models be able to communicate
> richly without enabling images for now. Right? Is there something else
> that might be better?

## What exists

- **The bubble forbids images on purpose.** `sanitizeMarkdownHtml`
  (`components/shared/MarkdownRenderer.tsx`) strips `img`, `style`, `object`
  and the rest: "even a harmless-looking Markdown image can become an
  automatic network beacon carrying prompt-injected data."
- **The renderer has a seam for this.** `MarkdownRenderer`'s `fencedBlocks`
  lets a fenced block render as its own element, falling back to an
  ordinary code block.
- **The webview allows `data:` images** (`img-src … data:` in
  `webviewHtml.ts`).
- **The HTML export's policy doesn't** (`default-src 'none'; style-src
  'unsafe-inline'`), so the export needs its own handling.

## Two kinds of drawing, and which is better

| | SVG | Mermaid |
|---|---|---|
| What a model writes | Raw shapes and text | A short text grammar: flowchart, timeline, mind map, quadrant |
| Good for | Freeform: a tension curve, an arc, a scene map | Structure: plot beats, relationships, timelines, who knows what |
| Reliability | Freehand layouts often overlap text | The library lays it out, so text never collides |
| Cost | No dependency | A large library in the webview |

For a writer's work (plot structure, relationships, timelines), **Mermaid
is usually the better tool:** the model says *what* connects, and the
layout is done for it. **SVG covers what Mermaid can't draw.** The lean is
both, SVG first because it's small (D1).

## Idea

1. **A fenced block draws.** A ` ```svg ` block in a reply renders as a
   drawing through the `fencedBlocks` seam; ` ```mermaid ` follows in
   step 2.
2. **SVG is drawn safely:**
   - it is sanitized with DOMPurify's SVG profile: no script, no
     `foreignObject`, no external `href`, no event handlers;
   - it is shown **as an image from a `data:` URI**, never as live markup.
     An SVG shown as an image can't run script or load anything;
   - it is bounded in bytes (`PROMPT_BUDGETS`). Over the bound, or failing
     to parse, it shows as the code block it was, with a host line.
3. **Mermaid (step 2)** renders in the webview with the library's strict
   security level, loaded only when a reply holds a diagram. Its bundle
   size is recorded in the PR.
4. **The prompt teaches restraint:** draw when a picture explains better
   than prose (an arc, a timeline, a map of who wants what), never for
   decoration. One drawing a reply is usual.
5. **The export draws them too.** The SVG goes inline, sanitized, or the
   export's policy gains `img-src data:`. A Mermaid diagram is rendered to
   SVG at export time, or kept as code (D3).
6. **Recall and context** see the code block as text. The model reads what
   it drew, no more.

## Decisions to make

| # | Question | Ada's lean |
|---|---|---|
| D1 | SVG first, Mermaid first, or both together? | SVG first: no dependency. Mermaid as step 2. |
| D2 | A setting to turn drawings off? | Yes, on by default: a drawing costs output tokens. |
| D3 | Mermaid in the HTML export: rendered, or kept as code? | Rendered to SVG at export, so the file stands alone. |

## Completion Criteria

- [ ] An SVG block renders as a drawing; script, `foreignObject`, external
      references and handlers are removed, and it's shown as an image
      (tests, including hostile SVGs).
- [ ] An over-bound or unparseable block stays a code block with a host
      line (test).
- [ ] The bubble's no-images rule still holds for Markdown images (the
      existing test).
- [ ] The HTML export shows drawings under its own policy (test).
- [ ] The prompt and its sync test hold the bounds.
- [ ] Step 2 adds Mermaid at the strict security level, loaded on demand,
      with its bundle size recorded.
- [ ] A help section explains drawings and the setting.

## Related Files

- `packages/core/src/presentation/webview/components/shared/MarkdownRenderer.tsx`
  (`sanitizeMarkdownHtml`, `fencedBlocks`)
- `apps/vscode-extension/src/application/providers/webviewHtml.ts` (the webview's policy)
- `packages/core/src/application/services/workshop/export/WorkshopTranscriptHtml.ts` (the export's policy)
- `packages/core/resources/system-prompts/workshop-personas/`
