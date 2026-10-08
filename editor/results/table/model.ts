import type { BorderPreset, CellBorders, CellPosition, CellSelection, TableCell, TableModel } from './types';

export const MAX_ROWS = 100;
export const MAX_COLS = 30;

export function emptyCell(): TableCell {
  return {
    text: '', rowSpan: 1, colSpan: 1, background: null, align: 'c', bold: false,
    borders: { top: true, right: true, bottom: true, left: true },
  };
}

function integer(value: number, fallback = 0): number {
  return Number.isFinite(value) ? Math.floor(value) : fallback;
}
function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, integer(value, low)));
}
function copyCell(cell: TableCell): TableCell { return { ...cell, borders: { ...cell.borders } }; }
function clone(model: TableModel): TableModel {
  return {
    ...model,
    ...(model.columnSpecs ? { columnSpecs: [...model.columnSpecs] } : {}),
    cells: model.cells.map(row => row.map(cell => cell ? copyCell(cell) : null)),
  };
}

export function createTable(rows = 4, cols = 3): TableModel {
  return {
    cells: Array.from({ length: clamp(rows, 1, MAX_ROWS) }, () =>
      Array.from({ length: clamp(cols, 1, MAX_COLS) }, emptyCell)),
    caption: '', label: '', borderWidth: 0.5, borderColor: '#d1d5db',
  };
}

function dimensions(model: TableModel) {
  return { rows: model.cells.length, cols: model.cells[0]?.length ?? 0 };
}

/** Resolve a covered coordinate to the upper-left cell that owns it. */
export function anchorAt(model: TableModel, row: number, col: number): CellPosition {
  const { rows, cols } = dimensions(model);
  row = clamp(row, 0, Math.max(0, rows - 1));
  col = clamp(col, 0, Math.max(0, cols - 1));
  if (model.cells[row]?.[col]) return { row, col };
  for (let r = 0; r <= row; r++) {
    for (let c = 0; c <= col; c++) {
      const cell = model.cells[r]?.[c];
      if (cell && r + cell.rowSpan > row && c + cell.colSpan > col) return { row: r, col: c };
    }
  }
  return { row, col };
}

function rawBounds(model: TableModel, selection: CellSelection) {
  const { rows, cols } = dimensions(model);
  return {
    top: clamp(Math.min(selection.start.row, selection.end.row), 0, rows - 1),
    left: clamp(Math.min(selection.start.col, selection.end.col), 0, cols - 1),
    bottom: clamp(Math.max(selection.start.row, selection.end.row), 0, rows - 1),
    right: clamp(Math.max(selection.start.col, selection.end.col), 0, cols - 1),
  };
}

/** A selection may not bisect a merged cell, including cells reached by expansion. */
export function selectionBounds(model: TableModel, selection: CellSelection) {
  const bounds = rawBounds(model, selection);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (let row = 0; row < model.cells.length; row++) {
      for (let col = 0; col < model.cells[row].length; col++) {
        const cell = model.cells[row][col];
        if (!cell) continue;
        const bottom = row + cell.rowSpan - 1;
        const right = col + cell.colSpan - 1;
        if (row > bounds.bottom || bottom < bounds.top || col > bounds.right || right < bounds.left) continue;
        if (row < bounds.top || col < bounds.left || bottom > bounds.bottom || right > bounds.right) {
          bounds.top = Math.min(bounds.top, row);
          bounds.left = Math.min(bounds.left, col);
          bounds.bottom = Math.max(bounds.bottom, bottom);
          bounds.right = Math.max(bounds.right, right);
          expanded = true;
        }
      }
    }
  }
  return bounds;
}

export function selectedAnchors(model: TableModel, selection: CellSelection): CellPosition[] {
  const { top, left, bottom, right } = selectionBounds(model, selection);
  const result: CellPosition[] = [];
  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) {
      if (model.cells[row]?.[col]) result.push({ row, col });
    }
  }
  return result;
}

export function updateCells(model: TableModel, selection: CellSelection, patch: Partial<TableCell>): TableModel {
  const next = clone(model);
  for (const { row, col } of selectedAnchors(model, selection)) {
    const cell = next.cells[row][col]!;
    // Span changes must use merge/split so that covered slots remain consistent.
    next.cells[row][col] = {
      ...cell, ...patch, rowSpan: cell.rowSpan, colSpan: cell.colSpan,
      borders: { ...cell.borders, ...patch.borders },
    };
  }
  return next;
}

