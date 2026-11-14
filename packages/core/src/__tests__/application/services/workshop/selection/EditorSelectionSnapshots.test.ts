/**
 * EditorSelectionSnapshots (ADR 2026-11-14 D11, D15): one selection has one
 * id, the newest eight are kept, a selection over the bound is cut at
 * capture, and a watcher hears at most one selection per interval with the
 * trailing edge. The port is a fake; no VS Code. The text is from "Alice's
 * Adventures in Wonderland" (1865, public domain).
 */

import {
  cutToSelectedTextBound,
  EditorSelectionSnapshots
} from '@/application/services/workshop/selection/EditorSelectionSnapshots';
import {
  workshopSelectedTextPreview,
  workshopSelectedTextSummary
} from '@/application/services/workshop/selection/WorkshopSelectedTextAttachment';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { ActiveSelectionInfo } from '@/platform';
import { FakeEditorSelection, aliceSelection, ALICE_PATH, ALICE_TEXT, recordingLog } from './selectedTextFixtures';

const BOUNDS = PROMPT_BUDGETS.workshopSelectedText;

function setup() {
  const editor = new FakeEditorSelection();
  const log = recordingLog();
  let minted = 0;
  const snapshots = new EditorSelectionSnapshots(editor, log, { mintId: () => `snap-${++minted}` });
  return { editor, log, snapshots };
}

describe('EditorSelectionSnapshots.capture', () => {
  it('captures the selection with its display path, lines and word count', () => {
    const { editor, snapshots } = setup();
    editor.select(aliceSelection());
    expect(snapshots.capture()).toEqual({
      id: 'snap-1',
      text: ALICE_TEXT,
      displayPath: ALICE_PATH,
      startLine: 40,
      endLine: 44,
      words: ALICE_TEXT.split(/\s+/).length
    });
  });

  it('reports nothing for no editor, a closed document, an empty selection or only white space', () => {
    const { editor, snapshots } = setup();
    expect(snapshots.capture()).toBeUndefined();
    editor.select(aliceSelection({ text: '', isEmpty: true, startLine: undefined, endLine: undefined }));
    expect(snapshots.capture()).toBeUndefined();
    editor.select(aliceSelection({ text: '  \n ' }));
    expect(snapshots.capture()).toBeUndefined();
    editor.select(undefined);
    expect(snapshots.capture()).toBeUndefined();
  });

  it('keeps one id for one selection, and mints another when the lines, the text or the document change', () => {
    const { editor, snapshots } = setup();
    editor.select(aliceSelection());
    const first = snapshots.capture()!;
    expect(snapshots.capture()).toBe(first);

    editor.select(aliceSelection({ startLine: 41, endLine: 45 }));
    expect(snapshots.capture()!.id).toBe('snap-2');
    editor.select(aliceSelection({ startLine: 41, endLine: 45, text: `${ALICE_TEXT} Who are you?` }));
    expect(snapshots.capture()!.id).toBe('snap-3');
    editor.select(aliceSelection({ startLine: 41, endLine: 45, text: `${ALICE_TEXT} Who are you?`, uriString: 'file:///novel/alice-ch4.md' }));
    expect(snapshots.capture()!.id).toBe('snap-4');
    // Only the newest is compared: going back to the first selection is a new snapshot.
    editor.select(aliceSelection());
    expect(snapshots.capture()!.id).toBe('snap-5');
    expect(snapshots.find('snap-1')).toBe(first);
  });

  it('keeps the newest eight: the ninth capture evicts the first', () => {
    const { editor, snapshots } = setup();
    for (let line = 1; line <= BOUNDS.snapshots; line += 1) {
      editor.select(aliceSelection({ startLine: line, endLine: line }));
      snapshots.capture();
    }
    expect(snapshots.find('snap-1')).toBeDefined();
    editor.select(aliceSelection({ startLine: 99, endLine: 99 }));
    expect(snapshots.capture()!.id).toBe('snap-9');
    expect(snapshots.find('snap-1')).toBeUndefined();
    expect(snapshots.find('snap-2')).toBeDefined();
    expect(snapshots.find('snap-9')).toBeDefined();
    expect(snapshots.find('never-minted')).toBeUndefined();
  });

  it('cuts a selection over the word bound at capture, and says how much it kept', () => {
    const { editor, snapshots } = setup();
    const long = Array.from({ length: BOUNDS.words + 3_120 }, (_, index) => (index % 12 === 11 ? 'rabbit.\n' : 'rabbit')).join(' ');
    editor.select(aliceSelection({ text: long, startLine: 1, endLine: 700 }));
    const snapshot = snapshots.capture()!;
    expect(snapshot.words).toBe(BOUNDS.words);
    expect(snapshot.truncation).toEqual({ keptWords: BOUNDS.words, totalWords: BOUNDS.words + 3_120 });
    expect(snapshot.text.split(/\s+/).filter(Boolean)).toHaveLength(BOUNDS.words);
    // The head slice keeps the text's own line breaks.
    expect(long.startsWith(snapshot.text)).toBe(true);
    expect(workshopSelectedTextSummary(snapshot).truncation).toEqual(snapshot.truncation);
  });

  it('displays a path the host could only give absolutely by its file name', () => {
    const { editor, snapshots } = setup();
    editor.select(aliceSelection({ relativePath: '/home/alice/elsewhere/alice-ch9.md' }));
    expect(snapshots.capture()!.displayPath).toBe('alice-ch9.md');
    editor.select(aliceSelection({ relativePath: 'C:\\Users\\alice\\alice-ch9.md', startLine: 2, endLine: 2 }));
    expect(snapshots.capture()!.displayPath).toBe('alice-ch9.md');
  });

  it('logs ids and counts, never the text, the path or the lines', () => {
    const { editor, log, snapshots } = setup();
    editor.select(aliceSelection());
    snapshots.capture();
    expect(log.lines).toEqual([expect.stringContaining('id=snap-1')]);
    const logged = log.lines.join('\n');
    expect(logged).not.toContain('Caterpillar');
    expect(logged).not.toContain('alice-ch3');
    expect(logged).not.toMatch(/\b40\b|\b44\b/);
  });
});

