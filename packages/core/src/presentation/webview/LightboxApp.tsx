/**
 * LightboxApp — the `lightbox` surface's React root (ADR 2026-10-19 D1, D2).
 *
 * The Lightbox renders on the shared FullTabShell: the generic chrome from
 * `useFullTabChrome` (assistant model, processed and balance chips, the
 * provider-paused banner), the source and lenses in the rail, the board in
 * the main column, and the inspector in the aside. Its own state is the
 * `useLightbox` domain hook (the board is host truth; only UI preferences
 * persist) plus two presentation controllers: focus (what the ribbon
 * lights) and the inspector's view model.
 *
 * Its stylesheets are imported here, the root's single composition point,
 * after the frame's (index.tsx). The list is pinned by workshopStyles.test.ts.
 */
import './styles/lightbox/tokens.css';
import './styles/lightbox/board.css';
import './styles/lightbox/ribbon.css';
import './styles/lightbox/tiles.css';
import './styles/lightbox/rail.css';
import './styles/lightbox/inspector.css';
import * as React from 'react';
import { MessageType } from '@messages';
import { FullTabShell } from '@components/fulltab/FullTabShell';
import { FullTabHeaderStatus } from '@components/fulltab/FullTabHeaderStatus';
import { ProviderPausedBanner } from '@components/fulltab/ProviderPausedBanner';
import { Icon } from '@components/shared/Icon';
import { LightboxSourcePanel } from '@components/lightbox/LightboxSourcePanel';
import { LightboxLensesPanel } from '@components/lightbox/LightboxLensesPanel';
import { LightboxBoardMain } from '@components/lightbox/LightboxBoardMain';
import { LightboxInspector } from '@components/lightbox/LightboxInspector';
import { buildFullTabChromeRoutes, useFullTabChrome } from '@hooks/fulltab/useFullTabChrome';
import { useLightbox } from '@hooks/domain/useLightbox';
import { useLightboxFocus } from '@hooks/domain/lightbox/controllers/useLightboxFocus';
import { useLightboxInspector } from '@hooks/domain/lightbox/controllers/useLightboxInspector';
import { MessageHandlerMap, useMessageRouter } from '@hooks/useMessageRouter';
import { usePersistence } from '@hooks/usePersistence';
import { useVSCodeApi } from '@hooks/useVSCodeApi';

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxApp: React.FC = () => {
  const vscode = useVSCodeApi();
  const chrome = useFullTabChrome({ source: 'webview.lightbox' });
  const lightbox = useLightbox();
  const board = lightbox.board ?? null;
  const focus = useLightboxFocus({ board, selected: lightbox.selected, onSelect: lightbox.selectItem });
  const inspector = useLightboxInspector({ board, selected: lightbox.selected, onSelect: lightbox.selectItem });

  const routes = React.useMemo<MessageHandlerMap>(
    () => ({
      ...buildFullTabChromeRoutes(chrome),
      [MessageType.LIGHTBOX_BOARD]: lightbox.handleBoard,
      [MessageType.LIGHTBOX_SOURCE_REFUSED]: lightbox.handleSourceRefused
    }),
    [chrome, lightbox.handleBoard, lightbox.handleSourceRefused]
  );
  useMessageRouter(routes);

  usePersistence({
    ...lightbox.persistedState,
    ...focus.persistedState,
    ...inspector.persistedState,
    ...chrome.persistedState
  });

  const handleBoundaryError = React.useCallback(
    (error: Error, errorInfo: React.ErrorInfo) => {
      vscode.postMessage({
        type: MessageType.WEBVIEW_ERROR,
        source: 'webview.error_boundary',
        payload: {
          message: error.message,
          details: errorInfo.componentStack ?? undefined
        },
        timestamp: Date.now()
      });
    },
    [vscode]
  );

  const source = board?.source ?? null;
  const subtitle = source ? (
    <>
      <Icon name="doc" size={12} />
      {source.displayPath} · {source.wordCount.toLocaleString('en-US')} words
    </>
  ) : (
    'No source yet'
  );

  return (
    <FullTabShell
      brand={{ eyebrow: 'Prose Minion · Inspiration & Mood Board', title: 'Lightbox', subtitle }}
      headerActions={
        <FullTabHeaderStatus
          models={chrome.modelsSettings}
          tokens={chrome.tokenTracking}
          balance={chrome.accountBalance}
        />
      }
      banners={
        chrome.providerPaused && (
          <ProviderPausedBanner
            availabilityNote="The counted board works without one."
            onAddApiKey={chrome.openAssistantSettings}
          />
        )
      }
      rail={{
        label: 'Board rail',
        boundaryName: 'Lightbox rail',
        content: (
          <>
            <LightboxSourcePanel
              source={source}
              rereading={lightbox.rereading}
              onPickFile={lightbox.pickSourceFile}
              onRefresh={lightbox.refreshSource}
            />
            <LightboxLensesPanel lensesOff={lightbox.lensesOff} onToggle={lightbox.toggleLens} />
          </>
        )
      }}
      main={{
        label: 'Board',
        content: (
          <LightboxBoardMain
            board={lightbox.board}
            refusal={lightbox.refusal}
            filter={lightbox.filter}
            lensesOff={lightbox.lensesOff}
            focus={focus}
            onFilter={lightbox.setFilter}
            onPickFile={lightbox.pickSourceFile}
            onDismissRefusal={lightbox.dismissRefusal}
          />
        )
      }}
      aside={{
        label: 'Inspector',
        boundaryName: 'Lightbox inspector',
        content: (
          <LightboxInspector
            view={inspector.view}
            onClear={inspector.clear}
            onPinParagraph={inspector.pinParagraph}
            bind={focus.bind}
          />
        )
      }}
      onBoundaryError={handleBoundaryError}
    />
  );
};
