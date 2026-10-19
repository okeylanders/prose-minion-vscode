# Worked example: group B (characters, voice)

This example reads the opening of Lewis Carroll’s *Alice’s Adventures in Wonderland* (1865, public domain), cut to eight paragraphs, with every lens of the group requested. It shows the shape of one complete, valid response. It is not your chapter: read the chapter you are given, and never reuse these readings, quotes or numbers.

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

Read group B with these lenses, and only these: characters, voice.
Return one frame between ===LIGHTBOX_GROUP_B_V1=== and ===END_LIGHTBOX_GROUP_B_V1===. Its JSON has "version": 1 and exactly these lens keys: "characters", "voice".

--- end of example request ---

One complete, valid response:

===LIGHTBOX_GROUP_B_V1===
{"version":1,"characters":{"items":[{"name":"Alice","aliases":[],"archetype":"The Curious Drifter","energy":"Idle until something odd crosses her path, then all motion.","wants":"Something worth her attention: pictures, conversation, a rabbit with a watch.","hides":"Little; she says what she thinks, aloud or to herself.","claim":"Alice is reached through her thoughts: she complains, wonders and boasts to herself, and acts before she reasons about it.","evidence":[{"para":5,"quote":"never once considering how in the world she was to get out again"},{"para":8,"quote":"thought Alice to herself"}]},{"name":"White Rabbit","aliases":["Rabbit"],"archetype":"The Herald","energy":"Pure hurry, seen only from outside.","wants":"Not to be late.","hides":"Where it is going and why; the chapter does not say.","claim":"The Rabbit is all surface and schedule: it speaks once, checks its watch and vanishes, and its strangeness only registers with Alice afterwards.","evidence":[{"para":4,"quote":"TOOK A WATCH OUT OF ITS WAISTCOAT-POCKET"},{"para":4,"quote":"it occurred to her that she ought to have wondered at this"}]},{"name":"her sister","aliases":[],"archetype":"The Reader Elsewhere","energy":"Present only as a book Alice cannot share.","wants":"Not shown in this chapter.","hides":"Not shown in this chapter.","claim":"The sister is reading a book without pictures, and the chapter leaves her on the bank the moment the Rabbit runs by.","evidence":[{"para":2,"quote":"she had peeped into the book her sister was reading"}]}],"friction":"Eight paragraphs make a thin cast. The Rabbit’s “hides” reads what the chapter withholds rather than anything shown, and Alice’s “wants” leans on a single complaint in ¶2."},"voice":{"pov":"Third person, close on Alice, with a narrator who steps aside to comment.","tense":"Past.","distance":"Close, yet the narrator keeps an amused distance in its asides.","register":"Conversational and wry, with capitals for emphasis.","music":"Long sentences that run on through clauses, broken by short exclamations.","claim":"The narration stays with Alice but talks over her shoulder: parenthetical asides comment on what she says, and capitals do the shouting.","evidence":[{"para":8,"quote":"(Which was very likely true.)"},{"para":4,"quote":"There was nothing so VERY remarkable in that"}],"friction":"The asides make the narrator a presence of its own, so “close on Alice” may undersell it; and eight paragraphs leave the voice little room to change."}}
===END_LIGHTBOX_GROUP_B_V1===

The sister is unnamed, so her `name` is the phrase the chapter uses, and her `wants` and `hides` say plainly that the chapter does not show them. The Rabbit’s alias is a name the chapter uses, never a pronoun. The voice block gives no numbers: the host sets its measured sentence length beside `music`.
