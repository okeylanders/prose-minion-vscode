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

  describe('an open rewrite disclosure across a room change (PR #234 F-01)', () => {
    const NOTE = 'notes/cast.md';
    const rewrite = () => proposal({
      target: { kind: 'file', relativePath: NOTE },
      class: 'notes',
      operations: [{ op: 'rewrite', text: 'Cast: Alice, the White Rabbit.' }],
      why: 'Add the Rabbit to the cast list.'
    });
    const previewRequests = () => vscode.postMessage.mock.calls
      .map(([message]: [{ type: MessageType; payload: Record<string, unknown> }]) => message)
      .filter((message) => message.type === MessageType.WORKSHOP_FILE_EDIT_PREVIEW);
    const card = () => screen.getByRole('group', { name: `Suggested edit to ${NOTE}` });
    const openDisclosure = () => {
      const details = card().querySelector('details') as HTMLDetailsElement;
      act(() => {
        details.open = true;
        details.dispatchEvent(new Event('toggle'));
      });
      return details;
    };
    const previewAnswer = (requestId: unknown, roomRevision: number, before: string) => deliver({
      type: MessageType.WORKSHOP_FILE_EDIT_PREVIEW_RESULT,
      source: 'extension.workshop',
      payload: { requestId, roomRevision, turnId: 'turn-2', index: 0, preview: { kind: 'rewrite', before, after: 'Cast: Alice, the White Rabbit.' } },
      timestamp: 0
    });

    it('a preview already read for the old room is asked again for the new one', () => {
      render(<WorkshopApp />);
      deliver(session([reply(rewrite())]));
      const details = openDisclosure();
      const [first] = previewRequests();
      expect(first.payload.roomRevision).toBe(5);
      previewAnswer(first.payload.requestId, 5, 'ROOM-5 cast list.');
      expect(card().textContent).toContain('ROOM-5 cast list.');

      deliver(session([reply(rewrite())], { roomRevision: 6 }));
      // The same disclosure stays mounted and open, and asks for room 6.
      expect(card().querySelector('details')).toBe(details);
      expect(details.open).toBe(true);
      const requests = previewRequests();
      expect(requests).toHaveLength(2);
      expect(requests[1].payload.roomRevision).toBe(6);
      expect(card().textContent).not.toContain('ROOM-5 cast list.');
      expect(card().textContent).toContain('Reading the file…');

      previewAnswer(requests[1].payload.requestId, 6, 'ROOM-6 cast list.');
      expect(card().textContent).toContain('ROOM-6 cast list.');
    });

    it('a preview still in flight for the old room is asked again, and its late answer never shows', () => {
      render(<WorkshopApp />);
      deliver(session([reply(rewrite())]));
      openDisclosure();
      const [first] = previewRequests();

      deliver(session([reply(rewrite())], { roomRevision: 6 }));
      const requests = previewRequests();
      expect(requests).toHaveLength(2);
      expect(requests[1].payload.roomRevision).toBe(6);

      previewAnswer(first.payload.requestId, 5, 'ROOM-5 cast list.');
      expect(card().textContent).not.toContain('ROOM-5 cast list.');
      expect(card().textContent).toContain('Reading the file…');

      previewAnswer(requests[1].payload.requestId, 6, 'ROOM-6 cast list.');
      expect(card().textContent).toContain('ROOM-6 cast list.');
      expect(previewRequests()).toHaveLength(2);
    });

    const refuse = (requestId: unknown) => deliver({
      type: MessageType.WORKSHOP_FILE_EDIT_PREVIEW_RESULT,
      source: 'extension.workshop',
      payload: {
        requestId, roomRevision: 5, turnId: 'turn-2', index: 0,
        preview: { kind: 'refused', reason: 'unreadable', message: 'That file could not be opened or read as text.' }
      },
      timestamp: 0
    });
    const toggle = (details: HTMLDetailsElement, open: boolean) => act(() => {
      details.open = open;
      details.dispatchEvent(new Event('toggle'));
    });

    it('a refused preview is asked again when the writer reopens the disclosure (PR #234 F-02)', () => {
      render(<WorkshopApp />);
      deliver(session([reply(rewrite())]));
      const details = openDisclosure();
      const [first] = previewRequests();
      refuse(first.payload.requestId);
      expect(card().textContent).toContain('That file could not be opened or read as text.');

      toggle(details, false);
      expect(previewRequests()).toHaveLength(1);
      toggle(details, true);
      const requests = previewRequests();
      expect(requests).toHaveLength(2);
      expect(requests[1].payload.roomRevision).toBe(5);
      previewAnswer(requests[1].payload.requestId, 5, 'ROOM-5 cast list.');
      expect(card().textContent).toContain('ROOM-5 cast list.');
    });

    it('a refused preview left open is not retried on its own (PR #234 F-02 control)', () => {
      render(<WorkshopApp />);
      deliver(session([reply(rewrite())]));
      openDisclosure();
      const [first] = previewRequests();
      refuse(first.payload.requestId);
      // Later renders (another snapshot of the same room) ask nothing more.
      deliver(session([reply(rewrite())]));
      deliver(session([reply(rewrite())]));
      expect(previewRequests()).toHaveLength(1);
      expect(card().textContent).toContain('That file could not be opened or read as text.');
    });

    it('a closed disclosure asks nothing when the room changes', () => {
      render(<WorkshopApp />);
      deliver(session([reply(rewrite())]));
      deliver(session([reply(rewrite())], { roomRevision: 6 }));
      expect(previewRequests()).toHaveLength(0);
    });
  });

  it('names no URI in the tree or in what it posts', () => {
    const { container } = render(<WorkshopApp />);
    deliver(session([reply(proposal())]));
    fireEvent.click(screen.getByRole('button', { name: `Review in editor, edit to ${PATH}` }));
    expect(container.innerHTML).not.toMatch(/documentUri|file:\/\//u);
    expect(JSON.stringify(actions())).not.toMatch(/documentUri|file:/u);
  });
});
