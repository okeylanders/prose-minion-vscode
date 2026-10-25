/** @jest-environment jsdom */

/**
 * The Analysis tab's editor-tab launchers: Workshop and, beside it, Lightbox
 * (launch entry points, 2026-10-20). Each posts its own zero-payload envelope;
 * UIHandler routes it to the host's open action (see UIHandler.test.ts).
 */

import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { AnalysisTab } from '@components/tabs/AnalysisTab';
import { useAnalysis } from '@hooks/domain/useAnalysis';
import { useContext } from '@hooks/domain/useContext';
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
    return (
      <AnalysisTab
        vscode={vscode}
        analysis={analysis}
        context={context}
        selection={selection}
        modelsSettings={modelsSettings}
        settings={settings}
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

  it('shows Lightbox next to Workshop in the title row, with the same style', () => {
    render(<AnalysisHarness />);

    const buttons = within(titleRow()).getAllByRole('button');
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Workshop', 'Lightbox']);
    expect(buttons.map((button) => button.className)).toEqual([
      'btn btn-secondary surface-launch-button',
      'btn btn-secondary surface-launch-button'
    ]);
    expect(buttons[1].getAttribute('title')).toBe('Open the Lightbox editor tab');
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
