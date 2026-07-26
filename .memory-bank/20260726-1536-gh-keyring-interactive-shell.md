# GitHub CLI keyring requires an interactive shell

**Recorded**: 2026-07-26
**Scope**: Local Codex/Ada publishing workflow on Okey's macOS checkout

## Observed behavior

Running `gh auth status` through the ordinary non-interactive command runner
reported the active `okeylanders` token as invalid, even though the user's
terminal showed a valid keyring-backed GitHub session.

The same check succeeds when invoked through an interactive zsh attached to a
TTY:

```sh
zsh -ic 'gh auth status'
```

It reports the active `okeylanders` account, HTTPS Git operations, and the
expected `repo` / `workflow` scopes.

## Working rule

For GitHub CLI authentication checks and authenticated `gh` commands in this
workspace, use an interactive TTY invocation:

```sh
zsh -ic 'gh <command>'
```

Do not ask Okey to reauthenticate solely because the non-interactive runner
cannot see the macOS keyring credential; confirm through interactive zsh first.
