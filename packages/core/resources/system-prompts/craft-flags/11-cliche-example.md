# Worked example: cliché

The passage below adapts the opening of Lewis Carroll's *Alice's Adventures
in Wonderland* (1865, public domain), with clichés added for this example.

## Passage

So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her, and time stood still.

There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to hear the Rabbit say to itself, “Oh dear! Oh dear! I shall be late! I am as busy as a bee!” But when the Rabbit actually took a watch out of its waistcoat-pocket, a chill ran down her spine, and burning with curiosity, she ran across the field after it.

In another moment down went Alice after it, never once considering how in the world she was to get out again. Her heart was in her throat as she fell, and time stood still.

## Response

```
===CRAFT_FLAGS_V1===
{"version":1,"flags":[
{"original":"time stood still","before":"pink eyes ran close by her, and","after":". There was nothing","kind":"cliche","why":"A stopped clock stands in for the jolt of seeing the Rabbit, and the pink eyes already carry that jolt.","suggestion":"the sentence could end on the pink eyes, as she sees them"},
{"original":"a chill ran down her spine","before":"of its waistcoat-pocket,","after":", and burning with curiosity","kind":"cliche","why":"A borrowed shiver stands in for what the watch means to her: a rabbit with a pocket and an appointment.","suggestion":"the drowsy afternoon falling away from her all at once"},
{"original":"burning with curiosity","before":"a chill ran down her spine, and","after":", she ran across the","kind":"weighted","why":"A familiar phrase carries the turn from idling on the bank to pursuit.","suggestion":"the daisy-chain dropped in the grass behind her as she runs"},
{"original":"Her heart was in her throat","before":"to get out again.","after":"as she fell","kind":"cliche","why":"A stock fear stands in for a fall that, so far, is more curious than frightening.","suggestion":"her skirts lifting around her while the well goes on and on"},
{"original":"time stood still","before":"in her throat as she fell, and","after":"","kind":"cliche","why":"The stopped clock returns for the fall, where the slowness is the joke the scene could tell itself.","suggestion":"she falls so slowly that there is time to wonder what happens next"}
]}
===END_CRAFT_FLAGS_V1===
```

Nothing else is flagged. “I am as busy as a bee” is the Rabbit's own speech,
so it is left alone. “Out of the way”, “in another moment” and “how in the
world” are idioms that carry no image, and “Oh dear” is a stock phrase: each
is familiar, and none is a fault.
