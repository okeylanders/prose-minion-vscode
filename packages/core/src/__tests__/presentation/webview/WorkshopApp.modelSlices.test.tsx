/** @jest-environment jsdom */

/**
 * Model slices in the thread (ADR 2026-11-03 D8), through the real App. A
 * slice is drawn before the writer turn that prompted a reply whose requested
 * model changed in its scope, named from the model options `MODEL_DATA`
 * carries with the raw id as the fallback, and seeded across the snapshot's
 * window by `modelsBeforeWindow`. A turn with no stamp never draws one. A
 * bubble's participant label's title names the ids; its header's model text
 * is pinned in `WorkshopApp.modelHeader.test.tsx`.
 */

import * as React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  MessageType,
  ModelScope,
  WorkshopSessionSnapshot,
  WorkshopSessionStateMessage,
  WorkshopTurn
} from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

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
import { WORKSHOP_TURN_ID_ATTRIBUTE } from '@components/workshop/WorkshopTurnBubble';

const A = 'vendor/model-a';
const B = 'vendor/model-b';
const UNLISTED = 'vendor/model-unlisted';

const stamp = (requestedModelId: string, scope: ModelScope = 'assistant', servedModelIds = [requestedModelId]) =>
  ({ scope, requestedModelId, servedModelIds });

let clock = 0;
const writer = (id: string, content = `Question ${id}`): WorkshopTurn => ({
  id,
  role: 'user',
  kind: 'message',
  participant: 'writer',
  artifact: 'persona_message',
  content,
  timestamp: ++clock,
  excerptVersion: 0
});

const reply = (id: string, model?: string, overrides: Partial<WorkshopTurn> = {}): WorkshopTurn => ({
  id,
  role: 'assistant',
  kind: 'message',
  participant: 'host',
  artifact: 'persona_message',
  personaId: 'jill',
  personaLabel: 'Jill',
  content: `Reply ${id}`,
  timestamp: ++clock,
  excerptVersion: 0,
  ...(model ? { model: stamp(model) } : {}),
  ...overrides
});

const dictionaryCard = (id: string, model: string): WorkshopTurn => reply(id, undefined, {
  kind: 'tool_run',
  participant: 'tool',
  artifact: 'dictionary_lookup',
  personaId: undefined,
  personaLabel: undefined,
  toolLabel: 'Dictionary',
  capability: {
    operation: 'dictionary.lookup',
    status: 'success',
    requestSummary: '“liminal”',
    requestedByPersonaId: 'jill',
    invokedBy: { kind: 'host' }
  } as WorkshopTurn['capability'],
  model: stamp(model, 'dictionary')
});

const session = (turns: WorkshopTurn[], overrides: Partial<WorkshopSessionSnapshot> = {}): WorkshopSessionStateMessage => ({
  type: MessageType.WORKSHOP_SESSION_STATE,
  source: 'extension.workshop',
  payload: {
    session: {
      scope: 'open',
      participantSubjectReady: true,
      excerptVersion: 0,
      replacementCount: 0,
      roomRevision: 1,
      contextRevision: 0,
      contextAttachments: [],
      pendingMessageAttachments: [],
      widgetConfigs: [],
      standingDirectives: [],
      todos: [],
      bookmarks: [],
      turns,
      turnRewindability: {},
      totalTurns: turns.length,
      truncatedTurns: 0,
      roomHasMemory: true,
      participants: {
        host: { personaId: 'jill', hasConversation: true },
        toolSidecars: [],
        personaGuests: [],
        chatTarget: { kind: 'host' }
      },
      conversationBehavior: { ...DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR },
      ...overrides
    },
    writerProfile: { ...DEFAULT_WORKSHOP_WRITER_PROFILE },
    webResearch: { enabled: false },
    persistence: { available: true, degradedConversationKeys: [] }
  },
  timestamp: 0
});

const modelData = {
  type: MessageType.MODEL_DATA,
  source: 'extension.configuration',
  timestamp: 1,
  payload: {
    options: [
      { id: A, label: 'Model A' },
      { id: B, label: 'Model B' }
    ],
    selections: { assistant: B }
  }
};

const deliver = (message: unknown) =>
  act(() => window.dispatchEvent(new MessageEvent('message', { data: message })));

const slices = () => screen.queryAllByRole('separator', { name: /model ·/i });

/** What follows each slice in the thread: the id of the turn it was drawn before. */
const placedBefore = () => slices().map((slice) =>
  slice.nextElementSibling?.getAttribute(WORKSHOP_TURN_ID_ATTRIBUTE)
);

