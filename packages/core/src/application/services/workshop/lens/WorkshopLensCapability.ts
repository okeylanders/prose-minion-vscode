/**
 * The Lexical Gravity library for one persona turn (ADR 2026-11-17
 * D16–D19): turns one validated `lens.*` request into a capability result.
 * Read-only, and private to the persona that asked.
 *
 * - **Where lenses come from.** Project lenses only through the
 *   repository's `list()`; built-ins only through
 *   `builtInLexicalGravityLenses()`; the two joined by the modal's own rule
 *   (`mergeLexicalGravityLibrary`: a built-in wins its slug). This adapter
 *   reads no file and writes nothing.
 * - **No workspace, several roots, or a folder that did not read** still
 *   lists the built-ins, and says why in host words.
 * - **The installed lens** is known by its slug alone, through a narrow
 *   port; the directive's body never comes here.
 * - **A read is fitted by whole sections** to half the room left in the
 *   context window (`reads/WorkshopReadWindowFit`). One section that does
 *   not fit alone is refused, with the room it had and no call. With no
 *   window, the read is everything asked.
 * - **Nothing joins the manifest:** a lens result adds no context-source
 *   row (D16).
 * - Logs carry the operation, counts and outcomes: never a slug a persona
 *   wrote, a subject or lens text. A result carries no usage.
 */

