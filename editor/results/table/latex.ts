import type { CellAlign, ParseTableResult, TableCell, TableModel } from './types';
import { stripComments } from '../../tex/document';

// Metadata is an exact-source cache, never an authority over hand-edited LaTeX.
const META = '% portfolio-table:v1 ';
const CAPTION = '@@PORTFOLIO_CAPTION@@';
const LABEL = '@@PORTFOLIO_LABEL@@';
const STYLE_START = '% portfolio-table-style';
const STYLE_END = '% portfolio-table-end';
type StoredModel = TableModel & { columnSpecs?: string[]; captionShort?: string };
type ParsedCell = { cell: TableCell; colSpan: number; signedRows: number; ownSides: boolean };
type Column = { spec: string; align: CellAlign; left: boolean; right: boolean };
type ColorMap = Record<string, string>;

function fail(message: string): never { throw new Error(message); }
function hash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
}
function escaped(text: string, at: number): boolean {
  let n = 0;
  while (at > 0 && text[--at] === '\\') n++;
  return n % 2 === 1;
}
function skip(text: string, at: number): number {
  while (at < text.length) {
    if (/\s/.test(text[at])) { at++; continue; }
    if (text[at] === '%' && !escaped(text, at)) {
      const end = text.indexOf('\n', at);
      at = end < 0 ? text.length : end + 1;
      continue;
    }
    break;
  }
  return at;
}
function group(text: string, at: number, open = '{', close = '}'): { value: string; end: number } {
  at = skip(text, at);
  if (text[at] !== open) fail('LaTeX 参数不完整，请先检查括号。');
  const start = ++at;
  let depth = 1;
  while (at < text.length) {
    if (text[at] === '%' && !escaped(text, at)) {
      const end = text.indexOf('\n', at);
      at = end < 0 ? text.length : end + 1;
      continue;
    }
    if (!escaped(text, at)) {
      if (text[at] === open) depth++;
      if (text[at] === close && --depth === 0) return { value: text.slice(start, at), end: at + 1 };
    }
    at++;
  }
  return fail('LaTeX 参数括号未闭合，原始源码已保留。');
}
function command(text: string, name: string): { args: string[]; end: number; start: number } | null {
  const start = skip(text, 0);
  const token = '\\' + name;
  if (!text.startsWith(token, start) || /[A-Za-z]/.test(text[start + token.length] || '')) return null;
  return { args: [], end: start + token.length, start };
}
function hex(value: string): string | null {
  const s = value.replace(/^#/, '');
  if (/^[a-f\d]{6}$/i.test(s)) return '#' + s.toUpperCase();
  if (/^[a-f\d]{3}$/i.test(s)) return '#' + [...s].map(v => v + v).join('').toUpperCase();
  return null;
}
function rgb(parts: number[]): string | null {
  if (parts.length !== 3 || parts.some(v => !Number.isFinite(v) || v < 0 || v > 255)) return null;
  return '#' + parts.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
}
function colorValue(value: string, model: string | undefined, colors: ColorMap): string | null {
  value = value.trim();
  if (model === 'HTML') return /^[a-f\d]{6}$/i.test(value) ? hex(value) : null;
  if (model === 'RGB' || model === 'rgb') return rgb(value.split(',').map(v => Number(v.trim()) * (model === 'rgb' ? 255 : 1)));
  if (model === 'gray') { const v = Number(value); return rgb([v * 255, v * 255, v * 255]); }
  if (model && model !== 'named') return null;
  const pieces = value.split('!');
  let result = colors[pieces.shift()!.trim()] || hex(value);
  if (!result) return null;
  while (pieces.length) {
    const weight = Number(pieces.shift());
    const other = colors[(pieces.shift() || 'white').trim()];
    if (!Number.isFinite(weight) || weight < 0 || weight > 100 || !other) return null;
    const a = [1, 3, 5].map(i => parseInt(result!.slice(i, i + 2), 16));
    const b = [1, 3, 5].map(i => parseInt(other.slice(i, i + 2), 16));
    result = rgb(a.map((v, i) => v * weight / 100 + b[i] * (1 - weight / 100)))!;
  }
  return result;
}
function readColors(source: string): ColorMap {
  const colors: ColorMap = {
    white: '#FFFFFF', black: '#000000', red: '#FF0000', green: '#00FF00', blue: '#0000FF',
    yellow: '#FFFF00', cyan: '#00FFFF', magenta: '#FF00FF', gray: '#808080', lightgray: '#BFBFBF',
    darkgray: '#404040', orange: '#FF8000', violet: '#800080', purple: '#BF0040', brown: '#BF8040',
    teal: '#008080', lime: '#BFFF00', pink: '#FFBFBF', olive: '#808000',
    heatredmid: '#F2963C', heatred: '#D9544D', heatbluemid: '#5C8EDE', heatblue: '#4E42BA',
    bgray: '#E0E0E0', BaselineRow: '#BFBFBF', TrainRow: '#EBEBEB',
  };
  const clean = stripComments(source);
  for (const match of clean.matchAll(/\\definecolor\s*\{([^{}]+)\}\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g)) {
    const value = colorValue(match[3], match[2], colors);
    if (value) colors[match[1]] = value;
  }
  for (const match of clean.matchAll(/\\colorlet\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g)) {
    const value = colorValue(match[2], undefined, colors);
    if (value) colors[match[1]] = value;
  }
  return colors;
}
function readColorCommand(text: string, name: string, colors: ColorMap): { value: string; end: number } | null {
  const found = command(text, name);
  if (!found) return null;
  let at = skip(text, found.end);
  let model: string | undefined;
  if (text[at] === '[') { const g = group(text, at, '[', ']'); model = g.value; at = g.end; }
  const g = group(text, at);
  const value = colorValue(g.value, model, colors);
  if (!value) fail('无法识别表格颜色；请提供对应的 \\definecolor 定义，或使用 HTML/RGB 颜色。');
  return { value, end: g.end };
}

function columns(source: string): Column[] {
  const result: Column[] = [];
  let at = 0;
  let pendingLeft = false;
  while ((at = skip(source, at)) < source.length) {
    const ch = source[at];
    if (ch === '|') {
      if (pendingLeft || result[result.length - 1]?.right) fail('双重竖线暂不支持可视化转换，请保留 LaTeX 模式。');
      if (result.length) result[result.length - 1].right = true;
      pendingLeft = true; at++; continue;
    }
    if (ch === '*') {
      const count = group(source, at + 1);
      const spec = group(source, count.end);
      const n = Number(count.value);
      if (!Number.isInteger(n) || n < 1 || n > 100) fail('列重复参数无效。');
      const expanded = columns(spec.value.repeat(n));
      if (!expanded.length) fail('表格缺少列定义。');
      expanded[0].left ||= pendingLeft;
      result.push(...expanded); pendingLeft = false; at = spec.end; continue;
    }
    let align: CellAlign = ch === 'r' ? 'r' : ch === 'c' ? 'c' : 'l';
    let prefix = '';
    if (ch === '>') {
      const g = group(source, at + 1);
      const definition = g.value.replace(/\s/g, '');
      if (definition === '\\centering\\arraybackslash') align = 'c';
      else if (definition === '\\raggedleft\\arraybackslash') align = 'r';
      else if (definition === '\\raggedright\\arraybackslash') align = 'l';
      else fail('此列包含自定义格式，暂不支持无损可视化转换。');
      prefix = source.slice(at, g.end); at = skip(source, g.end);
    }
    const start = at;
    if (/[lcr]/.test(source[at] || '')) at++;
    else if (/[pmb]/.test(source[at] || '')) at = group(source, at + 1).end;
    else return fail('目前支持 l/c/r、p/m/b 列和常见重复列；此列格式请继续用 LaTeX 编辑。');
    result.push({ spec: prefix + source.slice(start, at), align, left: pendingLeft, right: false });
    pendingLeft = false;
    if (result.length > 100) fail('可视化编辑最多支持 100 列。');
  }
  if (!result.length) fail('表格缺少列定义。');
  return result;
}

/** Split only genuine table delimiters, leaving commands, math and comments intact. */
function splitBody(source: string, kind: 'row' | 'cell'): string[] {
  const pieces: string[] = [];
  let start = 0, depth = 0, math = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '%' && !escaped(source, i)) { const end = source.indexOf('\n', i); i = end < 0 ? source.length : end; continue; }
    if (ch === '\\') {
      if (!depth && !math && kind === 'row' && source[i + 1] === '\\') {
        pieces.push(source.slice(start, i)); i++;
        const next = skip(source, i + 1);
        if (source[next] === '[' || source[next] === '*') fail('自定义行高或分页控制暂不支持可视化转换，请保留 LaTeX 模式。');
        start = i + 1;
      } else if (!depth && !math && kind === 'row' && source.slice(i).startsWith('\\tabularnewline')) {
        pieces.push(source.slice(start, i)); i += '\\tabularnewline'.length - 1; start = i + 1;
      } else if (source[i + 1] && !/[A-Za-z]/.test(source[i + 1])) i++;
      continue;
    }
    if (ch === '$') math = !math;
    if (ch === '{') depth++;
    if (ch === '}' && --depth < 0) fail('表格中存在未配对的括号。');
    if (!depth && !math && ch === '&' && kind === 'cell') { pieces.push(source.slice(start, i)); start = i + 1; }
  }
  if (depth || math) fail('表格中存在未闭合的括号或数学公式。');
  pieces.push(source.slice(start));
  return pieces;
}
function baseCell(text: string): TableCell {
  return { text, rowSpan: 1, colSpan: 1, background: null, align: 'c', bold: false,
    borders: { top: false, right: false, bottom: false, left: false } };
}
function darkBackground(background: string | null): boolean {
  if (!background) return false;
  const value = hex(background); if (!value) return false;
  const channels = [1, 3, 5].map(i => {
    const channel = parseInt(value.slice(i, i + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 < 0.179;
}
function parseCell(source: string, colors: ColorMap): ParsedCell {
  let text = source.trim();
  const cell = baseCell('');
  let signedRows = 1, colSpan = 1, ownSides = false;
  for (let count = 0; count < 8; count++) {
    const color = readColorCommand(text, 'cellcolor', colors);
    if (color) { cell.background = color.value; text = text.slice(color.end).trim(); continue; }
    const multiCol = command(text, 'multicolumn');
    if (multiCol) {
      if (ownSides) fail('嵌套跨列暂不支持可视化转换。');
      const n = group(text, multiCol.end), format = group(text, n.end), content = group(text, format.end);
      if (skip(text, content.end) !== text.length) fail('跨列命令外含有额外内容，请保留 LaTeX 模式。');
      colSpan = Number(n.value);
      const col = columns(format.value);
      if (!Number.isInteger(colSpan) || colSpan < 1 || colSpan > 100 || col.length !== 1) fail('跨列参数无效。');
      cell.align = col[0].align; cell.borders.left = col[0].left; cell.borders.right = col[0].right;
      text = text.slice(0, multiCol.start) + content.value; ownSides = true; continue;
    }
    const multiRow = command(text, 'multirow');
    if (multiRow) {
      if (signedRows !== 1) fail('嵌套跨行暂不支持可视化转换。');
      let at = skip(text, multiRow.end);
      if (text[at] === '[') {
        const placement = group(text, at, '[', ']');
        if (placement.value !== 'c') fail('可视化模式目前只支持垂直居中的跨行单元格。');
        at = placement.end;
      }
      const n = group(text, at), width = group(text, n.end), content = group(text, width.end);
      if (width.value.trim() !== '*') fail('指定宽度的跨行单元格暂不支持可视化转换。');
      if (skip(text, content.end) !== text.length) fail('跨行命令外含有额外内容，请保留 LaTeX 模式。');
      signedRows = Number(n.value);
      if (!Number.isInteger(signedRows) || signedRows === 0 || Math.abs(signedRows) > 500) fail('跨行参数无效。');
      text = text.slice(0, multiRow.start) + content.value; continue;
    }
    const bold = command(text, 'textbf');
    if (bold) {
      const content = group(text, bold.end);
      if (skip(text, content.end) === text.length) { cell.bold = true; text = text.slice(0, bold.start) + content.value; continue; }
    }
    const stack = command(text, 'shortstack');
    if (stack) {
      let at = skip(text, stack.end);
      if (text[at] === '[') {
        const option = group(text, at, '[', ']');
        if (!['l', 'c', 'r'].includes(option.value)) fail('无法识别多行单元格的对齐设置。');
        at = option.end;
      }
      const content = group(text, at);
      if (skip(text, content.end) === text.length) {
        text = text.slice(0, stack.start) + splitBody(content.value, 'row').map(line => line.trim().replace(/^\\strut$/, '')).join('\n');
        break;
      }
    }
    const contrast = command(text, 'textcolor');
    if (contrast && darkBackground(cell.background)) {
      let at = skip(text, contrast.end);
      if (text[at] === '[') {
        const model = group(text, at, '[', ']'); at = model.end;
        const color = group(text, at), content = group(text, color.end);
        if (model.value === 'HTML' && color.value.toUpperCase() === 'FFFFFF' && skip(text, content.end) === text.length) {
          text = text.slice(0, contrast.start) + content.value; continue;
        }
      }
    }
    break;
  }
  if (/\\(?:multicolumn|multirow|cellcolor|rowcolor|hline|cline|hhline|toprule|midrule|bottomrule|cmidrule)\b/.test(stripComments(text))) {
    fail('单元格中含有无法安全拆解的表格命令，请继续用 LaTeX 编辑。');
  }
  cell.text = text.trim().replace(/^\\strut\s*$/, '');
  cell.rowSpan = Math.abs(signedRows); cell.colSpan = colSpan;
  return { cell, colSpan, signedRows, ownSides };
}

function extractField(text: string, name: 'caption' | 'label'): { text: string; value: string; short?: string; found: boolean } {
  const clean = stripComments(text);
  const count = [...clean.matchAll(new RegExp('\\\\' + name + '\\b', 'g'))].length;
  if (count > 1) fail('多个标题或标签无法安全合并，请保留 LaTeX 模式。');
  if (!count) return { text, value: '', found: false };
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '%' && !escaped(text, i)) { const end = text.indexOf('\n', i); i = end < 0 ? text.length : end; continue; }
    if (text.startsWith('\\' + name, i) && !/[A-Za-z]/.test(text[i + name.length + 1] || '')) { start = i; break; }
  }
  if (start < 0) return { text, value: '', found: false };
  let at = skip(text, start + name.length + 1), short: string | undefined;
  if (name === 'caption' && text[at] === '[') { const opt = group(text, at, '[', ']'); short = opt.value; at = opt.end; }
  const g = group(text, at);
  return { text: text.slice(0, start) + (name === 'caption' ? CAPTION : LABEL) + text.slice(g.end), value: g.value, short, found: true };
}

function validatedModel(value: unknown): value is StoredModel {
  if (!value || typeof value !== 'object') return false;
  const table = value as StoredModel;
  if (!Array.isArray(table.cells) || !table.cells.length || table.cells.length > 500) return false;
  const width = table.cells[0]?.length;
  if (!width || width > 100 || table.cells.some(row => !Array.isArray(row) || row.length !== width)) return false;
  if (typeof table.caption !== 'string' || typeof table.label !== 'string' || !Number.isFinite(table.borderWidth) || table.borderWidth < 0 || table.borderWidth > 10 || !hex(table.borderColor || '')) return false;
  if (table.before !== undefined && typeof table.before !== 'string' || table.after !== undefined && typeof table.after !== 'string') return false;
  if (table.columnSpecs !== undefined && (!Array.isArray(table.columnSpecs) || table.columnSpecs.some(v => typeof v !== 'string'))) return false;
  const filled = table.cells.map(row => row.map(() => false));
  for (let r = 0; r < table.cells.length; r++) for (let c = 0; c < width; c++) {
    const cell = table.cells[r][c];
    if (!cell) { if (!filled[r][c]) return false; continue; }
    if (filled[r][c] || typeof cell.text !== 'string' || !['l', 'c', 'r'].includes(cell.align) || typeof cell.bold !== 'boolean' || !cell.borders || Object.values(cell.borders).some(v => typeof v !== 'boolean')) return false;
    if (cell.background !== null && !hex(cell.background || '')) return false;
    if (!Number.isInteger(cell.rowSpan) || !Number.isInteger(cell.colSpan) || cell.rowSpan < 1 || cell.colSpan < 1 || r + cell.rowSpan > table.cells.length || c + cell.colSpan > width) return false;
    for (let rr = r; rr < r + cell.rowSpan; rr++) for (let cc = c; cc < c + cell.colSpan; cc++) {
      if (filled[rr][cc] || (rr !== r || cc !== c) && table.cells[rr][cc] !== null) return false;
      filled[rr][cc] = true;
    }
  }
  return true;
}

export function parseTable(source: string, preamble = ''): ParseTableResult {
  try {
    let text = source;
    const footer = text.lastIndexOf('\n' + META);
    if (text.startsWith(META) || footer >= 0) {
      const legacy = text.startsWith(META);
      const newline = legacy ? text.indexOf('\n') : footer;
      if (newline < 0) fail('表格源码不完整。');
      const footerEnd = legacy ? -1 : text.indexOf('\n', footer + 1);
      const body = legacy ? text.slice(newline + 1) : text.slice(0, footer) + (footerEnd < 0 ? '' : text.slice(footerEnd));
      const encoded = legacy ? text.slice(META.length, newline) : text.slice(footer + 1 + META.length, footerEnd < 0 ? undefined : footerEnd).trim();
      try {
        const saved = JSON.parse(decodeURIComponent(encoded)) as { fingerprint: string; table: unknown };
        if (saved.fingerprint === hash(body) && validatedModel(saved.table)) return { ok: true, table: saved.table };
      } catch { /* Hand edits and damaged caches always go through the real parser. */ }
      text = body;
    }
    const clean = stripComments(text);
    if (/\\(?:rowcolors|newcolumntype|noalign|specialrule|addlinespace|omit|span|verb)\b/.test(clean)) fail('该表格含有暂不支持的排版命令；原始 LaTeX 已保留。');
    const starts = [...clean.matchAll(/\\begin\s*\{tabular\}/g)];
    if (starts.length !== 1 || /\\begin\s*\{(?:tabularx|tabular\*|longtable|tblr|array)\}/.test(clean)) fail('请提供一个普通 tabular 表格；嵌套表格及复杂环境请继续用 LaTeX 编辑。');
    // Locate using original offsets; comments may contain arbitrary fake environments.
    let begin = -1, end = -1;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '%' && !escaped(text, i)) { const line = text.indexOf('\n', i); i = line < 0 ? text.length : line; continue; }
      if (/^\\begin\s*\{tabular\}/.test(text.slice(i))) begin = i;
      if (/^\\end\s*\{tabular\}/.test(text.slice(i))) { end = i; break; }
    }
    if (begin < 0 || end < begin) fail('tabular 环境未完整闭合。');
    const beginToken = text.slice(begin).match(/^\\begin\s*\{tabular\}/)![0];
    let at = skip(text, begin + beginToken.length);
    if (text[at] === '[') {
      const pos = group(text, at, '[', ']');
      if (!['c', 't', 'b'].includes(pos.value)) fail('无法识别表格对齐参数。');
      at = pos.end;
    }
    const spec = group(text, at), cols = columns(spec.value), width = cols.length;
    let before = text.slice(0, begin);
    let after = text.slice(end + text.slice(end).match(/^\\end\s*\{tabular\}/)![0].length);
    // Remove only this editor's balanced style wrapper when a user edits generated code.
    const managedStyle = before.lastIndexOf(STYLE_START);
    if (managedStyle >= 0) {
      const style = before.slice(managedStyle);
      if (!/^% portfolio-table-style\s*\\begingroup\s*\\setlength\{\\arrayrulewidth\}\{[\d.]+pt\}\s*\\arrayrulecolor\[HTML\]\{[A-Fa-f\d]{6}\}\s*$/.test(style)) fail('表格样式包装已更改，请保留 LaTeX 模式以避免丢失自定义内容。');
      if (!/^\s*\\endgroup\s*% portfolio-table-end(?:\r?\n|$)/.test(after)) fail('表格样式包装未闭合。');
      before = before.slice(0, managedStyle);
      after = after.replace(/^\s*\\endgroup\s*% portfolio-table-end(?:\r?\n|$)/, '');
    }
    const envelope = before + '\u0000' + after;
    const caption = extractField(envelope, 'caption');
    const label = extractField(caption.text, 'label');
    [before, after] = label.text.split('\u0000');
    const colors = readColors(preamble + '\n' + text);
    const widthMatches = [...clean.matchAll(/\\setlength\s*\{\\arrayrulewidth\}\s*\{\s*([\d.]+)pt\s*\}/g)];
    const borderWidth = widthMatches.length ? Number(widthMatches[widthMatches.length - 1][1]) : 0.4;
    if (!Number.isFinite(borderWidth) || borderWidth < 0 || borderWidth > 10) fail('框线粗细需要在 0–10 pt 范围内。');
    const borderMatches = [...clean.matchAll(/\\arrayrulecolor(?:\[[^\]]*\])?\s*\{[^{}]*\}/g)];
    const borderColor = borderMatches.length ? readColorCommand(borderMatches[borderMatches.length - 1][0], 'arrayrulecolor', colors)!.value : '#000000';
    const rows: ParsedCell[][] = [], boundaries: boolean[][] = [Array(width).fill(false)];
    const spanFills: { row: number; col: number; color: string }[] = [];
    const rowColors: (string | null)[] = [];
    for (const chunk of splitBody(text.slice(spec.end, end), 'row')) {
      let rest = chunk, rowColor: string | null = null;
      while (true) {
        const from = skip(rest, 0);
        const line = rest.slice(from).match(/^\\(hline|toprule|midrule|bottomrule|cline|cmidrule|hhline)\b/);
        if (line) {
          let next = from + line[0].length;
          const boundary = boundaries[rows.length];
          if (line[1] === 'cline' || line[1] === 'cmidrule') {
            next = skip(rest, next);
            if (rest[next] === '(' || rest[next] === '[') fail('带裁切或独立线宽的横线暂不支持可视化转换。');
            const range = group(rest, next), m = range.value.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
            if (!m || +m[1] < 1 || +m[2] > width || +m[1] > +m[2]) fail('横线范围无效。');
            for (let c = +m[1] - 1; c < +m[2]; c++) boundary[c] = true;
            next = range.end;
          } else if (line[1] === 'hhline') {
            const g = group(rest, next), pattern = g.value;
            let index = 0, col = 0, ruleColor = borderColor, spanFill = false;
            while ((index = skip(pattern, index)) < pattern.length) {
              if (pattern[index] === '|') { index++; continue; }
              if (pattern[index] === '>') {
                const style = group(pattern, index + 1), color = readColorCommand(style.value, 'arrayrulecolor', colors);
                if (!color) fail('此 hhline 样式暂不支持可视化转换。');
                const tail = stripComments(style.value.slice(color.end)).trim();
                if (tail && tail !== '\\relax') fail('此 hhline 样式暂不支持可视化转换。');
                ruleColor = color.value; spanFill = tail === '\\relax'; index = style.end; continue;
              }
              if (!['-', '~'].includes(pattern[index]) || col >= width) fail('此 hhline 样式暂不支持可视化转换。');
              if (spanFill) {
                if (pattern[index] !== '-') fail('合并单元格的填色横线格式无效。');
                spanFills.push({ row: rows.length, col, color: ruleColor });
              } else if (pattern[index] === '-') {
                if (ruleColor !== borderColor) fail('不同颜色的独立横线暂不支持可视化转换。');
                boundary[col] = true;
              }
              col++; index++;
            }
            if (col !== width) fail('hhline 的列数与表格不一致。');
            next = g.end;
          } else {
            if (rest[skip(rest, next)] === '[') fail('独立设置横线粗细的表格请继续用 LaTeX 编辑。');
            if (boundary.every(Boolean)) fail('双重横线暂不支持可视化转换。');
            boundary.fill(true);
          }
          rest = rest.slice(next); continue;
        }
        const color = readColorCommand(rest, 'rowcolor', colors);
        if (color) { rowColor = color.value; rest = rest.slice(color.end); continue; }
        break;
      }
      if (skip(rest, 0) === rest.length) continue;
      const cells = splitBody(rest, 'cell').map(v => parseCell(v, colors));
      if (cells.reduce((n, c) => n + c.colSpan, 0) !== width) fail('某一行的单元格数量与列定义不一致，请先检查 & 和跨列参数。');
      rows.push(cells); rowColors.push(rowColor); boundaries.push(Array(width).fill(false));
      if (rows.length > 500) fail('可视化编辑最多支持 500 行。');
    }
    if (!rows.length) fail('表格没有可编辑的行。');
    const cells: (TableCell | null)[][] = rows.map(() => Array(width).fill(null));
    const owners: ({ r: number; c: number } | null)[][] = rows.map(() => Array(width).fill(null));
    for (let r = 0; r < rows.length; r++) {
      let c = 0;
      for (const entry of rows[r]) {
        const cell = entry.cell;
        cell.background ??= rowColors[r];
        if (!entry.ownSides) { cell.align = cols[c].align; cell.borders.left = cols[c].left; cell.borders.right = cols[c + cell.colSpan - 1].right; }
        if (entry.signedRows > 0 && owners[r][c]) {
          const owner = owners[r][c]!, parent = cells[owner.r][owner.c]!;
          if (cell.text || entry.signedRows !== 1 || c + cell.colSpan > owner.c + parent.colSpan || cell.background && cell.background !== parent.background) fail('跨行占位区含有独立内容或不同背景，无法无损转换。');
          c += cell.colSpan; continue;
        }
        const startRow = entry.signedRows < 0 ? r + entry.signedRows + 1 : r;
        if (startRow < 0 || startRow + cell.rowSpan > rows.length) fail('跨行范围超出了表格。');
        for (let rr = startRow; rr < startRow + cell.rowSpan; rr++) for (let cc = c; cc < c + cell.colSpan; cc++) {
          const owner = owners[rr][cc];
          if (owner) {
            const old = cells[owner.r][owner.c]!;
            if (entry.signedRows >= 0 || old.text || old.rowSpan !== 1 || old.background !== cell.background || owner.c < c || owner.c + old.colSpan > c + cell.colSpan) fail('合并范围与现有内容重叠，无法无损转换。');
          }
        }
        for (let rr = startRow; rr < startRow + cell.rowSpan; rr++) for (let cc = c; cc < c + cell.colSpan; cc++) {
          cells[rr][cc] = null; owners[rr][cc] = { r: startRow, c };
        }
        cells[startRow][c] = cell; c += cell.colSpan;
      }
    }
    for (let r = 0; r < cells.length; r++) for (let c = 0; c < width; c++) {
      const cell = cells[r][c]; if (!cell) continue;
      const top = boundaries[r].slice(c, c + cell.colSpan), bottom = boundaries[r + cell.rowSpan].slice(c, c + cell.colSpan);
      if (top.some(Boolean) && !top.every(Boolean) || bottom.some(Boolean) && !bottom.every(Boolean)) fail('横线只覆盖合并单元格的一部分，暂不支持无损可视化转换。');
      for (let rr = r + 1; rr < r + cell.rowSpan; rr++) if (boundaries[rr].slice(c, c + cell.colSpan).some(Boolean)) fail('横线穿过跨行单元格，暂不支持无损可视化转换。');
      cell.borders.top = top.every(Boolean); cell.borders.bottom = bottom.every(Boolean);
    }
    for (const fill of spanFills) {
      const above = owners[fill.row - 1]?.[fill.col], below = owners[fill.row]?.[fill.col];
      if (!above || !below || above.r !== below.r || above.c !== below.c || hex(cells[above.r][above.c]?.background || '') !== fill.color) {
        fail('合并单元格的填色横线已被修改，请继续用 LaTeX 编辑以保留样式。');
      }
    }
    const table: StoredModel = { cells, caption: caption.value, label: label.value, borderWidth, borderColor, before, after, columnSpecs: cols.map(c => c.spec) };
    if (caption.short !== undefined) table.captionShort = caption.short;
    if (!validatedModel(table)) fail('表格结构不完整，请保留 LaTeX 模式。');
    return { ok: true, table };
  } catch (error) { return { ok: false, reason: error instanceof Error ? error.message : '无法安全转换此表格，原始 LaTeX 已保留。' }; }
}

