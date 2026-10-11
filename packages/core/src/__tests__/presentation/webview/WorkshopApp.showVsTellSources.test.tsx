/** @jest-environment jsdom */

/**
 * Full-WorkshopApp regressions for Show vs. Tell's grounded work.
 *
 * Snapshots come from real WorkshopSessionService instances, so these witness
 * the host's own revisions rather than hand-built ones. Work grounded on a
 * source reference must not outlive the room or source content it was
 * generated against; work with no source reference does not depend on either.
 */

import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  MessageType
} from '@messages';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import {
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

const newService = (): WorkshopSessionService => {
  const service = new WorkshopSessionService(() => 1);
  service.setSessionScope('open');
  return service;
};

const pin = (service: WorkshopSessionService, text: string): void => {
  service.replaceExcerpt({ text, source: { kind: 'manual' } });
  service.setSessionScope('excerpt');
};

const FILE = {
  kind: 'file' as const,
  origin: 'writer' as const,
  label: 'kitchen.md',
  sourceUri: 'file:///workspace/kitchen.md',
  relativePath: 'scenes/kitchen.md'
};

describe('Show vs. Tell grounded work across room and source changes', () => {
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

  /** Open the sheet, ground it on `sourceLabel` (none when null), fill the beat, and press Generate. */
  const openAndGenerate = (service: WorkshopSessionService, sourceLabel: RegExp | null): string => {
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
    if (sourceLabel) {
      fireEvent.click(screen.getByRole('checkbox', { name: sourceLabel }));
    }
    fireEvent.click(screen.getByRole('button', { name: /Generate the workup/ }));
    return sent(MessageType.WORKSHOP_SHOW_VS_TELL_GENERATE).at(-1)!.payload.token as string;
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

  const workupShown = (): boolean => screen.queryByRole('region', { name: 'Generated workup' }) !== null;

  it('clears a grounded workup when a different room arrives at the same excerpt version', () => {
    const first = newService();
    pin(first, 'He set the mug down. She hadn’t trusted him since the funeral.');
    const second = newService();
    pin(second, 'A different room entirely, also at excerpt version one.');
    expect(first.getSnapshot().excerptVersion).toBe(second.getSnapshot().excerptVersion);

    const token = openAndGenerate(first, /Active excerpt/);
    settle(token);
    expect(workupShown()).toBe(true);

    deliver(room(second));

    expect(workupShown()).toBe(false);
    expect(screen.getByText('Generated workup cleared because the room changed.')).not.toBeNull();
  });

  it('clears a grounded workup when a file attachment is refreshed in place with the same id and word count', () => {
    const service = newService();
    service.addContextAttachment({ ...FILE, words: 3, content: 'A peaceful kitchen.' });
    const token = openAndGenerate(service, /kitchen\.md/);
    settle(token);
    expect(workupShown()).toBe(true);

    const refreshed = service.refreshContextFileAttachments([{
      id: 'ctx-1',
      content: 'A hostile battlefield.',
      words: 3,
      sourceUri: FILE.sourceUri,
      relativePath: FILE.relativePath
    }]);
    expect(refreshed.ok).toBe(true);
    deliver(room(service));

    expect(workupShown()).toBe(false);
  });

  it('cancels and discards an in-flight generation when its text attachment is edited in place', () => {
    const service = newService();
    service.addContextAttachment({
      kind: 'text', origin: 'writer', label: 'Note', words: 3, content: 'A peaceful kitchen.'
    });
    const token = openAndGenerate(service, /Note/);
    expect(sent(MessageType.CANCEL_SHOW_VS_TELL_GENERATE_REQUEST)).toHaveLength(0);

    expect(service.updateContextAttachmentText('ctx-1', 'A hostile battlefield.', 3).ok).toBe(true);
    deliver(room(service));

    expect(sent(MessageType.CANCEL_SHOW_VS_TELL_GENERATE_REQUEST)).toHaveLength(1);
    expect(sent(MessageType.CANCEL_SHOW_VS_TELL_GENERATE_REQUEST)[0].payload.requestId).toBe(token);
    settle(token);
    expect(workupShown()).toBe(false);
    expect(screen.getByRole('button', { name: /Generate the workup/ })).not.toBeNull();
  });

  it('does not disturb ungrounded work when unrelated context changes', () => {
    const service = newService();
    pin(service, 'Some excerpt.');
    const token = openAndGenerate(service, null);
    settle(token);
    expect(workupShown()).toBe(true);

    service.addContextAttachment({ kind: 'text', origin: 'writer', label: 'Other', words: 1, content: 'Other' });
    deliver(room(service));

    expect(workupShown()).toBe(true);
  });

  describe('controls', () => {
    it('clears a grounded workup when the excerpt version genuinely increments', () => {
      const service = newService();
      pin(service, 'First passage.');
      const token = openAndGenerate(service, /Active excerpt/);
      settle(token);
      expect(workupShown()).toBe(true);

      service.replaceExcerpt({ text: 'Second passage.', source: { kind: 'manual' } });
      deliver(room(service));

      expect(workupShown()).toBe(false);
    });

    it('cancels exactly once on close and rejects the late result after reopening', () => {
      const service = newService();
      pin(service, 'First passage.');
      const token = openAndGenerate(service, /Active excerpt/);

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(sent(MessageType.CANCEL_SHOW_VS_TELL_GENERATE_REQUEST)).toHaveLength(1);

      settle(token);
      fireEvent.click(screen.getByRole('button', { name: 'Widgets' }));
      fireEvent.click(screen.getAllByRole('button', { name: /Show vs\. Tell Playground/ })[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Open widget' }));

      expect(workupShown()).toBe(false);
      expect((screen.getByRole('textbox', { name: /Selected beat/ }) as HTMLInputElement).value).toBe('');
    });
  });
});
