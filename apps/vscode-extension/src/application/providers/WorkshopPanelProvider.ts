/** VS Code's Workshop editors. Each attachment has one durable slot, one handler and one set of seed receivers. */
import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import {
  CoreServices,
  isWorkshopRoomId,
  LightboxWorkshopHandoff,
  Platform,
  PRIMARY_WORKSHOP_ROOM_ID,
  WorkshopExcerptSource,
  WorkshopSeedOutcome,
  type WorkshopRoomCloseDestination,
  WorkshopUiActions
} from '@prose-minion/core';
import { WorkshopPanelTab } from './WorkshopPanelTab';
import { WorkshopUnsavedSessions, type WorkshopUnsavedRoomStore } from './WorkshopUnsavedSessions';
import { nativeWorkshopEditors, revealNativeWorkshopEditor, waitForWorkshopEditor, WORKSHOP_EDITOR, type NativeWorkshopEditor } from './WorkshopNativeEditors';

export interface WorkshopPanelRooms extends WorkshopUnsavedRoomStore {
  acquire(roomId: string): { services: CoreServices; ready: Promise<void> };
  release(roomId: string, canTrim?: () => boolean): Promise<void | WorkshopRoomCloseDestination>;
  recoverRollingRoom(roomId: string, recoveryToken: string): Promise<string>;
  listRoomCheckpoints(): Promise<Array<{ roomId: string; title: string; updatedAt: string; recoveryToken?: string }>>;
  focus?(roomId: string | undefined): void;
}

