import { afterEach, describe, expect, it } from 'vitest';
import { PhraseError, getLang, phrases, pickLang, say, setLang } from './i18n';

afterEach(() => setLang('zh'));

describe('pickLang', () => {
  it('takes the first of Chinese, Japanese and English among the browser languages', () => {
    expect(pickLang(['ja-JP', 'en'])).toBe('ja');
    expect(pickLang(['de-DE', 'zh-Hans-CN'])).toBe('zh');
    expect(pickLang(['fr', 'ko'])).toBe('en');
  });
});

describe('phrases', () => {
  const { t } = phrases({ '{n} 条批注': { ja: 'コメント {n} 件', en: '{n} comments' } });

  it('gives a phrase in the chosen language, with its placeholders filled', () => {
    expect(getLang()).toBe('zh');
    expect(t('{n} 条批注', { n: 2 })).toBe('2 条批注');
    setLang('ja');
    expect(t('{n} 条批注', { n: 2 })).toBe('コメント 2 件');
    setLang('en');
    expect(t('{n} 条批注', { n: 3 })).toBe('3 comments');
  });

  it('falls back to the common phrases, then to the Chinese', () => {
    setLang('en');
    expect(t('取消')).toBe('Cancel');
    expect(t('没有翻译的话')).toBe('没有翻译的话');
  });
});

describe('messages that follow the switch', () => {
  const { t } = phrases({ 保存失败: { ja: '保存できませんでした', en: 'Could not save' } });

  it('translates a message each time it is shown', () => {
    const message = () => t('保存失败');
    expect(say(message)).toBe('保存失败');
    setLang('en');
    expect(say(message)).toBe('Could not save');
    expect(say('as written')).toBe('as written');
  });

  it('gives errors a message in the current language', () => {
    const error = new PhraseError(() => t('保存失败'));
    expect(error.message).toBe('保存失败');
    setLang('ja');
    expect(error.message).toBe('保存できませんでした');
    expect(error).toBeInstanceOf(Error);
    expect(new PhraseError('plain').message).toBe('plain');
  });
});

