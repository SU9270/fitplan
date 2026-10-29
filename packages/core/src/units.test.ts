import { describe, expect, it } from 'vitest';
import { cmToFtIn, ftInToCm, kgToLb, lbToKg } from './units';

describe('units', () => {
  it('converts pounds and kilograms', () => {
    expect(lbToKg(150)).toBeCloseTo(68.039, 3);
    expect(kgToLb(70)).toBeCloseTo(154.324, 3);
  });
  it('converts feet and inches to cm', () => {
    expect(ftInToCm(5, 7)).toBeCloseTo(170.18, 2);
  });
  it('cmToFtIn rolls 12 inches into a foot', () => {
    expect(cmToFtIn(182.88)).toEqual({ ft: 6, in: 0 });
    expect(cmToFtIn(182.5)).toEqual({ ft: 6, in: 0 });
  });
  it('round-trips imperial input', () => {
    expect(cmToFtIn(ftInToCm(5, 11))).toEqual({ ft: 5, in: 11 });
    expect(Math.round(kgToLb(lbToKg(163)))).toBe(163);
  });
});
