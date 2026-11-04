/** @jest-environment jsdom */

/**
 * WorkshopApp Read in (ADR 2026-11-03 D1, D2, D4; Wayfinding Slice 2): the
 * chat target's fetched rows show under Material, named for it; a resource
 * row opens in the reader sheet and beside the Workshop; rows that arrive
 * while Material is hidden badge it, and a change of chat target does not.
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
import type { ContextSourceEntry } from '@shared/types';
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

const hostTurn: WorkshopTurn = {
  id: 'turn-1',
  role: 'assistant',
  kind: 'message',
  participant: 'host',
  artifact: 'persona_message',
  personaId: 'jill',
  personaLabel: 'Jill',
  content: 'Let the father stay quiet one line longer.',
  timestamp: 1,
  excerptVersion: 0
};

const resourceRow = (path: string, deliveredAt: number): ContextSourceEntry => ({
  kind: 'resource',
  origin: 'host',
  label: path,
  configuredResource: { group: 'characters', path },
  sizeChars: 240,
  isEstimate: true,
  deliveredAt
});

const session = (
  sources: ContextSourceEntry[],
  overrides: Partial<WorkshopSessionSnapshot> = {}
): WorkshopSessionStateMessage => ({
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
      turns: [hostTurn],
      turnRewindability: {},
      totalTurns: 1,
      truncatedTurns: 0,
      roomHasMemory: true,
      participants: {
        host: { personaId: 'jill', hasConversation: true },
        toolSidecars: [],
        personaGuests: [],
        chatTarget: { kind: 'host' }
      },
      conversationBehavior: { ...DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR },
      contextBudget: { label: 'Jill', sources },
      ...overrides
    },
    writerProfile: { ...DEFAULT_WORKSHOP_WRITER_PROFILE },
    webResearch: { enabled: false },
    persistence: { available: true, degradedConversationKeys: [] }
  },
  timestamp: 0
});

const withGuestTarget = (sources: ContextSourceEntry[]) => session(sources, {
  participants: {
    host: { personaId: 'jill', hasConversation: true },
    toolSidecars: [],
    personaGuests: [{
      personaId: 'cliff',
      personaLabel: 'Cliff',
      hasConversation: true,
      liveness: 'live',
      activeTarget: true
    }],
    chatTarget: { kind: 'personaGuest', personaId: 'cliff' }
  }
});

const deliver = (message: unknown) =>
  act(() => window.dispatchEvent(new MessageEvent('message', { data: message })));

const rail = () => screen.getByLabelText('Session rail');

const readInContent = (
  requestId: string,
  content: string,
  extra: object = {},
  path = 'characters/rabbit.md'
) => ({
  type: MessageType.WORKSHOP_READ_IN_RESOURCE_CONTENT,
  source: 'extension.workshop',
  payload: {
    requestId,
    group: 'characters',
    path,
    content,
    canOpenInEditor: true,
    ...extra
  },
  timestamp: 1
});

describe('WorkshopApp Read in', () => {
  let vscode: ReturnType<typeof createMockVSCode>;

  beforeEach(() => {
    jest.useFakeTimers();
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    Element.prototype.scrollIntoView = jest.fn();
  });

  const readInRequestIds = (): string[] => vscode.postMessage.mock.calls
    .map(([message]: [{ type: MessageType; payload: { requestId?: string } }]) => message)
    .filter((message) => message.type === MessageType.WORKSHOP_REQUEST_READ_IN_RESOURCE)
    .map((message) => message.payload.requestId!);

  const openRow = (path: string) => fireEvent.click(within(rail()).getByRole('button', {
    name: `Open ${path} in the reader`
  }));
  const openRabbit = () => openRow('characters/rabbit.md');
  const closeReader = () =>
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
  /** What the open reader shows: its rendered preview and its source text. */
  const shown = () => {
    const sheet = screen.getByRole('dialog');
    return {
      preview: within(sheet).queryAllByText(/./, { selector: '.pm-ws-text-sheet-preview p' })
        .map((node) => node.textContent),
      source: (sheet.querySelector('textarea') as HTMLTextAreaElement).value
    };
  };

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('lists what the chat target read, named for it, and opens a file in the reader', () => {
    render(<WorkshopApp />);
    deliver(session([resourceRow('characters/rabbit.md', 1_000)]));

    const readIn = within(rail()).getByRole('region', { name: 'Read in by Jill' });
    fireEvent.click(within(readIn).getByRole('button', { name: 'Open characters/rabbit.md in the reader' }));
    expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.WORKSHOP_REQUEST_READ_IN_RESOURCE,
      payload: expect.objectContaining({ group: 'characters', path: 'characters/rabbit.md' })
    }));
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByText('Read in by Jill')).toBeTruthy();
    expect(within(sheet).getByRole('status').textContent).toContain('Loading the file…');

    deliver(readInContent(readInRequestIds()[0], '# The Rabbit\n\nHe checks his watch.', { truncated: true }));
    expect(within(sheet).getByRole('heading', { name: 'The Rabbit' })).toBeTruthy();
    expect(within(sheet).getByRole('note').textContent).toContain('Showing the start of the file only');

    fireEvent.click(within(sheet).getByRole('button', { name: /open beside/i }));
    expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.WORKSHOP_OPEN_READ_IN_RESOURCE,
      payload: { group: 'characters', path: 'characters/rabbit.md' }
    }));
  });

  it('follows the chat target: its rows, its name, and no badge for switching', () => {
    render(<WorkshopApp />);
    deliver(session([resourceRow('characters/rabbit.md', 1_000)]));
    fireEvent.click(screen.getByRole('tab', { name: /^Notes/ }));

    deliver(withGuestTarget([resourceRow('characters/hatter.md', 2_000)]));
    expect(screen.getByRole('tab', { name: /^Material/ }).getAttribute('aria-label')).not.toMatch(/new/);

    fireEvent.click(screen.getByRole('tab', { name: /^Material/ }));
    const readIn = within(rail()).getByRole('region', { name: 'Read in by Cliff' });
    expect(within(readIn).getByText('characters/hatter.md')).toBeTruthy();
    expect(within(readIn).queryByText('characters/rabbit.md')).toBeNull();
  });

  it('badges Material for a row read while Notes is showing', () => {
    render(<WorkshopApp />);
    deliver(session([resourceRow('characters/rabbit.md', 1_000)]));
    fireEvent.click(screen.getByRole('tab', { name: /^Notes/ }));

    deliver(session([resourceRow('characters/rabbit.md', 1_000), resourceRow('characters/duchess.md', 2_000)]));
    expect(screen.getByRole('tab', { name: /^Material, \d+ items?, 1 new$/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /^Notes/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('says so when the chat target has read nothing', () => {
    render(<WorkshopApp />);
    deliver(session([]));
    expect(within(rail()).getByText('When Jill reads a file or runs a tool, it shows here.')).toBeTruthy();
  });

  it.each([
    ['the earlier reply lands first', true],
    ['the current reply lands first', false]
  ])('Close, then reopen the same file: the reader shows the current answer when %s (PR #186 F-01)', (_case, earlierFirst) => {
    render(<WorkshopApp />);
    deliver(session([resourceRow('characters/rabbit.md', 1_000)]));

    openRabbit();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    openRabbit();
    const [earlier, current] = readInRequestIds();
    expect(current).not.toBe(earlier);

    const stale = readInContent(earlier, 'The file before the writer saved.');
    const fresh = readInContent(current, 'The file now.');
    for (const reply of earlierFirst ? [stale, fresh] : [fresh, stale]) {
      deliver(reply);
    }

    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByText('The file now.', { selector: 'p' })).toBeTruthy();
    expect(within(sheet).queryAllByText('The file before the writer saved.')).toEqual([]);
    const source = sheet.querySelector('textarea') as HTMLTextAreaElement;
    expect(source.value).toBe('The file now.');
  });

  it.each([
    ['in request order', [0, 1, 2]],
    ['in reverse', [2, 1, 0]],
    ['first A last', [1, 2, 0]]
  ])('A → B → A: the reader shows only the last opening\'s answer when earlier replies land %s (PR #186 F-01)', (_case, order) => {
    render(<WorkshopApp />);
    deliver(session([resourceRow('characters/rabbit.md', 1_000), resourceRow('characters/hatter.md', 2_000)]));

    const paths = ['characters/rabbit.md', 'characters/hatter.md', 'characters/rabbit.md'];
    for (const path of paths) {
      openRow(path);
      closeReader();
    }
    openRabbit();
    const ids = readInRequestIds();
    expect(new Set(ids).size).toBe(4);

    for (const index of order) {
      deliver(readInContent(ids[index], `An earlier answer, ${index}.`, {}, paths[index]));
    }
    expect(within(screen.getByRole('dialog')).getByRole('status').textContent).toContain('Loading the file…');

    deliver(readInContent(ids[3], 'The last opening.'));
    expect(shown()).toEqual({ preview: ['The last opening.'], source: 'The last opening.' });

    // The current answer is final: a straggler after it changes nothing.
    deliver(readInContent(ids[0], 'A straggler.'));
    expect(shown().source).toBe('The last opening.');
  });

  it('closes the reader when the room is replaced, and ignores its late answer', () => {
    render(<WorkshopApp />);
    deliver(session([resourceRow('characters/rabbit.md', 1_000)]));
    openRabbit();
    const [pending] = readInRequestIds();

    deliver(session([resourceRow('characters/rabbit.md', 1_000)], { roomRevision: 2 }));
    expect(screen.queryByRole('dialog')).toBeNull();

    deliver(readInContent(pending, 'An answer for the old room.'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('An answer for the old room.')).toBeNull();

    openRabbit();
    expect(within(screen.getByRole('dialog')).getByRole('status').textContent).toContain('Loading the file…');
    deliver(readInContent(readInRequestIds()[1], 'The new room\'s read.'));
    expect(shown().source).toBe('The new room\'s read.');
  });

  it('closes the reader when the chat target changes, and ignores its late answer', () => {
    render(<WorkshopApp />);
    deliver(session([resourceRow('characters/rabbit.md', 1_000)]));
    openRabbit();
    const [pending] = readInRequestIds();

    deliver(withGuestTarget([resourceRow('characters/rabbit.md', 3_000)]));
    expect(screen.queryByRole('dialog')).toBeNull();

    deliver(readInContent(pending, 'An answer Jill asked for.'));
    expect(screen.queryByText('An answer Jill asked for.')).toBeNull();

    openRabbit();
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByText('Read in by Cliff')).toBeTruthy();
    deliver(readInContent(readInRequestIds()[1], 'Cliff\'s read.'));
    expect(shown().source).toBe('Cliff\'s read.');
  });

  describe('replacing an open reader in place (PR #186 F-02)', () => {
    // The backdrop blocks the pointer and the sheet now keeps Tab inside, so
    // this activates the row behind the sheet directly, as a script could.
    const twoRows = () => session([
      resourceRow('characters/rabbit.md', 1_000),
      resourceRow('characters/hatter.md', 2_000)
    ]);
    const title = () => within(screen.getByRole('dialog')).getByRole('heading', { level: 2 }).textContent;

    it('shows B\'s heading and body after A had loaded', () => {
      render(<WorkshopApp />);
      deliver(twoRows());
      openRow('characters/rabbit.md');
      deliver(readInContent(readInRequestIds()[0], 'The Rabbit\'s file.'));
      expect(shown().source).toBe('The Rabbit\'s file.');

      openRow('characters/hatter.md');
      deliver(readInContent(readInRequestIds()[1], 'The Hatter\'s file.', {}, 'characters/hatter.md'));

      expect(title()).toBe('characters/hatter.md');
      expect(shown()).toEqual({ preview: ['The Hatter\'s file.'], source: 'The Hatter\'s file.' });
    });

    it.each([
      ['B answers first, then A late', true],
      ['A answers late first, then B', false]
    ])('shows only B when %s', (_case, bFirst) => {
      render(<WorkshopApp />);
      deliver(twoRows());
      openRow('characters/rabbit.md');
      openRow('characters/hatter.md');
      const [a, b] = readInRequestIds();
      const replyA = readInContent(a, 'The Rabbit\'s file.');
      const replyB = readInContent(b, 'The Hatter\'s file.', {}, 'characters/hatter.md');
      for (const reply of bFirst ? [replyB, replyA] : [replyA, replyB]) {
        deliver(reply);
      }

      expect(title()).toBe('characters/hatter.md');
      expect(shown()).toEqual({ preview: ['The Hatter\'s file.'], source: 'The Hatter\'s file.' });
    });

    it('starts B on the loading line, not on A\'s text', () => {
      render(<WorkshopApp />);
      deliver(twoRows());
      openRow('characters/rabbit.md');
      deliver(readInContent(readInRequestIds()[0], 'The Rabbit\'s file.'));
      openRow('characters/hatter.md');

      const sheet = screen.getByRole('dialog');
      expect(within(sheet).getByRole('status').textContent).toContain('Loading the file…');
      expect(within(sheet).queryAllByText('The Rabbit\'s file.')).toEqual([]);
    });
  });

  describe('everything behind an open sheet is inert (PR #186 N-03)', () => {
    // jsdom doesn't enforce `inert`, so these assert the attribute; native
    // traversal is Slice 8's live check.
    const behind = () => {
      const header = document.querySelector('.pm-ws-header')!;
      return {
        header: header.hasAttribute('inert'),
        headerActions: header.querySelector('.pm-ws-header-actions')!.closest('[inert]') !== null,
        banners: document.querySelector('.pm-ws-banners')!.hasAttribute('inert'),
        rail: rail().closest('[inert]') !== null,
        main: screen.getByLabelText('Session thread').closest('[inert]') !== null
      };
    };
    const allInert = { header: true, headerActions: true, banners: true, rail: true, main: true };
    const noneInert = { header: false, headerActions: false, banners: false, rail: false, main: false };

    it('while the reader is open, and not after it closes', () => {
      render(<WorkshopApp />);
      deliver(session([resourceRow('characters/rabbit.md', 1_000)]));
      expect(behind()).toEqual(noneInert);

      openRabbit();
      expect(behind()).toEqual(allInert);
      expect(screen.getByRole('dialog').closest('[inert]')).toBeNull();

      closeReader();
      expect(behind()).toEqual(noneInert);
    });

    it('for an authoring sheet too, consistently', () => {
      render(<WorkshopApp />);
      deliver(session([]));
      fireEvent.click(within(rail()).getByRole('button', { name: /Add text/ }));
      expect(screen.getByRole('dialog').closest('[inert]')).toBeNull();
      expect(behind()).toEqual(allInert);

      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
      expect(behind()).toEqual(noneInert);
    });
  });
});
