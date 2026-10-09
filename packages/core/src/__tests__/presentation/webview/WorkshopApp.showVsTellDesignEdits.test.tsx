/** @jest-environment jsdom */

/**
 * Full-WorkshopApp regression for the Slice 7 design edits (D1–D4): a writer
 * authors with zero channels, no must survive, a typed surrounding passage,
 * and two context sources; generates; keeps; commits; reopens the chip; and
 * recommits as a new turn. Snapshots come from a real WorkshopSessionService.
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { DEFAULT_WORKSHOP_WRITER_PROFILE, MessageType, type WorkshopShowVsTellDraft } from '@messages';
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

describe('Show vs. Tell design edits (D1–D4) end to end', () => {
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

  const roomWithTwoSources = (): WorkshopSessionService => {
    const service = new WorkshopSessionService(() => 1);
    service.setSessionScope('open');
    service.replaceExcerpt({ text: 'He set the mug down. She hadn’t trusted him since the funeral.', source: { kind: 'manual' } });
    service.setSessionScope('excerpt');
    service.addContextAttachment({
      kind: 'text', origin: 'writer', label: 'Character notes', words: 3, content: 'Nora hides fear.'
    });
    return service;
  };

  const openFresh = (service: WorkshopSessionService): void => {
    render(<WorkshopApp />);
    deliver(room(service));
    fireEvent.click(screen.getByRole('button', { name: 'Widgets' }));
    fireEvent.click(screen.getAllByRole('button', { name: /Show vs\. Tell Playground/ })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Open widget' }));
  };

  const settle = (token: string): void => {
    const workup = generatedShowVsTellDraft().workup!;
    deliver({
      type: MessageType.WORKSHOP_SHOW_VS_TELL_RESULT,
      source: 'extension.workshop',
      timestamp: 5,
      payload: { widgetId: 'show-vs-tell', token, workupId: workup.workupId, ok: true, workup }
    });
  };

  it('authors with zero channels, no must survive, a typed passage, and two sources; generates, keeps, commits, reopens, and recommits', () => {
    const service = roomWithTwoSources();
    openFresh(service);
    const dialog = sheet()!;

    // The beat, and nothing else that was once required.
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Selected beat/ }), {
      target: { value: 'She hadn’t trusted him since the funeral.' }
    });
    expect((within(dialog).getByRole('textbox', { name: /Must survive every variation optional/ }) as HTMLTextAreaElement).value).toBe('');

    // Zero channels: every chip off, none locked or dimmed.
    fireEvent.click(within(dialog).getByRole('button', { name: 'observable action' }));
    const sense = within(dialog).getByRole('button', { name: 'sensory evidence' }) as HTMLButtonElement;
    expect(sense.getAttribute('aria-pressed')).toBe('true');
    expect(sense.getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(sense);
    expect(within(dialog).getByText(/No emphasis:/)).toBeTruthy();

    // A typed passage, then the excerpt copied in over it, then two context sources.
    const passage = within(dialog).getByRole('textbox', { name: /Surrounding passage/ }) as HTMLTextAreaElement;
    fireEvent.change(passage, { target: { value: 'Typed context.' } });
    expect(passage.value).toBe('Typed context.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use excerpt' }));
    expect(passage.value).toBe('He set the mug down. She hadn’t trusted him since the funeral.');
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Character notes/ }));
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Active excerpt/ }));

    fireEvent.click(within(dialog).getByRole('button', { name: /Generate the workup/ }));
    const [generate] = sent(MessageType.WORKSHOP_SHOW_VS_TELL_GENERATE);
    expect(generate.payload).toEqual(expect.objectContaining({
      channels: [],
      invariants: { mustSurvive: '', mustNotChange: '' },
      surroundingContext: {
        writerText: 'He set the mug down. She hadn’t trusted him since the funeral.',
        sourceReferences: [{ kind: 'active-excerpt' }, { kind: 'context-attachment', attachmentId: 'ctx-1' }]
      }
    }));
    settle(generate.payload.token);

    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Keep variant 3' }));
    const commit = within(dialog).getByRole('button', { name: 'Commit to thread' }) as HTMLButtonElement;
    expect(commit.disabled).toBe(false);
    fireEvent.click(commit);
    const [posted] = sent(MessageType.WORKSHOP_COMMIT_WIDGET);
    expect(posted.payload.draft).toEqual(expect.objectContaining({
      channels: [],
      invariants: { mustSurvive: '', mustNotChange: '' },
      surroundingContext: {
        writerText: 'He set the mug down. She hadn’t trusted him since the funeral.',
        sourceReferences: [{ kind: 'active-excerpt' }, { kind: 'context-attachment', attachmentId: 'ctx-1' }]
      },
      kept: [{ variantId: fixtureVariantId(3), carryMode: 'direction' }]
    }));
    // The artifact preview carried neither invariant line nor the passage.
    const preview = within(dialog).getByText(/^beat: /).closest('pre, div, p')?.textContent ?? '';
    expect(preview).not.toContain('must survive:');
    expect(preview).not.toContain('He set the mug down.');

    // The host commits the exact draft as a turn with a chip, and the room shows it.
    const committed = posted.payload.draft as WorkshopShowVsTellDraft;
    const config = service.createWidgetConfig({ widgetId: 'show-vs-tell', draft: committed });
    const artifactId = service.mintWidgetArtifactId();
    const turn = service.beginPersonaMessage('req-svt', 'Ran the beat through the playground.', undefined, {
      widgetId: 'show-vs-tell',
      widgetConfigId: config.id,
      rail: 'thread-artifact',
      artifactId,
      selectionCount: committed.kept.length
    });
    service.recordRoomThreadArtifacts(turn.id, [{
      id: artifactId,
      kind: workshopWidgetArtifactKind('show-vs-tell'),
      name: 'Show vs. Tell Playground',
      content: 'beat: "x"'
    }]);
    service.recordWidgetCommit(config.id, { turnId: turn.id, artifactId });
    service.completeRun('req-svt', 'Accepted.');
    deliver({
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      source: 'extension.workshop.widget',
      timestamp: 9,
      payload: { action: 'commit', requestToken: posted.payload.requestToken, widgetId: 'show-vs-tell', ok: true, widgetConfigId: config.id, turnId: turn.id }
    });
    expect(sheet()).toBeNull();
    deliver(room(service));

    // Reopen from the chip: the exact draft, including the passage, the two sources, and zero channels.
    fireEvent.click(screen.getByRole('button', { name: /Show vs\. Tell/ }));
    deliver({
      type: MessageType.WORKSHOP_WIDGET_CONFIG_DATA,
      source: 'extension.workshop.widget',
      timestamp: 10,
      payload: { configId: config.id, config: service.getWidgetConfig(config.id) }
    });
    const reopened = sheet()!;
    expect(reopened).not.toBeNull();
    expect((within(reopened).getByRole('textbox', { name: /Surrounding passage/ }) as HTMLTextAreaElement).value)
      .toBe('He set the mug down. She hadn’t trusted him since the funeral.');
    expect((within(reopened).getByRole('checkbox', { name: /Character notes/ }) as HTMLInputElement).checked).toBe(true);
    expect((within(reopened).getByRole('checkbox', { name: /Active excerpt/ }) as HTMLInputElement).checked).toBe(true);
    expect((within(reopened).getByRole('textbox', { name: /Must survive every variation optional/ }) as HTMLTextAreaElement).value).toBe('');
    expect(within(reopened).getByText(/No emphasis:/)).toBeTruthy();
    expect(within(reopened).getByRole('checkbox', { name: 'Keep variant 3' }).getAttribute('aria-checked')).toBe('true');

    // Recommit as a new turn with the exact draft and the clone lineage.
    fireEvent.click(within(reopened).getByRole('button', { name: 'Commit as new turn' }));
    const recommit = sent(MessageType.WORKSHOP_COMMIT_WIDGET).at(-1)!;
    expect(recommit.payload).toEqual({
      widgetId: 'show-vs-tell',
      requestToken: expect.any(String),
      draft: committed,
      clonedFromConfigId: config.id
    });
  });
});