import type { LogSink } from '@/platform';
import type { WorkshopLexicalGravityLens, WorkshopPersonaId } from '@messages';
import type { CapabilityContextWindow } from '@orchestration/AgentRunContracts';
import {
  WORKSHOP_LENS_SECTIONS,
  type WorkshopCapabilityResult,
  type WorkshopLensRequest,
  type WorkshopLensSection
} from '@shared/types/workshopCapabilities';
import {
  LexicalGravityLibraryUnavailableError,
  type LexicalGravityLensCatalog
} from '@/infrastructure/storage/LexicalGravityLensRepository';
import {
  builtInLexicalGravityLenses,
  mergeLexicalGravityLibrary
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityLenses';
import {
  fitWorkshopReadToWindow,
  workshopReadEvidenceTokens,
  type WorkshopMeasuredRead
} from '@/application/services/workshop/reads/WorkshopReadWindowFit';
import {
  workshopLensBody,
  workshopLensProjectLibraryLine,
  workshopLensRequestSummary,
  workshopLensText,
  type WorkshopLensProjectLibraryState
} from '@/application/services/workshop/lens/WorkshopLensCopy';
import {
  renderWorkshopLensCatalog,
  renderWorkshopLensRead,
  type WorkshopLensListing,
  type WorkshopLensRenderedRead
} from '@/application/services/workshop/lens/WorkshopLensRenderer';

/** The project library's one question a persona may ask; satisfied by LexicalGravityLensRepository. */
export interface WorkshopLensLibraryPort {
  list(): Promise<LexicalGravityLensCatalog>;
}

/** Which lens the room's Lexical Gravity directive holds, by slug alone. */
export interface WorkshopLensInstalledPort {
  installedLensSlug(): string | undefined;
}

export interface WorkshopLensTurnContext {
  readonly requestId: string;
  readonly personaId: WorkshopPersonaId;
  readonly signal: AbortSignal;
}

type Request<C extends WorkshopLensRequest['capability']> = Extract<WorkshopLensRequest, { capability: C }>;

export class WorkshopLensCapability {
  constructor(
    private readonly library: WorkshopLensLibraryPort,
    private readonly installed: WorkshopLensInstalledPort,
    private readonly outputChannel: LogSink,
    private readonly turn: WorkshopLensTurnContext
  ) {}

  async fulfill(request: WorkshopLensRequest, window?: CapabilityContextWindow): Promise<WorkshopCapabilityResult> {
    this.throwIfAborted();
    const listing = await this.listing();
    this.throwIfAborted();
    switch (request.capability) {
      case 'lens.catalog':
        return this.catalog(request, listing);
      case 'lens.read':
        return this.read(request, listing, window);
      default:
        return assertNever(request);
    }
  }

  /** The library in catalog order: the project's lenses by name (ties by slug), then the built-ins. */
  private async listing(): Promise<WorkshopLensListing> {
    const builtIns = builtInLexicalGravityLenses();
    let projectLibrary: WorkshopLensProjectLibraryState = 'listed';
    let listed: LexicalGravityLensCatalog = { lenses: [], incompatibleResources: [] };
    try {
      listed = await this.library.list();
    } catch (error) {
      projectLibrary = error instanceof LexicalGravityLibraryUnavailableError ? error.reason : 'unreadable';
      if (projectLibrary === 'unreadable') {
        this.log(`project library unreadable (${error instanceof Error ? error.name : 'unknown'})`);
      }
    }
    const builtInSlugs = new Set(builtIns.map((lens) => lens.slug));
    const projects = mergeLexicalGravityLibrary(builtIns, listed.lenses)
      .filter((lens) => !builtInSlugs.has(lens.slug))
      .sort((left, right) => left.name.localeCompare(right.name, 'en-US') || (left.slug < right.slug ? -1 : left.slug > right.slug ? 1 : 0));
    const installedSlug = this.installed.installedLensSlug();
    return {
      lenses: [...projects, ...builtIns],
      projectLibrary,
      unreadableFiles: listed.incompatibleResources.length,
      ...(installedSlug !== undefined ? { installedSlug } : {})
    };
  }

  private catalog(request: Request<'lens.catalog'>, listing: WorkshopLensListing): WorkshopCapabilityResult {
    const rendered = renderWorkshopLensCatalog(listing, request.page);
    this.log(
      `catalog page=${rendered.page} pages=${rendered.pages} shown=${rendered.shown} notShown=${rendered.notShown} ` +
      `unreadableFiles=${listing.unreadableFiles} projectLibrary=${listing.projectLibrary}`
    );
    return {
      capability: request.capability,
      // The built-ins were listed, but the project's folder was not read.
      status: listing.projectLibrary === 'unreadable' ? 'partial' : 'success',
      requestSummary: workshopLensRequestSummary(request),
      content: rendered.content,
      metadata: {
        outcome: 'catalog',
        lensCount: rendered.shown,
        lensesListed: listing.lenses.length,
        page: rendered.page,
        pages: rendered.pages,
        notShown: rendered.notShown,
        unreadableFiles: listing.unreadableFiles,
        projectLibrary: listing.projectLibrary,
        // More is one call away exactly when a later page exists (D17).
        truncated: rendered.page < rendered.pages,
        characters: rendered.content.length
      }
    };
  }

  private read(
    request: Request<'lens.read'>,
    listing: WorkshopLensListing,
    window: CapabilityContextWindow | undefined
  ): WorkshopCapabilityResult {
    const lens = listing.lenses.find((candidate) => candidate.slug === request.lens);
    if (!lens) {
      return this.unknownLens(request, listing);
    }
    const sections: readonly WorkshopLensSection[] = request.sections ?? WORKSHOP_LENS_SECTIONS;
    const installed = lens.slug === listing.installedSlug;
    const half = window ? Math.floor(window.freeInputTokens / 2) : undefined;
    const render = (take: number): WorkshopMeasuredRead => {
      const rendered = renderWorkshopLensRead(lens, sections, take, {
        installed,
        ...(half !== undefined ? { limit: { halfWindowTokens: half } } : {})
      });
      const outcome = this.readResult(request, lens, sections, rendered, half);
      return { size: take, outcome, tokens: half === undefined ? 0 : workshopReadEvidenceTokens(outcome) };
    };
    if (half === undefined) {
      // An unknown window: the whole of what was asked. A valid lens is bounded by its own codec (D18).
      const whole = render(sections.length);
      this.log(`read sections=${sections.length}/${sections.length} source=${lens.source} window=unknown`);
      return whole.outcome;
    }
    const fitted = fitWorkshopReadToWindow(render, sections.length, half, 1);
    if (!fitted.fit) {
      return this.windowTooSmall(request, half, fitted.minimum);
    }
    this.log(
      `read sections=${fitted.fit.size}/${sections.length} source=${lens.source} tokens=${fitted.fit.tokens} ` +
      `halfWindow=${half} renders=${fitted.renders}`
    );
    return fitted.fit.outcome;
  }

  private readResult(
    request: Request<'lens.read'>,
    lens: WorkshopLexicalGravityLens,
    sections: readonly WorkshopLensSection[],
    rendered: WorkshopLensRenderedRead,
    half: number | undefined
  ): WorkshopCapabilityResult {
    const limited = rendered.notRead.length > 0;
    return {
      capability: request.capability,
      status: 'success',
      requestSummary: workshopLensRequestSummary(request),
      content: rendered.content,
      metadata: {
        outcome: 'read',
        lensSource: lens.source,
        sectionsNamed: sections.length,
        sectionsRead: rendered.read.length,
        sections: [...rendered.read],
        truncated: limited,
        ...(limited ? { limitedBy: 'context-window', halfWindowTokens: half } : {}),
        characters: rendered.content.length
      }
    };
  }

  /** No lens has the slug: a failure in host words, pointing at the catalog. */
  private unknownLens(request: Request<'lens.read'>, listing: WorkshopLensListing): WorkshopCapabilityResult {
    const unavailable = workshopLensProjectLibraryLine(listing.projectLibrary);
    const content = workshopLensBody([
      `No lens has the slug “${workshopLensText(request.lens)}”. Take slugs from lens.catalog, exactly as it lists them.`,
      ...(unavailable ? [unavailable] : [])
    ]);
    this.log(`read failed reason=unknown-lens projectLibrary=${listing.projectLibrary}`);
    return {
      capability: request.capability,
      status: 'failed',
      requestSummary: workshopLensRequestSummary(request),
      content,
      metadata: { outcome: 'unknown-lens', projectLibrary: listing.projectLibrary, characters: content.length },
      error: 'No lens has that slug.'
    };
  }

  /** Even one section costs more than half the window: a recorded refusal with the room it had, and no call. */
  private windowTooSmall(
    request: Request<'lens.read'>,
    half: number,
    measured: WorkshopMeasuredRead | undefined
  ): WorkshopCapabilityResult {
    this.log(`read refused reason=lens-context-window halfWindow=${half}`);
    const tokens = (value: number): string => `${value.toLocaleString('en-US')} ${value === 1 ? 'token' : 'tokens'}`;
    return {
      capability: request.capability,
      status: 'rejected',
      requestSummary: workshopLensRequestSummary(request),
      error: `The first section asked for does not fit: half the room left in your context window is ${tokens(half)}` +
        (measured ? `, and that section alone measured ${tokens(measured.tokens)}` : '') +
        '. A section is never cut. Answer from what you have, and say that the lens could not be read here.',
      metadata: {
        rejectionReason: 'lens-context-window',
        halfWindowTokens: half,
        ...(measured ? { minimumTokens: measured.tokens } : {})
      }
    };
  }

  private throwIfAborted(): void {
    if (this.turn.signal.aborted) {
      const error = new Error('The lens read was cancelled.');
      error.name = 'AbortError';
      throw error;
    }
  }

  private log(line: string): void {
    this.outputChannel.appendLine(
      `[WorkshopLensCapability] request=${this.turn.requestId} persona=${this.turn.personaId} ${line}`
    );
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled lens request: ${JSON.stringify(value)}`);
}
