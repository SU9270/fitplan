import { en } from './en';
import { localeFromTags, setLocale, t } from './index';
import { zh } from './zh';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('i18n dictionaries', () => {
  it('zh and en have the same keys', () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  });

  it('has no empty strings and matching placeholders', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(en[key].trim()).not.toBe('');
      expect(zh[key].trim()).not.toBe('');
      expect({ key, zh: placeholders(zh[key]) }).toEqual({ key, zh: placeholders(en[key]) });
    }
  });
});

describe('t', () => {
  afterEach(() => setLocale('en'));

  it('interpolates params', () => {
    setLocale('zh');
    expect(t('report.kcal', { n: 2056 })).toContain('2056');
    setLocale('en');
    expect(t('report.kcal', { n: 2056 })).toContain('2056');
  });

  it('returns the active locale text', () => {
    setLocale('zh');
    const zhText = t('auth.signIn.submit');
    setLocale('en');
    expect(t('auth.signIn.submit')).not.toBe(zhText);
  });

  it('leaves unknown placeholders untouched', () => {
    expect(t('report.kcal')).toContain('{n}');
  });
});

describe('localeFromTags', () => {
  it('maps any Chinese variant to zh', () => {
    expect(localeFromTags(['zh-Hans-US'])).toBe('zh');
    expect(localeFromTags(['zh-TW'])).toBe('zh');
    expect(localeFromTags(['ZH'])).toBe('zh');
  });

  it('uses English for everything else', () => {
    expect(localeFromTags(['en-US'])).toBe('en');
    expect(localeFromTags(['ja-JP', 'zh-CN'])).toBe('en');
    expect(localeFromTags([])).toBe('en');
  });
});
