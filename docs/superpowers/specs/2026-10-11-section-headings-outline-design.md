# 小节标题、左侧大纲与跨块引用链接（结果页第一期）

日期：2026-10-11。设计已在对话中逐项确认。第二期是右侧批注，另写文档。本文接着 `2026-10-08-paper-results-design.md` 第 14 节"小节标题与导出全文"。

## 1. 目标

1. 论文结果页可以添加小节标题：四级，每级可选编号或不编号；编号和 LaTeX 一致，块里可以 `\ref` 小节。
2. 导出全文 LaTeX。
3. 左侧大纲：列出小节标题和每节的图表编号；点击跳转，高亮当前阅读位置，并显示协作者在哪里。
4. 页面布局：宽屏时左边大纲、中间正文；右栏留给第二期的批注。
5. 修复：`\ref` 等引用指向别的块里的图、表、公式时，不是超链接。

## 2. 数据

`types.ts`：

```ts
export type ResultBlockKind = 'text' | 'figure' | 'table' | 'heading';
export type HeadingLevel = 'section' | 'subsection' | 'subsubsection' | 'paragraph';

/** A section heading on a results page, shown as HTML. */
export interface ResultHeading {
  level: HeadingLevel;
  /** Unnumbered, like \section*. */
  starred?: boolean;
  /** One line; exported to LaTeX as is. */
  title: string;
  /** For \ref from the blocks, e.g. "sec:method". Private only. */
  label?: string;
}

/** What compiling a heading gives; no PDF is kept. */
export interface HeadingNumbering {
  /** Private only, like the three fields after it. */
  inputHash?: string;
  counters?: Record<string, number>;
  labels?: Record<string, string>;
  /** The number LaTeX prints, e.g. "2.1"; absent when the heading has none. */
  number?: string;
  /** hyperref's anchor, e.g. "subsection.2.1", so \ref links can jump to the heading. */
  anchor?: string;
}

// ResultBlock gains, for kind 'heading' only (such blocks have no source or output):
//   heading?: ResultHeading;
//   numbering?: HeadingNumbering;
// ResultBlockOutput gains, filled in by publicView only:
//   /** The figure or table number for the outline, e.g. "3" or "3–4". */
//   number?: string;
```

小节标题是一种块：和文字、图、表格同在 `paper.blocks` 里，沿用 `putBlock`、`deleteBlock`、`reorderBlocks`、`setBlockHidden` 这些操作，所以能拖动排序、隐藏、删除。

## 3. 编号

- `rebuild` 照旧按页面顺序处理所有块，小节标题也参与：
  - 生成 LaTeX `\<level>{<title>}`；不编号时用 `\<level>*{<title>}`。
  - 编号且有引用名时，再加 `\label{<label>}`。
  - 编号时还加一个内部标签 `\label{results-heading}`，用来读出编号和锚点。
  - 用现有的包装文档按文字块编译，计数器和标签的上下文与其他块相同。PDF 丢掉，不写文件。
- 编译结果存进 `numbering`：
  - `counters`、`labels`：`labels` 去掉内部标签，用户的引用名留着，所以别的块能 `\ref` 到它。
  - `number`、`anchor`：只有这一级的计数器确实增加了才算编号。这时 `number` 取内部标签的第一组（`\@currentlabel`，即 LaTeX 印出的编号），`anchor` 取第四组。计数器没增加就没有编号，包括带星号的，以及文档类不给这一级编号的情况（article 默认不给 paragraph 编号）。
- 小节标题的 `inputHash` 包含：包装版本、导言区、导言区用到的附件、标题的四个字段、开始时的计数器。
- 后面的块从小节标题那里接着计数器，所以前面增删或改动小节标题时，后面的块会重新编译。这一点已在设计时确认接受。
- `blockContext`、`staleBlocks` 在找上一个块的计数器、收集全页标签时，把小节标题的 `numbering` 也算上。
- `WRAPPER_VERSION` 不变，所以已有的块不会因为这个功能重新编译。
- 小节标题编译失败的处理和其他块一样：报“第 N 个块编译失败”，不保存。

## 4. 编辑

- **插入入口**：插入按钮（页面底部，以及块下方悬停出现的那组）增加“小节标题”。
- **编辑入口**：编辑模式下，标题行右侧有编辑按钮。
- **请求类型**：新增 `EditRequest` `{ kind: 'heading'; paperId: string; blockId?: string; afterBlockId?: string }`，打开小窗 `HeadingEditor`。
- **小窗里的字段**：
  - 等级：section、subsection、subsubsection、paragraph；
  - 编号：复选框，paragraph 默认不勾，其余默认勾上；
  - 标题：必填，单行，最长 200 字；
  - 引用名：可选，只能用字母、数字和 `: _ - .`。不编号时不能填（带星号的标题不能被 `\ref`）。
- **保存**：和块编辑器一样，先 `putBlock` 加重新编译，再一起提交；编译失败就报错，不保存。
- **隐藏与删除**：放在小窗里，规则和块编辑器相同：删除前要确认；删掉后如果编译失败就不删；已公开的论文取消隐藏前也要确认。
- **权限**：只有作者能加、能改。协作者编辑开放之前，`checkEditorOp` 拒绝写小节标题块的操作。

## 5. 显示

- section 到 paragraph 依次渲染成 `h2` 到 `h5`，有编号时编号在前，例如“2.1 Method”。样式与站点一致。
- 标题按原文显示，只把常见转义还原：`\&` `\%` `\_` `\#` `\$` `\{` `\}`，以及 `~`（显示为空格）。其余 LaTeX 按源码显示。
- 隐藏的小节标题：作者在编辑模式下看到半透明的；协作者看不到。
- 标题行和其他块一样是带 `data-result-block-id` 的块，所以“在看哪一块”、块旁的头像、大纲都对它有效。
- 有锚点时，标题元素的 id 是 `destinationId(paperId, anchor)`（见第 9 节）。

