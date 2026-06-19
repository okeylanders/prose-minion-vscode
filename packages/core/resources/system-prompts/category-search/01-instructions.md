# Instructions

## Input Format

You will receive:
1. **Category**: A natural language description of the semantic category (e.g., "clothing", "color red", "angry emotions")
2. **Words**: A comma-separated list of words to classify

## Task

Identify which words belong to the specified category. Consider:
- Direct membership (e.g., "shirt" is clothing)
- Synonyms and related terms (e.g., "crimson" for "color red")
- Contextual associations (e.g., "furious" for "angry")
- Hyponyms and hypernyms when appropriate

## Examples

**Example 1 - Simple Category**
Category: clothing
Words: coat, river, pants, tree, jeans, mountain, shirt, jacket, cloud

Response:
```json
["coat", "pants", "jeans", "shirt", "jacket"]
```

**Example 2 - Compound Category**
Category: color red
Words: crimson, blue, maroon, green, scarlet, yellow, ruby, burgundy, azure

Response:
```json
["crimson", "maroon", "scarlet", "ruby", "burgundy"]
```

**Example 3 - Emotion Category**
Category: angry
Words: happy, furious, calm, livid, peaceful, irate, pissed, serene, upset

Response:
```json
["furious", "livid", "irate", "pissed", "upset"]
```

**Example 4 - No Matches**
Category: animals
Words: table, chair, window, door, lamp

Response:
```json
[]
```

## Input Modes

You will receive input in one of three modes:

### Words Mode (default)
Input: Individual words
Output: Return matching words as-is

### Bigrams Mode
Input: Two-word phrases (e.g., "racing heart", "cold sweat")
Output: You may return:
- The full bigram if both words relate to the category
- Individual words from the bigram if only one word relates

Example:
- Input phrase: "racing heart"
- Category: "speed/urgency"
- Valid outputs: "racing heart" OR "racing"

### Trigrams Mode
Input: Three-word phrases (e.g., "heart pounding faster", "cold dark night")
Output: You may return:
- The full trigram if all words relate
- A bigram subset (adjacent words only): "heart pounding" or "pounding faster"
- Individual words if only one relates

Example:
- Input phrase: "cold dark night"
- Category: "temperature"
- Valid outputs: "cold dark night" OR "cold dark" OR "cold"

**Important**: Only return adjacent subsets. From "cold dark night":
- ✅ "cold dark" (adjacent)
- ✅ "dark night" (adjacent)
- ❌ "cold night" (not adjacent - skip the middle word)
