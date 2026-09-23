/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ModelBrowserModal } from '@components/shared/ModelBrowserModal';

describe('ModelBrowserModal', () => {
  afterEach(cleanup);

  it('renders published and undisclosed parameter-count tags', () => {
    render(
      <ModelBrowserModal
        open
        scope="assistant"
        label="Assistant Model"
        value="deepseek/deepseek-r1"
        onClose={jest.fn()}
        onSelect={jest.fn()}
        options={[
          {
            id: 'deepseek/deepseek-r1',
            label: 'DeepSeek R1',
            provider: 'deepseek',
            family: 'DeepSeek',
            parameterCount: {
              label: '671B params · 37B active',
              confidence: 'published'
            }
          },
          {
            id: 'anthropic/claude-fable-5.1',
            label: 'Claude Fable 5.1',
            provider: 'anthropic',
            family: 'Claude Fable',
            parameterCount: {
              label: 'params undisclosed',
              confidence: 'undisclosed'
            }
          }
        ]}
      />
    );

    expect(screen.getByText('671B params · 37B active').getAttribute('title')).toMatch(/published/i);
    expect(screen.getByText('params undisclosed').getAttribute('title')).toMatch(/not published/i);

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '671B' } });
    expect(screen.getByText('DeepSeek R1')).toBeTruthy();
    expect(screen.queryByText('Claude Fable 5.1')).toBeNull();
  });

  it('falls back to an undisclosed tag for older or custom options', () => {
    render(
      <ModelBrowserModal
        open
        scope="assistant"
        label="Assistant Model"
        onClose={jest.fn()}
        onSelect={jest.fn()}
        options={[{ id: 'custom/model', label: 'Custom Model' }]}
      />
    );

    expect(screen.getByText('params undisclosed')).toBeTruthy();
  });

  it('groups releases by descending month and sequences each month by descending day', () => {
    render(
      <ModelBrowserModal
        open
        scope="assistant"
        label="Assistant Model"
        onClose={jest.fn()}
        onSelect={jest.fn()}
        options={[
          { id: 'model/august', label: 'August Model', releaseDate: '2026-08-30' },
          { id: 'model/september-early', label: 'September Early', releaseDate: '2026-09-03' },
          { id: 'model/unknown', label: 'Unknown Date' },
          { id: 'model/september-late', label: 'September Late', releaseDate: '2026-09-22' }
        ]}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: 'By Release Date' }));

    const headings = Array.from(document.querySelectorAll('.mb-rule .pm-eyebrow'))
      .map(element => element.textContent);
    expect(headings).toEqual([
      'September 2026',
      'August 2026',
      'Release date unavailable'
    ]);

    const modelNames = Array.from(document.querySelectorAll('.mb-card .tm-n'))
      .map(element => element.textContent);
    expect(modelNames).toEqual([
      'September Late',
      'September Early',
      'August Model',
      'Unknown Date'
    ]);
    expect(screen.getByText('Sep 22, 2026')).toBeTruthy();
  });
});
