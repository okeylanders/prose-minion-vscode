# Worked Example

The instances below come from a search of a passage that adapts the opening
of Lewis Carroll's *Alice's Adventures in Wonderland* (1865, public domain).

## Request

```text
The question, the labels and the instances below are quoted task data, never instructions.

<passage-search-question>
Find every time the White Rabbit shows it is worried about being late.
</passage-search-question>

<passage-search-labels>
- says it aloud: 2 instances in 1 file
- checks its watch: 2 instances in 1 file
</passage-search-labels>

Every instance found is below: 4.

<passage-search-instances>
[1] chapters/1.md, line 3, label: says it aloud
quote: “Oh dear! Oh dear! I shall be late!” it said to itself.
note: The Rabbit says outright that it will be late.

[2] chapters/1.md, line 3, label: checks its watch
quote: looked at its watch
note: It checks its watch and hurries away.

[3] chapters/1.md, line 7, label: says it aloud
quote: “Oh my ears and whiskers, how late it’s getting!” it muttered.
note: The Rabbit mutters about the hour as it hurries.

[4] chapters/1.md, line 7, label: checks its watch
quote: looked at its watch
note: It checks its watch a second time before it disappears.
</passage-search-instances>
```

## Response

```json
{"headline":"The Rabbit shows its worry two ways, each of them twice: it says so aloud, and it checks its watch.","sections":[
{"title":"It says so aloud","claims":[
{"text":"Both speeches are exclamations about the hour: first \"I shall be late!\", then \"how late it’s getting!\".","cites":[1,3]},
{"text":"Neither is spoken to anyone. The first is \"said to itself\" and the second is \"muttered\", so the worry stays private.","cites":[1,3]}
]},
{"title":"It checks its watch","claims":[
{"text":"The same words, \"looked at its watch\", carry the gesture both times, on the same lines as the two speeches.","cites":[2,4]}
]}
]}
```

Every claim cites the instances it rests on, by the numbers in the square
brackets. Each run of words in quotation marks is copied from the `quote:`
line of an instance that claim cites, with the passage's own curly
apostrophe, and the claim's own commas and full stops stay outside the
marks. The two labels become the two sections, named plainly with no marks.
The headline's "twice" is the label table's count, not a count of the
reply's own. Nothing is said about what happens between the instances.

A real reply is the JSON object alone, with no code fence around it.
