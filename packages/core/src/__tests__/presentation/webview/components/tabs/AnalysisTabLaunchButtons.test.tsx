/** @jest-environment jsdom */

/**
 * The Analysis tab's editor-tab launchers: Workshop and, beside it, Lightbox
 * (launch entry points, 2026-10-20). The split Workshop control can request a fresh room;
 * UIHandler routes it to the host's open action (see UIHandler.test.ts).
 */

import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { AnalysisTab } from '@components/tabs/AnalysisTab';
import { useAnalysis } from '@hooks/domain/useAnalysis';
import { useContext } from '@hooks/domain/useContext';
import { useUnsavedWorkshopSessions } from '@hooks/domain/useUnsavedWorkshopSessions';
import { useModelsSettings } from '@hooks/domain/useModelsSettings';
import { useSelection } from '@hooks/domain/useSelection';
import { useSettings } from '@hooks/domain/useSettings';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { MessageType } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

describe('AnalysisTab launch buttons', () => {
  let vscode: ReturnType<typeof createMockVSCode>;

  // eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
  function AnalysisHarness() {
    const analysis = useAnalysis();
    const context = useContext();
    const selection = useSelection();
    const modelsSettings = useModelsSettings();
    const settings = useSettings();
    const unsavedSessions = useUnsavedWorkshopSessions();
    return (
      <AnalysisTab
        vscode={vscode}
        analysis={analysis}
        context={context}
        selection={selection}
        modelsSettings={modelsSettings}
        settings={settings}
        unsavedSessions={unsavedSessions}
        onManageUnsavedSessions={settings.open}
      />
    );
  }

  const titleRow = () => {
    const heading = screen.getByRole('heading', { name: 'Prose Excerpt Assistant' });
    return heading.parentElement as HTMLElement;
  };

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('groups the Workshop actions beside Lightbox and requests a fresh tab on each plus click', () => {
    render(<AnalysisHarness />);
    const row = within(titleRow());
    const workshop = within(row.getByRole('group', { name: 'Workshop tabs' }));
    const add = workshop.getByRole('button', { name: 'New Workshop tab' });
    expect(row.getAllByRole('button')).toEqual([
      workshop.getByRole('button', { name: 'Workshop' }), add, workshop.getByRole('button', { name: 'Unsaved Sessions' }),
      row.getByRole('button', { name: 'Lightbox' })
    ]);
    vscode.postMessage.mockClear();
    fireEvent.click(add);
    fireEvent.click(add);
    expect(vscode.postMessage.mock.calls.map(([message]) => message)).toEqual(
      Array(2).fill(expect.objectContaining({ type: MessageType.OPEN_WORKSHOP, payload: { newTab: true } }))
    );
  });

  it('posts OPEN_LIGHTBOX from the Analysis tab', () => {
    render(<AnalysisHarness />);
    vscode.postMessage.mockClear();

    fireEvent.click(within(titleRow()).getByRole('button', { name: 'Lightbox' }));

    expect(vscode.postMessage).toHaveBeenCalledTimes(1);
    expect(vscode.postMessage).toHaveBeenCalledWith({
      type: MessageType.OPEN_LIGHTBOX,
      source: 'webview.analysis.tab',
      payload: {},
      timestamp: expect.any(Number)
    });
  });

  it('still posts OPEN_WORKSHOP from the Workshop button', () => {
    render(<AnalysisHarness />);
    vscode.postMessage.mockClear();

    fireEvent.click(within(titleRow()).getByRole('button', { name: 'Workshop' }));

    expect(vscode.postMessage).toHaveBeenCalledTimes(1);
    expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.OPEN_WORKSHOP,
      source: 'webview.analysis.tab',
      payload: {}
    }));
  });
});
