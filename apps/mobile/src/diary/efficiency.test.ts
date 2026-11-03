import { setLocale, t } from '../i18n';
import { EMPTY_QUICK_FORM, defaultTemplateName, entryName, toQuickAddInput } from './efficiency';

afterEach(() => setLocale('en'));

describe('entryName', () => {
  it('names an unnamed quick add, otherwise uses the food name', () => {
    setLocale('zh');
    expect(entryName({ name: '', nameZh: null, quick: true }, 'zh', t)).toBe('快速添加');
    expect(entryName({ name: '奶茶', nameZh: null, quick: true }, 'zh', t)).toBe('奶茶');
    expect(entryName({ name: 'Rice, cooked', nameZh: '白米饭' }, 'zh', t)).toBe('白米饭');
  });
});

describe('defaultTemplateName', () => {
  it('joins the first three foods and marks the rest', () => {
    setLocale('zh');
    expect(defaultTemplateName(['鸡胸肉（烤）', '白米饭'], t)).toBe('鸡胸肉（烤） + 白米饭');
    expect(defaultTemplateName(['a', 'b', 'c', 'd'], t)).toBe('a + b + c…');
    expect(defaultTemplateName(['x'.repeat(100)], t)).toHaveLength(80);
  });
});

describe('toQuickAddInput', () => {
  it('needs calories; empty macros are unknown', () => {
    expect(toQuickAddInput({ ...EMPTY_QUICK_FORM, name: ' 奶茶 ', kcal: '320', carbsG: '50,5' }, '2026-11-03', 'snack')).toEqual({
      ok: true,
      input: { date: '2026-11-03', meal: 'snack', name: '奶茶', kcal: 320, proteinG: null, carbsG: 50.5, fatG: null },
    });
  });

  it('reports a missing or out-of-range kcal and junk macros', () => {
    expect(toQuickAddInput(EMPTY_QUICK_FORM, '2026-11-03', 'snack')).toEqual({ ok: false, errors: { kcal: 'quick.error.kcal' } });
    expect(toQuickAddInput({ ...EMPTY_QUICK_FORM, kcal: '6000', fatG: 'abc' }, '2026-11-03', 'snack')).toEqual({
      ok: false,
      errors: { kcal: 'quick.error.kcal', fatG: 'quick.error.number' },
    });
  });
});
