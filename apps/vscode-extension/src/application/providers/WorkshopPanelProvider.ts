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
import { nativeWorkshopEditors, revealNativeWorkshopEditor, waitForWorkshopEditor, WORKSHOP_EDITOR, type NativeWorkshopEditor } from './WorkshopNativeEditors';

export interface WorkshopPanelRooms {
  acquire(roomId: string): { services: CoreServices; ready: Promise<void> };
  release(roomId: string): Promise<void | WorkshopRoomCloseDestination>;
  recoverRollingRoom(roomId: string, recoveryToken: string): Promise<string>;
  listRoomCheckpoints(): Promise<Array<{ roomId: string; title: string; updatedAt: string; recoveryToken?: string }>>;
  focus?(roomId: string | undefined): void;
}

export class WorkshopPanelProvider implements vscode.Disposable, vscode.WebviewPanelSerializer {
  public static readonly viewTypes = Object.values(WORKSHOP_EDITOR);
  private openingPrimary?: Promise<void>;
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
  ) {}

  public openOrReveal(): void | Promise<void> {
    if (this.revealRoom(PRIMARY_WORKSHOP_ROOM_ID)) { return; }
    if (this.openingPrimary) { return this.openingPrimary; }
    const candidates = this.unresolvedPrimaryEditors();
    if (!candidates.length) {
      this.createPanel(PRIMARY_WORKSHOP_ROOM_ID);
      return;
    }
    this.openingPrimary = this.restorePrimary(candidates).finally(() => { this.openingPrimary = undefined; });
    return this.openingPrimary;
  }

  public newWorkshopTab(): void {
    const first = this.tabs.size === 0 && nativeWorkshopEditors().length === 0;
    this.createPanel(first ? PRIMARY_WORKSHOP_ROOM_ID : randomUUID());
  }

  private unresolvedPrimaryEditors(): NativeWorkshopEditor[] {
    const native = nativeWorkshopEditors();
    const candidates: NativeWorkshopEditor[] = [];
    // A duplicated primary may have been assigned its own UUID on a prior restore. Even an
    // explicitly primary native type can be ruled out when every editor of that type has attached.
    // Historical tab titles can change or coincide, so never decide this from a title.
    for (const type of [WORKSHOP_EDITOR.primary, WORKSHOP_EDITOR.historical]) {
      const editors = native.filter(editor => editor.type === type);
      const attached = [...this.tabs.values()].filter(tab => tab.panel.viewType === type);
      if (editors.length > attached.length) { candidates.push(...editors); }
    }
    return candidates;
  }

  private async restorePrimary(candidates: NativeWorkshopEditor[]): Promise<void> {
    for (const { tab } of candidates) {
      if (this.disposed || this.revealRoom(PRIMARY_WORKSHOP_ROOM_ID)) { return; }
      if (!this.unresolvedPrimaryEditors().length) { break; }
      await revealNativeWorkshopEditor(tab);
    }
    // VS Code may still be constructing a selected webview. It is safe to create only when every
    // native editor that could own the primary has closed or supplied its real slot to the serializer.
    const resolved = await waitForWorkshopEditor(() =>
      this.disposed || this.tabs.has(PRIMARY_WORKSHOP_ROOM_ID) || this.unresolvedPrimaryEditors().length === 0);
    if (this.disposed || this.revealRoom(PRIMARY_WORKSHOP_ROOM_ID)) { return; }
    if (resolved && !this.unresolvedPrimaryEditors().length) {
      this.createPanel(PRIMARY_WORKSHOP_ROOM_ID);
    } else {
      void vscode.window.showInformationMessage('Workshop is still restoring its editors. Open Workshop again when restoration finishes.');
    }
  }

  public revealRoom(roomId: string): boolean {
    const tab = this.tabs.get(roomId);
    if (!tab) {
      return false;
    }
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
  public openTray(token?: string): void {
    if (token === undefined) {
      this.destination();
      return;
    }
    const tab = [...this.tabs.values()].find(candidate => candidate.trayToken === token);
    if (tab) {
      this.revealRoom(tab.roomId);
    }
  }

  public seedExcerpt(payload: { text: string; source?: WorkshopExcerptSource }): void {
    this.destination().seedExcerpt(payload);
  }

  public stageSelectedText(snapshotId: string): Promise<WorkshopSeedOutcome> {
    return this.destination().stageSelectedText(snapshotId);
  }

  /** Capture the recipient before the Lightbox checks its file. A rejected handoff opens no Workshop. */
  public captureLightboxTarget() {
    const captured = this.focusOrder[0];
    const revision = captured?.roomRevision();
    const reservedLegacy = this.legacyAttachment;
    let staged: { boardId: string; tileId: string } | undefined;
    return {
      trayToken: captured?.trayToken,
      send: (handoff: LightboxWorkshopHandoff): Promise<WorkshopSeedOutcome> => {
        if (!captured && this.legacyAttachment !== reservedLegacy) {
          // Someone opened (and may already have closed) the reserved slot during the file check.
          return Promise.resolve({ opened: false, reason: 'room-changed' });
        }
        const target = captured ?? this.createPanel(PRIMARY_WORKSHOP_ROOM_ID);
        if (this.tabs.get(target.roomId) !== target) {
          return Promise.resolve({ opened: false, reason: 'closed' });
        }
        if (!target.stillShowsRoom(revision)) {
          return Promise.resolve({ opened: false, reason: 'room-changed' });
        }
        this.revealRoom(target.roomId);
        return handoff.kind === 'tile'
          ? target.stageLightboxTile(handoff.tile, () => { staged = handoff.tile; })
          : target.seedLexicalGravityBuild(handoff.seed);
      },
      wasStaged: (tile: { boardId: string; tileId: string }) =>
        staged?.boardId === tile.boardId && staged.tileId === tile.tileId
    };
  }

  /** Used by direct host callers as well as handoffs prepared synchronously. */
  public seedLexicalGravityBuild(seed: Parameters<WorkshopPanelTab['seedLexicalGravityBuild']>[0]) {
    return this.destination().seedLexicalGravityBuild(seed);
  }

  public stageLightboxTile(tile: Parameters<WorkshopPanelTab['stageLightboxTile']>[0]) {
    return this.destination().stageLightboxTile(tile);
  }

  private destination(): WorkshopPanelTab {
    const tab = this.focusOrder[0];
    if (!tab) {
      return this.createPanel(PRIMARY_WORKSHOP_ROOM_ID);
    }
    this.revealRoom(tab.roomId);
    return tab;
  }

  private createPanel(roomId: string): WorkshopPanelTab {
    const panel = vscode.window.createWebviewPanel(
      roomId === PRIMARY_WORKSHOP_ROOM_ID ? WORKSHOP_EDITOR.primary : WORKSHOP_EDITOR.secondary, 'Workshop', vscode.ViewColumn.Active,
      { enableScripts: true, localResourceRoots: [this.extensionUri], retainContextWhenHidden: true }
    );
    return this.attachPanel(panel, roomId, true);
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
    const { services, ready } = this.rooms.acquire(roomId);
    const number = this.nextNumber++;
    if (roomId === PRIMARY_WORKSHOP_ROOM_ID) {
      ++this.legacyAttachment;
    }
    const tab = new WorkshopPanelTab(
      roomId, panel, this.extensionUri, services, ready, this.outputChannel, this.platform, this.uiActions,
      () => this.focus(tab), () => this.detach(tab), () => this.refreshTitles(),
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
    void this.rooms.release(tab.roomId).then(destination => {
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
