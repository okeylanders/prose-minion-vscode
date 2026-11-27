import * as path from 'path';
import { pathToFileURL } from 'url';
import type { MessageTransport } from '@handlers/MessageHandlerContracts';
import { MessageType, type WorkshopMessageAttachmentSnapshot, type WorkshopSentAttachmentRequest } from '@messages';
import type { LogSink, ShellService } from '@/platform';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type { WorkshopContextIntakeService } from '@/application/services/workshop/WorkshopContextIntakeService';
import { isPathWithinRoot, workspaceRelativeSegments } from '@/application/services/workshop/WorkshopIntakePaths';
import { resolveWorkshopReadInResource } from '@/application/services/workshop/WorkshopReadInResource';
import { workshopMessageAttachmentKind } from '@shared/constants/workshopThreadArtifactKinds';

const stale = 'That message is no longer in the open room.';
const unavailable = 'The current source file could not be identified in this workspace.';

function valid(request: WorkshopSentAttachmentRequest): boolean {
  return !!request && Object.keys(request).length === 4
    && typeof request.requestId === 'string' && request.requestId.length > 0 && request.requestId.length <= 128
    && Number.isSafeInteger(request.roomRevision)
    && typeof request.turnId === 'string' && request.turnId.length > 0 && request.turnId.length <= 128
    && typeof request.artifactId === 'string' && /^ta-\d{1,16}$/.test(request.artifactId);
}

function fileCandidate(ref: WorkshopMessageAttachmentSnapshot, roots: readonly string[]) {
  if (workshopMessageAttachmentKind(ref) !== undefined) { return undefined; }
  if (ref.configuredResource) { return { kind: 'configured', ref: ref.configuredResource } as const; }
  const segments = ref.relativePath && workspaceRelativeSegments(ref.relativePath);
  if (roots.length !== 1 || !segments) { return undefined; }
  const fsPath = path.resolve(roots[0], ...segments);
  return isPathWithinRoot(roots[0], fsPath) ? { kind: 'workspace', fsPath } as const : undefined;
}

export class WorkshopSentAttachmentRoutes {
  constructor(
    private readonly session: Pick<WorkshopSessionService, 'readRoomRevision' | 'readSentMessageAttachment'>,
    private readonly intake: Pick<WorkshopContextIntakeService, 'workspaceRoots' | 'openCatalog' | 'configuredGroupFiles' | 'authorizeExcerptReread'>,
    private readonly shell: Pick<ShellService, 'openFileInEditor'>,
    private readonly post: MessageTransport,
    private readonly log: LogSink,
    private readonly reportError: (message: string) => void,
    private readonly disposed: () => boolean
  ) {}

  private current(request: WorkshopSentAttachmentRequest): boolean {
    return !this.disposed() && this.session.readRoomRevision() === request.roomRevision;
  }

  async read(request: WorkshopSentAttachmentRequest): Promise<void> {
    if (this.disposed() || !valid(request)) { return; }
    const result = this.current(request) ? this.session.readSentMessageAttachment(request.turnId, request.artifactId) : { error: stale };
    const payload = 'attachment' in result
      ? { ...request, content: result.content, canOpenInEditor: !!fileCandidate(result.attachment, this.intake.workspaceRoots()) }
      : { ...request, error: result.error };
    if ('attachment' in result) {
      const { attachment } = result;
      this.log.appendLine(`[Workshop] Sent attachment read (id=${request.artifactId}, kind=${workshopMessageAttachmentKind(attachment) ?? 'file'}, words=${attachment.words})`);
    }
    void this.post({ type: MessageType.WORKSHOP_MESSAGE_ATTACHMENT_CONTENT, source: 'extension.workshop', timestamp: Date.now(), payload });
  }

  async open(request: WorkshopSentAttachmentRequest): Promise<void> {
    if (!valid(request) || !this.current(request)) { return; }
    const result = this.session.readSentMessageAttachment(request.turnId, request.artifactId);
    if ('error' in result) { this.reportError(result.error); return; }
    const ref = result.attachment;
    const roots = this.intake.workspaceRoots();
    const stillCurrent = () => {
      const now = this.intake.workspaceRoots();
      return this.current(request) && now.length === roots.length && now.every((root, i) => root === roots[i])
        && 'attachment' in this.session.readSentMessageAttachment(request.turnId, request.artifactId);
    };
    const candidate = fileCandidate(ref, roots);
    if (!candidate) { this.reportError(unavailable); return; }
    try {
      let fsPath: string;
      if (candidate.kind === 'configured') {
        const catalog = await this.intake.openCatalog();
        const match = await resolveWorkshopReadInResource(catalog.entries(), this.intake.configuredGroupFiles,
          candidate.ref.group, candidate.ref.path);
        if (match.kind !== 'resolved') {
          if (stillCurrent()) { this.reportError(unavailable); }
          return;
        }
        fsPath = match.resource.absolutePath;
      } else {
        fsPath = candidate.fsPath;
      }
      if (!stillCurrent()) { return; }
      const auth = await this.intake.authorizeExcerptReread({
        kind: 'file', sourceUri: pathToFileURL(fsPath).toString(), relativePath: ref.relativePath ?? ref.label
      });
      if (!stillCurrent()) { return; }
      if (auth.kind !== 'authorized' || auth.fsPath !== fsPath) { this.reportError(unavailable); return; }
      await this.shell.openFileInEditor(fsPath, { beside: true });
    } catch {
      if (stillCurrent()) { this.reportError(unavailable); }
    }
  }
}
