## Lens: pressure (key `"pressure"`)

What is building in the chapter and whether it resolves: the questions a reader carries and the events that are coming, each planted, perhaps escalated, and either resolved here or carried out of the chapter still open. Open is not a fault: a thread a chapter hands on is part of its pull.

{"threads":[{"question":"...","planted":{"para":4,"quote":"..."},"escalations":[{"para":6,"quote":"..."}],"resolution":null,"dormant":false}],"friction":"..."}

- `threads`: 0–6 threads, in the order they are planted.
- `question`: one line of at most 120 characters: the question a reader carries, or the event that is coming, in plain words.
- `planted`: one quote, `{"para": n, "quote": "..."}`, where the thread is first raised.
- `escalations`: 0–3 quotes where it builds.
- `resolution`: one quote where it resolves, or `null` while it is still open at the chapter's end.
- The quotes run in paragraph order: planted first, then each escalation, then the resolution, none in an earlier paragraph than the one before it. The host checks the order and withholds a thread that breaks it, and withholds a thread whose plant, or whose resolution, it cannot find.
- `dormant`: `true` when the thread is planted and never touched again; it then has no escalation, and its `resolution` is `null`. A dormant thread with a later quote is withheld. Otherwise `false`.
- The host computes each thread's span and how many threads stand open across each paragraph; never give a count or a span.
- Describe what builds. Never tell the writer to resolve, cut, raise or plant anything.
- `friction`: where this reading strains: a thread that is two threads, a resolution that opens a new question, a plant a reader may not notice.
