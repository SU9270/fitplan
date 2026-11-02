import { amountFromEntry, checkAmount, defaultQuantity, formatNumber, gramsOf, parseDecimal, type AmountUnit } from './amount';

const cupPortion = { id: 'p1', label: '1 cup', grams: 158 };
const cup: AmountUnit = { kind: 'portion', portion: cupPortion };
const grams: AmountUnit = { kind: 'grams' };

describe('parseDecimal', () => {
  it('accepts plain decimals with a dot or a comma', () => {
    expect(parseDecimal('150')).toBe(150);
    expect(parseDecimal(' 1.5 ')).toBe(1.5);
    expect(parseDecimal('1,5')).toBe(1.5);
    expect(parseDecimal('.5')).toBe(0.5);
    expect(parseDecimal('2.')).toBe(2);
  });

  it('rejects what Number() would wrongly accept', () => {
    for (const text of ['', ' ', '0x10', '1e3', '-1', '1.2.3', 'abc', 'Infinity']) expect(parseDecimal(text)).toBeNull();
  });
});

describe('checkAmount', () => {
  it('turns grams or portions into the request amount', () => {
    expect(checkAmount(grams, '150')).toEqual({ ok: true, grams: 150, portionId: null, quantity: 150 });
    expect(checkAmount(cup, '1.5')).toEqual({ ok: true, grams: 237, portionId: 'p1', quantity: 1.5 });
  });

  it('rejects zero, junk and amounts over the limit', () => {
    expect(checkAmount(grams, '0')).toEqual({ ok: false, error: 'invalid' });
    expect(checkAmount(grams, 'abc')).toEqual({ ok: false, error: 'invalid' });
    expect(checkAmount(grams, '5000')).toMatchObject({ ok: true });
    expect(checkAmount(grams, '5001')).toEqual({ ok: false, error: 'tooBig' });
    expect(checkAmount(cup, '32')).toEqual({ ok: false, error: 'tooBig' });
  });
});

describe('helpers', () => {
  it('gramsOf, defaultQuantity and formatNumber', () => {
    expect(gramsOf(cup, 2)).toBe(316);
    expect(defaultQuantity(grams)).toBe('100');
    expect(defaultQuantity(cup)).toBe('1');
    expect(formatNumber(237)).toBe('237');
    expect(formatNumber(1 / 3, 2)).toBe('0.33');
    expect(formatNumber(46.53)).toBe('46.5');
  });
});

describe('amountFromEntry', () => {
  it('reopens the portion the entry was logged with', () => {
    expect(amountFromEntry({ portionId: 'p1', quantity: 1.5, grams: 237 }, [cupPortion])).toEqual({ unit: cup, quantity: '1.5' });
  });

  it('falls back to grams when the portion is gone or there was none', () => {
    expect(amountFromEntry({ portionId: 'gone', quantity: 2, grams: 316 }, [])).toEqual({ unit: grams, quantity: '316' });
    expect(amountFromEntry({ portionId: null, quantity: 150, grams: 150 }, [])).toEqual({ unit: grams, quantity: '150' });
  });
});
