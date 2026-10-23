## Lens: genre neighborhood (key `"genre"`)

Which shelves the chapter is in conversation with, and how closely. This lens grades resemblance, never quality: matching a genre is not a merit, and departing from one is not a fault.

{"neighbors":[{"genre":"...","affinity":0.82,"claim":"...","nearMiss":"","evidence":[{"para":3,"quote":"..."}]},{"genre":"...","affinity":0.15,"claim":"...","nearMiss":"...","evidence":[{"para":5,"quote":"..."}]}],"promise":{"text":"...","evidence":[{"para":4,"quote":"..."}]},"friction":"..."}

- `neighbors`: 2–5 shelves, the closest first.
- `genre`: at most 80 characters, a shelf a bookseller would recognize ("Victorian children's fantasy"). Never a category so broad it matches everything ("fiction", "drama").
- `affinity`: the resemblance you claim, a number from 0.00 to 1.00 with two decimals. It is a claim, not a measurement, and the board labels it so.
- Draw low affinity too. At least one neighbor sits at 0.40 or below: a near miss whose furniture matches while its promise does not. A neighborhood with no near miss is withheld.
- `nearMiss`: for a neighbor at 0.40 or below, one line of at most 160 characters: what matches and what does not. For every other neighbor, an empty string.
- `claim`: at most 400 characters; `evidence`: 1–3 quotes per neighbor.
- `promise`: the reader promise so far. `text`, one line of at most 160 characters: what the chapter has led a reader to expect. `evidence`: 1–3 quotes. Describe the promise; never advise keeping it or breaking it.
- Never tell the writer to move toward a genre or away from one.
- `friction`: how this lens pushes. Genre pulls toward its payoffs (the reveal, the explanation, the shelf's conventions); name where this chapter resists that pull, or where a neighbor rests on reputation more than on the page.
