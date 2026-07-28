# ESLint 10 audit remediation

**Status:** Open
**Priority:** Medium
**Discovered:** 2026-07-28 during v2.1.0 release preparation

## Problem

After the compatible `npm audit fix` updates, `npm audit --audit-level=high`
still reports 32 high-severity advisories through the legacy ESLint 8,
`@typescript-eslint` 5, Jest 29, and Sucrase dependency chains. npm offers a
full remediation only through `npm audit fix --force`, which upgrades ESLint to
10 and is a breaking tooling migration.

## Scope and risk

The remaining paths are development and packaging tooling only; they are not
included in the VSIX runtime payload. Do not run the forced audit fix as part
of a feature or release-prep change without validating the ESLint/TypeScript
ESLint configuration and the Jest toolchain together.

## Completion criteria

- Upgrade ESLint and compatible `@typescript-eslint` tooling deliberately.
- Reconcile any flat-config/configuration migration required by ESLint 10.
- Verify lint, tests, typecheck, build, VSIX packaging, and a clean audit.
