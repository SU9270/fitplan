import { checkNickname, formatHeight, formatWeight, initial } from './format';

describe('formatHeight', () => {
  it('shows centimetres or feet and inches', () => {
    expect(formatHeight(175, 'metric')).toBe('175 cm');
    expect(formatHeight(175.4, 'metric')).toBe('175 cm');
    expect(formatHeight(175, 'imperial')).toBe('5′9″');
    expect(formatHeight(182.88, 'imperial')).toBe('6′0″');
  });
});

describe('formatWeight', () => {
  it('shows kilograms with one decimal or whole pounds', () => {
    expect(formatWeight(70, 'metric')).toBe('70 kg');
    expect(formatWeight(68.04, 'metric')).toBe('68 kg');
    expect(formatWeight(70.25, 'metric')).toBe('70.3 kg');
    expect(formatWeight(70, 'imperial')).toBe('154 lb');
  });
});

describe('initial', () => {
  it('takes the first character, whole', () => {
    expect(initial('su')).toBe('S');
    expect(initial(' 小苏')).toBe('小');
    expect(initial('😀 hi')).toBe('😀');
    expect(initial('  ')).toBe('?');
  });
});

describe('checkNickname', () => {
  it('trims and enforces 1–40 characters', () => {
    expect(checkNickname('  小苏 ')).toBe('小苏');
    expect(checkNickname('   ')).toBeNull();
    expect(checkNickname('a'.repeat(41))).toBeNull();
  });
});
