import { describe, expect, it } from 'vitest';
import {
  MAX_COLS, MAX_ROWS, addColumns, addRows, anchorAt, createTable, deleteColumns, deleteRows,
  mergeCells, numericCell, selectedAnchors, selectionBounds, setBorders, splitCells, updateCells,
} from './model';
import type { CellSelection, TableModel } from './types';

const select = (row: number, col: number, endRow = row, endCol = col): CellSelection => ({
  start: { row, col }, end: { row: endRow, col: endCol },
});
function filled(rows: number, cols: number): TableModel {
  const model = createTable(rows, cols);
  model.cells.forEach((row, r) => row.forEach((cell, c) => { cell!.text = `${r},${c}`; }));
  return model;
}
function validGrid(model: TableModel) {
  const coverage = model.cells.map(row => row.map(() => 0));
  for (let row = 0; row < model.cells.length; row++) {
    expect(model.cells[row]).toHaveLength(model.cells[0].length);
    for (let col = 0; col < model.cells[row].length; col++) {
      const cell = model.cells[row][col];
      if (!cell) continue;
      for (let r = row; r < row + cell.rowSpan; r++) {
        for (let c = col; c < col + cell.colSpan; c++) {
          expect(coverage[r]?.[c]).toBeDefined();
          coverage[r][c]++;
        }
      }
    }
  }
  expect(coverage.flat().every(count => count === 1)).toBe(true);
}

describe('table structural operations', () => {
  it('starts with independent cells and enforces dimension limits', () => {
    const model = createTable();
    expect(model.cells).toHaveLength(4);
    expect(model.cells[0]).toHaveLength(3);
    model.cells[0][0]!.borders.top = false;
    expect(model.cells[0][1]!.borders.top).toBe(true);
    expect(createTable(-2, 0).cells).toHaveLength(1);
    const capped = createTable(999, 999);
    expect(capped.cells).toHaveLength(MAX_ROWS);
    expect(capped.cells[0]).toHaveLength(MAX_COLS);
  });

  it('merges a reversed selection without losing text, then splits with text at its master', () => {
    const original = filled(3, 4);
    const merged = mergeCells(original, select(1, 2, 0, 1));
    expect(merged.cells[0][1]).toMatchObject({ text: '0,1\n0,2\n1,1\n1,2', rowSpan: 2, colSpan: 2 });
    expect(merged.cells[1][2]).toBeNull();
    expect(anchorAt(merged, 1, 2)).toEqual({ row: 0, col: 1 });
    expect(original.cells[0][1]!.rowSpan).toBe(1);
    const split = splitCells(merged, select(1, 2));
    expect(split.cells[0][1]!.text).toBe('0,1\n0,2\n1,1\n1,2');
    expect(split.cells[1][2]!.text).toBe('');
    expect(split.cells.flat().every(cell => cell !== null)).toBe(true);
    validGrid(merged);
    validGrid(split);
  });

  it('repeatedly expands a selection that intersects multiple merged rectangles', () => {
    let model = mergeCells(filled(4, 4), select(0, 0, 1, 0));
    model = mergeCells(model, select(1, 1, 2, 2));
    model = mergeCells(model, select(2, 3, 3, 3));
    const bounds = selectionBounds(model, select(0, 0, 1, 3));
    expect(bounds).toEqual({ top: 0, left: 0, bottom: 3, right: 3 });
    expect(selectedAnchors(model, select(0, 0, 1, 3))).toHaveLength(11);
    validGrid(mergeCells(model, select(0, 0, 1, 3)));
  });

  it('styles covered positions immutably and disallows span changes through a patch', () => {
    const model = mergeCells(createTable(2, 2), select(0, 0, 1, 1));
    const changed = updateCells(model, select(1, 1), { background: '#123456', bold: true, rowSpan: 10 });
    expect(changed.cells[0][0]).toMatchObject({ background: '#123456', bold: true, rowSpan: 2 });
    expect(model.cells[0][0]!.background).toBeNull();
    changed.cells[0][0]!.borders.top = false;
    expect(model.cells[0][0]!.borders.top).toBe(true);
    validGrid(changed);
  });

  it('appends rows and columns without disturbing existing merged cells', () => {
    const model = mergeCells(filled(3, 3), select(1, 1, 2, 2));
    const grown = addColumns(addRows(model, 2), 2);
    expect(grown.cells).toHaveLength(5);
    expect(grown.cells[0]).toHaveLength(5);
    expect(grown.cells[1][1]).toEqual(model.cells[1][1]);
    expect(grown.cells[2][2]).toBeNull();
    expect(grown.cells[4][4]!.text).toBe('');
    expect(model.cells).toHaveLength(3);
    validGrid(grown);
    expect(addRows(grown, -1).cells).toHaveLength(5);
    expect(addColumns(grown, Number.NaN).cells[0]).toHaveLength(5);
    expect(addRows(grown, 200).cells).toHaveLength(MAX_ROWS);
    expect(addColumns(grown, 200).cells[0]).toHaveLength(MAX_COLS);
  });

  it('clips a row-spanning master after its first row is deleted, retaining all its text', () => {
    const model = mergeCells(filled(5, 3), select(1, 0, 3, 1));
    const text = model.cells[1][0]!.text;
    const changed = deleteRows(model, select(1, 0));
    expect(changed.cells).toHaveLength(4);
    expect(changed.cells[1][0]).toMatchObject({ text, rowSpan: 2, colSpan: 2 });
    expect(changed.cells[3][0]!.text).toBe('4,0');
    expect(model.cells[1][0]!.rowSpan).toBe(3);
    validGrid(changed);
  });

  it('clips middle and trailing rows without moving the master', () => {
    const model = mergeCells(filled(5, 3), select(0, 0, 3, 1));
    const middle = deleteRows(model, select(1, 2, 2, 2));
    expect(middle.cells[0][0]).toMatchObject({ text: model.cells[0][0]!.text, rowSpan: 2 });
    const trailing = deleteRows(model, select(3, 2, 4, 2));
    expect(trailing.cells[0][0]!.rowSpan).toBe(3);
    validGrid(middle);
    validGrid(trailing);
  });

  it('clips column-spanning masters, including when the anchor column is removed', () => {
    const model = mergeCells(filled(3, 5), select(0, 1, 1, 3));
    const changed = deleteColumns(model, select(2, 1, 2, 2));
    expect(changed.cells[0]).toHaveLength(3);
    expect(changed.cells[0][1]).toMatchObject({ text: model.cells[0][1]!.text, rowSpan: 2, colSpan: 1 });
    expect(changed.cells[0][2]!.text).toBe('0,4');
    validGrid(changed);
  });

  it('drops wholly deleted merged cells and keeps a usable empty row or column', () => {
    const model = mergeCells(filled(3, 3), select(1, 1, 2, 2));
    const removed = deleteRows(model, select(1, 0, 2, 2));
    expect(removed.cells).toHaveLength(1);
    expect(removed.cells[0][1]!.text).toBe('0,1');
    const rows = deleteRows(model, select(0, 0, 2, 2));
    const cols = deleteColumns(model, select(0, 0, 2, 2));
    expect(rows.cells).toHaveLength(1);
    expect(rows.cells[0].every(cell => cell!.text === '')).toBe(true);
    expect(cols.cells.every(row => row.length === 1 && row[0]!.text === '')).toBe(true);
    validGrid(rows);
    validGrid(cols);
  });

  it('preserves wrappers and keeps explicit column specifications in step with edits', () => {
    const model = createTable(2, 3);
    model.columnSpecs = ['l', 'p{3cm}', 'r'];
    model.before = '\\centering';
    model.after = '\\label{tab:retained}';
    const grown = addColumns(model, 2);
    expect(grown.columnSpecs).toEqual(['l', 'p{3cm}', 'r', 'c', 'c']);
    const trimmed = deleteColumns(grown, select(0, 1));
    expect(trimmed.columnSpecs).toEqual(['l', 'r', 'c', 'c']);
    expect(deleteRows(trimmed, select(0, 0)).columnSpecs).toEqual(trimmed.columnSpecs);
    expect(trimmed.before).toBe(model.before);
    expect(trimmed.after).toBe(model.after);
    expect(model.columnSpecs).toEqual(['l', 'p{3cm}', 'r']);
    expect(deleteColumns(model, select(0, 0, 0, 2)).columnSpecs).toEqual(['c']);
  });
});

