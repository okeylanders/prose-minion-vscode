/**
 * Presentation adapter for the Conversation Widgets registry
 * (ADR 2026-07-22 decision 14): the canonical catalog — ids, labels, rails,
 * groups, blurbs, `live` availability — is shared/constants/workshopWidgets.ts,
 * which handlers validate against. This module owns only what the webview
 * adds: icons and the mapping into the sheet
 * browser's card types. The dependency points presentation → shared, never
 * the other way.
 */

import { WorkshopWidgetId } from '@messages';
import {
  WORKSHOP_WIDGET_CATALOG,
  WorkshopWidgetDescriptor
} from '@shared/constants/workshopWidgets';
import { IconName } from '@components/shared/Icon';
import { WorkshopSheetGroup, WorkshopSheetItem } from './WorkshopSheetBrowser';

export const WORKSHOP_WIDGET_ICONS: Readonly<Record<WorkshopWidgetId, IconName>> = {
  'gesture-playground': 'hand',
  'show-vs-tell': 'eye',
  'creative-variations': 'branch',
  'topic-relationship': 'link',
  'genre-relationship': 'cards',
  'writers-dictionary': 'search',
  'lexical-gravity': 'orbit',
  'prose-controller': 'sliders',
  'lens-blending': 'scale',
  'learner-english': 'cap',
  'learner-craft': 'book',
  decisions: 'stamp',
  'scratch-pad': 'doc'
};

const sheetItem = (widget: WorkshopWidgetDescriptor): WorkshopSheetItem => ({
  id: widget.id,
  icon: WORKSHOP_WIDGET_ICONS[widget.id],
  name: widget.label,
  tag: { label: widget.railLabel, kind: widget.rail },
  metaTag: widget.tag,
  lifecycleNote: widget.lifecycleNote,
  blurb: widget.blurb,
  unavailable: !widget.live,
  unavailableLabel: 'Coming soon'
});

const HOME_GROUPS: readonly WorkshopSheetGroup[] = WORKSHOP_WIDGET_CATALOG.map((group) => ({
    name: group.name,
    desc: group.description,
    items: group.items.map(sheetItem)
  }));

/** The browser's card deck, including the design's duplicated live shortcut row. */
export const WORKSHOP_WIDGET_GROUPS: readonly WorkshopSheetGroup[] = [
  {
    name: 'Ready now',
    desc: 'Built and playable today — each also lives in its home section below.',
    items: WORKSHOP_WIDGET_CATALOG.flatMap((group) => group.items)
      .filter((widget) => widget.live)
      .map(sheetItem)
  },
  ...HOME_GROUPS
];
