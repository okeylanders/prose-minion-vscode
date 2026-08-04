/**
 * The Conversation Widgets registry — the single deterministic source for
 * widget ids ↔ labels ↔ rails ↔ availability (ADR 2026-07-22, decision 14).
 * The webview browser renders from it, WorkshopGesturePlaygroundHandler validates
 * commits against it, and the thread-artifact frame's `kind` attribute is
 * derived from it — so none of the three can drift, and the LLM never names
 * buttons. Icons are presentation-only and stay in the webview layer
 * (workshopWidgetIcons pattern, mirroring workshopTools.ts).
 *
 * Unshipped widgets stay listed and `live: false`: the browser is a roadmap,
 * not a lie (design Spread 00). The persona-recommendation parser rejects
 * ids that are not live, so comp-only widgets can never render dead chips.
 */

import { WorkshopWidgetId } from '../types/messages/workshop';

export type WorkshopWidgetRail = 'oneshot' | 'standing' | 'resource';

export const LEXICAL_GRAVITY_WEIGHT = Object.freeze({
  minimum: 10,
  maximum: 100,
  step: 5
});

export const LEXICAL_GRAVITY_REACH = Object.freeze({
  minimum: 1,
  maximum: 3,
  values: [1, 2, 3] as const
});

export function isLexicalGravityWeight(value: unknown): value is number {
  return Number.isSafeInteger(value)
    && (value as number) >= LEXICAL_GRAVITY_WEIGHT.minimum
    && (value as number) <= LEXICAL_GRAVITY_WEIGHT.maximum
    && (value as number) % LEXICAL_GRAVITY_WEIGHT.step === 0;
}

export function isLexicalGravityReach(value: unknown): value is 1 | 2 | 3 {
  return LEXICAL_GRAVITY_REACH.values.some((candidate) => candidate === value);
}

export type WorkshopWidgetGroupName =
  | 'Playgrounds'
  | 'Explorers'
  | 'References'
  | 'Influences'
  | 'Learners'
  | 'Resources';

export interface WorkshopWidgetDescriptor {
  readonly id: WorkshopWidgetId;
  readonly label: string;
  readonly rail: WorkshopWidgetRail;
  /** Rail badge text shown on the card (rail plus any qualifier). */
  readonly railLabel: string;
  readonly group: WorkshopWidgetGroupName;
  /** Sprint tag or `concept` — the roadmap chip on the card. */
  readonly tag: string;
  /** How the widget joins the room and how long its committed state remains. */
  readonly lifecycleNote: string;
  readonly blurb: string;
  /** Only live widgets may launch, commit, or be persona-recommended. */
  readonly live: boolean;
}

export interface WorkshopWidgetGroupDescriptor {
  readonly name: WorkshopWidgetGroupName;
  readonly description: string;
  readonly items: readonly WorkshopWidgetDescriptor[];
}

const ONE_SHOT_LIFECYCLE = 'play first · commit adds one turn';
const STANDING_LIFECYCLE = 'stays with the room until unpinned';
const RESOURCE_LIFECYCLE = 'durable · persists across sessions';

