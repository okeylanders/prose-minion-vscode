# Worked example: register shift

The passage below adapts the opening of Lewis Carroll's *Alice's Adventures
in Wonderland* (1865, public domain), with shifts of register added for this
example.

## Passage

Alice was beginning to get very tired of sitting by her sister on the bank, that golden afternoon in the summer of 1862, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, “and what is the use of a book,” thought Alice, “without pictures or conversations?”

So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, while the afternoon lay upon the meadow like molten gold poured from the chalice of a forgotten god. Then suddenly a White Rabbit with pink eyes ran close by her.

There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to hear the Rabbit say to itself, “Oh dear! Oh dear! I shall be late! This is so not okay!” But when the Rabbit actually took a watch out of its waistcoat-pocket, Alice resolved to leverage the situation, and deciding that it was probably okay, she ran across the field after it on autopilot.

## Response

```
===CRAFT_FLAGS_V1===
{"version":1,"register":"A wry, formal Victorian English of the 1860s, plain and unhurried, close on Alice.","flags":[
{"original":"lay upon the meadow like molten gold poured from the chalice of a forgotten god","before":"the daisies, while the afternoon","after":". Then suddenly a White","kind":"ornate","why":"A sudden heightened image in a narration that keeps its descriptions plain and wry.","suggestion":"the meadow simply hot and still, as the afternoon has been all along"},
{"original":"leverage the situation","before":"waistcoat-pocket, Alice resolved to","after":", and deciding that it","kind":"jargon","why":"A boardroom phrase in a narration that keeps a child's afternoon in plain, older words.","suggestion":"Alice made up her mind to follow it"},
{"original":"okay","before":"deciding that it was probably","after":", she ran across the","kind":"slang","why":"A casual American word in a narration that keeps an older, formal English.","suggestion":"that it could do no great harm"},
{"original":"on autopilot","before":"ran across the field after it","after":".","kind":"period","why":"A word from the aviation of a later century, in a narration set in the summer it names.","suggestion":"without a thought for where it might lead"}
]}
===END_CRAFT_FLAGS_V1===
```

Nothing else is flagged. “This is so not okay!” is the Rabbit's own speech,
so it is left alone. The narration's “okay” is old enough for the summer it
names, so it is a casual word in formal narration, `slang`, not a word out
of its period. “On autopilot” comes from the aviation of a later century, so
`period` says what it brings. “What is the use of a book” is Alice's own
thought, marked as hers. “Very sleepy and stupid” is the narration's own
plain idiom, part of the register it keeps.
