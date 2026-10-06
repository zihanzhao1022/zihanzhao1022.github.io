import { describe, expect, it } from 'vitest';
import { publicUrl, scaledSize, uploadPath, validateImage } from './images';

describe('validateImage', () => {
  it('accepts common web formats up to 5MB', () => {
    expect(validateImage({ type: 'image/png', size: 1000 })).toBeNull();
    expect(validateImage({ type: 'image/jpeg', size: 5 * 1024 * 1024 })).toBeNull();
  });

  it('rejects SVG, other files and large images', () => {
    expect(validateImage({ type: 'image/svg+xml', size: 10 })).toMatch('PNG');
    expect(validateImage({ type: 'application/pdf', size: 10 })).toMatch('PNG');
    expect(validateImage({ type: 'image/webp', size: 5 * 1024 * 1024 + 1 })).toBe('图片不能超过 5MB');
  });
});

describe('scaledSize', () => {
  it('leaves images within the limit alone', () => {
    expect(scaledSize(1600, 900)).toBeNull();
  });

  it('scales the longest edge down to the limit', () => {
    expect(scaledSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(scaledSize(1000, 3200)).toEqual({ width: 500, height: 1600 });
  });
});

describe('uploadPath', () => {
  const now = new Date(Date.UTC(2026, 9, 6, 15, 30, 12));

  it('builds a timestamped, slugged path', () => {
    expect(uploadPath('Hosei Logo.PNG', 'image/png', now)).toBe('public/images/uploads/20261006-153012-hosei-logo.png');
  });

  it('falls back to "image" for names without ASCII letters', () => {
    expect(uploadPath('微信二维码.jpeg', 'image/jpeg', now)).toBe('public/images/uploads/20261006-153012-image.jpg');
  });

  it('adds a suffix for later images in the same save', () => {
    expect(uploadPath('qr.png', 'image/png', now, 2)).toBe('public/images/uploads/20261006-153012-qr-2.png');
  });
});

describe('publicUrl', () => {
  it('maps a public/ path to the URL the site serves it from', () => {
    expect(publicUrl('public/images/uploads/a.png')).toBe('/images/uploads/a.png');
  });
});