export function addRows(model: TableModel, count: number): TableModel {
  const { rows, cols } = dimensions(model);
  const next = clone(model);
  const extra = clamp(count, 0, Math.max(0, MAX_ROWS - rows));
  next.cells.push(...Array.from({ length: extra }, () => Array.from({ length: cols }, emptyCell)));
  return next;
}

export function addColumns(model: TableModel, count: number): TableModel {
  const { cols } = dimensions(model);
  const next = clone(model);
  const extra = clamp(count, 0, Math.max(0, MAX_COLS - cols));
  next.cells.forEach(row => row.push(...Array.from({ length: extra }, emptyCell)));
  if (model.columnSpecs) {
    next.columnSpecs = Array.from({ length: cols + extra }, (_, col) => model.columnSpecs?.[col] ?? 'c');
  }
  return next;
}

/** Delete coordinates, clipping merged rectangles and retaining any surviving master's content. */
function deleteAxis(model: TableModel, selection: CellSelection, axis: 'row' | 'col'): TableModel {
  const { rows, cols } = dimensions(model);
  const bounds = rawBounds(model, selection);
  const start = axis === 'row' ? bounds.top : bounds.left;
  const end = axis === 'row' ? bounds.bottom : bounds.right;
  const removed = end - start + 1;
  const nextRows = Math.max(1, rows - (axis === 'row' ? removed : 0));
  const nextCols = Math.max(1, cols - (axis === 'col' ? removed : 0));
  const cells: (TableCell | null)[][] = Array.from({ length: nextRows }, () => Array.from({ length: nextCols }, emptyCell));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cell = model.cells[row][col];
      if (!cell) continue;
      const position = axis === 'row' ? row : col;
      const span = axis === 'row' ? cell.rowSpan : cell.colSpan;
      const last = position + span - 1;
      const overlap = Math.max(0, Math.min(last, end) - Math.max(position, start) + 1);
      const retained = span - overlap;
      if (!retained) continue;
      const firstSurviving = position < start ? position : Math.max(position, end + 1);
      const mapped = firstSurviving < start ? firstSurviving : firstSurviving - removed;
      const newRow = axis === 'row' ? mapped : row;
      const newCol = axis === 'col' ? mapped : col;
      const moved = copyCell(cell);
      if (axis === 'row') moved.rowSpan = retained;
      else moved.colSpan = retained;
      for (let r = newRow; r < newRow + moved.rowSpan; r++) {
        for (let c = newCol; c < newCol + moved.colSpan; c++) cells[r][c] = null;
      }
      cells[newRow][newCol] = moved;
    }
  }
  const next: TableModel = { ...model, cells };
  if (model.columnSpecs) {
    next.columnSpecs = axis === 'row'
      ? [...model.columnSpecs]
      : Array.from({ length: cols }, (_, col) => model.columnSpecs?.[col] ?? 'c').filter((_, col) => col < start || col > end);
    if (next.columnSpecs.length === 0) next.columnSpecs = ['c'];
  }
  return next;
}

export function deleteRows(model: TableModel, selection: CellSelection): TableModel {
  return deleteAxis(model, selection, 'row');
}
export function deleteColumns(model: TableModel, selection: CellSelection): TableModel {
  return deleteAxis(model, selection, 'col');
}

export function mergeCells(model: TableModel, selection: CellSelection): TableModel {
  const bounds = selectionBounds(model, selection);
  const { top, left, bottom, right } = bounds;
  const positions = selectedAnchors(model, selection);
  const next = clone(model);
  const master = copyCell(model.cells[top][left]!);
  master.text = positions.map(({ row, col }) => model.cells[row][col]!.text).filter(text => text.trim()).join('\n');
  master.rowSpan = bottom - top + 1;
  master.colSpan = right - left + 1;
  master.borders = { top: false, right: false, bottom: false, left: false };
  for (const { row, col } of positions) {
    const cell = model.cells[row][col]!;
    if (row === top && cell.borders.top) master.borders.top = true;
    if (col === left && cell.borders.left) master.borders.left = true;
    if (row + cell.rowSpan - 1 === bottom && cell.borders.bottom) master.borders.bottom = true;
    if (col + cell.colSpan - 1 === right && cell.borders.right) master.borders.right = true;
  }
  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) next.cells[row][col] = null;
  }
  next.cells[top][left] = master;
  return next;
}

