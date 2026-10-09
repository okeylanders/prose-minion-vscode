/** @jest-environment jsdom */

/**
 * Full-WorkshopApp witnesses for Show vs. Tell's commit, chip, reopen, and
 * clone-and-recommit (Sprint 05, Slice 4). The room comes from real
 * WorkshopSessionService snapshots; the host's replies are the same envelopes
 * the extension posts.
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import {
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  MessageType,
  type WorkshopShowVsTellDraft
} from '@messages';
import { workshopWidgetArtifactKind } from '@shared/constants/workshopWidgets';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import {
  fixtureVariantId,
  generatedShowVsTellDraft
} from '@/__tests__/application/services/workshop/widgets/showVsTell/showVsTellFixtures';

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
// eslint-disable-next-line @typescript-eslint/naming-convention -- mirrors the real export name
jest.mock('../../../presentation/webview/components/shared/PmLogo', () => ({ PmLogo: () => null }));

import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { WorkshopApp } from '@/presentation/webview/WorkshopApp';

const deliver = (data: unknown): void => {
  act(() => { window.dispatchEvent(new MessageEvent('message', { data })); });
};

const room = (service: WorkshopSessionService) => ({
  type: MessageType.WORKSHOP_SESSION_STATE,
  source: 'extension.workshop',
  timestamp: 0,
  payload: {
    session: service.getSnapshot(),
    writerProfile: { ...DEFAULT_WORKSHOP_WRITER_PROFILE },
    webResearch: { enabled: false },
    persistence: { available: true, degradedConversationKeys: [] }
  }
});

/** A room that already holds one committed Show vs. Tell turn and its chip. */
const roomWithCommittedTurn = (draft: WorkshopShowVsTellDraft) => {
  let clock = 0;
  const service = new WorkshopSessionService(() => ++clock);
  service.setSessionScope('open');
  const config = service.createWidgetConfig({ widgetId: 'show-vs-tell', draft });
  const artifactId = service.mintWidgetArtifactId();
  const turn = service.beginPersonaMessage('req-svt', 'Ran the beat through the playground.', undefined, {
    widgetId: 'show-vs-tell',
    widgetConfigId: config.id,
    rail: 'thread-artifact',
    artifactId,
    selectionCount: draft.kept.length
  });
  service.recordRoomThreadArtifacts(turn.id, [{
    id: artifactId,
    kind: workshopWidgetArtifactKind('show-vs-tell'),
    name: 'Show vs. Tell Playground',
    content: 'beat: "x"'
  }]);
  service.recordWidgetCommit(config.id, { turnId: turn.id, artifactId });
  service.completeRun('req-svt', 'Accepted.');
  return { service, configId: config.id };
};

