# Prose Statistics Algorithms and Legend

This document describes how the Prose Minion VS Code extension computes each prose statistic, what it means, and any caveats. Where applicable, the implementation references `src/tools/measure/passageProseStats/index.ts`.

## Tokenization Basics

- Words: lowercased tokens split on whitespace, with all non-letters removed except `'` (apostrophes) for intermediate processing, then trimmed. Implementation: `tokenizeWords()`.
- Sentences: naïvely split on `.`, `!`, or `?` (one or more). Regex: `/[.!?]+/`.
- Paragraphs: split on a blank line (double newline). Regex: `/\n\s*\n/`.

These choices favor performance and determinism over linguistic completeness.

## Metrics (How They’re Calculated)

- Word Count
  - Count of tokens split by whitespace. Regex: `/\s+/`.
  - Function: `countWords()`.

- Sentence Count
  - Count of substrings between sentence-ending punctuation `.!?`.
  - Function: `countSentences()`.

- Paragraph Count
  - Count of blocks separated by a blank line.
  - Function: `countParagraphs()`.

- Average Words per Sentence (Avg W/S)
  - `wordCount / sentenceCount`. Guard against divide-by-zero.

- Average Sentences per Paragraph
  - `sentenceCount / paragraphCount`. Guard against divide-by-zero.

- Dialogue Percentage
  - Percentage of tokens appearing inside double quotes.
  - Steps: find all `"…"` spans, concatenate, re-count words, divide by total words.
  - Function: `calculateDialoguePercentage()`.
  - Caveat: Only double quotes are considered; locale-specific quotes and nested quotes are not handled.

- Lexical Density (%)
  - Percentage of content words (non-stopwords) over total tokens.
  - Steps: tokenize words → count tokens not in a compact English stopword set → `(content / total) × 100`.
  - Function: `calculateLexicalDensityPercent()`.
  - Note: This is different from Type–Token Ratio (TTR). Lexical density approximates information load vs function words.

- Stopword Ratio (%)
  - Percentage of tokens that are stopwords.
  - Steps: tokenize → count tokens that are stopwords → `(stop / total) × 100`.
  - Function: `calculateStopwordRatioPercent()`.

- Unique Word Count
  - Count of distinct word forms (set size after tokenization).
  - Function: `countUniqueWords()`.

- Hapax % and Hapax Count
  - Hapax legomena are words that occur exactly once.
  - Steps: build frequency map; `hapaxCount = count(freq == 1)`; `hapax% = (hapaxCount / total tokens) × 100`.
  - Functions: `calculateHapaxPercent()`, `calculateHapaxCount()`.

- Type–Token Ratio (TTR) %
  - `(unique / total) × 100`.
  - Function: `calculateTypeTokenRatioPercent()`.

- Reading Time
  - Minutes: `wordCount / 240` (default WPM = 240). Hours = `minutes / 60`.
  - Short label: rounded minutes (e.g., `"5m"`).
  - Functions: `estimateReadingTimeMinutes()` and display logic in `analyze()`.

- Readability Score (Simplified Flesch Reading Ease)
  - Approximation without syllables: `100 - (avgWordsPerSentence × 2)`.
  - Range: 0–100; higher means easier to read.
  - Function: `calculateReadabilityScore()`.

- Readability Grade (FKGL)
  - Formula: `0.39 × (words/sentences) + 11.8 × (syllables/words) – 15.59`.
  - A lightweight syllable estimator counts vowel groups with adjustments (silent `e`, `le` ending, etc.).
  - Functions: `estimateSyllables()`, `calculateFKGLGrade()`.

- Pacing (Qualitative)
  - Based on Avg Words per Sentence:
    - `< 10`: Fast (short sentences)
    - `< 20`: Moderate
    - `< 30`: Slow (longer sentences)
    - `>= 30`: Very slow (very long sentences)
  - Function: `determinePacing()`.

- Word Length Distribution (%)
  - Buckets by token length after removing apostrophes: `1–3`, `4–6`, `7+` letters.
  - Percentages over total tokens.
  - Function: `calculateWordLengthDistribution()`.

- Word Frequency (Enhanced)
  - Top Words: count of most frequent content words (stopwords excluded by default); size configurable (default 100).
  - Stopwords: table of top stopwords and total stopword token count (complements Stopword Ratio).
  - Hapax: hapax count, percent, and an alphabetized list (display capped in UI; full count computed).
  - POS: parts-of-speech lists (nouns, verbs, adjectives, adverbs) via wink-pos-tagger; if unavailable, sections show a short note.
  - N‑grams: Top bigrams and trigrams (each top 20 by default).
  - Word Length Histogram: slider-style bars 1–10 characters with proportional blocks and percentages.
  - Lemmas (optional): groups common inflections into lemma buckets for an alternate “Top Lemmas” view.

## Chapter Metrics (Multi-file Modes)

When measuring “Manuscripts” or “Chapters”, each matched file is treated as one chapter.

- Chapter Count: number of files included.
- Average Chapter Length: mean words per file (rounded).
- Per-chapter stats: the same metrics as above are computed per file and rendered in:
  - A summary “Chapter‑by‑Chapter Prose Statistics” table.
  - Optional “Chapter Details” section (one pivoted markdown table per chapter) included on Copy/Save if you confirm.

## Legend (UI Labels → Meaning)

- 📝 Word Count → total tokens
- 📏 Sentence Count → count of `.!?` delimited sentences
- 📑 Paragraph Count → count of blank-line separated blocks
- ⚖️ Avg Words per Sentence → mean words per sentence
- 📐 Avg Sentences per Paragraph → mean sentences per paragraph
- ⏱️ Reading Time → minutes at 240 wpm (short label)
- 🎯 Pacing → qualitative based on sentence length
- 💬 Dialogue Percentage → % of tokens inside `"…"`
- 🎨 Lexical Density → % of non-stopwords over total tokens
- 🧹 Stopword Ratio → % of tokens in stopword list
- 🌱 Hapax % / 🌱 Hapax Count → % and count of words occurring exactly once
- 🔀 Type-Token Ratio → unique/total tokens × 100
- 📖 Readability Score → simplified Flesch Reading Ease (0–100)
- 🎓 Readability Grade (FKGL) → Flesch–Kincaid grade estimate
- 🔎 Unique Words → distinct word forms
- ⏳ Reading Time (min) → numeric minutes

## Rounding and Presentation

- Percentages: typically shown with 1 decimal place (e.g., `52.6%`).
- Averages: shown with 1 decimal place.
- Large counts: localized with thousands separators.
- Readability score and FKGL: shown with 1 decimal place.

## Known Limitations

- Tokenization and sentence splitting are heuristic and language-agnostic.
- Dialogue detection considers only double quotes.
- Stopword list is compact; domain-specific terms may affect density.
- Readability Score is a simplified proxy; FKGL uses a heuristic syllable estimator.

## Publishing Standards Interop

When a publishing standards preset is selected, comparisons use the same units:

- Lexical density: percent 0–100 (content-word ratio).
- Dialogue percentage: percent 0–100.
- Word length distribution: percent 0–100 for each bucket.
- Average words/sentence, sentences/paragraph, unique words, etc. compare to numeric ranges from the standards dataset.
