import { describe, expect, it } from 'vitest';
import { heatColor } from './heatmap';

describe('ICLR manuscript heat key', () => {
  it('leaves unchanged and invalid values unshaded', () => {
    expect(heatColor(0, true)).toBeNull();
    expect(heatColor(1e-10, false)).toBeNull();
    expect(heatColor(Number.NaN, true)).toBeNull();
    expect(heatColor(Infinity, true)).toBeNull();
  });
  it('hits the exact orange and blue midpoint colors at a 15-point change', () => {
    expect(heatColor(-15, true)).toBe('#f2963c');
    expect(heatColor(15, true)).toBe('#5c8ede');
  });
  it('hits and caps at the deep red and violet endpoints at 45 points', () => {
    expect(heatColor(-45, true)).toBe('#d9544d');
    expect(heatColor(45, true)).toBe('#4e42ba');
    expect(heatColor(-200, true)).toBe('#d9544d');
    expect(heatColor(200, true)).toBe('#4e42ba');
  });
  it('interpolates both segments with a visible minimum for small changes', () => {
    expect(heatColor(-7.5, true)).toBe('#f9cb9e');
    expect(heatColor(7.5, true)).toBe('#aec7ef');
    expect(heatColor(-30, true)).toBe('#e67545');
    expect(heatColor(30, true)).toBe('#5568cc');
    expect(heatColor(-0.01, true)).toBe(heatColor(-4, true));
    expect(heatColor(0.01, true)).toBe(heatColor(4, true));
    expect(heatColor(0.01, true)).not.toBe('#ffffff');
  });
  it('reverses better/worse colors for lower-is-better metrics', () => {
    expect(heatColor(15, false)).toBe('#f2963c');
    expect(heatColor(-15, false)).toBe('#5c8ede');
  });
});
