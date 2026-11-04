/**
 * Workshop Project Memory: one memory, as its file holds it (format 1;
 * epic 2026-11-04, Slice 1, from the feature note's "The memory file").
 * The closed vocabularies and the field bounds live here beside the type,
 * so the codec, the store and (later) the manager and the proposal trailer
 * read one list. The ADR may move the bounds into `PROMPT_BUDGETS`.
 *
 * A memory is writer data: it travels with the project, the writer may
 * edit its file by hand, and a released change to its meaning takes a new
 * `format` (ADR 2026-07-30's release rule).
 */

/** The one format this build reads and writes. */
export const PROJECT_MEMORY_FORMAT = 1;

/**
 * What a memory is about:
 * - `decision`: a choice the project made ("we cut the sister subplot");
 * - `canon`: a story fact ("the Rabbit's watch runs backward");
 * - `preference`: how the writer likes to work ("structure before line edits");
 * - `open-thread`: a question to come back to ("does the Duchess know?").
 */
export const PROJECT_MEMORY_KINDS = ['decision', 'canon', 'preference', 'open-thread'] as const;
export type ProjectMemoryKind = typeof PROJECT_MEMORY_KINDS[number];

/**
 * `active` memories are in the catalog; `superseded` ones were replaced by a
 * newer memory that names them in `supersedes`; `archived` ones the writer
 * put away. The last two stay searchable; nothing deletes a memory on its own.
 */
export const PROJECT_MEMORY_STATUSES = ['active', 'superseded', 'archived'] as const;
export type ProjectMemoryStatus = typeof PROJECT_MEMORY_STATUSES[number];

/** `proposed`: a persona proposed it (provenance required); `writer`: the writer made it. */
export const PROJECT_MEMORY_ORIGINS = ['proposed', 'writer'] as const;
export type ProjectMemoryOrigin = typeof PROJECT_MEMORY_ORIGINS[number];

/**
 * Field bounds, in UTF-16 code units (as a text field's `maxLength` counts):
 * title and summary are one line each; the body is free Markdown.
 */
export const PROJECT_MEMORY_FIELD_CHARACTERS = {
  title: 120,
  summary: 280,
  body: 8_000
} as const;

/** At most this many source turns, and this many superseded memories, per memory. */
export const PROJECT_MEMORY_LIST_ENTRIES = {
  sourceTurns: 32,
  supersedes: 8
} as const;

/** A memory's id: `mem-` and six lower-case hex digits, minted by the store. */
export const PROJECT_MEMORY_ID = /^mem-[0-9a-f]{6}$/;

export interface ProjectMemory {
  readonly id: string;
  readonly title: string;
  readonly kind: ProjectMemoryKind;
  /** One line: what the catalog shows. */
  readonly summary: string;
  readonly status: ProjectMemoryStatus;
  /** A pinned memory's body loads whole in every room's catalog. */
  readonly pinned: boolean;
  /** ISO 8601, UTC (`2026-11-03T14:22:05Z`, milliseconds optional), as written. */
  readonly created: string;
  readonly updated: string;
  readonly origin: ProjectMemoryOrigin;
  /** The persona that proposed it; only for `origin: proposed`, which requires it. */
  readonly proposedBy?: string;
  /** The Workshop session it came from; required for `origin: proposed`. */
  readonly sourceSession?: string;
  /** The turn ids it came from, in order; at least one for `origin: proposed`. */
  readonly sourceTurns: readonly string[];
  /** The ids of the memories this one replaces. */
  readonly supersedes: readonly string[];
  /** Free Markdown; trailing white space is not kept. May be empty. */
  readonly body: string;
}
