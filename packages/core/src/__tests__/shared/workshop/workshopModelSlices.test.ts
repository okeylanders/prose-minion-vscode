/**
 * Model slices (ADR 2026-11-03 D8): the one derivation the thread and the
 * export share. Where a reply's requested model changed in its scope, a slice
 * goes before the writer turn that prompted it; an unstamped turn is unknown,
 * never a switch.
 */

import type { ModelScope, WorkshopTurn } from '@messages';
import {
  deriveWorkshopModelSlices,
  workshopModelsBeforeWindow,
  workshopModelSlicesInWindow,
  workshopModelSliceText
} from '@shared/workshop/workshopModelSlices';
import {
  dividerTurn,
  fixtureTurn,
  writerTurn
} from '@/__tests__/application/services/workshop/transcript/workshopTranscriptFixtures';

const A = 'vendor/model-a';
const B = 'vendor/model-b';
const C = 'vendor/model-c';

const stamp = (requestedModelId: string, scope: ModelScope = 'assistant', servedModelIds: string[] = []) =>
  ({ scope, requestedModelId, servedModelIds });

const reply = (id: string, model?: string, scope: ModelScope = 'assistant'): WorkshopTurn =>
  fixtureTurn(id, model ? { model: stamp(model, scope) } : {});

const card = (id: string, operation: 'dictionary.lookup' | 'analysis.run', model?: string): WorkshopTurn =>
  fixtureTurn(id, {
    kind: 'tool_run',
    participant: 'tool',
    artifact: operation === 'dictionary.lookup' ? 'dictionary_lookup' : 'tool_report',
    personaId: undefined,
    personaLabel: undefined,
    capability: {
      operation,
      status: 'success',
      requestSummary: 'request',
      requestedByPersonaId: 'jill',
      invokedBy: { kind: 'host' }
    } as WorkshopTurn['capability'],
    ...(model
      ? { model: stamp(model, operation === 'dictionary.lookup' ? 'dictionary' : 'assistant') }
      : {})
  });

const placements = (turns: readonly WorkshopTurn[], seed?: Partial<Record<ModelScope, string>>) =>
  deriveWorkshopModelSlices(turns, { modelsBeforeWindow: seed }).map((slice) =>
    `${slice.beforeTurnId}:${slice.scope}:${slice.fromModelId}>${slice.toModelId}`
  );

