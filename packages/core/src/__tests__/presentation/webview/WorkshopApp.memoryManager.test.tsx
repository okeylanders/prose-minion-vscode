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
});
