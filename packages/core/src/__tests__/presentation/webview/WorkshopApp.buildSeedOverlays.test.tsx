/** @jest-environment jsdom */

/**
 * A Build lens seed handed over from the Lightbox never covers a Workshop
 * sheet, editor or browser the writer has open (PR #150 F-02). The production
 * Workshop app, its overlays and its seed controller; the host is a mock
 * VS Code API. The seed is refused with an answer the host passes to the
 * Lightbox, the open overlay and its draft are untouched, and one Escape
 * closes only the surface on top. Text is from "Alice's Adventures in
 * Wonderland" (1865, public domain).
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  MessageType,
  WorkshopLexicalGravityBuildSeedPayload,
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
// eslint-disable-next-line @typescript-eslint/naming-convention -- the mocked component's export name.
jest.mock('../../../presentation/webview/components/shared/PmLogo', () => ({ PmLogo: () => null }));

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { WorkshopApp } from '@/presentation/webview/WorkshopApp';

const DRAFT = 'Down, down, down. Would the fall never come to an end!';
const LEXICAL_GRAVITY_TITLE = /Lexical Gravity/;

const readySession = (): WorkshopSessionStateMessage => ({
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

const seedPayload = (seedId: string): WorkshopLexicalGravityBuildSeedPayload => ({
  seedId,
  seed: {
    origin: 'lightbox',
    field: 'Telescope',
    metaphor: 'The body as an instrument that folds and unfolds.',
    terms: [{ term: 'telescope', count: 2 }, { term: 'shutting', count: 2 }],
    sourceLabel: 'Drafts/alice-chapter-1.md'
  },
  subject: 'Telescope: telescope, shutting'
});

describe('WorkshopApp: a handed-over Build lens seed and the Workshop\'s open overlays', () => {
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
  });

  const post = (data: unknown) => act(() => {
    window.dispatchEvent(new MessageEvent('message', { data }));
  });
  const deliverSeed = (seedId: string) => post({
    type: MessageType.WORKSHOP_LEXICAL_GRAVITY_BUILD_SEED,
    source: 'extension.workshop.lexical-gravity',
    timestamp: 2,
    payload: seedPayload(seedId)
  });
  const answers = () => (vscode.postMessage as jest.Mock).mock.calls
    .map(([message]) => message as { type: string; payload: unknown })
    .filter((message) => message.type === MessageType.WORKSHOP_LEXICAL_GRAVITY_BUILD_SEED_ANSWER)
    .map((message) => message.payload);
  const lexicalGravitySheet = () => screen.queryByRole('dialog', { name: LEXICAL_GRAVITY_TITLE });
  const pressEscape = () => act(() => {
    fireEvent.keyDown(window, { key: 'Escape' });
  });
  const openWorkshop = () => {
    render(<WorkshopApp />);
    post(readySession());
  };
  const openAddText = () => {
    fireEvent.click(screen.getAllByRole('button', { name: /Add text/ })[0]);
    const sheet = screen.getByRole('dialog', { name: /text/i });
    const textarea = within(sheet).getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: DRAFT } });
    expect(textarea.value).toBe(DRAFT);
    return { sheet, textarea };
  };

  it('opens the seed when nothing is open, and answers that it opened', () => {
    openWorkshop();
    deliverSeed('lexical-build-seed-1');
    expect(lexicalGravitySheet()).not.toBeNull();
    expect(answers()).toEqual([{ seedId: 'lexical-build-seed-1', opened: true }]);
  });

  it('refuses a seed over Add text with typed content, and keeps the draft; one Escape then closes only Add text', () => {
    openWorkshop();
    const { sheet, textarea } = openAddText();

    deliverSeed('lexical-build-seed-1');
    expect(lexicalGravitySheet()).toBeNull();
    expect(screen.getAllByRole('dialog')).toEqual([sheet]);
    expect(textarea.value).toBe(DRAFT);
    expect(answers()).toEqual([{ seedId: 'lexical-build-seed-1', opened: false, reason: 'busy' }]);

    pressEscape();
    expect(screen.queryAllByRole('dialog')).toEqual([]);
    // Nothing waits behind it: a refused seed is gone, not deferred.
    expect(lexicalGravitySheet()).toBeNull();
    expect(answers()).toHaveLength(1);
  });

  it.each<[string, () => void, RegExp]>([
    ['the widgets browser', () => fireEvent.click(screen.getByRole('button', { name: 'Widgets' })), /^Widgets$/],
    ['the context editor', () => fireEvent.click(screen.getAllByRole('button', { name: /Add from project/ })[0]), /Choose from project/],
    ['the save-session editor', () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
      fireEvent.click(screen.getByText('Save session…').closest('button') as HTMLButtonElement);
    }, /^Save session$/],
    ['the session browser', () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
      fireEvent.click(screen.getByText('Browse all sessions…').closest('button') as HTMLButtonElement);
    }, /Open a prior session/],
    ['the tools browser', () => fireEvent.click(screen.getByRole('button', { name: 'Tools' })), /tools/i]
  ])('refuses a seed while %s is open, and leaves it open', (_label, open, title) => {
    openWorkshop();
    open();
    const overlay = screen.getByRole('dialog', { name: title });

    deliverSeed('lexical-build-seed-1');
    expect(lexicalGravitySheet()).toBeNull();
    expect(screen.getAllByRole('dialog')).toEqual([overlay]);
    expect(answers()).toEqual([{ seedId: 'lexical-build-seed-1', opened: false, reason: 'busy' }]);
  });

  it('opens a later seed once the writer has closed the overlay', () => {
    openWorkshop();
    openAddText();
    deliverSeed('lexical-build-seed-1');
    pressEscape();

    deliverSeed('lexical-build-seed-2');
    expect(lexicalGravitySheet()).not.toBeNull();
    expect(answers()).toEqual([
      { seedId: 'lexical-build-seed-1', opened: false, reason: 'busy' },
      { seedId: 'lexical-build-seed-2', opened: true }
    ]);
  });
});
