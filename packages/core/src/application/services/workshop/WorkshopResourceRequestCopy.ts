/**
 * What the project-resource family says about a request before its result
 * exists: the card's summary, the log line, and the live status. One place,
 * so a read of several files reads the same on the card, in the log and in
 * the ticker (ADR 2026-11-14 D7).
 *
 * The log line of a read naming several files carries counts and groups,
 * never a path. A one-path read keeps the line it has always had.
 */

import type { WorkshopCapabilityRequest } from '@shared/types/workshopCapabilities';

type ResourceRequest = Extract<WorkshopCapabilityRequest, {
  capability: 'resource.catalog' | 'resource.search' | 'resource.read';
}>;

/** How many paths a card's summary lists before "+N more". */
const SUMMARY_PATHS = 2;

/** One path as it is; several as "3 files: alice-ch1.md, alice-ch2.md, +1 more". */
export function workshopResourceReadSummary(paths: readonly string[]): string {
  if (paths.length === 1) {
    return paths[0];
  }
  const more = paths.length - SUMMARY_PATHS;
  return `${paths.length} files: ${paths.slice(0, SUMMARY_PATHS).join(', ')}${more > 0 ? `, +${more} more` : ''}`;
}

export function workshopResourceRequestSummary(request: ResourceRequest): string {
  switch (request.capability) {
    case 'resource.catalog':
      return request.group ? `${request.group} catalog` : 'configured resource catalog';
    case 'resource.search':
      return request.group ? `“${request.query}” in ${request.group}` : `“${request.query}”`;
    case 'resource.read':
      return workshopResourceReadSummary(request.files.map((file) => file.path));
    default:
      return assertNever(request);
  }
}

export function workshopResourceRequestLogSummary(request: ResourceRequest): string {
  switch (request.capability) {
    case 'resource.catalog':
      return `group=${request.group ?? 'all'}`;
    case 'resource.search':
      return `group=${request.group ?? 'all'}; query=${JSON.stringify(request.query)}`;
    case 'resource.read': {
      const lines = `lines=${request.startLine ?? 'default'}-${request.endLine ?? 'default'}`;
      if (request.files.length === 1) {
        return `group=${request.files[0].group}; path=${JSON.stringify(request.files[0].path)}; ${lines}`;
      }
      // Counts and groups only: several paths never reach the log.
      const groups = [...new Set(request.files.map((file) => file.group))];
      return `files=${request.files.length}; groups=${groups.join(',')}; lines=default`;
    }
    default:
      return assertNever(request);
  }
}

export function workshopResourceStatusMessage(request: ResourceRequest, persona: string): string {
  switch (request.capability) {
    case 'resource.catalog':
      return `${persona} is checking the configured project-resource catalog…`;
    case 'resource.search':
      return `${persona} is searching configured project resources for “${request.query}”…`;
    case 'resource.read':
      return request.files.length === 1
        ? `${persona} is reading ${request.files[0].path}…`
        : `${persona} is reading ${request.files.length} project files…`;
    default:
      return assertNever(request);
  }
}

export function workshopResourceStatusTicker(request: ResourceRequest): string {
  switch (request.capability) {
    case 'resource.catalog':
      return `Resources · ${request.group ?? 'all groups'}`;
    case 'resource.search':
      return `Search · ${request.group ?? 'all groups'}`;
    case 'resource.read':
      return request.files.length === 1 ? `Read · ${request.files[0].group}` : `Read · ${request.files.length} files`;
    default:
      return assertNever(request);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled project-resource request: ${JSON.stringify(value)}`);
}