describe('table borders', () => {
  it('draws only the perimeter of a selected region', () => {
    const model = setBorders(createTable(3, 3), select(0, 0, 1, 1), 'outer');
    expect(model.cells[0][0]!.borders).toEqual({ top: true, left: true, bottom: false, right: false });
    expect(model.cells[1][1]!.borders).toEqual({ top: false, left: false, bottom: true, right: true });
  });
  it('removes both sides of an edge, including neighboring unselected cells', () => {
    const original = createTable(3, 3);
    const model = setBorders(original, select(1, 1), 'none');
    expect(Object.values(model.cells[1][1]!.borders)).toEqual([false, false, false, false]);
    expect(model.cells[0][1]!.borders.bottom).toBe(false);
    expect(model.cells[2][1]!.borders.top).toBe(false);
    expect(model.cells[1][0]!.borders.right).toBe(false);
    expect(model.cells[1][2]!.borders.left).toBe(false);
    expect(original.cells[0][1]!.borders.bottom).toBe(true);
    expect(model.cells[0][0]!.borders.bottom).toBe(true);
  });
  it('supports inner, horizontal, and all presets on merged selections', () => {
    const original = mergeCells(createTable(3, 3), select(0, 0, 1, 0));
    const inner = setBorders(original, select(0, 0, 1, 1), 'inner');
    expect(inner.cells[0][0]!.borders).toEqual({ top: false, left: false, bottom: false, right: true });
    const horizontal = setBorders(original, select(0, 0, 2, 2), 'horizontal');
    expect(horizontal.cells[0][0]!.borders).toEqual({ top: true, bottom: true, left: false, right: false });
    const all = setBorders(horizontal, select(0, 0, 2, 2), 'all');
    expect(Object.values(all.cells[0][0]!.borders).every(Boolean)).toBe(true);
  });
});

describe('numeric cells', () => {
  it.each([
    ['52.5', 52.5], ['−12.5', -12.5], ['$+3.2$', 3.2], ['42\\%', 42],
    ['\\textbf{12.5}', 12.5], ['$\\mathbf{15}$', 15], ['1,024.5', 1024.5],
    ['\\(3.5\\)', 3.5], ['.5', .5], ['2e2', 200],
  ])('reads %s as %s', (text, expected) => expect(numericCell(text)).toBe(expected));
  it.each(['', 'N/A', '--', '3 + 4', '1,2', '52 ± 2', 'Infinity', 'NaN', '\\ref{12}'])('rejects %s', text => {
    expect(numericCell(text)).toBeNull();
  });
});
