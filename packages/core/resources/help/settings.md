# Settings

## Setting assistant model

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.assistantModel | string | "anthropic/claude-sonnet-5.5" | AI model for assistant tools (Prose/Dialogue analysis). See Settings Overlay for curated list, or enter any OpenRouter model ID. |

## Setting dictionary model

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.dictionaryModel | string | "anthropic/claude-haiku-5.5" | AI model for dictionary and utility tools. See Settings Overlay for curated list, or enter any OpenRouter model ID. |

## Setting context model

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.contextModel | string | "openai/gpt-6.2-sol" | AI model for context bot features. See Settings Overlay for curated list, or enter any OpenRouter model ID. |

## Setting widget model

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.widgetModel | string | "anthropic/claude-sonnet-5.5" | AI model for quality-first Conversation Widget generation (for example, Gesture Playground's semantic scan and alternatives). Enter any OpenRouter model ID. |

## Setting lightbox model

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.lightboxModel | string | "" | AI model for the Lightbox's analyses. Leave empty to use the same model as the Workshop (`#proseMinion.assistantModel#`), following it when it changes. Choosing a model here, or in the Lightbox's model picker, gives the Lightbox its own, and never changes the Workshop's. Enter any OpenRouter model ID. |

## Setting proofread model

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.proofreadModel | string | "anthropic/claude-haiku-5.5" | AI model for Proofread (the editor's right-click **Prose Minion: Proofread** commands). Proofreading wants precise, repeatable corrections across many small calls, so the default is a fast, inexpensive model. Enter any OpenRouter model ID. |

## Setting craft model

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.craftModel | string | "" | AI model for Craft Flags (the editor's right-click **Prose Minion: Craft Flags** command), which reads a whole chapter and flags line notes such as clichés and shifts of register. Leave empty to use the same model as the Workshop (`#proseMinion.assistantModel#`), following it when it changes. Choosing a model here gives Craft Flags its own, and never changes the Workshop's. Enter any OpenRouter model ID. |

## Setting helper model

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.helperModel | string | "" | AI model for the helper agent's small automatic tasks, such as drafting a memory's title and summary when you save a Workshop reply to memory. Leave empty to use the same model as Proofread (`#proseMinion.proofreadModel#`), following it when it changes. Choosing a model here gives the helper its own, and never changes Proofread's. Enter any OpenRouter model ID. |

## Setting passage search model

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.passageSearchModel | string | "" | AI model for Passage Search, which reads your files to find the passages that answer a question. Leave empty to use the same model as Category Search (`#proseMinion.categoryModel#`), following it when it changes. Choosing a model here gives Passage Search its own, and never changes Category Search's. Enter any OpenRouter model ID. |

## Setting craft flags categories

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.craftFlags.categories | array | ["cliche","register","gesture","continuity"] | Which line notes **Prose Minion: Craft Flags** looks for. Each one is a request of its own, priced in the confirmation before anything is sent. Words inside quotation marks are always left alone; a gesture in a dialogue beat is narration, and is read. |

## Setting craft flags reasoning

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.craftFlags.reasoning | string | "standard" | How much reasoning **Prose Minion: Craft Flags** requests for each category when the model supports it. Standard allows about 4,000 reasoning tokens per call in addition to the reply budget. Light reduces the estimated cost. An older `off` setting uses Standard. |

## Setting proofread fix review

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.proofread.fixReview | string | "preview" | How **Prose Minion: Proofread and Fix**, and the *Fix all* quick fix, bring their fixes to the file. Either way the fixes are one undoable change and the file is never saved for you, and tense and agreement issues are only ever flagged. A single *Replace with* quick fix always applies at once. |

## Setting proofread spelling convention

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.proofread.spellingConvention | string | "auto" | The spelling **Prose Minion: Proofread** holds your text to. With a convention named, a word spelled to another one (*colour* or *color*) is flagged, and **Proofread and Fix** corrects it when the change is small. With `auto`, only a spelling that breaks the text's own pattern is flagged. Proper names keep their own spelling. When a file writes a word both ways (*grey* and *gray*), the convention's spelling is the one kept; with `auto`, the more used. |

## Setting proofread word list

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.proofread.wordList | array | [] | Names and invented words **Prose Minion: Proofread** accepts as spelled: never flagged as a spelling or wrong word, in any case or with a possessive (*Dinah's*), and never flagged as a variant of another name or as a word spelled two ways. An entry of several words counts word by word. Set it in your workspace settings to keep a list per project. |

## Setting proofread reasoning

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.proofread.reasoning | string | "light" | How much a thinking model may think before it proofreads each passage. The budget comes on top of the reply's own room, so thinking never cuts a reply short on a model that honors it. Models differ: some take only a rough level. A model the OpenRouter catalog marks as always thinking cannot be asked for `off`: Proofread then sends nothing and says so, and you choose a level or another model. If a reply is still cut off, the Output panel says how much went to thinking. Models that do not think ignore this. |

## Setting category model

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.categoryModel | string | "openai/gpt-oss-120b:nitro" | AI model for Category Search (curated list) |

## Setting include craft guides

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.includeCraftGuides | boolean | true | Include craft guides in AI prompts (provides additional writing guidance but uses more tokens) |

## Setting ui show token widget

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.ui.showTokenWidget | boolean | true | Show the session token usage widget in the header (tokens and optional cost). |

## Setting ui sidebar theme

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.ui.sidebarTheme | string | "follow-vscode" | Sidebar palette: follow your active VS Code color theme (the default), or pin Prose Minion's warm-dark brand look. Also toggleable from the header. |

## Setting temperature

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.temperature | number | 0.7 | AI creativity level (0 = focused, 2 = very creative) |

## Setting max tokens

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.maxTokens | number | 10000 | Maximum length of AI responses |

## Setting claude cache ttl

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.claudeCacheTtl | string | "5m" | Cache duration for retained Claude conversations. Reuse refreshes the window. Cache-read pricing is unchanged. Applies to subsequent requests. |

## Setting context paths characters

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.contextPaths.characters | string | "characters/**/*,Characters/**/*" | Comma-separated glob patterns for character reference files (only .md and .txt files are used). |

## Setting context paths locations

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.contextPaths.locations | string | "locations/**/*,Locations/**/*,Locations-Settings/**/*" | Comma-separated glob patterns for setting/location files (only .md and .txt files are used). |

## Setting context paths themes

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.contextPaths.themes | string | "themes/**/*,Themes/**/*" | Comma-separated glob patterns for theme notebooks (only .md and .txt files are used). |

## Setting context paths things

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.contextPaths.things | string | "things/**/*,Things/**/*" | Comma-separated glob patterns for important objects or props (only .md and .txt files are used). |

## Setting context paths chapters

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.contextPaths.chapters | string | "drafts/**/*,Drafts/**/*,outlines/**/*,Outlines/**/*" | Comma-separated glob patterns for draft chapters and outlines (only .md and .txt files are used). |

## Setting context paths manuscript

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.contextPaths.manuscript | string | "manuscript/**/*,Manuscript/**/*" | Comma-separated glob patterns for polished manuscript chapters (only .md and .txt files are used). |

## Setting context paths project brief

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.contextPaths.projectBrief | string | "brief/**/*,Brief/**/*" | Comma-separated glob patterns for project brief materials (only .md and .txt files are used). |

## Setting context paths general

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.contextPaths.general | string | "research/**/*,Research/**/*,tone-and-style/**/*,Tone-And-Style/**/*,literary-devices/**/*,Literary-Devices/**/*,**/story-bible.md,**/synopsis.md,**/voice-and-tone.md,**/genre-conventions.md" | Comma-separated glob patterns for general reference material (only .md and .txt files are used). |

## Setting workshop conversation behavior

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.workshop.conversationBehavior | object | {"interactionMode":"balanced","expressionLevel":"full","relationalDepth":"attuned","carryCuesThroughSession":true,"proactiveAssistance":true} | Durable defaults for Workshop conversation behavior. These explicit choices survive restart; inferred conversation-cue memory remains session-scoped. |

## Setting workshop writer profile

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.workshop.writerProfile | object | {"enabled":false,"preferredAddress":"","bio":""} | Optional global writer profile shared only with Workshop personas. It is not session memory and is not copied into project data. |

## Setting workshop project memory

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.workshop.projectMemory | string | "off" | Workshop Project Memory. One switch for every project; each project keeps its own notes in `prose-minion/memory/`. Personas see the notes only while this is on. |

## Setting workshop file edits

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.workshop.fileEdits | string | "ask" | Workshop persona file edits. A persona can propose an edit to a project file (a note, a chapter, or the excerpt's document). Nothing in a file changes until you press Apply on its card. |

## Setting workshop memory suggestions

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.workshop.memory.suggestions | string | "sparingly" | How readily Workshop personas suggest project notes. One choice for every project. It changes how often a persona suggests a note, never what a note may hold. It applies while Workshop Project Memory (`#proseMinion.workshop.projectMemory#`) is on; when that saves notes without asking, at most 5 are saved in one conversation and the rest wait as cards. |

## Setting workshop memory list size

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.workshop.memory.listSize | string | "standard" | How much of this project's notes Workshop personas are shown at the start of each conversation: the newest notes by title and summary, then every other note by its title alone, as many as fit. One choice for every project. Notes set to load in full are separate, and keep their own 5,000 tokens at every size. A change applies from the next conversation; an open conversation keeps the list it started with. It applies while Workshop Project Memory (`#proseMinion.workshop.projectMemory#`) is on. |

## Setting workshop memory helper drafts

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.workshop.memory.helperDrafts | boolean | true | When you save a Workshop message to project memory, the helper drafts its title, summary and kind while the sheet is open. Anything you type first is kept. Each draft is a small call on the helper's model (`#proseMinion.helperModel#`). Turn this off to fill the sheet yourself. |

## Setting workshop reactions personas

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.workshop.reactions.personas | boolean | true | Let Workshop personas react to your message with an emoji, rarely and at most once a reply. Turn this off and personas no longer react; your own reactions, and what personas hear of them, stay as they are. |

## Setting workshop web research

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.workshop.webResearch | object | {"enabled":false} | Optional per-window live-web research for Workshop persona conversations. Research may share active conversation context with OpenRouter and search providers. Workshop tools remain unchanged. |

## Setting publishing standards preset

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.publishingStandards.preset | string | "none" | Publishing standards preset for Metrics comparison: 'none', 'manuscript', or 'genre:<abbreviation\|name\|slug>'. |

## Setting publishing standards page size key

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.publishingStandards.pageSizeKey | string | "" | Selected trim size key for the chosen genre (uses page_sizes[].format when available, otherwise WIDTHxHEIGHT). |

## Setting word frequency top n

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.wordFrequency.topN | number | 100 | Top N words to include in the Word Frequency report. |

## Setting word frequency include hapax list

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.wordFrequency.includeHapaxList | boolean | true | Include the Hapax (frequency=1) word list at the bottom of the Word Frequency report. |

## Setting word frequency hapax display max

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.wordFrequency.hapaxDisplayMax | number | 300 | Maximum Hapax words to display inline in the report (full list still counted). |

## Setting word frequency include stopwords table

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.wordFrequency.includeStopwordsTable | boolean | true | Include a Top Stopwords table with counts and percentages. |

## Setting word frequency content words only

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.wordFrequency.contentWordsOnly | boolean | true | Show Top Words using content words only (excludes stopwords). |

## Setting word frequency pos enabled

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.wordFrequency.posEnabled | boolean | true | Enable POS sections using wink-pos-tagger. If the tagger cannot initialize, sections are marked unavailable. |

## Setting word frequency include bigrams

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.wordFrequency.includeBigrams | boolean | true | Include Top Bigrams (two-word phrases). |

## Setting word frequency include trigrams

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.wordFrequency.includeTrigrams | boolean | true | Include Top Trigrams (three-word phrases). |

## Setting word frequency enable lemmas

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.wordFrequency.enableLemmas | boolean | false | Enable a lemmatized Top Words view (experimental). |

## Setting word frequency length histogram max chars

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.wordFrequency.lengthHistogramMaxChars | number | 10 | Maximum token length to show in the Word Length Distribution histogram. |

## Setting word frequency min character length

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.wordFrequency.minCharacterLength | number | 1 | Minimum character length for words in Word Frequency results. Filter helps identify longer, more distinctive word patterns by excluding short common words. **1+** = all words, **3+** = excludes 'it', 'is', 'an', **5+** = multi-syllable words, **6+** = distinctive vocabulary, **7+** = complex words, **8+** = advanced vocabulary, **9+** = rare/specialized words. Applied to Top Words, POS, Bigrams/Trigrams, Hapax List, and Lemmas. Does NOT filter Stop Words or Length Histogram. |

## Setting word search context words

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.wordSearch.contextWords | number | 3 | Number of words to show around each word search match for context |

## Setting word search cluster window

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.wordSearch.clusterWindow | number | 50 | Maximum word distance to group matches into a cluster |

## Setting word search min cluster size

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.wordSearch.minClusterSize | number | 2 | Minimum number of matches required to form a cluster |

## Setting word search case sensitive

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.wordSearch.caseSensitive | boolean | false | Enable case-sensitive word search matching |

## Setting word search enable assistant expansion

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.wordSearch.enableAssistantExpansion | boolean | false | Enable assistant-based expansion for target words (synonyms, inflections). |

## Setting apply context window trimming

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.applyContextWindowTrimming | boolean | true | Apply context window trimming to prevent token limit errors. **Limits**: UI recommends 500-word excerpts; Context Agent (50K words), Analysis Agents (75K words total: excerpt + context + guides). Targets 128K token context window. Disable if using models with larger context windows (e.g., 200K+). |

## Setting debug logging

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.debugLogging | boolean | false | Log full rejected AI responses to the Output channel for protocol diagnosis. **Privacy**: these dumps may quote your manuscript text — leave off unless debugging, and avoid pasting the Output channel into public bug reports while enabled. |

## Setting category search ngram mode

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.categorySearch.ngramMode | string | "words" | Default search mode for new searches. Words = individual words, Bigrams = 2-word phrases, Trigrams = 3-word phrases. Changes take effect on panel reload. |

## Setting category search min phrase occurrences

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| proseMinion.categorySearch.minPhraseOccurrences | number | 2 | Default minimum phrase occurrences for bigram/trigram searches. Phrases appearing fewer times are filtered out. Changes take effect on panel reload. |
