/** @jest-environment jsdom */

/**
 * The model in the bubble header (ADR 2026-11-03 D8, amended 2026-11-04),
 * through the real App. A stamped reply's participant label reads
 * "Jill · Model A", by the shared rule `workshopTurnModelLabel`, with names
 * from `MODEL_DATA` and the raw id as the fallback. An unstamped turn names
 * nothing after the participant, the retired served-by note is drawn nowhere,
 * the label's tooltip still names the raw ids, and the model's span is the
 * part a narrow column cuts short.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as React from 'react';
import { act, render } from '@testing-library/react';
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
jest.mock('../../../presentation/webview/components/shared/PmLogo', () => ({ PmLogo: () => null }));

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { WorkshopApp } from '@/presentation/webview/WorkshopApp';
import { WORKSHOP_TURN_ID_ATTRIBUTE } from '@components/workshop/WorkshopTurnBubble';

const AUTO = 'vendor/auto';
const A = 'vendor/model-a';
const B = 'vendor/model-b';
const UNLISTED = 'vendor/model-unlisted';

const stamp = (requestedModelId: string, servedModelIds = [requestedModelId], scope: ModelScope = 'assistant') =>
  ({ scope, requestedModelId, servedModelIds });

let clock = 0;
const writer = (id: string, overrides: Partial<WorkshopTurn> = {}): WorkshopTurn => ({
  id,
  role: 'user',
  kind: 'message',
  participant: 'writer',
  artifact: 'persona_message',
  content: `Question ${id}`,
  timestamp: ++clock,
  excerptVersion: 0,
  ...overrides
});

const reply = (id: string, overrides: Partial<WorkshopTurn> = {}): WorkshopTurn => ({
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
  ...overrides
});

const dictionaryCard = (id: string, model: ReturnType<typeof stamp>): WorkshopTurn => reply(id, {
  kind: 'tool_run',
  participant: 'tool',
  artifact: 'dictionary_lookup',
  personaId: undefined,
  personaLabel: undefined,
  toolLabel: 'Dictionary',
  capability: {
    operation: 'dictionary.lookup',
    status: 'success',
    requestSummary: 'liminal',
    requestedByPersonaId: 'jill',
    invokedBy: { kind: 'host' }
  } as WorkshopTurn['capability'],
  model
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
      { id: AUTO, label: 'Auto router' },
      { id: A, label: 'Model A' },
      { id: B, label: 'Model B' }
    ],
    selections: { assistant: A }
  }
};

const deliver = (message: unknown) =>
  act(() => window.dispatchEvent(new MessageEvent('message', { data: message })));

const bubble = (turnId: string) =>
  document.querySelector<HTMLElement>(`[${WORKSHOP_TURN_ID_ATTRIBUTE}="${turnId}"]`)!;
const label = (turnId: string) => bubble(turnId).querySelector<HTMLElement>('.pm-ws-turn-head > .pm-ws-eyebrow')!;
/** What the label reads, as one phrase. */
const labelText = (turnId: string) => label(turnId).textContent!.replace(/\s+/g, ' ').trim();
const modelSpan = (turnId: string) => label(turnId).querySelector('.pm-ws-turn-model');

const ROOM: WorkshopTurn[] = [
  writer('u-1'), reply('a-1', { model: stamp(A) }),
  writer('u-2'), reply('a-2', { model: stamp(A, []) }),
  writer('u-3'), reply('a-3', { model: stamp(AUTO, [B]) }),
  writer('u-4'), reply('a-4', { model: stamp(A, [A, B]) }),
  writer('u-5'), reply('a-5', { model: stamp(AUTO, [UNLISTED]) }),
  writer('u-6'), dictionaryCard('d-6', stamp(B, [B], 'dictionary')), reply('a-6', { model: stamp(A) }),
  writer('u-7'), reply('a-7'),
  reply('g-8', { participant: 'guest', personaId: 'felix', personaLabel: 'Felix', model: stamp(AUTO, [A, B]) })
];

