/**
 * Which run each board has in flight, as the webview knows it (ADR
 * 2026-10-19 D6; PR #149 F-03). Pure: no React, no transport.
 *
 * Runs continue across source switches, so a retained board's run can
 * stream, finish or stop while another board is on screen. Each board keeps
 * its own run and its latest progress, and a message changes only the board
 * it names, and only for that board's run:
 * - `started` names the board's run (its token and groups);
 * - `streaming`, `finished` and `cancelled` count only under the board's
 *   current token, so a late message from a stopped or replaced run, or from
 *   another board, never moves this board's run line or clears its Stop;
 * - `refused` answers a press on the board and leaves its run as it was;
 * - a current estimate reply is the host's word on the board's run: the run
 *   it names, or none.
 * Stop is built from the board's own run, never from the board on screen
 * paired with whatever token arrived last.
 */

import type { LightboxActiveRun, LightboxRunProgress } from '@messages';

export interface LightboxBoardRun {
  /** The board's run in flight, by its host-minted token. */
  run?: LightboxActiveRun;
  /** The latest progress for this board: its run's own, or a refusal of a press on it. */
  progress?: LightboxRunProgress;
}

export type LightboxRunsByBoard = Readonly<Record<string, LightboxBoardRun>>;

export const NO_LIGHTBOX_RUNS: LightboxRunsByBoard = {};

/** Apply a progress message to the board it names, when it belongs to that board's run. */
export function applyLightboxRunProgress(runs: LightboxRunsByBoard, progress: LightboxRunProgress): LightboxRunsByBoard {
  const entry = runs[progress.boardId] ?? {};
  const ours = progress.token !== undefined && entry.run?.token === progress.token;
  switch (progress.phase) {
    case 'started':
      return progress.token
        ? { ...runs, [progress.boardId]: { run: runOf(progress, progress.token), progress } }
        : runs;
    case 'refused':
      return { ...runs, [progress.boardId]: { ...entry, progress } };
    case 'streaming':
      return ours ? { ...runs, [progress.boardId]: { ...entry, progress } } : runs;
    case 'finished':
    case 'cancelled':
      return ours ? { ...runs, [progress.boardId]: { progress } } : runs;
  }
}

/**
 * The host's word on a board's run, from an estimate reply that is the
 * current one: the run it names (keeping that run's progress), or none.
 */
export function withLightboxBoardRun(
  runs: LightboxRunsByBoard,
  boardId: string,
  run: LightboxActiveRun | undefined
): LightboxRunsByBoard {
  const entry = runs[boardId] ?? {};
  if (run) {
    return entry.run?.token === run.token ? runs : { ...runs, [boardId]: { run } };
  }
  if (!entry.run) {
    return runs;
  }
  const { run: _ended, ...rest } = entry;
  return { ...runs, [boardId]: rest };
}

/** Forget boards that have no run in flight, except the one on screen. */
export function pruneLightboxRuns(runs: LightboxRunsByBoard, keepBoardId: string | undefined): LightboxRunsByBoard {
  const kept = Object.entries(runs).filter(([boardId, entry]) => entry.run || boardId === keepBoardId);
  return kept.length === Object.keys(runs).length ? runs : Object.fromEntries(kept);
}

/** The CANCEL payload for a board's own run, when its token is the one named. */
export function lightboxCancelOf(
  runs: LightboxRunsByBoard,
  boardId: string | undefined,
  token: string
): { boardId: string; token: string } | undefined {
  const run = boardId ? runs[boardId]?.run : undefined;
  return run && run.token === token ? { boardId: run.boardId, token: run.token } : undefined;
}

function runOf(progress: LightboxRunProgress, token: string): LightboxActiveRun {
  return { boardId: progress.boardId, token, groups: progress.groups, ...(progress.lens ? { lens: progress.lens } : {}) };
}
