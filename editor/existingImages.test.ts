import { describe, expect, it } from 'vitest';
import { SiteContent } from '../types';
import fixture from '../views/__fixtures__/content.json';
import { existingImages } from './existingImages';

// The fixture uses four logos on experiences (Hosei and SWUST three times each), an avatar and a WeChat QR code.
const content = fixture as SiteContent;
const urls = (kind: string, from: SiteContent = content): string[] => existingImages(from, kind).map((choice) => choice.url);

const LOGOS = [
  '/images/experiences/logo-hosei.png',
  '/images/experiences/logo-swust.png',
  '/images/experiences/logo-uosaka.png',
  '/images/experiences/logo-ccf.png',
];

describe('existingImages', () => {
  it('lists images of the same kind first, most used first, ties in order of appearance', () => {
    expect(urls('experiences.image')).toEqual([...LOGOS, '/images/zzh.png', '/images/wechat_qr.jpg']);
  });

  it('counts the uses of each image and leaves out empty values', () => {
    const choices = existingImages(content, 'experiences.image');
    expect(choices.slice(0, 2)).toEqual([
      { url: '/images/experiences/logo-hosei.png', uses: 3 },
      { url: '/images/experiences/logo-swust.png', uses: 3 },
    ]);
    expect(choices.map((choice) => choice.url)).not.toContain('');
  });

  it('includes the avatar and the QR codes of the contact table, first for their own fields', () => {
    expect(urls('profile.avatar')[0]).toBe('/images/zzh.png');
    expect(urls('profile.socials.qrCode')[0]).toBe('/images/wechat_qr.jpg');
  });

  it('orders everything by use count when no image of the same kind exists', () => {
    expect(urls('publications.image')).toEqual([...LOGOS, '/images/zzh.png', '/images/wechat_qr.jpg']);
  });

  it('counts hidden items and ignores surrounding spaces when de-duplicating', () => {
    const extra: SiteContent = {
      ...content,
      awards: [
        { ...content.awards[0], image: ' /images/a.png ', hidden: true },
        { ...content.awards[1], image: '/images/a.png' },
      ],
    };
    expect(existingImages(extra, 'awards.image')[0]).toEqual({ url: '/images/a.png', uses: 2 });
  });

  it('returns nothing when no image is used', () => {
    const bare: SiteContent = {
      ...content,
      profile: { ...content.profile, avatar: '', socials: [] },
      experiences: content.experiences.map((item) => ({ ...item, image: '' })),
    };
    expect(existingImages(bare, 'experiences.image')).toEqual([]);
  });
});
