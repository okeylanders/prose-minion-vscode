/** @jest-environment jsdom */

/**
 * A streaming reply never shows its project-memory proposal (ADR 2026-11-04
 * D6; PR #200 F-02), through the real App and StreamingContent: the frame
 * is held from its first `<` while it streams, and stays hidden when the
 * stream completes, is cancelled, or the host rejects the proposal.
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  MessageType,
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
jest.mock('../../../presentation/webview/styles/workshop/memory.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/widgets/gesturePlayground/gesturePlayground.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/widgets/lexicalGravity/lexicalGravity.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/widgets/creativeVariations/creativeVariations.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/widgets/showVsTell/showVsTell.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/standingDirectiveRail.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/schematic/schematic.css', () => ({}));
// eslint-disable-next-line @typescript-eslint/naming-convention -- the mocked module's export is a component name
jest.mock('../../../presentation/webview/components/shared/PmLogo', () => ({ PmLogo: () => null }));

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { WorkshopApp } from '@/presentation/webview/WorkshopApp';

const hostTurn: WorkshopTurn = {
  id: 'turn-2',
  role: 'assistant',
  kind: 'message',
  participant: 'host',
  artifact: 'persona_message',
  personaId: 'jill',
  personaLabel: 'Jill',
  content: 'Let the father stay quiet one line longer.',
  timestamp: 2,
  excerptVersion: 0
};

const writerTurn: WorkshopTurn = {
  id: 'turn-1',
  role: 'user',
  kind: 'message',
  participant: 'writer',
  artifact: 'persona_message',
  content: 'Does the lantern beat land?',
  timestamp: 1,
  excerptVersion: 0
};

const session = (overrides: Partial<WorkshopSessionSnapshot> = {}): WorkshopSessionStateMessage => ({
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
      reactions: [],
      turns: [writerTurn, hostTurn],
      turnRewindability: {},
      totalTurns: 2,
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

const deliver = (message: unknown) =>
  act(() => window.dispatchEvent(new MessageEvent('message', { data: message })));


const stream = (type: MessageType, payload: Record<string, unknown>) => deliver({
  type, source: 'extension.workshop', payload: { requestId: 'req-mem', domain: 'workshop', ...payload }, timestamp: 0
});

const PROSE = 'Let the father stay quiet one line longer.';
const FRAME = '<prose-minion-memory-proposal><title>SENTINEL title</title><kind>decision</kind>'
  + '<summary>SENTINEL summary</summary><body>SENTINEL body</body></prose-minion-memory-proposal>';
const REPLY = `${PROSE}\n\n${FRAME}`;

const threadText = () => screen.getByLabelText('Session thread').textContent ?? '';
const expectNoFrame = () => {
  expect(threadText()).not.toMatch(/SENTINEL|prose-minion-mem/);
};

describe('WorkshopApp streaming a memory proposal (PR #200 F-02)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (useVSCodeApi as jest.Mock).mockReturnValue(createMockVSCode());
    Element.prototype.scrollIntoView = jest.fn();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const streamReply = () => {
    render(<WorkshopApp />);
    deliver(session({ turns: [writerTurn], totalTurns: 1 }));
    stream(MessageType.STREAM_STARTED, {});
    // One character at a time, so every split of the opening tag is seen.
    for (const token of REPLY) {
      stream(MessageType.STREAM_CHUNK, { token });
      act(() => { jest.advanceTimersByTime(1000); });
      expectNoFrame();
    }
    expect(threadText()).toContain(PROSE);
  };

  it('never shows the frame while it streams, nor once the reply completes and lands', () => {
    streamReply();
    stream(MessageType.STREAM_COMPLETE, { content: REPLY, cancelled: false });
    act(() => { jest.advanceTimersByTime(1000); });
    expectNoFrame();
    deliver(session({ turns: [writerTurn, { ...hostTurn, content: PROSE }], totalTurns: 2 }));
    expectNoFrame();
    expect(threadText()).toContain(PROSE);
  });

  it('never shows the frame when the stream is cancelled', () => {
    streamReply();
    stream(MessageType.STREAM_COMPLETE, { content: REPLY, cancelled: true });
    act(() => { jest.advanceTimersByTime(1000); });
    expectNoFrame();
  });

  it('never shows the frame when the host rejects the proposal, and keeps the prose (PR #200 N-01)', () => {
    // A rejected proposal persists no card: the reply lands as its prose alone.
    const errors = jest.spyOn(console, 'error');
    streamReply();
    stream(MessageType.STREAM_COMPLETE, { content: REPLY, cancelled: false });
    deliver(session({ turns: [writerTurn, { ...hostTurn, content: PROSE }], totalTurns: 2 }));
    expectNoFrame();
    expect(threadText()).toContain(PROSE);
    expect(screen.queryByRole('button', { name: /^Save$/ })).toBeNull();
    const renderErrors = errors.mock.calls.filter(([first]) => !String(first).includes('not wrapped in act'));
    expect(renderErrors).toEqual([]);
    errors.mockRestore();
  });

  it('never shows a frame left open when the stream ends', () => {
    render(<WorkshopApp />);
    deliver(session({ turns: [writerTurn], totalTurns: 1 }));
    stream(MessageType.STREAM_STARTED, {});
    stream(MessageType.STREAM_CHUNK, { token: `${PROSE}\n\n<prose-minion-memory-proposal><title>SENTINEL` });
    act(() => { jest.advanceTimersByTime(5000); });
    act(() => { jest.advanceTimersByTime(1000); });
    expectNoFrame();
    expect(threadText()).toContain(PROSE);
    stream(MessageType.STREAM_COMPLETE, { content: `${PROSE}\n\n<prose-minion-memory-proposal><title>SENTINEL`, cancelled: true });
    act(() => { jest.advanceTimersByTime(1000); });
    expectNoFrame();
  });
});
