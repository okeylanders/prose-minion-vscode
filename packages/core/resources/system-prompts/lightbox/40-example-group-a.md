# Worked example: group A (headline, motifs, tension arc)

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

Read group A with these lenses, and only these: headline, motifs, tension arc.
Return one frame between ===LIGHTBOX_GROUP_A_V1=== and ===END_LIGHTBOX_GROUP_A_V1===. Its JSON has "version": 1 and exactly these lens keys: "headline", "motifs", "tension".
The tension arc scores 8 ribbon columns, one per paragraph: column n is ¶n.

--- end of example request ---

One complete, valid response:

===LIGHTBOX_GROUP_A_V1===
{"version":1,"headline":{"sentence":"A bored girl follows a hurried white rabbit down a hole and keeps on falling.","terms":["rabbit","rabbit-hole","fall"],"evidence":[{"para":4,"quote":"burning with curiosity, she ran across the field after it"},{"para":6,"quote":"she found herself falling down a very deep well"}],"friction":"The sentence makes boredom the engine, but ¶4 turns on curiosity, and ¶7 is leisurely enough that “keeps on falling” may sound more anxious than the chapter does."},"motifs":{"items":[{"title":"Going down","gist":"Every movement is downward, and none of it is chosen twice.","claim":"Down is the one direction here: Alice goes down after the Rabbit, the tunnel dips down, the fall is down a well, and even her boast is about tumbling down stairs. The word arrives before she has time to decide anything.","terms":["down"],"evidence":[{"para":5,"quote":"In another moment down went Alice after it"},{"para":6,"quote":"and then dipped suddenly down"},{"para":8,"quote":"I shall think nothing of tumbling down stairs!"}]},{"title":"Pictures and conversations","gist":"What makes a book worth reading, asked on the bank and answered in the well.","claim":"Alice’s first complaint is a book with no pictures or conversations, and the well she falls through is hung with maps and pictures. The chapter starts supplying what she asked a book for.","terms":["pictures","conversations"],"evidence":[{"para":2,"quote":"it had no pictures or conversations in it"},{"para":7,"quote":"here and there she saw maps and pictures hung upon pegs"}]},{"title":"Hurry and leisure","gist":"The Rabbit has a watch and is late; Alice has all the time in the world.","claim":"Time pressure belongs to the Rabbit, who checks a watch and hurries on. Alice’s fall is slow enough to read the shelves, so the chapter sets his hurry against her leisure.","terms":["late","time","watch"],"evidence":[{"para":4,"quote":"I shall be late!"},{"para":7,"quote":"she had plenty of time as she went down to look about her"}]}],"friction":"“Going down” rests partly on how common the word is: some downs are ordinary English, like “took down a jar” in ¶7. “Pictures” links ¶2 to ¶7 across five paragraphs and may be a coincidence the reading enjoys."},"tension":{"scores":[0,1,3,6,7,8,3,2],"claim":"Tension climbs from boredom to the chase in ¶4, peaks as the tunnel drops into the well in ¶6, then lets go into a slow, curious fall in ¶7 and a joke in ¶8.","peaks":[{"para":4,"quote":"she ran across the field after it","note":"The chase begins."},{"para":6,"quote":"dipped suddenly down, so suddenly","note":"The drop."}],"friction":"The scores read the drop in ¶6 as danger, but a reader may feel it as wonder; ¶7 treats the fall as leisure, which is why the curve falls there."}}
===END_LIGHTBOX_GROUP_A_V1===

Every quote is copied from the paragraph it names, and each motif is found in at least two paragraphs. The `terms` are words as they stand; the host counts them, so the response gives no numbers. The eight tension scores are one per column, on this excerpt’s own scale. Each block names its friction.
