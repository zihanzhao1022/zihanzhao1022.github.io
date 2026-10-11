import { phrases } from '../i18n';

/** Japanese and English for the visual LaTeX table editor of the results pages. */
export const { t, useT, table } = phrases({
  // The editor.
  表格可视化编辑器: { ja: '表のビジュアルエディター', en: 'Visual table editor' },
  编辑单元格: { ja: 'セルの編集', en: 'Edit cells' },
  '{rows} 行 × {cols} 列': { ja: '{rows} 行 × {cols} 列', en: '{rows} × {cols}' },
  '已选 {selection}': { ja: '選択中 {selection}', en: 'Selected {selection}' },
  单元格格式: { ja: 'セルの書式', en: 'Cell format' },
  合并: { ja: '結合', en: 'Merge' },
  将选中的矩形区域合并为一个单元格: { ja: '選択した長方形の範囲を 1 つのセルに結合します', en: 'Merge the selected rectangle into one cell' },
  拆分: { ja: '分割', en: 'Split' },
  将合并的单元格拆回原有行列: { ja: '結合したセルを元の行と列に戻します', en: 'Split merged cells back into their rows and columns' },
  加粗: { ja: '太字', en: 'Bold' },
  左对齐: { ja: '左揃え', en: 'Align left' },
  居中: { ja: '中央揃え', en: 'Center' },
  右对齐: { ja: '右揃え', en: 'Align right' },
  设置选中单元格的背景颜色: { ja: '選択したセルの背景色を設定します', en: 'Set the background color of the selected cells' },
  单元格背景颜色: { ja: 'セルの背景色', en: 'Cell background color' },
  填色: { ja: '塗りつぶし', en: 'Fill' },
  清除: { ja: 'クリア', en: 'Clear' },
  删除选区所在的整行: { ja: '選択範囲を含む行をまるごと削除します', en: 'Delete the rows of the selection' },
  删行: { ja: '行を削除', en: 'Delete rows' },
  删除选区所在的整列: { ja: '選択範囲を含む列をまるごと削除します', en: 'Delete the columns of the selection' },
  删列: { ja: '列を削除', en: 'Delete columns' },
  可编辑表格: { ja: '編集できる表', en: 'Editable table' },
  选择整个表格: { ja: '表全体を選択', en: 'Select the whole table' },
  '选择 {column} 列': { ja: '{column} 列を選択', en: 'Select column {column}' },
  '选择第 {row} 行': { ja: '{row} 行目を選択', en: 'Select row {row}' },
  '单元格 {name}': { ja: 'セル {name}', en: 'Cell {name}' },
  输入内容: { ja: '内容を入力', en: 'Type here' },
  在右侧添加一列: { ja: '右に列を追加', en: 'Add a column on the right' },
  在下方添加一行: { ja: '下に行を追加', en: 'Add a row below' },
  添加一行: { ja: '行を追加', en: 'Add a row' },
  '点击编辑 · Shift + 点击多选 · 点击行列标题选择整行 / 列': {
    ja: 'クリックで編集 · Shift + クリックで複数選択 · 行番号・列番号をクリックで行 / 列全体を選択',
    en: 'Click to edit · Shift + click to select several · Click a row or column header to select the whole row / column',
  },
  添加行数: { ja: '追加する行数', en: 'Rows to add' },
  添加列数: { ja: '追加する列数', en: 'Columns to add' },
  行: { ja: '行', en: 'rows' },
  列: { ja: '列', en: 'columns' },
  '＋ 添加': { ja: '＋ 追加', en: '+ Add' },

  // Borders.
  边框样式: { ja: '罫線のスタイル', en: 'Border style' },
  '范围 · 线宽 · 颜色': { ja: '範囲 · 線幅 · 色', en: 'Range · width · color' },
  选区框线: { ja: '選択範囲の罫線', en: 'Selection borders' },
  全部: { ja: 'すべて', en: 'All' },
  外框: { ja: '外枠', en: 'Outer' },
  内部: { ja: '内側', en: 'Inner' },
  横线: { ja: '横線', en: 'Horizontal' },
  无线: { ja: 'なし', en: 'None' },
  单格边线: { ja: 'セルの罫線', en: 'Cell edges' },
  上: { ja: '上', en: 'Top' },
  右: { ja: '右', en: 'Right' },
  下: { ja: '下', en: 'Bottom' },
  左: { ja: '左', en: 'Left' },
  '{side}边框': { ja: '{side}罫線', en: '{side} border' },
  整表线宽: { ja: '表全体の線幅', en: 'Table line width' },
  框线粗细: { ja: '罫線の太さ', en: 'Border width' },
  框线颜色: { ja: '罫線の色', en: 'Border color' },

  // The orange-blue gradient.
  'ICLR 橙蓝渐变': { ja: 'ICLR 橙・青グラデーション', en: 'ICLR orange-blue gradient' },
  按数值差异着色: { ja: '数値の差で色分け', en: 'Color by difference' },
  比较基准: { ja: '比較基準', en: 'Baseline' },
  渐变比较基准: { ja: 'グラデーションの比較基準', en: 'Gradient baseline' },
  固定数值: { ja: '固定値', en: 'Fixed value' },
  参考行: { ja: '基準行', en: 'Reference row' },
  参考列: { ja: '基準列', en: 'Reference column' },
  渐变参考数值: { ja: 'グラデーションの基準値', en: 'Gradient reference value' },
  渐变参考行: { ja: 'グラデーションの基準行', en: 'Gradient reference row' },
  渐变参考列: { ja: 'グラデーションの基準列', en: 'Gradient reference column' },
  // {input} is where the row or column number is typed.
  '第{input}行': { ja: '{input}行目', en: 'Row {input}' },
  '第{input}列': { ja: '{input}列目', en: 'Column {input}' },
  指标方向: { ja: '指標の向き', en: 'Metric direction' },
  '越大越好 ↑': { ja: '大きいほど良い ↑', en: 'Higher is better ↑' },
  '越小越好 ↓': { ja: '小さいほど良い ↓', en: 'Lower is better ↓' },
  变差: { ja: '悪化', en: 'Worse' },
  改善: { ja: '改善', en: 'Better' },
  '差值 {delta}': { ja: '差 {delta}', en: 'Difference {delta}' },
  '与基准相比，橙色表示变差、蓝色表示改善；差值为 0 时不填色。仅应用到选区中的数字。': {
    ja: '基準と比べて、橙色は悪化、青色は改善を表します。差が 0 のときは塗りません。選択範囲の数値にだけ適用されます。',
    en: 'Against the baseline, orange means worse and blue means better; a difference of 0 is left unfilled. Only the numbers in the selection are colored.',
  },
  '应用到 {selection}': { ja: '{selection} に適用', en: 'Apply to {selection}' },

  // Caption, label and hints.
  表格标题: { ja: 'キャプション', en: 'Caption' },
  '例如：不同模型的实验结果': { ja: '例：モデルごとの実験結果', en: 'e.g. Results of different models' },
  引用标签: { ja: 'ラベル', en: 'Label' },
  可选: { ja: '任意', en: 'optional' },
  '例如：tab:results': { ja: '例：tab:results', en: 'e.g. tab:results' },
  // {code} is an example of LaTeX in a cell.
  '单元格支持 LaTeX，例如 {code}；Shift + Enter 换行。最终排版以预览为准。': {
    ja: 'セルでは LaTeX が使えます（例：{code}）。Shift + Enter で改行します。最終的な組版はプレビューで確認してください。',
    en: 'Cells accept LaTeX, e.g. {code}; Shift + Enter starts a new line. The preview shows the final layout.',
  },

  // What the editor says after an action.
  '暂时无法完成这个操作，请调整选区后重试。': {
    ja: 'この操作は今は実行できません。選択範囲を調整してからもう一度お試しください。',
    en: 'This cannot be done right now: adjust the selection and try again.',
  },
  '请输入正整数，表格最多支持 {maximum} 行；当前还能添加 {left} 行。': {
    ja: '正の整数を入力してください。表は最大 {maximum} 行までで、今はあと {left} 行追加できます。',
    en: 'Enter a positive whole number. A table can have at most {maximum} rows; {left} more can be added now.',
  },
  '请输入正整数，表格最多支持 {maximum} 列；当前还能添加 {left} 列。': {
    ja: '正の整数を入力してください。表は最大 {maximum} 列までで、今はあと {left} 列追加できます。',
    en: 'Enter a positive whole number. A table can have at most {maximum} columns; {left} more can be added now.',
  },
  '请填写一个有效的参考数值。': { ja: '有効な基準値を入力してください。', en: 'Enter a valid reference value.' },
  '请选择有效的参考行。': { ja: '有効な基準行を指定してください。', en: 'Choose a valid reference row.' },
  '请选择有效的参考列。': { ja: '有効な基準列を指定してください。', en: 'Choose a valid reference column.' },
  '选区里没有可与参考值比较的数字。文字单元格会保留原样。': {
    ja: '選択範囲に基準値と比較できる数値がありません。テキストのセルはそのまま残ります。',
    en: 'The selection has no numbers to compare with the reference. Text cells are left as they are.',
  },
  '已为 {changed} 个数值单元格设置配色。': { ja: '{changed} 個の数値セルに色を付けました。', en: 'Numeric cells colored: {changed}.' },
  '已为 {changed} 个数值单元格设置配色，跳过 {skipped} 个文字或无有效参考值的单元格。': {
    ja: '{changed} 個の数値セルに色を付けました。テキストまたは有効な基準値のないセル {skipped} 個はスキップしました。',
    en: 'Numeric cells colored: {changed}. Skipped (text or no valid reference): {skipped}.',
  },

  // Why a table's LaTeX cannot be opened in the visual editor (editor/results/table/latex.ts).
  'LaTeX 参数不完整，请先检查括号。': {
    ja: 'LaTeX の引数が不完全です。まず括弧を確認してください。',
    en: 'A LaTeX argument is incomplete: check the braces first.',
  },
  'LaTeX 参数括号未闭合，原始源码已保留。': {
    ja: 'LaTeX の引数の括弧が閉じていません。元のソースはそのまま残っています。',
    en: 'A LaTeX argument is missing its closing brace; the original source is kept.',
  },
  '无法识别表格颜色；请提供对应的 \\definecolor 定义，或使用 HTML/RGB 颜色。': {
    ja: '表の色を認識できません。対応する \\definecolor の定義を追加するか、HTML/RGB の色を使ってください。',
    en: 'A table color is not recognized: add its \\definecolor or use an HTML/RGB color.',
  },
  '双重竖线暂不支持可视化转换，请保留 LaTeX 模式。': {
    ja: '二重の縦線はまだビジュアル編集で扱えません。LaTeX モードで編集してください。',
    en: 'Double vertical rules cannot be converted to the visual editor yet; keep using LaTeX mode.',
  },
  '列重复参数无效。': { ja: '列の繰り返し指定が無効です。', en: 'The column repeat count is invalid.' },
  '表格缺少列定义。': { ja: '表に列の定義がありません。', en: 'The table has no column specification.' },
  '此列包含自定义格式，暂不支持无损可视化转换。': {
    ja: 'この列には独自の書式があるため、まだ内容を失わずにビジュアル編集へ変換できません。',
    en: 'This column has custom formatting and cannot be converted to the visual editor without loss yet.',
  },
  '目前支持 l/c/r、p/m/b 列和常见重复列；此列格式请继续用 LaTeX 编辑。': {
    ja: '対応しているのは l/c/r 列、p/m/b 列とよく使われる繰り返し列です。この列の書式は引き続き LaTeX で編集してください。',
    en: 'Only l/c/r and p/m/b columns and common repeated columns are supported; keep editing this column format in LaTeX.',
  },
  '可视化编辑最多支持 100 列。': { ja: 'ビジュアル編集で扱えるのは 100 列までです。', en: 'The visual editor supports up to 100 columns.' },
  '自定义行高或分页控制暂不支持可视化转换，请保留 LaTeX 模式。': {
    ja: '行の高さの指定や改ページの制御はまだビジュアル編集で扱えません。LaTeX モードで編集してください。',
    en: 'Custom row heights or page-break control cannot be converted to the visual editor yet; keep using LaTeX mode.',
  },
  '表格中存在未配对的括号。': { ja: '表に対応の取れていない括弧があります。', en: 'The table has an unmatched brace.' },
  '表格中存在未闭合的括号或数学公式。': { ja: '表に閉じていない括弧または数式があります。', en: 'The table has an unclosed brace or math formula.' },
  '嵌套跨列暂不支持可视化转换。': {
    ja: '入れ子になった列の結合はまだビジュアル編集で扱えません。',
    en: 'Nested column spans cannot be converted to the visual editor yet.',
  },
  '跨列命令外含有额外内容，请保留 LaTeX 模式。': {
    ja: '列結合のコマンドの外に余分な内容があります。LaTeX モードで編集してください。',
    en: 'There is extra content outside a column-span command; keep using LaTeX mode.',
  },
  '跨列参数无效。': { ja: '列結合の引数が無効です。', en: 'The column-span arguments are invalid.' },
  '嵌套跨行暂不支持可视化转换。': {
    ja: '入れ子になった行の結合はまだビジュアル編集で扱えません。',
    en: 'Nested row spans cannot be converted to the visual editor yet.',
  },
  '可视化模式目前只支持垂直居中的跨行单元格。': {
    ja: 'ビジュアルモードで扱える行結合セルは、今のところ上下中央揃えのものだけです。',
    en: 'The visual mode only supports vertically centered row-spanning cells for now.',
  },
  '指定宽度的跨行单元格暂不支持可视化转换。': {
    ja: '幅を指定した行結合セルはまだビジュアル編集で扱えません。',
    en: 'Row-spanning cells with a set width cannot be converted to the visual editor yet.',
  },
  '跨行命令外含有额外内容，请保留 LaTeX 模式。': {
    ja: '行結合のコマンドの外に余分な内容があります。LaTeX モードで編集してください。',
    en: 'There is extra content outside a row-span command; keep using LaTeX mode.',
  },
  '跨行参数无效。': { ja: '行結合の引数が無効です。', en: 'The row-span arguments are invalid.' },
  '无法识别多行单元格的对齐设置。': { ja: '複数行セルの揃え方の指定を認識できません。', en: 'The alignment of a multi-line cell is not recognized.' },
  '单元格中含有无法安全拆解的表格命令，请继续用 LaTeX 编辑。': {
    ja: 'セルに安全に分解できない表のコマンドが含まれています。引き続き LaTeX で編集してください。',
    en: 'A cell contains table commands that cannot be safely taken apart; keep editing in LaTeX.',
  },
  '多个标题或标签无法安全合并，请保留 LaTeX 模式。': {
    ja: '複数のキャプションやラベルは安全にまとめられません。LaTeX モードで編集してください。',
    en: 'Several captions or labels cannot be safely merged; keep using LaTeX mode.',
  },
  '表格源码不完整。': { ja: '表のソースが不完全です。', en: 'The table source is incomplete.' },
  '该表格含有暂不支持的排版命令；原始 LaTeX 已保留。': {
    ja: 'この表にはまだ対応していない組版コマンドが含まれています。元の LaTeX はそのまま残っています。',
    en: 'This table uses typesetting commands that are not supported yet; the original LaTeX is kept.',
  },
  '请提供一个普通 tabular 表格；嵌套表格及复杂环境请继续用 LaTeX 编辑。': {
    ja: '通常の tabular の表を 1 つだけ使ってください。入れ子の表や複雑な環境は引き続き LaTeX で編集してください。',
    en: 'Use a single plain tabular; keep editing nested tables and complex environments in LaTeX.',
  },
  'tabular 环境未完整闭合。': { ja: 'tabular 環境が正しく閉じられていません。', en: 'The tabular environment is not properly closed.' },
  '无法识别表格对齐参数。': { ja: '表の揃え方の引数を認識できません。', en: 'The table alignment argument is not recognized.' },
  '表格样式包装已更改，请保留 LaTeX 模式以避免丢失自定义内容。': {
    ja: '表のスタイル用ラッパーが変更されています。独自の内容を失わないよう、LaTeX モードで編集してください。',
    en: 'The style wrapper of the table has been changed; keep using LaTeX mode so that custom content is not lost.',
  },
  '表格样式包装未闭合。': { ja: '表のスタイル用ラッパーが閉じられていません。', en: 'The style wrapper of the table is not closed.' },
  '框线粗细需要在 0–10 pt 范围内。': { ja: '罫線の太さは 0–10 pt の範囲にしてください。', en: 'The border width must be within 0–10 pt.' },
  '带裁切或独立线宽的横线暂不支持可视化转换。': {
    ja: 'トリミングや個別の線幅を指定した横線はまだビジュアル編集で扱えません。',
    en: 'Horizontal rules with trimming or their own width cannot be converted to the visual editor yet.',
  },
  '横线范围无效。': { ja: '横線の範囲が無効です。', en: 'The range of a horizontal rule is invalid.' },
  '此 hhline 样式暂不支持可视化转换。': {
    ja: 'この hhline のスタイルはまだビジュアル編集で扱えません。',
    en: 'This hhline style cannot be converted to the visual editor yet.',
  },
  '合并单元格的填色横线格式无效。': { ja: '結合セルの塗りつぶし用横線の書式が無効です。', en: 'The fill rule of a merged cell has an invalid format.' },
  '不同颜色的独立横线暂不支持可视化转换。': {
    ja: '色の異なる個別の横線はまだビジュアル編集で扱えません。',
    en: 'Separate horizontal rules in a different color cannot be converted to the visual editor yet.',
  },
  'hhline 的列数与表格不一致。': { ja: 'hhline の列数が表と一致しません。', en: 'The hhline column count does not match the table.' },
  '独立设置横线粗细的表格请继续用 LaTeX 编辑。': {
    ja: '横線の太さを個別に設定した表は、引き続き LaTeX で編集してください。',
    en: 'Keep editing tables with individually set rule widths in LaTeX.',
  },
  '双重横线暂不支持可视化转换。': {
    ja: '二重の横線はまだビジュアル編集で扱えません。',
    en: 'Double horizontal rules cannot be converted to the visual editor yet.',
  },
  '某一行的单元格数量与列定义不一致，请先检查 & 和跨列参数。': {
    ja: 'ある行のセル数が列の定義と一致しません。まず & と列結合の引数を確認してください。',
    en: 'The number of cells in a row does not match the column specification: check the & and column-span arguments first.',
  },
  '可视化编辑最多支持 500 行。': { ja: 'ビジュアル編集で扱えるのは 500 行までです。', en: 'The visual editor supports up to 500 rows.' },
  '表格没有可编辑的行。': { ja: '表に編集できる行がありません。', en: 'The table has no rows to edit.' },
  '跨行占位区含有独立内容或不同背景，无法无损转换。': {
    ja: '行結合のために空けたセルに独自の内容や異なる背景があるため、内容を失わずに変換できません。',
    en: 'A row-span placeholder cell has its own content or a different background, so it cannot be converted without loss.',
  },
  '跨行范围超出了表格。': { ja: '行結合の範囲が表からはみ出しています。', en: 'A row span reaches beyond the table.' },
  '合并范围与现有内容重叠，无法无损转换。': {
    ja: '結合範囲が既存の内容と重なっているため、内容を失わずに変換できません。',
    en: 'A merged range overlaps existing content, so it cannot be converted without loss.',
  },
  '横线只覆盖合并单元格的一部分，暂不支持无损可视化转换。': {
    ja: '横線が結合セルの一部だけにかかっているため、まだ内容を失わずにビジュアル編集へ変換できません。',
    en: 'A horizontal rule covers only part of a merged cell, so it cannot be converted to the visual editor without loss yet.',
  },
  '横线穿过跨行单元格，暂不支持无损可视化转换。': {
    ja: '横線が行結合セルを横切っているため、まだ内容を失わずにビジュアル編集へ変換できません。',
    en: 'A horizontal rule crosses a row-spanning cell, so it cannot be converted to the visual editor without loss yet.',
  },
  '合并单元格的填色横线已被修改，请继续用 LaTeX 编辑以保留样式。': {
    ja: '結合セルの塗りつぶし用横線が変更されています。スタイルを保つため、引き続き LaTeX で編集してください。',
    en: 'The fill rule of a merged cell has been changed; keep editing in LaTeX to preserve the style.',
  },
  '表格结构不完整，请保留 LaTeX 模式。': { ja: '表の構造が不完全です。LaTeX モードで編集してください。', en: 'The table structure is incomplete; keep using LaTeX mode.' },
  '无法安全转换此表格，原始 LaTeX 已保留。': {
    ja: 'この表は安全に変換できません。元の LaTeX はそのまま残っています。',
    en: 'This table cannot be converted safely; the original LaTeX is kept.',
  },
  '表格结构无效，无法生成 LaTeX。': { ja: '表の構造が無効なため、LaTeX を生成できません。', en: 'The table structure is invalid, so no LaTeX can be generated.' },
});
