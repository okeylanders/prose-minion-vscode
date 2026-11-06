# Feature: Workshop Session Name Draft

**Date Identified:** 2026-11-06
**Status:** Idea. Waits on the [Helper Agent](#related) epic reaching `main`. A helper task under that ADR's D1, so it may need only a short amendment, not a new ADR.
**Priority:** Medium
**Origin:** Okey, 2026-11-06

## In Okey's words

> When clicking Save to name an unsaved session, I wonder if the helper agent
> can suggest a name for the session. I generally use
> `[excerpt name] (if it has a named excerpt) - [summary, 1–10 words] - [original date]`.
> Maybe the helper agent can recommend the summary and provide back the
> name? That involves sending some session content to the agent. But not
> all: maybe a few user/agent messages.

## Problem

Saving an unnamed room opens **Save session** (`WorkshopSaveSessionModal`)
with a title already filled in:

```ts
// WorkshopApp.tsx, suggestedSessionTitle
`${excerptSessionLabel} — ${activePersona.label} — ${today, e.g. "Nov 6"}`
```

It names the file and the persona, but not what the session was *about*,
and it carries today's date, not the day the room started. So the writer
retypes the middle every time, and the session browser fills with names
that only differ by date.

## Idea

When Save session opens on an unnamed room, the helper drafts the summary,
and code builds the name in Okey's pattern:

```
alice-ch3.md — The Rabbit's watch runs backward — Nov 4
└ excerpt name ┘ └──── helper's summary ────┘ └ started ┘
```

- **The helper writes only the summary** (1–10 words). The excerpt name and
  the date are facts the host already holds, so code adds them. The model
  never gets the chance to garble a file name or a date.
- **No named excerpt, no first part.** An open conversation, or a room whose
  excerpt has no source file, is `summary — date`.
- **The date is the room's start** (`startedAt`, kept by
  `WorkshopSessionTimeService`), not the day it was saved.

## Why it fits the helper as it is

Unlike the [Research Agent](../feature-workshop-research-agent/README.md),
this is exactly the helper's shape (ADR 2026-11-05 D1–D2): plain data in,
one capability-free call, a small JSON answer, validated by code and shown
to the writer before anything is saved. It adds one policy to
`HELPER_TASK_POLICIES` (`session-name`), with:

- its prompt section (`helper/10-session-name.md`);
- its worked example, decoded through the production codec;
- its budget in `PROMPT_BUDGETS.helper.sessionName`;
- its sync test.

The engine gets no branch for it.

## Proposed shape (mirrors `memory-draft`, D5)

1. **When.** Save session opens on an unnamed room that has at least one
   exchange. A named room already has its title, and an empty room has
   nothing to summarize; both keep today's behavior and ask for nothing.
2. **The webview sends ids only.** It posts a draft request with a minted
   request id. The host reads the room itself; it never takes text from the
   webview.
3. **What is sent: a few messages, never the room.** The host picks, in
   order:
   - the first two writer messages and the first persona reply (what the
     session set out to do);
   - the latest writer message and its reply (where it went).

   Each turn goes through the transcript projection
   (`projectWorkshopTranscriptTurn`), so host-private bodies (attachment
   text, widget payloads, context bodies) never enter. Each turn is cut to a
   per-turn bound, the whole to `inputCharacters`. Tool reports, the
   excerpt's text and context files are not sent.
4. **The answer is `{ summary }`.** It is checked by code: 1–10 words, one
   line (the shared `PROJECT_MEMORY_NOT_ONE_LINE` rule), within
   `summaryCharacters`, holding no date. A faulty answer is dropped and
   logged by fault kind.
5. **The host builds the title** and returns it with the summary. The result
   names its request id, and the sheet takes only the answer it still waits
   for.
6. **The writer's typing wins.** The field opens with today's default, as
   now. The draft replaces it only if the writer hasn't touched the field.
   A muted "Suggesting a name…" line shows while it drafts, and Save stays
   available throughout.
   - The stakes of a late swap are low: a named room's title can be changed
     with Save again.
7. **Failure is quiet.** On no key, an error, a timeout or a faulty answer,
   today's default stays. It is a usable name, so no failure line is needed.

## Open questions

- **The separator.** Today's default uses an em dash (` — `); Okey's
  pattern is written with a hyphen (` - `). Which?
- **The date format.** Today's is `Nov 6` (no year). With the room's start
  date, rooms from different years can collide. `Nov 6, 2026`, or
  `2026-11-06`?
- **The setting.** The helper's existing switch is
  `proseMinion.workshop.memory.helperDrafts`, which is scoped to memory. One
  Workshop-wide helper-drafts setting, or a second switch for names? The
  setting hasn't shipped, so a rename is free, but it belongs to the Helper
  Agent epic, not this note.
- **Which turns.** Is "first two, plus the latest exchange" the right
  sample? Should guest replies count as persona replies?
- **Export.** Export session also uses `suggestedSessionTitle`. Should it
  take the draft too, or only Save?

## Completion Criteria

- [ ] Save session on an unnamed room with an exchange fills the title as
      `[excerpt name] — summary — start date`, or `summary — start date`
      with no named excerpt.
- [ ] The helper receives only the chosen turns, through the transcript
      projection, within its bounds. A test pins what is sent and what is
      not (no excerpt text, context bodies, attachments or tool reports).
- [ ] The excerpt name and date come from code, never from the model's
      answer.
- [ ] A field the writer touched is never overwritten. Only the answer to
      the sheet's own request is taken.
- [ ] Failure, or the setting off, leaves today's default with no call (off)
      and no error.
- [ ] Logs carry the task, model, outcome and counts, never session text.
      Fixtures use *Alice*.

## Related

- [ADR 2026-11-05: A Helper Agent for Small Tasks](../../../docs/adr/2026-11-05-helper-agent.md)
  (on `epic/helper-agent` until it reaches `main`): D1 tasks as policies, D5
  `memory-draft`, the template this mirrors.
- [ADR 2026-10-05: Workshop Transcript Export](../../../docs/adr/2026-10-05-workshop-transcript-export.md):
  the one projection.
- [Workshop Research Agent](../feature-workshop-research-agent/README.md):
  the counter-example, a job that is *not* a helper task.

## Related Files

- `packages/core/src/presentation/webview/components/workshop/WorkshopSaveSessionModal.tsx`
- `packages/core/src/presentation/webview/WorkshopApp.tsx` (`suggestedSessionTitle`, `excerptSessionLabel`)
- `packages/core/src/application/services/workshop/WorkshopSessionTimeService.ts` (`startedAt`)
- `packages/core/src/application/services/workshop/transcript/WorkshopTranscript.ts`
- On `epic/helper-agent`: `infrastructure/api/services/helper/` (`HELPER_TASK_POLICIES`),
  `resources/system-prompts/helper/`, and `WorkshopMemoryDraftHandler` (the
  request/result pattern to mirror)
