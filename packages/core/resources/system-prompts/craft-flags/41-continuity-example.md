# Worked example: continuity

The passage below adapts the opening of Lewis Carroll's *Alice's Adventures
in Wonderland* (1865, public domain), with slips of continuity added for this
example. The request's `breaks` lists one line: `* * *`.

## Passage

Alice was beginning to get very tired of sitting by her sister on the bank, in the heat of the afternoon, and of having nothing to do. So she was considering in her own mind whether the pleasure of making a daisy-chain would be worth the trouble of getting up, when suddenly a White Rabbit with pink eyes ran close by her.

There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to hear the Rabbit say to itself, “Oh dear! Oh dear! I shall be late, and my red waistcoat all creased!” The Rabbit wore a fine blue waistcoat, and its pink eyes were bright with hurry.

Alice, still standing on the bank, watched it take a watch out of its waistcoat-pocket, and saw its blue eyes blink at the time.

* * *

In the cool of the evening, Alice sat by the well and wondered where the Rabbit had gone.

## Response

```
===CRAFT_FLAGS_V1===
{"version":1,"flags":[
{"original":"still standing on the bank","before":"Alice,","after":", watched it take a","kind":"place","why":"Alice sits by her sister on the bank, and later is still standing there, with no moment when she gets up.","earlier":{"original":"sitting by her sister on the bank","before":"very tired of","after":", in the heat of"},"holds":"neither"},
{"original":"blue eyes","before":"pocket, and saw its","after":"blink at the time.","kind":"body","why":"The Rabbit's eyes are pink as it runs by and blue when it checks its watch, with nothing between to change them.","earlier":{"original":"pink eyes","before":"a fine blue waistcoat, and its","after":"were bright with hurry."},"holds":"earlier"}
]}
===END_CRAFT_FLAGS_V1===
```

Nothing else is flagged. The Rabbit's “red waistcoat” is in its own speech,
so it is never set against the narration's blue one. The heat of the
afternoon and the cool of the evening stand on either side of the break, and
so do the bank and the well: time passes there, and the pair is not made.
The eyes are pink twice before they are blue once, so the rest of the
chapter keeps the earlier version.
