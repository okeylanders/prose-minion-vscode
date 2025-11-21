# PR-31 Review (Codex)

Date: 2025-11-20
Reviewer: Codex (GPT-5)

## Findings
- **High – Fast gen block timeouts don’t cancel real requests**: `DictionaryService.generateSingleBlock` races a timeout against `executeWithoutCapabilities`, but the underlying OpenRouter call is not aborted. A timed-out block will keep burning tokens while the retry runs, so concurrency and cost can double. The stack (`AIResourceOrchestrator.executeWithoutCapabilities` → `OpenRouterClient.createChatCompletion`) does not accept a `signal` or `timeoutMs`, so there’s no cancellation support yet.
- **Medium – Docs path + wording mismatch**: `docs/CHANGELOG-DETAILED.md` claims prompts live under `resources/system-prompts/dictionary-parallel/` and repeats the “Works best…” line. Actual code uses `resources/system-prompts/dictionary-fast/…`, so the doc misleads contributors.
- **Low – README copy inconsistency**: The “Fast Dictionary Generate” blurb doesn’t match the UI label (“Fast Generate (Experimental)”) and crams model guidance into the same line. Worth polishing for clarity but not blocking.

## Recommendations
- Add abortable requests: extend `AIOptions` and `OpenRouterClient.createChatCompletion` to accept `signal?: AbortSignal` (and optionally `timeoutMs?: number`), pass `signal` through `executeWithoutCapabilities`, and use an `AbortController` in `DictionaryService.generateSingleBlock` (new controller per attempt, clear timer, abort on timeout). If you add `timeoutMs`, set a timer to call `abort`.
- Update docs: point the prompt path to `resources/system-prompts/dictionary-fast/` and fix the duplicated “Works best…” sentence. Optionally align README wording to the button label and move model advice to its own sentence.
