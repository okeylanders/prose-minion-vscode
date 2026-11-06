# Slice 4b: the cards (webview)

**Status:** Built, for review.
**Branch:** `epic/workshop-persona-file-edits-slice-4b-cards`, from Slice 4a's head (`epic/workshop-persona-file-edits-slice-4a-apply` at `d0c172b7`, in review).
**Decision:** [ADR 2026-11-05](../../../docs/adr/2026-11-05-workshop-persona-file-edits.md) D8 (states, no blind retry, no command to Refactor Preview), D9 (cards), D10.
**Consumes:** the routes and words table [Slice 4a](slice-4a-apply.md) lists under "Message contracts (for 4b)".
**Next:** Slice 5 (verify live).

Webview only. No host change.

## Scope

- **The domain hook, `useWorkshopFileEdits`** (`hooks/domain/workshop/`). Tripartite, and it persists nothing (`persistedState: {}`).
  - **Actions.** `apply`, `review` and `decline` post `WORKSHOP_FILE_EDIT_ACTION`; `requestPreview` posts `WORKSHOP_FILE_EDIT_PREVIEW`.
    - Each request carries a minted id (a per-webview prefix, `ws-file-edit-…`) and the `roomRevision` on screen.
    - Before the first snapshot (`roomRevision` absent), nothing posts.
  - **Correlation (#221).** An answer is taken only when all of these hold:
    - its request id is still waited for, by a request of the same kind (an action's answer is never a preview's);
    - the request was made in the room on screen (`room:<revision>`);
    - the answer names that room's revision;
    - it names the request's own card.

    Anything else (late, duplicate, another webview's, another room's) changes nothing.
  - **Per card**, keyed `turnId#index` (`workshopFileEditCardKey`):
    - **Busy** while its request is out. A second press while busy posts nothing, so one card has one request at a time.
    - **Feedback:** the answer's words, kept only when the answer left the card `pending` (`refused`, `held`, `no-card`, or `settled` / `joined` back to `pending`: a discarded review, a lost boundary). It clears on the card's next action. A settled card speaks through its state on the snapshot.
    - **Preview:** `loading`, then `ready` (before and after), `stale` or `refused`. Each card is asked once per room. A `refused` preview may be asked again; `stale` is final, and the host turns the card stale itself.
  - **A new room** (New, Open, Rewind, Branch, reload) drops every pending request, busy mark, feedback and preview. The old room's answers are then ignored.
- **The cards** (`components/workshop/fileEdits/`):
  - `WorkshopTurnFileEdits`: a turn's cards, under a count ("2 suggested edits") when there are several. Each card keeps its index on the turn.
  - `WorkshopFileEditCard`: the display path, the class ("chapter" / "note"), the why, the operations, a tally on a settled card with several operations ("1 of 2 changes applied."), the state line, and the actions.
  - `WorkshopFileEditOperation` draws each operation:
    - a replace as a word diff (`<del>` / `<ins>`, each with a visually hidden "removed:" / "added:");
    - append and prepend as their added text;
    - a rewrite as before and after, in a disclosure. On a pending card, opening it asks the preview route, and it shows "Reading the file…", then before and after, or the host's stale or refused words. On a settled card it reads the `landed` record's before and after when one kept the text, else the rewrite alone, and asks nothing.
  - **Per-operation outcomes** on a settled card: Applied, Not applied, Not known.
  - **Actions.** Apply, Review in editor… and Decline are drawn only while the card is `pending`. Every other state draws no button: no blind retry.
  - **Words.** Every state line comes from `workshopFileEditCardWords(state, reason)`, or from the host's answer while the card is pending. The cards write no words of their own about why.
  - `useWorkshopFileEditControls` builds the thread's controls from the hook and the room's lock. While a reply runs it shows the table's `run-active` line beside the disabled buttons.
- **Pure helpers:**
  - `workshopFileEditWordDiff` (`utils/workshop/`), a word-level diff:
    - exact: the segments rejoin each side;
    - common prefix and suffix trimmed, then an LCS over word and whitespace tokens;
    - a lone whitespace run between two changes joins them;
    - past `WORD_DIFF_CELL_LIMIT` (1,000,000 cells) the middle is one removal and one addition.
  - `workshopFileEditCardView` (`hooks/domain/workshop/fileEdits/`): the card as drawn, actionable only while `pending`, and never reading `documentUri`.
- **Accessibility.**
  - Each card is a `role=group` named "Suggested edit to `<path>`", with `aria-busy` while its request is out or the host holds it `applying`.
  - Buttons are named with their file ("Apply, edit to chapters/one.md").
  - A busy button stays focusable (`aria-disabled`) and presses nothing. The room's lock uses `disabled`.
  - The state line is a `role=status` region that is always drawn, so a change of state, or an answer's words, is read out.
  - When an action settles the card and its buttons go, focus moves to the state line (`tabIndex=-1`), but only when the card was acted on and focus had been in the card, or dropped to the body.
- **Wiring, at the seams only:**
  - `WorkshopApp`: the hook, the controls, the prop and the stylesheet import (+8 lines);
  - `WorkshopThread` and `WorkshopTurnBubble`: a `fileEdits` prop, and the cards under the memory cards;
  - `useWorkshopAppMessageRouter`: `WORKSHOP_FILE_EDIT_RESULT` and `WORKSHOP_FILE_EDIT_PREVIEW_RESULT`, when `fileEdits` is given.
- **Styles:** `styles/workshop/fileEdits.css`, scoped to `[data-pm-surface="workshop"]`, on the full tabs' tokens (no new color), plain CSS on the Chromium 114 floor. It is imported after `memory.css`, and joins `workshopStyles.test.ts`'s cascade list and jest's style stub.

## Tests

- **`workshopFileEditWordDiff.test.ts`** (6):
  - a changed word;
  - insertions and deletions as words;
  - a lone space joining two changes;
  - whitespace kept exactly;
  - empty and identical sides;
  - past the bound: one removal and one addition, still exact.
- **`workshopFileEditCardView.test.ts`** (16):
  - the key;
  - path and class;
  - a card refused at staging;
  - each of the eight states: the host's words, actionable only while pending;
  - replace and append;
  - partial outcomes and the tally;
  - one applied operation with no tally;
  - a settled rewrite's landed record, with a hashed one keeping nothing;
  - the stack label.
- **`useWorkshopFileEdits.test.ts`** (16):
  - Apply's payload, busy until answered;
  - Review and Decline;
  - a double press posts once;
  - a refusal's words beside the card, cleared on the next press;
  - **a late answer and a duplicate** change nothing;
  - an unknown request id;
  - **a joined answer**, settled and back to pending;
  - **another room's** answer;
  - a new room drops everything and ignores the old answers, then posts under the new room;
  - nothing before the first snapshot;
  - the preview: asked once and ready; stale for good; refused re-askable; an action's answer is not a preview's;
  - nothing persisted, no URI posted.
- **`WorkshopFileEditCard.test.tsx`** (25):
  - path, class, why and the diff;
  - append and prepend;
  - the pending actions with their accessible names;
  - each non-pending state: the host's words and no button;
  - a refused card's reason;
  - applied and partial by operation, with the tally;
  - unknown, with no second Apply;
  - busy: `aria-busy`, `aria-disabled`, and a press does nothing;
  - applying;
  - the locked room's reason;
  - feedback in the status line, and not on a settled card;
  - focus to the status line after an action, and left alone otherwise;
  - the rewrite's preview on open, stale, and a settled rewrite's landed record with no request;
  - **no `documentUri`** drawn, even one leaked into the view;
  - a bubble's stack, each card on its own index.
- **`WorkshopApp.fileEdits.test.tsx`** (4), through the real App and router:
  - Apply under the room on screen, the host's refusal on the card;
  - an earlier room's answer ignored;
  - the snapshot's outcome replacing the buttons;
  - no URI in the tree or in the posts.
- **Ledgers:**
  - `workshopStyles.test.ts`: the new sheet in the cascade.
  - `promptBudgets.test.ts`: `WORD_DIFF_CELL_LIMIT` listed as a non-prompt limit.

## Verification

- Baseline at `d0c172b7`: typecheck clean; jest 780 suites, 10,912 tests, 59 snapshots.
- After: see the epic README's progress note.

## Implementation note

- **State comes from the snapshot; answers carry only busy and feedback.** The host posts the session state (`applying`, then the outcome) before each answer (`settle` → `postSessionState`, then `answer`), so the card reads its state from the turn and never applies an answer's `state` optimistically. An answer only clears busy, and leaves words when the card stayed `pending`.
- **A rewrite's preview is asked when its disclosure opens, not when the card is drawn.** D9 allows either. Asking on draw would make the host open and read every pending rewrite's file whenever a thread drew, a reload or a room switch included. A card shows the rewrite's file read only when the writer asks to see it.
- **One request per card at a time.** A second press while busy posts nothing. The host joins duplicates anyway (D8); this only keeps the webview from minting requests whose answers it would show twice.
- **Busy is `aria-disabled`, not `disabled`.** A disabled button drops focus to the body in Chromium. The room's mutation lock still uses `disabled`, like the memory cards.
- **`room-changed` is not shown.** It answers an action from an earlier room, which the correlation already drops. If it ever arrives for the room on screen, that room is about to be replaced by the next snapshot.
- **The router's `fileEdits` dependency is optional**, so the existing route-table tests build their deps unchanged. `WorkshopApp` always passes it.
- **jest's style stub** now covers `fileEdits.css` beside `pinnedContext.css`, so no test that renders the app needs another `jest.mock`.

### Deferred to Slice 5

- **The setting's row** (`proseMinion.workshop.fileEdits`, Ask first / Off) in Conversation settings. The memory mode's row runs through `useWorkshopRoom`'s settings plumbing, the behavior modal and the host's settings handler. That is more than a small addition, so it is left for Slice 5 with the live pass.
- **A visual pass** in the Extension Development Host: the card's density beside the memory cards, the narrow-width stack, and the diff's colors in the light themes.

### Open for review

1. **Feedback on a `pending` card that a reload later shows.** Feedback lives only in the hook (nothing persists), so after a reload a refused Apply's words are gone, and the card reads "Nothing changes until you apply it." That seems right, since nothing changed, but the refusal's reason is lost.
2. **The tally** shows on any settled card with more than one operation, and on every partial one. A single-operation `applied` card shows its one Applied badge and no tally.

## Review fixes (PR #234)

- **F-01 (P2): an open rewrite disclosure was stuck after a room change.**
  - Open, Branch and Rewind can keep turn ids, so the card and its `<details>` stay mounted and open. The hook cleared its previews for the new room, but the preview was asked only from `onToggle`, so the card showed "Reading the file…" forever.
  - The pending rewrite (`PendingRewrite`) now tracks whether its disclosure is open. While it is open and has no preview, it asks for one for the room on screen (`requestPreviewWhenOpenWithout`).
  - The hook still drops the old room's late answers, and a closed disclosure asks nothing.
  - Regressions, through the real App and router (room 5 → 6): a preview already **ready**, and one still **in flight**, each end with a fresh request for room 6, and the old room's answer never shows. A control covers a closed disclosure asking nothing. Both fail without the fix.
- **PR #233's nonblocking note: a `partial` card with an `unknown` operation.**
  - The line said "Some of the changes were applied; the rest were not." That is false when some of the rest are `unknown`.
  - It now reads `WORKSHOP_FILE_EDIT_PARTIAL_UNCERTAIN_WORDS`: "Some of the changes were applied; for the others, it is not known whether they landed. Check the file before asking again. The file is not saved yet."
  - The choice is made by `workshopFileEditStateWords(state, outcomes)`, which `workshopFileEditCardWords` calls with an optional `outcomes`.
  - One source: `fileEditCopy.fileEditOutcomeMessage` no longer repeats the applied or partial sentence. It reads the shared table, and the gateway passes it each operation's outcome. The handler's answers (settled, joined, replayed) word a partial card from its outcomes too; the outcomes are used only for wording and are never posted.
  - The tally agrees: "1 of 2 changes applied; 1 not known."
  - Tests:
    - words: the mixed case, with a `not-applied` control, and the gateway's message reading the same table;
    - card view: the line and the tally;
    - card: the outcome badges, the tally, the status line, and no button.
- **F-02 (P2, re-review): reopening the disclosure no longer retried a refused preview.**
  - F-01's guard (`open && !preview`) treated a `refused` preview as present, so a transient read failure stayed until the room changed. The hook had already freed the card to be asked again.
  - The disclosure's `onToggle` now asks again when the writer opens it on a `refused` preview. The automatic request still runs only when the preview is missing, a new room included. A refused preview left open is never retried on its own, and a stale one stays final.
  - Tests, through the real App and router:
    - refused, close, reopen sends a second request, whose answer shows (fails without the fix);
    - a control: a refused disclosure left open, across later snapshots of the same room, sends no retry.
