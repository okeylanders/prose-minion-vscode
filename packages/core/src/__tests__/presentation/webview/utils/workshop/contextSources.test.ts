/**
 * The manifest's one partition and the Read in open action (ADR 2026-11-03
 * D2, D3): writer material and read-in material split by origin and kind,
 * each in manifest order, and every kind has exactly one open action.
 */

import {
  isReadInSource,
  partitionContextSources,
  ReadInOpenAction,
  readInOpenAction,
  readInRowIdentity
} from '@utils/workshop/contextSources';
import {
  CONTEXT_SOURCE_KINDS,
  ContextSourceEntry,
  ContextSourceKind,
  ContextSourceOrigin
} from '@shared/types';

const entry = (
  kind: ContextSourceKind,
  origin: ContextSourceOrigin,
  label: string,
  overrides: Partial<ContextSourceEntry> = {}
): ContextSourceEntry => ({
  kind,
  origin,
  label,
  sizeChars: 100,
  isEstimate: true,
  deliveredAt: 1_000,
  ...overrides
});

describe('partitionContextSources', () => {
  it('puts host- and tool-fetched rows of the fetchable kinds in Read in, in delivery order', () => {
    const manifest = [
      entry('pin', 'writer', 'Excerpt'),
      entry('attachment', 'writer', 'Series bible'),
      entry('resource', 'host', 'characters/rabbit.md', { deliveredAt: 2 }),
      entry('tool-evidence', 'tool', 'Continuity report', { deliveredAt: 3 }),
      entry('dictionary', 'host', 'gloaming', { deliveredAt: 4 }),
      entry('transcript', 'host', 'Chapter 6 pacing pass', { deliveredAt: 5 })
    ];

    const { writerMaterial, readIn } = partitionContextSources(manifest);

    expect(writerMaterial.map((row) => row.label)).toEqual(['Excerpt', 'Series bible']);
    expect(readIn.map((row) => row.label)).toEqual([
      'characters/rabbit.md',
      'Continuity report',
      'gloaming',
      'Chapter 6 pacing pass'
    ]);
  });

  it('keeps a writer-origin row of a fetchable kind with writer material', () => {
    const writerResource = entry('resource', 'writer', 'characters/hatter.md');
    expect(partitionContextSources([writerResource])).toEqual({
      writerMaterial: [writerResource],
      readIn: []
    });
  });

  it('keeps a host-origin row of a writer kind with writer material', () => {
    const hostPin = entry('pin', 'host', 'Excerpt');
    expect(partitionContextSources([hostPin]).readIn).toEqual([]);
  });

  it('keeps superseded rows where they were', () => {
    const early = entry('resource', 'host', 'characters/rabbit.md', { stale: true, deliveredAt: 1 });
    const later = entry('resource', 'host', 'characters/rabbit.md', { deliveredAt: 2 });
    expect(partitionContextSources([early, later]).readIn).toEqual([early, later]);
  });

  it('agrees with isReadInSource row by row', () => {
    const rows = CONTEXT_SOURCE_KINDS.flatMap((kind) =>
      (['writer', 'host', 'tool'] as const).map((origin) => entry(kind, origin, `${kind}/${origin}`))
    );
    const { readIn } = partitionContextSources(rows);
    expect(readIn).toEqual(rows.filter(isReadInSource));
  });
});

describe('readInOpenAction', () => {
  const rabbit = { group: 'characters' as const, path: 'characters/rabbit.md' };

  // A Record over every kind: adding a kind fails to compile here until the
  // test says what opening it means, as the switch itself does.
  const EXPECTED: Record<ContextSourceKind, ReadInOpenAction> = {
    pin: { kind: 'none' },
    attachment: { kind: 'none' },
    // eslint-disable-next-line @typescript-eslint/naming-convention -- ContextSourceKind ids are kebab-case protocol literals.
    'message-attachment': { kind: 'none' },
    resource: { kind: 'reader' },
    // eslint-disable-next-line @typescript-eslint/naming-convention -- ContextSourceKind ids are kebab-case protocol literals.
    'tool-evidence': { kind: 'none' },
    dictionary: { kind: 'none' },
    transcript: { kind: 'none' },
    memory: { kind: 'none' }
  };

  it.each(CONTEXT_SOURCE_KINDS.map((kind) => [kind]))('gives %s exactly one action', (kind) => {
    expect(readInOpenAction(entry(kind, 'host', kind, { configuredResource: rabbit })))
      .toEqual(EXPECTED[kind]);
  });

  describe('with the card that fetched the row (Wayfinding Slice 3)', () => {
    const CARD = 'turn-4-assistant-1793632500000';
    // Every kind again, now recorded with its card.
    const WITH_CARD: Record<ContextSourceKind, ReadInOpenAction> = {
      ...EXPECTED,
      // A resource keeps the reader; the reader offers its card.
      resource: { kind: 'reader' },
      // eslint-disable-next-line @typescript-eslint/naming-convention -- ContextSourceKind ids are kebab-case protocol literals.
      'tool-evidence': { kind: 'jump', turnId: CARD },
      dictionary: { kind: 'jump', turnId: CARD },
      transcript: { kind: 'jump', turnId: CARD },
      // A Project note opens its card (ADR 2026-11-04 D12).
      memory: { kind: 'jump', turnId: CARD }
    };

    it.each(CONTEXT_SOURCE_KINDS.map((kind) => [kind]))('gives %s exactly one action', (kind) => {
      expect(readInOpenAction(entry(kind, 'host', kind, { configuredResource: rabbit, turnId: CARD })))
        .toEqual(WITH_CARD[kind]);
    });

    it('opens nothing for a card-backed kind stored before rows recorded their card', () => {
      expect(readInOpenAction(entry('dictionary', 'host', 'tardy'))).toEqual({ kind: 'none' });
    });
  });

  it('opens nothing for a resource row without a configured file', () => {
    expect(readInOpenAction(entry('resource', 'host', 'characters/rabbit.md'))).toEqual({ kind: 'none' });
  });

  it('refuses a kind outside the list rather than guessing an action', () => {
    expect(() => readInOpenAction(entry('index' as ContextSourceKind, 'host', 'x')))
      .toThrow('Unhandled context source kind: index');
  });

  it('is exhaustive at the type level', () => {
    // If a kind were left out of the switch, its default's `never` parameter
    // would not accept it; this assertion fails to compile the same way.
    type Covered = keyof typeof EXPECTED;
    const exhaustive: [Exclude<ContextSourceKind, Covered>] extends [never] ? true : false = true;
    expect(exhaustive).toBe(true);
  });
});

describe('readInRowIdentity', () => {
  it('is what the manifest gives a row, and ignores being superseded', () => {
    const row = entry('resource', 'host', 'characters/rabbit.md');
    expect(readInRowIdentity({ ...row, stale: true })).toBe(readInRowIdentity(row));
    expect(readInRowIdentity({ ...row, deliveredAt: 2_000 })).not.toBe(readInRowIdentity(row));
    expect(readInRowIdentity({ ...row, origin: 'tool' })).not.toBe(readInRowIdentity(row));
    expect(readInRowIdentity({ ...row, kind: 'dictionary' })).not.toBe(readInRowIdentity(row));
  });
});
