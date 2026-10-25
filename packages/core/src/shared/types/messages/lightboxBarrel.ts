/**
 * The Lightbox message domain behind one barrel (ADR 2026-10-19 D10). Split
 * from `messages/index.ts` (Slice 5A.1), which re-exports it, so the root
 * barrel stays a composition of domains. Consumers keep importing from
 * `@messages`; wire shapes and `MessageType` values are unchanged.
 *
 * `LightboxWebviewToExtensionMessage` and `LightboxExtensionToWebviewMessage`
 * are the Lightbox's parts of the root's two routing unions.
 */

export * from './lightbox';
export * from './lightboxReadings';
export * from './lightboxRuns';
export * from './lightboxEstimate';
export * from './lightboxStoryTiles';
export * from './lightboxGravity';
export * from './lightboxStale';
export * from './lightboxHandoff';
export * from './lightboxProjectFiles';
export * from './lightboxContextFiles';
export * from './lightboxCraftTiles';
export * from './lightboxNumbers';
export * from './lightboxPlotTiles';
export * from './lightboxSections';
export * from './lightboxOpinion';
export * from './lightboxSteering';
export * from './lightboxPassages';
export * from './lightboxBoards';

import {
  LightboxRequestBoardMessage,
  LightboxSetSourceMessage,
  LightboxPickSourceFileMessage,
  LightboxRefreshSourceMessage,
  LightboxDismissRefusalMessage,
  LightboxBoardMessage,
  LightboxSourceRefusedMessage
} from './lightbox';
import {
  LightboxSetLensesMessage,
  LightboxRunEstimateMessage,
  LightboxRunMessage,
  LightboxCancelRunMessage,
  LightboxRunProgressMessage,
  LightboxGroupResultMessage
} from './lightboxRuns';
import {
  LightboxAddContextFilesMessage,
  LightboxRemoveContextFileMessage,
  LightboxContextFilesMessage
} from './lightboxContextFiles';
import {
  LightboxHandOffMessage,
  LightboxHandOffResultMessage,
  LightboxOpenWorkshopMessage,
  LightboxWorkshopTrayMessage
} from './lightboxHandoff';
import { LightboxSetSparkDismissedMessage } from './lightboxStoryTiles';
import {
  LightboxAddProjectContextMessage,
  LightboxChooseProjectSourceMessage,
  LightboxProjectCatalogMessage,
  LightboxProjectCatalogSearchResultsMessage,
  LightboxRequestProjectCatalogMessage,
  LightboxSearchProjectCatalogMessage
} from './lightboxProjectFiles';
import { LightboxPassageMessage, LightboxRequestPassageMessage } from './lightboxPassages';
import { LightboxBoardsMessage, LightboxBoardsRequestMessage } from './lightboxBoards';

/** Every Lightbox message the webview sends the host. */
export type LightboxWebviewToExtensionMessage =
  | LightboxRequestBoardMessage
  | LightboxSetSourceMessage
  | LightboxDismissRefusalMessage
  | LightboxPickSourceFileMessage
  | LightboxRefreshSourceMessage
  | LightboxSetLensesMessage
  | LightboxRunMessage
  | LightboxCancelRunMessage
  | LightboxAddContextFilesMessage
  | LightboxRemoveContextFileMessage
  | LightboxHandOffMessage
  | LightboxSetSparkDismissedMessage
  | LightboxOpenWorkshopMessage
  | LightboxRequestProjectCatalogMessage
  | LightboxSearchProjectCatalogMessage
  | LightboxChooseProjectSourceMessage
  | LightboxAddProjectContextMessage
  | LightboxRequestPassageMessage
  | LightboxBoardsRequestMessage;

/** Every Lightbox message the host sends the webview. */
export type LightboxExtensionToWebviewMessage =
  | LightboxBoardMessage
  | LightboxSourceRefusedMessage
  | LightboxRunEstimateMessage
  | LightboxRunProgressMessage
  | LightboxGroupResultMessage
  | LightboxContextFilesMessage
  | LightboxHandOffResultMessage
  | LightboxWorkshopTrayMessage
  | LightboxProjectCatalogMessage
  | LightboxProjectCatalogSearchResultsMessage
  | LightboxPassageMessage
  | LightboxBoardsMessage;
