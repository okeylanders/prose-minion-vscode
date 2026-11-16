/**
 * A turn's resource capability over a made-up *Alice* project, for the
 * `resource.read` tests (ADR 2026-11-14, item A). Every path and line here
 * is invented.
 */

import { WorkshopCapabilityXmlCodec } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import { WorkshopResourceCapability } from '@/application/services/workshop/WorkshopResourceCapability';
import type { ContextResourceContent, ContextResourceProviderFactory } from '@/domain/models/ContextGeneration';
import type { LogSink } from '@/platform';
import type { CapabilityContextWindow } from '@orchestration/AgentRunContracts';
import type { ContextPathGroup } from '@shared/types';
import type {
  WorkshopCapabilityRequest,
  WorkshopCapabilityResult,
  WorkshopResourceReadFile
} from '@shared/types/workshopCapabilities';

export interface AliceFile {
  readonly group: ContextPathGroup;
  readonly path: string;
  readonly content: string;
  /** The size the catalog saw, when it differs from the content's. */
  readonly sizeBytes?: number;
  /** The provider lists it and then cannot load it. */
  readonly unreadable?: boolean;
}

export type ResourceReadRequest = Extract<WorkshopCapabilityRequest, { capability: 'resource.read' }>;

/** `count` lines, each `width` bytes of plain prose, numbered so a test can find one. */
export function aliceLines(count: number, width = 60, tag = 'Alice'): string {
  return Array.from({ length: count }, (_, index) => {
    const lead = `${tag} line ${index + 1}: `;
    return (lead + 'down the rabbit hole she went '.repeat(Math.ceil(width / 30))).slice(0, width);
  }).join('\n');
}

export const manuscript = (path: string, content: string): AliceFile => ({ group: 'manuscript', path, content });

/** A window with this much room left for evidence. */
export function windowWith(freeInputTokens: number): CapabilityContextWindow {
  return { contextLength: freeInputTokens * 2, requestTokens: 0, outputTokens: 0, headroomTokens: 0, freeInputTokens };
}

export function aliceResources(files: readonly AliceFile[]) {
  const toContent = (file: AliceFile): ContextResourceContent => ({
    group: file.group,
    path: file.path,
    label: file.path.split('/').at(-1)!,
    sizeBytes: file.sizeBytes ?? Buffer.byteLength(file.content, 'utf8'),
    absolutePath: `/wonderland/${file.path}`,
    content: file.content
  });
  const loadResources = jest.fn(async (paths: string[]) =>
    files.filter((file) => paths.includes(file.path) && !file.unreadable).map(toContent));
  const factory: ContextResourceProviderFactory = {
    createProvider: jest.fn().mockResolvedValue({
      listResources: () => files.map((file) => {
        const { content: _content, ...summary } = toContent(file);
        return summary;
      }),
      loadResources
    })
  };
  return { factory, loadResources };
}

/** One turn's capability, and the lines it logged. */
export function aliceCapability(files: readonly AliceFile[]) {
  const { factory, loadResources } = aliceResources(files);
  const appendLine = jest.fn<void, [string]>();
  const capability = new WorkshopResourceCapability(
    factory,
    { appendLine } as unknown as LogSink,
    { requestId: 'host-1', personaId: 'jill', signal: new AbortController().signal }
  );
  const read = (
    named: readonly (WorkshopResourceReadFile | string)[],
    options: { startLine?: number; endLine?: number; window?: CapabilityContextWindow } = {}
  ): Promise<WorkshopCapabilityResult> => {
    const { window, ...lines } = options;
    return capability.fulfill({
      capability: 'resource.read',
      files: named.map((file) => (typeof file === 'string' ? { group: 'manuscript', path: file } : file)),
      ...lines
    }, window);
  };
  return { capability, read, loadResources, logged: (): string[] => appendLine.mock.calls.map(([line]) => line) };
}

/** Every continuation call a result's text carries: a complete call alone on its line. */
export function hintsIn(result: WorkshopCapabilityResult): string[] {
  return (result.content ?? '').split('\n').filter((line) => line.startsWith('<prose-minion-tool-call '));
}

const codec = new WorkshopCapabilityXmlCodec();

/** A hint, decoded alone and exactly as written, to the read it asks for. */
export function decodeHint(hint: string): ResourceReadRequest {
  const inspection = codec.inspect(hint);
  if (inspection.kind !== 'request' || inspection.request.capability !== 'resource.read') {
    throw new Error(`A hint did not decode to a resource.read: ${JSON.stringify(inspection)}`);
  }
  return inspection.request;
}

/** One file's own section of a read's text. */
export function sectionOf(result: WorkshopCapabilityResult, path: string): string {
  const sections = (result.content ?? '').split(/\n\n(?=## Project resource · )/);
  const section = sections.find((candidate) => candidate.includes(`\nPath: ${path}\n`));
  if (section === undefined) {
    throw new Error(`No section for ${path}`);
  }
  return section;
}

/** The card's row for one file. */
export function fileRow(result: WorkshopCapabilityResult, path: string): Record<string, unknown> {
  const rows = (result.metadata?.files ?? []) as Record<string, unknown>[];
  return rows.find((row) => row.path === path)!;
}
