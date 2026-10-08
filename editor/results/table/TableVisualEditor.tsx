import React, { useMemo, useRef, useState } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, Bold, ChevronDown, Columns as Columns3,
  Grid2X2, Merge, Plus, Rows as Rows3, Split, Trash2,
} from 'lucide-react';
import type { BorderPreset, CellBorders, CellPosition, CellSelection, TableCell, TableModel } from './types';
import {
  MAX_COLS, MAX_ROWS, addColumns, addRows, anchorAt, deleteColumns, deleteRows,
  mergeCells, numericCell, selectedAnchors, selectionBounds, setBorders, splitCells, updateCells,
} from './model';
import { heatColor } from './heatmap';
import './tableVisual.css';

interface Props {
  value: TableModel;
  onChange: (table: TableModel) => void;
  disabled?: boolean;
}

type ReferenceMode = 'value' | 'row' | 'column';
type BorderSide = keyof CellBorders;

const BORDER_PRESETS: { value: BorderPreset; label: string }[] = [
  { value: 'all', label: '全部' }, { value: 'outer', label: '外框' },
  { value: 'inner', label: '内部' }, { value: 'horizontal', label: '横线' },
  { value: 'none', label: '无线' },
];
const BORDER_SIDES: { value: BorderSide; label: string }[] = [
  { value: 'top', label: '上' }, { value: 'right', label: '右' },
  { value: 'bottom', label: '下' }, { value: 'left', label: '左' },
];

function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

function positionName(position: CellPosition): string {
  return `${columnName(position.col)}${position.row + 1}`;
}

