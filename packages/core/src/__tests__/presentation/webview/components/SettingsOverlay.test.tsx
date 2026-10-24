/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SettingsOverlay } from '@components/SettingsOverlay';

type OverlayOverrides = Partial<React.ComponentProps<typeof SettingsOverlay>>;

describe('SettingsOverlay', () => {
  afterEach(cleanup);

  const renderOverlay = (overrides: OverlayOverrides = {}) => {
    const onModelChange = jest.fn();
    const onFollowModel = jest.fn();
    const updateSetting = jest.fn();
    const emptySettingsHook = {
      settings: new Proxy({}, { get: () => '' }),
      updateSetting
    };

    render(
      <SettingsOverlay
        visible
        onClose={jest.fn()}
        vscode={{ postMessage: jest.fn(), getState: jest.fn(), setState: jest.fn() }}
        modelsSettings={{
          ...emptySettingsHook,
          settings: {
            assistantModel: 'anthropic/claude-sonnet-5',
            dictionaryModel: 'anthropic/claude-haiku-4.5',
            contextModel: 'openai/gpt-5.4',
            categoryModel: 'anthropic/claude-sonnet-5',
            widgetModel: 'anthropic/claude-sonnet-5',
            includeCraftGuides: true,
            temperature: 0.7,
            maxTokens: 10_000,
            claudeCacheTtl: '5m',
            applyContextWindowTrimming: true
          }
        } as any}
        tokensSettings={emptySettingsHook as any}
        tokenTracking={{ resetTokens: jest.fn() } as any}
        contextPathsSettings={emptySettingsHook as any}
        wordFrequencySettings={emptySettingsHook as any}
        wordSearchSettings={emptySettingsHook as any}
        modelOptions={[
          { id: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5' },
          { id: 'anthropic/claude-haiku-4.5', label: 'Claude Haiku 4.5' }
        ] as any}
        modelSelections={{
          assistant: 'anthropic/claude-sonnet-5',
          dictionary: 'anthropic/claude-haiku-4.5',
          context: 'openai/gpt-5.4',
          category: 'anthropic/claude-sonnet-5',
          widget: 'anthropic/claude-sonnet-5'
        }}
        onModelChange={onModelChange}
        followingModelScopes={['lightbox']}
        onFollowModel={onFollowModel}
        publishing={{
          preset: 'none',
          trimKey: '',
          genres: [],
          onPresetChange: jest.fn(),
          onTrimChange: jest.fn()
        }}
        apiKey={{
          input: '',
          hasSavedKey: false,
          onInputChange: jest.fn(),
          onSave: jest.fn(),
          onDelete: jest.fn()
        }}
        {...overrides}
      />
    );
    return { onModelChange, onFollowModel, updateSetting };
  };

  it('surfaces the dedicated Widget Model selection', () => {
    const { onModelChange, updateSetting } = renderOverlay();

    const widgetLabel = screen.getByText('Widget Model').closest('label');
    const widgetSelect = widgetLabel?.querySelector('select') as HTMLSelectElement;
    expect(widgetSelect.value).toBe('anthropic/claude-sonnet-5');

    fireEvent.change(widgetSelect, { target: { value: 'anthropic/claude-haiku-4.5' } });
    expect(onModelChange).toHaveBeenCalledWith('widget', 'anthropic/claude-haiku-4.5');
    const cacheSelect = screen.getByText('Claude Cache Duration').closest('label')?.querySelector('select')!;
    expect(cacheSelect.value).toBe('5m');
    fireEvent.change(cacheSelect, { target: { value: '1h' } });
    expect(updateSetting).toHaveBeenCalledWith('claudeCacheTtl', '1h');
    expect(screen.getByText(/one-hour writes cost 2×/)).toBeTruthy();
  });

  /** The Lightbox's own model (Slice 4L): placeholder ids for the Workshop's and the Lightbox's. */
  describe('the Lightbox Model row (Slice 4L)', () => {
    const WORKSHOP = 'placeholder/workshop-model';
    const LIGHTBOX = 'placeholder/lightbox-model';
    const modelOptions = [
      { id: WORKSHOP, label: 'Workshop placeholder' },
      { id: LIGHTBOX, label: 'Lightbox placeholder' }
    ];
    const lightboxSelect = () =>
      screen.getByText('Lightbox Model').closest('label')?.querySelector('select') as HTMLSelectElement;

    it('shows "Same as Workshop" with the Workshop’s model while the Lightbox has none of its own', () => {
      renderOverlay({ modelOptions, modelSelections: { assistant: WORKSHOP, lightbox: WORKSHOP }, followingModelScopes: ['lightbox'] });

      const select = lightboxSelect();
      expect(select.value).toBe('');
      expect(select.selectedOptions[0].textContent).toBe('Same as Workshop (Workshop placeholder)');
      expect(screen.getByText(/uses the Assistant Model above and follows it when it changes/)).toBeTruthy();
    });

    it('picks a model of its own on the lightbox scope, and goes back with "Same as Workshop"', () => {
      const { onModelChange, onFollowModel } = renderOverlay({
        modelOptions, modelSelections: { assistant: WORKSHOP, lightbox: LIGHTBOX }, followingModelScopes: []
      });

      const select = lightboxSelect();
      expect(select.value).toBe(LIGHTBOX);
      fireEvent.change(select, { target: { value: WORKSHOP } });
      expect(onModelChange).toHaveBeenLastCalledWith('lightbox', WORKSHOP);
      expect(onModelChange).not.toHaveBeenCalledWith('assistant', expect.anything());

      fireEvent.change(select, { target: { value: '' } });
      expect(onFollowModel).toHaveBeenCalledWith('lightbox');
      expect(onModelChange).toHaveBeenCalledTimes(1);
    });

    it('offers no "Same as" choice on a scope that follows nothing', () => {
      renderOverlay({ modelOptions, modelSelections: { assistant: WORKSHOP } });

      const assistant = screen.getByText('Assistant Model (Prose / Dialogue)').closest('label')?.querySelector('select') as HTMLSelectElement;
      expect([...assistant.options].filter((option) => option.value === '' || /Same as/.test(option.textContent ?? ''))).toEqual([]);
      expect(assistant.value).toBe(WORKSHOP);
    });
  });
});