describe('WorkshopApp model slices', () => {
  beforeEach(() => {
    clock = 0;
    (useVSCodeApi as jest.Mock).mockReturnValue(createMockVSCode());
    Element.prototype.scrollIntoView = jest.fn();
  });

  afterEach(() => jest.clearAllMocks());

  it('draws a slice before the writer turn that prompted the switch, named from MODEL_DATA', () => {
    render(<WorkshopApp />);
    deliver(modelData);
    deliver(session([writer('u-1'), reply('a-1', A), writer('u-2'), reply('a-2', B)]));

    const [slice] = slices();
    expect(slices()).toHaveLength(1);
    expect(slice.getAttribute('aria-label')).toBe('Model · Model A → Model B');
    expect(slice.textContent).toBe('Model · Model A → Model B');
    expect(slice.getAttribute('title')).toBe(`${A} → ${B}`);
    expect(slice.className).toBe('pm-ws-revision-divider pm-ws-session-divider pm-ws-model-slice');
    expect(placedBefore()).toEqual(['u-2']);
  });

  it('names a model the options do not list by its raw id', () => {
    render(<WorkshopApp />);
    deliver(modelData);
    deliver(session([writer('u-1'), reply('a-1', A), writer('u-2'), reply('a-2', UNLISTED)]));

    expect(slices().map((slice) => slice.textContent)).toEqual([`Model · Model A → ${UNLISTED}`]);
  });

  it('names models by raw id before MODEL_DATA arrives, and by display name once it does', () => {
    render(<WorkshopApp />);
    deliver(session([writer('u-1'), reply('a-1', A), writer('u-2'), reply('a-2', B)]));
    expect(slices().map((slice) => slice.textContent)).toEqual([`Model · ${A} → ${B}`]);

    deliver(modelData);
    expect(slices().map((slice) => slice.textContent)).toEqual(['Model · Model A → Model B']);
  });

  it('draws nothing for a session without stamps', () => {
    render(<WorkshopApp />);
    deliver(modelData);
    deliver(session([writer('u-1'), reply('a-1'), writer('u-2'), reply('a-2'), writer('u-3'), reply('a-3', A)]));

    expect(slices()).toEqual([]);
  });

  it('compares a dictionary lookup only with other lookups', () => {
    render(<WorkshopApp />);
    deliver(modelData);
    deliver(session([
      writer('u-1'), dictionaryCard('d-1', B), reply('a-1', A),
      writer('u-2'), dictionaryCard('d-2', B), reply('a-2', A),
      writer('u-3'), dictionaryCard('d-3', A), reply('a-3', A)
    ]));

    expect(slices().map((slice) => slice.textContent)).toEqual(['Dictionary model · Model B → Model A']);
    expect(placedBefore()).toEqual(['u-3']);
  });

  it('seeds the window’s first reply from modelsBeforeWindow', () => {
    render(<WorkshopApp />);
    deliver(modelData);
    deliver(session([writer('u-9'), reply('a-9', B)], {
      totalTurns: 400,
      truncatedTurns: 398,
      modelsBeforeWindow: { assistant: A }
    }));

    expect(slices().map((slice) => slice.textContent)).toEqual(['Model · Model A → Model B']);
    expect(placedBefore()).toEqual(['u-9']);
  });

  it('draws a slice when a live reply switches, and drops it when a snapshot rewinds past it', () => {
    render(<WorkshopApp />);
    deliver(modelData);
    const before = [writer('u-1'), reply('a-1', A)];
    deliver(session(before));
    expect(slices()).toEqual([]);

    const switched = [writer('u-2'), reply('a-2', B)];
    for (const turn of switched) {
      deliver({ type: MessageType.WORKSHOP_TURN, source: 'extension.workshop', timestamp: 2, payload: { turn } });
    }
    expect(placedBefore()).toEqual(['u-2']);

    deliver(session(before));
    expect(slices()).toEqual([]);
  });

  describe('the bubble', () => {
    const bubble = (turnId: string) =>
      document.querySelector<HTMLElement>(`[${WORKSHOP_TURN_ID_ATTRIBUTE}="${turnId}"]`)!;

    it('draws no slice for a served model that differs from the request', () => {
      render(<WorkshopApp />);
      deliver(modelData);
      deliver(session([
        writer('u-1'), reply('a-1', A),
        writer('u-2'), reply('a-2', A, { model: stamp(A, 'assistant', [B]) }),
        writer('u-3'), reply('a-3', A, { model: stamp(A, 'assistant', []) })
      ]));

      // A served-by difference is not a change of request.
      expect(slices()).toEqual([]);
    });

    it('titles the participant label with the requested and served ids', () => {
      render(<WorkshopApp />);
      deliver(modelData);
      deliver(session([
        writer('u-1'), reply('a-1', A),
        writer('u-2'), reply('a-2', A, { model: stamp(A, 'assistant', [B]) }),
        writer('u-3'), reply('a-3')
      ]));

      const label = (turnId: string) => within(bubble(turnId)).getByText('Jill').closest('.pm-ws-eyebrow')!;
      expect(label('a-1').getAttribute('title')).toBe(`${A} · requested and served`);
      expect(label('a-2').getAttribute('title')).toBe(`Requested ${A} · served by ${B}`);
      expect(label('a-3').hasAttribute('title')).toBe(false);
    });
  });
});
