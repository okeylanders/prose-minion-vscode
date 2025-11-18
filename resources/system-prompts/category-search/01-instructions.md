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