export class WorkshopPanelProvider implements vscode.Disposable, vscode.WebviewPanelSerializer {
  public static readonly viewTypes = Object.values(WORKSHOP_EDITOR);
  readonly unsavedSessions: WorkshopUnsavedSessions;
  private navigation = 0;
  private nativeNavigation?: number;
  private openingPrimary?: { navigation: number; result: Promise<WorkshopPanelTab | undefined> };
  private readonly tabs = new Map<string, WorkshopPanelTab>();
  private focusOrder: WorkshopPanelTab[] = [];
  private nextNumber = 1;
  private disposed = false;
  private legacyAttachment = 0;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly rooms: WorkshopPanelRooms,
    private readonly outputChannel: vscode.OutputChannel,
    private readonly platform: Platform,
    private readonly uiActions: WorkshopUiActions = {}
  ) {
    this.unsavedSessions = new WorkshopUnsavedSessions(rooms, workspaceIdentity,
      () => !this.disposed && this.unresolvedNativeEditors().length === 0,
      roomId => !this.disposed && !this.tabs.has(roomId),
      async roomId => {
        const panel = this.createPanel(roomId);
        await panel.ready;
        if (this.tabs.get(roomId) !== panel) { throw new Error('The room closed while opening.'); }
      });
  }

  public openOrReveal(): void | Promise<void> {
    if (this.revealRoom(PRIMARY_WORKSHOP_ROOM_ID)) { return; }
    const candidates = this.unresolvedPrimaryEditors();
    if (!candidates.length) {
      this.createPanel(PRIMARY_WORKSHOP_ROOM_ID);
      return;
    }
    const navigation = this.navigation;
    return this.findPrimary(candidates, navigation).then(tab => {
      if (this.disposed || navigation !== this.navigation) { return; }
      if (tab && this.tabs.get(PRIMARY_WORKSHOP_ROOM_ID) === tab) {
        this.revealRoom(PRIMARY_WORKSHOP_ROOM_ID);
      } else if (!this.unresolvedPrimaryEditors().length) {
        this.createPanel(PRIMARY_WORKSHOP_ROOM_ID);
      } else {
        void vscode.window.showInformationMessage('Workshop is still restoring its editors. Open Workshop again when restoration finishes.');
      }
    });
  }

  public newWorkshopTab(): void {
    const first = this.tabs.size === 0 && nativeWorkshopEditors().length === 0;
    this.createPanel(first ? PRIMARY_WORKSHOP_ROOM_ID : randomUUID());
  }

  private unresolvedPrimaryEditors(native = nativeWorkshopEditors()): NativeWorkshopEditor[] {
    return this.unresolvedNativeEditors(native).filter(editor => editor.type !== WORKSHOP_EDITOR.secondary);
  }

  private unresolvedNativeEditors(native = nativeWorkshopEditors()): NativeWorkshopEditor[] {
    const candidates: NativeWorkshopEditor[] = [];
    // A duplicated primary may have been assigned its own UUID on a prior restore. Even an
    // explicitly primary native type can be ruled out when every editor of that type has attached.
    // Historical tab titles can change or coincide, so never decide this from a title.
    for (const type of [WORKSHOP_EDITOR.primary, WORKSHOP_EDITOR.historical, WORKSHOP_EDITOR.secondary]) {
      const editors = native.filter(editor => editor.type === type);
      const attached = [...this.tabs.values()].filter(tab => tab.panel.viewType === type);
      if (editors.length > attached.length) { candidates.push(...editors); }
    }
    return candidates;
  }

  /** Resolve the slot separately from revealing it: callers waiting on this editor may have different gestures. */
  private findPrimary(candidates: NativeWorkshopEditor[], navigation: number): Promise<WorkshopPanelTab | undefined> {
    if (this.openingPrimary?.navigation === navigation) { return this.openingPrimary.result; }
    const result = this.restorePrimary(candidates, navigation).finally(() => {
      if (this.openingPrimary?.result === result) { this.openingPrimary = undefined; }
    });
    this.openingPrimary = { navigation, result };
    return result;
  }

  private async restorePrimary(candidates: NativeWorkshopEditor[], navigation: number): Promise<WorkshopPanelTab | undefined> {
    const current = () => !this.disposed && navigation === this.navigation;
    let selected = false;
    for (const { tab } of candidates) {
      if (!current() || this.tabs.has(PRIMARY_WORKSHOP_ROOM_ID) || !this.unresolvedPrimaryEditors().length) { break; }
      this.nativeNavigation = navigation;
      try {
        selected = await revealNativeWorkshopEditor(tab, current) || selected;
      } finally {
        if (this.nativeNavigation === navigation) { this.nativeNavigation = undefined; }
      }
    }
    if (!current() && !selected) { return undefined; }
    // A newer tab choice stops navigation. A serializer already requested can still attach the
    // original room in the background and receive a selection that was captured for it.
    await waitForWorkshopEditor(() =>
      this.disposed || this.tabs.has(PRIMARY_WORKSHOP_ROOM_ID) || this.unresolvedPrimaryEditors().length === 0);
    return this.tabs.get(PRIMARY_WORKSHOP_ROOM_ID);
  }

  public revealRoom(roomId: string): boolean {
    const tab = this.tabs.get(roomId);
    if (!tab) {
      return false;
    }
    if (roomId !== PRIMARY_WORKSHOP_ROOM_ID) { ++this.navigation; }
    this.focus(tab);
    tab.panel.reveal();
    return true;
  }

  public async reopenClosedRoom(): Promise<void> {
    const atOpen = workspaceIdentity();
    let checkpoints: Awaited<ReturnType<WorkshopPanelRooms['listRoomCheckpoints']>>;
    try {
      checkpoints = await this.rooms.listRoomCheckpoints();
    } catch (error) {
      this.outputChannel.appendLine(`[Workshop] Could not list closed rooms: ${String(error)}`);
      void vscode.window.showErrorMessage('Closed Workshop rooms could not be read. Try reopening the picker.');
      return;
    }
    if (this.disposed) return;
    const choices = checkpoints.filter(room => !this.tabs.has(room.roomId)).map(room => ({
      label: room.recoveryToken ? `Open a recovery copy of “${room.title}”` : room.title,
      detail: room.recoveryToken ? 'Copy the last saved checkpoint into a new room. The original write claim stays in place.' : undefined,
      recoveryToken: room.recoveryToken,
      description: room.updatedAt,
      roomId: room.roomId
    }));
    if (!choices.length) {
      void vscode.window.showInformationMessage('There are no closed Workshop rooms to reopen.');
      return;
    }
    const picked = await vscode.window.showQuickPick(choices, { placeHolder: 'Reopen a closed Workshop room' });
    if (!picked || this.disposed) return;
    if (atOpen !== workspaceIdentity()) {
      void vscode.window.showInformationMessage('The workspace changed. Reopen the closed-room picker.');
      return;
    }
    if (this.revealRoom(picked.roomId)) return;
    try {
      const roomId = picked.recoveryToken
        ? await this.rooms.recoverRollingRoom(picked.roomId, picked.recoveryToken)
        : picked.roomId;
      if (!this.disposed && atOpen === workspaceIdentity() && !this.revealRoom(roomId)) {
        this.createPanel(roomId);
      }
    } catch (error) {
      this.outputChannel.appendLine(`[Workshop] Could not reopen the checkpoint: ${String(error)}`);
      if (!this.disposed) void vscode.window.showErrorMessage('This checkpoint could not be reopened. Reopen the picker to see its current status.');
    }
  }

  /** Native navigation for the tray the writer actually saw, even after another room has gained focus. */
  public openTray(token?: string): void | Promise<void> {
    if (token === undefined) {
      return this.captureDestination().use(() => {}, () => {});
    }
    const tab = [...this.tabs.values()].find(candidate => candidate.trayToken === token);
    if (tab) {
      this.revealRoom(tab.roomId);
    }
  }

  public seedExcerpt(payload: { text: string; source?: WorkshopExcerptSource }): Promise<void> {
    return this.captureDestination().use(tab => tab.seedExcerpt(payload), () => {
      void vscode.window.showInformationMessage('The Workshop room for this excerpt is no longer available.');
    });
  }

  public stageSelectedText(snapshotId: string): Promise<WorkshopSeedOutcome> {
    return this.captureDestination().use(tab => tab.stageSelectedText(snapshotId), refusedSeed);
  }

  /** Capture the recipient before the Lightbox checks its file. A rejected handoff opens no Workshop. */
  public captureLightboxTarget() {
    const destination = this.captureDestination();
    let staged: { boardId: string; tileId: string } | undefined;
    return {
      trayToken: destination.trayToken,
      send: (handoff: LightboxWorkshopHandoff): Promise<WorkshopSeedOutcome> =>
        destination.use(tab => handoff.kind === 'tile'
          ? tab.stageLightboxTile(handoff.tile, () => { staged = handoff.tile; })
          : tab.seedLexicalGravityBuild(handoff.seed), refusedSeed),
      wasStaged: (tile: { boardId: string; tileId: string }) =>
        staged?.boardId === tile.boardId && staged.tileId === tile.tileId
    };
  }

  public seedLexicalGravityBuild(seed: Parameters<WorkshopPanelTab['seedLexicalGravityBuild']>[0]) {
    return this.captureDestination().use(tab => tab.seedLexicalGravityBuild(seed), refusedSeed);
  }

  public stageLightboxTile(tile: Parameters<WorkshopPanelTab['stageLightboxTile']>[0]) {
    return this.captureDestination().use(tab => tab.stageLightboxTile(tile), refusedSeed);
  }

  /** The receipt belongs to the room at the gesture, even if its webview has yet to deserialize. */
  private captureDestination() {
    const captured = this.focusOrder[0];
    const revision = captured?.roomRevision();
    const navigation = this.navigation;
    const attachment = this.legacyAttachment;
    const native = captured ? [] : nativeWorkshopEditors();
    const candidates = this.unresolvedPrimaryEditors(native);
    const sameCandidates = () => {
      const live = nativeWorkshopEditors().filter(editor => editor.type !== WORKSHOP_EDITOR.secondary);
      return live.length === candidates.length && candidates.every(({ tab }) => live.some(editor => editor.tab === tab));
    };
    return {
      trayToken: captured?.trayToken,
      use: async <T>(deliver: (tab: WorkshopPanelTab) => T | Promise<T>, refuse: (reason: 'closed' | 'room-changed') => T): Promise<T> => {
        if (this.disposed) { return refuse('closed'); }
        let target: WorkshopPanelTab | undefined = captured;
        let created = false;
        if (!target && candidates.length) {
          if (!sameCandidates()) { return refuse('room-changed'); }
          target = this.tabs.get(PRIMARY_WORKSHOP_ROOM_ID) ?? await this.findPrimary(candidates, navigation);
          if (!target || !sameCandidates() || this.legacyAttachment !== attachment + 1) { return refuse('room-changed'); }
        } else if (!target) {
          // A cold, empty window can reserve its first slot. Hidden secondary editors have no known MRU.
          if (native.length || this.tabs.size || this.legacyAttachment !== attachment || nativeWorkshopEditors().length) {
            return refuse('room-changed');
          }
          target = this.createPanel(PRIMARY_WORKSHOP_ROOM_ID);
          created = true;
        }
        if (this.tabs.get(target.roomId) !== target) { return refuse('closed'); }
        if (!target.stillShowsRoom(revision)) { return refuse('room-changed'); }
        if (!created && navigation === this.navigation) { this.revealRoom(target.roomId); }
        return deliver(target);
      }
    };
  }

  private createPanel(roomId: string): WorkshopPanelTab {
    if (roomId !== PRIMARY_WORKSHOP_ROOM_ID) { ++this.navigation; }
    const panel = vscode.window.createWebviewPanel(
      roomId === PRIMARY_WORKSHOP_ROOM_ID ? WORKSHOP_EDITOR.primary : WORKSHOP_EDITOR.secondary, 'Workshop', vscode.ViewColumn.Active,
      { enableScripts: true, localResourceRoots: [this.extensionUri], retainContextWhenHidden: true }
    );
    try {
      return this.attachPanel(panel, roomId, true);
    } catch (error) {
      // A concurrent deletion claim can refuse attachment after VS Code creates the shell.
      panel.dispose();
      throw error;
    }
  }

  public deserializeWebviewPanel(panel: vscode.WebviewPanel, state: unknown): Promise<void> {
    const existing = [...this.tabs.values()].find(tab => tab.panel === panel);
    if (existing) {
      return existing.ready;
    }
    // Pre-feature panels may have no state or an object with UI preferences and no slot.
    const oldState = state === undefined || state === null ||
      (typeof state === 'object' && !Array.isArray(state) && !Object.prototype.hasOwnProperty.call(state, 'workshopRoomId'));
    const saved = (state as { workshopRoomId?: unknown } | null)?.workshopRoomId;
    let requested = oldState ? PRIMARY_WORKSHOP_ROOM_ID : saved;
    if (panel.viewType === WORKSHOP_EDITOR.secondary && requested === PRIMARY_WORKSHOP_ROOM_ID) { requested = undefined; }
    const roomId = isWorkshopRoomId(requested) && !this.tabs.has(requested) ? requested : randomUUID();
    return this.attachPanel(panel, roomId, panel.active).ready;
  }

  private attachPanel(panel: vscode.WebviewPanel, roomId: string, focused: boolean): WorkshopPanelTab {
    this.unsavedSessions.invalidate(roomId);
    const { services, ready } = this.rooms.acquire(roomId);
    const number = this.nextNumber++;
    if (roomId === PRIMARY_WORKSHOP_ROOM_ID) {
      ++this.legacyAttachment;
    }
    const tab = new WorkshopPanelTab(
      roomId, panel, this.extensionUri, services, ready, this.outputChannel, this.platform, this.uiActions,
      () => {
        if (this.nativeNavigation === undefined && this.focusOrder[0] !== tab && roomId !== PRIMARY_WORKSHOP_ROOM_ID) { ++this.navigation; }
        this.focus(tab);
      }, () => this.detach(tab), () => this.refreshTitles(),
      roomId === PRIMARY_WORKSHOP_ROOM_ID ? 'Workshop' : `Workshop · Room ${number}`
    );
    this.tabs.set(roomId, tab);
    this.refreshTitles();
    if (focused || !this.focusOrder.length) {
      this.focus(tab);
    } else {
      this.focusOrder.push(tab);
    }
    return tab;
  }

  private refreshTitles(): void {
    const counts = new Map<string, number>();
    for (const tab of this.tabs.values()) {
      counts.set(tab.title, (counts.get(tab.title) ?? 0) + 1);
    }
    for (const tab of this.tabs.values()) {
      tab.panel.title = counts.get(tab.title)! > 1 && tab.roomId !== PRIMARY_WORKSHOP_ROOM_ID
        ? `${tab.title} (${tab.roomId.slice(0, 8)})`
        : tab.title;
    }
  }

  private focus(tab: WorkshopPanelTab): void {
    if (this.tabs.get(tab.roomId) !== tab || this.focusOrder[0] === tab) {
      return;
    }
    this.focusOrder = [tab, ...this.focusOrder.filter(other => other !== tab)];
    this.rooms.focus?.(tab.roomId);
  }

  private detach(tab: WorkshopPanelTab): void {
    if (this.tabs.get(tab.roomId) !== tab) {
      return;
    }
    const wasFocused = this.focusOrder[0] === tab;
    this.tabs.delete(tab.roomId);
    this.refreshTitles();
    this.focusOrder = this.focusOrder.filter(other => other !== tab);
    tab.dispose();
    if (wasFocused) {
      this.rooms.focus?.(this.focusOrder[0]?.roomId);
    }
    const folders = vscode.workspace.workspaceFolders;
    const root = folders?.length === 1 ? folders[0].uri.toString() : undefined;
    const canTrim = () => !this.disposed && !this.tabs.has(tab.roomId) && this.unresolvedNativeEditors().length === 0;
    void this.rooms.release(tab.roomId, canTrim).then(destination => {
      if (destination && !this.disposed) void this.offerPreservedSession(destination, root);
    }, error => {
      this.outputChannel.appendLine(`[Workshop] Room close could not finish: ${String(error)}`);
      void vscode.window.showErrorMessage('The Workshop room could not finish saving. Reopen the room to retry.');
    });
  }

  private async offerPreservedSession(destination: WorkshopRoomCloseDestination, root: string | undefined): Promise<void> {
    const open = 'Open saved recovery';
    const answer = await vscode.window.showInformationMessage(
      `The room’s latest work was preserved in “${destination.title}”. You can also find it in Workshop Sessions.`, open
    );
    if (answer !== open || this.disposed) return;
    const folders = vscode.workspace.workspaceFolders;
    if (folders?.length !== 1 || folders[0].uri.toString() !== root) {
      void vscode.window.showInformationMessage('Open the original workspace to find this saved Workshop session.');
      return;
    }
    try {
      await this.createPanel(randomUUID()).openNamedSession(destination.sessionId);
    } catch (error) {
      this.outputChannel.appendLine(`[Workshop] Could not open the preserved session: ${String(error)}`);
      if (!this.disposed) void vscode.window.showErrorMessage('Open the preserved room from Workshop Sessions.');
    }
  }

  public dispose(): void {
    this.disposed = true;
    for (const tab of this.tabs.values()) {
      this.detach(tab);
      tab.panel.dispose();
    }
  }
}

/** A picker can stay open while the host changes folders. Compare only within this extension window. */
function workspaceIdentity(): string {
  return JSON.stringify(vscode.workspace.workspaceFolders?.map(folder => folder.uri.toString()) ?? []);
}

function refusedSeed(reason: 'closed' | 'room-changed'): WorkshopSeedOutcome {
  return { opened: false, reason };
}