function cellFormat(cell: TableCell, column: string | undefined): string {
  let format = cell.align;
  if (cell.colSpan === 1 && column && /[pmb]\s*\{/.test(column)) {
    const sized = column.match(/[pmb]\s*\{[^{}]*\}/)?.[0];
    if (sized) return (cell.borders.left ? '|' : '') + (cell.align === 'c' ? '>{\\centering\\arraybackslash}' : cell.align === 'r' ? '>{\\raggedleft\\arraybackslash}' : '') + sized + (cell.borders.right ? '|' : '');
  }
  return (cell.borders.left ? '|' : '') + format + (cell.borders.right ? '|' : '');
}
function multilineContent(text: string, align: CellAlign): string {
  if (!text.includes('\n') || /(^|[^\\])%/.test(text)) return text;
  let depth = 0, math = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\' && text[i + 1] && !/[A-Za-z]/.test(text[i + 1])) { i++; continue; }
    if (text[i] === '{') depth++;
    if (text[i] === '}') depth--;
    if (text[i] === '$') math = !math;
    if (text[i] === '\n' && (depth || math)) return text;
  }
  if (depth || math) return text;
  return '\\shortstack[' + align + ']{' + text.split('\n').map(v => v || '\\strut').join(' \\\\ ') + '\n}';
}
export function serializeTable(input: TableModel): string {
  if (!validatedModel(input)) throw new Error('表格结构无效，无法生成 LaTeX。');
  const table = input as StoredModel;
  const height = table.cells.length, width = table.cells[0].length;
  const owner: { cell: TableCell; row: number; col: number }[][] = Array.from({ length: height }, () => Array(width));
  const horizontal: boolean[][] = Array.from({ length: height + 1 }, () => Array(width).fill(false));
  for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) {
    const cell = table.cells[r][c]; if (!cell) continue;
    for (let rr = r; rr < r + cell.rowSpan; rr++) for (let cc = c; cc < c + cell.colSpan; cc++) owner[rr][cc] = { cell, row: r, col: c };
    for (let cc = c; cc < c + cell.colSpan; cc++) {
      horizontal[r][cc] ||= cell.borders.top;
      horizontal[r + cell.rowSpan][cc] ||= cell.borders.bottom;
    }
  }
  const line = (r: number): string => {
    if (!horizontal[r].some(Boolean)) return '';
    let pattern = '';
    for (let c = 0; c <= width; c++) {
      const sides = [r > 0 ? r - 1 : -1, r < height ? r : -1].some(rr => rr >= 0 && (
        c < width && owner[rr][c].col === c && owner[rr][c].cell.borders.left ||
        c > 0 && owner[rr][c - 1].col + owner[rr][c - 1].cell.colSpan === c && owner[rr][c - 1].cell.borders.right
      ));
      if (sides) pattern += '|';
      if (c < width) {
        const above = r > 0 ? owner[r - 1][c] : undefined;
        const below = r < height ? owner[r][c] : undefined;
        const background = !horizontal[r][c] && above && below && above.row === below.row && above.col === below.col ? above.cell.background : null;
        if (background) {
          // A bare ~ leaves a white strip through a colored multirow cell. Paint
          // that strip with the cell's fill, then restore the normal rule color.
          // The harmless relax marks this as fill rather than a visible border.
          pattern += '>{\\arrayrulecolor[HTML]{' + hex(background)!.slice(1) + '}\\relax}->' +
            '{\\arrayrulecolor[HTML]{' + hex(table.borderColor)!.slice(1) + '}}';
        } else pattern += horizontal[r][c] ? '-' : '~';
      }
    }
    return '\\hhline{' + pattern + '}\n';
  };
  let tabular = '\\begin{tabular}{' + 'c'.repeat(width) + '}\n' + line(0);
  for (let r = 0; r < height; r++) {
    const pieces: string[] = [];
    for (let c = 0; c < width;) {
      const current = owner[r][c], cell = current.cell;
      const last = r === current.row + cell.rowSpan - 1;
      let content = last ? multilineContent(cell.text, cell.align) : '';
      if (content && cell.bold) content = '\\textbf{' + content + '\n}';
      if (content && darkBackground(cell.background)) content = '\\textcolor[HTML]{FFFFFF}{' + content + '\n}';
      if (cell.rowSpan > 1 && last) content = '\\multirow{-' + cell.rowSpan + '}{*}{' + (content || '\\strut') + '\n}';
      if (!content) content = '\\strut';
      if (cell.background) content = '\\cellcolor[HTML]{' + hex(cell.background)!.slice(1) + '}' + content;
      pieces.push('\\multicolumn{' + cell.colSpan + '}{' + cellFormat(cell, table.columnSpecs?.[c]) + '}{' + content + '\n}');
      c += cell.colSpan;
    }
    tabular += pieces.join(' & ') + ' \\\\\n' + line(r + 1);
  }
  tabular += '\\end{tabular}';
  const caption = table.caption ? '\\caption' + (table.captionShort !== undefined ? '[' + table.captionShort + ']' : '') + '{' + table.caption + '\n}' : '';
  const label = table.label ? '\\label{' + table.label + '}' : '';
  let before = table.before, after = table.after;
  if (before === undefined && after === undefined) { before = '\\begin{table}[htbp]\n\\centering\n'; after = '\n' + CAPTION + '\n' + LABEL + '\n\\end{table}'; }
  before ??= ''; after ??= '';
  const hasCaption = (before + after).includes(CAPTION), hasLabel = (before + after).includes(LABEL);
  let additions = (!hasCaption && caption ? '\n' + caption : '') + (!hasLabel && label ? '\n' + label : '');
  if (additions && !/\\begin\s*\{table\*?\}/.test(before)) { before = '\\begin{table}[htbp]\n\\centering\n' + before; after += additions + '\n\\end{table}'; additions = ''; }
  if (additions) after = additions + after;
  before = before.replace(CAPTION, () => caption).replace(LABEL, () => label);
  after = after.replace(CAPTION, () => caption).replace(LABEL, () => label);
  const styled = STYLE_START + '\n\\begingroup\n\\setlength{\\arrayrulewidth}{' + table.borderWidth + 'pt}\n\\arrayrulecolor[HTML]{' + hex(table.borderColor)!.slice(1) + '}\n' + tabular + '\n\\endgroup\n' + STYLE_END + '\n';
  const body = before + styled + after;
  return body + '\n' + META + encodeURIComponent(JSON.stringify({ fingerprint: hash(body), table }));
}
