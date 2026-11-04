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
 * What is stored: `active` memories are in the catalog; `archived` ones the
 * writer put away. Superseded is derived, never stored: a memory is
 * superseded while any readable memory names it in `supersedes`
 * (`supersededProjectMemoryIds`), so a supersession is one new file and
 * never a rewrite of the old one. Archived and superseded memories stay
 * searchable; nothing deletes a memory on its own.
 */
export const PROJECT_MEMORY_STATUSES = ['active', 'archived'] as const;
export type ProjectMemoryStatus = typeof PROJECT_MEMORY_STATUSES[number];

/**
 * `writer`: the writer made it; `proposed`: a persona proposed it and the
 * writer saved it; `auto`: saved on a persona's proposal under "Save and
 * tell me". The last two require their provenance.
 */
export const PROJECT_MEMORY_ORIGINS = ['writer', 'proposed', 'auto'] as const;
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

/** A memory's id: `mem-` and six lower-case hex digits, minted by the store. Never read from a file name. */
export const PROJECT_MEMORY_ID = /^mem-[0-9a-f]{6}$/;

/**
 * A Workshop turn id, as `WorkshopTurnLedger` mints it: `turn-<n>-<role>-<epoch ms>`.
 * Its digit runs are bounded (a counter of at most 9 digits, a time of at
 * most 16), so the field bounds imply a byte bound (PR #194 F-05).
 */
export const PROJECT_MEMORY_SOURCE_TURN = /^turn-\d{1,9}-(?:user|assistant|system)-\d{1,16}$/;

/** The largest memory file read; a larger one is unreadable (`too-large`), and none is written (`file-too-large`). */
export const PROJECT_MEMORY_FILE_BYTES = 256 * 1024;

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
  /** The persona that proposed it; required for `proposed` and `auto`. */
  readonly proposedBy?: string;
  /** The Workshop session it came from; required for `proposed` and `auto`. */
  readonly sourceSession?: string;
  /** The turn ids it came from, in order; at least one for `proposed` and `auto`. */
  readonly sourceTurns: readonly string[];
  /** The ids of the memories this one replaces. */
  readonly supersedes: readonly string[];
  /**
   * Everything after the closing `---` line, byte for byte (a rewrite keeps
   * it exactly, line endings included). `projectMemoryBody` gives a new
   * memory's body its blank separating line.
   */
  readonly body: string;
}

/** A new memory's body from its Markdown: a blank line after the frontmatter, then the text and one newline; empty for none. */
export function projectMemoryBody(markdown: string): string {
  const text = markdown.replace(/\s+$/, '');
  return text.length > 0 ? `\n${text}\n` : '';
}

/**
 * The ids superseded among the given readable memories: derived, never
 * stored (ADR 2026-11-04 D4). A memory is superseded when another names it
 * in `supersedes`, unless the two are on a cycle (it names, directly or
 * through others, the memory that names it): in a cycle, neither is
 * superseded (PR #194 N-01). An id no given memory holds may be superseded
 * too.
 */
export function supersededProjectMemoryIds(memories: readonly Pick<ProjectMemory, 'id' | 'supersedes'>[]): Set<string> {
  const names = new Map<string, readonly string[]>();
  for (const memory of memories) {
    names.set(memory.id, [...(names.get(memory.id) ?? []), ...memory.supersedes]);
  }
  /** Whether `from` reaches `to` along `supersedes`. */
  const reaches = (from: string, to: string): boolean => {
    const seen = new Set<string>([from]);
    const queue = [from];
    while (queue.length > 0) {
      for (const next of names.get(queue.shift() as string) ?? []) {
        if (next === to) {
          return true;
        }
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return false;
  };
  const superseded = new Set<string>();
  for (const [newer, older] of names) {
    for (const id of older) {
      if (id !== newer && !reaches(id, newer)) {
        superseded.add(id);
      }
    }
  }
  return superseded;
}
