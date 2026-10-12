import { describe, expect, it } from 'vitest';
import { onPage, pictureBoxes } from './pictures';

const OPS = {
  save: 10,
  restore: 11,
  transform: 12,
  beginGroup: 76,
  paintFormXObjectBegin: 74,
  paintFormXObjectEnd: 75,
  paintImageXObject: 85,
  paintInlineImageXObject: 86,
  paintImageMaskXObject: 83,
  // Anything else, e.g. drawing text.
  showText: 44,
};
// A made-up page 400 points high: PDF space starts at the bottom left, the boxes at the top left.
const toPage = (x: number, y: number) => [x, 400 - y];

describe('pictureBoxes', () => {
  it('finds an included PDF (a form painted at the top level) and an image where they are drawn', () => {
    const fn = [
      OPS.showText,
      OPS.save,
      OPS.transform,
      OPS.paintFormXObjectBegin,
      OPS.save,
      OPS.transform,
      // A marker the included PDF draws as a form of its own: part of the picture, not another one.
      OPS.paintFormXObjectBegin,
      OPS.paintFormXObjectEnd,
      OPS.restore,
      OPS.paintFormXObjectEnd,
      OPS.restore,
      OPS.save,
      OPS.transform,
      OPS.paintImageXObject,
      OPS.restore,
    ];
    const args = [
      [],
      [],
      [1, 0, 0, 1, 50, 200],
      [new Float32Array([0.5, 0, 0, 0.5, 0, 0]), new Float32Array([0, 0, 600, 200])],
      [],
      [1, 0, 0, 1, 10, 10],
      [null, new Float32Array([0, 0, 100, 100])],
      [],
      [],
      [],
      [],
      [],
      [120, 0, 0, 60, 30, 40],
      [{}],
      [],
    ];
    expect(pictureBoxes(fn, args, OPS, toPage)).toEqual([
      { left: 50, top: 100, width: 300, height: 100 },
      { left: 30, top: 300, width: 120, height: 60 },
    ]);
  });

  it('takes the box of a form with a transparency group from its group, and leaves out small pictures', () => {
    const fn = [OPS.beginGroup, OPS.paintFormXObjectBegin, OPS.paintFormXObjectEnd, OPS.save, OPS.transform, OPS.paintImageXObject, OPS.restore];
    const args = [[{ bbox: [0, 0, 200, 80] }], [null, null], [], [], [12, 0, 0, 12, 0, 0], [{}], []];
    expect(pictureBoxes(fn, args, OPS, toPage)).toEqual([{ left: 0, top: 320, width: 200, height: 80 }]);
  });
});

describe('onPage', () => {
  it('keeps a picture that runs over the edge on the page', () => {
    expect(onPage({ left: -4, top: 20, width: 120, height: 50 }, { width: 108, height: 400 })).toEqual({ left: 0, top: 20, width: 108, height: 50 });
  });
});
