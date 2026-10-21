# Worked example: group G (craft steering)

This example reads the opening of Lewis Carroll’s *Alice’s Adventures in Wonderland* (1865, public domain), cut to eight paragraphs. It shows the shape of one complete, valid response. It is not your chapter: read the chapter you are given, and never reuse these readings, quotes, nudges or examples.

The request (an excerpt, between the two rules):

--- example request ---

# The chapter

8 paragraphs, 508 words. Each paragraph begins with its host marker ⟦¶n⟧.

⟦¶1⟧ # Chapter I: Down the Rabbit-Hole

⟦¶2⟧ Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, “and what is the use of a book,” thought Alice “without pictures or conversation?”

⟦¶3⟧ So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.

⟦¶4⟧ There was nothing so VERY remarkable in that; nor did Alice think it so VERY much out of the way to hear the Rabbit say to itself, “Oh dear! Oh dear! I shall be late!” (when she thought it over afterwards, it occurred to her that she ought to have wondered at this, but at the time it all seemed quite natural); but when the Rabbit actually TOOK A WATCH OUT OF ITS WAISTCOAT-POCKET, and looked at it, and then hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen a rabbit with either a waistcoat-pocket, or a watch to take out of it, and burning with curiosity, she ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole under the hedge.

⟦¶5⟧ In another moment down went Alice after it, never once considering how in the world she was to get out again.

⟦¶6⟧ The rabbit-hole went straight on like a tunnel for some way, and then dipped suddenly down, so suddenly that Alice had not a moment to think about stopping herself before she found herself falling down a very deep well.

⟦¶7⟧ Either the well was very deep, or she fell very slowly, for she had plenty of time as she went down to look about her and to wonder what was going to happen next. First, she tried to look down and make out what she was coming to, but it was too dark to see anything; then she looked at the sides of the well, and noticed that they were filled with cupboards and book-shelves; here and there she saw maps and pictures hung upon pegs. She took down a jar from one of the shelves as she passed; it was labelled “ORANGE MARMALADE”, but to her great disappointment it was empty: she did not like to drop the jar for fear of killing somebody, so managed to put it into one of the cupboards as she fell past it.

⟦¶8⟧ “Well!” thought Alice to herself, “after such a fall as this, I shall think nothing of tumbling down stairs! How brave they’ll all think me at home! Why, I wouldn’t say anything about it, even if I fell off the top of the house!” (Which was very likely true.)

# Task

Read group G with these lenses, and only these: craft steering.
Return one frame between ===LIGHTBOX_GROUP_G_V1=== and ===END_LIGHTBOX_GROUP_G_V1===. Its JSON has "version": 1 and exactly these lens keys: "steering".
Read each of these figures by its id, whatever its rate. A quote counts only when it holds an instance exactly as described:
- `being-verbs`: an instance is one of these whole words: am, is, are, was, were, be, been, being; or one contracted: I'm, 're (you're, we're, they're), 's read as is (it's, she's, that's, there's), isn't, aren't, wasn't, weren't, ain't. 's as a possessive (the Rabbit's watch) or as has (he's been, she's got), let's, ain't before been or got, 'd, 'll and 've, a form joined to an underscore (_was_) and a linking verb (seem, become, look, feel, appear) are not instances.
- `adverbs`: an instance is a whole word ending in -ly (the detector counts every one, "only" and "family" too).
- `intensifiers`: an instance is one of these whole words: just, really, very, quite, rather, somewhat, somehow, actually, basically, literally.

--- end of example request ---

One complete, valid response:

===LIGHTBOX_GROUP_G_V1===
{"version":1,"steering":{"figures":[{"stat":"being-verbs","claim":"Being verbs carry Alice’s states and the narrator’s set-ups: she is tired, considering, coming to; the well is deep and dark. The progressives keep her mind moving while she sits, and the jar’s label and emptiness arrive as states, not acts.","evidence":[{"para":2,"quote":"Alice was beginning to get very tired"},{"para":7,"quote":"Either the well was very deep"}],"notes":[{"para":3,"quote":"So she was considering in her own mind","stance":"earns","why":"The progressive keeps her idle thinking going while nothing happens, which is the scene’s whole point.","nudge":null,"example":null},{"para":7,"quote":"it was too dark to see anything","stance":"leans","why":"A state stands where the fall could act: the darkness is reported rather than met.","nudge":"An action that lets the dark do something may be worth a look, so the state becomes an event.","example":{"before":"it was too dark","after":"the dark swallowed everything"}}]},{"stat":"adverbs","claim":"The -ly words gather at the fall and just before it: suddenly twice in one breath, slowly set against deep. They carry speed and manner where the verbs are plain, and the narrator’s likely is a dry hedge on Alice’s boast.","evidence":[{"para":6,"quote":"dipped suddenly down, so suddenly that"},{"para":7,"quote":"or she fell very slowly"}],"notes":[{"para":6,"quote":"and then dipped suddenly down","stance":"leans","why":"The speed sits in the adverb, and the verb beside it is plain.","nudge":"A verb that holds the drop itself may be worth a look, so the speed lives in the action.","example":{"before":"dipped suddenly down","after":"plunged"}},{"para":7,"quote":"or she fell very slowly","stance":"earns","why":"Slowly answers deep in the either-or: the adverb is the joke’s hinge, and the sentence turns on it.","nudge":null,"example":null}]},{"stat":"intensifiers","claim":"Very does most of the swelling here: very tired, very sleepy, a very deep well. In the capitals of ¶4 it becomes the narrator’s mockery; elsewhere it lifts plain words that carry the afternoon’s drowsiness.","evidence":[{"para":4,"quote":"There was nothing so VERY remarkable in that"},{"para":3,"quote":"made her feel very sleepy and stupid"}],"notes":[{"para":4,"quote":"There was nothing so VERY remarkable in that","stance":"earns","why":"The capitals mock how calmly she takes a talking rabbit: the intensifier is the joke.","nudge":null,"example":null},{"para":6,"quote":"falling down a very deep well","stance":"compensates","why":"Very lifts a plain size word at the moment the fall begins.","nudge":"A word for depth that needs no lift may be worth a look, so the well itself feels endless.","example":{"before":"a very deep well","after":"a bottomless well"}},{"para":2,"quote":"get very tired of sitting by her sister","stance":"leans","why":"Very tired names her boredom where the peeping at the book already shows it.","nudge":"Letting the book without pictures carry the boredom on its own may be worth a look.","example":null}]}],"friction":"The detector counts every -ly word, and likely in ¶8 is a hedge as much as an adverb; and a child’s report of her own state may be voice rather than habit, so leans and earns are close calls here."}}
===END_LIGHTBOX_GROUP_G_V1===

Each figure has one reading of how it works here and a few notes, and every quote holds an instance exactly as the task describes one. A note that earns its place has no nudge and no example. A note that leans or compensates names the craft move as worth a look, never as an order, and at most one example shows one way it could go: its first part is copied from the note’s own quote and holds the instance, and its second part is a few words, offered as an illustration, never as the writer’s text. No field states a count, holds quotation marks, or uses a word this lens never uses.
