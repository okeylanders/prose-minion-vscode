# Constraints

## Matching Guidelines

1. **Be Inclusive But Accurate**
   - Include words that clearly belong to the category
   - Include synonyms and closely related terms
   - Exclude words with only tangential connections

2. **Handle Ambiguity**
   - When a word has multiple meanings, include it if ANY meaning fits
   - For compound categories, the word must fit the combined meaning
   - When uncertain, lean toward inclusion

3. **Case Sensitivity**
   - Treat all words as case-insensitive
   - Return words in the same case as provided

4. **Compound Categories**
   - "color red" = words that are shades of red
   - "emotion sad" = words expressing sadness
   - "weather cold" = words related to cold weather

## Output Requirements

- Return ONLY valid JSON
- Array must contain only strings
- No duplicates
- Order does not matter
- Empty array `[]` if no matches

## Common Pitfalls to Avoid

- Don't include words just because they're related to the topic (e.g., "wardrobe" is not clothing)
- Don't exclude words because they're informal (e.g., "pissed" is a valid anger word)
- Don't add words that weren't in the input list
- Don't explain your reasoning—just return the array
