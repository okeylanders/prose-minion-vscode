# Slice 3: Lexical Gravity and Palette

**Epic:** [Lightbox](README.md)
**Decision:** [ADR 2026-10-19](../../../docs/adr/2026-10-19-lightbox-inspiration-board.md), D3 (kinds), D7, D11; [ADR 2026-08-01](../../../docs/adr/2026-08-01-lexical-gravity-interpretive-grammar.md)
**Status:** Planned

## Outcome

Group A gains two lenses.

**Lexical gravity** detects the borrowed metaphor fields the prose already
leans on. Each field has:

- a governing metaphor;
- a pull, drawn hatched and labeled a claim;
- terms the reading names and code counts;
- a 1° / 2° / 3° degree split, using the Lexical Gravity widget's vocabulary;
- a recurrence strip and a drift note.

The tile also shows collisions, where two fields share a sentence, and fields
set aside because they are literal in the scene. An orbit view places fields
by pull.

**Palette** groups counted words into diction clusters and names the colors
the text uses as swatches.

Pinning a gravity field offers **Build as a lens in Lexical Gravity**. That
opens the Workshop with the widget's Build lens filled in, through the
Workshop's own message path.

## Host

- Prompts:
  - `13-lexical-gravity.md`: borrowed versus literal, degrees, collisions,
    a required set-aside list;
  - `14-palette.md`;
  - updated worked example for group A.
- Codec kinds: `gravity-field`, `gravity-collision`, `gravity-literal`,
  `palette-cluster`, `swatch`.
- Counted support:
  - field terms are counted by the host per paragraph, giving hits, the
    paragraph set and the drift note (first and last paragraph, where the
    field is densest);
  - degree assignment is the reading's;
  - a field under a minimum hit count is drawn below the gravity line rather
    than dropped.
- **Handoff (ADR D11):**
  - `LIGHTBOX_HAND_OFF` with `{ kind: 'lexical-gravity-seed', field, metaphor, terms }`;
  - `LightboxHandler` re-verifies against the current source hash and calls
    `uiActions.handOffToWorkshop`;
  - `extension.ts` implements it with a new
    `WorkshopPanelProvider.seedLexicalGravityBuild(seed)`. That method routes
    a synthetic `WORKSHOP_OPEN_LEXICAL_GRAVITY_BUILD` through the Workshop
    panel's own `MessageHandler`, and the widget opens Build lens with
    `originQuery` prefilled.
  - Nothing is built or installed without the writer pressing Build.
- Architecture: the new Workshop route joins the ledger in
  `boundaries.test.ts`. Lightbox files that name Lexical Gravity join the
  approved feature-surface list.

## Webview

- `LightboxLexicalGravity`: the orbit (rings at strong, moderate and the
  gravity line), field rows, degree bars, the collision row and the literal
  set-aside.
- `LightboxPalette`: cluster rows and swatches.
- The inspector shows degree rows ("By degree") and Build as a lens.

## Tests

- Codec: gravity and palette blocks, missing set-aside list, a degree out of
  range.
- Counting: hits and paragraph sets for field terms, including multi-word
  terms and case folding.
- Handoff:
  - a seed reaches the Workshop only through the panel's handler (an
    assembly test in the style of `seedExcerpt`);
  - a stale source refuses the handoff.
- Prompt example decodes through the production codec.

## Done when

On a public-domain fixture with an obvious borrowed field, the field appears
with counted hits, and a literal field is set aside with its reason. Build as
a lens opens Lexical Gravity in the Workshop with the subject filled in.
