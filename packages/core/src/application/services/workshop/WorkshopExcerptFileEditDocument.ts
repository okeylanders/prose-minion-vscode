/**
 * The room's excerpt document, as file-edit staging and Apply read it (ADR
 * 2026-11-05 D4.4, D5): from host session state when asked, its source
 * authorized exactly as "Re-read from file" authorizes it (inside an open
 * workspace folder, or an exact configured resource, with no symbolic link).
 * Nothing here opens or writes a document.
 *
 * An editor-selection excerpt names its document by the same `file:` URL a
 * file excerpt does, so it is authorized the same way. A pasted excerpt, or
 * none, has no document.
 */

import type { WorkshopExcerpt } from '@messages';
import type { FileEditExcerptPort } from '@/application/services/fileEdits/fileEditIdentity';
import type { WorkshopContextIntakeService } from './WorkshopContextIntakeService';

export function workshopExcerptFileEditDocument(
  session: { getExcerpt(): WorkshopExcerpt | undefined },
  intake: Pick<WorkshopContextIntakeService, 'authorizeExcerptReread'>
): FileEditExcerptPort {
  return {
    currentDocument: async () => {
      const source = session.getExcerpt()?.source;
      if (!source || source.kind === 'manual') {
        return undefined;
      }
      try {
        const authorization = await intake.authorizeExcerptReread({
          kind: 'file',
          sourceUri: source.sourceUri,
          relativePath: source.relativePath
        });
        return authorization.kind === 'authorized' ? { fsPath: authorization.fsPath, relativePath: source.relativePath } : undefined;
      } catch {
        return undefined;
      }
    }
  };
}
