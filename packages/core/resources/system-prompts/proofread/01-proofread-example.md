# Worked Example

The passage below adapts the opening of Lewis Carroll's *Alice's Adventures
in Wonderland* (1865, public domain), with errors added for this example. The
request named the document's narration as `{"tense": "past", "person":
"third"}` and no spelling convention.

## Passage

So she was considering in her own mind (as well as she cold, for hot day made her feel very sleepy and stupid), weather the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes runs close by her.

There was nothing so very remarkable in that; nor did Alice think it so very much out of the the way to hear the Rabbit speak say to itself, “Oh dear! Oh dear! I shall be late!” (when I thought it over afterwards, it occurred to her that she ought to have wondered at this).

## Response

```
===PROOFREAD_V1===
{"version":1,"issues":[
{"category":"wrong-word","original":"cold","before":"her own mind (as well as she","after":", for hot day made","replacement":"could","explanation":"“Cold” is a real word, but the sentence needs “could”."},
{"category":"missing-word","original":"for hot day","before":"as well as she cold,","after":"made her feel very","replacement":"for the hot day","explanation":"An article is missing before “hot day”."},
{"category":"homophone","original":"weather","before":"very sleepy and stupid),","after":"the pleasure of making","replacement":"whether","explanation":"“Weather” is the climate; the conjunction is “whether”."},
{"category":"tense","original":"runs","before":"White Rabbit with pink eyes","after":"close by her.","replacement":"ran","explanation":"The narration is in the past tense; “runs” slips into the present."},
{"category":"spelling","original":"the the","before":"so very much out of","after":"way to hear the","replacement":"the","explanation":"The word “the” is doubled."},
{"category":"extra-word","original":"speak say","before":"way to hear the Rabbit","after":"to itself,","replacement":"say","explanation":"“Speak” is left over beside “say”; the sentence needs one verb."},
{"category":"person","original":"I thought","before":"I shall be late!” (when","after":"it over afterwards,","replacement":"she thought","explanation":"The narration is in the third person; “I” slips into the first."}
]}
===END_PROOFREAD_V1===
```

Nothing else is reported. “Oh dear! Oh dear! I shall be late!” is dialogue, so
its “I” and its present and future tenses are not errors. “Sleepy and stupid”
is the author's wording, so it stands.
