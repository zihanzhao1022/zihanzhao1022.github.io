/** A rectangle of a PDF page in points from its top left, e.g. where it draws a picture. */
export interface PageBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** pdf.js's numbers for the operators this reads (its OPS). */
export interface PictureOps {
  save: number;
  restore: number;
  transform: number;
  beginGroup: number;
  paintFormXObjectBegin: number;
  paintFormXObjectEnd: number;
  paintImageXObject: number;
  paintInlineImageXObject: number;
  paintImageMaskXObject: number;
}

type Matrix = [number, number, number, number, number, number];

const multiply = (m: Matrix, n: ArrayLike<number>): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

/** Pictures smaller than this (in points, either side), such as icons in a line of text, are left out. */
export const MIN_PICTURE = 36;

/**
 * Where a page's operator list paints pictures: the forms it paints at the top level, which is how pdfTeX
 * puts an \includegraphics'd PDF on the page, and its images (PNG, JPG). `toPage` turns a point of the PDF's
 * space into points from the page's top left.
 */
export function pictureBoxes(
  fnArray: ArrayLike<number>,
  argsArray: ArrayLike<unknown>,
  ops: PictureOps,
  toPage: (x: number, y: number) => ArrayLike<number>,
): PageBox[] {
  const boxes: PageBox[] = [];
  const saved: Matrix[] = [];
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  let depth = 0;
  // A form with a transparency group gets its box with the group, not with the form itself.
  let groupBox: ArrayLike<number> | null = null;
  const add = (rect: ArrayLike<number>) => {
    const corners = [
      [rect[0], rect[1]],
      [rect[2], rect[1]],
      [rect[0], rect[3]],
      [rect[2], rect[3]],
    ].map(([x, y]) => toPage(ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]));
    const xs = corners.map((point) => point[0]);
    const ys = corners.map((point) => point[1]);
    const box = { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    if (box.width >= MIN_PICTURE && box.height >= MIN_PICTURE) boxes.push(box);
  };
  for (let index = 0; index < fnArray.length; index += 1) {
    const fn = fnArray[index];
    const args = (argsArray[index] ?? []) as unknown[];
    if (fn === ops.save) {
      saved.push(ctm);
    } else if (fn === ops.restore) {
      ctm = saved.pop() ?? ctm;
    } else if (fn === ops.transform) {
      ctm = multiply(ctm, args as number[]);
    } else if (fn === ops.beginGroup) {
      groupBox = (args[0] as { bbox?: ArrayLike<number> | null } | undefined)?.bbox ?? null;
    } else if (fn === ops.paintFormXObjectBegin) {
      saved.push(ctm);
      const matrix = args[0] as ArrayLike<number> | null | undefined;
      if (matrix) ctm = multiply(ctm, matrix);
      const bbox = (args[1] as ArrayLike<number> | null | undefined) ?? groupBox;
      groupBox = null;
      if (depth === 0 && bbox) add(bbox);
      depth += 1;
    } else if (fn === ops.paintFormXObjectEnd) {
      ctm = saved.pop() ?? ctm;
      depth -= 1;
    } else if (depth === 0 && (fn === ops.paintImageXObject || fn === ops.paintInlineImageXObject || fn === ops.paintImageMaskXObject)) {
      // An image fills the unit square of its transform.
      add([0, 0, 1, 1]);
    }
  }
  return boxes;
}

/**
 * A picture's box kept on the page. No room is added around it: text set close to a figure would show at its
 * edge, so the enlarged view pads it instead.
 */
export function onPage(box: PageBox, page: { width: number; height: number }): PageBox {
  const left = Math.max(0, box.left);
  const top = Math.max(0, box.top);
  return { left, top, width: Math.min(page.width, box.left + box.width) - left, height: Math.min(page.height, box.top + box.height) - top };
}
