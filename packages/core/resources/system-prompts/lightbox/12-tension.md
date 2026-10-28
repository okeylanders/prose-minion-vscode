## Lens: tension arc (key `"tension"`)

How tension rises and falls across the chapter, column by column of the board's paragraph ribbon.

{"scores":[0,2,5],"claim":"...","peaks":[{"para":3,"quote":"...","note":"..."}],"friction":"..."}

- `scores`: exactly one whole number from 0 to 9 for each ribbon column, in column order. The task states how many columns there are and which paragraphs each covers. A column that covers several paragraphs takes the tension of its tensest paragraph.
- The scale belongs to this chapter: 0 is its slackest moment and 9 its tightest. Use the range where the chapter moves and stay flat where it does not. A score is a reading, not a measurement, and the board draws it as one.
- `claim`: at most 400 characters: the shape of the arc (where it climbs, where it peaks, where it lets go).
- `peaks`: 1–3 moments that carry the arc. Each is a quote with `para` and `quote` as in evidence, plus a `note` of at most 160 characters naming what happens there.
- `friction`: where a reader may feel the curve differently: a paragraph scored as tense that reads as calm, or the reverse.
