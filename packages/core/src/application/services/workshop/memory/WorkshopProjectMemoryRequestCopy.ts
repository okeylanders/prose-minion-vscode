/**
 * What the thread, the status line and the log say about a `memory.*`
 * request (ADR 2026-11-04 D1, D9). Pure. A query is the persona's text, so
 * the log carries only its length; ids are host-minted and safe to log.
 */

import type { WorkshopProjectMemoryRequest } from '@shared/types/workshopCapabilities';

/** The request as the artifact card names it. */
export function workshopProjectMemoryRequestSummary(request: WorkshopProjectMemoryRequest): string {
  switch (request.capability) {
    case 'memory.catalog':
      return request.kind ? `${request.kind} notes` : 'project notes';
    case 'memory.search':
      return `“${request.query}”${request.status && request.status !== 'active' ? ` in ${request.status} notes` : ''}`;
    case 'memory.read':
      return request.memories.join(', ');
    default:
      return assertNever(request);
  }
}

export function workshopProjectMemoryRequestLogSummary(request: WorkshopProjectMemoryRequest): string {
  switch (request.capability) {
    case 'memory.catalog':
      return `kind=${request.kind ?? 'all'}`;
    case 'memory.search':
      return `status=${request.status ?? 'active'}; queryChars=${request.query.length}`;
    case 'memory.read':
      return `memories=${request.memories.join(',')}`;
    default:
      return assertNever(request);
  }
}

export function workshopProjectMemoryStatusMessage(request: WorkshopProjectMemoryRequest, persona: string): string {
  switch (request.capability) {
    case 'memory.catalog':
      return `${persona} is checking the project's saved notes…`;
    case 'memory.search':
      return `${persona} is searching the project's saved notes for “${request.query}”…`;
    case 'memory.read':
      return `${persona} is reading ${request.memories.length === 1 ? 'a saved note' : `${request.memories.length} saved notes`}…`;
    default:
      return assertNever(request);
  }
}

export function workshopProjectMemoryStatusTicker(request: WorkshopProjectMemoryRequest): string {
  switch (request.capability) {
    case 'memory.catalog':
      return `Memory · ${request.kind ?? 'catalog'}`;
    case 'memory.search':
      return 'Memory · search';
    case 'memory.read':
      return `Memory · read ${request.memories.length}`;
    default:
      return assertNever(request);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled project-memory request: ${JSON.stringify(value)}`);
}
