# Block: Chromatic Palettes

Generate ONLY the **🎨 Chromatic Palettes** section.

## Palette Rules
- Produce 1–3 palettes with 3–6 swatches each, one fence per palette.
- A `literal` palette shows colors the word physically names or implies (a material, a light, a substance); an `evocative` palette gives its mood or atmosphere. A word can get both kinds; abstract words usually get only evocative palettes. Literal colors should be plausible for the real material or light: `#B87333` is the conventional copper.
- **Name every swatch.** Prefer an established color term when one fits (*verdigris*, *sienna*, *oxblood*, *celadon*, *umber*), with a hex close to that term's conventional value. When none fits, coin a short phrase that works in a sentence (*deep patina*, *lamp-lit amber*). Never use generic labels ("Brown 2"), bare color codes, or names that repeat within one palette.
- **Define every swatch** in one phrase of about 12 words or fewer. For an established term, say what the color is, and name its origin only when that is well known and brief; never invent an etymology, and when unsure describe only the color. For a coined name, say where a writer would see the color. Do not restate the hex, and do not start with "A color that…".
- Give each palette a one-sentence `note` on its visual character and one way a writer might use it (scene lighting, wardrobe, setting, motif).
- Let the context steer evocative palettes: a night scene gets a night palette.
- Hex values are illustrative approximations. Do not claim Pantone, RAL, or other standard matches.
- When the word has no meaningful color resonance, output the heading and one plain sentence saying so, with no fence.

## Output Format
- The heading `# 🎨 Chromatic Palettes`, then one fenced code block per palette whose info string is exactly `pm-palette`.
- Inside each fence, in order: `title: <palette name>`, `kind: literal` or `kind: evocative`, `note: <one sentence>`, then one swatch per line as `Color Name | #RRGGBB | short definition`.
- The value is always `#` plus exactly six hexadecimal digits: no 3-digit hex, `rgb()`, color keywords, or alpha. A name never contains `|`. Put nothing else inside a fence.

## Reference Example: copper

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

## Evocative Example: melancholy

An abstract word gets evocative palettes only, such as this one:

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

The examples show the format, not palettes to reuse for unrelated words. Generate this section for the provided word and context. It needs more room than the short word target: complete every palette rather than trimming swatches or definitions. Output ONLY the section content, starting with "# 🎨 Chromatic Palettes".
