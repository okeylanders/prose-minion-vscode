# Dictionary Utility — Chromatic Palettes Required for This Lookup

The writer has ENABLED Chromatic Palettes for this lookup. It is a required part of this response. Write **🎨 Chromatic Palettes** after **🧠 AI Advisory Notes**. When the Topic & Related Lexicon encyclopedia section is also enabled, that section stays last and follows Chromatic Palettes.

Use the heading `# 🎨 Chromatic Palettes`. The response is incomplete if it omits this section.

## Palette Grammar
Each palette is its own fenced code block whose info string is exactly `pm-palette`. Inside the fence:

- Header lines come first, one per line: `title: <palette name>`, then `kind: literal` or `kind: evocative`, then `note: <one sentence>`.
- Swatch lines follow, one per line: `Color Name | #RRGGBB | short definition`. The name comes first, the hex value second, and the definition last.
- The value is `#` followed by exactly six hexadecimal digits. Never use 3-digit hex, `rgb()`, color keywords, alpha, or a trailing `;`.
- A name never contains `|`. Put nothing else inside the fence: no bullets, numbering, unnamed swatches, or commentary.

## Chromatic Palettes Guidance
- Produce 1–3 palettes with 3–6 swatches each, one fence per palette.
- A palette is `literal` when it shows colors the word physically names or implies (a material, a light, a substance) and `evocative` when it gives the word's mood or atmosphere. A word can get both kinds; abstract words usually get only evocative palettes. For a concrete word, add an evocative palette when it gives the writer something the literal palettes do not.
- Literal colors should be plausible for the real material or light. For example, `#B87333` is the conventional copper.
- **Name every swatch.** This is a writer's dictionary: the color names are the vocabulary, and the hex values only back them up. Prefer an established color term when one fits (*verdigris*, *sienna*, *oxblood*, *celadon*, *umber*), since those teach real color vocabulary. When none fits, coin a short descriptive phrase that works in a sentence (*deep patina*, *lamp-lit amber*). Never use generic labels ("Brown 2", "Light Copper 3"), bare color codes, or names that repeat within one palette.
- When a swatch uses an established term, keep its hex close to that term's conventional value, so the name and the chip agree.
- **Define every swatch** in one short phrase of about 12 words or fewer, after the second `|`. The definition explains the name, not the hex.
  - Established terms: say what the color is, and name its source or origin when that is well known and brief (a pigment, a material, a place, a language). Do not invent etymologies or origin stories. When unsure where a name comes from, describe only the color's appearance and referent.
  - Coined names: say where a writer would see the color (a surface, a light, a moment), so the phrase works as prose material.
  - Do not restate the hex or rgb value, and do not start with "A color that…". Go straight to the image.
- Give each palette a one-sentence `note` on its visual character and one way a writer might use it (scene lighting, wardrobe, setting, motif).
- Let the context excerpt steer evocative palettes. A night scene gets a night palette.
- Treat hex values as illustrative approximations. Do not claim Pantone, RAL, or other standard matches.
- When the word has no meaningful color resonance (*although*, for example), write the heading and one plain sentence saying so, with no fence.
- Each palette's `note` carries its commentary; the section needs no prose between or after the fences.

## Chromatic Palettes Reference Example: copper

This example demonstrates the section only. Adapt the palettes to the requested word and context.

# 🎨 Chromatic Palettes

```pm-palette
title: Warm Copper
kind: literal
note: Polished, metallic warmth (new pennies, sunlit pans, a lamp-lit forge).
Copper | #B87333 | the reddish-orange of the bare metal, freshly polished
Bronze | #CD7F32 | the warmer, yellower brown of copper alloyed with tin
Sienna | #A0522D | a reddish-brown earth pigment named for Siena, Italy
Fawn | #E5AA70 | the light yellowish tan of a young deer's coat
Desert Sand | #EDC9AF | a pale pinkish beige, like dunes in low sun
```

```pm-palette
title: Aged Copper & Patina
kind: literal
note: Oxidation and weathering; roofs, statues, and old pipes after decades of rain.
Russet | #80461B | a reddish brown, named for a coarse homespun cloth
Deep Patina | #577E73 | the dark gray-green that settles in the folds of an old copper roof
Verdigris | #43B3AE | the blue-green crust that forms on weathered copper, brass, and bronze
Weathered Bronze | #C0A47D | the dulled, sandy brown of bronze left out in the rain
Ecru | #C2B280 | the grayish-yellow of unbleached linen; French for "raw"
```

## Evocative Palette Example: melancholy

An abstract word gets evocative palettes only. One palette from a *melancholy* entry:

```pm-palette
title: Rain on Slate
kind: evocative
note: Cool, muted grays around one deep blue; light a rain-dimmed room or dress a mourner.
Slate Gray | #708090 | the cool blue-gray of split slate
Payne's Gray | #536878 | a dark blue-gray paint named for watercolorist William Payne
Prussian Blue | #003153 | a deep blue pigment named for Prussia, where it was first made
Ash Gray | #B2BEB5 | the pale, cool gray of cold wood ash
Faded Lamplight | #C9B79C | the tired beige of a lampshade left on through a gray afternoon
```
