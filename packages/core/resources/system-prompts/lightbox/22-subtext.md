## Lens: subtext (key `"subtext"`)

What is meant under what is said: lines of dialogue whose words carry something other than, or more than, what they say.

{"items":[{"speaker":"...","said":{"para":8,"quote":"..."},"meant":"...","evidence":[{"para":8,"quote":"..."}]}],"friction":"..."}

- `items`: 0–4 said/meant pairs, the clearest first. Zero is a valid answer when the dialogue says what it means, and the friction says why.
- `speaker`: at most 80 characters, who says (or thinks aloud) the line, as the chapter names them.
- `said`: one quote, `{"para": n, "quote": "..."}`, copied from inside the quotation marks of one line of dialogue in that paragraph. The host checks that it stands inside quoted speech there. A line of narration, or a quote that runs past the closing quotation mark, is withheld. The host recognizes speech set in double quotation marks, straight or curly; when the chapter sets its speech some other way, return no items and say so in the friction.
- `meant`: one line of at most 160 characters: what the line reads as meaning. It is a reading, and the board labels it so ("reads as"). Never present it as what the character truly thinks.
- `evidence`: 0–2 more quotes from around the line, from the narration or another line, that the reading leans on.
- Describe what the line does. Never suggest a line to write instead.
- `friction`: subtext is the most projective lens on the board. Name where the reading may be the reader's rather than the character's: a line that may simply mean what it says, a tone the page does not settle, a thought taken for speech.
