/** @jest-environment jsdom */

/**
 * Thread/export parity for the model in the bubble header (ADR 2026-11-03 D8
 * and D10, amended 2026-11-04). The real App draws the thread from a
 * snapshot; the real export service writes the HTML transcript of the full
 * ledger. Read back as DOM, every reply and capability card both print
 * names the same model text, given the same label lookup, and the same raw
 * ids when neither side names a model. A reply names it after its speaker in
 * both; a card names it in its thread header and at the end of its one-line
 * export event. A turn is identified by a marker in its text.
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
import { workshopModelsBeforeWindow } from '@shared/workshop/workshopModelSlices';

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

const served = (requested: string, ...servedIds: string[]) =>
  ({ model: { scope: 'assistant' as ModelScope, requestedModelId: model(requested), servedModelIds: servedIds.map(model) } });

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
  reply('a-9', 'f', { content: '' }),
  // The header's other rows: routed, fallen back, named none, unlisted, unstamped.
  writer('u-10'), reply('a-10', 'x', served('x', 'a')),
  writer('u-11'), reply('a-11', 'a', served('a', 'a', 'b', 'c')),
  writer('u-12'), reply('a-12', 'b', served('b')),
  writer('u-13'), reply('a-13', 'x', served('x', 'unlisted')),
  writer('u-14'), reply('a-14', 'a', { model: undefined }),
  // A persona-run analysis card, routed.
  writer('u-15'), base('r-15', {
    kind: 'tool_run',
    participant: 'tool',
    artifact: 'tool_report',
    personaId: undefined,
    personaLabel: undefined,
    toolId: 'stock-and-signature',
    toolLabel: 'Stock & Signature',
    capability: {
      operation: 'analysis.run',
      status: 'success',
      requestSummary: '⟦r-15⟧ excerpt replace',
      requestedByPersonaId: 'jill',
      invokedBy: { kind: 'host' }
    } as WorkshopTurn['capability'],
    content: '⟦r-15⟧ Analysis report.',
    ...served('x', 'b')
  }),
  reply('a-15', 'a')
];

const MARKER = /⟦([^⟧]+)⟧/;

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

/**
 * Each printed reply's and card's model text, by turn, or null when it names
 * none: a turn's from its header, an export event's from its own line.
 */
function headerModels(root: ParentNode): Map<string, string | null> {
  const models = new Map<string, string | null>();
  for (const element of root.querySelectorAll('.pm-ws-turn-assistant, .pm-ws-revision-divider')) {
    const turnId = element.textContent?.match(MARKER)?.[1];
    const named = element.classList.contains('pm-ws-turn-assistant')
      ? element.querySelector('.pm-ws-turn-head > .pm-ws-eyebrow')
      : element;
    if (!turnId || !named || models.has(turnId)) {
      continue;
    }
    models.set(turnId, named.querySelector('.pm-ws-turn-model')?.textContent ?? null);
  }
  return models;
}

function threadHeaders(turns: WorkshopTurn[], names: boolean): Map<string, string | null> {
  const view = render(<WorkshopApp />);
  if (names) {
    deliver({
      type: MessageType.MODEL_DATA,
      source: 'extension.configuration',
      timestamp: 1,
      payload: { options: Object.entries(NAMES).map(([id, label]) => ({ id, label })), selections: {} }
    });
  }
  deliver(snapshot(turns, 0));
  const models = headerModels(screen.getByLabelText('Session thread'));
  view.unmount();
  return models;
}

describe('the model in the header: thread and export', () => {
  beforeEach(() => {
    (useVSCodeApi as jest.Mock).mockReturnValue(createMockVSCode());
    Element.prototype.scrollIntoView = jest.fn();
  });

  it('names the same model text on every reply both print, given the same names', async () => {
    const fromExport = headerModels(await exportedHtml(ROOM, (id) => NAMES[id]));
    const fromThread = threadHeaders(ROOM, true);

    // The room exercises every row of the rule, and a reply the export omits.
    for (const [turnId, text] of [
      ['a-1', '· Model A'],
      ['a-3', '· Model C'],
      ['g-5', '· Model E'],
      ['a-10', '· Model A via Model X'],
      ['a-11', '· Model A, Model B, Model C'],
      ['a-12', '· Model B'],
      ['a-13', `· ${model('unlisted')} via Model X`],
      ['a-14', null],
      ['d-2', '· Model X'],
      ['d-6', '· Model Y'],
      ['r-15', '· Model B via Model X'],
      ['s-1', null]
    ] as const) {
      expect({ turnId, text: fromExport.get(turnId) }).toEqual({ turnId, text });
    }
    expect(fromExport.has('a-7')).toBe(false);
    for (const [turnId, text] of fromExport) {
      expect({ turnId, text: fromThread.get(turnId) }).toEqual({ turnId, text });
    }
    expect(fromExport.size).toBeGreaterThanOrEqual(15);
  });

  it('names the same raw ids when neither side names a model', async () => {
    const fromExport = headerModels(await exportedHtml(ROOM, () => undefined));
    const fromThread = threadHeaders(ROOM, false);

    expect(fromExport.get('a-10')).toBe(`· ${model('a')} via ${model('x')}`);
    expect(fromExport.get('r-15')).toBe(`· ${model('b')} via ${model('x')}`);
    for (const [turnId, text] of fromExport) {
      expect({ turnId, text: fromThread.get(turnId) }).toEqual({ turnId, text });
    }
  });
});
