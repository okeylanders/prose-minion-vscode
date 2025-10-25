# New Component: Context Search

## Problem

Need to search for categories or synonyms or forms of word. 

Example: [clothing] should find all words associated with clothing: coat, pants, jeans, etc.

Example: [color red] should find all words that indicate color red: crimson, maroon

Example: [color] should find all words that indicate color: blue, aqua, etc.

Example: [angry] should find all synonym for angry: pissed, upset.

## Methodology

Since imagining all words ahead of time would be very inefficient, tool should first create a distinct list of all words, then pass word list and context to AI to perform the match? Then re-scan scope for appearance of all words

## Output

( Similar to Metrics->Word Search )

```markdown
## Summary
| category | word | count |

## Expanded Summary
| category | word | count | chapter

## Details & Cluster Anlaysis
( Copy output format of word search )
```