describe('Show vs. Tell commit, chip, and clone-and-recommit', () => {
  let vscode: ReturnType<typeof createMockVSCode>;

  beforeEach(() => {
    jest.useFakeTimers();
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const sent = (type: MessageType) =>
    vscode.postMessage.mock.calls.map(([message]) => message).filter((message) => message.type === type);
  const sheet = (): HTMLElement | null => screen.queryByRole('dialog', { name: 'Show vs. Tell Playground' });

  const commitResult = (requestToken: string, extra: Record<string, unknown>) => deliver({
    type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
    source: 'extension.workshop.widget',
    timestamp: 9,
    payload: { action: 'commit', requestToken, widgetId: 'show-vs-tell', ...extra }
  });

  const openFresh = (service: WorkshopSessionService): void => {
    render(<WorkshopApp />);
    deliver(room(service));
    fireEvent.click(screen.getByRole('button', { name: 'Widgets' }));
    fireEvent.click(screen.getAllByRole('button', { name: /Show vs\. Tell Playground/ })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Open widget' }));
  };

  it('authors, commits the exact draft, locks while pending, and closes on acceptance', () => {
    const service = new WorkshopSessionService(() => 1);
    service.setSessionScope('open');
    openFresh(service);
    fireEvent.change(screen.getByRole('textbox', { name: /Selected beat/ }), {
      target: { value: 'She hadn’t trusted him since the funeral.' }
    });
    fireEvent.change(screen.getByRole('textbox', { name: /Must survive every variation/ }), {
      target: { value: 'The distrust is old.' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Generate the workup/ }));
    const workup = generatedShowVsTellDraft().workup!;
    deliver({
      type: MessageType.WORKSHOP_SHOW_VS_TELL_RESULT,
      source: 'extension.workshop',
      timestamp: 5,
      payload: {
        widgetId: 'show-vs-tell',
        token: sent(MessageType.WORKSHOP_SHOW_VS_TELL_GENERATE).at(-1)!.payload.token,
        workupId: workup.workupId,
        ok: true,
        workup
      }
    });
    const commit = screen.getByRole('button', { name: 'Commit to thread' }) as HTMLButtonElement;
    expect(commit.disabled).toBe(true);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Keep variant 3' }));
    expect(commit.disabled).toBe(false);
    fireEvent.click(commit);

    const [posted] = sent(MessageType.WORKSHOP_COMMIT_WIDGET);
    expect(posted.payload).toEqual({
      widgetId: 'show-vs-tell',
      requestToken: expect.any(String),
      draft: expect.objectContaining({
        kept: [{ variantId: fixtureVariantId(3), carryMode: 'direction' }],
        workup,
        position: 'hinge'
      })
    });
    expect(posted.payload.clonedFromConfigId).toBeUndefined();
    expect(sent(MessageType.WORKSHOP_COMMIT_WIDGET)).toHaveLength(1);
    expect((screen.getByRole('button', { name: 'Committing…' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true);

    commitResult(posted.payload.requestToken, { ok: true, widgetConfigId: 'wc-1', turnId: 'turn-1' });

    expect(sheet()).toBeNull();
  });

  it('keeps the draft open and shows the host refusal when the commit is rejected', () => {
    const { service } = roomWithCommittedTurn(generatedShowVsTellDraft());
    render(<WorkshopApp />);
    deliver(room(service));
    fireEvent.click(screen.getByRole('button', { name: /Show vs\. Tell/ }));
    const config = { ...service.getWidgetConfig('wc-1')! };
    deliver({
      type: MessageType.WORKSHOP_WIDGET_CONFIG_DATA,
      source: 'extension.workshop.widget',
      timestamp: 3,
      payload: { configId: 'wc-1', config }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Commit as new turn' }));
    const token = sent(MessageType.WORKSHOP_COMMIT_WIDGET).at(-1)!.payload.requestToken;

    commitResult(token, {
      ok: false,
      message: 'The commit payload is over its 600-character ceiling — switch variants to direction only, keep fewer, or shorten the note.'
    });

    expect(sheet()).not.toBeNull();
    expect(screen.getByRole('alert').textContent).toMatch(/600-character ceiling/);
    expect((screen.getByRole('button', { name: 'Commit as new turn' }) as HTMLButtonElement).disabled)
      .toBe(false);
    expect(screen.getByDisplayValue('the tell can stay if the fulcrum is shown')).not.toBeNull();
  });

  it('shows the chip from the config summary, reopens the exact draft with the clone banner, and recommits as a new turn', () => {
    const committed = generatedShowVsTellDraft();
    const { service, configId } = roomWithCommittedTurn(committed);
    render(<WorkshopApp />);
    deliver(room(service));

    const chip = screen.getByRole('button', { name: /Show vs\. Tell/ });
    expect(chip.textContent?.trim()).toBe('Show vs. Tell 2 kept · 1 as direction · re-open');

    fireEvent.click(chip);
    expect(sent(MessageType.WORKSHOP_REQUEST_WIDGET_CONFIG).at(-1)!.payload).toEqual({ configId });
    deliver({
      type: MessageType.WORKSHOP_WIDGET_CONFIG_DATA,
      source: 'extension.workshop.widget',
      timestamp: 3,
      payload: { configId, config: service.getWidgetConfig(configId) }
    });

    const dialog = sheet()!;
    expect(dialog).not.toBeNull();
    expect(dialog.textContent).toContain(
      'Re-opened from a committed turn. The old chip stays as history — committing again creates a new turn at the head.'
    );
    // Exactly what was committed, not a fresh draft at the defaults.
    expect((within(dialog).getByRole('textbox', { name: /Selected beat/ }) as HTMLInputElement).value)
      .toBe(committed.beat.text);
    expect(within(dialog).getByRole('checkbox', { name: 'Keep variant 3' }).getAttribute('aria-checked'))
      .toBe('true');
    expect(within(dialog).getByRole('checkbox', { name: 'Keep variant 7' }).getAttribute('aria-checked'))
      .toBe('true');
    expect(within(dialog).getByRole('checkbox', { name: 'Keep variant 1' }).getAttribute('aria-checked'))
      .toBe('false');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Commit as new turn' }));

    const [recommit] = sent(MessageType.WORKSHOP_COMMIT_WIDGET);
    expect(recommit.payload).toEqual({
      widgetId: 'show-vs-tell',
      requestToken: expect.any(String),
      draft: committed,
      clonedFromConfigId: configId
    });
    commitResult(recommit.payload.requestToken, { ok: true, widgetConfigId: 'wc-2', turnId: 'turn-9' });
    expect(sheet()).toBeNull();
  });

  it('shows the rewound-message banner when the host restores a released config', () => {
    const { service, configId } = roomWithCommittedTurn(generatedShowVsTellDraft());
    render(<WorkshopApp />);
    deliver(room(service));

    deliver({
      type: MessageType.WORKSHOP_WIDGET_CONFIG_RESTORED,
      source: 'extension.workshop.widget',
      timestamp: 4,
      payload: { widgetConfigId: configId }
    });
    deliver({
      type: MessageType.WORKSHOP_WIDGET_CONFIG_DATA,
      source: 'extension.workshop.widget',
      timestamp: 5,
      payload: {
        configId,
        config: { ...service.getWidgetConfig(configId)!, committedTurnId: undefined, artifactId: undefined }
      }
    });

    expect(sheet()!.textContent).toContain('Reopened from a message you rewound.');
    expect(screen.getByRole('button', { name: 'Commit as new turn' })).not.toBeNull();
  });
});
