/** @jest-environment jsdom */

/**
 * Thread/export parity for model slices (ADR 2026-11-03 D8). The real App
 * draws the thread from a snapshot; the real export service writes the HTML
 * transcript of the full ledger. Read back as DOM, the two place the same
 * slices before the same turns:
 *
 * - inside the window, exactly the export's slices, through turns the export
 *   omits (a context change, a blank message, a blank reply) and a private
 *   exchange;
 * - at every window start, the export's slices as that window shows them,
 *   with the window seeded from `modelsBeforeWindow`;
 * - whatever names each side resolves.
 *
 * A turn is identified by a marker in its visible text; a slice by its title
 * (the raw ids) and the first turn the export prints at or after it.
 */

import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  MessageType,
  ModelScope,
  WorkshopSessionStateMessage,
  WorkshopTurn
} from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { WorkshopTranscriptExportService } from '@/application/services/workshop/export/WorkshopTranscriptExportService';
import {
  deriveWorkshopModelSlices,
  workshopModelsBeforeWindow
} from '@shared/workshop/workshopModelSlices';

jest.mock('../../../presentation/webview/hooks/useVSCodeApi');
jest.mock('../../../presentation/webview/styles/workshop/tokens.css', () => ({}));
jest.mock('../../../presentation/webview/styles/workshop/shell.css', () => ({}));
jest.mock('../../../presentation/webview/styles/workshop/context.css', () => ({}));
jest.mock('../../../presentation/webview/styles/workshop/session.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/widgets/gesturePlayground/gesturePlayground.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/widgets/lexicalGravity/lexicalGravity.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/widgets/creativeVariations/creativeVariations.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/widgets/showVsTell/showVsTell.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/standingDirectiveRail.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/schematic/schematic.css', () => ({}));
jest.mock('../../../presentation/webview/styles/workshop/memory.css', () => ({}));
jest.mock('../../../presentation/webview/components/shared/PmLogo', () => ({ PmLogo: () => null }));

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { WorkshopApp } from '@/presentation/webview/WorkshopApp';

const model = (id: string) => `vendor/model-${id}`;
const NAMES: Record<string, string> = Object.fromEntries(
  ['a', 'b', 'c', 'd', 'e', 'f', 'x', 'y'].map((id) => [model(id), `Model ${id.toUpperCase()}`])
);

const stamp = (id: string, scope: ModelScope = 'assistant') =>
  ({ model: { scope, requestedModelId: model(id), servedModelIds: [model(id)] } });

let clock = 0;
const base = (id: string, overrides: Partial<WorkshopTurn>): WorkshopTurn => ({
  id,
  role: 'assistant',
  kind: 'message',
  participant: 'host',
  artifact: 'persona_message',
  personaId: 'jill',
  personaLabel: 'Jill',
  content: `⟦${id}⟧ reply`,
  timestamp: ++clock,
  excerptVersion: 1,
  ...overrides
});
const writer = (id: string, overrides: Partial<WorkshopTurn> = {}) => base(id, {
  role: 'user',
  participant: 'writer',
  personaId: undefined,
  personaLabel: undefined,
  content: `⟦${id}⟧ question`,
  ...overrides
});
const reply = (id: string, modelId: string, overrides: Partial<WorkshopTurn> = {}) =>
  base(id, { ...stamp(modelId), ...overrides });
const divider = (id: string, artifact: WorkshopTurn['artifact']) => base(id, {
  role: 'system',
  kind: 'divider',
  participant: 'session',
  artifact,
  personaId: undefined,
  personaLabel: undefined,
  content: `⟦${id}⟧ divider`
});
const dictionaryCard = (id: string, modelId: string) => base(id, {
  kind: 'tool_run',
  participant: 'tool',
  artifact: 'dictionary_lookup',
  personaId: undefined,
  personaLabel: undefined,
  toolLabel: 'Dictionary',
  capability: {
    operation: 'dictionary.lookup',
    status: 'success',
    requestSummary: `⟦${id}⟧ liminal`,
    requestedByPersonaId: 'jill',
    invokedBy: { kind: 'host' }
  } as WorkshopTurn['capability'],
  content: 'Evidence body.',
  ...stamp(modelId, 'dictionary')
});

