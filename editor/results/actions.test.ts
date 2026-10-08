import { describe, expect, it } from 'vitest';
import { attachmentName, hashBytes } from './actions';

describe('attachmentName', () => {
  const data = new TextEncoder().encode('made-up figure bytes');

  it('keeps names TeX and URLs can use as they are', async () => {
    expect(await attachmentName('plot_v2.pdf', data)).toBe('plot_v2.pdf');
    expect(await attachmentName('C:\\fakepath\\acl.sty', data)).toBe('acl.sty');
  });

  it('renames other files and adds a content hash, so they never replace each other', async () => {
    const hash = (await hashBytes(data)).slice(0, 8);
    expect(await attachmentName('实验结果.png', data)).toBe(`file-${hash}.png`);
    expect(await attachmentName('图 1 loss.pdf', data)).toBe(`1-loss-${hash}.pdf`);
    expect(await attachmentName('.hidden', data)).toBe(`hidden-${hash}`);
    const other = new TextEncoder().encode('other made-up bytes');
    expect(await attachmentName('实验结果.png', other)).not.toBe(await attachmentName('实验结果.png', data));
  });
});
