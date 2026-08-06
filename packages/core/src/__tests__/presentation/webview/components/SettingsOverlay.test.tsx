/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SettingsOverlay } from '@components/SettingsOverlay';

describe('SettingsOverlay', () => {
  afterEach(cleanup);

  it('surfaces the dedicated Widget Model selection', () => {
    const onModelChange = jest.fn();
    const emptySettingsHook = {
      settings: new Proxy({}, { get: () => '' }),
      updateSetting: jest.fn()
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
      />
    );

    const widgetLabel = screen.getByText('Widget Model').closest('label');
    const widgetSelect = widgetLabel?.querySelector('select') as HTMLSelectElement;
    expect(widgetSelect.value).toBe('anthropic/claude-sonnet-5');

    fireEvent.change(widgetSelect, { target: { value: 'anthropic/claude-haiku-4.5' } });
    expect(onModelChange).toHaveBeenCalledWith('widget', 'anthropic/claude-haiku-4.5');
  });
});
