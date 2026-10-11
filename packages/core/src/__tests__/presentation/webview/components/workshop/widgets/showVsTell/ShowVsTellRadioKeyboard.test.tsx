/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type {
  WorkshopShowVsTellLengthBudget
} from '@messages';
import type { NarrativeHandlingPosition } from '@shared/constants/narrativeHandlingVocabulary';
import {
  ShowVsTellChannelsBudget
} from '@components/workshop/widgets/showVsTell/ShowVsTellChannelsBudget';
import {
  ShowVsTellContinuumControl
} from '@components/workshop/widgets/showVsTell/ShowVsTellContinuumControl';

/** Stateful hosts, so selection follows the keys exactly as the controller would. */
const Continuum: React.FC<{ onChange?: (p: NarrativeHandlingPosition) => void }> = ({ onChange }) => {
  const [position, setPosition] = React.useState<NarrativeHandlingPosition>('hinge');
  return (
    <ShowVsTellContinuumControl
      position={position}
      onPositionChange={(next) => { setPosition(next); onChange?.(next); }}
    />
  );
};

const Budget: React.FC<{ disabled?: boolean }> = ({ disabled = false }) => {
  const [budget, setBudget] = React.useState<WorkshopShowVsTellLengthBudget>('same-length');
  return (
    <ShowVsTellChannelsBudget
      channels={['observable-action']}
      lengthBudget={budget}
      pov={{ mode: 'unspecified', focalCharacter: '' }}
      disabled={disabled}
      onToggleChannel={jest.fn()}
      onLengthBudgetChange={setBudget}
    />
  );
};

const radios = (name: string): HTMLElement[] =>
  within(screen.getByRole('radiogroup', { name })).getAllByRole('radio');

const checked = (name: string): string =>
  radios(name).find((radio) => radio.getAttribute('aria-checked') === 'true')!
    .textContent!;

describe.each([
  {
    group: 'Position on the continuum',
    mount: () => render(<Continuum />),
    startIndex: 2,
    names: ['State it', 'Summarize', 'Hinge', 'Evidence', 'Inhabit']
  },
  {
    group: 'Length budget',
    mount: () => render(<Budget />),
    startIndex: 1,
    names: ['tighter', 'same length', '+1 sentence', '+1 paragraph']
  }
])('$group keyboard pattern', ({ group, mount, startIndex, names }) => {
  afterEach(cleanup);

  const label = (index: number): string => names[(index + names.length) % names.length];
  const press = (key: string): void => {
    fireEvent.keyDown(document.activeElement as HTMLElement, { key });
  };

  it('exposes one tab stop on the selected option and takes the rest out of the tab order', () => {
    mount();
    const options = radios(group);

    expect(options.map((radio) => radio.tabIndex))
      .toEqual(options.map((_radio, index) => (index === startIndex ? 0 : -1)));
    expect(options.filter((radio) => radio.tabIndex === 0)).toHaveLength(1);
  });

  it('moves focus and selection forward with ArrowRight and ArrowDown', () => {
    mount();
    radios(group)[startIndex].focus();

    press('ArrowRight');
    expect(checked(group)).toContain(label(startIndex + 1));
    expect(document.activeElement).toBe(radios(group)[startIndex + 1]);
    press('ArrowDown');
    expect(checked(group)).toContain(label(startIndex + 2));
  });

  it('moves focus and selection back with ArrowLeft and ArrowUp', () => {
    mount();
    radios(group)[startIndex].focus();

    press('ArrowLeft');
    expect(checked(group)).toContain(label(startIndex - 1));
    expect(document.activeElement).toBe(radios(group)[startIndex - 1]);
    press('ArrowUp');
    expect(checked(group)).toContain(label(startIndex - 2));
  });

  it('wraps around at both ends', () => {
    mount();
    radios(group)[startIndex].focus();
    for (let step = 0; step < names.length - startIndex - 1; step += 1) {
      press('ArrowRight');
    }
    expect(checked(group)).toContain(label(names.length - 1));

    press('ArrowRight');
    expect(checked(group)).toContain(label(0));
    expect(document.activeElement).toBe(radios(group)[0]);

    press('ArrowLeft');
    expect(checked(group)).toContain(label(names.length - 1));
    expect(document.activeElement).toBe(radios(group)[names.length - 1]);
  });

  it('jumps to the ends with Home and End and keeps one tab stop on the new selection', () => {
    mount();
    radios(group)[startIndex].focus();

    press('End');
    expect(checked(group)).toContain(label(names.length - 1));
    expect(radios(group).filter((radio) => radio.tabIndex === 0)).toEqual([
      radios(group)[names.length - 1]
    ]);
    press('Home');
    expect(checked(group)).toContain(label(0));
  });

  it('leaves unrelated keys alone and still selects on click', () => {
    mount();
    radios(group)[startIndex].focus();

    const untouched = fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'a' });
    expect(untouched).toBe(true);
    expect(checked(group)).toContain(label(startIndex));

    fireEvent.click(radios(group)[0]);
    expect(checked(group)).toContain(label(0));
  });
});

describe('length budget disabled state', () => {
  afterEach(cleanup);

  it('has no tab stop and ignores arrow keys while generation locks the sheet', () => {
    render(<Budget disabled />);
    const options = radios('Length budget');

    expect(options.every((radio) => (radio as HTMLButtonElement).disabled)).toBe(true);
    expect(options.every((radio) => radio.tabIndex === -1 || (radio as HTMLButtonElement).disabled)).toBe(true);
    fireEvent.keyDown(options[1], { key: 'ArrowRight' });
    expect(checked('Length budget')).toContain('same length');
  });
});

describe('continuum position changes', () => {
  afterEach(cleanup);

  it('raises exactly the keyboard-chosen position, in telling → showing order', () => {
    const onChange = jest.fn();
    render(<Continuum onChange={onChange} />);
    radios('Position on the continuum')[2].focus();

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowRight' });
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowRight' });

    expect(onChange.mock.calls.map(([position]) => position)).toEqual(['evidence', 'inhabit']);
  });
});
