import { DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR, MessageType } from '@messages';
import {
  analysisResult,
  createWorkshopRouteTestHarness,
  message
} from './WorkshopRouteTestHarness';
import type { WorkshopRouteTestHarness } from './WorkshopRouteTestHarness';
import {
  generatedShowVsTellDraft
} from '@/__tests__/application/services/workshop/widgets/showVsTell/showVsTellFixtures';
import {
  WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY
} from '@/application/services/workshop/widgets/WorkshopWidgetAvailabilityPolicy';
import {
  parseWorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1';
import {
  showVsTellWorkupVariants
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellDerivations';
import {
  buildShowVsTellArtifact
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellArtifact';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

/**
 * Sprint 05 Slice 6: the Show vs. Tell rows of the production-policy route
 * matrix, beside Creative Variations' rows in `WorkshopRoomHandler.seams`.
 * Every row goes through the real router, the real
 * `WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY`, and the real closed adapters;
 * only the provider and the disk are faked. Generation is the Slice 3 row in
 * `seams` ("routes Show vs. Tell generation through the real production
 * catalog policy"); it is not repeated here.
 */

const showVsTellFrame = (): string => [
  '### Try a widget',
  '<workshop-widget-recommendation version="1">',
  '<widget-id>', 'show-vs-tell', '</widget-id>',
  '<told-beat>', 'She hadn’t trusted him since the funeral.', '</told-beat>',
  '<chip-subject>', 'the funeral line', '</chip-subject>',
  '<surrounding-context>', '', '</surrounding-context>',
  '<source-references>', 'none', '</source-references>',
  '<must-survive>', 'The distrust is old and funeral-rooted.', '</must-survive>',
  '<must-not-change>', '', '</must-not-change>',
  '<pov-mode>', 'close-third', '</pov-mode>',
  '<pov-focal-character>', 'Mara', '</pov-focal-character>',
  '<handling-position>', 'hinge', '</handling-position>',
  '<emphasis-channels>', '', '</emphasis-channels>',
  '<length-allowance>', '', '</length-allowance>',
  '</workshop-widget-recommendation>'
].join('\n');

const EXPECTED_SEED = {
  beatText: 'She hadn’t trusted him since the funeral.',
  subject: 'the funeral line',
  sourceReferences: [],
  mustSurvive: 'The distrust is old and funeral-rooted.',
  pov: { mode: 'close-third', focalCharacter: 'Mara' },
  position: 'hinge'
};

describe('Show vs. Tell — production-policy route matrix', () => {
  let h: WorkshopRouteTestHarness;

  beforeEach(() => {
    h = createWorkshopRouteTestHarness();
  });

  const recommendationTurns = () =>
    h.session.getSnapshot().turns.filter((turn) => turn.widgetRecommendation);

  const commitRoute = (
    requestToken: string,
    draft: unknown,
    clonedFromConfigId?: string
  ) => h.router.route(message(MessageType.WORKSHOP_COMMIT_WIDGET, {
    widgetId: 'show-vs-tell',
    requestToken,
    draft,
    ...(clonedFromConfigId ? { clonedFromConfigId } : {})
  }) as any);

  const lastActionResult = () => h.posted(MessageType.WORKSHOP_WIDGET_ACTION_RESULT).at(-1);

  it('is live in the production catalog policy', () => {
    expect(WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY.isAvailable('show-vs-tell')).toBe(true);
  });

  describe('commit through the one-shot route', () => {
    it('commits the kept variants as a fresh config, turn, and artifact without generating', async () => {
      h.session.setSessionScope('open');
      const draft = generatedShowVsTellDraft();

      await commitRoute('svt-commit', draft);

      const config = h.session.getWidgetConfig('wc-1');
      const turn = h.session.exportCommittedState().turns.find(
        (candidate) => candidate.widgetCommit?.widgetConfigId === 'wc-1'
      );
      expect(config).toMatchObject({
        widgetId: 'show-vs-tell',
        draft,
        artifactId: 'ta-1',
        committedTurnId: turn?.id
      });
      expect(turn?.widgetCommit).toMatchObject({
        widgetId: 'show-vs-tell',
        widgetConfigId: 'wc-1',
        artifactId: 'ta-1',
        selectionCount: 2
      });
      expect(h.session.exportCommittedState().threadArtifacts).toEqual([
        expect.objectContaining({
          id: 'ta-1',
          turnId: turn?.id,
          kind: 'widget:show-vs-tell',
          content: expect.stringContaining(buildShowVsTellArtifact(draft))
        })
      ]);
      expect(lastActionResult()).toMatchObject({
        payload: {
          action: 'commit',
          requestToken: 'svt-commit',
          widgetId: 'show-vs-tell',
          ok: true,
          widgetConfigId: 'wc-1'
        }
      });
      expect(h.showVsTellGenerate).not.toHaveBeenCalled();
    });

    it('clone-recommits through fresh linked records without regeneration', async () => {
      h.session.setSessionScope('open');
      const draft = generatedShowVsTellDraft();
      await commitRoute('svt-original', draft);
      const original = JSON.parse(JSON.stringify(h.session.getWidgetConfig('wc-1')));
      const originalTurn = h.session.exportCommittedState().turns.find(
        (turn) => turn.widgetCommit?.widgetConfigId === 'wc-1'
      );

      await commitRoute('svt-clone', draft, 'wc-1');

      const committed = h.session.exportCommittedState();
      const cloneTurn = committed.turns.find(
        (turn) => turn.widgetCommit?.widgetConfigId === 'wc-2'
      );
      expect(h.session.getWidgetConfig('wc-2')).toMatchObject({
        widgetId: 'show-vs-tell',
        clonedFromConfigId: 'wc-1',
        artifactId: 'ta-2',
        committedTurnId: cloneTurn?.id
      });
      expect(cloneTurn?.id).not.toBe(originalTurn?.id);
      expect(h.session.getWidgetConfig('wc-1')).toEqual(original);
      expect(committed.threadArtifacts).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'ta-1', turnId: originalTurn?.id, kind: 'widget:show-vs-tell' }),
        expect.objectContaining({ id: 'ta-2', turnId: cloneTurn?.id, kind: 'widget:show-vs-tell' })
      ]));
      expect(h.showVsTellGenerate).not.toHaveBeenCalled();
      expect(h.posted(MessageType.WORKSHOP_WIDGET_ACTION_RESULT).slice(-2)).toEqual([
        expect.objectContaining({
          payload: expect.objectContaining({
            requestToken: 'svt-original', ok: true, widgetConfigId: 'wc-1'
          })
        }),
        expect.objectContaining({
          payload: expect.objectContaining({
            requestToken: 'svt-clone', ok: true, widgetConfigId: 'wc-2'
          })
        })
      ]);
    });

    it('reopens a session saved before Slice 7 and clone-recommits its repaired draft (saved-session safety)', async () => {
      // Author and commit under the current shape, then rewrite the saved file
      // into the pre-Slice-7 shape: no writerText, one source, must survive set.
      h.session.setSessionScope('open');
      await commitRoute('svt-original', generatedShowVsTellDraft());
      const saved = h.session.exportCommittedState();
      const savedDraft = saved.widgetConfigs![0].draft as unknown as Record<string, unknown>;
      savedDraft.surroundingContext = { sourceReferences: [{ kind: 'active-excerpt' }] };

      const parsed = parseWorkshopSessionStateV1(saved);
      const hydration = h.session.hydrateCommittedState(parsed, {}, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);
      expect(hydration.normalizations).toContain('defaulted-widget-show-vs-tell-surrounding-passage-text');
      const reopened = h.session.getWidgetConfig('wc-1')!;
      expect(reopened.draft).toEqual({
        ...generatedShowVsTellDraft(),
        surroundingContext: { writerText: '', sourceReferences: [{ kind: 'active-excerpt' }] }
      });

      // The chip reopens exactly this draft; committing again is a clone of wc-1.
      await commitRoute('svt-clone', reopened.draft, 'wc-1');

      expect(h.session.getWidgetConfig('wc-2')).toMatchObject({
        widgetId: 'show-vs-tell',
        clonedFromConfigId: 'wc-1',
        artifactId: 'ta-2',
        draft: reopened.draft
      });
      expect(lastActionResult()).toMatchObject({
        payload: { requestToken: 'svt-clone', ok: true, widgetConfigId: 'wc-2' }
      });
      expect(() => parseWorkshopSessionStateV1(h.session.exportCommittedState())).not.toThrow();
      expect(h.showVsTellGenerate).not.toHaveBeenCalled();
    });

    it('refuses a crafted over-600 payload on the host and leaves state unchanged and exportable', async () => {
      h.session.setSessionScope('open');
      const draft = generatedShowVsTellDraft();
      // The webview's meter would have blocked this; the host re-measures.
      draft.kept = showVsTellWorkupVariants(draft.workup!).map((variant) => ({
        variantId: variant.id,
        carryMode: 'prose' as const
      }));
      expect(buildShowVsTellArtifact(draft).length)
        .toBeGreaterThan(PROMPT_BUDGETS.workshopWidgets.showVsTellArtifactCharacters);
      const before = JSON.parse(JSON.stringify(h.session.exportCommittedState()));

      await commitRoute('svt-over-ceiling', draft);

      expect(lastActionResult()).toMatchObject({
        payload: {
          action: 'commit',
          requestToken: 'svt-over-ceiling',
          widgetId: 'show-vs-tell',
          ok: false,
          message: expect.stringMatching(/600-character ceiling/)
        }
      });
      expect(h.session.getWidgetConfig('wc-1')).toBeUndefined();
      expect(h.session.exportCommittedState()).toEqual(before);
      expect(() => parseWorkshopSessionStateV1(h.session.exportCommittedState())).not.toThrow();
    });

    it('rejects unknown clone provenance before mutation and exports valid state', async () => {
      h.session.setSessionScope('open');
      const before = JSON.parse(JSON.stringify(h.session.exportCommittedState()));

      await commitRoute('svt-invalid-clone', generatedShowVsTellDraft(), 'wc-999');

      expect(h.session.getWidgetConfig('wc-1')).toBeUndefined();
      expect(lastActionResult()).toMatchObject({
        payload: {
          action: 'commit',
          requestToken: 'svt-invalid-clone',
          widgetId: 'show-vs-tell',
          ok: false,
          message: expect.stringMatching(/source widget configuration is no longer available/i)
        }
      });
      expect(h.session.exportCommittedState()).toEqual(before);
      expect(() => parseWorkshopSessionStateV1(h.session.exportCommittedState())).not.toThrow();
    });
  });

  describe('recommendation adoption', () => {
    it('adopts a recommendation on a Host turn, input-only', async () => {
      await h.pin();
      h.service.startWorkshopPersonaConversation.mockResolvedValueOnce(analysisResult(
        `That line carries a year in nine words.\n\n${showVsTellFrame()}`,
        { conversationId: 'host-conv' }
      ));

      await h.router.route(message(
        MessageType.WORKSHOP_SEND_MESSAGE,
        { text: 'Is this line telling too much?' }
      ) as any);

      const [turn, ...rest] = recommendationTurns();
      expect(rest).toEqual([]);
      expect(turn).toMatchObject({
        participant: 'host',
        content: 'That line carries a year in nine words.',
        widgetRecommendation: { widgetId: 'show-vs-tell', seed: EXPECTED_SEED }
      });
      // A recommendation is never a commit or a generation.
      expect(h.showVsTellGenerate).not.toHaveBeenCalled();
      expect(h.session.getWidgetConfig('wc-1')).toBeUndefined();
      expect(() => parseWorkshopSessionStateV1(h.session.exportCommittedState())).not.toThrow();
    });

    it('adopts a recommendation on the exact invited-Guest turn', async () => {
      await h.pin();
      h.service.startWorkshopGuestConversation.mockResolvedValueOnce(analysisResult(
        `Where it stands, the line trades weight for pace.\n\n${showVsTellFrame()}`,
        { conversationId: 'guest-conv' }
      ));

      await h.router.route(message(
        MessageType.WORKSHOP_INVITE_GUEST,
        { personaId: 'margot', openingMessage: 'Is this line telling too much?' }
      ) as any);

      const [turn, ...rest] = recommendationTurns();
      expect(rest).toEqual([]);
      expect(turn).toMatchObject({
        participant: 'guest',
        personaId: 'margot',
        widgetRecommendation: { widgetId: 'show-vs-tell', seed: EXPECTED_SEED }
      });
      expect(() => parseWorkshopSessionStateV1(h.session.exportCommittedState())).not.toThrow();
    });

    it('never turns a direct tool turn into a recommendation', async () => {
      await h.pin();
      await h.runProse();
      await h.router.route(message(
        MessageType.WORKSHOP_SET_CHAT_TARGET,
        { kind: 'tool', toolId: 'prose' }
      ) as any);
      h.service.continueConversation.mockResolvedValueOnce(analysisResult(
        `Here is the beat I would test.\n\n${showVsTellFrame()}`,
        { conversationId: 'tool-conv' }
      ));

      await h.router.route(message(
        MessageType.WORKSHOP_SEND_MESSAGE,
        { text: 'Prepare the Show vs. Tell widget.' }
      ) as any);

      expect(h.service.continueConversation).toHaveBeenCalledWith(
        'tool-conv',
        'Prepare the Show vs. Tell widget.',
        expect.anything()
      );
      expect(recommendationTurns()).toEqual([]);
      expect(h.session.getSnapshot().turns.at(-1)?.content).not.toContain('workshop-widget-recommendation');
      expect(() => parseWorkshopSessionStateV1(h.session.exportCommittedState())).not.toThrow();
    });
  });
});
