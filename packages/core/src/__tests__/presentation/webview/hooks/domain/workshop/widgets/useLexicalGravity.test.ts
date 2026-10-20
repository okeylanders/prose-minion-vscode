/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { useLexicalGravity } from '@hooks/domain/workshop/widgets/useLexicalGravity';
import {
  MessageType,
  WorkshopSeedClaimResultMessage,
  WorkshopLexicalGravityLensesDataMessage,
  WorkshopWidgetActionResultMessage
} from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

describe('useLexicalGravity', () => {
  beforeEach(() => {
    (useVSCodeApi as jest.Mock).mockReturnValue(createMockVSCode());
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  const seedPayload = (seedId: string) => ({
    seedId,
    seed: { origin: 'lightbox' as const, field: 'Telescope', metaphor: 'm', terms: [], sourceLabel: 'a.md' },
    subject: 'Telescope'
  });
  const claimResult = (deliveryId: string, granted: boolean): WorkshopSeedClaimResultMessage => ({
    type: MessageType.WORKSHOP_SEED_CLAIM_RESULT,
    source: 'extension.workshop',
    timestamp: 2,
    payload: granted
      ? { kind: 'lexical-gravity-build', deliveryId, granted: true }
      : { kind: 'lexical-gravity-build', deliveryId, granted: false, reason: 'timeout' }
  });

  it('claims a Build lens subject handed over by the host, offers it only once granted, and builds nothing', () => {
    const vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    const { result } = renderHook(() => useLexicalGravity());
    const payload = seedPayload('lexical-build-seed-1');
    act(() => result.current.handleBuildSeed({
      type: MessageType.WORKSHOP_LEXICAL_GRAVITY_BUILD_SEED,
      source: 'extension.workshop.lexical-gravity',
      timestamp: 1,
      payload
    }));
    // Held, not offered: the host must grant the claim first (PR #150 F-03).
    expect(result.current.lexicalGravityBuildSeed).toBeNull();
    const posted = () => (vscode.postMessage as jest.Mock).mock.calls.map(([message]) => message);
    expect(posted()).toEqual([expect.objectContaining({
      type: MessageType.WORKSHOP_SEED_CLAIM,
      payload: { kind: 'lexical-gravity-build', deliveryId: 'lexical-build-seed-1' }
    })]);

    // Another delivery's result changes nothing; the granted one is offered.
    act(() => result.current.handleSeedClaimResult(claimResult('lexical-build-seed-0', true)));
    expect(result.current.lexicalGravityBuildSeed).toBeNull();
    act(() => result.current.handleSeedClaimResult(claimResult('lexical-build-seed-1', true)));
    expect(result.current.lexicalGravityBuildSeed).toEqual(payload);

    // An answer for another seed leaves this one offered; the answer goes back to the host.
    act(() => result.current.answerLexicalGravityBuildSeed({ deliveryId: 'lexical-build-seed-0', opened: false, reason: 'busy' }));
    expect(result.current.lexicalGravityBuildSeed).toEqual(payload);
    act(() => result.current.answerLexicalGravityBuildSeed({ deliveryId: 'lexical-build-seed-1', opened: true }));
    expect(result.current.lexicalGravityBuildSeed).toBeNull();
    expect(posted().at(-1)).toMatchObject({
      type: MessageType.WORKSHOP_SEED_ANSWER,
      payload: { kind: 'lexical-gravity-build', deliveryId: 'lexical-build-seed-1', opened: true }
    });
  });

  it('drops a denied seed without offering it, and a newer seed supersedes one still being claimed', () => {
    const vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    const { result } = renderHook(() => useLexicalGravity());
    const deliver = (seedId: string) => act(() => result.current.handleBuildSeed({
      type: MessageType.WORKSHOP_LEXICAL_GRAVITY_BUILD_SEED,
      source: 'extension.workshop.lexical-gravity',
      timestamp: 1,
      payload: seedPayload(seedId)
    }));
    deliver('lexical-build-seed-1');
    act(() => result.current.handleSeedClaimResult(claimResult('lexical-build-seed-1', false)));
    expect(result.current.lexicalGravityBuildSeed).toBeNull();

    deliver('lexical-build-seed-2');
    deliver('lexical-build-seed-3');
    // A late grant for the superseded seed offers nothing.
    act(() => result.current.handleSeedClaimResult(claimResult('lexical-build-seed-2', true)));
    expect(result.current.lexicalGravityBuildSeed).toBeNull();
    act(() => result.current.handleSeedClaimResult(claimResult('lexical-build-seed-3', true)));
    expect(result.current.lexicalGravityBuildSeed?.seedId).toBe('lexical-build-seed-3');
    expect((vscode.postMessage as jest.Mock).mock.calls.map(([message]) => message.type)
      .filter((type) => type === MessageType.WORKSHOP_SEED_ANSWER)).toEqual([]);
  });

  it('surfaces catalog incompatibilities alongside usable lenses without discarding either', () => {
    const { result } = renderHook(() => useLexicalGravity());
    const incompatibility = {
      resourceName: 'kinetic-biomechanics.json',
      foundVersion: 1,
      rebuildQuery: 'kinetic biomechanics',
      message: 'Saved Lexical Gravity lens kinetic-biomechanics.json uses version 1.'
    };
    const lensesData: WorkshopLexicalGravityLensesDataMessage = {
      type: MessageType.WORKSHOP_LEXICAL_GRAVITY_LENSES_DATA,
      source: 'extension.workshop.lexical-gravity',
      timestamp: 1,
      payload: {
        lenses: [],
        incompatibleResources: [incompatibility],
        storagePath: 'prose-minion/lenses'
      }
    };

    act(() => result.current.handleLensesData(lensesData));

    expect(result.current.incompatibleResources).toEqual([incompatibility]);
    expect(result.current.storagePath).toBe('prose-minion/lenses');
    expect(result.current.catalogError).toBeUndefined();
  });

  it('carries the exact incompatible resource name through the build request', () => {
    const vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    const { result } = renderHook(() => useLexicalGravity());

    act(() => result.current.buildLens(
      'build-1',
      'kinetic biomechanics',
      'kinetic-biomechanics.json'
    ));

    expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.WORKSHOP_BUILD_LEXICAL_GRAVITY_LENS,
      payload: {
        token: 'build-1',
        query: 'kinetic biomechanics',
        rebuildResourceName: 'kinetic-biomechanics.json'
      }
    }));
  });

  it('owns apply acknowledgements and ignores sibling feature commits', () => {
    const vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    const { result } = renderHook(() => useLexicalGravity());
    act(() => result.current.apply({} as never));
    const requestToken = vscode.postMessage.mock.calls[0][0].payload.requestToken;
    const applyResult: WorkshopWidgetActionResultMessage = {
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      source: 'extension.workshop.lexical-gravity',
      timestamp: 1,
      payload: {
        action: 'apply-standing',
        requestToken,
        widgetId: 'lexical-gravity',
        ok: true,
        widgetConfigId: 'wc-1'
      }
    };
    const gestureResult: WorkshopWidgetActionResultMessage = {
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      source: 'extension.workshop.widget',
      timestamp: 2,
      payload: {
        action: 'commit',
        requestToken: 'commit-elsewhere',
        widgetId: 'gesture-playground',
        ok: true,
        widgetConfigId: 'wc-2'
      }
    };

    act(() => result.current.handleActionResult(applyResult));
    expect(result.current.actionResult).toEqual(applyResult.payload);

    act(() => result.current.handleActionResult(gestureResult));
    expect(result.current.actionResult).toEqual(applyResult.payload);

    act(() => result.current.consumeActionResult());
    expect(result.current.actionResult).toBeNull();
  });

  it('ignores an older apply result after a newer request owns the UI', () => {
    const vscode = createMockVSCode();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    const { result } = renderHook(() => useLexicalGravity());

    act(() => result.current.apply({} as never));
    const oldToken = vscode.postMessage.mock.calls[0][0].payload.requestToken;
    act(() => result.current.apply({} as never));

    act(() => result.current.handleActionResult({
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      source: 'extension.workshop.standing-directives',
      timestamp: 1,
      payload: {
        action: 'apply-standing',
        requestToken: oldToken,
        widgetId: 'lexical-gravity',
        ok: true
      }
    }));

    expect(result.current.actionResult).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('no current apply request owns this token'),
      expect.objectContaining({ requestToken: oldToken })
    );
  });
});
