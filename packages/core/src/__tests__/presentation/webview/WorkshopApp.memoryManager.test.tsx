/** @jest-environment jsdom */

/**
 * The Memory tab and the memory manager through the real WorkshopApp (epic
 * Slice 4b): opening Conversation settings asks for the folder's listing;
 * the tab draws the host's figures; the manager opens over the settings,
 * whose drafts stay; Edit opens Slice 3's sheet; the mode applies with the
 * other drafts. *Alice*, made-up ids.
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
      turns: [],
      turnRewindability: {},
      totalTurns: 0,
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
    projectMemory: 'ask',
    persistence: { available: true, degradedConversationKeys: [] }
  },
  timestamp: 0
});


const deliver = (message: unknown) =>
  act(() => window.dispatchEvent(new MessageEvent('message', { data: message })));

const ENTRY = {
  entryKey: 'a'.repeat(32), id: 'mem-7f3c21', title: 'The Rabbit’s watch runs backward', kind: 'canon', summary: 'From chapter 3 on.',
  status: 'active', pinned: false, created: '2026-11-01T10:00:00Z', updated: '2026-11-03T10:00:00Z', origin: 'writer',
  source: { kind: 'none' }, superseded: false, supersededBy: [], busy: false, fullLoad: null, residency: 'listed'
};
const ESTIMATE = { memories: 1, pinned: 0, pinnedLoaded: 0, pinnedTokens: 0, pinnedOver: false, catalogTokens: 40, frameTokens: 90, pinnedLoadedTokens: 0, catalogEntries: 1 };

describe('WorkshopApp · the Memory tab and the manager (Slice 4b)', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const posted = (type: MessageType) => vscode.postMessage.mock.calls
    .map(([message]: [{ type: MessageType; payload: Record<string, unknown> }]) => message)
    .filter((message) => message.type === type);
  const answerListing = () => {
    const requests = posted(MessageType.WORKSHOP_MEMORY_LIST);
    deliver({
      type: MessageType.WORKSHOP_MEMORY_LISTING,
      source: 'extension.workshop',
      payload: { requestId: requests[requests.length - 1].payload.requestId, workspace: { kind: 'available' }, saved: 1, estimate: ESTIMATE, memories: [ENTRY], unreadable: [], conflicts: [] },
      timestamp: 0
    });
  };

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

  it('lists on open, opens the manager over the settings, edits through the sheet, and applies the mode with the rest', () => {
    render(<WorkshopApp />);
    deliver(session());
    fireEvent.click(screen.getByRole('button', { name: /^Conversation settings:/ }));
    expect(posted(MessageType.WORKSHOP_MEMORY_LIST)).toHaveLength(1);
    answerListing();

    const settings = screen.getByRole('dialog', { name: 'Conversation settings' });
    fireEvent.click(within(settings).getByRole('tab', { name: 'Memory' }));
    expect(within(settings).getByText('1 memory')).not.toBeNull();
    expect(within(settings).getByRole('button', { name: /^Ask first/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(settings).getByRole('button', { name: /^Save and tell me/ }));

    fireEvent.click(within(settings).getByRole('button', { name: 'Manage memories…' }));
    act(() => { jest.runOnlyPendingTimers(); });
    expect(posted(MessageType.WORKSHOP_MEMORY_LIST)).toHaveLength(2);
    answerListing();
    const manager = screen.getByRole('dialog', { name: 'Project memories' });
    fireEvent.click(within(manager).getByRole('button', { name: 'Edit' }));
    expect(posted(MessageType.WORKSHOP_MEMORY_REQUEST_EDIT).map((entry) => entry.payload.memoryId)).toEqual(['mem-7f3c21']);

    fireEvent.click(within(manager).getByRole('button', { name: 'Close project memories' }));
    act(() => { jest.runOnlyPendingTimers(); });
    expect(screen.queryByRole('dialog', { name: 'Project memories' })).toBeNull();
    // The settings stayed open, their draft kept.
    const still = screen.getByRole('dialog', { name: 'Conversation settings' });
    expect(within(still).getByRole('button', { name: /^Save and tell me/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(still).getByRole('button', { name: 'Apply to next turn' }));
    expect(posted(MessageType.WORKSHOP_SET_CONVERSATION_SETTINGS).map((entry) => entry.payload.projectMemory)).toEqual(['auto']);
  });

  const reply = (proposal: Record<string, unknown>): WorkshopTurn => ({
    id: 'turn-4-assistant-1008', role: 'assistant', kind: 'message', participant: 'host', artifact: 'persona_message',
    personaId: 'jill', personaLabel: 'Jill', excerptVersion: 1, content: 'Good. It earns its place.', timestamp: 1,
    memoryProposals: [{ proposes: 'new', title: 'The Rabbit’s watch runs backward', kind: 'canon', summary: 'From chapter 3 on.', body: '', ...proposal }]
  } as unknown as WorkshopTurn);
  const managerResult = (requestId: unknown, ok: boolean, error?: string) => deliver({
    type: MessageType.WORKSHOP_MEMORY_MANAGER_RESULT,
    source: 'extension.workshop',
    payload: { requestId, ok, ...(error ? { error } : {}) },
    timestamp: 0
  });
  const openMemoryTab = () => {
    fireEvent.click(screen.getByRole('button', { name: /^Conversation settings:/ }));
    answerListing();
    const settings = screen.getByRole('dialog', { name: 'Conversation settings' });
    fireEvent.click(within(settings).getByRole('tab', { name: 'Memory' }));
    return settings;
  };

  it.each([
    ['folder creation', 'The memory folder couldn’t be made.'],
    ['the shell', 'The memory folder couldn’t be opened.']
  ])('Open memory folder refused by %s says why in the Memory tab, and a retry clears it (PR #202 F04)', (_where, error) => {
    render(<WorkshopApp />);
    deliver(session());
    const settings = openMemoryTab();
    fireEvent.click(within(settings).getByRole('button', { name: 'Open memory folder' }));
    const [press] = posted(MessageType.WORKSHOP_MEMORY_MANAGER_ACTION);
    expect(press.payload.action).toBe('open-folder');
    expect(within(settings).getByRole('button', { name: 'Open memory folder' }).getAttribute('aria-busy')).toBe('true');
    managerResult(press.payload.requestId, false, error);
    answerListing();

    const alert = within(settings).getByRole('alert');
    expect(alert.textContent).toContain('The memory folder didn’t open.');
    expect(alert.textContent).toContain(error);
    expect(within(settings).getByRole('button', { name: 'Open memory folder' }).getAttribute('aria-describedby')).toBeTruthy();

    fireEvent.click(within(settings).getByRole('button', { name: 'Open memory folder' }));
    expect(within(settings).queryByRole('alert')).toBeNull();
    managerResult(posted(MessageType.WORKSHOP_MEMORY_MANAGER_ACTION)[1].payload.requestId, true);
    expect(within(settings).queryByRole('alert')).toBeNull();
  });

  it('a card saved while the Memory tab shows asks for the listing again (PR #202 N01)', () => {
    render(<WorkshopApp />);
    deliver(session({ turns: [reply({ state: 'pending' })], totalTurns: 1 }));
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
    const [save] = posted(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION);
    openMemoryTab();
    const before = posted(MessageType.WORKSHOP_MEMORY_LIST).length;
    deliver({
      type: MessageType.WORKSHOP_MEMORY_WRITE_RESULT,
      source: 'extension.workshop',
      payload: { requestId: save.payload.requestId, ok: true, memoryId: 'mem-7f3c21' },
      timestamp: 0
    });
    expect(posted(MessageType.WORKSHOP_MEMORY_LIST)).toHaveLength(before + 1);
  });

  it('a saved card’s Open in manager opens the manager on its memory (PR #202 N02)', () => {
    render(<WorkshopApp />);
    deliver(session({ turns: [reply({ state: 'saved', memoryId: 'mem-7f3c21' })], totalTurns: 1 }));
    fireEvent.click(screen.getByRole('button', { name: 'Open in manager' }));
    act(() => { jest.runOnlyPendingTimers(); });
    answerListing();
    const manager = screen.getByRole('dialog', { name: 'Project memories' });
    const marked = manager.querySelector('[aria-current="true"]');
    expect(marked?.textContent).toContain('The Rabbit’s watch runs backward');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('“Memory isn’t context” starts open, folds away, and stays folded for this viewer (Slice 6 live pass)', () => {
    const view = render(<WorkshopApp />);
    deliver(session());
    let settings = openMemoryTab();
    const head = () => within(settings).getByRole('button', { name: /^Memory isn’t context\./ });
    expect(head().getAttribute('aria-expanded')).toBe('true');
    expect(within(settings).getByText('Every conversation in this project')).not.toBeNull();

    fireEvent.click(head());
    expect(head().getAttribute('aria-expanded')).toBe('false');
    const table = document.getElementById(head().getAttribute('aria-controls') ?? '');
    expect(table?.hidden).toBe(true);
    expect(vscode.setState).toHaveBeenLastCalledWith(expect.objectContaining({ workshopMemoryExplainerOpen: false }));

    // A reload reads the viewer's choice back from webview state.
    view.unmount();
    vscode.getState.mockReturnValue({ workshopMemoryExplainerOpen: false });
    render(<WorkshopApp />);
    deliver(session());
    settings = openMemoryTab();
    expect(head().getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(head());
    expect(head().getAttribute('aria-expanded')).toBe('true');
    expect(vscode.setState).toHaveBeenLastCalledWith(expect.objectContaining({ workshopMemoryExplainerOpen: true }));
  });

  describe('a receipt\'s refused Forget or Restore shows beside it (PR #221 F-01)', () => {
    const BUSY = 'Another window is editing that memory. Try again in a moment.';
    const receipt = (id: string, action: 'saved' | 'forgotten'): WorkshopTurn => ({
      id, role: 'system', kind: 'divider', participant: 'session', artifact: 'memory_receipt', excerptVersion: 1, timestamp: 2,
      content: action === 'saved'
        ? 'Jill saved to project memory: The Rabbit’s watch runs backward (mem-7f3c21).'
        : 'Forgotten from project memory: The Rabbit’s watch runs backward (mem-7f3c21).',
      projectMemoryReceipt: action === 'saved'
        ? { action, memoryId: 'mem-7f3c21', title: 'The Rabbit’s watch runs backward', version: '0123456789ab', by: 'auto', proposedBy: 'jill' }
        : { action, memoryId: 'mem-7f3c21', title: 'The Rabbit’s watch runs backward', version: '0123456789ab', by: 'writer' }
    } as unknown as WorkshopTurn);
    const writeResult = (requestId: unknown, ok: boolean, error?: string) => deliver({
      type: MessageType.WORKSHOP_MEMORY_WRITE_RESULT,
      source: 'extension.workshop',
      payload: { requestId, ok, ...(error ? { error } : {}) },
      timestamp: 0
    });
    const lastForget = () => {
      const requests = posted(MessageType.WORKSHOP_MEMORY_FORGET);
      return requests[requests.length - 1].payload;
    };

    it.each([
      ['Forget', 'saved', 'forget', 'Couldn’t forget it.'],
      ['Restore', 'forgotten', 'restore', 'Couldn’t restore it.']
    ] as const)('%s refused: an alert under its receipt, cleared by a retry; a success shows none', (button, action, posts, heading) => {
      render(<WorkshopApp />);
      deliver(session({ turns: [receipt('turn-5-system-1010', action)], totalTurns: 1 }));
      fireEvent.click(screen.getByRole('button', { name: button }));
      expect(lastForget()).toMatchObject({ memoryId: 'mem-7f3c21', action: posts });
      expect((screen.getByRole('button', { name: button }) as HTMLButtonElement).disabled).toBe(true);

      writeResult(lastForget().requestId, false, BUSY);
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toContain(heading);
      expect(alert.textContent).toContain(BUSY);
      expect((screen.getByRole('button', { name: button }) as HTMLButtonElement).disabled).toBe(false);

      fireEvent.click(screen.getByRole('button', { name: button }));
      expect(screen.queryByRole('alert')).toBeNull();
      writeResult(lastForget().requestId, true);
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('an answer nobody asked for says nothing, and a new room drops the old one\'s refusal', () => {
      render(<WorkshopApp />);
      deliver(session({ turns: [receipt('turn-5-system-1010', 'saved')], totalTurns: 1 }));
      writeResult('ws-memory-unknown-1', false, BUSY);
      expect(screen.queryByRole('alert')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Forget' }));
      writeResult(lastForget().requestId, false, BUSY);
      expect(screen.getByRole('alert').textContent).toContain(BUSY);

      // A Branch keeps the receipt's turn id; the new room still starts quiet.
      deliver(session({ turns: [receipt('turn-5-system-1010', 'saved')], totalTurns: 1, roomRevision: 2 }));
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });
});

