/**
 * The Conversation Widgets preview registry — presentation-only data for the
 * Sprint 14 "coming soon" browser, ported from the 2026-07-26 design drop
 * (docs/design/pm-widgets.js `CW_WIDGETS`). Nothing here is wired: the
 * Widgets epic that follows the Workshop release implements these surfaces.
 * Kept beside the modal (not in shared constants) because no handler routes
 * from it — it is a preview card deck, not a contract.
 */

import { WorkshopSheetGroup, WorkshopSheetTag } from './WorkshopSheetBrowser';

const ONE_SHOT: WorkshopSheetTag = { label: 'one-shot', kind: 'oneshot' };
const STANDING: WorkshopSheetTag = { label: 'standing', kind: 'standing' };
const RESOURCE: WorkshopSheetTag = { label: 'resource', kind: 'resource' };

const COST_NOTES: Record<WorkshopSheetTag['kind'], string> = {
  oneshot: 'plays free — commits exactly one turn',
  standing: 'pins to the room — rides every turn until unpinned',
  resource: 'durable — persists across sessions'
};

const costNote = (tag: WorkshopSheetTag): string => COST_NOTES[tag.kind];

export const WORKSHOP_WIDGET_GROUPS: readonly WorkshopSheetGroup[] = [
  {
    name: 'Playgrounds',
    desc: 'Play a beat before anything commits — generate, keep what lands, commit once.',
    items: [
      {
        id: 'gesture',
        icon: 'hand',
        name: 'Gesture Playground',
        tag: ONE_SHOT,
        costNote: costNote(ONE_SHOT),
        blurb:
          'One model call returns a menu of gesture directions for a phrase — keep the ones you want, commit them to the room.'
      },
      {
        id: 'show-vs-tell',
        icon: 'eye',
        name: 'Show vs. Tell Playground',
        tag: ONE_SHOT,
        costNote: costNote(ONE_SHOT),
        blurb: 'Recast a told beat as shown alternatives; keep the ones that land.'
      },
      {
        id: 'creative-variations',
        icon: 'branch',
        name: 'Creative Variations Explorer',
        tag: ONE_SHOT,
        costNote: costNote(ONE_SHOT),
        blurb:
          'Three to five genuinely different takes on a passage under invariants you declare — measured for distinctness, compared side by side.'
      }
    ]
  },
  {
    name: 'Explorers',
    desc: 'Derive a relationship — typed, span-anchored, graded for resemblance, never quality.',
    items: [
      {
        id: 'topic-relationship',
        icon: 'link',
        name: 'Topic Relationship Explorer',
        tag: ONE_SHOT,
        costNote: costNote(ONE_SHOT),
        blurb:
          'Name a topic — a thinker, a framework, a tradition — and derive its relationship to the passage as a typed dossier: span-anchored points of contact, graded grounding, where the lens distorts, one question.'
      },
      {
        id: 'genre-relationship',
        icon: 'cards',
        name: 'Genre Relationship Explorer',
        tag: ONE_SHOT,
        costNote: costNote(ONE_SHOT),
        blurb:
          'Survey a chapter for the genres it’s in conversation with, then take one apart tell by tell — expectation against span-anchored evidence: matches, departs, subverts.'
      }
    ]
  },
  {
    name: 'Influences',
    desc: 'Standing surfaces — pinned to the room, weighing on every turn until unpinned.',
    items: [
      {
        id: 'lexical-gravity',
        icon: 'orbit',
        name: 'Lexical Gravity',
        tag: STANDING,
        costNote: costNote(STANDING),
        blurb:
          'Pull the passage’s lexis toward an interpretive lens — Photography, Mathematics, Music — with weight and reach.'
      },
      {
        id: 'prose-controller',
        icon: 'sliders',
        name: 'Prose Controller',
        tag: STANDING,
        costNote: costNote(STANDING),
        blurb:
          'How the passage is made: diction, sentence architecture, rhythm, density, figurative texture, punctuation.'
      },
      {
        id: 'lens-blending',
        icon: 'scale',
        name: 'Gravity: Lens Blending',
        tag: STANDING,
        costNote: costNote(STANDING),
        blurb: 'Blend multiple lenses with explicit dominance weighting — never an unweighted average.'
      }
    ]
  },
  {
    name: 'Learners',
    desc: 'Curriculum packs over your own pages — learn, inspect, practise, bring back a question.',
    items: [
      {
        id: 'learner-english',
        icon: 'cap',
        name: 'Learner: English & Writing',
        tag: ONE_SHOT,
        costNote: costNote(ONE_SHOT),
        blurb:
          'The Learner shell with a Working English pack — parse the passage, see what is a rule and what is a choice, bring back a question.'
      },
      {
        id: 'learner-craft',
        icon: 'book',
        name: 'Learner: The Storytelling Craft',
        tag: ONE_SHOT,
        costNote: costNote(ONE_SHOT),
        blurb:
          'The Learner shell with a storytelling-craft curriculum pack — learn, inspect the passage, practise, and bring back only what was useful.'
      }
    ]
  },
  {
    name: 'Resources',
    desc: 'Durable records — they outlive the session and every one-shot around them.',
    items: [
      {
        id: 'decisions',
        icon: 'stamp',
        name: 'Decisions',
        tag: RESOURCE,
        costNote: costNote(RESOURCE),
        blurb: 'Append-only decision record; a deterministic scan assembles the running list.'
      },
      {
        id: 'scratch-pad',
        icon: 'doc',
        name: 'Project Scratch Pad',
        tag: RESOURCE,
        costNote: costNote(RESOURCE),
        blurb: 'Durable project notes; each append also leaves a visible thread event.'
      }
    ]
  }
];
