# PR #235: Slice 5 live-pass checklist review

Date: 2026-11-06
Original reviewed head: `41c2bb58c3c9115b79cf624a3552b0cc9946a724`
Correction reviewed: `20e0b3b08b43839854b54129a0a6abb281d60833`
Base: `9f70f23676250e629dabec4790f60d80c74db987`
Scope: the two changed planning documents, checked against the implementation at that head, the ADR, and the final #233/#234 reviews.

## Disposition

**Approved for the checklist/documentation scope. F-01 is corrected and closed at `20e0b3b0`.** The correction supplies a deterministic two-entry fixture and explicit checkbox preparation. No remaining blocking finding was found. The plan correctly leaves native VS Code, visual and accessibility acceptance for the live pass.

Slice 4c remains a prerequisite. This review does not approve #236's implementation, certify the live pass, accept the ADR, or authorize a merge.

## Re-review of the correction

The only checklist change since the original review is the F-01 correction:

- The preview section now says its confirmation entries begin unticked and must be selected.
- Step 9 explicitly ticks the entry before applying.
- Step 10 names two non-touching replacements, verifies two separate entries, ticks both, unticks one, and checks that only the ticked change landed with the 1-of-2 tally.
- It retains the uncertainty-safe wording check and the discarded-preview return to pending.

The supplied fixture matches the independent production-planner witness below. The correction changes no production code. Relative-link and checklist-number checks were repeated; both pass. The earlier report head `ca41ed558403fbeeefb509fa3d87975db4b8288b` also passed [CI run 42218784756](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42218784756). Correction-head and final-report-head CI are checked independently on the PR; no not-yet-finished run is called green here.

## F-01 (P2, closed): Use two independent preview entries and explicitly select them

The following records the original finding and its evidence. It no longer describes an open defect.

Location: `.todo/epics/epic-workshop-persona-file-edits-2026-11-05/slice-5-verify-live.md:66–71`, especially step 10.

The recipe starts with “two or more operations,” says to untick one entry, and expects “1 of 2 changes applied.” Those conditions do not establish that outcome:

1. The VS Code adapter marks every preview edit with `needsConfirmation: true`. Its documented host contract is that these entries start unchecked. Step 9 must explicitly tick the intended entry or entries before applying, and step 10 must establish which entries are selected before unticking one.
2. Two operations need not make two preview entries. `planTextEdits` joins touching ranges into one edit, retaining both operation indexes. The gateway sends that planned edit as one preview entry. A card with two touching replacements therefore cannot select one operation and leave the other behind in this preview.
3. “Two or more” operations also does not establish the exact two-operation tally asserted by the recipe.

**Correction:** use exactly two non-touching replacements in a notes fixture, verify that two independently selectable entries appear, tick both, untick one, then apply. Check that precisely the selected replacement landed, the other original remains, and the card says “1 of 2 changes applied.” Step 9 should explicitly tick all intended entries before Apply.

An example fixture is “Alice is curious. The White Rabbit is late.” with `curious → brave` and `White Rabbit → Hatter`. The gateway's existing partial-apply test uses these separated replacements and selects only the first.

### Evidence

- `apps/vscode-extension/src/platform/vscode/VsCodeDocumentEditor.ts`: adapter contract and `applyEdits` metadata.
- `packages/core/src/utils/textEdits/planTextEdits.ts`: `joinTouching` groups ranges and retains all contributing operation indexes.
- `packages/core/src/application/services/fileEdits/ProjectFileEditGateway.ts`: one applier edit per planned edit, with outcomes mapped back to operations.
- `packages/core/src/__tests__/utils/textEdits/planTextEdits.test.ts`: “joins replaces that touch into one edit, carrying both operations.”
- `packages/core/src/__tests__/application/services/fileEdits/ProjectFileEditGateway.test.ts`: “reads a partial apply, a discarded preview and a document closed during the apply.”

An independent check executed the production planner at the reviewed head, without copying its implementation. Two touching replacements produced **2 operations / 1 preview entry**; the separated fixture produced **2 operations / 2 preview entries**. Both assertions passed.