describe('deriveWorkshopModelSlices', () => {
  it('draws nothing for a room with no stamps', () => {
    expect(placements([
      dividerTurn('s-1', 'session_start', 'Session started'),
      writerTurn('u-1'),
      reply('a-1'),
      writerTurn('u-2'),
      reply('a-2')
    ])).toEqual([]);
  });

  it('draws nothing when one model answers throughout', () => {
    expect(placements([writerTurn('u-1'), reply('a-1', A), writerTurn('u-2'), reply('a-2', A)])).toEqual([]);
  });

  it('places one switch before the writer turn that prompted it', () => {
    const slices = deriveWorkshopModelSlices([
      writerTurn('u-1'), reply('a-1', A), writerTurn('u-2'), reply('a-2', B)
    ]);
    expect(slices).toEqual([
      { beforeTurnId: 'u-2', replyTurnId: 'a-2', scope: 'assistant', fromModelId: A, toModelId: B }
    ]);
  });

  it('draws a switch back as a second slice', () => {
    expect(placements([
      writerTurn('u-1'), reply('a-1', A),
      writerTurn('u-2'), reply('a-2', B),
      writerTurn('u-3'), reply('a-3', B),
      writerTurn('u-4'), reply('a-4', A)
    ])).toEqual([`u-2:assistant:${A}>${B}`, `u-4:assistant:${B}>${A}`]);
  });

  it('treats an unstamped history as unknown, not as a switch', () => {
    expect(placements([
      writerTurn('u-1'), reply('a-1'),
      writerTurn('u-2'), reply('a-2'),
      writerTurn('u-3'), reply('a-3', A),
      writerTurn('u-4'), reply('a-4', A)
    ])).toEqual([]);
  });

  it('keeps the last value across an unstamped turn between two stamped ones', () => {
    expect(placements([
      writerTurn('u-1'), reply('a-1', A),
      writerTurn('u-2'), reply('a-2'),
      writerTurn('u-3'), reply('a-3', B)
    ])).toEqual([`u-3:assistant:${A}>${B}`]);
  });

  it('compares each scope only with itself when scopes interleave', () => {
    // A persona analysis card, a dictionary card, then a reply, twice.
    expect(placements([
      writerTurn('u-1'),
      card('x-1', 'analysis.run', A),
      card('d-1', 'dictionary.lookup', C),
      reply('a-1', A),
      writerTurn('u-2'),
      card('d-2', 'dictionary.lookup', C),
      reply('a-2', A),
      writerTurn('u-3'),
      card('x-2', 'analysis.run', A),
      reply('a-3', A)
    ])).toEqual([]);
  });

  it('places a switch past the run’s capability cards, before its writer turn', () => {
    expect(placements([
      writerTurn('u-1'), reply('a-1', A),
      writerTurn('u-2'),
      card('d-1', 'dictionary.lookup', C),
      card('r-1', 'dictionary.lookup'),
      reply('a-2', B)
    ])).toEqual([`u-2:assistant:${A}>${B}`]);
  });

  it('draws a slice in each scope that changed at one writer turn', () => {
    expect(placements([
      writerTurn('u-1'), card('d-1', 'dictionary.lookup', C), reply('a-1', A),
      writerTurn('u-2'), card('d-2', 'dictionary.lookup', A), reply('a-2', B)
    ])).toEqual([`u-2:dictionary:${C}>${A}`, `u-2:assistant:${A}>${B}`]);
  });

  it('places a reply no writer turn prompted before the reply itself', () => {
    expect(placements([
      writerTurn('u-1'), reply('a-1', A),
      dividerTurn('s-2', 'session_resume', 'Session resumed'),
      // A guest's first reply after an invite follows another reply, not a writer turn.
      fixtureTurn('g-1', { participant: 'guest', personaLabel: 'Felix', model: stamp(B) })
    ])).toEqual([`g-1:assistant:${A}>${B}`]);
    expect(placements([reply('a-1', A), reply('a-2', B)])).toEqual([`a-2:assistant:${A}>${B}`]);
  });

  it('never reads a stamp off a turn that is not a reply', () => {
    const forged = writerTurn('u-2', { model: stamp(B) });
    expect(placements([writerTurn('u-1'), reply('a-1', A), forged, reply('a-2', A)])).toEqual([]);
  });

  it('seeds each scope from the turns before the window', () => {
    expect(placements([writerTurn('u-9'), reply('a-9', B)], { assistant: A })).toEqual([
      `u-9:assistant:${A}>${B}`
    ]);
    expect(placements([writerTurn('u-9'), reply('a-9', A)], { assistant: A, dictionary: B })).toEqual([]);
    expect(placements([writerTurn('u-9'), card('d-9', 'dictionary.lookup', C)], { assistant: C })).toEqual([]);
  });

  it('drops the slices a rewind cut away, and keeps the ones before the cut', () => {
    const room = [
      writerTurn('u-1'), reply('a-1', A),
      writerTurn('u-2'), reply('a-2', B),
      writerTurn('u-3'), reply('a-3', C)
    ];
    const cuts = room.map((_, index) => index + 1);
    expect(cuts.map((cut) => placements(room.slice(0, cut)))).toEqual([
      [], [], [], [`u-2:assistant:${A}>${B}`], [`u-2:assistant:${A}>${B}`],
      [`u-2:assistant:${A}>${B}`, `u-3:assistant:${B}>${C}`]
    ]);
  });
});

describe('the window seed and the window’s slices', () => {
  const room = [
    writerTurn('u-1'), card('d-1', 'dictionary.lookup', C), reply('a-1', A),
    writerTurn('u-2'), reply('a-2', B),
    writerTurn('u-3'), card('d-3', 'dictionary.lookup', A), reply('a-3', B),
    writerTurn('u-4'), reply('a-4', C),
    reply('a-5', A)
  ];

  it('is undefined when nothing is cut, or nothing before the cut is stamped', () => {
    expect(workshopModelsBeforeWindow(room, 0)).toBeUndefined();
    expect(workshopModelsBeforeWindow(room, 1)).toBeUndefined();
    expect(workshopModelsBeforeWindow([writerTurn('u-1'), reply('a-1')], 2)).toBeUndefined();
  });

  it('holds the last stamped model per scope before the window', () => {
    expect(workshopModelsBeforeWindow(room, 3)).toEqual({ dictionary: C, assistant: A });
    expect(workshopModelsBeforeWindow(room, 8)).toEqual({ dictionary: A, assistant: B });
  });

  it('gives the thread, at every cut, the full history’s slices as its window shows them', () => {
    const full = deriveWorkshopModelSlices(room);
    for (let start = 0; start <= room.length; start++) {
      const window = room.slice(start);
      expect(deriveWorkshopModelSlices(window, {
        modelsBeforeWindow: workshopModelsBeforeWindow(room, start)
      })).toEqual(workshopModelSlicesInWindow(full, window.map((turn) => turn.id)));
    }
  });

  it('moves a slice whose writer turn fell before the window to its reply', () => {
    const full = deriveWorkshopModelSlices(room);
    expect(workshopModelSlicesInWindow(full, ['a-4', 'a-5']).map((slice) => slice.beforeTurnId))
      .toEqual(['a-4', 'a-5']);
  });
});

describe('workshopModelSliceText', () => {
  it('writes the copy the thread and the export share', () => {
    expect(workshopModelSliceText('assistant', 'Claude Sonnet 5', 'GPT-5')).toBe('Model · Claude Sonnet 5 → GPT-5');
    expect(workshopModelSliceText('dictionary', 'Model A', 'Model B')).toBe('Dictionary model · Model A → Model B');
  });
});