export const WORKSHOP_WIDGET_CATALOG: readonly WorkshopWidgetGroupDescriptor[] = [
  {
    name: 'Playgrounds',
    description: 'Play a beat before anything commits — generate, keep what lands, commit once.',
    items: [
      {
        id: 'gesture-playground',
        label: 'Gesture Playground',
        rail: 'oneshot',
        railLabel: 'one-shot',
        group: 'Playgrounds',
        tag: 'Sprint 01',
        lifecycleNote: ONE_SHOT_LIFECYCLE,
        blurb:
          'One model call explores the gesture’s lexical and embodied field, then returns creative alternatives — read the dictionary, keep what lands, and commit your choices to the room.',
        live: true
      },
      {
        id: 'show-vs-tell',
        label: 'Show vs. Tell Playground',
        rail: 'oneshot',
        railLabel: 'one-shot',
        group: 'Playgrounds',
        tag: 'concept',
        lifecycleNote: ONE_SHOT_LIFECYCLE,
        blurb: 'Recast a told beat as shown alternatives; keep the ones that land.',
        live: false
      },
      {
        id: 'creative-variations',
        label: 'Creative Variations Explorer',
        rail: 'oneshot',
        railLabel: 'one-shot',
        group: 'Playgrounds',
        tag: 'concept',
        lifecycleNote: ONE_SHOT_LIFECYCLE,
        blurb:
          'Three to five genuinely different takes on a passage under invariants you declare — measured for distinctness, compared side by side.',
        live: false
      }
    ]
  },
  {
    name: 'Explorers',
    description: 'Derive a relationship — typed, span-anchored, graded for resemblance, never quality.',
    items: [
      {
        id: 'topic-relationship',
        label: 'Topic Relationship Explorer',
        rail: 'oneshot',
        railLabel: 'one-shot',
        group: 'Explorers',
        tag: 'concept',
        lifecycleNote: ONE_SHOT_LIFECYCLE,
        blurb:
          'Name a topic — a thinker, a framework, a tradition — and derive its relationship to the passage as a typed dossier: span-anchored points of contact, graded grounding, where the lens distorts, one question.',
        live: false
      },
      {
        id: 'genre-relationship',
        label: 'Genre Relationship Explorer',
        rail: 'oneshot',
        railLabel: 'one-shot',
        group: 'Explorers',
        tag: 'concept',
        lifecycleNote: ONE_SHOT_LIFECYCLE,
        blurb:
          'Survey a chapter for the genres it’s in conversation with, then take one apart tell by tell — expectation against span-anchored evidence: matches, departs, subverts.',
        live: false
      }
    ]
  },
  {
    name: 'References',
    description: 'Look something up — one call, one document, nothing to curate.',
    items: [
      {
        id: 'writers-dictionary',
        label: 'Writer’s Dictionary',
        rail: 'oneshot',
        railLabel: 'one-shot · report',
        group: 'References',
        tag: 'concept',
        lifecycleNote: 'Run posts the complete report as one turn',
        blurb:
          'One word or phrase, and the whole lexical field comes back as a document: senses, register, texture, collocations, voices, soundplay, watchpoints — plus a menu tuned to your scene if you supply context. The report is the artifact; nothing here stands.',
        live: false
      }
    ]
  },
  {
    name: 'Influences',
    description: 'Standing surfaces — pinned to the room, weighing on every turn until unpinned.',
    items: [
      {
        id: 'lexical-gravity',
        label: 'Lexical Gravity',
        rail: 'standing',
        railLabel: 'standing',
        group: 'Influences',
        tag: 'Sprint 02B',
        lifecycleNote: STANDING_LIFECYCLE,
        blurb:
          'Pull the passage’s lexis toward an interpretive lens — Photography, Mathematics, Music — with weight and reach.',
        live: true
      },
      {
        id: 'prose-controller',
        label: 'Prose Controller',
        rail: 'standing',
        railLabel: 'standing',
        group: 'Influences',
        tag: 'Sprint 03',
        lifecycleNote: STANDING_LIFECYCLE,
        blurb:
          'How the passage is made: diction, sentence architecture, rhythm, density, figurative texture, punctuation.',
        live: false
      },
      {
        id: 'lens-blending',
        label: 'Gravity: Lens Blending',
        rail: 'standing',
        railLabel: 'standing',
        group: 'Influences',
        tag: 'Sprint 04',
        lifecycleNote: STANDING_LIFECYCLE,
        blurb: 'Blend multiple lenses with explicit dominance weighting — never an unweighted average.',
        live: false
      }
    ]
  },
  {
    name: 'Learners',
    description: 'Curriculum packs over your own pages — learn, inspect, practise, bring back a question.',
    items: [
      {
        id: 'learner-english',
        label: 'Learner: English & Writing',
        rail: 'oneshot',
        railLabel: 'one-shot',
        group: 'Learners',
        tag: 'concept',
        lifecycleNote: ONE_SHOT_LIFECYCLE,
        blurb:
          'The Learner shell with a Working English pack — parse the passage, see what is a rule and what is a choice, bring back a question.',
        live: false
      },
      {
        id: 'learner-craft',
        label: 'Learner: The Storytelling Craft',
        rail: 'oneshot',
        railLabel: 'one-shot',
        group: 'Learners',
        tag: 'concept',
        lifecycleNote: ONE_SHOT_LIFECYCLE,
        blurb:
          'The Learner shell with a storytelling-craft curriculum pack — learn, inspect the passage, practise, and bring back only what was useful.',
        live: false
      }
    ]
  },
  {
    name: 'Resources',
    description: 'Durable records — they outlive the session and every one-shot around them.',
    items: [
      {
        id: 'decisions',
        label: 'Decisions',
        rail: 'resource',
        railLabel: 'resource',
        group: 'Resources',
        tag: 'concept',
        lifecycleNote: RESOURCE_LIFECYCLE,
        blurb: 'Append-only decision record; a deterministic scan assembles the running list.',
        live: false
      },
      {
        id: 'scratch-pad',
        label: 'Project Scratch Pad',
        rail: 'resource',
        railLabel: 'resource',
        group: 'Resources',
        tag: 'concept',
        lifecycleNote: RESOURCE_LIFECYCLE,
        blurb: 'Durable project notes; each append also leaves a visible thread event.',
        live: false
      }
    ]
  }
];

const WIDGETS_BY_ID: ReadonlyMap<WorkshopWidgetId, WorkshopWidgetDescriptor> = new Map(
  WORKSHOP_WIDGET_CATALOG.flatMap((group) => group.items.map((widget) => [widget.id, widget]))
);

/** Descriptor lookup; undefined for ids this build does not know. */
export function workshopWidgetDescriptor(id: WorkshopWidgetId): WorkshopWidgetDescriptor | undefined {
  return WIDGETS_BY_ID.get(id);
}

/** Display label for a widget id; falls back to the raw id for forward compat. */
export function workshopWidgetLabel(id: WorkshopWidgetId): string {
  return WIDGETS_BY_ID.get(id)?.label ?? id;
}

/** True when the wire value names a widget this build knows about. */
export function isWorkshopWidgetId(value: unknown): value is WorkshopWidgetId {
  return typeof value === 'string' && WIDGETS_BY_ID.has(value as WorkshopWidgetId);
}

/** True when the widget may launch, commit, or be persona-recommended. */
export function isLiveWorkshopWidgetId(value: unknown): value is WorkshopWidgetId {
  return isWorkshopWidgetId(value) && WIDGETS_BY_ID.get(value)!.live === true;
}

/**
 * The thread-artifact frame `kind` for a widget commit, derived mechanically
 * so the registry check on the frame builder means something
 * (ADR 2026-07-22, Sprint 01 concretions). Never interpolate a caller string.
 */
export function workshopWidgetArtifactKind(id: WorkshopWidgetId): string {
  return `widget:${id}`;
}

/** Reverse of workshopWidgetArtifactKind; undefined for non-widget kinds. */
export function workshopWidgetIdFromArtifactKind(kind: string): WorkshopWidgetId | undefined {
  if (!kind.startsWith('widget:')) {
    return undefined;
  }
  const id = kind.slice('widget:'.length);
  return isWorkshopWidgetId(id) ? id : undefined;
}
