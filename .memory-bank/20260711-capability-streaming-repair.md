# Capability Streaming Repair — 2026-07-11

## Trigger

After Sprint 06A's XML transport landed, Dialogue, Prose, Writing Tools, and
Context appeared to hang: the webview received a complete answer only at the
end, and the output channel no longer showed `STREAM_CHUNK` posts.

## Root Causes

The regression was the combination of four contract changes:

1. `AgentRunEngine.executeTurn()` buffered every token whenever an
   `AgentCapability` was present. Those capabilities are present for the
   default craft-guide routes and every Context route, so final prose no longer
   streamed normally.
2. `GuideCapability` and `ContextFileCapability` collapsed structural XML
   parsing and allow-list authorization into one `parseExactRequest()` result.
   A well-formed request containing one reconstructed or undisplayed key became
   indistinguishable from ordinary final prose. The display sanitizer then
   removed the protocol markup and returned an empty result. Before `8276bc8`,
   syntax recognition entered the capability loop and authorization failure was
   returned to the model as evidence.
3. The committed shared instruction required bare XML but illustrated it inside
   a Markdown fence with the fake key `allow-listed/path.md`. Models following
   either part of that example produced a strict-parser or allow-list rejection.
4. Context's system prompt ordered the model to request the source file and
   adjacent resources even when their exact opaque keys were not displayed in
   the capped catalog. It also invited closest-match reconstruction and
   model-side path sanitization, contradicting the opaque-key contract.

The previous generic suppression log did not preserve enough structural data to
recover which of these shapes occurred in an already-completed live run. The
new diagnostics identify failures as `markdown-fence`, `mixed-content`,
`malformed-xml`, `path-not-allowlisted`, and other closed reason codes. After a
live `mixed-content` failure showed the model narrating its guide selection,
rejected assistant responses are now logged in full between explicit BEGIN/END
delimiters for diagnosis. This opt-in repair decision means those error logs may
contain model-quoted user text and should be treated as private.

## Repair

- Added `ToolCallStreamVisibilityGuard`: it retains only a suffix long enough
  to recognize `<prose-minion-tool-call`, immediately streams ordinary prose,
  and withholds protocol markup.
- Exact XML requests stay hidden and are handled by the SAX codec as before.
- Capability response inspection now distinguishes no request, an authorized
  exact request, and a rejected protocol-shaped request. Structural and
  allow-list rejection remain strict and happen before any resource read.
- Invalid protocol output receives one capability-owned correction turn. A
  repeated invalid response or any otherwise empty completed response produces
  explicit fallback prose rather than a blank panel. This behavior is shared by
  streaming and non-streaming runs.
- A narrated resource-intent preamble (for example, “I need to access several
  guides…”) is held provisionally and discarded when XML follows, so the writer
  sees the accepted-request status and the later output turn rather than model
  planning. The correction turn now requires the model to resubmit the intended
  bare XML request instead of inviting it to give up and answer without evidence.
- Accepted guide calls restore the old filename-based requested-guide ticker.
- Guide and retained Workshop tool policies now force a final response after
  their bounded resource rounds, matching Context's safe behavior. If the
  forced final turn returns XML again, the engine retries once; a second XML
  response surfaces an explicit failure rather than an empty result.

## Follow-up: XML Request Compatibility

Live runs then showed `Suppressed invalid or mixed resource-call markup` for
both Guide and Context capabilities. The resolver was still using the whole
relative `path/file.md` string as its lookup key; it was not splitting it. The
prompt had instead taught a contradictory response: the exact XML sample was
inside a Markdown fence despite forbidding one, and its sample path was not in
the catalog allow-list.

- The shared instruction now uses one real, displayed catalog key in bare XML.
- It explicitly calls that key opaque: copy directory/path and filename
  together; never construct it from a label, group, workspace, or filename.
- A Markdown-fenced XML attempt is withheld and gets the existing final-prose
  recovery, rather than rendering as an empty code block.
- Context now accepts only the first 100 paths actually displayed in its
  capped catalog, rather than any indexed-but-hidden path.
- Context prompt language now requests only displayed opaque keys, treats a
  source URI as provenance rather than a key, and never asks the model to
  reconstruct a closest match.
- `Invalid URL` while reading Context's optional source document is separate:
  it means the supplied source reference was not a `file:` URI and does not
  cause resource-call rejection.

## Verification

- Focused engine/codec/capability/route regressions: 5 suites / 38 tests. The
  route suite covers Dialogue, Prose, Writing Tools editor, and Context through
  the real engine.
- Full Jest: 75 suites / 579 tests passed.
- Full typecheck, lint (0 errors; 599 repository warnings), build, bundle
  verification, and `git diff --check` passed.

## Follow-up: Tolerant Tail Extraction (same day)

A live Haiku run complied semantically twice and was still rejected twice:
first `mixed-content` (one narrated sentence before a valid, allowlisted
call), then `markdown-fence` (bare XML inside a fence on the correction
turn), exhausting the single correction turn. Sonnet passed the strict
contract; faster models follow its spirit.

Resolution (Postel boundary): the prompt still demands one bare XML document,
but `ResourceReadXmlCodec.inspect()` now slices from the first protocol
marker, strips one trailing fence close, and strictly SAX-parses that tail.
Narrated preambles, XML declarations, and Markdown fences around an
otherwise-exact call are discarded instead of fatal. Any content after the
closing tag still rejects (`mixed-content`), so protocol markup quoted
mid-prose remains non-executable; the allowlist and bounded rounds are
unchanged. The now-unreachable `markdown-fence` reason code was removed.
Both Haiku attempts above now accept on the first turn, and the correction
turn is reserved for genuinely invalid requests (bad paths, malformed XML).

Diagnostics: the accepted-request log now names the requested paths, and a
new delivery log records `delivered/requested` counts plus evidence size —
a `3/4` ratio surfaces a silent guide-load failure. Engine tests now build
their capability mock on the production codec plus an allowlist, so they
track the real accept/reject contract.

Verification after the follow-up: full Jest 75 suites / 583 tests, typecheck,
and lint on touched files all pass.

## Remaining Manual Check

In a GUI-capable Extension Development Host, verify `STREAM_CHUNK` entries
resume in the Output channel for Dialogue, Prose, Writing Tools, and Context;
an XML request itself must remain invisible.
