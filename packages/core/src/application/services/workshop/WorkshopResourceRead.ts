/** `resource.read` for one Workshop host turn: one configured file's line window, under the byte ceiling. */

import type {
  ContextResourceContent,
  ContextResourceSummary
} from '@/domain/models/ContextGeneration';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type {
  WorkshopCapabilityRequest,
  WorkshopCapabilityResult
} from '@shared/types/workshopCapabilities';
import {
  configuredResourceFingerprint,
  findConfiguredResource,
  sliceUtf8
} from './WorkshopConfiguredResourceLookup';

export type ResourceReadRequest = Extract<WorkshopCapabilityRequest, { capability: 'resource.read' }>;

/** What a read needs of the turn's resource capability. */
export interface WorkshopResourceReadPorts {
  resources(): Promise<ContextResourceSummary[]>;
  load(resourcePath: string): Promise<ContextResourceContent[]>;
  throwIfAborted(): void;
  rejected(request: ResourceReadRequest, error: string): WorkshopCapabilityResult;
}

/**
 * The lines a successful `resource.read` returned, from the metadata `read`
 * writes (Wayfinding D4). Undefined when no line was returned (a read
 * whose byte ceiling fell inside its first line) or the metadata is not a
 * read's.
 */
export function resourceReadLineRange(
  metadata: Record<string, unknown> | undefined
): { start: number; end: number } | undefined {
  const start = metadata?.startLine;
  const end = metadata?.endLine;
  return Number.isInteger(start) && Number.isInteger(end)
    && (start as number) >= 1 && (end as number) >= (start as number)
    ? { start: start as number, end: end as number }
    : undefined;
}

/** Project text inside a Markdown fence can never close it. */
export function neutralizeWorkshopResourceFence(value: string): string {
  return value.replace(/```/g, '`\u200B``');
}

export class WorkshopResourceReadOperation {
  constructor(private readonly ports: WorkshopResourceReadPorts) {}

  async run(request: ResourceReadRequest): Promise<WorkshopCapabilityResult> {
    const lookup = findConfiguredResource(await this.ports.resources(), request.group, request.path);
    if (lookup.kind === 'ambiguous') {
      return this.ports.rejected(
        request,
        'The requested path matches more than one configured resource when letter case is ignored.'
      );
    }
    if (lookup.kind === 'missing') {
      return this.ports.rejected(
        request,
        'The requested path is not one of the configured project resources in that group.'
      );
    }
    const resource = lookup.resource;

    const budgets = PROMPT_BUDGETS.workshopResource;
    if (resource.sizeBytes > budgets.readSourceBytes) {
      return {
        capability: request.capability,
        status: 'failed',
        requestSummary: resource.path,
        error: `The configured project resource exceeds the ${budgets.readSourceBytes}-byte source-read ceiling.`,
        metadata: {
          group: resource.group,
          path: resource.path,
          sourceBytes: resource.sizeBytes,
          sourceByteCeiling: budgets.readSourceBytes
        }
      };
    }

    const loaded = (await this.ports.load(resource.path))
      .find(item =>
        item.group === resource.group &&
        item.path.toLowerCase() === resource.path.toLowerCase()
      );
    this.ports.throwIfAborted();
    if (!loaded) {
      return {
        capability: request.capability,
        status: 'failed',
        requestSummary: resource.path,
        error: 'The configured project resource could not be read.',
        metadata: { group: resource.group, path: resource.path }
      };
    }

    const loadedBytes = Buffer.byteLength(loaded.content, 'utf8');
    if (loadedBytes > budgets.readSourceBytes) {
      return {
        capability: request.capability,
        status: 'failed',
        requestSummary: resource.path,
        error: `The configured project resource changed beyond the ${budgets.readSourceBytes}-byte source-read ceiling.`,
        metadata: {
          group: loaded.group,
          path: loaded.path,
          workspaceFolder: loaded.workspaceFolder,
          sourceBytes: loadedBytes,
          sourceByteCeiling: budgets.readSourceBytes
        }
      };
    }

    const lines = loaded.content.split(/\r?\n/);
    const totalLines = lines.length;
    const startLine = request.startLine ?? 1;
    if (startLine > totalLines) {
      return {
        capability: request.capability,
        status: 'failed',
        requestSummary: resource.path,
        error: `The requested start line ${startLine} is beyond the file's ${totalLines} lines.`,
        metadata: {
          group: loaded.group,
          path: loaded.path,
          workspaceFolder: loaded.workspaceFolder,
          startLine,
          totalLines
        }
      };
    }
    const defaultEndLine = startLine + budgets.readDefaultLines - 1;
    const requestedEndLine = request.endLine ?? defaultEndLine;
    const selectedEndLine = Math.min(requestedEndLine, totalLines);
    const selectedContent = lines.slice(startLine - 1, selectedEndLine).join('\n');
    const sliced = sliceUtf8(selectedContent, budgets.readBytes);
    const returnedLineCount = sliced.truncated
      ? countReturnedLines(sliced.content)
      : selectedEndLine - startLine + 1;
    const endLine = Math.min(selectedEndLine, startLine + returnedLineCount - 1);
    const totalBytes = Buffer.byteLength(lines.join('\n'), 'utf8');
    const content = [
      `## Project resource · ${loaded.label}`,
      `Group: ${loaded.group}`,
      `Path: ${loaded.path}`,
      loaded.workspaceFolder ? `Workspace: ${loaded.workspaceFolder}` : undefined,
      `Lines: ${startLine}-${endLine} of ${totalLines}.`,
      sliced.truncated
        ? `Requested through line ${selectedEndLine}; stopped at the ${budgets.readBytes}-byte ceiling.`
        : request.endLine === undefined && selectedEndLine < totalLines
          ? `Default window: up to ${budgets.readDefaultLines} lines.`
          : `Read size: ${sliced.bytes} UTF-8 bytes.`,
      '',
      '```markdown',
      neutralizeWorkshopResourceFence(sliced.content),
      '```'
    ].filter((line): line is string => line !== undefined).join('\n');

    return {
      capability: request.capability,
      status: 'success',
      requestSummary: resource.path,
      content,
      metadata: {
        group: loaded.group,
        path: loaded.path,
        workspaceFolder: loaded.workspaceFolder,
        startLine,
        endLine,
        requestedEndLine: request.endLine,
        totalLines,
        defaultLineWindow: request.endLine === undefined,
        bytes: sliced.bytes,
        totalBytes,
        windowBytes: sliced.totalBytes,
        truncated: sliced.truncated
      },
      // The whole file at read time, so the reader can say when it changed.
      sourceFingerprint: configuredResourceFingerprint(loaded.content)
    };
  }
}

function countReturnedLines(content: string): number {
  if (content.length === 0) return 0;
  const newlines = content.match(/\n/g)?.length ?? 0;
  return newlines + (content.endsWith('\n') ? 0 : 1);
}
