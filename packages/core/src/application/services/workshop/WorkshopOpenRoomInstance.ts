/**
 * Which open room the Workshop holds, and each time it is replaced (ADR
 * 2026-11-20 D19, D20; PR #296 F3). The persistence coordinator owns one
 * and announces every replacement synchronously, in the step that swaps the
 * aggregate, before anything else can read the new room.
 *
 * - **An instance is one open room.** New, Open, Branch, a reload of a
 *   named session (its session id unchanged), activation's hydration and a
 *   failed replacement's rollback each open a new one. Only a Rewind keeps
 *   it: the same room, cut at a rest point. A session id cannot tell these
 *   apart: reopening a named session keeps its id.
 * - **Every replacement is told,** a Rewind's too, with the instance now
 *   open and whether it was a Rewind. Window work that belongs to one room
 *   (a running search, a held result) listens instead of noticing later.
 * - **A listener cannot stop a replacement.** One that throws is logged by
 *   its error's name, and the others are still told.
 *
 * Names no feature.
 */

export interface WorkshopRoomReplacement {
  /** The open room instance now. */
  readonly instance: number;
  /** A Rewind cut the same room; every other replacement opened another. */
  readonly rewound: boolean;
}

export type WorkshopRoomReplacementListener = (replacement: WorkshopRoomReplacement) => void;

/** What window work reads: the instance open now, and each replacement as it lands. */
export interface WorkshopOpenRoomInstancePort {
  openRoomInstance(): number;
  onRoomReplaced(listener: WorkshopRoomReplacementListener): () => void;
}

export class WorkshopOpenRoomInstance {
  private instance = 1;
  private readonly listeners = new Set<WorkshopRoomReplacementListener>();

  constructor(private readonly log: (line: string) => void) {}

  current(): number {
    return this.instance;
  }

  /** Any replacement but a Rewind's: another open room. */
  replaced(): void {
    this.instance += 1;
    this.announce(false);
  }

  /** A Rewind cut this room: the same open room, under a new revision. */
  rewound(): void {
    this.announce(true);
  }

  subscribe(listener: WorkshopRoomReplacementListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private announce(rewound: boolean): void {
    const replacement: WorkshopRoomReplacement = { instance: this.instance, rewound };
    for (const listener of [...this.listeners]) {
      try {
        listener(replacement);
      } catch (error) {
        this.log(`[WorkshopOpenRoomInstance] A room-replacement listener failed (${error instanceof Error ? error.name : 'unknown'})`);
      }
    }
  }
}
