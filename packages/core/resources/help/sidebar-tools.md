# Sidebar tools

## Assistant

Select prose in the editor and choose **Prose Minion → Assistant**, or paste a passage into the Assistant sidebar. For a project-aware reading, supply context or ask the Context Assistant to build a brief from the source document and configured story resources. The resource pills identify the files behind the brief. Run a dialogue and microbeat pass for tags and action beats, a prose pass for pacing, imagery and cadence, or browse Writing Tools to pick a focused pass. You can copy or save the resulting analysis. The same tab opens the Workshop and Lightbox.

The AI passes use your OpenRouter key. Choose the Assistant and Context models separately. Enable craft guides to give applicable passes access to the bundled writing references.

## Dictionary

Select a word or phrase and choose **Word Lookup**, or enter it on the Dictionary tab. Add the surrounding passage for a reading sensitive to the character's voice and the sense used there. Entries can cover pronunciation, connotations, register, related words and examples. Topic & Related Lexicon adds a topic explanation and vocabulary. Chromatic Palettes adds named colors and swatches. New lookups use the Dictionary model.

Open **Lookup history** to reopen a saved entry without another model call. Search its word, context or source filename. Tick **Also search definitions** to search the entries themselves. Up to 500 lookups are kept. When a phrase already has an entry, choose **Open latest entry** to reuse it or **Look up again** for a fresh reading.

## Word search

In Search, choose **Word Search**, set the source and enter the words to find. Results show occurrences with context, per-file counts and clusters where occurrences are close. Use the Word Search settings to adjust case sensitivity, the context on either side of a match, the cluster distance and the minimum hits for a cluster. Literal search works offline. Assistant expansion is an optional model-assisted way to broaden the terms.

## Category search

In Search, choose **Category Search** and describe a category, such as clothing or verbs of hesitation. The Category Search model identifies words by meaning and the search tools locate their occurrences in your source. N-gram mode determines whether to include phrases. Minimum phrase occurrences filters the phrases considered. You can cancel a search, inspect partial results and export the report.

## Passage search

In Search, choose **Passage Search** to find moments instead of words: a gesture written five ways, a habit of speech, a kind of scene. A model reads the text, so describe what to find in the **Question** field. Under **Search in**, tick any mix of **Active file**, **Selection** and the context groups, where a group means every file its context paths match, and add paths or patterns inside the project, one a line or separated by commas. Only .md and .txt files are read.

Press **Estimate** before anything is sent. The line shows the number of calls, an approximate price and the model. The price is an estimate, not a limit, and it reads "price unavailable" when the model has no live price. It also says when files are left out. Changing the question, a scope or the organize option clears the estimate. **Run** sends exactly what was estimated. Progress shows the calls read and the instances found. **Stop** makes no further call and keeps what was found.

Each instance shows its file and line, the quoted text with a little context, a note and a label. Every quote is checked against the file, and the counts in the label table are counted by Prose Minion. Press a file and line to open the file there. A selection that has no saved file has nothing to open. **Organize the results** adds one call that reads the instances and writes a headline and an analysis whose numbered cites jump to their instances. A stopped search is never organized on its own: press **Organize these results** to see that call's price, then **Organize**. The result ends with what was left out and why. Copy the report, or save it to prose-minion/reports. Passage Search uses the Passage Search model, which follows the Category Search model until you choose one in Settings.

## Metrics

Choose a source in Metrics. **Prose Statistics** measures words, sentences, paragraphs, reading time, readability and dialogue. Lexical density measures the share of content words. Type-token ratio measures vocabulary variety. For a manuscript comparison, choose a publishing standards preset and a page size for the estimated page count. Multi-file reports can include chapter details when copied or saved.

**Style Flags** groups patterns such as repeated words, adverbs, filler, hedges, intensifiers, weak verbs and placeholders, with example sentences. These reports run locally and do not need an API key.

## Word frequency

In Metrics choose **Word Frequency** to see the most common words. The Word Frequency settings control the top list length, minimum word length, content-word filtering and a separate stopword table. Enable hapax legomena for words used once and set how many to display. Other options add bigrams, trigrams, parts of speech, group inflections by lemma, or adjust the word-length histogram. The counts are computed locally on the source you choose.

## Craft Steering

In the Assistant's Writing Tools picker, open **Craft & Voice → Craft Steering**. The same pass is in the Workshop Tools picker, and you can ask a persona to run it on a passage. Use it when a paragraph sounds wrong aloud or a transition between sentences feels abrupt. The report examines sound, rhythm, narration and how one sentence leads to the next. It identifies what to preserve and offers revisions with their gains and costs. Creative Variations explore different treatments of the passage. Bound Creative Variations isolate particular craft choices for comparison.
