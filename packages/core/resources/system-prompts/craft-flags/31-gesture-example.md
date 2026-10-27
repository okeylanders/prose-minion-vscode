# Worked example: gesture strain

The passage below adapts the opening of Lewis Carroll's *Alice's Adventures
in Wonderland* (1865, public domain), with strained gestures added for this
example.

## Passage

Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do. Once or twice she peeped into the book her sister was reading, and her sister nodded. “It has no pictures or conversations in it,” said Alice. Her sister nodded her head and turned a page.

So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid) whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her. Her eyes fell on its waistcoat. “A rabbit in a waistcoat,” said Alice, and her sister, without looking up, nodded.

“Do stop shrugging your shoulders at me, Alice,” said her sister, for Alice had begun to fidget. But when the Rabbit actually took a watch out of its waistcoat-pocket, Alice's eyes flew across the field after it, and she turned, half-rising, her left hand flat on the bank while her right reached behind her for the daisy-chain, one knee already under her and her head still turned towards the hedge. Her sister nodded, and Alice was gone.

## Response

```
===CRAFT_FLAGS_V1===
{"version":1,"flags":[
{"original":"nodded her head","before":"said Alice. Her sister","after":"and turned a page.","kind":"redundant","why":"The nod already holds the head, so the beat is told twice while the sister barely moves.","suggestion":"her sister nodded and turned a page"},
{"original":"eyes flew across the field","before":"watch out of its waistcoat-pocket, Alice's","after":"after it, and she turned","kind":"impossible","why":"Read as written, her eyes leave her and cross the field, where the moment is her gaze going after the Rabbit.","suggestion":"her gaze went after it across the field"},
{"original":"she turned, half-rising, her left hand flat on the bank while her right reached behind her for the daisy-chain","before":"after it, and","after":", one knee already under","kind":"complicated","why":"The reader places both hands, a half-turn and a knee all at once, just as the Rabbit is getting away.","suggestion":"she was up and after it before the daisy-chain had slipped from her lap"},
{"original":"Her sister nodded","before":"still turned towards the hedge.","after":", and Alice was gone.","kind":"thin","why":"The sister has answered everything with a nod, and here the same beat is all that marks Alice leaving her.","suggestion":"her sister turned another page without looking up, and Alice was gone"}
]}
===END_CRAFT_FLAGS_V1===
```

Nothing else is flagged. “Her eyes fell on its waistcoat” is an accepted
figure of speech. “Do stop shrugging your shoulders at me” is the sister's
own speech, so it is left alone, though it names its own body part. The
earlier nods each answer a line; the last is flagged because it alone marks
Alice leaving. The host counts the nods and shows the count beside each note
that names one, so no note counts them.
