/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  WorkshopStandingDirectiveRail
} from '@components/workshop/WorkshopStandingDirectiveRail';

describe('WorkshopStandingDirectiveRail', () => {
  afterEach(cleanup);

  it('keeps the active influence visible, editable, and killable', () => {
    const onEdit = jest.fn();
    const onRemove = jest.fn();
    const formatSummary = jest.fn().mockReturnValue('Photography · 60% · 2° · metaphor');
    render(<WorkshopStandingDirectiveRail
      directives={[{
        id: 'pd-1',
        family: 'lexical-gravity',
        widgetId: 'lexical-gravity',
        widgetConfigId: 'wc-1',
        revision: 2,
        updatedAt: 100,
        lensName: 'Photography',
        weight: 60,
        reach: 2,
        metaphorPull: true
      }]}
      formatSummary={formatSummary}
      onEdit={onEdit}
      onRemove={onRemove}
    />);

    expect(screen.getByLabelText('Active prose directives')).toBeTruthy();
    expect(screen.getByText('Photography · 60% · 2° · metaphor')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Lexical Gravity' }));
    expect(onEdit).toHaveBeenCalledWith('wc-1');
    expect(onRemove).toHaveBeenCalledWith(expect.objectContaining({
      family: 'lexical-gravity',
      widgetId: 'lexical-gravity'
    }));
    expect(formatSummary).toHaveBeenCalledWith(expect.objectContaining({
      family: 'lexical-gravity'
    }));
  });

  it('disables only the directive whose removal is pending', () => {
    render(<WorkshopStandingDirectiveRail
      directives={[{
        id: 'pd-1',
        family: 'lexical-gravity',
        widgetId: 'lexical-gravity',
        widgetConfigId: 'wc-1',
        revision: 2,
        updatedAt: 100,
        lensName: 'Photography',
        weight: 60,
        reach: 2,
        metaphorPull: true
      }]}
      removingWidgetIds={['lexical-gravity']}
      formatSummary={() => 'Photography'}
      onEdit={jest.fn()}
      onRemove={jest.fn()}
    />);

    expect((screen.getByRole('button', {
      name: 'Remove Lexical Gravity'
    }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Edit' }) as HTMLButtonElement).disabled)
      .toBe(false);
  });
});
