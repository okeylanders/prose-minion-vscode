/**
 * @jest-environment jsdom
 */

/**
 * One Escape closes only the Workshop surface on top (PR #150 F-02). Before,
 * every open shell closed on the same key, so a sheet that opened over Add
 * text took the writer's typed draft down with it. Here the real Add text
 * sheet lies under a second shell; the text is from "Alice's Adventures in
 * Wonderland" (1865, public domain).
 */

import * as React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WorkshopModalShell } from '@components/workshop/WorkshopModalShell';
import { WorkshopTextSheet } from '@components/workshop/WorkshopTextSheet';
import { __resetOverlayFocusStateForTests, isAnyOverlayOpen } from '@hooks/useOverlayDismiss';

const DRAFT = 'Down, down, down. Would the fall never come to an end!';

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const Stack: React.FC<{ onCloseText: jest.Mock; onCloseTop: jest.Mock }> = ({ onCloseText, onCloseTop }) => {
  const [textOpen, setTextOpen] = React.useState(true);
  const [topOpen, setTopOpen] = React.useState(false);
  return (
    <>
      <WorkshopTextSheet
        open={textOpen}
        mode={{ kind: 'context-new' }}
        value=""
        onApply={jest.fn()}
        onClose={() => {
          onCloseText();
          setTextOpen(false);
        }}
      />
      <button type="button" onClick={() => setTopOpen(true)}>Open the top sheet</button>
      <WorkshopModalShell
        open={topOpen}
        titleId="top-sheet-title"
        closeLabel="Close top sheet"
        onClose={() => {
          onCloseTop();
          setTopOpen(false);
        }}
      >
        <h2 id="top-sheet-title">Top sheet</h2>
        <WorkshopModalShell.CloseButton />
      </WorkshopModalShell>
    </>
  );
};

describe('Workshop overlay stack', () => {
  afterEach(() => {
    cleanup();
    __resetOverlayFocusStateForTests();
  });

  const escape = () => act(() => {
    fireEvent.keyDown(window, { key: 'Escape' });
  });

  it('sends one Escape to the sheet on top only, and leaves the draft beneath it intact', () => {
    const onCloseText = jest.fn();
    const onCloseTop = jest.fn();
    render(<Stack onCloseText={onCloseText} onCloseTop={onCloseTop} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: DRAFT } });
    fireEvent.click(screen.getByRole('button', { name: 'Open the top sheet' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(2);

    escape();
    expect(onCloseTop).toHaveBeenCalledTimes(1);
    expect(onCloseText).not.toHaveBeenCalled();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(DRAFT);
    expect(isAnyOverlayOpen()).toBe(true);

    // The next Escape belongs to the sheet that is now on top.
    escape();
    expect(onCloseText).toHaveBeenCalledTimes(1);
    expect(screen.queryAllByRole('dialog')).toEqual([]);
    expect(isAnyOverlayOpen()).toBe(false);

    // With nothing open, Escape closes nothing.
    escape();
    expect(onCloseTop).toHaveBeenCalledTimes(1);
    expect(onCloseText).toHaveBeenCalledTimes(1);
  });
});
