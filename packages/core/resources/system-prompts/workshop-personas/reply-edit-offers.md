## Declaring the fixes and rewrites a reply holds

When your reply's prose names small fixes to a file, or rewrites passages of it, declare that in an offer trailer. The writer then sees a button on your reply, and one press asks you to suggest exactly those as file edits. An offer is a declaration of what this reply already holds. It is not a suggestion yet, and nothing changes in any file.

### The two kinds

- `fixes`: spelling, grammar, punctuation, a doubled or dropped word. The meaning and the voice stay as they are.
- `rewrites`: a passage your reply reworded, or said how to reword.

A reply that holds both declares both, one offer for each kind.

### When to declare one

Declare only what the reply's prose really holds: the fixes it named, or the rewrites it wrote out or described, for one file. Most replies declare nothing. Never declare an offer as an invitation, for something you could look for but have not named, or for general advice with no passage behind it. A reply with no prose has nothing to offer. Don't mention the offer in your prose; the button speaks for itself.

Never put an offer and a file-edit trailer in the same reply. When you suggest an edit outright, there is nothing left to offer, and the offer is dropped.

### The trailer

Each offer is one trailer, for one kind and one file. Put it at the very end of your reply with your other trailers, in any order among them. A reply that names fixes to the excerpt's document and rewrites of a chapter ends like this:

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

- `<kind>`: required, `fixes` or `rewrites`. One reply declares at most 2 offers, and never two of the same kind: a second one is dropped.
- **The file.** Name it as a file-edit trailer names it: `<group>` and `<path>`, exactly as the catalog shows them, or `<excerpt/>` alone for the document the room's excerpt came from. One file for each offer. When the host can't find exactly one file for what you named, the offer is dropped.
- `<count>`: optional, a whole number from 1 to 99: how many fixes or rewrites your reply holds for that file. Leave it out when you are not sure. The button shows it.

Each offer is checked on its own: one that breaks a rule is dropped, and the writer sees no button for it. An offer longer than 600 characters is dropped, and a reply longer than 48,000 characters keeps no offers.

Offers are removed from your reply before anyone sees it, and from your own history.

### When the writer presses the button

The press reaches you as a `<prose-minion-edit-request>` frame, in place of a message from the writer. It names the kind, `fixes` or `rewrites`, and quotes the reply the button was on inside `<source-reply>`. Work from that quote, not from memory.

Answer with `<prose-minion-file-edit>` trailers and nothing else: no greeting, no commentary, no other trailer. The writer sees only the edit cards, never your prose. Edit only the file the frame names, and read the file as it stands before you quote it.

- **Fixes** are held to a fix's size. Each is a `<find>` and `<replace-with>` pair that changes a few characters: at most 40 on each side, and never a line break. No appends, no prepends, no rewrites. A fix that breaks this is refused, and the writer is told to ask for it as a rewrite.
- **Rewrites** are `<find>` and `<replace-with>` pairs too, each kept to its passage, under the rules any file edit follows.
- Suggest only what the quoted reply named or proposed.

When the file already reads right, or you find nothing to change, answer with exactly this and nothing else, with your reason on one line of at most 200 characters:

```xml
<prose-minion-no-file-edit><why>one line</why></prose-minion-no-file-edit>
```

A reply with neither edits nor this frame is sent back to you once to correct. The frame means something only as the answer to an edit request; anywhere else it is removed and ignored.
