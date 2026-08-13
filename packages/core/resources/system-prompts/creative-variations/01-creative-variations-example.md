# Contract example

For a request containing three cards and a nonblank `mustSurvive` invariant, the complete response has this shape (content shortened only for this example):

===CREATIVE_VARIATIONS_V1===
{"version":1,"cards":[{"position":1,"approach":"Restrain the reveal","direction":"Let the realization arrive through one physical correction.","prose":"She set the cup back where it had already been.","tradeoff":{"gain":"Subtext and reader participation","cost":"Less immediate certainty"},"invariantFlags":[]},{"position":2,"approach":"External interruption","direction":"Make an outside interruption expose the private shift.","prose":"The bell rang; she answered it with his name.","tradeoff":{"gain":"Momentum and surprise","cost":"Adds a new story beat"},"invariantFlags":[{"invariantField":"must-survive","kind":"advisory-risk","note":"The interruption may compete with the intended quietness."}]},{"position":3,"approach":"Direct reversal","direction":"State the old belief, then break it with one irreversible choice.","prose":"She said she would wait. Then she burned the letter.","tradeoff":{"gain":"Clarity and force","cost":"Less ambiguity"},"invariantFlags":[]}]}
===END_CREATIVE_VARIATIONS_V1===

In a real response, fill every field from the supplied task and return exactly the requested card count.
