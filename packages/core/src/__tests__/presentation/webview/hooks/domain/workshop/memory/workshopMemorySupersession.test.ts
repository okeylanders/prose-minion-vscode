/**
 * The manager's Past rows read supersession exactly as the library lists it
 * (PR #197 N-02): `listProjectMemories`' accepted links decide both standing
 * and "Superseded by …". On a cycle nothing is superseded, and a line names
 * only the links that count. The view derives none of it.
 */

import { listProjectMemories } from '@/application/services/workshop/memory/ProjectMemoryLibraryContracts';
import type { ProjectMemory } from '@shared/types/projectMemory';
import { workshopMemoryManagerView } from '@hooks/domain/workshop/memory/workshopMemoryManagerView';
import type { WorkshopMemoryEntry } from '@hooks/domain/workshop/memory/workshopMemoryViewInputs';

function memory(id: string, title: string, supersedes: string[] = [], status: ProjectMemory['status'] = 'active'): ProjectMemory {
  return {
    id,
    title,
    kind: 'canon',
    summary: 'A line.',
    status,
    pinned: false,
    created: '2026-11-01T10:00:00Z',
    updated: '2026-11-01T10:00:00Z',
    origin: 'writer',
    sourceTurns: [],
    supersedes,
    body: ''
  };
}

/** The library's listing, handed to the view as 4b-wire will. */
function managerOf(memories: ProjectMemory[]) {
  const entries: WorkshopMemoryEntry[] = listProjectMemories(memories.map((item) => ({ memory: item }))).map((listed) => ({
    entryKey: `key-${listed.memory.id}`,
    id: listed.memory.id,
    title: listed.memory.title,
    kind: listed.memory.kind,
    summary: listed.memory.summary,
    status: listed.memory.status,
    pinned: listed.memory.pinned,
    created: listed.memory.created,
    updated: listed.memory.updated,
    origin: listed.memory.origin,
    source: { kind: 'none' },
    superseded: listed.superseded,
    supersededBy: listed.supersededBy,
    busy: listed.busy,
    fullLoad: null
  }));
  return workshopMemoryManagerView({ mode: 'ask', library: { memories: entries, unreadable: [], conflicts: [] } });
}

describe('Past rows follow the library’s accepted supersession links', () => {
  it('a cycle supersedes nothing: both stay active', () => {
    const view = managerOf([
      memory('mem-00000a', 'The watch runs backward', ['mem-00000b']),
      memory('mem-00000b', 'The watch stops at six', ['mem-00000a'])
    ]);
    expect(view.past).toEqual([]);
    expect(view.active.map((row) => row.entry.title).sort()).toEqual(['The watch runs backward', 'The watch stops at six']);
  });

  it('a line names only the links that count, never a cycle’s ignored edge', () => {
    const view = managerOf([
      memory('mem-00000a', 'The watch runs backward', ['mem-00000b']),
      memory('mem-00000b', 'The watch stops at six', ['mem-00000a']),
      memory('mem-00000c', 'The watch has no hands', ['mem-00000b'])
    ]);
    expect(view.past.map((row) => [row.entry.title, row.line])).toEqual([
      ['The watch stops at six', 'Superseded by “The watch has no hands”.']
    ]);
    expect(view.active.map((row) => row.entry.title).sort()).toEqual(['The watch has no hands', 'The watch runs backward']);
  });

  it('a chain through an archived note: each names its own newer note, and the archived one says both', () => {
    const view = managerOf([
      memory('mem-00000a', 'First', []),
      memory('mem-00000b', 'Second', ['mem-00000a'], 'archived'),
      memory('mem-00000c', 'Third', ['mem-00000b'])
    ]);
    expect(view.past.map((row) => [row.entry.title, row.line]).sort()).toEqual([
      ['First', 'Superseded by “Second”.'],
      ['Second', 'Superseded by “Third”. Restore un-archives it, but the newer memory still replaces it.']
    ]);
  });
});
