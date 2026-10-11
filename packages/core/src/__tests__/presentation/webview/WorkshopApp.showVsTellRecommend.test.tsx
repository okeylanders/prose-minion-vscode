/** @jest-environment jsdom */

/**
 * Full-WorkshopApp witnesses for Show vs. Tell's persona recommendation and
 * prefill (Sprint 05, Slice 5). The room comes from real WorkshopSessionService
 * snapshots; the host's replies are the same envelopes the extension posts.
 */

import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import {
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  MessageType,
  type WorkshopShowVsTellRecommendationSeed
} from '@messages';
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

/** A room whose Host has answered with a Show vs. Tell recommendation chip. */
const roomWithRecommendation = (
  seed: WorkshopShowVsTellRecommendationSeed,
  options: { excerpt?: boolean } = {}
) => {
  let clock = 0;
  const service = new WorkshopSessionService(() => ++clock);
  service.setSessionScope('open');
  if (options.excerpt) {
    service.setExcerpt({ text: 'She hadn’t trusted him since the funeral.', source: { kind: 'manual' } });
  }
  service.beginPersonaMessage('req-1', 'Is the funeral line telling too much?');
  const turn = service.completeRun(
    'req-1',
    'That line carries a year in nine words — it buys time and spends the moment.',
    undefined,
    false,
    'host-conv',
    [],
    undefined,
    { widgetId: 'show-vs-tell', seed }
  )!;
  return { service, turn };
};

const SEED: WorkshopShowVsTellRecommendationSeed = {
  beatText: 'She hadn’t trusted him since the funeral.',
  subject: 'the funeral line',
  sourceReferences: [],
  mustSurvive: 'The distrust is old and funeral-rooted.',
  mustNotChange: 'No flashback.',
  pov: { mode: 'close-third', focalCharacter: 'Mara' },
  position: 'evidence',
  channels: ['interiority', 'dialogue-subtext'],
  lengthBudget: 'plus-one-sentence'
};

