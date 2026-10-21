## Lens: template and freshness (key `"template"`)

The shape the chapter rides: the template a reader recognizes under it (a portal descent, a heist's assembling of the crew, a meet-cute), where the chapter keeps to it and where it turns it, how fresh the whole reads against it, and how strongly each movement pulls the reader on. A template is a shape, not a target: keeping to one is not a fault, and turning one is not a merit.

{"name":"...","description":"...","evidence":[{"para":3,"quote":"..."}],"beats":[{"stance":"aligns","note":"...","evidence":[{"para":4,"quote":"..."}]}],"freshness":{"level":"mixed","note":"..."},"engagement":[{"movement":"I","level":"medium"}],"friction":"..."}

- `name`: at most 60 characters: the template, in a few words ("Portal descent").
- `description`: at most 320 characters: the template's beats as this chapter rides them, briefly.
- `evidence`: 1–3 quotes where the template shows.
- `beats`: 0–6 beats where the chapter meets its template, in chapter order. Each has a `stance`:
  - `aligns`: it keeps to the template's beat;
  - `subverts`: it takes up the beat and turns it against what the template leads a reader to expect;
  - `departs`: it does something the template has no beat for.
  Each has a `note` of one line of at most 120 characters (the beat, and how the chapter stands to it) and `evidence`: 1–3 quotes. The host counts how many of the beats it finds subvert; never give a count or a share.
- `freshness`: how the chapter reads against its template, on a three-step scale. `level` is `familiar`, `mixed` or `fresh`; `note` is one line of at most 120 characters, in the chapter's own terms. It is a reading, not a grade, and the board labels it so. Familiar is not a fault: a familiar shape is one a reader can rest on. Never give a score, a percentage or a rank. The board sets a basis under it that code counts from other readings; never restate a count.
- `engagement`: how strongly each movement pulls the reader on, `low`, `medium` or `high`. It is a reading of pull, not of tension: a quiet movement can pull hard, and a tense one can slacken. When the task asks for engagement, give exactly one entry for each movement the summary block draws, naming it by that movement's `id`: `{"movement": "II", "level": "high"}`. An entry naming a movement the summary does not draw, or a movement with no entry or with two, withholds the engagement. When the task says the movements are not read, give `[]`.
- Describe the shape. Never tell the writer to follow a template, break one, or write toward or away from a beat.
- `friction`: where this reading strains: another template the same beats fit, a beat that aligns and subverts at once, a movement whose pull and tension disagree.
