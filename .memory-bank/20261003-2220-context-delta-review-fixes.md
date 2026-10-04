# PR #123: acknowledged context deltas and model-window preflight

User authorized the attachment-delta and model-window guard follow-up on
`fix/anthropic-prompt-caching`. PR: https://github.com/okeylanders/prose-minion-vscode/pull/123.

Standing-context updates now compare prompt-bearing attachment fingerprints
against the host's last successful delivery. Only changed/new bodies and
explicit removed ids are sent. Capture initial delivery before provider I/O;
acknowledge exactly the delivered generation, retaining newer pending edits.
Failures retain the old acknowledgement. Persist the compact baseline and
invalidate it on host loss or rewind past its acknowledged revision. Missing
baselines require one full resynchronization; retained history is never rewritten.

Each inference checks estimated history, tool envelope, and in-turn evidence
plus output reserve and 5% headroom against live cached model-window metadata.
Unknown/offline fallback metadata leaves validation to the provider and logs
that limitation for retained requests. This is a prose-oriented estimate, not
an exact tokenizer guarantee. A refusal preserves history and pending updates.

Review findings F-01, F-02, F-04, F-10, and F-11 are addressed. Persona prompt
ceilings match shared budgets with a mutation-verified sync test. Gesture source
allowance derives from standing-context plus excerpt character ceilings. The
caching ADR correctly describes fresh runtime ids after rewind. Seven 10K-word
message attachments (up to 70K words) and 100K-word standing context remain
intentional intake limits; model capacity is checked separately.

Other review findings remain at their existing ledger status, including F-18's
word-only standing intake. Live paid Claude/Qwen cache acceptance is still
tracked separately. No paid provider requests were made in this pass.

Validation: 236 Jest suites, 2,932 tests, and 2 snapshots passed; monorepo
typecheck, production build/bundle verification, changed/new-file ESLint
(zero errors, existing warnings), and diff checks passed.

Design: `docs/adr/2026-10-03-workshop-context-delta-delivery.md`.
Review ledger: `docs/pr-reviews/pr-123-provider-prompt-caching-review.md`.

Unrelated release memory entries and `Prose Minion.zip` were left untouched.
