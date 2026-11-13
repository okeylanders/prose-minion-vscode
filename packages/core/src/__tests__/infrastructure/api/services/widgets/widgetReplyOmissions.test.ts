import { fillOmittedEmpties } from '@services/widgets/widgetReplyOmissions';

describe('fillOmittedEmpties', () => {
  it('gives an absent field its empty value and reports it', () => {
    const omitted: string[] = [];
    const filled = fillOmittedEmpties(
      { text: 'kept' },
      { flags: 'list', dynamic: 'null' },
      (field) => omitted.push(field)
    );

    expect(filled).toEqual({ text: 'kept', flags: [], dynamic: null });
    expect(omitted).toEqual(['flags', 'dynamic']);
  });

  it('reads a null where a list belongs as the empty list', () => {
    expect(fillOmittedEmpties({ flags: null }, { flags: 'list' })).toEqual({ flags: [] });
  });

  it('leaves a present value alone, whatever its type, and reports nothing', () => {
    const onOmitted = jest.fn();
    const object = { flags: 'not a list', dynamic: 'rest', other: 1 };

    expect(fillOmittedEmpties(object, { flags: 'list', dynamic: 'null' }, onOmitted))
      .toEqual(object);
    expect(onOmitted).not.toHaveBeenCalled();
  });

  it('copies: the reply as parsed is unchanged, and each list is its own', () => {
    const object = {};
    const first = fillOmittedEmpties(object, { flags: 'list' });
    const second = fillOmittedEmpties(object, { flags: 'list' });

    expect(object).toEqual({});
    expect(first.flags).not.toBe(second.flags);
  });
});
