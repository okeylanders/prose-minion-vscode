# Concept Spring: Project Scratch Pad

**Status**: Concept spring
**Priority candidate**: Medium
**Classification**: Resource-backed widget
**Durable truth**: Project JSON resource
**Conversation rail**: One-shot visible event for each append

## Product idea

The **Project Scratch Pad** is a small shared notebook for the current writing
project. Writers and personas can read it and append entries. Opening the widget
shows the notebook and an add-entry surface; adding an entry leaves a visible
event in the Workshop thread and persists the entry independently of the
session.

It is global to the project, not to one Workshop session. A new room in the same
project sees the same pad.

## Honest ownership boundary

The file should live under the workspace, for example:

```text
<workspace>/.vscode/prose-minion/scratchpad.json
```

It should **not** live in the installed extension directory exposed by
`Workspace.extensionPath`; that directory contains bundled extension resources
and may be replaced by an extension update. Workspace storage also makes the
writer's ownership legible: the file can be committed, ignored, backed up, or
edited with ordinary project tools.

Multi-root workspaces need an explicit selected-folder policy. Silently writing
to the first folder is not acceptable once this moves beyond a concept spring.

## Entry shape

The JSON resource is schema-versioned and contains append-oriented entries:

- stable entry id;
- created timestamp;
- actor (`writer` or persona id);
- note text;
- optional tags;
- optional related passage/resource refs;
- optional source session/turn provenance;
- future archive/supersede metadata.

Appending is the default mutation. Editing or deleting old entries is deferred
until its provenance and collaboration semantics are designed.

## Interaction and permissions

- **Writer read**: open the widget to browse/filter all entries.
- **Writer append**: add directly; persist the JSON entry and emit a visible
  thread event with a re-openable chip.
- **Persona read**: use a closed `scratchpad.list` / `scratchpad.read`
  capability on demand. The pad is not injected into every prompt merely
  because it exists.
- **Persona append**: use a closed `scratchpad.append` capability. Stage the
  validated append during the run and make it durable with the successful turn
  commit, so a failed/cancelled response cannot leave an unexplained project
  mutation. The committed turn visibly attributes the addition.

The capability enforces project containment, size ceilings, entry limits, and
schema validation. Model-authored paths are never accepted as write targets.

## Relationship to Conversation Widgets

The widget host owns discovery, modal lifecycle, authoring UI, and the visible
thread chip. The Scratch Pad service owns the project file. The note itself does
not become standing prompt context; its thread event may ride the one-shot
artifact rail, while future personas re-read the canonical resource on request.

This is intentionally a **resource-backed widget**, not a third influence rail.

## Likely UI

- **Add** and **Browse** tabs;
- newest-first entries with actor, timestamp, tags, and related-resource chips;
- search/filter by text, actor, and tag;
- project-folder selector in multi-root workspaces;
- explicit file location plus "open JSON resource" affordance;
- empty, malformed-file, merge-conflict, and write-failure states that do not
  discard the writer's draft.

## Smallest useful slice

One selected workspace folder; schema-versioned read + append; writer UI;
persona on-demand read and staged append; visible thread events. Search, edit,
archive, and multi-project aggregation can follow.

## Promotion questions

- Is `.vscode/prose-minion/scratchpad.json` the desired visible path, or should
  Prose Minion use a project-owned top-level directory?
- For multi-root workspaces, does the writer choose once per session, once per
  project, or on each new pad?
- Should persona append always require confirmation, or is visible,
  capability-bounded direct append the intended default?
- The current `FileSystem` port can read/write but has no rename primitive. Do
  we extend it for temp-write + atomic replace before promising crash-safe JSON
  updates?
