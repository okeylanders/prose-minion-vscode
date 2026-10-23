/** @jest-environment jsdom */

/**
 * Not part of the test suite: renders the Workshop's sessions menu and
 * session browser in fifteen states (jsdom, the components alone) and writes
 * each state's markup, with what has focus, to $WORKSHOP_PARITY_OUT, so the
 * same file run at the base and at the head shows the markup is identical
 * (Lightbox Slice 5A.2's extraction of the shared saved-item menu and
 * browser). Copy it to packages/core/src/__tests__/ in each tree, run it
 * with `WORKSHOP_PARITY_OUT=<base|head>.json npx jest <the copy>`, delete
 * the copy, then `node workshop-markup-compare.js <dir>` with both files in
 * <dir>. See ../README.md.
 */

import * as fs from 'fs';
import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { WorkshopSessionsMenu } from '@components/workshop/WorkshopSessionsMenu';
import { WorkshopSessionBrowserModal } from '@components/workshop/WorkshopSessionBrowserModal';
import { WorkshopSessionSummary } from '@messages';
import { __resetOverlayFocusStateForTests } from '@hooks/useOverlayDismiss';

const NOW = Date.parse('2026-10-23T15:00:00.000Z');
const out: Record<string, string> = {};

const summary = (overrides: Partial<WorkshopSessionSummary>): WorkshopSessionSummary => ({
  sessionId: 'current-id',
  title: 'A room',
  fileName: 'current.json',
  kind: 'current',
  startedAt: NOW - 3_600_000,
  updatedAt: NOW,
  timezone: 'UTC',
  hostPersonaId: 'jill',
  participantPersonaIds: ['jill'],
  turnCount: 14,
  excerptWordCount: 2015,
  excerptLabel: 'Drafts/chapter-5.md',
  excerptIdentity: 'chapters:Drafts/chapter-5.md',
  preview: 'A preview line.',
  ...overrides
});

const SESSIONS = [
  summary({ sessionId: 'n1', title: 'First named', kind: 'named', fileName: 'n1.json', updatedAt: NOW - 3_000_000, hostPersonaId: 'margot', excerptLabel: 'Drafts/chapter-6.md', excerptIdentity: 'chapters:Drafts/chapter-6.md' }),
  summary({ sessionId: 'n2', title: 'Second named', kind: 'named', fileName: 'n2.json', updatedAt: NOW - 3 * 86_400_000, scope: 'open', preview: undefined }),
  summary({ sessionId: 'n3', title: 'Third named', kind: 'named', fileName: 'n3.json', updatedAt: NOW - 30 * 86_400_000, scope: null, excerptLabel: undefined, excerptIdentity: undefined }),
  summary({ sessionId: 'n4', title: 'Fourth named', kind: 'named', fileName: 'n4.json', updatedAt: NaN, scope: 'excerpt', hostPersonaId: 'dev' })
];

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  __resetOverlayFocusStateForTests();
});
afterEach(() => {
  jest.useRealTimers();
});
afterAll(() => {
  fs.writeFileSync(process.env.WORKSHOP_PARITY_OUT as string, JSON.stringify(out, null, 2));
});

const menuProps = (overrides: Partial<React.ComponentProps<typeof WorkshopSessionsMenu>> = {}): React.ComponentProps<typeof WorkshopSessionsMenu> => ({
  open: true,
  sessions: SESSIONS,
  disabled: false,
  newSessionDisabled: false,
  onOpenChange: jest.fn(),
  onNewSession: jest.fn(),
  onFullResetSession: jest.fn(),
  hasWorkingSet: true,
  onSaveSession: jest.fn(),
  exportDisabled: false,
  onExportSession: jest.fn(),
  onBrowseSessions: jest.fn(),
  onOpenSession: jest.fn(),
  ...overrides
});

const browserProps = (overrides: Partial<React.ComponentProps<typeof WorkshopSessionBrowserModal>> = {}): React.ComponentProps<typeof WorkshopSessionBrowserModal> => ({
  open: true,
  available: true,
  current: summary({ degradedConversationKeys: ['jill'] }),
  activeSessionId: 'n1',
  sessions: SESSIONS,
  truncated: false,
  searchTruncated: false,
  pending: false,
  query: '',
  mutationsDisabled: false,
  onClose: jest.fn(),
  onQueryChange: jest.fn(),
  onRefresh: jest.fn(),
  onNewSession: jest.fn(),
  onOpen: jest.fn(),
  onRename: jest.fn(),
  onDuplicate: jest.fn(),
  onReveal: jest.fn(),
  onDelete: jest.fn(),
  ...overrides
});

const capture = (name: string, container: HTMLElement) => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  out[name] = `${container.innerHTML}\n<!-- focus: ${document.activeElement?.outerHTML.slice(0, 120) ?? 'none'} -->`;
};

describe('Workshop markup parity', () => {
  it.each([
    ['menu-open', {}],
    ['menu-closed', { open: false }],
    ['menu-saving', { activeSessionTitle: 'An active room', saveStatus: 'saving' as const }],
    ['menu-error', { saveStatus: 'error' as const, disabled: true, newSessionDisabled: true, exportDisabled: true, hasWorkingSet: false }],
    ['menu-empty', { sessions: [] }]
  ])('menu %s', (name, overrides) => {
    const { container } = render(<WorkshopSessionsMenu {...menuProps(overrides)} />);
    capture(name, container);
  });

  it.each([
    ['browser', {}],
    ['browser-unavailable', { available: false, unavailableReason: 'multi-root' as const, current: undefined }],
    ['browser-status', { pending: true, error: 'disk full', truncated: true, searchTruncated: true }],
    ['browser-busy', { mutationsDisabled: true, actionPending: 'open' as const }],
    ['browser-empty', { sessions: [] }]
  ])('browser %s', (name, overrides) => {
    render(<WorkshopSessionBrowserModal {...browserProps(overrides)} />);
    capture(name, document.body);
  });

  it('browser interactions', () => {
    render(<WorkshopSessionBrowserModal {...browserProps()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Excerpt' }));
    capture('browser-excerpt', document.body);
    fireEvent.click(screen.getByRole('button', { name: 'Rename First named' }));
    capture('browser-renaming', document.body);
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Rename session' }), { key: 'Escape' });
    capture('browser-rename-cancelled', document.body);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Second named' }));
    capture('browser-confirming', document.body);
    fireEvent.click(screen.getByRole('button', { name: 'Keep Second named' }));
    capture('browser-kept', document.body);
  });
});
