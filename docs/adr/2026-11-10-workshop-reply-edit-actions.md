# ADR 2026-11-10: A Reply Offers Its Fixes and Rewrites as Edits

**Status:** Proposed (2026-11-10); design approved by Okey the same day, who
took every recommendation in [the questions](#the-questions-as-put-okey-took-each-recommendation-2026-11-10).
It becomes Accepted after the live pass. Nothing is built yet.
**Date:** 2026-11-10
**Epic:** [Workshop Reply Edit Actions](../../.todo/epics/epic-workshop-reply-edit-actions-2026-11-10/README.md)
**Idea as filed:** [feature note](../../.todo/features/feature-workshop-reply-edit-actions/README.md)
**Extends:**
- [ADR 2026-11-05: Personas Propose Edits to Project Files](2026-11-05-workshop-persona-file-edits.md).
  An offer's answer is ordinary file-edit proposals: its trailer (D2),
  staging (D4), cards (D9), claim (D8) and apply (D7) are used unchanged.
  This ADR adds one stricter policy for fixes (D6 here).
- [ADR 2026-11-07: Workshop Message Reactions](2026-11-07-workshop-message-reactions.md)
  (on `epic/workshop-message-reactions`, not yet on `main`). Its reaction
  corner and this ADR's offers share one row of the bubble (U1), and its
  trailer and this one join the same tail section (D1).

## Context

A persona's reply often says "three typos here, and two lines I'd rewrite
like this". Since Persona File Edits, the writer can turn that into edit
cards, but only by asking again in words and hoping the answer comes back as
proposals instead of more prose.

Okey asked for (2026-11-10):
1. a control on a reply that has simple fixes, which makes the persona
   answer with edit proposals for exactly those fixes;
2. the same for a reply that proposes rewrites;
3. a reply that declares, machine-readably, which of the two it holds;
4. no doubt about which reply a press came from, even when the two presses
   are turns apart;
5. a bubble that does not get busier.

What an assistant bubble holds today, top to bottom, once Message Reactions
lands:
- its head, body, and any findings, web sources, memory cards and file-edit
  cards;
- **an action row** of up to seven labeled buttons: Copy, Save to notes,
  Bookmark, Save to memory…, Talk directly to…, Rewind, Branch;
- **a widget chip** on its own row, when the persona recommended a widget;
- **the reaction corner** on its own row, at the right, always shown.

So the bubble already ends in up to three footer rows. The corner's row is
empty from its left edge to the corner.

Why a declaration and a second run, when a persona could just attach
proposals to the first reply:
- **Cost.** A proposal needs the file read first (`resource.read`) and
  exact quotes. Most critique is never applied, so paying for that on every
  reply is waste. A declaration is about 40 output tokens.
- **Noise.** Cards under every critique would crowd the thread far more
  than a chip does.
- **Okey's rule in the persona prompt** stays: a persona suggests an edit
  when the writer asks. The chip is the writer asking.

## The design in one paragraph

A persona ends a reply that holds fixes or rewrites with a small **offer**
trailer per kind. The host strips it, checks it, resolves its file, and
keeps it on the turn. The bubble shows each offer as a **chip** at the left
end of the reaction corner's row. Pressing a chip sends only the turn's id
and the kind. The host reads that reply from its own ledger, and asks the
persona who wrote it, in a framed directive that quotes the reply, for
file-edit trailers and nothing else. The answer lands at the end of the
thread as a host-worded line and ordinary edit cards, each naming the reply
it came from. The chip on the source bubble then points to those cards.
Whether an offer was used is read from the thread, never stored.

## The writer's surface

Mockups, with *Alice* text, are in the epic folder:
[before and after](../../.todo/epics/epic-workshop-reply-edit-actions-2026-11-10/mockups/1-before-and-after.png),
[a chip's states](../../.todo/epics/epic-workshop-reply-edit-actions-2026-11-10/mockups/2-chip-states.png),
[the answer](../../.todo/epics/epic-workshop-reply-edit-actions-2026-11-10/mockups/3-answer.png),
[a narrow column](../../.todo/epics/epic-workshop-reply-edit-actions-2026-11-10/mockups/4-narrow.png)
([source](../../.todo/epics/epic-workshop-reply-edit-actions-2026-11-10/mockups/reply-offers.html)).

### U1. One footer row: offers at the left, reactions at the right

The footer sits below the action row. Everything above that row keeps its
place and its markup: the body, "Add a next step" and its findings, web
sources, memory cards and file-edit cards.

The reaction corner's row becomes **the reply's footer**. Its two ends hold
the two things that are about this reply in particular:
- **left:** what the persona offers to do next;
- **right:** how the room reacted, and "Add reaction".

What sits at the left, in this order:
1. a quiet lead, "✎ As edits", shown only with an edit offer;
2. the edit-offer chips: **fixes**, then **rewrites**;
3. the persona's widget chip, which moves here from its own row.

The widget chip belongs with the offers: it is already "the persona
suggests a next step; one press takes it". Moving it is what pays for the
new chips.

| Reply | Footer rows today | Footer rows after |
|---|---|---|
| Plain | 2 (actions, corner) | 2 |
| With a widget chip | 3 | 2 |
| With edit offers | 2 | 2 |
| With both | 3 | 2 |

No bubble gains a row. The action row is not touched (Q6 asks whether it
should be).

The row wraps: in a narrow column the offers take the first line and the
corner sits under them at the right, where it sits today.

### U2. A chip and its states

A chip is one button. It never leaves its place, so focus stays on it from
the press to the answer.

| State | The chip reads | A press |
|---|---|---|
| **Open** | "**3** fixes" | Asks the persona (D4) |
| **Asked** | "Asking Jill for 3 fixes…" | Nothing; the room's Stop ends the run |
| **Answered** | "✓ 3 fixes suggested ↓" | Moves focus to the answer's cards |
| **Nothing to change** | "3 fixes · nothing to change" | Moves focus to the answer line |
| **Ask again** | "**3** fixes · ask again" | Asks the persona again |

- **The count** is the persona's own, and optional: without one the chip
  reads "fixes". After an answer the chip shows what actually came
  ("2 fixes suggested"), which may differ.
- **A fix is one change, not one card.** A card is one file; three fixes to
  one chapter are one card with three replacements.
- **Ask again** appears only when asking again cannot double anything (D7).
- **Stopped or failed runs** leave no answer, so the chip is Open again,
  with the host's reason as its description until the next snapshot.

### U3. The writer's message is one line, not a bubble

A press is the writer's turn, but they wrote nothing. It shows as a divider
line, the way a direct tool run does:

> YOU ASKED JILL FOR EDITS · THE 3 FIXES IN HER 2:02 PM REPLY ↑

The link moves focus to the source bubble.

### U4. The answer: a host sentence and cards

The answer is a reply bubble from the same persona, at the end of the
thread. It holds:
- **the host's line:** "Suggested 3 fixes to **chapters/down-the-rabbit-hole.md**,
  from her 2:02 pm reply ↑." The link goes to the source bubble.
- **the cards,** under "Suggested file edits · fixes" (or "· rewrites").
  Each card carries a small "fixes" or "rewrites" mark beside its class.
  Apply, Review in editor… and Decline work as they do today.

The persona's own prose in an answer never shows (D5). When there is
nothing to apply, the line is the host's, with the persona's one-line
reason: "Jill found nothing to change: *the chapter already reads
'beginning'.*"

### U5. When chips show, and when they wait

A chip is drawn only from the host's view of the turn (D3). The host gives
one only when all of these hold:
- the reply declared the offer, and it passed its checks (D1, D2);
- file edits are set to Ask first (`proseMinion.workshop.fileEdits: ask`),
  read when the reply was read and again for every snapshot;
- the offer's file resolved to exactly one project file (D2).

An offer that fails any of these is not drawn at all. There is no disabled
"can't" chip: a chip that can never work is only clutter.

A chip that is drawn but cannot be pressed right now stays focusable
(`aria-disabled`), with the reason as its description:
- **a run is going:** "Wait for the current reply to finish". One run at a
  time, as everywhere in the room; presses are never queued (Q5);
- **the room's lock is held:** the room's own wording;
- **the persona left the room:** "Jill isn't in this room now".

### U6. Accessibility

- **Group.** The offers are a `role="group"` named "Edits Jill can suggest
  from this reply".
- **Names** start with the visible label, then say who, what and where:
  "3 fixes. Ask Jill to suggest them as edits to
  chapters/down-the-rabbit-hole.md." An answered chip: "3 fixes suggested.
  Go to the edits."
- **Order.** Tab reaches the action row, then the offers, then the
  reactions: the DOM order, which is the visual order.
- **Busy.** The asked chip is `aria-busy`, and the sibling chip stays
  focusable.
- **The answer is announced once,** by a polite live region owned by the
  feature's hook, never by the chip: "Jill suggested 3 fixes to
  down-the-rabbit-hole.md. They are at the end of the conversation." Or
  "Jill found nothing to change." Or the host's failure line.
- **Focus** never moves by itself. The chip, the divider's link and the
  answer line's link move it on a press, to a bubble that is already
  focusable (`tabindex="-1"`, by turn id).
- **Not by color alone.** Every state has its own words.
- **CSS** holds on the Chromium 114 floor: flex and wrap only.

## Decision

### D1. The declaration: an offer trailer, one per kind

A reply may end with up to two `<prose-minion-edit-offer>` frames, in the
tail section with the other trailers, in any order among them:

```xml
<prose-minion-edit-offer>
  <kind>fixes</kind>
  <excerpt/>
  <count>3</count>
</prose-minion-edit-offer>
<prose-minion-edit-offer>
  <kind>rewrites</kind>
  <group>chapters</group>
  <path>chapters/down-the-rabbit-hole.md</path>
  <count>2</count>
</prose-minion-edit-offer>
```

- **`<kind>`:** `fixes` or `rewrites`, a closed vocabulary
  (`WORKSHOP_EDIT_OFFER_KINDS`). At most one frame per kind.
  - **fixes:** spelling, grammar, punctuation, a doubled or dropped word.
    The meaning and the voice stay as they are.
  - **rewrites:** a passage the reply reworded, or said how to reword.
- **The file:** `<excerpt/>`, or `<group>` and `<path>`, exactly as a
  file-edit trailer names it. One file per offer.
- **`<count>`:** optional, 1 to 99. It is for the chip's label only; no
  check depends on it.
- **It joins the one pass.** The tag joins `TRAILER_TAGS`, so
  `extractWorkshopReplyControls` strips it from display, streaming and
  retained history like the others, and redacts it in logs as
  `[edit offer removed]`.
- **It never earns a host line.** An offer says what the reply's prose
  holds. A reply with no prose has nothing to offer: its offers are dropped,
  and `workshopTrailersOnlyReplyLine` does not learn a new kind.
- **Dropped and counted,** each frame on its own, never shown:
  - malformed, unclosed, nested, misplaced or over `frameCharacters`;
  - an unknown kind, or a second frame of a kind;
  - a reply with no prose;
  - file edits off, when the reply is read;
  - the reply already carries a kept file-edit proposal (it proposed
    outright, so there is nothing left to offer);
  - the file did not resolve (D2);
  - the reply is not a host or guest persona's.
- **Taught only while file edits are on,** in
  `workshop-personas/reply-edit-offers.md`, beside the file-edit teaching:
  declare what the reply's prose really holds, never as an invitation, and
  never both a proposal and an offer.
- **Bounds** live in `PROMPT_BUDGETS.workshopEditOffers`, pinned to the
  prompt by a sync test:

  | Bound | Value |
  |---|---|
  | `offersPerReply` | 2 (one per kind) |
  | `frameCharacters` | 600 |
  | `count` | 1–99 |
  | `sourceReplyCharacters` | 48,000 (D4) |
  | `whyCharacters` | 200 (D5's "nothing to change" reason) |
  | `fixChangedCharacters` | 40 (D6) |

### D2. The offer is resolved once, to an identity

When the reply is read, each kept frame's file is resolved through the
file-edit staging port, by the rules of ADR 2026-11-05 D4, without a
baseline (no text is read; freshness belongs to the cards):
- `{group, path}` must name exactly one physical file;
- `<excerpt/>` is bound to the document the room's excerpt came from at
  that moment, and a later excerpt never retargets it;
- a manual excerpt, an ambiguous name or a file outside the catalog drops
  the offer.

The turn keeps `editOffers`, at most two:

```ts
interface WorkshopEditOffer {
  kind: 'fixes' | 'rewrites';
  target: { kind: 'file' | 'excerpt'; documentUri: string; relativePath: string };
  count?: number;
}
```

`documentUri` is host-written and never reaches the webview, as on a
proposal. The offer stores no state (D3).

### D3. Whether an offer was used is read from the thread

Three optional keys carry everything:

| Turn | Key | Holds |
|---|---|---|
| The persona's reply | `editOffers` | D2's list |
| The press's writer turn | `editOfferRequest` | `{ sourceTurnId, kind }` |
| The answer | `editOfferAnswer` | `{ sourceTurnId, kind, outcome, why? }` |

`outcome` is `proposed` or `none`. A failed or stopped run leaves no turns,
as any failed run does.

**The status of an offer is derived by the host** from the full ledger, by
one pure function (`workshopEditOfferStatus`):
- no answer turn names this turn and kind: **open**;
- a run for it is going: **asked**;
- the latest answer is `proposed`: **answered**, with that turn's id;
- the latest answer is `none`: **nothing to change**;
- D7's rule holds: **ask again**.

The webview receives it per offer in the turn's view, with the answer's
turn id and its proposal count, and never works it out. The answer may be
outside the webview's window; the host reads the whole ledger.

What this buys:
- **Rewind and Branch need no rule of their own.** A cut that removes an
  answer reopens its offer, because the answer is gone. A cut that removes
  the source reply removes its offers with it. A branch carries both or
  neither. Nothing is rolled back, because nothing was stored.
- **A reopened or imported session** shows the right chips from its turns
  alone.
- **The source is never in doubt.** The request and the answer both name
  the source turn's id and the kind, written by the host.

### D4. The press, and the hard instruction

**The route.** `WORKSHOP_EDIT_OFFER_ACTION` carries
`{ requestId, roomRevision, turnId, kind }` and nothing else. No text, no
path, no count.

**The host, before anything is awaited:**
1. takes the room's run lock, as any message does (a press during a run is
   refused with the reason; never queued);
2. finds the turn in the ledger, and its offer of that kind;
3. checks its derived status is open or ask-again;
4. checks file edits are still Ask first;
5. finds the reply's author, host or guest, still in the room. The press is
   addressed to that persona's own conversation, whoever the composer is
   pointed at.

A refusal answers `WORKSHOP_EDIT_OFFER_RESULT` with a reason from a closed
list, and adds no turn.

**The writer turn** is `editOfferRequest`, with host-worded content ("Asked
Jill to suggest the fixes from her reply as file edits."). That sentence is
what the transcript, recall and other participants' catch-up read.

**The directive** is a frame in that user message (frames go in the next
user message; retained history is never edited). It is built by one pure
function from the ledger's turn:

```
<prose-minion-edit-request kind="fixes">
The writer pressed "3 fixes" on your reply of 2:02 pm, quoted below. Suggest
those fixes as file edits now.

Reply with <prose-minion-file-edit> trailers and nothing else: no greeting,
no commentary, no other trailer. Edit only <excerpt/>, the file your reply
named. Read the file as it stands before you quote it.

Fixes only: the spelling, grammar and punctuation slips your reply named.
Each is a find-and-replace that changes a few characters. No rewording, no
appends, no rewrites, and nothing your reply did not name.

If the file already reads right, or you find nothing to change, reply with
exactly:
<prose-minion-no-file-edit><why>one line</why></prose-minion-no-file-edit>

<source-reply turn="t-41" at="2:02 pm">
…the reply, as the ledger holds it, neutralized…
</source-reply>
</prose-minion-edit-request>
```

- **The reply is always quoted,** from the ledger, with frame-breaking text
  neutralized as other quoted bodies are. The persona's own history may have
  been compacted, or the room reopened; the quote makes the source certain
  either way. A reply over `sourceReplyCharacters` gets no offers (D1).
- **For rewrites** the middle paragraph changes: the rewrites the reply
  proposed, as find-and-replace, each kept to its passage, under the prose
  rules the persona already knows.
- **The run is an ordinary persona run,** with its capabilities, so the
  persona can read the file. Its cost is one persona turn.
- **The room's usual frames ride along unchanged:** the to-do evidence,
  pending host updates, catch-up and the time notice are delivered as on
  any message to that persona. The press adds its directive and takes
  nothing away.

### D5. What the answer may be

The answer is read with every other trailer closed (memory, reactions, a
widget recommendation and edit offers are dropped and counted). Then:

| The reply holds | Outcome |
|---|---|
| One or more file-edit frames | `proposed`. Frames are staged as today. One for a file other than the offer's is refused on its card (`not-the-offered-file`). |
| Exactly `<prose-minion-no-file-edit>` | `none`, with its `<why>` (one line, at most `whyCharacters`) |
| Neither | One correction turn, then a failure |

- **The persona's prose is never shown or kept.** The bubble shows the
  host's line (U4). Retained history keeps the host's line too, as it does
  today for a reply of trailers alone. Stray prose is counted in the log,
  never logged.
- **The correction turn** uses a new, feature-agnostic engine seam:
  `AgentRunOptions.finalReplyCheck(content)` returns an instruction or
  nothing. The engine runs it on the final reply and spends the policy's
  existing `maxCorrectionTurns` on it, the way it does for a rejected
  capability request. The Workshop's check says: "Your reply held no
  file-edit trailer. Reply with file-edit trailers only, or with the
  no-file-edit frame."
- **After the correction fails,** the run is a failure: no turns are kept,
  the chip is Open again, and the writer reads "Jill didn't answer with
  edits. Try again, or ask in your own words."
- **All frames dropped as malformed** counts as neither.
- **An answer adds no next steps.** Its prose is dropped, so the
  actionable-findings reader is not run on it: an answer never carries
  "Add a next step" rows, and never changes the to-do list.

### D6. Fixes are held to a fix's size, by host code

A persona told "fixes only" may still rewrite. The model's obedience is not
the guard. An answer to a fixes offer stages its proposals with
`intent: 'fixes'`, and the gateway holds them to a stricter policy,
checked at staging and on every apply attempt:

| | Fixes | Rewrites |
|---|---|---|
| Operations | `find` / `replace-with` only | The file's class policy, unchanged |
| Changed characters per pair | At most `fixChangedCharacters` (40) on each side, measured as ADR 2026-11-05 D5 measures `replaced` | The class's rewrite ceiling |
| Line breaks | Never | The class's rule |
| Structure mode | `strict` | The class's mode |

A fixes card that breaks it is refused, in words that point the way: "This
is more than a small fix. Ask for it as a rewrite." It is data, in
`FILE_EDIT_INTENT_POLICIES`, beside the class policies. Rewrites take no
new rule: prose is already protected by its class.

**Why not Proofread's pass.** Proofread finds its own issues with its own
model. Run over the quoted passages, it would return *its* fixes, which may
not be the three the persona named, from a model that never saw the
conversation. Requirement 1 is "exactly those fixes", and only the persona
knows which those are. What is worth taking from Proofread is its
discipline, so D6 takes that: quotes not offsets, exactly-once anchoring,
no line breaks, strict structure, a size bound, and the one write door.
"Proofread this passage" remains its own command.

### D7. Asking again

An offer may be asked again only when a second answer cannot double
anything. That is when its latest answer is `none`, or is `proposed` and
every one of its cards is `declined`, `stale` or `refused`: nothing landed,
nothing is pending, nothing is unknown.

This is the path ADR 2026-11-05 D8 already tells the writer to take ("the
writer asks the persona again"), as a press. It matters most for the
two-press case: fixes and rewrites to the same sentence quote the same
text, so applying one card can leave the other stale.

### D8. Session, transcript and logs

- **Session codec.** Three optional keys on a turn (D3), and `intent` on a
  proposal. Development shapes go through
  `WorkshopSessionCheckpointNormalization`. The release decision is ADR
  2026-07-30's, at the epic's end.
- **One transcript projection** (`projectWorkshopTranscript`):
  - `editOffers`: omitted. They are controls, not content.
  - the request turn: included, as its host sentence;
  - the answer: its host line with the source reply's time, and its cards
    as ADR 2026-11-05 D10 shows them.
- **Recall** reads the same projection, so it needs no rule.
- **Logs** carry ids, kinds, counts and fault names. Never a path, a quote
  or the reply.

### D9. Guards that never depend on the model

These are code, tested without a model:
- the offer's bounds, kinds and one-per-kind rule (D1);
- the file's identity, resolved once and re-authorized at Apply (D2);
- the press carrying ids only, and its status check (D3, D4);
- the directive quoting the ledger's reply, never the webview's (D4);
- the answer's closed trailers, the offered-file check and the dropped
  prose (D5);
- the fixes policy (D6);
- everything ADR 2026-11-05 D13 lists, unchanged, for the cards.

## Addendum, 2026-11-10: what Slices 1 and 2 settled

Built and reviewed (PRs #251 and #252). Each item refines a decision above;
where they differ, this addendum holds.

- **D3, D7: `askAgain` rides on the status.** The five states stay. A
  `nothing-to-change` offer may always be asked again, and a `proposed` one
  when D7's rule holds. The host takes a press when the state is open or
  `askAgain` holds. Slice 3 draws it.
- **D4: an excerpt offer keeps its file** (PR #252 F-03). The directive names
  the offered file by its display path and says `<excerpt/>` means that file.
  The answer's excerpt target is staged against the offer's stored identity,
  whatever the room's excerpt is by then, in the catalog or not.
- **D5: a cut-off or interrupted answer is a failure** (F-01). The engine's
  check reads the reply before any display notice and is told when it is
  incomplete. No partial frame is salvaged; the reason is `cut-off`.
- **D5: rejected prose is not retained either** (F-02). After a successful
  correction turn, the rejected reply's retained copy is the host's line.
- **D5: nothing is retained until the answer is adopted** (R1). A press's run
  defers retention (`deferRetention`): the engine hands its owner the commit,
  and the host makes it only after the session has taken the answer turn. A
  press that fails, is stopped, is preempted by a newer message, or finds
  file edits turned off leaves the thread and the persona's history exactly
  as they were. A held commit never writes over a history that has moved.
- **D5: the correction budget is shared.** A run that spent its one
  correction turn on a rejected capability request has none for its final
  reply.
- **D1: `<prose-minion-no-file-edit>` is a trailer tag** like the others, so
  it is stripped from any reply.
- **U3, U4: host lines use no pronoun.** "Asked Jill to suggest the fixes
  from their reply as file edits." and "Suggested 3 fixes to …, from the
  2:02 pm reply." The mockups' "her" is not built.
- **D8: the request turn is an event in the transcript,** not a writer
  entry.
- **D1: an offer-only reply** reads as an empty reply does today. It takes
  Message Reactions' "Replied without a message." line when the two epics
  meet.

## Addendum, 2026-11-10 (second): alternative versions get a chip each

**From Okey's first live run.** Jill answered "give me an idea of what
you're thinking" with three written-out versions of one passage ("Version
1", "Version 2", "A third option"), and no chip was drawn. His words: "if
you're going to provide prose, then give options to apply it."

**What was wrong.** Two things, both in the design, not the code:
- **The teaching talked the persona out of declaring.** "Most replies
  declare nothing" and "never as an invitation" read as "when in doubt,
  don't". A probe of the same model with the shipped teaching and an *Alice*
  excerpt declared the typos and not the three versions.
- **"Rewrites" had no shape for alternatives.** One chip that applies "the
  rewrites" makes no sense when the reply offers three ways to write the
  same line and the writer would pick one.

**What changes.**

- **D1: a rewrites offer may name options.** Up to `optionsPerOffer` (4)
  `<option>` elements, each the short label the reply's prose gave that
  version, one line, at most `optionCharacters` (40). Options are for
  alternatives the writer chooses between. Rewrites that belong together
  stay one offer with no options. A fixes offer takes no options. A
  malformed, empty, duplicate or over-bound option drops the frame.

  ```xml
  <prose-minion-edit-offer>
    <kind>rewrites</kind>
    <excerpt/>
    <option>Version 1</option>
    <option>Version 2</option>
    <option>A third option</option>
  </prose-minion-edit-offer>
  ```
- **D1: declaring is the rule, not the exception.** The teaching now says:
  whenever a reply writes out replacement prose for a passage of a file, or
  names small fixes to it, declare it, because the writer has no other way
  to turn those words into an edit. It still declares only what the prose
  holds. With that wording and the options grammar, the same probe declared
  the three versions and the typos, twice out of two.
- **D1: a per-turn reminder.** While file edits are on and the room has a
  file to target, the persona's message carries a one-line
  `<workshop-edit-offer-reminder>` frame, as Message Reactions' invite
  does. It is never sent with a press. The system prompt alone was not
  enough for reactions, and this prompt is longer.
- **U2: one chip per option.** The footer reads "As edits", then the fixes
  chip, then a chip per option, labeled with the option's own words
  ("Version 1"). Each has the same five states. An offer without options
  keeps its one "N rewrites" chip.
- **D3, D4: an option is part of the press.** The press carries
  `{ requestId, roomRevision, turnId, kind, option? }`, the option by index.
  The request turn and the answer record it, and status is derived per
  option. Pressing one option does not use up the others.
- **D4: the directive names the chosen version.** "The writer chose
  'Version 1' from your reply. Suggest that version only, as file edits."
  The label is the host's stored copy, neutralized.
- **U3, U4: the lines name it.** "You asked Jill for an edit · Version 1,
  from that reply ↑" and "Suggested Version 1 as an edit to …".
- **D6 is unchanged.** An option is a rewrite and takes the file's class
  policy. *(Amended the same day: see "A requested rewrite lifts the
  ceiling" below.)*

**Not changed:** the host still never reads a reply's prose to decide what
to draw. The label on a chip is the persona's declared text, bounded and
shown as text, as a card's `<why>` is.

**A requested rewrite lifts the ceiling (Okey's second live run,
2026-11-10).** A press on a rewrites chip worked end to end, and the
answer's card was then refused at Apply: "This rewrites too much of the
passage: prose takes edits, not rewrites." The card replaced a bracketed
placeholder paragraph with written-out prose, which is what the writer
pressed the chip for. His words: "our limit on edits may be too small."

- **Confirmed by Okey (2026-11-10, PR #254 D1): option A, the ceiling is
  lifted entirely for a requested rewrite.** He chose it knowing the
  consequence the review probed: a find-and-replace that fits the trailer's
  bounds can replace the whole of a short prose file. "Never the whole
  file" is taught to the persona, not enforced by the host. What stands
  between that and the file is the writer: the card shows the full diff,
  Apply is theirs, the change is one undo step, and nothing is saved for
  them. A host-enforced passage bound and a higher ceiling were the
  alternatives, and were not taken.
- **Why the ceiling can go here.** ADR 2026-11-05 D5's rewrite ceiling
  keeps a persona from rewriting the writer's prose unasked. A requested
  rewrite is asked for: the writer pressed the chip, and reviews the diff on
  the card before anything is written.
- **D6 gains a row.** A card staged from a rewrites answer carries
  `intent: 'rewrites'`, and `FILE_EDIT_INTENT_POLICIES.rewrites` lifts the
  rewrite ceiling for it, on every apply attempt. That is all it lifts.
- **Everything else of the class policy holds:** quotes anchored exactly
  once, no `<rewrite>` of a prose file, the trailer's bounds, appends and
  prepends within `insertWords`, the `prose-paragraphs` structure mode,
  protected regions, freshness, the claim and checkpoint, and the
  offered-file check.
- **Unchanged:** an ordinary, unrequested proposal keeps the ceiling and its
  words. `fixes` is as it was.
- **The intent is the host's.** It is written from the pressed offer's kind,
  which the host reads from its own ledger. No trailer element and no route
  field carries it.
- **The teaching** says a pressed rewrite may replace the whole passage the
  reply reworded, as find-and-replace kept to that passage, never the file.
  It does not mention the ceiling.
- **A card saved before this** has no intent and keeps the ceiling.

## How this meets Message Reactions

Both epics edit `workshopReplyControls.ts` and `WorkshopTurnBubble.tsx`.
Reactions reaches `main` first.

- **The trailer.** Reactions adds its tag to `TRAILER_TAGS` and
  `REDACTIONS`; this epic adds one more entry to each. Because an offer
  never earns a host line (D1), `WorkshopTrailerKinds` and the host-line
  builder are not touched here.
- **The bubble.** Reactions ends the bubble with
  `<WorkshopTurnReactionCorner>`. This epic wraps that one element in the
  footer row and puts `<WorkshopTurnOffers>` before it. The corner's
  component, hook, focus rules and tests are not edited.
- **Order of work.** Slices 1 and 2 are host-only and touch no component.
  Slice 3, the bubble, starts only after Reactions is on `main` and merged
  into this epic.

## The questions as put (Okey took each recommendation, 2026-11-10)

1. **Is the footer row the right home?** Offers at the left of the
   reaction corner's row, with the widget chip moved in beside them (U1).
   *Recommended: yes.* The other homes all cost more: an overflow menu
   hides the count and adds a click; a strip under the reply adds a row; an
   "Apply…" button in the action row makes the busiest row busier.
2. **Simple fixes through the persona, held to D6's policy,** not through
   Proofread. *Recommended: yes* (D6).
3. **The answer shows no persona prose,** only the host's line and the
   cards, or a one-line reason when there is nothing to change (D5).
   *Recommended: yes.* It is the filed criterion, "never stray prose".
4. **The fix bound: 40 changed characters per replacement** (D6). Enough
   for a word or two; a reworded clause is refused toward a rewrite.
   *Recommended: 40, tuned in the live pass.*
5. **One press at a time, never queued** (U5). The second chip waits for
   the first answer. *Recommended: yes.* A queued press would run against a
   file the first answer's cards may be about to change.
6. **Should this epic also thin the action row?** Seven labeled buttons is
   the real crowd. A later slice could keep Copy and Bookmark and fold the
   rest into a "More" menu. *Recommended: not in this epic.* It changes
   controls four other features own and test. I'd file it as its own
   feature, with a mockup, once this one is live.
7. **Ask again** under D7's rule. *Recommended: yes.*
8. **No "both" press.** Fixes and rewrites are asked separately, because
   one card per file could not hold fixes to D6's bound and rewrites to the
   class's. *Recommended: yes.*

## Consequences

- **A press costs one persona turn,** and quotes the source reply into it.
- **The persona prompt grows** by the offer's teaching, only while file
  edits are on.
- **The engine gains one seam** (`finalReplyCheck`), feature-agnostic.
- **The widget chip moves.** Its markup and tests change with Slice 3.
- **A persona may declare wrongly.** Declaring fixes that are not there
  ends in "nothing to change". Not declaring ones that are leaves no chip,
  and the writer asks in words, as today. The host never reads prose to
  second-guess either.
- **Fixes and rewrites of one sentence can stale each other** (D7 is the
  way out).

## Alternatives considered

- **Draw buttons by reading the reply's prose.** Rejected by requirement 3:
  the renderer never guesses.
- **Carry the edits inside the declaration,** staged only on a press. No
  second run, and no doubt about the source. Rejected: every reply with a
  typo would pay for a file read and exact quotes, and Okey asked for the
  instructed run.
- **Store "used" on the offer.** Rejected: Rewind, Branch, reopen and
  import would each need a rule to keep it true. Deriving it needs none
  (D3).
- **Refer to the source reply by position** ("your reply two turns ago").
  Rejected: compaction and catch-up can remove it from the persona's
  history. The ledger's quote cannot go missing.
- **Send the press as a typed message in the composer.** Rejected: the
  writer could edit it, the source would be prose, and nothing would hold
  the answer to trailers.
- **A disabled chip for an offer that cannot work.** Rejected: clutter
  (U5).
- **Proofread for fixes.** Rejected in D6.
