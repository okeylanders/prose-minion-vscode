/** Creative Variations' compact, deterministic one-shot artifact projection. */

import type {
  WorkshopCreativeVariationCard,
  WorkshopCreativeVariationsDraft,
  WorkshopCreativeVariationsSelection
} from '@messages';

const section = (heading: string, lines: readonly string[]): string =>
  `${heading}\n${lines.join('\n')}`;

const selectedCard = (
  draft: WorkshopCreativeVariationsDraft,
  selection: WorkshopCreativeVariationsSelection
): WorkshopCreativeVariationCard => {
  const card = draft.workup?.cards.find(
    (candidate) => candidate.position === selection.position
  );
  if (!card) {
    throw new Error(`Selected take ${selection.position} is not in the current workup.`);
  }
  return card;
};

/**
 * The sole artifact formula used by host commit and webview budget display.
 * It deliberately excludes the source passage, unselected cards, tradeoffs,
 * overlap evidence, provenance, and every unaccepted risk.
 */
export function buildCreativeVariationsArtifact(
  draft: WorkshopCreativeVariationsDraft
): string {
  const sections: string[] = [];

  const selectedTakes = draft.selections.map((selection) => {
    const card = selectedCard(draft, selection);
    const label = selection.carryMode === 'full-prose'
      ? `Take ${selection.position} — full prose:`
      : `Take ${selection.position} — direction:`;
    const content = selection.carryMode === 'full-prose'
      ? card.prose.trim()
      : card.direction.trim();
    return `${label}\n${content}`;
  });
  sections.push(section('Creative Variations — selected takes', selectedTakes));

  const invariants: string[] = [];
  if (draft.invariants.mustSurvive.trim().length > 0) {
    invariants.push(`Must survive: ${draft.invariants.mustSurvive.trim()}`);
  }
  if (draft.invariants.mustNotChange.trim().length > 0) {
    invariants.push(`Must not change: ${draft.invariants.mustNotChange.trim()}`);
  }
  if (invariants.length > 0) {
    sections.push(section('Writer-declared invariants', invariants));
  }

  const acceptedRisks = draft.selections.flatMap((selection) => {
    const card = selectedCard(draft, selection);
    const acceptedIds = new Set(selection.acceptedAdvisoryRiskIds);
    return card.invariantFlags
      .filter((flag) => flag.kind === 'advisory-risk' && acceptedIds.has(flag.id))
      .map((flag) => `Take ${selection.position}: ${flag.note.trim()}`);
  });
  if (acceptedRisks.length > 0) {
    sections.push(section('Accepted advisory risks', acceptedRisks));
  }

  if (draft.note.trim().length > 0) {
    sections.push(section('Writer note', [draft.note.trim()]));
  }

  return sections.join('\n\n');
}
