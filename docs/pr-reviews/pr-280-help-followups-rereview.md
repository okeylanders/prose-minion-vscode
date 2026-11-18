# PR #280 re-review

Reviewed `b58aa7cf4ac22cc80466b745dd77a98106490668` against the previous review of `f2745f41`. Both P2 findings and the mismatch-copy note are resolved. No new blocking findings.

- Help removes ignored terms from phrase scoring; the tie-breaking fixture now preserves hit order when the ninth word is appended. The shared parser and recall behavior have not changed.
- Pre-reader refusals use the loaded reference version after a successful read. Before loading, they correctly label only the installed version. Reading the cached label does not trigger I/O. The caveat and persona prompt no longer assume that the installed version is newer.
- Re-ran 12 targeted Jest suites at the revised head: 145 tests passed. Coverage included before- and after-load refusals, long-query ordering, privacy, prompt synchronization, retry, and provider assembly. Did not rerun the full repository suite or perform a live VS Code pass.
