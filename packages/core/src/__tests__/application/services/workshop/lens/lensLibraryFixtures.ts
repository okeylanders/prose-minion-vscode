/**
 * Made-up *Alice* lenses and library ports for the `lens.*` tests (ADR
 * 2026-11-17 D16–D20). Never a writer's lens.
 */
import type { WorkshopLexicalGravityLens } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { CapabilityContextWindow } from '@orchestration/AgentRunContracts';
import {
  LexicalGravityLibraryUnavailableError,
  type LexicalGravityLensCatalog
} from '@/infrastructure/storage/LexicalGravityLensRepository';
import { builtInLexicalGravityLenses } from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityLenses';
import { validateLexicalGravityLens } from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityConfigCodec';
import { WorkshopLensCapability, type WorkshopLensLibraryPort } from '@/application/services/workshop/lens/WorkshopLensCapability';

/** A project with no lens of its own: the built-ins are the whole library. */
export const noProjectLenses: WorkshopLensLibraryPort = {
  list: async () => ({ lenses: [], incompatibleResources: [] })
};

/** A valid project lens: a built-in's shape under a made-up slug, name and subject. */
export function aliceLens(
  slug: string,
  overrides: Partial<Omit<WorkshopLexicalGravityLens, 'slug' | 'version' | 'source'>> = {}
): WorkshopLexicalGravityLens {
  const [shape] = builtInLexicalGravityLenses();
  return validateLexicalGravityLens({
    ...shape,
    slug,
    source: 'project',
    name: `Alice ${slug}`,
    originQuery: 'a mad tea party',
    variant: 'the table that never clears',
    description: 'Cups, clocks and bad manners.',
    ...overrides
  });
}

/** `count` project lenses, `alice-000` up; the name sorts as the slug does. */
export function aliceLenses(count: number): WorkshopLexicalGravityLens[] {
  return Array.from({ length: count }, (_, index) => aliceLens(`alice-${String(index).padStart(3, '0')}`));
}

/** A library that lists `lenses`, with `unreadable` files that did not read. */
export function lensLibrary(lenses: readonly WorkshopLexicalGravityLens[], unreadable = 0): WorkshopLensLibraryPort {
  const catalog: LexicalGravityLensCatalog = {
    lenses: [...lenses],
    incompatibleResources: Array.from({ length: unreadable }, (_, index) => ({
      resourceName: `broken-${index}.json`,
      foundVersion: null,
      rebuildQuery: 'broken',
      message: 'could not be loaded'
    }))
  };
  return { list: async () => catalog };
}

/** A workspace with no folder, or several: the repository's own refusal. */
export function unavailableLensLibrary(reason: 'no-workspace' | 'multi-root'): WorkshopLensLibraryPort {
  return { list: async () => { throw new LexicalGravityLibraryUnavailableError(reason); } };
}

/** A context window with `freeInputTokens` of room for evidence. */
export function windowWith(freeInputTokens: number): CapabilityContextWindow {
  return { contextLength: 200_000, requestTokens: 1_000, outputTokens: 4_000, headroomTokens: 1_000, freeInputTokens };
}

export const LENS_PAGE_SIZE = PROMPT_BUDGETS.workshopLens.catalogItems;

/** The lens sub-adapter over `library`, with its log lines and the turn's abort switch. */
export function lensCapability(library: WorkshopLensLibraryPort, options: { installed?: string } = {}) {
  const lines: string[] = [];
  const controller = new AbortController();
  const capability = new WorkshopLensCapability(
    library,
    { installedLensSlug: () => options.installed },
    { appendLine: (line: string) => { lines.push(line); }, clear: () => undefined, show: () => undefined },
    { requestId: 'host-request', personaId: 'jill', signal: controller.signal }
  );
  return { capability, lines, controller };
}