export function splitCells(model: TableModel, selection: CellSelection): TableModel {
  const next = clone(model);
  for (const { row, col } of selectedAnchors(model, selection)) {
    const cell = model.cells[row][col]!;
    if (cell.rowSpan === 1 && cell.colSpan === 1) continue;
    for (let r = row; r < row + cell.rowSpan; r++) {
      for (let c = col; c < col + cell.colSpan; c++) {
        next.cells[r][c] = {
          ...copyCell(cell), text: r === row && c === col ? cell.text : '', rowSpan: 1, colSpan: 1,
          borders: {
            top: r === row ? cell.borders.top : true,
            bottom: r === row + cell.rowSpan - 1 ? cell.borders.bottom : true,
            left: c === col ? cell.borders.left : true,
            right: c === col + cell.colSpan - 1 ? cell.borders.right : true,
          },
        };
      }
    }
  }
  return next;
}

export function setBorders(model: TableModel, selection: CellSelection, preset: BorderPreset): TableModel {
  const bounds = selectionBounds(model, selection);
  const positions = selectedAnchors(model, selection);
  const next = clone(model);
  for (const { row, col } of positions) {
    const cell = next.cells[row][col]!;
    const outer: CellBorders = {
      top: row === bounds.top, left: col === bounds.left,
      bottom: row + cell.rowSpan - 1 === bounds.bottom,
      right: col + cell.colSpan - 1 === bounds.right,
    };
    cell.borders = {
      top: preset === 'all' || preset === 'horizontal' || (preset === 'outer' && outer.top) || (preset === 'inner' && !outer.top),
      bottom: preset === 'all' || preset === 'horizontal' || (preset === 'outer' && outer.bottom) || (preset === 'inner' && !outer.bottom),
      left: preset === 'all' || (preset === 'outer' && outer.left) || (preset === 'inner' && !outer.left),
      right: preset === 'all' || (preset === 'outer' && outer.right) || (preset === 'inner' && !outer.right),
    };
  }
  // With collapsed borders, an adjacent cell can keep a hidden edge visible.
  const clearOpposite = (row: number, col: number, side: keyof CellBorders) => {
    if (row < 0 || col < 0 || row >= next.cells.length || col >= next.cells[0].length) return;
    const anchor = anchorAt(next, row, col);
    next.cells[anchor.row][anchor.col]!.borders[side] = false;
  };
  for (const { row, col } of positions) {
    const cell = next.cells[row][col]!;
    if (!cell.borders.top) for (let c = col; c < col + cell.colSpan; c++) clearOpposite(row - 1, c, 'bottom');
    if (!cell.borders.bottom) for (let c = col; c < col + cell.colSpan; c++) clearOpposite(row + cell.rowSpan, c, 'top');
    if (!cell.borders.left) for (let r = row; r < row + cell.rowSpan; r++) clearOpposite(r, col - 1, 'right');
    if (!cell.borders.right) for (let r = row; r < row + cell.rowSpan; r++) clearOpposite(r, col + cell.colSpan, 'left');
  }
  return next;
}

/** Read a plain displayed number, retaining percentage-point units for heat maps. */
export function numericCell(text: string): number | null {
  let value = text.trim();
  value = value.replace(/\$/g, '').replace(/\\[()[\]]/g, '').replace(/[−–]/g, '-');
  // Permit common formatting without accepting expressions such as "1 + 2".
  for (let i = 0; i < 4; i++) {
    const unwrapped = value.replace(/^\\(?:textbf|mathbf|mathrm|textrm|text|emph)\{([\s\S]*)\}$/, '$1').trim();
    if (unwrapped === value) break;
    value = unwrapped;
  }
  value = value.replace(/\\?%$/, '').trim();
  if (!/^[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) return null;
  const number = Number(value.replace(/,/g, ''));
  return Number.isFinite(number) ? number : null;
}