function inputColor(color: string | null, fallback: string): string {
  if (color && /^#[0-9a-f]{6}$/i.test(color)) return color;
  if (color && /^#[0-9a-f]{3}$/i.test(color)) return `#${color.slice(1).split('').map((letter) => letter + letter).join('')}`;
  return fallback;
}

function readableTextColor(background: string | null): string {
  if (!background || !/^#[0-9a-f]{6}$/i.test(background)) return '#302739';
  const channels = [1, 3, 5].map((offset) => {
    const channel = parseInt(background.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 < 0.179 ? '#ffffff' : '#302739';
}

const TableVisualEditor: React.FC<Props> = ({ value, onChange, disabled = false }) => {
  const [selection, setSelection] = useState<CellSelection>({ start: { row: 0, col: 0 }, end: { row: 0, col: 0 } });
  const [rowCount, setRowCount] = useState('1');
  const [columnCount, setColumnCount] = useState('1');
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [referenceMode, setReferenceMode] = useState<ReferenceMode>('value');
  const [referenceValue, setReferenceValue] = useState('0');
  const [referenceRow, setReferenceRow] = useState('1');
  const [referenceColumn, setReferenceColumn] = useState('1');
  const [higherIsBetter, setHigherIsBetter] = useState(true);
  const cellInputs = useRef(new Map<string, HTMLTextAreaElement>());
  const lastColorAction = useRef<{ model: TableModel; key: string } | null>(null);
  const rows = value.cells.length;
  const cols = value.cells[0]?.length ?? 0;
  const clampPosition = (position: CellPosition): CellPosition => ({
    row: Math.max(0, Math.min(rows - 1, position.row)),
    col: Math.max(0, Math.min(cols - 1, position.col)),
  });
  const safeSelection = { start: clampPosition(selection.start), end: clampPosition(selection.end) };
  const bounds = selectionBounds(value, safeSelection);
  const anchors = selectedAnchors(value, safeSelection);
  const firstPosition = anchorAt(value, safeSelection.start.row, safeSelection.start.col);
  const firstCell = value.cells[firstPosition.row]?.[firstPosition.col];
  const hasMergedCell = anchors.some(({ row, col }) => {
    const cell = value.cells[row][col];
    return cell && (cell.rowSpan > 1 || cell.colSpan > 1);
  });
  const allBold = anchors.every(({ row, col }) => value.cells[row][col]?.bold);
  const selectionLabel = `${positionName({ row: bounds.top, col: bounds.left })}${bounds.top !== bounds.bottom || bounds.left !== bounds.right ? `:${positionName({ row: bounds.bottom, col: bounds.right })}` : ''}`;
  const legend = useMemo(() => [-100, -50, -15, 0, 15, 50, 100].map((delta) => ({
    delta,
    color: heatColor(higherIsBetter ? delta : -delta, higherIsBetter) ?? '#ffffff',
  })), [higherIsBetter]);

  const apply = (operation: () => TableModel) => {
    if (disabled) return;
    try {
      const next = operation();
      onChange(next);
      setProblem(null);
      setNotice(null);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : '暂时无法完成这个操作，请调整选区后重试。');
      setNotice(null);
    }
  };

  const changeCells = (patch: Partial<TableCell>) => apply(() => updateCells(value, safeSelection, patch));

  // Native color pickers and browser automation can emit input or change events.
  // Handle both, but record one edit when the same native interaction emits both.
  const changeColor = (kind: 'background' | 'border', color: string) => {
    const key = `${kind}:${selectionLabel}:${color}`;
    if (lastColorAction.current?.model === value && lastColorAction.current.key === key) return;
    lastColorAction.current = { model: value, key };
    if (kind === 'background') changeCells({ background: color });
    else apply(() => ({ ...value, borderColor: color }));
  };

  const selectCell = (row: number, col: number, extend: boolean) => {
    const position = anchorAt(value, row, col);
    setSelection({ start: extend ? safeSelection.start : position, end: position });
    setNotice(null);
  };

  const focusCell = (row: number, col: number) => {
    const position = anchorAt(value, row, col);
    setSelection({ start: position, end: position });
    requestAnimationFrame(() => cellInputs.current.get(positionName(position))?.focus());
  };

  const addDimension = (dimension: 'row' | 'column', countText: string) => {
    const count = Number(countText);
    const current = dimension === 'row' ? rows : cols;
    const maximum = dimension === 'row' ? MAX_ROWS : MAX_COLS;
    const label = dimension === 'row' ? '行' : '列';
    if (!Number.isInteger(count) || count < 1 || current + count > maximum) {
      setProblem(`请输入正整数，表格最多支持 ${maximum} ${label}；当前还能添加 ${maximum - current} ${label}。`);
      setNotice(null);
      return;
    }
    apply(() => dimension === 'row' ? addRows(value, count) : addColumns(value, count));
    const position = dimension === 'row' ? { row: rows, col: 0 } : { row: 0, col: cols };
    setSelection({ start: position, end: position });
    requestAnimationFrame(() => cellInputs.current.get(positionName(position))?.focus());
  };

  const toggleBorder = (side: BorderSide) => {
    const enabled = !anchors.every(({ row, col }) => value.cells[row][col]?.borders[side]);
    const selected = new Set(anchors.map(positionName));
    apply(() => {
      const next: TableModel = { ...value, cells: value.cells.map((rowCells, row) => rowCells.map((cell, col) => (
        cell ? { ...cell, borders: { ...cell.borders, ...(selected.has(positionName({ row, col })) ? { [side]: enabled } : {}) } } : cell
      ))) };
      if (!enabled) {
        const clearOpposite = (row: number, col: number, opposite: BorderSide) => {
          if (row < 0 || col < 0 || row >= rows || col >= cols) return;
          const owner = anchorAt(next, row, col);
          const cell = next.cells[owner.row][owner.col];
          if (cell) cell.borders[opposite] = false;
        };
        for (const { row, col } of anchors) {
          const cell = next.cells[row][col]!;
          if (side === 'top') for (let c = col; c < col + cell.colSpan; c++) clearOpposite(row - 1, c, 'bottom');
          if (side === 'bottom') for (let c = col; c < col + cell.colSpan; c++) clearOpposite(row + cell.rowSpan, c, 'top');
          if (side === 'left') for (let r = row; r < row + cell.rowSpan; r++) clearOpposite(r, col - 1, 'right');
          if (side === 'right') for (let r = row; r < row + cell.rowSpan; r++) clearOpposite(r, col + cell.colSpan, 'left');
        }
      }
      return next;
    });
  };

  const applyGradient = () => {
    const fixedReference = Number(referenceValue);
    const referenceIndex = Number(referenceMode === 'row' ? referenceRow : referenceColumn) - 1;
    if (referenceMode === 'value' && (referenceValue.trim() === '' || !Number.isFinite(fixedReference))) {
      setProblem('请填写一个有效的参考数值。');
      return;
    }
    if (referenceMode !== 'value' && (!Number.isInteger(referenceIndex) || referenceIndex < 0 || referenceIndex >= (referenceMode === 'row' ? rows : cols))) {
      setProblem(`请选择有效的参考${referenceMode === 'row' ? '行' : '列'}。`);
      return;
    }
    let changed = 0;
    let skipped = 0;
    const colors = new Map<string, string | null>();
    for (const position of anchors) {
      const cell = value.cells[position.row][position.col];
      const number = numericCell(cell?.text ?? '');
      let reference: number | null = fixedReference;
      if (referenceMode !== 'value') {
        const referencePosition = anchorAt(value, referenceMode === 'row' ? referenceIndex : position.row, referenceMode === 'column' ? referenceIndex : position.col);
        reference = numericCell(value.cells[referencePosition.row][referencePosition.col]?.text ?? '');
      }
      if (number === null || reference === null) {
        skipped += 1;
        continue;
      }
      colors.set(positionName(position), heatColor(number - reference, higherIsBetter));
      changed += 1;
    }
    if (changed === 0) {
      setProblem('选区里没有可与参考值比较的数字。文字单元格会保留原样。');
      setNotice(null);
      return;
    }
    apply(() => ({ ...value, cells: value.cells.map((rowCells, row) => rowCells.map((cell, col) => {
      const name = positionName({ row, col });
      return cell && colors.has(name) ? { ...cell, background: colors.get(name) ?? null } : cell;
    })) }));
    setNotice(`已为 ${changed} 个数值单元格设置配色${skipped ? `，跳过 ${skipped} 个文字或无有效参考值的单元格` : ''}。`);
  };

  return (
    <fieldset className="table-visual-editor" disabled={disabled} aria-label="表格可视化编辑器">
      <div className="tve-heading">
        <div className="tve-heading-copy"><Grid2X2 size={17} /><strong>编辑单元格</strong><span>{rows} 行 × {cols} 列</span></div>
        <span className="tve-selection-badge" aria-live="polite">已选 {selectionLabel}</span>
      </div>

      <div className="tve-toolbar" role="toolbar" aria-label="单元格格式">
        <div className="tve-toolbar-group">
          <button type="button" disabled={disabled || anchors.length < 2} onClick={() => apply(() => mergeCells(value, safeSelection))} title="将选中的矩形区域合并为一个单元格"><Merge size={15} />合并</button>
          <button type="button" disabled={disabled || !hasMergedCell} onClick={() => apply(() => splitCells(value, safeSelection))} title="将合并的单元格拆回原有行列"><Split size={15} />拆分</button>
        </div>
        <div className="tve-toolbar-group">
          <button type="button" className="tve-icon-button" aria-label="加粗" aria-pressed={allBold} onClick={() => changeCells({ bold: !allBold })}><Bold size={16} /></button>
          {([
            ['l', AlignLeft, '左对齐'], ['c', AlignCenter, '居中'], ['r', AlignRight, '右对齐'],
          ] as const).map(([align, Icon, label]) => (
            <button type="button" className="tve-icon-button" key={align} aria-label={label} aria-pressed={anchors.every(({ row, col }) => value.cells[row][col]?.align === align)} onClick={() => changeCells({ align })}><Icon size={16} /></button>
          ))}
        </div>
        <div className="tve-toolbar-group tve-fill-control">
          <label className="tve-color-control" title="设置选中单元格的背景颜色"><input type="color" aria-label="单元格背景颜色" value={inputColor(firstCell?.background ?? null, '#e9d5ff')} onInput={(event) => changeColor('background', event.currentTarget.value)} onChange={(event) => changeColor('background', event.target.value)} /><span>填色</span></label>
          <button type="button" onClick={() => changeCells({ background: null })}>清除</button>
        </div>
        <div className="tve-toolbar-group tve-delete-controls">
          <button type="button" disabled={disabled || bounds.bottom - bounds.top + 1 >= rows} onClick={() => apply(() => deleteRows(value, safeSelection))} title="删除选区所在的整行"><Trash2 size={13} />删行</button>
          <button type="button" disabled={disabled || bounds.right - bounds.left + 1 >= cols} onClick={() => apply(() => deleteColumns(value, safeSelection))} title="删除选区所在的整列">删列</button>
        </div>
      </div>

      <div className="tve-grid-shell">
        <div className="tve-grid-scroll">
          <div className="tve-grid-with-add">
            <table className="tve-grid" aria-label="可编辑表格">
              <thead>
                <tr>
                  <th className="tve-corner"><button type="button" aria-label="选择整个表格" title="选择整个表格" onClick={() => setSelection({ start: { row: 0, col: 0 }, end: { row: rows - 1, col: cols - 1 } })}><Grid2X2 size={13} /></button></th>
                  {Array.from({ length: cols }, (_, col) => <th key={col} className={`tve-column-header ${col >= bounds.left && col <= bounds.right ? 'is-selected' : ''}`}><button type="button" aria-label={`选择 ${columnName(col)} 列`} onClick={(event) => setSelection({ start: { row: 0, col: event.shiftKey ? safeSelection.start.col : col }, end: { row: rows - 1, col } })}>{columnName(col)}</button></th>)}
                </tr>
              </thead>
              <tbody>
                {value.cells.map((rowCells, row) => (
                  <tr key={row}>
                    <th className={`tve-row-header ${row >= bounds.top && row <= bounds.bottom ? 'is-selected' : ''}`} scope="row"><button type="button" aria-label={`选择第 ${row + 1} 行`} onClick={(event) => setSelection({ start: { row: event.shiftKey ? safeSelection.start.row : row, col: 0 }, end: { row, col: cols - 1 } })}>{row + 1}</button></th>
                    {rowCells.map((cell, col) => {
                      if (!cell) return null;
                      const selected = row >= bounds.top && row <= bounds.bottom && col >= bounds.left && col <= bounds.right;
                      const name = positionName({ row, col });
                      const border = `${value.borderWidth}pt solid ${value.borderColor}`;
                      return (
                        <td key={col} rowSpan={cell.rowSpan} colSpan={cell.colSpan} className={`tve-cell ${selected ? 'is-selected' : ''}`} style={{
                          background: cell.background ?? (selected ? '#faf7ff' : '#ffffff'),
                          borderTop: cell.borders.top ? border : '1px solid transparent',
                          borderRight: cell.borders.right ? border : '1px solid transparent',
                          borderBottom: cell.borders.bottom ? border : '1px solid transparent',
                          borderLeft: cell.borders.left ? border : '1px solid transparent',
                        }}>
                          <textarea
                            ref={(node) => { if (node) cellInputs.current.set(name, node); else cellInputs.current.delete(name); }}
                            aria-label={`单元格 ${name}`}
                            rows={Math.max(1, Math.min(4, cell.text.split('\n').length))}
                            value={cell.text}
                            placeholder={selected ? '输入内容' : ''}
                            spellCheck={false}
                            style={{ textAlign: cell.align === 'l' ? 'left' : cell.align === 'r' ? 'right' : 'center', fontWeight: cell.bold ? 700 : 400, color: readableTextColor(cell.background) }}
                            onMouseDown={(event) => { if (event.shiftKey) event.preventDefault(); selectCell(row, col, event.shiftKey); }}
                            onFocus={() => { if (!selected) selectCell(row, col, false); }}
                            onChange={(event) => apply(() => updateCells(value, { start: { row, col }, end: { row, col } }, { text: event.target.value }))}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
                                event.preventDefault();
                                if (row + cell.rowSpan < rows) focusCell(row + cell.rowSpan, col);
                              }
                              if (event.key === 'Escape') event.currentTarget.blur();
                            }}
                          />
                          {selected && <span className="tve-range-border" aria-hidden="true" style={{
                            borderTopWidth: row === bounds.top ? 2 : 0,
                            borderRightWidth: col + cell.colSpan - 1 === bounds.right ? 2 : 0,
                            borderBottomWidth: row + cell.rowSpan - 1 === bounds.bottom ? 2 : 0,
                            borderLeftWidth: col === bounds.left ? 2 : 0,
                          }} />}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" className="tve-add-edge tve-add-column" disabled={disabled || cols >= MAX_COLS} onClick={() => addDimension('column', '1')} aria-label="在右侧添加一列" title="在右侧添加一列"><Plus size={17} /></button>
          </div>
          <button type="button" className="tve-add-edge tve-add-row" disabled={disabled || rows >= MAX_ROWS} onClick={() => addDimension('row', '1')} aria-label="在下方添加一行"><Plus size={15} />添加一行</button>
        </div>
      </div>

      <div className="tve-grid-footer">
        <p>点击编辑 · Shift + 点击多选 · 点击行列标题选择整行 / 列</p>
        <div className="tve-dimension-controls">
          <label><Rows3 size={14} /><input type="number" aria-label="添加行数" min="1" max={MAX_ROWS - rows || 1} step="1" value={rowCount} onChange={(event) => setRowCount(event.target.value)} /><span>行</span></label>
          <button type="button" disabled={disabled || rows >= MAX_ROWS} onClick={() => addDimension('row', rowCount)}>＋ 添加</button>
          <span className="tve-control-divider" />
          <label><Columns3 size={14} /><input type="number" aria-label="添加列数" min="1" max={MAX_COLS - cols || 1} step="1" value={columnCount} onChange={(event) => setColumnCount(event.target.value)} /><span>列</span></label>
          <button type="button" disabled={disabled || cols >= MAX_COLS} onClick={() => addDimension('column', columnCount)}>＋ 添加</button>
        </div>
      </div>

      <div className="tve-inspectors">
        <details className="tve-panel">
          <summary><span>边框样式</span><span className="tve-summary-hint">范围 · 线宽 · 颜色</span><ChevronDown size={15} /></summary>
          <div className="tve-panel-body">
            <div className="tve-setting-row"><span className="tve-setting-label">选区框线</span><div className="tve-segmented">{BORDER_PRESETS.map(({ value: preset, label }) => <button key={preset} type="button" onClick={() => apply(() => setBorders(value, safeSelection, preset))}>{label}</button>)}</div></div>
            <div className="tve-setting-row"><span className="tve-setting-label">单格边线</span><div className="tve-segmented">{BORDER_SIDES.map(({ value: side, label }) => <button key={side} type="button" aria-label={`${label}边框`} aria-pressed={anchors.every(({ row, col }) => value.cells[row][col]?.borders[side])} onClick={() => toggleBorder(side)}>{label}</button>)}</div></div>
            <div className="tve-setting-row"><label className="tve-inline-label">整表线宽<input type="number" min="0.2" max="3" step="0.1" aria-label="框线粗细" value={value.borderWidth} onChange={(event) => {
              const width = Number(event.target.value);
              if (Number.isFinite(width) && width >= 0.2 && width <= 3) apply(() => ({ ...value, borderWidth: width }));
            }} /><span>pt</span></label><label className="tve-color-control"><input type="color" aria-label="框线颜色" value={inputColor(value.borderColor, '#333333')} onInput={(event) => changeColor('border', event.currentTarget.value)} onChange={(event) => changeColor('border', event.target.value)} /><span>框线颜色</span></label></div>
          </div>
        </details>

        <details className="tve-panel tve-gradient-panel">
          <summary><span className="tve-gradient-icon" aria-hidden="true" /><span>ICLR 橙蓝渐变</span><span className="tve-summary-hint">按数值差异着色</span><ChevronDown size={15} /></summary>
          <div className="tve-panel-body">
            <div className="tve-setting-row"><label className="tve-inline-label">比较基准<select aria-label="渐变比较基准" value={referenceMode} onChange={(event) => setReferenceMode(event.target.value as ReferenceMode)}><option value="value">固定数值</option><option value="row">参考行</option><option value="column">参考列</option></select></label>
              {referenceMode === 'value' ? <input className="tve-reference-input" type="number" aria-label="渐变参考数值" value={referenceValue} onChange={(event) => setReferenceValue(event.target.value)} /> : <label className="tve-inline-label">第<input className="tve-reference-input" type="number" aria-label={referenceMode === 'row' ? '渐变参考行' : '渐变参考列'} min="1" max={referenceMode === 'row' ? rows : cols} step="1" value={referenceMode === 'row' ? referenceRow : referenceColumn} onChange={(event) => referenceMode === 'row' ? setReferenceRow(event.target.value) : setReferenceColumn(event.target.value)} />{referenceMode === 'row' ? '行' : '列'}</label>}
            </div>
            <div className="tve-setting-row"><span className="tve-setting-label">指标方向</span><div className="tve-segmented"><button type="button" aria-pressed={higherIsBetter} onClick={() => setHigherIsBetter(true)}>越大越好 ↑</button><button type="button" aria-pressed={!higherIsBetter} onClick={() => setHigherIsBetter(false)}>越小越好 ↓</button></div></div>
            <div className="tve-gradient-legend"><span>变差</span><div>{legend.map(({ delta, color }) => <i key={delta} style={{ background: color }} title={`差值 ${higherIsBetter ? delta : -delta}`} />)}</div><span>改善</span></div>
            <p className="tve-help">与基准相比，橙色表示变差、蓝色表示改善；差值为 0 时不填色。仅应用到选区中的数字。</p>
            <button type="button" className="tve-primary-button" onClick={applyGradient}>应用到 {selectionLabel}</button>
          </div>
        </details>
      </div>

      {(problem || notice) && <p role={problem ? 'alert' : 'status'} className={`tve-message ${problem ? 'is-error' : ''}`}>{problem ?? notice}</p>}

      <div className="tve-metadata">
        <label>表格标题<input type="text" placeholder="例如：不同模型的实验结果" value={value.caption} onChange={(event) => apply(() => ({ ...value, caption: event.target.value }))} /></label>
        <label>引用标签<span className="tve-optional">可选</span><input type="text" placeholder="例如：tab:results" value={value.label} onChange={(event) => apply(() => ({ ...value, label: event.target.value }))} /></label>
      </div>
      <p className="tve-latex-hint">单元格支持 LaTeX，例如 <code>{'$\\alpha$'}</code>；Shift + Enter 换行。最终排版以预览为准。</p>
    </fieldset>
  );
};

export default TableVisualEditor;
