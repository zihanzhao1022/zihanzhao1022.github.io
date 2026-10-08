export type CellAlign = 'l' | 'c' | 'r';
export type CellBorders = { top: boolean; right: boolean; bottom: boolean; left: boolean };
export interface TableCell {
  text: string;
  rowSpan: number;
  colSpan: number;
  background: string | null;
  align: CellAlign;
  bold: boolean;
  borders: CellBorders;
}

/** Null slots belong to a merged cell whose anchor is above or to the left. */
export interface TableModel {
  cells: (TableCell | null)[][];
  caption: string;
  label: string;
  borderWidth: number;
  borderColor: string;
  /** Imported paragraph-column widths are retained during visual edits. */
  columnSpecs?: string[];
  /** LaTeX around the tabular is preserved when importing an existing table. */
  before?: string;
  after?: string;
}

export interface CellPosition { row: number; col: number }
export interface CellSelection { start: CellPosition; end: CellPosition }
export type BorderPreset = 'all' | 'outer' | 'inner' | 'horizontal' | 'none';
export type ParseTableResult = { ok: true; table: TableModel } | { ok: false; reason: string };
