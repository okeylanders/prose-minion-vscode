# Workshop Session Collaborator Conventions

`WorkshopSessionService` is the aggregate facade and whole-session consistency
boundary. Classes in this directory own one closed piece of session state; they
do not perform I/O and remain invisible to handlers.

Every state-owning collaborator supports `exportState`, `prepareState`,
`installPreparedState`, and `reset`. Hydration treats values produced during
the prepare phase as aggregate-owned mutable drafts: the aggregate may perform
throw-free degradation reconciliation before the shared install barrier. All
validation, cloning, and other potentially throwing work stays above that
barrier; every install method below it is assignment-only and must not throw.

Use direct mutation for ordinary synchronous operations. Add a narrower
prepare/install mutation contract only when the caller must interleave provider
I/O between those phases. Time-dependent collaborators require an injected
clock rather than a local default.

Reset behavior follows identity lifetime. Preserve a counter when its IDs must
never recur during the aggregate's lifetime, as with turns and todos. Reset a
counter when the records and every historical reference to their IDs are fully
invalidated, as with widget configurations and standing directives.
