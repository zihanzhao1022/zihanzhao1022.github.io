import { describe, expect, it } from 'vitest';
import { blockInView } from './readingPosition';

const box = (id: string, top: number, bottom: number) => ({ id, top, bottom });

describe('blockInView', () => {
  it('picks the block with the most of itself on screen', () => {
    // A 900px window shows the last 300px of a1, all 500px of a2 and 20px of a3.
    expect(blockInView([box('a1', -500, 300), box('a2', 340, 840), box('a3', 880, 1400)], 900)).toBe('a2');
  });

  it('counts a block taller than the window by the part on screen', () => {
    expect(blockInView([box('a1', -2000, 2000), box('a2', 2040, 2500)], 900)).toBe('a1');
  });

  it('prefers the upper block on a tie', () => {
    expect(blockInView([box('a1', 0, 400), box('a2', 450, 850)], 900)).toBe('a1');
  });

  it('finds nothing when no block is on screen', () => {
    expect(blockInView([box('a1', 950, 1300), box('a2', -400, -10)], 900)).toBeNull();
    expect(blockInView([], 900)).toBeNull();
  });
});