describe('cutToSelectedTextBound', () => {
  it('leaves a selection inside both bounds exactly as it is', () => {
    expect(cutToSelectedTextBound(`  ${ALICE_TEXT}\n`)).toEqual({ text: `  ${ALICE_TEXT}\n`, words: ALICE_TEXT.split(/\s+/).length });
  });

  it('cuts by characters at a word end when the words are long', () => {
    const word = 'x'.repeat(99);
    const text = Array.from({ length: 500 }, () => word).join(' ');
    const cut = cutToSelectedTextBound(text);
    expect(cut.text.length).toBeLessThanOrEqual(BOUNDS.characters);
    expect(cut.text.endsWith(word)).toBe(true);
    expect(cut.truncation).toEqual({ keptWords: 400, totalWords: 500 });
  });

  it('cuts one unbroken run inside the character bound, never inside a surrogate pair', () => {
    const cut = cutToSelectedTextBound(`${'y'.repeat(BOUNDS.characters - 1)}\u{1F407}tail`);
    expect(cut.text).toBe('y'.repeat(BOUNDS.characters - 1));
    expect(cut.truncation).toEqual({ keptWords: 1, totalWords: 1 });
  });
});

describe('workshopSelectedTextPreview', () => {
  it('is the first line that says anything, on one line, within the bound', () => {
    expect(workshopSelectedTextPreview('\n\n  Who   are\tyou?  \nsaid the Caterpillar.')).toBe('Who are you?');
    const long = workshopSelectedTextPreview('curiouser '.repeat(40));
    expect(Array.from(long).length).toBeLessThanOrEqual(BOUNDS.previewCharacters);
    expect(long.endsWith('…')).toBe(true);
  });
});

describe('EditorSelectionSnapshots.watch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('pushes the first change at once, then at most one per interval, and the trailing edge always fires', () => {
    const { editor, snapshots } = setup();
    const heard: (string | undefined)[] = [];
    snapshots.watch((current) => heard.push(current && `${current.startLine}-${current.endLine}`));

    // A drag: the selection grows a line at a time, faster than the interval.
    editor.change(aliceSelection({ startLine: 40, endLine: 40 }));
    expect(heard).toEqual(['40-40']);
    editor.change(aliceSelection({ startLine: 40, endLine: 41 }));
    editor.change(aliceSelection({ startLine: 40, endLine: 42 }));
    editor.change(aliceSelection({ startLine: 40, endLine: 43 }));
    expect(heard).toEqual(['40-40']);
    jest.advanceTimersByTime(BOUNDS.pushIntervalMs - 1);
    expect(heard).toEqual(['40-40']);
    jest.advanceTimersByTime(1);
    // The last selection of the drag is the one shown; the ones between were never captured.
    expect(heard).toEqual(['40-40', '40-43']);
    expect(snapshots.find('snap-3')).toBeUndefined();

    jest.advanceTimersByTime(BOUNDS.pushIntervalMs);
    editor.change(aliceSelection({ startLine: 50, endLine: 51 }));
    expect(heard).toEqual(['40-40', '40-43', '50-51']);
  });

  it('pushes a deselect and a closed document as nothing selected', () => {
    const { editor, snapshots } = setup();
    const heard: (string | undefined)[] = [];
    snapshots.watch((current) => heard.push(current?.id));
    editor.change(aliceSelection());
    jest.advanceTimersByTime(BOUNDS.pushIntervalMs);
    editor.change(aliceSelection({ text: '', isEmpty: true }));
    jest.advanceTimersByTime(BOUNDS.pushIntervalMs);
    editor.change(undefined);
    expect(heard).toEqual(['snap-1', undefined, undefined]);
  });

  it('listens to the editor only while someone watches, and drops a pending push when the last watcher leaves', () => {
    const { editor, snapshots } = setup();
    expect(editor.listeners()).toBe(0);
    const heard: unknown[] = [];
    const first = snapshots.watch((current) => heard.push(current?.id));
    const second = snapshots.watch(() => { throw new Error('a watcher of its own'); });
    expect(editor.listeners()).toBe(1);
    editor.change(aliceSelection());
    expect(heard).toEqual(['snap-1']);
    first.dispose();
    expect(editor.listeners()).toBe(1);
    editor.change(aliceSelection({ startLine: 1, endLine: 2 }));
    second.dispose();
    expect(editor.listeners()).toBe(0);
    jest.advanceTimersByTime(BOUNDS.pushIntervalMs * 2);
    expect(heard).toEqual(['snap-1']);
    expect(snapshots.find('snap-2')).toBeUndefined();
  });

  it('keeps its cache across a watcher leaving: the cache is the window\'s', () => {
    const { editor, snapshots } = setup();
    const watch = snapshots.watch(() => undefined);
    editor.change(aliceSelection());
    watch.dispose();
    expect(snapshots.find('snap-1')).toBeDefined();
  });
});

// A compile-time witness that the fake is the port's shape.
const _port: Pick<ActiveSelectionInfo, 'text'> = aliceSelection();
void _port;
