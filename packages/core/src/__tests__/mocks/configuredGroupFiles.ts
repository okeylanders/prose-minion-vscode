/**
 * The authoritative group listing a reader of `{ group, path }` names a
 * pair's file from (ADR 2026-11-20 S50), for tests whose subject is not the
 * listing. Production has no default, so every test that builds such a
 * reader passes one of these, or the real resolver.
 */
import type {
  ConfiguredGroupFile,
  ConfiguredResourceGroupFiles
} from '@/application/services/ConfiguredResourceLookup';
import type { ContextPathGroup } from '@shared/types';

/** A listing that cannot be read: a pair named through it is `unverified`. For tests that name no pair. */
export const UNLISTED_GROUP_FILES: ConfiguredResourceGroupFiles = Object.freeze({
  listGroupFiles: async (): Promise<readonly ConfiguredGroupFile[]> => {
    throw new Error('This test lists no group.');
  }
});

interface ListedSummary {
  /** Test fakes often type a group as plain text. */
  readonly group: string;
  readonly path: string;
  readonly absolutePath: string;
}

/**
 * The same files a test's browse catalog fakes, by the same absolute paths,
 * so each pair resolves to its own browse entry.
 */
export function groupFilesOver(
  summaries: () => readonly ListedSummary[]
): ConfiguredResourceGroupFiles & { listGroupFiles: jest.Mock } {
  return {
    listGroupFiles: jest.fn(async (groups: ContextPathGroup[]) => summaries()
      .filter((summary) => (groups as readonly string[]).includes(summary.group))
      .map((summary) => ({
        group: summary.group as ContextPathGroup,
        relativePath: summary.path,
        absolutePath: summary.absolutePath
      })))
  };
}

