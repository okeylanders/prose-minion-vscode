import { MessageType, WorkshopLexicalGravityDraft } from '@messages';
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
  WORKSHOP_STANDING_DIRECTIVE_OPERATIONS
} from '@/application/services/workshop/directives/WorkshopStandingDirectiveOperations';
import {
  WorkshopStandingDirectiveService
} from '@/application/services/workshop/directives/WorkshopStandingDirectiveService';
import {
  builtInLexicalGravityLens
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityLenses';
import {
  parseWorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1';

/**
 * Sprint 05 deliverable 7(b), behavioral half: Show vs. Tell and Lexical
 * Gravity's application gear and evidence mode share a room, never state. The
 * static half is `showVsTellWitnesses.test.ts` in the architecture suite.
 */

const lexicalDraft = (
  applicationMode: WorkshopLexicalGravityDraft['applicationMode'],
  evidenceMode: WorkshopLexicalGravityDraft['evidenceMode']
): WorkshopLexicalGravityDraft => ({
  lensSlug: 'photography',
  applicationMode,
  evidenceMode,
  weight: 60,
  reach: 2,
  metaphorPull: false,
  resolvedLens: builtInLexicalGravityLens('photography')!
});

const lexicalFrame = (): string => [
  '### Try a widget',
  '<workshop-widget-recommendation version="1">',
  '<widget-id>', 'lexical-gravity', '</widget-id>',
  '<lens-slug>', 'photography', '</lens-slug>',
  '<weight>', '60', '</weight>',
  '<reach>', '2', '</reach>',
  '<metaphor-pull>', 'false', '</metaphor-pull>',
  '</workshop-widget-recommendation>'
].join('\n');

const showVsTellFrame = (): string => [
  '### Try a widget',
  '<workshop-widget-recommendation version="1">',
  '<widget-id>', 'show-vs-tell', '</widget-id>',
  '<told-beat>', 'She hadn’t trusted him since the funeral.', '</told-beat>',
  '<chip-subject>', '', '</chip-subject>',
  '<surrounding-context>', '', '</surrounding-context>',
  '<source-references>', 'none', '</source-references>',
  '<must-survive>', 'The distrust is old and funeral-rooted.', '</must-survive>',
  '<must-not-change>', '', '</must-not-change>',
  '<pov-mode>', '', '</pov-mode>',
  '<pov-focal-character>', '', '</pov-focal-character>',
  '<handling-position>', 'hinge', '</handling-position>',
  '<emphasis-channels>', '', '</emphasis-channels>',
  '<length-allowance>', '', '</length-allowance>',
  '</workshop-widget-recommendation>'
].join('\n');

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe('Show vs. Tell — independence from Lexical Gravity in one session', () => {
  let h: WorkshopRouteTestHarness;
  let directives: WorkshopStandingDirectiveService;

  beforeEach(async () => {
    h = createWorkshopRouteTestHarness();
    directives = new WorkshopStandingDirectiveService(
      h.session,
      { replaceStandingDirectiveFrames: jest.fn().mockResolvedValue(undefined) } as never
    );
    await h.pin();
    h.session.setSessionScope('open');
  });

  const installLexical = (draft: WorkshopLexicalGravityDraft, widgetConfigId?: string) =>
    directives.apply(WORKSHOP_STANDING_DIRECTIVE_OPERATIONS.prepareApply({
      requestToken: 'lexical-apply',
      widgetId: 'lexical-gravity',
      draft,
      widgetConfigId
    }));

  const showVsTellArtifacts = () => clone(
    (h.session.exportCommittedState().threadArtifacts ?? []).filter(
      (artifact) => artifact.kind === 'widget:show-vs-tell'
    )
  );

  const lexicalState = () => ({
    directives: clone(h.session.getStandingDirectives()),
    config: clone(h.session.getWidgetConfig('wc-1'))
  });

  it('adopts both recommendations and commits Show vs. Tell without touching the gear, evidence mode, or directives', async () => {
    await installLexical(lexicalDraft('interpret', 'blend' as const));
    const lexicalBefore = lexicalState();
    expect(lexicalBefore.config).toMatchObject({
      widgetId: 'lexical-gravity',
      draft: { applicationMode: 'interpret', evidenceMode: 'blend' }
    });

    // One session, two persona turns: a Host turn with a Lexical Gravity
    // recommendation and an invited-Guest turn with a Show vs. Tell one.
    h.service.startWorkshopPersonaConversation.mockResolvedValueOnce(analysisResult(
      `The lens could do more here.\n\n${lexicalFrame()}`,
      { conversationId: 'host-conv' }
    ));
    await h.router.route(message(
      MessageType.WORKSHOP_SEND_MESSAGE,
      { text: 'What would a lens change?' }
    ) as any);
    h.service.startWorkshopGuestConversation.mockResolvedValueOnce(analysisResult(
      `That line is telling.\n\n${showVsTellFrame()}`,
      { conversationId: 'guest-conv' }
    ));
    await h.router.route(message(
      MessageType.WORKSHOP_INVITE_GUEST,
      { personaId: 'margot', openingMessage: 'Is this line telling too much?' }
    ) as any);

    const turns = h.session.getSnapshot().turns.filter((turn) => turn.widgetRecommendation);
    expect(turns.map((turn) => turn.widgetRecommendation?.widgetId))
      .toEqual(['lexical-gravity', 'show-vs-tell']);
    // Adopting a recommendation is input-only for both widgets.
    expect(lexicalState()).toEqual(lexicalBefore);
    expect(h.showVsTellGenerate).not.toHaveBeenCalled();
    expect(h.session.getWidgetConfig('wc-2')).toBeUndefined();

    // Committing the Show vs. Tell artifact leaves the standing state alone.
    await h.router.route(message(MessageType.WORKSHOP_COMMIT_WIDGET, {
      widgetId: 'show-vs-tell',
      requestToken: 'svt-commit',
      draft: generatedShowVsTellDraft()
    }) as any);

    expect(h.session.getWidgetConfig('wc-2')).toMatchObject({ widgetId: 'show-vs-tell' });
    expect(lexicalState()).toEqual(lexicalBefore);
    expect(h.session.getStandingDirectives()).toHaveLength(1);
    expect(() => parseWorkshopSessionStateV1(h.session.exportCommittedState())).not.toThrow();
  });

  it('shifts Lexical Gravity gear and evidence mode without touching a committed Show vs. Tell draft', async () => {
    const installed = await installLexical(lexicalDraft('interpret', 'blend'));
    await h.router.route(message(MessageType.WORKSHOP_COMMIT_WIDGET, {
      widgetId: 'show-vs-tell',
      requestToken: 'svt-commit',
      draft: generatedShowVsTellDraft()
    }) as any);
    const showVsTellConfig = clone(h.session.getWidgetConfig('wc-2'));
    const artifactsBefore = showVsTellArtifacts();
    expect(showVsTellConfig).toMatchObject({ widgetId: 'show-vs-tell' });
    expect(artifactsBefore).toHaveLength(1);

    await installLexical(lexicalDraft('recompose', 'show'), installed.config.id);

    // The shift really happened...
    expect(h.session.getWidgetConfig('wc-1')).toMatchObject({
      widgetId: 'lexical-gravity',
      revision: 2,
      draft: { applicationMode: 'recompose', evidenceMode: 'show' }
    });
    // ...and Show vs. Tell saw none of it.
    expect(h.session.getWidgetConfig('wc-2')).toEqual(showVsTellConfig);
    expect(showVsTellArtifacts()).toEqual(artifactsBefore);

    // Removing the directive is equally invisible to the committed draft.
    await directives.remove('lexical-gravity');
    expect(h.session.getStandingDirectives()).toEqual([]);
    expect(h.session.getWidgetConfig('wc-2')).toEqual(showVsTellConfig);
  });
});
