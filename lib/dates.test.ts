import { describe, expect, it } from 'vitest';
import { localDate } from './dates';

describe('localDate', () => {
  it('writes dates and ranges the Chinese and Japanese way', () => {
    expect(localDate('May 27, 2026', 'zh')).toBe('2026年5月27日');
    expect(localDate('Jan 20, 2025', 'ja')).toBe('2025年1月20日');
    expect(localDate('Sep. 2023 - Present', 'zh')).toBe('2023年9月 – 至今');
    expect(localDate('Sep. 2019 - July 2023', 'ja')).toBe('2019年9月～2023年7月');
    expect(localDate('Jun. 2021 - May. 2022', 'zh')).toBe('2021年6月 – 2022年5月');
    expect(localDate('Sept 2024', 'zh')).toBe('2024年9月');
    expect(localDate('2023', 'ja')).toBe('2023年');
    expect(localDate('2023-Present', 'ja')).toBe('2023年～現在');
  });

  it('keeps English, and text it cannot read, as written', () => {
    expect(localDate('Sep. 2023 - Present', 'en')).toBe('Sep. 2023 - Present');
    expect(localDate('Spring 2024', 'zh')).toBe('Spring 2024');
    expect(localDate('Ma 2024', 'zh')).toBe('Ma 2024');
    expect(localDate('2020 - 2021 - 2022', 'zh')).toBe('2020 - 2021 - 2022');
    expect(localDate('', 'zh')).toBe('');
  });
});