const ROOM: WorkshopTurn[] = [
  divider('s-1', 'session_start'),
  writer('u-1'), reply('a-1', 'a'),
  divider('c-1', 'context_change'),
  writer('u-2'), dictionaryCard('d-2', 'x'), reply('a-2', 'b'),
  writer('u-3', { artifact: 'direct_tool_message', toolLabel: 'Prose Assistant' }),
  reply('a-3', 'c', {
    participant: 'tool',
    artifact: 'direct_tool_response',
    toolLabel: 'Prose Assistant',
    personaId: undefined,
    personaLabel: undefined
  }),
  writer('u-4', { content: '   ' }), reply('a-4', 'd'),
  divider('s-5', 'session_resume'),
  reply('g-5', 'e', { participant: 'guest', personaId: 'felix', personaLabel: 'Felix' }),
  writer('u-6'), dictionaryCard('d-6', 'y'), reply('a-6', 'e'),
  writer('u-7'), reply('a-7', 'a', { content: '' }),
  writer('u-8'), reply('a-8', 'c', { content: '' }),
  reply('a-9', 'f', { content: '' })
];

const MARKER = /⟦([^⟧]+)⟧/;

interface Placed {
  /** The slice's raw ids, from its title. */
  slice: string;
  /** Its accessible name. */
  name: string;
  /** The first printed turn at or after it, or 'end'. */
  anchor: string;
}

/** The slices in document order, each anchored to the next turn the export prints. */
function placedSlices(root: ParentNode, printed: ReadonlySet<string>): Placed[] {
  const placed: Placed[] = [];
  const open: Placed[] = [];
  for (const element of root.querySelectorAll('.pm-ws-model-slice, .pm-ws-turn, .pm-ws-revision-divider')) {
    if (element.classList.contains('pm-ws-model-slice')) {
      const slice = { slice: element.getAttribute('title')!, name: element.getAttribute('aria-label')!, anchor: 'end' };
      placed.push(slice);
      open.push(slice);
      continue;
    }
    const turnId = element.textContent?.match(MARKER)?.[1];
    if (turnId && printed.has(turnId)) {
      open.splice(0).forEach((slice) => { slice.anchor = turnId; });
    }
  }
  return placed;
}

async function exportedHtml(turns: readonly WorkshopTurn[], label: (id: string) => string | undefined) {
  const files = { writeNew: jest.fn(async () => ({ absolutePath: '/x/room.html', relativePath: 'room.html' })) };
  const service = new WorkshopTranscriptExportService(
    { readRoomLedger: () => [...turns], readBookmarkedTurnIds: () => new Set<string>() },
    files,
    () => 0,
    label
  );
  await service.export({ format: 'html', title: 'Parity' });
  const html = (files.writeNew.mock.calls[0] as unknown as [string, string, string])[2];
  return new DOMParser().parseFromString(html, 'text/html');
}

/** The turns the export prints, read from its own markup. */
function printedTurns(exported: Document): Set<string> {
  return new Set([...exported.querySelectorAll('main > *')].flatMap((element) => {
    const turnId = element.textContent?.match(MARKER)?.[1];
    return turnId ? [turnId] : [];
  }));
}

const deliver = (message: unknown) =>
  act(() => window.dispatchEvent(new MessageEvent('message', { data: message })));

function snapshot(turns: WorkshopTurn[], start: number): WorkshopSessionStateMessage {
  const window = turns.slice(start);
  const modelsBeforeWindow = workshopModelsBeforeWindow(turns, start);
  return {
    type: MessageType.WORKSHOP_SESSION_STATE,
    source: 'extension.workshop',
    payload: {
      session: {
        scope: 'open',
        participantSubjectReady: true,
        excerptVersion: 1,
        replacementCount: 0,
        roomRevision: 1,
        contextRevision: 0,
        contextAttachments: [],
        pendingMessageAttachments: [],
        widgetConfigs: [],
        standingDirectives: [],
        todos: [],
        bookmarks: [],
        turns: window,
        turnRewindability: {},
        totalTurns: turns.length,
        truncatedTurns: start,
        ...(modelsBeforeWindow ? { modelsBeforeWindow } : {}),
        roomHasMemory: true,
        participants: {
          host: { personaId: 'jill', hasConversation: true },
          toolSidecars: [],
          personaGuests: [],
          chatTarget: { kind: 'host' }
        },
        conversationBehavior: { ...DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR }
      },
      writerProfile: { ...DEFAULT_WORKSHOP_WRITER_PROFILE },
      webResearch: { enabled: false },
      persistence: { available: true, degradedConversationKeys: [] }
    },
    timestamp: 0
  };
}

