# Worked example: group C (genre neighborhood)

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

Read group C with these lenses, and only these: genre neighborhood.
Return one frame between ===LIGHTBOX_GROUP_C_V1=== and ===END_LIGHTBOX_GROUP_C_V1===. Its JSON has "version": 1 and exactly these lens keys: "genre".

--- end of example request ---

One complete, valid response:

===LIGHTBOX_GROUP_C_V1===
{"version":1,"genre":{"neighbors":[{"genre":"Victorian children’s fantasy","affinity":0.86,"claim":"A child, a talking animal and a hole into somewhere else, told by a narrator who winks at the reader over the child’s head.","nearMiss":"","evidence":[{"para":4,"quote":"Oh dear! Oh dear! I shall be late!"},{"para":8,"quote":"(Which was very likely true.)"}]},{"genre":"Literary nonsense","affinity":0.71,"claim":"Logic bends without alarm: the fall is slow enough to read the shelves, and a falling girl worries about a jar of marmalade.","nearMiss":"","evidence":[{"para":7,"quote":"she did not like to drop the jar for fear of killing somebody"}]},{"genre":"Portal fantasy","affinity":0.55,"claim":"A threshold under a hedge leads somewhere else, though in these paragraphs nothing has been reached yet.","nearMiss":"","evidence":[{"para":4,"quote":"a large rabbit-hole under the hedge"}]},{"genre":"Survival thriller","affinity":0.12,"claim":"The situation has the furniture of peril, a fall with no way back, but nothing in the telling is afraid.","nearMiss":"A fall with no way out matches; the dread a thriller promises is absent, and the fall is a pleasure.","evidence":[{"para":5,"quote":"never once considering how in the world she was to get out again"}]}],"promise":{"text":"Something strange will be followed, and wonder will win out over fear.","evidence":[{"para":4,"quote":"burning with curiosity"}]},"friction":"Genre pulls toward a destination and a reason for the fall, and these paragraphs keep both out of view. “Victorian children’s fantasy” also leans on the book’s reputation, which eight paragraphs alone do not prove."}}
===END_LIGHTBOX_GROUP_C_V1===

The neighborhood includes a near miss at 0.12, with a `nearMiss` line saying what matches and what does not; the other neighbors leave `nearMiss` empty. Affinities are claims, not measurements. Nothing tells the writer to move toward or away from any shelf.