describe('Show vs. Tell persona recommendation and prefill', () => {
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
  const chip = (): HTMLElement => screen.getByRole('button', { name: /Show vs\. Tell Playground/ });

  const mountRoom = (
    seed: WorkshopShowVsTellRecommendationSeed,
    options: { excerpt?: boolean } = {}
  ) => {
    const { service, turn } = roomWithRecommendation(seed, options);
    render(<WorkshopApp />);
    deliver(room(service));
    return { service, turn };
  };

  it('shows the chip with the persona-written subject and nothing from the seed body', () => {
    mountRoom(SEED);

    expect(chip().textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Show vs. Tell Playground prefilled · the funeral line'
    );
    expect(chip().textContent).not.toContain('trusted him');
    expect(sheet()).toBeNull();
    expect(sent(MessageType.WORKSHOP_SHOW_VS_TELL_GENERATE)).toHaveLength(0);
  });

  it('falls back to a bare "prefilled" chip when the persona wrote no subject', () => {
    mountRoom({ ...SEED, subject: undefined });

    expect(chip().textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Show vs. Tell Playground prefilled'
    );
  });

  it('opens the seeded sheet with the persona banner and posts nothing', () => {
    const { turn } = mountRoom(SEED);
    const posted = vscode.postMessage.mock.calls.length;

    fireEvent.click(chip());

    const dialog = sheet()!;
    expect(dialog).not.toBeNull();
    const banner = dialog.querySelector('.pm-ws-svt-banner-seed')!.textContent!;
    expect(banner).toBe(
      `Recommended and prefilled by ${turn.personaLabel}. ${turn.personaLabel} spotted a told beat worth testing — proposing and prefilling is as far as a persona goes; you decide what commits.`
    );
    expect(banner).not.toMatch(/\b(she|he|her|his|they|them|their)\b/i);

    expect((within(dialog).getByRole('textbox', { name: /Selected beat/ }) as HTMLInputElement).value)
      .toBe(SEED.beatText);
    expect((within(dialog).getByRole('textbox', { name: /Must survive every variation/ }) as HTMLTextAreaElement).value)
      .toBe(SEED.mustSurvive);
    // Opened at the position the persona suggested, not at the Hinge default.
    expect(within(dialog).getByRole('radio', { name: /Evidence/ }).getAttribute('aria-checked')).toBe('true');
    expect(within(dialog).getByRole('radio', { name: /Hinge/ }).getAttribute('aria-checked')).toBe('false');
    // No workup, so nothing is kept and nothing can commit.
    expect(within(dialog).queryByRole('region', { name: 'Generated workup' })).toBeNull();
    expect((within(dialog).getByRole('button', { name: 'Commit to thread' }) as HTMLButtonElement).disabled)
      .toBe(true);

    // Opening is read-only: not one new message left the webview.
    expect(vscode.postMessage.mock.calls).toHaveLength(posted);
    expect(sent(MessageType.WORKSHOP_SHOW_VS_TELL_GENERATE)).toHaveLength(0);
    expect(sent(MessageType.WORKSHOP_COMMIT_WIDGET)).toHaveLength(0);
  });

  it('lets the writer generate, keep, and commit through the rail, with persona custody of the beat', () => {
    mountRoom(SEED, { excerpt: true });
    fireEvent.click(chip());
    const dialog = sheet()!;
    expect(sent(MessageType.WORKSHOP_SHOW_VS_TELL_GENERATE)).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole('button', { name: /Generate the workup/ }));
    const [generate] = sent(MessageType.WORKSHOP_SHOW_VS_TELL_GENERATE);
    expect(generate.payload).toMatchObject({
      beat: {
        text: SEED.beatText,
        provenance: { kind: 'persona-prefill', editedByWriter: false }
      },
      pov: { mode: 'close-third', focalCharacter: 'Mara' },
      position: 'evidence',
      channels: ['interiority', 'dialogue-subtext'],
      lengthBudget: 'plus-one-sentence'
    });
    // The chip label is display-only: it never reaches generation.
    expect(JSON.stringify(generate.payload)).not.toContain('the funeral line');

    const workup = generatedShowVsTellDraft().workup!;
    deliver({
      type: MessageType.WORKSHOP_SHOW_VS_TELL_RESULT,
      source: 'extension.workshop',
      timestamp: 5,
      payload: {
        widgetId: 'show-vs-tell',
        token: generate.payload.token,
        workupId: workup.workupId,
        ok: true,
        workup
      }
    });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Keep variant 3' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Commit to thread' }));

    const [committed] = sent(MessageType.WORKSHOP_COMMIT_WIDGET);
    expect(committed.payload.clonedFromConfigId).toBeUndefined();
    expect(committed.payload.draft).toMatchObject({
      beat: {
        text: SEED.beatText,
        provenance: { kind: 'persona-prefill', editedByWriter: false }
      },
      pov: { mode: 'close-third', focalCharacter: 'Mara' },
      position: 'evidence',
      kept: [{ variantId: fixtureVariantId(3), carryMode: 'direction' }],
      workup
    });
    // POV is plain writer input after prefill: the draft gains no custody field.
    expect(Object.keys(committed.payload.draft).sort()).toEqual([
      'beat', 'channels', 'kept', 'lengthBudget', 'note', 'position', 'pov',
      'surroundingContext', 'workup', 'invariants'
    ].sort());
  });

  it('flips the committed beat provenance when the writer edits the prepared beat', () => {
    mountRoom(SEED, { excerpt: true });
    fireEvent.click(chip());
    const dialog = sheet()!;

    fireEvent.change(within(dialog).getByRole('textbox', { name: /Selected beat/ }), {
      target: { value: 'She had not trusted him since the funeral.' }
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /Generate the workup/ }));

    expect(sent(MessageType.WORKSHOP_SHOW_VS_TELL_GENERATE).at(-1)!.payload.beat).toEqual({
      text: 'She had not trusted him since the funeral.',
      provenance: { kind: 'persona-prefill', personaId: expect.any(String), editedByWriter: true }
    });
  });

  it('keeps a seeded source the room no longer has and blocks Generate instead of dropping it', () => {
    mountRoom({ ...SEED, sourceReferences: [{ kind: 'context-attachment', attachmentId: 'ctx-9' }] });
    fireEvent.click(chip());
    const dialog = sheet()!;

    const generate = within(dialog).getByRole('button', { name: /Generate the workup/ }) as HTMLButtonElement;
    fireEvent.click(generate);

    expect(generate.disabled).toBe(true);
    expect(sent(MessageType.WORKSHOP_SHOW_VS_TELL_GENERATE)).toHaveLength(0);
  });
});
