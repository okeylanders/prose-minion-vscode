/** @jest-environment jsdom */

/**
 * File-edit cards through the real App and its router (ADR 2026-11-05 D8,
 * D9; epic Slice 4b): a card on the snapshot's reply posts Apply under the
 * room on screen; the host's answer reaches the card's status line; an
 * answer for an earlier room is ignored; the snapshot's state replaces the
 * buttons; and nothing in the tree or the posts names a URI. *Alice*.
 */

import * as React from 'react';
import { fireEvent, render, screen, act } from '@testing-library/react';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  MessageType,
  type WorkshopFileEditProposal,
  type WorkshopSessionSnapshot,
  type WorkshopSessionStateMessage,
  type WorkshopTurn
} from '@messages';
import { workshopFileEditCardWords } from '@shared/constants/workshopFileEditWords';
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

const PATH = 'chapters/one.md';

const proposal = (change: Partial<WorkshopFileEditProposal> = {}): WorkshopFileEditProposal => ({
  requested: { kind: 'resource', group: 'chapters', path: PATH },
  target: { kind: 'file', relativePath: PATH },
  class: 'prose',
  operations: [{ op: 'replace', find: 'Alice ran down the hall.', with: 'Alice walked down the hall.' }],
  why: 'Slow the chase before the fall.',
  baseline: { sha256: 'a'.repeat(64), length: 1200 },
  state: 'pending',
  ...change
});

const reply = (card: WorkshopFileEditProposal): WorkshopTurn => ({
  id: 'turn-2',
  role: 'assistant',
  kind: 'message',
  participant: 'host',
  artifact: 'persona_message',
  personaId: 'jill',
  personaLabel: 'Jill',
  content: 'One small change to the chase.',
  timestamp: 2,
  excerptVersion: 0,
  fileEditProposals: [card]
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
      roomRevision: 5,
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

const deliver = (message: unknown) =>
  act(() => window.dispatchEvent(new MessageEvent('message', { data: message })));

const answer = (payload: Record<string, unknown>) => deliver({
  type: MessageType.WORKSHOP_FILE_EDIT_RESULT,
  source: 'extension.workshop',
  payload: { roomRevision: 5, turnId: 'turn-2', index: 0, ...payload },
  timestamp: 0
});

describe('WorkshopApp file-edit cards', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const actions = () => vscode.postMessage.mock.calls
    .map(([message]: [{ type: MessageType; payload: Record<string, unknown> }]) => message)
    .filter((message) => message.type === MessageType.WORKSHOP_FILE_EDIT_ACTION);
  const status = () => screen.getByRole('group', { name: `Suggested edit to ${PATH}` }).querySelector('[role="status"]')!;

  beforeEach(() => {
    jest.useFakeTimers();
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    Element.prototype.scrollIntoView = jest.fn();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('Apply posts under the room on screen, and the host\'s refusal reaches the card', () => {
    render(<WorkshopApp />);
    deliver(session([reply(proposal())]));
    fireEvent.click(screen.getByRole('button', { name: `Apply, edit to ${PATH}` }));
    const [sent] = actions();
    expect(sent.payload).toMatchObject({ roomRevision: 5, turnId: 'turn-2', index: 0, action: 'apply' });
    expect(screen.getByRole('group', { name: `Suggested edit to ${PATH}` }).getAttribute('aria-busy')).toBe('true');

    const words = workshopFileEditCardWords('pending', 'checkpoint-failed');
    answer({ requestId: sent.payload.requestId, answer: 'refused', state: 'pending', reason: 'checkpoint-failed', message: words });
    expect(status().textContent).toBe(words);
    expect(screen.getByRole('group', { name: `Suggested edit to ${PATH}` }).getAttribute('aria-busy')).toBe('false');
  });

  it('an answer for an earlier room is ignored', () => {
    render(<WorkshopApp />);
    deliver(session([reply(proposal())]));
    fireEvent.click(screen.getByRole('button', { name: `Apply, edit to ${PATH}` }));
    const [sent] = actions();
    // The room is replaced (Open, Rewind…) with a card at the same ids.
    deliver(session([reply(proposal())], { roomRevision: 6 }));
    answer({ requestId: sent.payload.requestId, answer: 'refused', state: 'pending', reason: 'run-active', message: 'Old room.' });
    expect(status().textContent).toBe(workshopFileEditCardWords('pending'));
  });

  it('the snapshot\'s outcome replaces the buttons with the host\'s words', () => {
    render(<WorkshopApp />);
    deliver(session([reply(proposal())]));
    fireEvent.click(screen.getByRole('button', { name: `Apply, edit to ${PATH}` }));
    const [sent] = actions();
    deliver(session([reply(proposal({ state: 'applied', outcomes: ['landed'] }))]));
    answer({ requestId: sent.payload.requestId, answer: 'settled', state: 'applied', message: 'Applied.' });
    expect(screen.queryByRole('button', { name: `Apply, edit to ${PATH}` })).toBeNull();
    expect(status().textContent).toBe(workshopFileEditCardWords('applied'));
  });

  it('names no URI in the tree or in what it posts', () => {
    const { container } = render(<WorkshopApp />);
    deliver(session([reply(proposal())]));
    fireEvent.click(screen.getByRole('button', { name: `Review in editor, edit to ${PATH}` }));
    expect(container.innerHTML).not.toMatch(/documentUri|file:\/\//u);
    expect(JSON.stringify(actions())).not.toMatch(/documentUri|file:/u);
  });
});
