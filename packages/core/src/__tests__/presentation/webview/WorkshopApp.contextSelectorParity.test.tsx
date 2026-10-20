/** @jest-environment jsdom */

/**
 * Workshop context selector parity, end to end through WorkshopApp
 * (Lightbox source picker, 2026-10-20).
 *
 * Recorded against the Workshop's own modal BEFORE its picker UI moved into
 * the component the Lightbox shares. Each mode is opened from its real
 * button (the excerpt card's "Choose from project…", the context card's
 * "Add from project…", the composer's "Attach to this message"), fed the
 * host's catalog and content-search answers, and driven to its outcome. Each
 * step snapshots exactly what the webview posted (type, source and payload;
 * timestamps dropped) and the dialog's markup. All file names are synthetic.
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
jest.mock('../../../presentation/webview/components/workshop/widgets/gesturePlayground/gesturePlayground.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/widgets/lexicalGravity/lexicalGravity.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/widgets/creativeVariations/creativeVariations.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/widgets/showVsTell/showVsTell.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/standingDirectiveRail.css', () => ({}));
jest.mock('../../../presentation/webview/components/workshop/schematic/schematic.css', () => ({}));
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

describe('WorkshopApp context selector parity (recorded before the shared picker)', () => {
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

  /** Mount the Workshop in `scope`, then report what each step posts and shows. */
  function open(scope: WorkshopSessionScope) {
    render(<WorkshopApp />);
    deliver(session(scope));
    let seen = vscode.postMessage.mock.calls.length;
    const posted = () => {
      const calls = vscode.postMessage.mock.calls.slice(seen).map(([message]) => ({
        type: message.type,
        source: message.source,
        payload: message.payload
      }));
      seen = vscode.postMessage.mock.calls.length;
      return calls;
    };
    const dialog = () => screen.queryByRole('dialog')?.outerHTML ?? null;
    const step = () => ({ posted: posted(), dialog: dialog() });
    const answerCatalog = () => deliver({
      type: MessageType.WORKSHOP_CONTEXT_CATALOG,
      source: 'extension.workshop',
      payload: { entries: CATALOG },
      timestamp: 1
    });
    return { step, answerCatalog };
  }

  it('excerpt: Choose from project…, browse, search both ways, pick; then the escape hatch', () => {
    const { step, answerCatalog } = open(null);
    step();

    fireEvent.click(screen.getAllByRole('button', { name: /Choose from project…/ })[0]);
    expect(step()).toMatchSnapshot('opened');
    answerCatalog();
    expect(step()).toMatchSnapshot('catalog arrived');
    fireEvent.click(screen.getByRole('button', { name: /Chapters & Scenes/ }));
    expect(step()).toMatchSnapshot('chapters');

    fireEvent.change(screen.getByLabelText('Search configured resources'), { target: { value: 'river' } });
    fireEvent.click(screen.getByRole('button', { name: /names \+ content/i }));
    act(() => { jest.advanceTimersByTime(400); });
    expect(step()).toMatchSnapshot('content search asked');
    deliver({
      type: MessageType.WORKSHOP_CONTEXT_SEARCH_RESULTS,
      source: 'extension.workshop',
      payload: { query: 'river', matches: [{ group: 'characters', path: 'Characters/marlow.md' }], bounded: false },
      timestamp: 2
    });
    expect(step()).toMatchSnapshot('content results');
    fireEvent.click(screen.getByRole('button', { name: /Characters\/marlow\.md/ }));
    expect(step()).toMatchSnapshot('picked');

    fireEvent.click(screen.getAllByRole('button', { name: /Choose from project…/ })[0]);
    answerCatalog();
    expect(step()).toMatchSnapshot('reopened');
    fireEvent.click(screen.getByRole('button', { name: /Explore project folders/ }));
    expect(step()).toMatchSnapshot('explored');
  });

  it('attach: Add from project…, select two, confirm; then the escape hatch', () => {
    const { step, answerCatalog } = open(null);
    step();

    fireEvent.click(screen.getByRole('button', { name: /Add from project…/ }));
    answerCatalog();
    expect(step()).toMatchSnapshot('opened');
    fireEvent.click(screen.getByRole('button', { name: /Chapters & Scenes/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /01-the-river/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /02-the-station/ }));
    expect(step()).toMatchSnapshot('two selected');
    fireEvent.click(screen.getByRole('button', { name: /Add 2 files/ }));
    expect(step()).toMatchSnapshot('confirmed');

    fireEvent.click(screen.getByRole('button', { name: /Add from project…/ }));
    answerCatalog();
    step();
    fireEvent.click(screen.getByRole('button', { name: /Explore project folders/ }));
    expect(step()).toMatchSnapshot('explored');
  });

  it('message: Attach to this message, select one, confirm; then the escape hatch', () => {
    const { step, answerCatalog } = open('open');
    step();

    const openFromComposer = () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add context' }));
      fireEvent.click(screen.getByRole('menuitem', { name: /Attach to this message/ }));
    };
    openFromComposer();
    answerCatalog();
    expect(step()).toMatchSnapshot('opened');
    fireEvent.click(screen.getByRole('button', { name: /Themes/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /rivers/ }));
    expect(step()).toMatchSnapshot('one selected');
    fireEvent.click(screen.getByRole('button', { name: /Attach 1/ }));
    expect(step()).toMatchSnapshot('confirmed');

    openFromComposer();
    answerCatalog();
    step();
    fireEvent.click(screen.getByRole('button', { name: /Explore project folders/ }));
    expect(step()).toMatchSnapshot('explored');
  });
});
