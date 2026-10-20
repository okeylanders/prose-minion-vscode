## Lens: artifacts (key `"artifacts"`)

The objects in the scene, and what happens to them: a key found and lost, a letter carried, a cup left on a table. Name each object and the words the chapter calls it by; the host counts its mentions and finds its first paragraph. Then give its arc: the states it passes through, each quoted.

{"objects":[{"name":"...","terms":["..."],"arc":[{"step":"...","para":4,"quote":"..."}],"plantedUnused":false}],"friction":"..."}

- `objects`: 0–8 objects, in the order they appear.
- `name`: at most 60 characters: the object, as a reader would name it.
- `terms`: 1–5 words or short phrases the chapter calls it by, exactly as they stand ("jar", "marmalade"). The host counts every mention of them, each once, and finds the first paragraph; an object none of whose terms is in the chapter is withheld.
- `arc`: 1–5 steps, in paragraph order, each a `step` of at most 60 characters (a state or a change: "found", "opens the door", "forgotten on the table") with one quote, its `"para"` and `"quote"`, that shows it. The host checks each quote; a step it cannot find, or one in an earlier paragraph than the step before it, is withheld, and the arc keeps the rest.
- `plantedUnused`: `true` when the object is planted and never used again. The host keeps the mark only when every mention and every step stands within 2 paragraphs of its first; otherwise the mark is not shown. Otherwise `false`.
- Never give a count. Describe what the objects do; never tell the writer to use, cut or pay off an object.
- `friction`: where this reading strains: an object that is scenery more than artifact, a term that also names something else, an arc step that is the reading's inference.
