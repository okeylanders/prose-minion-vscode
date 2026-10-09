/**
 * Show vs. Tell's deterministic artifact projection (Sprint 05, Slice 3).
 *
 * This is the sole formula for the counted `widget:show-vs-tell` artifact
 * body. The webview meter and (from Slice 4) the host's commit re-check both
 * call it, so the number the writer watches is the number the host enforces.
 * It is pure and webview-safe: it imports no codec, no integrity module, and
 * no workup-id factory (which pulls in `node:crypto`).
 *
 * What it counts is frozen by the sprint: the `beat:`, `position:`,
 * `must survive:`, optional `must not change:`, one `keep:` or `direction:`
 * line per kept variant in workup order, and an optional `note:`, each with
 * its key, joined by `\n`. It excludes the host-minted `<thread-artifact>`
 * envelope and the host-appended invariant warning lines (the writer cannot
 * shorten a model's warning, so it must never be why commit is blocked), and it
 * never carries unkept variants, craft notes, the readout, channels, length
 * budget, POV, or the surrounding passage.
 */

import {
  SHOW_VS_TELL_ARTIFACT_LINE_KEYS,
  type WorkshopShowVsTellDraft
} from '@messages';
import {
  encodeShowVsTellArtifactValue,
  showVsTellPositionArtifactValue,
  showVsTellWorkupVariants
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellDerivations';

// The encoder is owned by the Derivations so the direction rule measures with
// the very function the projection writes with; re-exported for callers of the projection.
export {
  SHOW_VS_TELL_ARTIFACT_LINE_BREAK,
  encodeShowVsTellArtifactValue
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellDerivations';

/** The authored fields the projection reads; a draft satisfies it structurally. */
export type ShowVsTellArtifactSource = Pick<
  WorkshopShowVsTellDraft,
  'beat' | 'position' | 'invariants' | 'workup' | 'kept' | 'note'
>;

const line = (key: string, value: string): string => `${key} ${value}`;

/** Compiles the counted artifact body. Throws when a kept variant is not in the workup. */
export function buildShowVsTellArtifact(draft: ShowVsTellArtifactSource): string {
  const keys = SHOW_VS_TELL_ARTIFACT_LINE_KEYS;
  const lines = [
    line(keys.beat, `"${encodeShowVsTellArtifactValue(draft.beat.text)}"`),
    line(keys.position, showVsTellPositionArtifactValue(draft.position)),
    line(keys.mustSurvive, encodeShowVsTellArtifactValue(draft.invariants.mustSurvive))
  ];
  const mustNotChange = encodeShowVsTellArtifactValue(draft.invariants.mustNotChange);
  if (mustNotChange.length > 0) {
    lines.push(line(keys.mustNotChange, mustNotChange));
  }

  const variants = draft.workup ? showVsTellWorkupVariants(draft.workup) : [];
  // Workup order, not keep order: the host stores kept variants sorted, but
  // the projection must not depend on that.
  const carryById = new Map(draft.kept.map((kept) => [kept.variantId, kept.carryMode]));
  for (const kept of draft.kept) {
    if (!variants.some((variant) => variant.id === kept.variantId)) {
      throw new Error(`Kept variant ${kept.variantId} is not in the current workup.`);
    }
  }
  for (const variant of variants) {
    const carryMode = carryById.get(variant.id);
    if (carryMode === undefined) {
      continue;
    }
    lines.push(
      carryMode === 'prose'
        ? line(keys.keep, `"${encodeShowVsTellArtifactValue(variant.prose)}"`)
        : line(keys.direction, encodeShowVsTellArtifactValue(variant.direction))
    );
  }

  const note = encodeShowVsTellArtifactValue(draft.note);
  if (note.length > 0) {
    lines.push(line(keys.note, note));
  }
  return lines.join('\n');
}

/** Characters the counted body occupies; the same `.length` measure Creative Variations uses. */
export function showVsTellArtifactLength(draft: ShowVsTellArtifactSource): number {
  return buildShowVsTellArtifact(draft).length;
}
