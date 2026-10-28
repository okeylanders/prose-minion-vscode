/**
 * What a started press hears and lands (ADR 2026-10-19 D6; Slice 2B, 4D).
 * Split from `LightboxReadingHandler`, which owns the press: its snapshot,
 * its reservation and its refusals. Holds no service of its own: everything
 * is the handler's, passed in.
 *
 * - **Groups land on their board.** A settled group is written onto the
 *   board by its id through `LightboxService.updateReadings`, its number
 *   usages held to what stands out on the board now, not at the press
 *   (PR #155 F-01); the service publishes it only while that board is
 *   current, and a result for a board that is gone is dropped.
 * - **Nothing is heard before the run is held.** The listener ignores every
 *   callback until the press binds the run the runner started.
 * - **Group F reads the board (Slice 4D).** The press's Opinion port builds
 *   the digest from the board as it stands when F starts, by the board's id,
 *   so it never weighs another board. F's outcome names the digest it read;
 *   when it lands, the board's digest now is compared with it and the
 *   Opinion's standing is checked against the board as it stands, so a late
 *   F whose cited items changed meanwhile lands stale, never current. The
 *   log says which, by key prefix and counts only.
 * - **Kept until replaced (Slice 4J, epic decision 49).** Each lens a call
 *   replaces records this run, the call's model and the time it landed (the
 *   service's clock); a lens it does not replace keeps its earlier reading
 *   (`settleLightboxGroup`). The Opinion's citation basis moves to this
 *   build's rule only when a new Opinion lands, never for a call that left
 *   the earlier one on the board.
 */

import type { LogSink } from '@/platform';
import type { LightboxActiveRun, LightboxLensId, LightboxReadingGroupId, LightboxRunProgress } from '@messages';
import type { LightboxService } from '@/infrastructure/lightbox/LightboxService';
import type { LightboxPressSnapshot } from '@/infrastructure/lightbox/LightboxPressSnapshot';
import type {
  LightboxGroupOutcome,
  LightboxOpinionPort,
  LightboxRunListener
} from '@/infrastructure/lightbox/LightboxReadingRunContracts';
import { holdLightboxNumberUsages } from '@/infrastructure/lightbox/LightboxNumberInstances';
import { settleLightboxGroup } from '@/infrastructure/lightbox/LightboxReadingState';
import { buildLightboxOpinionDigest } from '@/infrastructure/lightbox/LightboxOpinionDigest';
import { lightboxOpinionStanding, lightboxOpinionTile } from '@shared/constants/lightboxOpinion';
import { LIGHTBOX_OPINION_BASIS_RULE_ID } from '@shared/constants/lightboxOpinionBasis';
import { lightboxGroupReadsBoard } from '@shared/constants/lightbox';

/** Writer-facing: the press's board is gone, so F has nothing to weigh. */
const BOARD_GONE = 'The board this press read is gone, so the Opinion was not read.';

export interface LightboxPressRunInputs {
  service: Pick<LightboxService, 'clock' | 'updateReadings'>;
  boardId: string;
  groups: readonly LightboxReadingGroupId[];
  lens: LightboxLensId | undefined;
  press: LightboxPressSnapshot;
  postProgress: (progress: LightboxRunProgress) => void;
  /** The run finished, with `landed` groups written onto its board: its owner forgets it (and saves the board). */
  onFinished: (token: string, landed: number) => void;
  outputChannel: LogSink;
}

export interface LightboxPressRun {
  listener: LightboxRunListener;
  /** Hold the run the runner started; until then the listener hears nothing. */
  bind: (run: LightboxActiveRun) => void;
}

/** The listener a press starts its run with. */
export function lightboxPressRun(inputs: LightboxPressRunInputs): LightboxPressRun {
  const { service, boardId, groups, lens, press, outputChannel } = inputs;
  let started: LightboxActiveRun | undefined;
  let groupsBack = 0;
  // The run's streamed characters so far, as the runner last reported them.
  let outputCharacters = 0;
  const progress = (token: string): LightboxRunProgress => ({
    boardId, token, phase: 'streaming', groups: [...groups], groupsBack, outputCharacters, ...(lens ? { lens } : {})
  });
  const land = (outcome: LightboxGroupOutcome, token: string): boolean => {
    const landing = { run: token, at: new Date(service.clock()).toISOString() };
    // A new Opinion landed: its citations stand under this build's basis rule, and the board says so (Slice 5A).
    // One that did not replace the earlier Opinion leaves its rule as it was (Slice 4J).
    const opinionLanded = lightboxGroupReadsBoard(outcome.group) && outcome.status === 'ok' &&
      outcome.tiles.some((tile) => tile.kind === 'opinion');
    const board = service.updateReadings(
      boardId,
      (readings, current) => readings.map((group) => (group.group === outcome.group
        ? settleLightboxGroup(group, holdLightboxNumberUsages(outcome, press.source.material.numbers, current.measured.numbers.rows), landing)
        : group)),
      { token, group: outcome.group },
      opinionLanded ? { opinionBasis: LIGHTBOX_OPINION_BASIS_RULE_ID } : undefined
    );
    if (!board) {
      outputChannel.appendLine(`[LightboxReadingHandler] Dropped group ${outcome.group}: its board is gone`);
      return false;
    }
    if (outcome.digestKey) {
      // F weighed the digest named; the board may have moved since (a same-text rebuild under a new preset or average).
      const now = buildLightboxOpinionDigest(board).key;
      const opinion = lightboxOpinionTile(board);
      const standing = opinion ? lightboxOpinionStanding(opinion, board) : undefined;
      outputChannel.appendLine(
        `[LightboxReadingHandler] Group F landed on digest ${outcome.digestKey.slice(0, 12)}` +
          (now === outcome.digestKey ? ', the board it read' : `; the board's digest is now ${now.slice(0, 12)}`) +
          (standing ? (standing.stale ? `: stale, ${staleNote(standing.changed.length)}` : ': current') : '')
      );
    }
    return true;
  };
  const listener: LightboxRunListener = {
    onGroup: (outcome) => {
      if (!started || !land(outcome, started.token)) {
        return;
      }
      groupsBack += 1;
      inputs.postProgress(progress(started.token));
    },
    onProgress: (characters) => {
      outputCharacters = characters;
      if (started) {
        inputs.postProgress(progress(started.token));
      }
    },
    onFinished: (summary) => {
      if (!started) {
        return;
      }
      inputs.onFinished(started.token, groupsBack);
      const cost = summary.usage?.costUsd;
      outputChannel.appendLine(
        `[LightboxReadingHandler] Run ${started.token} finished: ${summary.outcomes.length} groups, ` +
          `${summary.usage?.totalTokens ?? 0} tokens${cost !== undefined ? `, $${cost.toFixed(4)}` : ''}`
      );
      inputs.postProgress({ ...progress(started.token), phase: 'finished' });
    }
  };
  return { listener, bind: (run) => { started = run; } };
}

/** How many of a landing Opinion's observations cite something that changed. */
function staleNote(changed: number): string {
  return changed === 1 ? '1 observation cites items that changed' : `${changed} observations cite items that changed`;
}

/**
 * What group F reads in this press: the digest of the board named, as it
 * stands when F starts, never of whichever board is current then.
 */
export function lightboxOpinionPort(service: Pick<LightboxService, 'readingSource'>, boardId: string): LightboxOpinionPort {
  return {
    digest: () => {
      const board = service.readingSource(boardId)?.board;
      return board ? buildLightboxOpinionDigest(board) : { refusal: BOARD_GONE };
    }
  };
}
