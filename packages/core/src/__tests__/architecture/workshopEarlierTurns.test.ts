/**
 * Boundary guards for a long room's earlier turns (ADR 2026-11-17 D2, D4, D5):
 *
 * - the snapshot window and a page build their per-turn parts through one
 *   function, and nothing else in the aggregate asks for bubble verdicts,
 *   reaction summaries or widget-config summaries;
 * - the webview's modules import no rule that could work out a verdict: a
 *   page's `turnRewindability` is copied, never derived;
 * - the route owner is a read: it names no mutation, save or session-state
 *   effect;
 * - each new module stays under 500 lines.
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC_ROOT = path.resolve(__dirname, '..', '..');
const read = (relative: string) => fs.readFileSync(path.join(SRC_ROOT, relative), 'utf8');
const importsOf = (source: string): string[] =>
  [...source.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)].map((match) => match[1]).sort();

const SERVICE = 'application/services/workshop/WorkshopSessionService.ts';
const PARTS = 'application/services/workshop/session/WorkshopThreadTurnParts.ts';
const HANDLER = 'application/handlers/domain/workshop/WorkshopEarlierTurnsHandler.ts';
const HOOK = 'presentation/webview/hooks/domain/workshop/useWorkshopEarlierTurns.ts';
const RUN = 'presentation/webview/hooks/domain/workshop/earlierTurns/workshopEarlierTurnsRun.ts';
const CONTROL = 'presentation/webview/components/workshop/WorkshopEarlierTurnsControl.tsx';
const SCROLL_HOLD = 'presentation/webview/utils/workshopThreadScrollHold.ts';
const WEBVIEW_MODULES = [HOOK, RUN, CONTROL, SCROLL_HOLD];

describe('earlier turns: one projection (D2)', () => {
  const service = read(SERVICE);
  const count = (pattern: RegExp) => (service.match(pattern) ?? []).length;

  it('asks for bubble verdicts, reaction summaries and widget summaries in one place', () => {
    expect(count(/\.bubbleRewindability\(/g)).toBe(1);
    expect(count(/reactionLedger\.summaries\(/g)).toBe(1);
    expect(count(/widgetConfigLedger\.summariesFor\(/g)).toBe(1);
    const shared = service.slice(service.indexOf('private threadTurnParts('), service.indexOf('readEarlierTurns('));
    expect(shared).toMatch(/\.bubbleRewindability\(/);
    expect(shared).toMatch(/reactionLedger\.summaries\(/);
    expect(shared).toMatch(/widgetConfigLedger\.summariesFor\(/);
  });

  it('builds the snapshot window and a page through it', () => {
    const page = service.slice(service.indexOf('readEarlierTurns('), service.indexOf('getSnapshot(): WorkshopSessionSnapshot'));
    const snapshot = service.slice(service.indexOf('getSnapshot(): WorkshopSessionSnapshot'));
    expect(page).toMatch(/this\.threadTurnParts\(page\.turns\)/);
    expect(snapshot).toMatch(/this\.threadTurnParts\(\s*windowed,/);
    expect(count(/this\.threadTurnParts\(/g)).toBe(2);
  });

  it('keeps the projection free of ledgers and policies: the aggregate supplies them', () => {
    expect(importsOf(read(PARTS))).toEqual(['@messages']);
  });
});

describe('earlier turns: the webview derives nothing (D2, D5)', () => {
  it('imports only messages, the shared model-slice seed, the budgets and its own modules', () => {
    expect(importsOf(read(RUN))).toEqual(['@messages', '@shared/workshop/workshopModelSlices']);
    expect(importsOf(read(HOOK))).toEqual([
      '@hooks/domain/workshop/earlierTurns/workshopEarlierTurnsRun',
      '@hooks/useVSCodeApi',
      '@messages',
      '@shared/constants/promptBudgets',
      '@shared/workshop/workshopModelSlices',
      'react'
    ]);
    expect(importsOf(read(CONTROL))).toEqual([
      '@hooks/domain/workshop/useWorkshopEarlierTurns',
      '@utils/workshopThreadScrollHold',
      'react'
    ]);
    expect(importsOf(read(SCROLL_HOLD))).toEqual([]);
  });

  it('names no rewind rule: a verdict is only ever copied from a page or a snapshot', () => {
    const offenders = WEBVIEW_MODULES.filter((file) =>
      /RewindPolicy|bubbleRewindability|workshopBubbleCut|workshopRewind|rewindCutForBubble|available:\s*(?:true|false)/.test(read(file)));
    expect(offenders).toEqual([]);
  });

  it('only the hook posts, and the control and the run post nothing', () => {
    expect(read(HOOK)).toMatch(/MessageType\.WORKSHOP_REQUEST_EARLIER_TURNS/);
    for (const file of [RUN, CONTROL, SCROLL_HOLD]) {
      expect(read(file)).not.toMatch(/\b(?:postMessage|useVSCodeApi|MessageType|acquireVsCodeApi)\b/);
    }
  });

  it('keeps nothing in browser or webview storage', () => {
    for (const file of WEBVIEW_MODULES) {
      expect(read(file)).not.toMatch(/\b(?:setState\(\{|localStorage|sessionStorage|usePersistence|usePersistedState)\b/);
    }
  });
});

describe('earlier turns: the route owner is a read (D4)', () => {
  // The code alone: the comments name the effects it does not have.
  const handler = read(HANDLER).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('names no mutation, save or session-state effect', () => {
    expect(handler).not.toMatch(
      /\b(?:registerMutation|WorkshopMutationRouteRegistrar|markDirty|postSessionState|flush|saveNamed|writeCurrent|beginInteraction|runContextRefresh)\b/
    );
    expect(handler).toMatch(/router\.register\(\s*MessageType\.WORKSHOP_REQUEST_EARLIER_TURNS/);
  });

  it('checks the room before it reads the ledger', () => {
    expect(handler.indexOf('readRoomRevision()')).toBeGreaterThan(0);
    expect(handler.indexOf('readRoomRevision()')).toBeLessThan(handler.indexOf('readEarlierTurns('));
    expect(handler).not.toMatch(/readRoomLedger\(|getSnapshot\(/);
  });

  it('imports no sibling route owner', () => {
    expect(importsOf(handler).filter((module) => /@handlers\/domain\/workshop\/Workshop\w+Handler$/.test(module))).toEqual([]);
  });
});

describe('earlier turns: module size', () => {
  it('keeps each new module under 500 lines', () => {
    const tooLong = [PARTS, HANDLER, ...WEBVIEW_MODULES].filter((file) => read(file).split('\n').length > 500);
    expect(tooLong).toEqual([]);
  });
});
