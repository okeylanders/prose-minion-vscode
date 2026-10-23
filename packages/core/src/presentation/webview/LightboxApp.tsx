/**
 * LightboxApp — the `lightbox` surface's React root (ADR 2026-10-19 D1, D2).
 *
 * The Lightbox renders on the shared FullTabShell: the generic chrome from
 * `useFullTabChrome` (assistant model, processed and balance chips, the
 * provider-paused banner), the source and lenses in the rail, the board in
 * the main column, and the inspector in the aside. Its own state is the
 * `useLightbox` domain hook (the board is host truth; only UI preferences
 * persist) plus two presentation controllers: focus (what the ribbon
 * lights) and the inspector's view model. The run line's view model is
 * derived here from the board, the host's estimate and the run's progress
 * (Slice 2B). Every `MODEL_DATA` reaches both the chrome (the picker) and
 * the Lightbox, which treats it as the host's confirmation of the model and
 * its prices and asks for a fresh estimate (PR #149 F-03 re-review).
 *
 * Each call can also run on its own (Slice 4I): every AI-read widget's
 * Analyze and each call's Run in the Lenses panel come from one view model
 * (`lightboxCallControls`), over the same board, estimate and run state as
 * the run line, and press through the same `run(scope)`. The widgets read it
 * from `LightboxCallControlsProvider`, around the board.
 *
 * "Choose from project…" and the context list's "Add from project…" open the
 * shared project picker (2026-10-20) as an overlay inside the frame:
 * `useLightboxProjectFiles` owns its catalog and routes, and each use's
 * escape hatch is its own system picker. The picker is on the overlay stack,
 * so Escape closes it before the pin.
 *
 * The inspector's passages (Slice 4E) are `useLightboxPassages`'s: a pinned
 * paragraph's text and a pinned counted term's sentences, asked of the host
 * by board id and hash, and never persisted.
 *
 * The rail's saved boards (Slice 5A) are `useLightboxBoards`'s: the shelf of
 * the board on screen, Open, Delete and (Slice 5A.1) Rename. An opened board
 * arrives as any board does; "Read the current text" is the source's own
 * re-read. The changed-file notice above the board is the rail's, from the
 * same shelf (`lightboxChangedFileNotice`), so the two come and go together.
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
import './styles/lightbox/readings.css';
import './styles/lightbox/gravity.css';
import './styles/lightbox/story.css';
import './styles/lightbox/craft.css';
import './styles/lightbox/plot.css';
import './styles/lightbox/opinion.css';
import './styles/lightbox/steering.css';
import './styles/lightbox/boards.css';
import * as React from 'react';
import { MessageType, type LightboxLensId, type ModelDataMessage } from '@messages';
import { FullTabShell } from '@components/fulltab/FullTabShell';
import { FullTabHeaderStatus } from '@components/fulltab/FullTabHeaderStatus';
import { ProviderPausedBanner } from '@components/fulltab/ProviderPausedBanner';
import { Icon } from '@components/shared/Icon';
import { LightboxSourcePanel } from '@components/lightbox/LightboxSourcePanel';
import { LightboxLensesPanel } from '@components/lightbox/LightboxLensesPanel';
import { LightboxContextList } from '@components/lightbox/LightboxContextList';
import { LightboxBoardsPanel } from '@components/lightbox/LightboxBoardsPanel';
import { LightboxBoardMain } from '@components/lightbox/LightboxBoardMain';
import { LightboxInspector } from '@components/lightbox/LightboxInspector';
import { LightboxWorkshopTray } from '@components/lightbox/LightboxWorkshopTray';
import { LightboxProjectPicker } from '@components/lightbox/LightboxProjectPicker';
import type { LightboxOpinionActions } from '@components/lightbox/LightboxOpinion';
import { LightboxCallControlsProvider, type LightboxCallControlsValue } from '@components/lightbox/LightboxCallButton';
import { buildFullTabChromeRoutes, useFullTabChrome } from '@hooks/fulltab/useFullTabChrome';
import { useLightbox } from '@hooks/domain/useLightbox';
import { useLightboxHandoff } from '@hooks/domain/useLightboxHandoff';
import { useLightboxProjectFiles } from '@hooks/domain/useLightboxProjectFiles';
import { useLightboxPassages } from '@hooks/domain/useLightboxPassages';
import { useLightboxBoards } from '@hooks/domain/useLightboxBoards';
import { useLightboxFocus } from '@hooks/domain/lightbox/controllers/useLightboxFocus';
import { useLightboxInspector } from '@hooks/domain/lightbox/controllers/useLightboxInspector';
import { useLightboxEscape } from '@hooks/domain/lightbox/controllers/useLightboxEscape';
import { useLightboxOpinionView } from '@hooks/domain/lightbox/controllers/useLightboxOpinionView';
import {
  buildLightboxRunLine,
  lightboxCallsNote,
  lightboxRereadAvailability
} from '@hooks/domain/lightbox/lightboxRunLine';
import { lightboxCallControls } from '@hooks/domain/lightbox/lightboxCallControls';
import { lightboxBuildLensView } from '@hooks/domain/lightbox/lightboxHandoff';
import { lightboxBringView } from '@hooks/domain/lightbox/lightboxBring';
import { lightboxChangedFileNotice } from '@hooks/domain/lightbox/lightboxBoardsView';
import { MessageHandlerMap, useMessageRouter } from '@hooks/useMessageRouter';
import { usePersistence } from '@hooks/usePersistence';
import { useVSCodeApi } from '@hooks/useVSCodeApi';

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxApp: React.FC = () => {
  const vscode = useVSCodeApi();
  const chrome = useFullTabChrome({ source: 'webview.lightbox' });
  const lightbox = useLightbox({ assistantModel: chrome.modelsSettings.modelSelections.assistant });
  const board = lightbox.board ?? null;
  const handoffs = useLightboxHandoff({ boardId: board?.boardId });
  const projectFiles = useLightboxProjectFiles();
  const focus = useLightboxFocus({ board, selected: lightbox.selected, onSelect: lightbox.selectItem });
  const inspector = useLightboxInspector({ board, selected: lightbox.selected, onSelect: lightbox.selectItem });
  // The pin's text: a paragraph whole, or a counted term's sentences, from the host (Slice 4E).
  const passages = useLightboxPassages({ board, selected: lightbox.selected });
  // The rail's saved boards (Slice 5A): the shelf of the board on screen, Open and Delete.
  const savedBoards = useLightboxBoards({ board });
  // Enter pins (every item is a button); Escape lets go, once every overlay has had its turn.
  const escape = useLightboxEscape({ pinned: lightbox.selected !== null, onClear: inspector.clear });
  // The Opinion's view the writer chose on this board: a webview preference only (Slice 4D).
  const opinionView = useLightboxOpinionView({ boardId: board?.boardId });

  const routes = React.useMemo<MessageHandlerMap>(() => {
    const chromeRoutes = buildFullTabChromeRoutes(chrome);
    const chromeModelData = chromeRoutes[MessageType.MODEL_DATA];
    return {
      ...chromeRoutes,
      // The picker takes the confirmed selection; the Lightbox re-estimates against it.
      [MessageType.MODEL_DATA]: (message: ModelDataMessage) => {
        chromeModelData?.(message);
        lightbox.handleModelData(message);
      },
      [MessageType.LIGHTBOX_BOARD]: lightbox.handleBoard,
      [MessageType.LIGHTBOX_SOURCE_REFUSED]: lightbox.handleSourceRefused,
      [MessageType.LIGHTBOX_RUN_ESTIMATE]: lightbox.handleRunEstimate,
      [MessageType.LIGHTBOX_RUN_PROGRESS]: lightbox.handleRunProgress,
      [MessageType.LIGHTBOX_GROUP_RESULT]: lightbox.handleGroupResult,
      [MessageType.LIGHTBOX_CONTEXT_FILES]: lightbox.handleContextFiles,
      [MessageType.LIGHTBOX_HAND_OFF_RESULT]: handoffs.handleHandOffResult,
      [MessageType.LIGHTBOX_WORKSHOP_TRAY]: handoffs.handleWorkshopTray,
      [MessageType.LIGHTBOX_PROJECT_CATALOG]: projectFiles.handleCatalog,
      [MessageType.LIGHTBOX_PROJECT_CATALOG_SEARCH_RESULTS]: projectFiles.handleSearchResults,
      [MessageType.LIGHTBOX_PASSAGE]: passages.handlePassage,
      [MessageType.LIGHTBOX_BOARDS]: savedBoards.handleBoards
    };
  }, [
    chrome,
    passages.handlePassage,
    savedBoards.handleBoards,
    projectFiles.handleCatalog,
    projectFiles.handleSearchResults,
    lightbox.handleBoard,
    lightbox.handleSourceRefused,
    lightbox.handleRunEstimate,
    lightbox.handleRunProgress,
    lightbox.handleGroupResult,
    lightbox.handleContextFiles,
    handoffs.handleHandOffResult,
    handoffs.handleWorkshopTray,
    lightbox.handleModelData
  ]);
  useMessageRouter(routes);

  const runLine = React.useMemo(
    () => (board
      ? buildLightboxRunLine({
          board,
          estimate: lightbox.estimate,
          progress: lightbox.progress,
          activeRun: lightbox.activeRun,
          awaitingStart: lightbox.awaitingStart,
          providerPaused: chrome.providerPaused
        })
      : null),
    [board, chrome.providerPaused, lightbox.activeRun, lightbox.awaitingStart, lightbox.estimate, lightbox.progress]
  );
  const running = runLine?.status === 'running';
  const { estimate, lensesOff, run } = lightbox;
  // Each call's own run (Slice 4I): every widget's Analyze and each call's Run, over what the run line reads.
  const callControls = React.useMemo<LightboxCallControlsValue | null>(() => (board
    ? { controls: lightboxCallControls({ board, estimate, lensesOff, providerPaused: chrome.providerPaused, running }), onRun: run }
    : null), [board, chrome.providerPaused, estimate, lensesOff, run, running]);
  const reread = React.useMemo(() => {
    const availability = (lens: LightboxLensId) =>
      lightboxRereadAvailability({ estimate, lens, lensesOff, providerPaused: chrome.providerPaused, running });
    return {
      note: (lens: LightboxLensId) => availability(lens).note,
      reason: (lens: LightboxLensId) => availability(lens).reason,
      onReread: (lens: LightboxLensId) => run({ mode: 'lens', lens })
    };
  }, [chrome.providerPaused, estimate, lensesOff, run, running]);

  const { handoff, tray, buildLens: requestBuildLens, bringTile, openWorkshop } = handoffs;
  const buildLens = React.useMemo(() => (board
    ? {
        view: (field: Parameters<typeof lightboxBuildLensView>[1]) => lightboxBuildLensView(board, field, handoff),
        onBuild: requestBuildLens
      }
    : undefined), [board, handoff, requestBuildLens]);

  // Bring to Workshop (Slice 4): the inspector's action and the spark lane's, from one view.
  // The Opinion brings the view on show, by name (Slice 4D).
  const { chosen: opinionChosen, choose: chooseOpinionView } = opinionView;
  const bring = React.useMemo(() => (board
    ? {
        view: (tile: Parameters<typeof lightboxBringView>[1]) => lightboxBringView(board, tile, handoff, tray, opinionChosen),
        onBring: (tileId: string) => bringTile(tileId, opinionChosen),
        onOpenWorkshop: openWorkshop
      }
    : undefined), [board, bringTile, handoff, openWorkshop, opinionChosen, tray]);

  const { setSparkDismissed } = lightbox;
  // The Opinion's tabs and its Bring (Slice 4D); its Analyze is its frame's (Slice 4I).
  const opinionActions = React.useMemo<LightboxOpinionActions>(() => ({
    chosen: opinionChosen,
    onChoose: chooseOpinionView,
    ...(board
      ? { bring: { view: (tile, view) => lightboxBringView(board, tile, handoff, tray, view), onBring: bringTile, onOpenWorkshop: openWorkshop } }
      : {})
  }), [board, bringTile, chooseOpinionView, handoff, openWorkshop, opinionChosen, tray]);
  const tileActions = React.useMemo(() => ({
    opinion: opinionActions,
    onDismissSpark: setSparkDismissed,
    bringSpark: bring && {
      view: (spark: Parameters<typeof lightboxBringView>[1]) => {
        const view = bring.view(spark);
        // Under a card, only what happened: on its way, refused, or where it waits.
        return { label: view.label, disabled: view.disabled, pressed: view.state === 'bound', note: view.state === 'ready' ? undefined : view.note };
      },
      onBring: bring.onBring
    }
  }), [bring, opinionActions, setSparkDismissed]);

  usePersistence({
    ...lightbox.persistedState,
    ...handoffs.persistedState,
    ...projectFiles.persistedState,
    ...focus.persistedState,
    ...inspector.persistedState,
    ...passages.persistedState,
    ...savedBoards.persistedState,
    ...escape.persistedState,
    ...opinionView.persistedState,
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

  const { open: openProjectPicker } = projectFiles;
  const chooseFromProject = React.useCallback(() => openProjectPicker('source'), [openProjectPicker]);
  const addContextFromProject = React.useCallback(() => openProjectPicker('context'), [openProjectPicker]);

  // The rail's changed-file notice, shown above the board too: one shelf, so the two agree (Slice 5A.1).
  const { shelf: savedShelf } = savedBoards;
  const changedFile = React.useMemo(() => {
    const view = lightboxChangedFileNotice(savedShelf);
    return view && { view, rereading: lightbox.rereading, onReadCurrentText: lightbox.refreshSource };
  }, [lightbox.refreshSource, lightbox.rereading, savedShelf]);

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
        <>
          <LightboxWorkshopTray tiles={tray} onOpenWorkshop={openWorkshop} />
          <FullTabHeaderStatus
            models={chrome.modelsSettings}
            tokens={chrome.tokenTracking}
            balance={chrome.accountBalance}
          />
        </>
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
              onChooseFromProject={chooseFromProject}
              onRefresh={lightbox.refreshSource}
            />
            <LightboxBoardsPanel
              key={board?.boardId ?? 'none'}
              shelf={savedBoards.shelf}
              hasBoard={board !== null}
              opening={savedBoards.opening}
              rereading={lightbox.rereading}
              onOpen={savedBoards.openBoard}
              onDelete={savedBoards.deleteBoard}
              onRename={savedBoards.renameBoard}
              onReadCurrentText={lightbox.refreshSource}
            />
            <LightboxContextList
              context={lightbox.context}
              onAddFromProject={addContextFromProject}
              onRemove={lightbox.removeContextFile}
            />
            <LightboxLensesPanel
              lensesOff={lightbox.lensesOff}
              costNote={lightbox.estimate === undefined ? 'Estimating…' : lightboxCallsNote(lightbox.estimate?.groups ?? [])}
              calls={callControls ? { controls: callControls.controls.group, onRun: callControls.onRun } : undefined}
              onToggle={lightbox.toggleLens}
            />
          </>
        )
      }}
      main={{
        label: 'Board',
        content: (
          <LightboxCallControlsProvider value={callControls}>
            <LightboxBoardMain
              board={lightbox.board}
              refusal={lightbox.refusal}
              filter={lightbox.filter}
              lensesOff={lightbox.lensesOff}
              focus={focus}
              runLine={runLine}
              onFilter={lightbox.setFilter}
              onChooseFromProject={chooseFromProject}
              onDismissRefusal={lightbox.dismissRefusal}
              onRun={lightbox.run}
              onStop={lightbox.cancelRun}
              actions={tileActions}
              changedFile={changedFile}
            />
          </LightboxCallControlsProvider>
        )
      }}
      aside={{
        label: 'Inspector',
        boundaryName: 'Lightbox inspector',
        content: (
          <LightboxInspector
            view={inspector.view}
            paragraphPage={inspector.paragraphPage}
            onClear={inspector.clear}
            onPinParagraph={inspector.pinParagraph}
            onShowParagraphPage={inspector.showParagraphPage}
            onJumpToParagraph={inspector.jumpToParagraph}
            bind={focus.bind}
            reread={reread}
            buildLens={buildLens}
            bring={bring}
            passage={passages.well}
          />
        )
      }}
      onBoundaryError={handleBoundaryError}
    >
      <LightboxProjectPicker
        picker={projectFiles.openPicker}
        catalog={projectFiles.catalog}
        catalogUnreadable={projectFiles.catalogUnreadable}
        searchResults={projectFiles.searchResults}
        context={lightbox.context}
        onSearch={projectFiles.search}
        onClearSearch={projectFiles.clearSearch}
        onChooseSource={projectFiles.chooseSource}
        onExploreSource={lightbox.pickSourceFile}
        onAddContext={projectFiles.addContext}
        onExploreContext={lightbox.addContextFile}
        onClose={projectFiles.close}
      />
    </FullTabShell>
  );
};
