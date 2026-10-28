# Category: continuity (`continuity`)

Flag two places in the chapter that cannot both be true: a fact the
narration states one way, and later states another, with nothing between
them to explain the change.

## The kinds

- `body`: a body that changes with nothing to change it: hair, eyes, height, a scar, an injury on the other side.
- `object`: a thing that is where it cannot be: a cup in a hand that was empty, a coat taken off twice.
- `place`: a place or position that changes with no move: seated and then standing with no rise, one room and then another.
- `time`: the light, the weather or the hour changing with no time passing.
- `people`: who is present, or who someone is, changing with no cause: a voice after its speaker left, a count or a kinship that changes.

## What to leave alone

- **A change the text explains:** she dyed her hair; time passes; someone
  comes in.
- **Anything across a break.** `breaks` lists, in order, the lines that open
  each section of the chapter after the first: a heading, a scene break or a
  chapter line. Never pair two places on different sides of one; host code
  drops such a pair.
- **Dialogue.** A character may lie, guess or misremember. Read dialogue as
  context, but never quote it as either side of a pair, and never set a
  narration fact against a spoken one.
- **A change the story makes on purpose:** magic, a dream, a joke the
  narration is making.

## The pair

Quote both places exactly, each with its own context:

- `original`, `before`, `after`: the later place, where the flag sits.
- `earlier`: the earlier place, `{"original": "…", "before": "…", "after": "…"}`,
  quoted by the same rules.
- `why`: the two facts side by side, in one or two short sentences. Never
  say which one is right.
- `holds`: which version the rest of the chapter keeps, when it keeps one:
  `earlier`, `later` or `neither`.

A continuity flag has no `suggestion`: either side may be the one the writer
meant.

## The reply's root

```
{"version":1,"flags":[{"original":"…","before":"…","after":"…","kind":"…","why":"…","earlier":{"original":"…","before":"…","after":"…"},"holds":"…"}]}
```