## 6. 导出全文 LaTeX

- **入口**：“参考文献”旁边加“导出全文 LaTeX”按钮，只在作者的编辑模式下显示。
- **拼接内容**：
  - 开头是 `% Requires:`，列出所有块需要的宏包（`requiredPackages` 的结果合并去重）。
  - 然后按页面顺序拼接，块之间空一行：
    - 小节标题写成 `\section{Title}` 或 `\section*{Title}`；编号且有引用名时，后面再加 `\label{...}`，和编译时一致。
    - 其他块写源码，去掉可视化表格的缓存行，和单块“复制 LaTeX”一样。
  - 隐藏的块也包括在内，不含导言区和 References。
- **结果**：复制到剪贴板，按钮显示“已复制”或“复制失败”。

## 7. 左侧大纲

- **条目**：
  - 小节标题：按等级缩进，显示编号和标题。
  - 图、表块：显示“图 3”“表 2”，没有编号时只写“图”“表”。缩进到所属小节的下一级；第一个小节标题之前的图表放在最上层。
  - 有参考文献时，最后一项是“References”。
  - 文字块不列。
- **图表编号**（`blockNumber`，作者和 `publicView` 共用这一个函数）：
  1. 先看块自己的标签：锚点以 `figure.` 或 `table.` 开头的，取第一组；多个就用逗号连起来。
  2. 没有这样的标签，就比较块开始和结束时的计数器（图块看 `figure`，表块看 `table`）：增加 1 写“n”，增加更多写“a–b”。
  3. 都没有，就没有编号。
- **点击**：平滑滚动到对应的块，并留出导航栏的高度。
- **高亮**：当前阅读位置用“在看哪一块”的同一个判断。在图表块上时高亮这个图表，否则高亮所在的小节。
- **协作者**：其他人所在位置对应的条目右侧，显示他们的小头像（规则同上）。
- **数据来源**：作者用完整数据；协作者用 `publicView`，其中带小节标题和图表编号，没有隐藏内容。
- **空的时候**：一个条目也没有就不显示大纲。作者在编辑模式下显示提示“添加小节标题后，这里会出现大纲”。

## 8. 页面布局

- **宽屏（≥1280px）**：
  - 论文页的容器放宽到最多 88rem，导航栏不变。
  - 两列网格：大纲 14rem，加正文。大纲固定在导航栏下方，内容超出屏幕高度时可以单独滚动。
  - 第二期再加右侧批注列。
- **窄屏（<1280px）**：“← results”旁边放一个“目录”按钮，点开是左侧抽屉（覆盖层）。点条目会跳转并关闭抽屉。
- 其他页面不变。

## 9. 跨块引用链接

- **现状**：块里的 `\ref`、`\eqref`、`\autoref`、`\cref` 指向别的块里的图、表、公式时，标签已经由上下文提供，所以编号能显示出来。但本块 PDF 里没有对应的目标，pdfTeX 会造一个整页 `/Fit` 的假目标。`PdfView` 把这种链接当作无法解析，直接丢掉，所以不是超链接。
- **改法**：
  1. **登记 PDF 里的目标**：每个块的 PDF 渲染时，把它的命名目标（`doc.getDestinations()`）登记成页面上的定位点：一个 `span`，id 为 `destinationId(paperId, name)`，位置由 `destinationPoint` 算出。跳过 `Doc-Start`、`page.*`，以及正文块里的 `cite.*`。页面上已经有同一个 id 时也跳过，以先登记的为准，避免重复 id。
  2. **登记小节标题**：标题元素用 `destinationId(paperId, anchor)` 登记（第 5 节）。
  3. **保留并处理链接**：假目标的链接不再丢掉。点击时先在本 PDF 内解析；解析不到就跳到页面上同名的定位点；页面上也没有（比如目标块对协作者隐藏）就不动。
  4. **文献引用**（`cite.*`）保持现有逻辑。

## 10. 权限与发布

- **`publicView`**（协作者看到的、以及已公开论文的快照都用它）：
  - 没隐藏的小节标题块输出 `{ id, kind, heading: { level, starred?, title }, numbering: { number?, anchor? } }`，不含引用名和内部数据。
  - 图、表块的 `output` 加上 `number`。
  - 隐藏的块和小节标题照旧去掉。
- **在线状态**：位置过滤用的是 `papersFor` 的结果，协作者能看到的小节标题自然包括在内，不用另改。

## 11. 测试

- **编号**（用假的编译函数）：
  - 编号和锚点能从内部标签读出来；
  - 不编号的没有编号，计数器不增加的也没有；
  - 引用名能被别的块 `\ref`，内部标签不外泄；
  - 插入小节后，后面的块重新编译；
  - 小节标题不写 PDF 文件。
- **大纲**：生成的条目正确，包括层级、图表归到哪一节、第一个小节之前的图表、References、编号来源（标签优先，计数器兜底）。
- **导出全文**：标题命令、带星号、引用名、包含隐藏块、宏包开头、不含 References。
- **`publicView`**：带小节标题和图表编号，隐藏的小节和引用名不出现。
- **权限**：协作者写小节标题块的操作被拒绝。
- **跨块链接**：登记哪些目标、id 怎么生成，以及点击时找目标的逻辑（纯函数部分）。
- **本地模拟里看**：宽屏和窄屏，编辑和浏览模式，加、改、删小节标题，点大纲跳转，跨块引用跳转。

## 12. 不在第一期

- 右侧批注：第二期。
- 大纲里显示图表的标题文字。
- 标题里的数学公式渲染。
- 协作者编辑小节标题。
