import {
  ContextResourceProvider,
  ContextResourceProviderFactory,
  ContextResourceSummary,
  DEFAULT_CONTEXT_GROUPS
} from '@/domain/models/ContextGeneration';
import { WorkshopConfiguredResourceRef } from '@messages';
import { countWords, trimToWordLimit } from '@/utils/textUtils';
import { createHash } from 'crypto';

export interface WorkshopConfiguredResourceBounds {
  maxBytes: number;
  maxWords: number;
}

export interface WorkshopBoundedConfiguredResource {
  summary: ContextResourceSummary;
  text: string;
  words: number;
  sourceFingerprint: string;
  truncation?: { keptWords: number; totalWords: number };
}

export type WorkshopConfiguredResourceLoadResult =
  | { kind: 'loaded'; resource: WorkshopBoundedConfiguredResource }
  | { kind: 'missing' }
  | { kind: 'too-large'; summary: ContextResourceSummary }
  | { kind: 'empty'; summary: ContextResourceSummary }
  | { kind: 'unreadable'; summary: ContextResourceSummary; details: string };

/**
 * Per-interaction configured-resource catalog. It deliberately snapshots fresh
 * provider metadata: the workspace has no invalidation port, so a cross-click
 * cache would serve stale paths, sizes, or symlink checks after writer edits.
 */
export class WorkshopContextResourceCatalog {
  private readonly entriesByKey = new Map<string, ContextResourceSummary>();

  constructor(
    private readonly provider: ContextResourceProvider
  ) {
    for (const entry of provider.listResources()) {
      this.entriesByKey.set(this.key(entry), entry);
    }
  }

  entries(): ContextResourceSummary[] {
    return [...this.entriesByKey.values()];
  }

  find(ref: WorkshopConfiguredResourceRef): ContextResourceSummary | undefined {
    return this.entriesByKey.get(this.key(ref));
  }

  async load(
    ref: WorkshopConfiguredResourceRef,
    bounds: WorkshopConfiguredResourceBounds
  ): Promise<WorkshopConfiguredResourceLoadResult> {
    const summary = this.find(ref);
    if (!summary) {
      return { kind: 'missing' };
    }
    if (summary.sizeBytes > bounds.maxBytes) {
      return { kind: 'too-large', summary };
    }

    let content: string | undefined;
    try {
      content = (await this.provider.loadResources([summary.path]))
        .find((entry) => entry.group === summary.group && entry.path === summary.path)
        ?.content;
    } catch (error) {
      return {
        kind: 'unreadable',
        summary,
        details: error instanceof Error ? error.message : String(error)
      };
    }
    if (!content || content.trim().length === 0) {
      return { kind: 'empty', summary };
    }

    const totalWords = countWords(content);
    const sourceFingerprint = createHash('sha256').update(content).digest('hex');
    if (totalWords <= bounds.maxWords) {
      return {
        kind: 'loaded',
        resource: { summary, text: content, words: totalWords, sourceFingerprint }
      };
    }
    const trimmed = trimToWordLimit(content, bounds.maxWords);
    return {
      kind: 'loaded',
      resource: {
        summary,
        text: trimmed.trimmed,
        words: trimmed.trimmedWords,
        sourceFingerprint,
        truncation: { keptWords: trimmed.trimmedWords, totalWords }
      }
    };
  }

  private key(ref: WorkshopConfiguredResourceRef): string {
    return `${ref.group}\u0000${ref.path}`;
  }
}

/** Application seam for Workshop's configured-resource intake flows. */
export class WorkshopContextResourceService {
  constructor(private readonly providerFactory: ContextResourceProviderFactory) {}

  async openCatalog(): Promise<WorkshopContextResourceCatalog> {
    const provider = await this.providerFactory.createProvider([...DEFAULT_CONTEXT_GROUPS]);
    return new WorkshopContextResourceCatalog(provider);
  }
}
