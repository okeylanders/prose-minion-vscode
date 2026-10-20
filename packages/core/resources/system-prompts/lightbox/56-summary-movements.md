## Lens: summary and movements (key `"summary"`)

The chapter in a few sentences, and the movements it falls into: the runs of paragraphs that each do one thing before the chapter turns to the next. Movements are a reading. The board shows the chapter's own headings and scene breaks separately, found by code; a movement may cross one or sit inside one.

{"synopsis":{"text":"...","evidence":[{"para":3,"quote":"..."},{"para":6,"quote":"..."}]},"movements":[{"id":"I","title":"...","from":1,"to":3,"gist":"...","boundary":{"para":1,"quote":"..."}}],"friction":"..."}

- `synopsis`: what happens, plainly. `text` is at most 320 characters and at most 4 sentences; `evidence` is 2–3 quotes from different moments, and at least 2 must be found, or the synopsis is withheld. Never evaluate the chapter in it.
- `movements`: 1–8 movements, in order, that together cover every paragraph exactly once: the first starts at ¶1, each starts the paragraph after the one before it ends, and the last ends at the final paragraph. The task states the paragraphs to cover.
  - `id`: a short key of 1 to 12 letters, digits or hyphens ("I", "II", "m3"), different for each movement. Engagement in the template block names a movement by it; the board numbers the movements itself.
  - `title`: at most 60 characters.
  - `from` and `to`: its first and last paragraph numbers.
  - `gist`: one line of at most 120 characters: what the movement does.
  - `boundary`: one quote from its first paragraph, the one numbered `from`, where it opens.
  The host checks each boundary in its movement's first paragraph and checks that the movements tile the chapter, with no gap and no overlap. If any of that fails, every movement is withheld, so draw the ranges with care.
- `friction`: where this reading strains: a boundary that could fall a paragraph earlier or later, a movement that is two movements, a turn inside a paragraph.