Reproduction with Node 24 from the repository root (the resolver only supplies the repository's TypeScript path alias):

```sh
node --input-type=module <<'JS'
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/')) {
      return next(pathToFileURL(
        process.cwd() + '/packages/core/src/' + specifier.slice(2) + '.ts'
      ).href, context);
    }
    return next(specifier, context);
  }
});
const { planTextEdits } = await import(
  './packages/core/src/utils/textEdits/planTextEdits.ts'
);
const replace = (find, withText) => ({ op: 'replace', find, with: withText });
const touching = planTextEdits('Alice checked its watch.', [
  replace('checked its ', 'consulted its '),
  replace('watch.', 'watch!')
], { allowsRewrite: true });
assert.equal(touching.kind, 'planned');
assert.equal(touching.operations.length, 2);
assert.equal(touching.edits.length, 1);
assert.deepEqual(touching.edits[0].operations, [0, 1]);

const separated = planTextEdits('Alice is curious. The White Rabbit is late.', [
  replace('curious', 'brave'),
  replace('White Rabbit', 'Hatter')
], { allowsRewrite: true });
assert.equal(separated.kind, 'planned');
assert.equal(separated.edits.length, 2);
assert.deepEqual(separated.edits.map(edit => edit.operations), [[0], [1]]);
console.log('PASS: touching 2→1; separated 2→2.');
JS
```

## Nonblocking execution notes

- Turn VS Code Auto Save off for the “tab is dirty” observations. The extension does not call save, but that does not prevent the editor's own Auto Save from saving.
- Step 19's retained-turn case is Open, Branch or Rewind. New clears the old turn; it is a separate removal/reset control, not a way to keep that disclosure mounted.
- Step 7's ceiling is 60% of the **characters in** the distinct touched paragraphs, not 60% of their count.
- If practical, include #234 F-02's refused-preview close/reopen control in the live pass: an explicit reopen may retry; leaving the refused disclosure open must not create a retry loop. Automated coverage already exists, so this is not an additional blocker.
- Keep retries limited to failures established to have written nothing. Any post-dispatch uncertainty remains unknown with no Apply. Step 23 is a requirement for Slice 4c, not a description of the pre-4c code on this head.

## Reconciliation with prior work

- #233's [host review](https://github.com/okeylanders/prose-minion-vscode/pull/233#pullrequestreview-5794560567) approved the claim/checkpoint/dispatch scope with a nonblocking partial/unknown wording note.
- #234's [final review](https://github.com/okeylanders/prose-minion-vscode/pull/234#pullrequestreview-5794690525) closed F-01 (room replacement), F-02 (refused preview reopen), and that wording note. Its [final CI update](https://github.com/okeylanders/prose-minion-vscode/pull/234#issuecomment-6674794913) explicitly left native acceptance to Slice 5.
- The README's summary of those conclusions agrees with the final reviews. No old finding is reopened here.
- The class labels, note rewrite/front-matter rule, protected-syntax refusal, prose ceiling, stale replacement/rewrite behavior, pending-only actions, discarded-preview return to pending, uncertainty-safe partial wording, reload-to-unknown rule, shared reason words and text-free file-edit logs have corresponding implementation seams.
- The three recorded product decisions are internally consistent as requirements. This review checked their treatment in the documents; it does not independently attest to a separate conversation in which they were given.
- The checklist gates Slice 5 on Slice 4c and leaves the session-codec release decision and ADR acceptance until close-out.
- No existing #235 comment or review was present when this review was reconciled.

## Verification and limits

- `git diff --check` from the exact base to the reviewed head: passed.
- All **14 relative Markdown links** in the changed documents resolve.
- Live checklist numbering is exactly **1 through 26**.
- Independent production-planner witness above: passed.
- [CI run 42211973905](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42211973905), recorded for head `41c2bb58c3c9115b79cf624a3552b0cc9946a724`: **success**. Its `verify` job passed all three typecheck targets, tests, lint and both webpack bundles.
- No local full Jest/typecheck/build rerun was performed for this docs-only review. The CI results above are remote results, not local claims.
- No live provider call, Extension Development Host pass, native Refactor Preview, screen-reader or visual inspection was performed.
- No production source was changed. No merge or deployment was performed. #205 remains outside this review.
- The report publication creates a new documentation head; its CI is checked separately and recorded on the PR, rather than treating the older head's green run as proof of the new one.
