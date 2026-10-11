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

  describe('a pending commit owns the draft', () => {
    /** Reopen the committed Hinge draft from its chip and press Commit as new turn. */
    const reopenAndCommit = () => {
      const committed = generatedShowVsTellDraft();
      const { service, configId } = roomWithCommittedTurn(committed);
      render(<WorkshopApp />);
      deliver(room(service));
      fireEvent.click(screen.getByRole('button', { name: /Show vs\. Tell/ }));
      deliver({
        type: MessageType.WORKSHOP_WIDGET_CONFIG_DATA,
        source: 'extension.workshop.widget',
        timestamp: 3,
        payload: { configId, config: service.getWidgetConfig(configId) }
      });
      return { committed, configId };
    };
    const lastCommit = () => sent(MessageType.WORKSHOP_COMMIT_WIDGET).at(-1)!.payload;
    const radio = (name: RegExp) => screen.getByRole('radio', { name }) as HTMLButtonElement;

    it('locks the continuum against pointer and keyboard input, and the submitted position wins', () => {
      reopenAndCommit();
      fireEvent.click(screen.getByRole('button', { name: 'Commit as new turn' }));
      const submitted = lastCommit();
      expect(submitted.draft.position).toBe('hinge');

      const stateIt = radio(/State it/);
      const hinge = radio(/Hinge/);
      expect(stateIt.disabled).toBe(true);
      fireEvent.click(stateIt);
      fireEvent.keyDown(hinge, { key: 'ArrowLeft' });
      fireEvent.keyDown(hinge, { key: 'Home' });
      fireEvent.keyDown(hinge, { key: 'End' });

      expect(hinge.getAttribute('aria-checked')).toBe('true');
      expect(stateIt.getAttribute('aria-checked')).toBe('false');
      // Every step is disabled, so none can take focus or a key.
      expect(screen.getAllByRole('radio', { name: /State it|Summarize|Hinge|Evidence|Inhabit/ })
        .every((step) => (step as HTMLButtonElement).disabled)).toBe(true);
      expect(sent(MessageType.WORKSHOP_COMMIT_WIDGET)).toHaveLength(1);

      commitResult(submitted.requestToken, { ok: true, widgetConfigId: 'wc-2', turnId: 'turn-2' });
      expect(sheet()).toBeNull();
    });

    it('drops a selection reply that lands during a pending commit, and a refusal keeps the exact draft to retry', () => {
      const { committed } = reopenAndCommit();
      const dialog = sheet()!;
      // The editor has no selection, so the host is still waiting on the clipboard.
      fireEvent.click(within(dialog).getByRole('button', { name: 'Use editor selection' }));
      expect(sent(MessageType.REQUEST_SELECTION).at(-1)!.payload).toEqual({ target: 'workshop_show_vs_tell_beat' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Commit as new turn' }));
      const first = lastCommit();

      deliver({
        type: MessageType.SELECTION_DATA,
        source: 'extension.ui',
        timestamp: 7,
        payload: { target: 'workshop_show_vs_tell_beat', content: 'A different beat from the clipboard.' }
      });

      expect((within(dialog).getByRole('textbox', { name: /Selected beat/ }) as HTMLInputElement).value)
        .toBe(committed.beat.text);
      expect(screen.queryByRole('region', { name: 'Generated workup' })).not.toBeNull();

      commitResult(first.requestToken, { ok: false, message: 'The room did not accept the commit.' });

      // Nothing was rewritten, so Commit is still available and retries the exact submitted draft.
      expect(screen.getByRole('alert').textContent).toBe('The room did not accept the commit.');
      const retry = screen.getByRole('button', { name: 'Commit as new turn' }) as HTMLButtonElement;
      expect(retry.disabled).toBe(false);
      fireEvent.click(retry);
      const second = lastCommit();
      expect(second.requestToken).not.toBe(first.requestToken);
      expect(second.draft).toEqual(first.draft);
      expect(second.draft).toEqual(committed);
      expect(second.clonedFromConfigId).toBe('wc-1');
    });

    it('lets the writer edit again after a refusal and retries with the edit', () => {
      reopenAndCommit();
      fireEvent.click(screen.getByRole('button', { name: 'Commit as new turn' }));
      commitResult(lastCommit().requestToken, { ok: false, message: 'Try again.' });

      fireEvent.click(radio(/State it/));
      fireEvent.click(screen.getByRole('button', { name: 'Commit as new turn' }));

      expect(radio(/State it/).getAttribute('aria-checked')).toBe('true');
      expect(lastCommit().draft.position).toBe('state-it');
    });
  });

  describe('the position exception outside a pending commit', () => {
    const startGeneration = () => {
      const service = new WorkshopSessionService(() => 1);
      service.setSessionScope('open');
      render(<WorkshopApp />);
      deliver(room(service));
      fireEvent.click(screen.getByRole('button', { name: 'Widgets' }));
      fireEvent.click(screen.getAllByRole('button', { name: /Show vs\. Tell Playground/ })[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Open widget' }));
      fireEvent.change(screen.getByRole('textbox', { name: /Selected beat/ }), {
        target: { value: 'She hadn’t trusted him since the funeral.' }
      });
      fireEvent.change(screen.getByRole('textbox', { name: /Must survive every variation/ }), {
        target: { value: 'The distrust is old.' }
      });
      fireEvent.click(screen.getByRole('button', { name: /Generate the workup/ }));
      return sent(MessageType.WORKSHOP_SHOW_VS_TELL_GENERATE).at(-1)!.payload.token as string;
    };

    it('still moves the position during generation without discarding the workup that arrives', () => {
      const token = startGeneration();
      const workup = generatedShowVsTellDraft().workup!;
      const evidence = screen.getByRole('radio', { name: /Evidence/ }) as HTMLButtonElement;
      expect(evidence.disabled).toBe(false);

      fireEvent.click(evidence);
      expect(evidence.getAttribute('aria-checked')).toBe('true');
      deliver({
        type: MessageType.WORKSHOP_SHOW_VS_TELL_RESULT,
        source: 'extension.workshop',
        timestamp: 5,
        payload: { widgetId: 'show-vs-tell', token, workupId: workup.workupId, ok: true, workup }
      });

      expect(screen.queryByRole('region', { name: 'Generated workup' })).not.toBeNull();
      expect(screen.getByRole('radio', { name: /Evidence/ }).getAttribute('aria-checked')).toBe('true');
    });
  });
});
