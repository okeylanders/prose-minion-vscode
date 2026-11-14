/**
 * Selected Text test fixtures: a fake of the editor port's two members, and
 * a selection from "Alice's Adventures in Wonderland" (1865, public domain).
 */

import type { ActiveSelectionInfo, EditorContext, LogSink, PlatformDisposable } from '@/platform';

export const ALICE_PATH = 'alice-ch3.md';
export const ALICE_TEXT =
  'The Caterpillar and Alice looked at each other for some time in silence:\n' +
  'at last the Caterpillar took the hookah out of its mouth, and addressed her in a languid, sleepy voice.';
/** Words only the fixture's text holds: what a log, a message or a transcript must never carry. */
export const ALICE_TEXT_MARKS = ['Caterpillar', 'hookah', 'languid'] as const;

export function aliceSelection(overrides: Partial<ActiveSelectionInfo> = {}): ActiveSelectionInfo {
  return {
    text: ALICE_TEXT,
    isEmpty: false,
    uriString: 'file:///novel/alice-ch3.md',
    fsPath: '/novel/alice-ch3.md',
    relativePath: ALICE_PATH,
    startLine: 40,
    endLine: 44,
    ...overrides
  };
}

/** The port's `currentSelection` and `onDidChangeSelection`, driven by hand. */
export class FakeEditorSelection implements Pick<EditorContext, 'currentSelection' | 'onDidChangeSelection'> {
  private current: ActiveSelectionInfo | undefined;
  private readonly registered = new Set<() => void>();

  currentSelection(): ActiveSelectionInfo | undefined {
    return this.current;
  }

  onDidChangeSelection(listener: () => void): PlatformDisposable {
    this.registered.add(listener);
    return { dispose: () => { this.registered.delete(listener); } };
  }

  /** Set the selection without an event (what a command's gesture reads). */
  select(selection: ActiveSelectionInfo | undefined): void {
    this.current = selection;
  }

  /** Set the selection and fire the raw event. */
  change(selection: ActiveSelectionInfo | undefined): void {
    this.current = selection;
    Array.from(this.registered).forEach((listener) => listener());
  }

  listeners(): number {
    return this.registered.size;
  }
}

/** A log that keeps its lines, for the tests that grep them. */
export function recordingLog(): LogSink & { lines: string[] } {
  const lines: string[] = [];
  return {
    lines,
    appendLine: (line: string) => { lines.push(line); },
    show: () => undefined,
    clear: () => undefined
  };
}
