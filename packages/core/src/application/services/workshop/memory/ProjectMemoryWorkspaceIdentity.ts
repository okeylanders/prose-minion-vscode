/**
 * Which accepted workspace a memory write was asked for (PR #202 F01): its
 * live room and its memory folder, captured when the writer asks, before the
 * library's write queue or the store's can wait. A write whose turn or
 * commit comes under another identity is withdrawn, even where the new
 * workspace holds a memory with the same id and file name.
 */

export interface ProjectMemoryWorkspaceIdentity {
  readonly room: string;
  readonly directory: string;
}

/** The identity `current` reads now, captured; `still()` while it is still the accepted one. */
export function askedProjectMemoryWorkspace(current: () => ProjectMemoryWorkspaceIdentity | undefined): {
  readonly asked: ProjectMemoryWorkspaceIdentity | undefined;
  readonly still: () => boolean;
} {
  const asked = current();
  return {
    asked,
    still: () => {
      const now = current();
      return asked !== undefined && now !== undefined && now.room === asked.room && now.directory === asked.directory;
    }
  };
}