function threadSlices(turns: WorkshopTurn[], start: number, printed: ReadonlySet<string>): Placed[] {
  const view = render(<WorkshopApp />);
  deliver({
    type: MessageType.MODEL_DATA,
    source: 'extension.configuration',
    timestamp: 1,
    payload: { options: Object.entries(NAMES).map(([id, label]) => ({ id, label })), selections: {} }
  });
  deliver(snapshot(turns, start));
  const placed = placedSlices(screen.getByLabelText('Session thread'), printed);
  view.unmount();
  return placed;
}

const withoutNames = (placed: readonly Placed[]) => placed.map(({ slice, anchor }) => ({ slice, anchor }));

describe('model slices: thread and export', () => {
  beforeEach(() => {
    (useVSCodeApi as jest.Mock).mockReturnValue(createMockVSCode());
    Element.prototype.scrollIntoView = jest.fn();
  });

  it('places the same slices, with the same names, when the window holds the whole room', async () => {
    const exported = await exportedHtml(ROOM, (id) => NAMES[id]);
    const printed = printedTurns(exported);
    const fromExport = placedSlices(exported, printed);

    // The room exercises every placement rule.
    expect(printed.has('c-1')).toBe(false);
    expect(printed.has('u-4')).toBe(false);
    expect(fromExport.map(({ name, anchor }) => `${anchor}: ${name}`)).toEqual([
      'u-2: Model · Model A → Model B',
      'u-3: Model · Model B → Model C',
      'a-4: Model · Model C → Model D',
      'g-5: Model · Model D → Model E',
      'u-6: Dictionary model · Model X → Model Y',
      'u-7: Model · Model E → Model A',
      'u-8: Model · Model A → Model C',
      'end: Model · Model C → Model F'
    ]);
    expect(threadSlices(ROOM, 0, printed)).toEqual(fromExport);
  });

  it('places the same slices when the two sides name the models differently', async () => {
    const exported = await exportedHtml(ROOM, () => undefined);
    const printed = printedTurns(exported);
    const fromExport = placedSlices(exported, printed);
    const fromThread = threadSlices(ROOM, 0, printed);

    expect(fromExport[0].name).toBe(`Model · ${model('a')} → ${model('b')}`);
    expect(fromThread[0].name).toBe('Model · Model A → Model B');
    expect(withoutNames(fromThread)).toEqual(withoutNames(fromExport));
  });

  it('shows, at every window start, the export’s slices as that window shows them', async () => {
    const exported = await exportedHtml(ROOM, (id) => NAMES[id]);
    const printed = printedTurns(exported);
    const fromExport = placedSlices(exported, printed);
    const derived = new Map(deriveWorkshopModelSlices(ROOM).map((slice) =>
      [`${slice.fromModelId} → ${slice.toModelId}`, slice]
    ));
    const order = ROOM.map((turn) => turn.id);
    const firstPrintedFrom = (turnId: string) =>
      order.slice(order.indexOf(turnId)).find((candidate) => printed.has(candidate)) ?? 'end';
    let moved = 0;

    for (let start = 0; start <= ROOM.length; start++) {
      const window = new Set(order.slice(start));
      const expected = fromExport.flatMap((placed): Placed[] => {
        const { beforeTurnId, replyTurnId } = derived.get(placed.slice)!;
        if (!window.has(replyTurnId)) {
          return [];
        }
        if (window.has(beforeTurnId)) {
          return [placed];
        }
        // Its writer turn fell before the window: the window draws it before its reply.
        moved++;
        return [{ ...placed, anchor: firstPrintedFrom(replyTurnId) }];
      });

      expect({ start, slices: threadSlices(ROOM, start, printed) }).toEqual({ start, slices: expected });
    }
    expect(moved).toBeGreaterThan(0);
  });
});
