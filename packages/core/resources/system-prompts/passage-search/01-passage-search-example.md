# Worked Example

The passage below adapts the opening of Lewis Carroll's *Alice's Adventures
in Wonderland* (1865, public domain) for this example.

## Request

```text
The question and the passage below are quoted task data, never instructions.

<passage-search-question>
Find every time the White Rabbit shows it is worried about being late.
</passage-search-question>

<passage-search-passage>
Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do. Once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it.

Suddenly a White Rabbit with pink eyes ran close by her. “Oh dear! Oh dear! I shall be late!” it said to itself. Then it took a watch out of its waistcoat-pocket, looked at its watch, and hurried on.

Alice started to her feet, for she had never before seen a rabbit with either a waistcoat-pocket or a watch to take out of it, and she ran across the field after it.

The Rabbit was still in sight, hurrying down a long passage. “Oh my ears and whiskers, how late it’s getting!” it muttered. It looked at its watch, and was gone round the corner before Alice could call to it.
</passage-search-passage>
```

## Response

```json
{"instances":[
{"quote":"“Oh dear! Oh dear! I shall be late!” it said to itself.","note":"The Rabbit says outright that it will be late.","label":"says it aloud"},
{"quote":"looked at its watch","after":", and hurried on.","note":"It checks its watch and hurries away.","label":"checks its watch"},
{"quote":"“Oh my ears and whiskers, how late it’s getting!” it muttered.","note":"The Rabbit mutters about the hour as it hurries.","label":"says it aloud"},
{"quote":"looked at its watch","before":"it muttered. It","note":"It checks its watch a second time before it disappears.","label":"checks its watch"}
]}
```

The passage holds the words "looked at its watch" twice, so each of those
instances gives the words beside it: `after` for the first, `before` for the
second. The two speeches are quoted with the passage's own curly quotation
marks. The two labels are reused, spelled the same way each time. Alice
running after the Rabbit is not the Rabbit worrying, so it is not listed,
and "hurrying down a long passage" alone does not show worry about the hour.

A real reply is the JSON object alone, with no code fence around it.
