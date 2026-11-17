# PR #277: Workshop persona lens reads

Reviewed code head `8f57e65d9cc3d9fe0515c2c4febbe2a021d04222`. **Changes requested: one P2 privacy finding.**

## F-01: A persona lookup logs private lens filenames from the entire library

Both `lens.catalog` and `lens.read` call `this.library.list()` (WorkshopLensCapability.ts). In production, extension.ts:425–441 supplies a real LexicalGravityLensRepository wired to the extension output channel. Its readLens catch (LexicalGravityLensRepository.ts:338–345) logs the failed filename and raw error message. Filenames are derived from lens subjects; a slug mismatch also logs the declared slug. Even reading a built-in causes unrelated malformed project files to be logged. The result card only reporting a count does not prevent this side effect. This violates ADR D19's operation/count/outcome-only logging contract.

The existing repository test “tolerates unrelated corrupt files in the catalog” verifies the disclosure directly by expecting `Skipped broken.json`. The persona tests using a stub library do not cover the production logging path. Remove filename/error text from these diagnostics, or provide a count-only repository listing mode for persona callers if widget diagnostics need different behavior. Add a test running a persona lookup against the real repository and a shared recording logger with a malformed privately named file; assert the count is preserved and neither slug nor raw error appears anywhere in the output.

## Verification

Inspected catalog merge and paging, section rendering and window fitting, installed-lens wiring, XML validation, prompt framing, and recommendation isolation. Seven lens and prompt suites passed (101 tests); persona capability and real storage suites passed (48 tests). All three TypeScript projects passed `npm run typecheck`. No full Jest rerun or live extension/model pass. No implementation or merge changes.