describe('the model in the bubble header', () => {
  beforeEach(() => {
    (useVSCodeApi as jest.Mock).mockReturnValue(createMockVSCode());
    Element.prototype.scrollIntoView = jest.fn();
  });

  const renderRoom = (turns: WorkshopTurn[] = ROOM) => {
    render(<WorkshopApp />);
    deliver(modelData);
    deliver(session(turns));
  };

  it('names each stamped reply’s model after its participant, by the shared rule', () => {
    renderRoom();

    expect(labelText('a-1')).toBe('Jill · Model A');
    expect(labelText('a-2')).toBe('Jill · Model A');
    expect(labelText('a-3')).toBe('Jill · Model B via Auto router');
    expect(labelText('a-4')).toBe('Jill · Model A, Model B');
    expect(labelText('a-5')).toBe(`Jill · ${UNLISTED} via Auto router`);
    expect(labelText('d-6')).toBe('Dictionary · Model B');
    expect(labelText('g-8')).toBe('Felix · Model A, Model B via Auto router');
  });

  it('names raw ids until MODEL_DATA arrives', () => {
    render(<WorkshopApp />);
    deliver(session(ROOM));

    expect(labelText('a-1')).toBe(`Jill · ${A}`);
    expect(labelText('a-3')).toBe(`Jill · ${B} via ${AUTO}`);
    deliver(modelData);
    expect(labelText('a-3')).toBe('Jill · Model B via Auto router');
  });

  it('names nothing after the participant on an unstamped reply, or on the writer’s turns', () => {
    renderRoom();

    expect(labelText('a-7')).toBe('Jill');
    expect(modelSpan('a-7')).toBeNull();
    for (const turnId of ['u-1', 'u-3', 'u-7']) {
      expect(bubble(turnId).querySelector('.pm-ws-turn-model')).toBeNull();
      expect(bubble(turnId).textContent).not.toMatch(/Model [AB]|vendor\//);
    }
  });

  it('draws no under-body served-by note anywhere', () => {
    renderRoom();
    const thread = document.querySelector<HTMLElement>('[aria-label="Session thread"]')!;

    expect(thread.querySelector('.pm-ws-turn-served-by')).toBeNull();
    expect(thread.textContent).not.toMatch(/served by/i);
    // The model is named once per bubble, in its header.
    expect(bubble('a-3').textContent!.split('Auto router')).toHaveLength(2);
  });

  it('keeps the label’s tooltip naming the raw ids', () => {
    renderRoom();

    expect(label('a-1').getAttribute('title')).toBe(`${A} · requested and served`);
    expect(label('a-2').getAttribute('title')).toBe(`Requested ${A} · the provider named no model`);
    expect(label('a-3').getAttribute('title')).toBe(`Requested ${AUTO} · served by ${B}`);
    expect(label('a-7').hasAttribute('title')).toBe(false);
  });

  it('renders a hostile model id as inert text', () => {
    const hostile = '<img src=x onerror="alert(1)">\n### Injected';
    renderRoom([writer('u-1'), reply('a-1', { model: stamp(AUTO, [hostile]) })]);

    expect(label('a-1').querySelector('img')).toBeNull();
    expect(labelText('a-1')).toBe('Jill · <img src=x onerror="alert(1)"> ### Injected via Auto router');
  });

  it('marks the model’s span, not the name, as the part that shrinks', () => {
    renderRoom();

    // The name is the label's own text; the model text alone has its span.
    const span = modelSpan('a-3')!;
    expect(span.textContent).toBe('· Model B via Auto router');
    expect([...label('a-3').childNodes].filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent).join('').trim()).toBe('Jill');

    const css = fs.readFileSync(
      path.resolve(__dirname, '..', '..', '..', 'presentation', 'webview', 'styles', 'workshop', 'shell.css'),
      'utf8'
    );
    const rule = (selector: string) => {
      const start = css.indexOf(`${selector} {`);
      expect(start).toBeGreaterThanOrEqual(0);
      return css.slice(start, css.indexOf('}', start));
    };
    const model = rule('[data-pm-surface="workshop"] .pm-ws-turn-model');
    for (const declaration of ['min-width: 0;', 'overflow: hidden;', 'text-overflow: ellipsis;']) {
      expect(model).toContain(declaration);
    }
    // Held to one line, the name's min-content is its whole width: it never shrinks.
    const eyebrow = rule('[data-pm-surface="workshop"] .pm-ws-turn-head > .pm-ws-eyebrow');
    expect(eyebrow).toContain('white-space: nowrap;');
    expect(eyebrow).toContain('min-width: 0;');
    // Nor does the icon, which a flex item would otherwise give up first.
    expect(rule('[data-pm-surface="workshop"] .pm-ws-turn-head > .pm-ws-eyebrow > svg')).toContain('flex-shrink: 0;');
  });
});
