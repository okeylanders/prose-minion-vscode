/** @jest-environment jsdom */

/**
 * `@` in the Workshop composer, end to end through WorkshopApp (Everyday
 * Conveniences round two, item G). It adds no route: opening the list asks
 * for the catalog the project picker asks for, a pick stages by catalog key
 * through `WORKSHOP_ATTACH_MESSAGE_RESOURCES`, and Browse project… opens the
 * picker in its message mode. The pill is the host's snapshot, as ever
 * (decision A1). All file names are synthetic.
 */

import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  MessageType,
  WorkshopSessionScope,
  WorkshopSessionStateMessage
} from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { __resetOverlayFocusStateForTests } from '@hooks/useOverlayDismiss';

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
// eslint-disable-next-line @typescript-eslint/naming-convention -- the mocked module's export name.
jest.mock('../../../presentation/webview/components/shared/PmLogo', () => ({ PmLogo: () => null }));

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { WorkshopApp } from '@/presentation/webview/WorkshopApp';

const CATALOG = [
  { group: 'characters', path: 'Characters/marlow.md', label: 'marlow', sizeBytes: 1200 },
  { group: 'chapters', path: 'Chapters/01-the-river.md', label: '01 the river', sizeBytes: 18_400 },
  { group: 'chapters', path: 'Chapters/02-the-station.md', label: '02 the station', sizeBytes: 21_300 },
  { group: 'themes', path: 'Themes/rivers.md', label: 'rivers', sizeBytes: 700 }
];

const session = (scope: WorkshopSessionScope): WorkshopSessionStateMessage => ({
  type: MessageType.WORKSHOP_SESSION_STATE,
  source: 'extension.workshop',
  payload: {
    session: {
      scope,
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
      turns: [],
      turnRewindability: {},
      totalTurns: 0,
      truncatedTurns: 0,
      roomHasMemory: false,
      participants: {
        host: { personaId: 'jill', hasConversation: false },
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
});

const deliver = (data: object) =>
  act(() => { window.dispatchEvent(new MessageEvent('message', { data })); });

describe('WorkshopApp @ mentions', () => {
  let vscode: ReturnType<typeof createMockVSCode>;

  beforeEach(() => {
    jest.useFakeTimers();
    __resetOverlayFocusStateForTests();
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
    __resetOverlayFocusStateForTests();
  });

  function open() {
    render(<WorkshopApp />);
    deliver(session('open'));
    let seen = vscode.postMessage.mock.calls.length;
    const posted = () => {
      const calls = vscode.postMessage.mock.calls.slice(seen).map(([message]) => ({
        type: message.type,
        payload: message.payload
      }));
      seen = vscode.postMessage.mock.calls.length;
      return calls;
    };
    const answerCatalog = () => deliver({
      type: MessageType.WORKSHOP_CONTEXT_CATALOG,
      source: 'extension.workshop',
      payload: { entries: CATALOG },
      timestamp: 1
    });
    const input = screen.getByRole('textbox', { name: /^Message / }) as HTMLTextAreaElement;
    return { posted, answerCatalog, input };
  }

  it('asks for the catalog on @, and a pick stages the file by catalog key through the existing route', () => {
    const { posted, answerCatalog, input } = open();
    posted();

    fireEvent.change(input, { target: { value: 'compare with @' } });
    expect(posted()).toEqual([{ type: MessageType.WORKSHOP_REQUEST_CONTEXT_CATALOG, payload: {} }]);
    expect(screen.getByText('Loading project files…')).toBeTruthy();

    answerCatalog();
    expect(screen.getAllByRole('option')).toHaveLength(CATALOG.length + 1);

    fireEvent.change(input, { target: { value: 'compare with @station' } });
    expect(posted()).toEqual([]);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(posted()).toEqual([{
      type: MessageType.WORKSHOP_ATTACH_MESSAGE_RESOURCES,
      payload: { items: [{ group: 'chapters', path: 'Chapters/02-the-station.md' }] }
    }]);
    expect(input.value).toBe('compare with @02-the-station.md ');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('the pill is the host\'s: a staged file shows as attached and a second pick posts nothing', () => {
    const { posted, answerCatalog, input } = open();
    const state = session('open');
    state.payload.session.pendingMessageAttachments = [{
      id: 'ta-1',
      label: '02-the-station.md',
      words: 3200,
      relativePath: 'Chapters/02-the-station.md',
      configuredResource: { group: 'chapters', path: 'Chapters/02-the-station.md' }
    }];
    deliver(state);
    expect(screen.getByRole('button', { name: 'Remove 02-the-station.md from this message' })).toBeTruthy();

    fireEvent.change(input, { target: { value: '@station' } });
    answerCatalog();
    posted();
    expect(screen.getAllByRole('option')[0].textContent).toContain('attached');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(posted()).toEqual([]);
    expect(input.value).toBe('@02-the-station.md ');
  });

  it('Browse project… opens the project picker in its message mode', () => {
    const { posted, answerCatalog, input } = open();
    fireEvent.change(input, { target: { value: '@' } });
    answerCatalog();
    posted();

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(posted()).toEqual([{ type: MessageType.WORKSHOP_REQUEST_CONTEXT_CATALOG, payload: {} }]);
    expect(screen.getByRole('dialog').textContent).toContain('this message');
    expect(input.value).toBe('');
  });
});
