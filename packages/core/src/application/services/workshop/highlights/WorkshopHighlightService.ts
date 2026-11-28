import type { IssueAnnotator } from '@/platform/IssueAnnotator';
import type { WorkshopHighlightsDraft } from '@/utils/workshopReplyHighlights';
import type { WorkshopHighlightCounts, WorkshopHighlightEditor } from './WorkshopHighlightEditor';
import { placeWorkshopHighlights } from './placeWorkshopHighlights';

/** Read the live buffer, including unsaved changes. Only a writer's Show may open it. */
export interface WorkshopHighlightDocuments {
  captureTabClosures(): { current(fsPath: string): boolean; dispose(): void };
  readOpen(fsPath: string): { uri: string; version: number; languageId: string; text: string } | undefined;
  reveal(fsPath: string, current: () => boolean): Promise<boolean>;
}

interface HighlightSet {
  /** Keep handles only. The annotator owns the surviving marks and their current offsets. */
  shown?: { uri: string; ids: string[] };
}

type RoomSets = Map<string, HighlightSet>;

/** One Workshop diagnostic family per window, with a separate set of reply identities per room. */
export class WorkshopHighlightService {
  private readonly rooms = new Set<RoomSets>();
  private drawId = 0;
  private generation = 0;

  constructor(private readonly buffers: WorkshopHighlightDocuments, private readonly annotations: IssueAnnotator) {}

  forRoom(): WorkshopHighlightEditor {
    const sets: RoomSets = new Map();
    const window = this;
    const begin = (turnId: string): HighlightSet => {
      // Replacing this handle invalidates a previous Show even if it is still opening the file.
      const set = { shown: sets.get(turnId)?.shown };
      sets.set(turnId, set);
      this.rooms.add(sets);
      return set;
    };
    const forget = (turnId: string) => {
      sets.delete(turnId);
      if (!sets.size) { this.rooms.delete(sets); }
    };
    const clear = (turnId: string) => {
      const shown = sets.get(turnId)?.shown;
      if (shown) { this.annotations.remove(shown.uri, shown.ids); }
      forget(turnId);
    };
    return {
      get clearGeneration() { return window.generation; },
      captureTabClosures: () => this.buffers.captureTabClosures(),
      showOpen: (turnId, fsPath, persona, draft) => {
        const set = begin(turnId);
        try {
          return this.draw(set, fsPath, persona, draft);
        } finally {
          if (!set.shown) { forget(turnId); }
        }
      },
      show: async (turnId, fsPath, persona, draft, current) => {
        if (!current()) { return undefined; }
        const tabs = this.buffers.captureTabClosures();
        const set = begin(turnId);
        const stillCurrent = () => sets.get(turnId) === set && current() && tabs.current(fsPath);
        try {
          if (await this.buffers.reveal(fsPath, stillCurrent) && stillCurrent()) {
            return this.draw(set, fsPath, persona, draft);
          }
          return undefined;
        } finally {
          tabs.dispose();
          if (sets.get(turnId) === set && !set.shown) { forget(turnId); }
        }
      },
      clear,
      retain: (turnIds) => {
        for (const turnId of sets.keys()) {
          if (!turnIds.has(turnId)) { clear(turnId); }
        }
      }
    };
  }

  clearAll(): void {
    this.generation++;
    for (const sets of this.rooms) { sets.clear(); }
    this.rooms.clear();
    this.annotations.clear();
  }

  dismiss(uri: string, id: string): void {
    this.annotations.remove(uri, [id]);
  }

  private draw(
    set: HighlightSet, fsPath: string, persona: string, draft: WorkshopHighlightsDraft
  ): WorkshopHighlightCounts | undefined {
    // A host may refuse a stale version. Read both text and surviving marks again before retrying.
    for (let attempt = 0; attempt < 2; attempt++) {
      const buffer = this.buffers.readOpen(fsPath);
      if (!buffer) { return undefined; }
      const { uri, version, text, languageId } = buffer;
      const current = this.annotations.current(uri);
      if (current && current.version !== version) { continue; }
      const { placed, dropped } = placeWorkshopHighlights(text, languageId, draft);
      const drawId = ++this.drawId;
      const marks = placed.map(({ start, end, note }, index) => {
        // VS Code returns diagnostic copies. Distinct codes disambiguate even identical overlapping marks.
        const id = `workshop.highlight.${drawId}.${index + 1}`;
        return { id, code: id, start, end, severity: 'info' as const, message: `${persona} · ${draft.title}: ${note}` };
      });
      const prior = set.shown;
      const otherMarks = (current?.annotations ?? []).filter(mark => !prior?.ids.includes(mark.id));
      if (!this.annotations.show(uri, version, [...otherMarks, ...marks])) { continue; }
      if (prior && prior.uri !== uri) { this.annotations.remove(prior.uri, prior.ids); }
      set.shown = marks.length ? { uri, ids: marks.map(mark => mark.id) } : undefined;
      return { placed: marks.length, dropped };
    }
    throw new Error('The document changed before its highlights could be shown.');
  }
}
