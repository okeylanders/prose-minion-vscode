/**
 * The room's excerpt as the file-edit gateway may edit it (ADR 2026-11-05
 * D4.2): read from host session state when an edit is asked for, its source
 * authorized exactly as "Re-read from file" authorizes it (inside an open
 * workspace folder, or an exact configured resource, with no symbolic
 * link). Nothing here opens or writes a document: the gateway does.
 *
 * An editor-selection excerpt names its document by the same `file:` URL a
 * file excerpt does, so it is authorized the same way. A shelved excerpt is
 * no excerpt.
 */

import type { WorkshopExcerpt } from '@messages';
import type { FileEditExcerptPort, FileEditExcerptState } from '@/application/services/fileEdits/fileEditTargets';
import type { WorkshopContextIntakeService } from './WorkshopContextIntakeService';

export function workshopExcerptFileEditSource(
  session: { getExcerpt(): WorkshopExcerpt | undefined },
  intake: Pick<WorkshopContextIntakeService, 'authorizeExcerptReread'>
): FileEditExcerptPort {
  return {
    current: async (): Promise<FileEditExcerptState> => {
      const excerpt = session.getExcerpt();
      if (!excerpt) {
        return { kind: 'none' };
      }
      const { source, version, text } = excerpt;
      if (source.kind === 'manual') {
        return { kind: 'manual', version };
      }
      try {
        const authorization = await intake.authorizeExcerptReread({
          kind: 'file',
          sourceUri: source.sourceUri,
          relativePath: source.relativePath
        });
        return authorization.kind === 'authorized'
          ? { kind: 'file', version, text, fsPath: authorization.fsPath }
          : { kind: 'unauthorized', version };
      } catch {
        return { kind: 'unauthorized', version };
      }
    }
  };
}
