# 论文结果页：设计文档

- 日期：2026-10-08
- 状态：设计已确认（用户选择"先做出来再微调"）
- 基于：`2026-10-06-inline-edit-mode-design.md`、`2026-10-06-hide-items-design.md`、`2026-10-07-drag-and-navigation-design.md`

## 1. 目标

1. 新增"论文结果"页面：一个论文目录页，加上每篇论文各自的结果页，里面放文字、图和表。
2. 默认不公开。只有所有者登录后能看到和编辑；所有者点"取消隐藏"后才对访客公开。
3. 未公开的内容真正保密：不进入公开的网站仓库。
4. 文字、图、表都用 LaTeX 编写，在所有者的浏览器里用真正的 TeX 引擎编译，显示效果和论文 PDF 一致。
5. 编辑体验参考 Overleaf：左边代码，右边实时 PDF 预览，出错时标出行号。
6. 表格还可以可视化编辑（合并和拆分单元格、增删行列、文字颜色、底色、框线），并能导出 LaTeX 代码。

**本期不做**

- 参考文献：`\cite` 显示为 `(?)`，与没有运行 BibTeX 时相同。以后可以支持上传 .bib。
- 多人协作、版本历史界面（Git 历史本身可以回滚）。
- 访客复制 LaTeX 源码：公开快照里不含源码。
- 按数值自动上色（热力图）等批量格式工具。

## 2. 已确认的关键决策

| 决策 | 结论 |
|---|---|
| 保密方式 | 未公开内容存在私有 GitHub 仓库；公开时复制到网站仓库 |
| 页面组织 | 目录页（类似 publications）+ 每篇论文一个结果页 |
| 正文格式 | 直接写 LaTeX |
| 渲染方式 | 浏览器内运行真正的 TeX 引擎（pdfTeX，WebAssembly），不自己实现 LaTeX 子集 |
| 正文渲染 | 和表格一样用 TeX 编译 |
| Overleaf | 不部署 Overleaf；把它的编辑体验做进主页的编辑器 |

## 3. 页面

### 3.1 导航与路由

- `BUILTIN_PAGES` 增加 `results`。`content/navigation.json` 增加 `{ id: 'results', type: 'builtin', page: 'results', label: 'results', hidden: true }`，追加在末尾，默认隐藏。
- 路由：`/results` 是目录页，`/results/<地址>` 是论文页。和其他导航项一样，导航项隐藏时访客两个都打不开，所有者登录后可以打开。
- 两个页面和 pdf.js 都按需加载，不进入主包。

### 3.2 目录页

- 卡片样式参考 publications：标题、作者（`**名字**` 加粗）、会议或状态（如 "ICLR 2027 · under review"）、年份、一句话简介、可选封面图。
- 点卡片进入论文页。
- 编辑模式下：标题旁有"＋ 添加论文"；每张卡片有铅笔、拖拽把手和"已隐藏"标签。顺序就是数据顺序，新论文排在最前。

### 3.3 论文页

- 顶部：标题、作者、会议、年份、简介；编辑模式下有铅笔（编辑这些信息）和"导言区与附件"按钮。
- 下面是一列块，三种：文字块、图块、表格块。每个块显示为它编译出的 PDF。
- 编辑模式下：每个块有铅笔、拖拽把手、"已隐藏"标签；表格块还有"导出 LaTeX"；页面末尾有"＋ 文字""＋ 图""＋ 表格"。
- 显示比例：所有块用同一个比例，论文里 10pt 的字约等于网页正文字号（1pt 显示为 1.25 × 4/3 像素）；块比页面宽时缩小到页面宽度。
- 用 pdf.js 渲染，带文字层，文字可以选中复制。

## 4. 可见性

三级，都沿用现有的"隐藏 / 取消隐藏"：

| 层级 | 默认 | 隐藏时 |
|---|---|---|
| 导航项 `results` | 隐藏 | 访客打不开目录页和任何论文页 |
| 论文 | 新建时隐藏 | 只存在私有仓库里 |
| 块 | 新建时可见 | 不进入公开快照 |

- 论文"取消隐藏"就是公开：先确认"公开后内容会提交到公开仓库，之后再隐藏，Git 历史里仍会保留"，再执行。
- 已公开的论文里新加的块默认可见，保存后访客就能看到；编辑器里会提示"这篇论文已公开"。
- 隐藏的块仍然参与编号（见 6.4），所以访客看到的表号可能不连续，例如 Table 1 之后是 Table 3。

## 5. 存储与发布

### 5.1 私有仓库

`zihanzhao1022/homepage-private` 是唯一的数据来源：

| 路径 | 内容 |
|---|---|
| `results.json` | 所有论文：信息、导言区、附件列表、每个块的 LaTeX 源码和编译结果信息 |
| `results/<论文id>/files/<文件名>` | 附件：.sty、.cls、.tex、.bib、图片文件（PDF/PNG/JPG）、封面图 |
| `results/<论文id>/<块id>-<哈希>.pdf` | 块的编译结果 |

所有者登录后，编辑器用同一个 GitHub 令牌读取私有仓库，私有的 PDF 和图片通过 API 取回后只在浏览器里显示。

### 5.2 数据

```ts
interface ResultPaper {
  id: string;            // "res-<base36 时间戳>"
  slug: string;          // 页面地址，规则同自定义页面
  title: string;
  authors: string[];
  venue?: string;
  year?: number;
  summary?: string;
  image?: string;        // 封面，"results/<id>/files/..."
  hidden?: boolean;
  preamble?: string;     // 导言区，从 \documentclass 到 \begin{document} 之前
  files?: string[];      // 附件文件名
  blocks: ResultBlock[];
}

interface ResultBlock {
  id: string;            // "blk-<base36 时间戳>"
  kind: 'text' | 'figure' | 'table';
  hidden?: boolean;
  source?: string;       // LaTeX 源码
  output?: {
    pdf: string;         // "results/<论文id>/<块id>-<哈希>.pdf"
    width: number;       // PDF 页面尺寸（pt）
    height: number;
    inputHash: string;   // 编译时所有输入的哈希，用来判断是否过期
    counters: Record<string, number>;  // 块结束时的计数器
    labels: Record<string, string>;    // 本块定义的标签：名字 → \newlabel 的内容
  };
}
```

### 5.3 公开快照

- 网站仓库的 `content/results.json`：已公开论文的列表，只保留信息字段和可见块的 `{ id, kind, output: { pdf, width, height } }`。不含导言区、附件和源码，因为源码注释里可能有未公开的内容。
- `public/results/<论文id>/`：快照引用的 PDF 和封面图，访客地址为 `./results/<论文id>/...`。
- 快照总是从私有仓库的最新内容重新生成：
  1. 生成新的 `content/results.json`；
  2. 列出网站仓库 `public/results/` 下现有的文件；
  3. 缺的从私有仓库复制，多的删除；
  4. 什么都没变就不提交，否则一次提交。
- 提交信息：`content: publish result "<标题>"`、`content: update result "<标题>"`、`content: unpublish result "<标题>"`、`content: update results`。只出现已公开论文的标题。

### 5.4 保存流程

1. 先提交私有仓库（读最新 → 应用操作 → 提交，422 时重试，最多 3 次，同现有流程）。提交信息为 `results: <操作> "<论文标题>"`。
2. 如果这篇论文保存前或保存后是公开的，或者操作是调整论文顺序，就同步公开快照（5.3），这一步会触发部署，管理栏显示部署状态。
3. 公开同步失败时，私有仓库已经保存好了，提示"公开内容同步失败"并提供"重试"。重试就是重新执行 5.3。

### 5.5 内容操作

在现有 `ContentOp` 上增加 `results` 集合，论文级沿用 `upsert`、`delete`、`reorder`、`setHidden`。块级操作针对最新内容执行，避免排队保存时互相覆盖：

```ts
| { kind: 'upsertBlock'; paperId: string; block: ResultBlock; at?: number }
| { kind: 'deleteBlock'; paperId: string; blockId: string }
| { kind: 'reorderBlocks'; paperId: string; ids: string[] }
| { kind: 'setBlockHidden'; paperId: string; blockId: string; hidden: boolean }
| { kind: 'patchPaper'; paperId: string; fields: Partial<ResultPaper> }
| { kind: 'setOutputs'; paperId: string; outputs: Record<string, ResultBlock['output']> }
```

保存时可以附带要写入的文件（附件、新 PDF）和要删除的文件（块的旧 PDF），都在同一次提交里。

## 6. TeX 编译

### 6.1 引擎

- SwiftLaTeX 的 pdfTeX（WebAssembly，LaTeX 2020-02-02，宏包为 TeX Live 2020），在 Web Worker 里运行，只在所有者打开编辑器时加载。
- 不使用 SwiftLaTeX 自带的 `PdfTeXEngine.js`，自己按它的 Worker 消息协议封装。Worker 脚本做少量修改：文件加载顺序改为"预载文件 → 网站自带文件 → TeXlyre 服务器"，并把从服务器下载的文件回传给页面缓存。
- 网站自带（`public/texlive/`，同源加载）：
  - 引擎；
  - 格式文件和字体映射表，gzip 压缩后共约 2.4 MB，启动时解压预载；
  - 技术验证中默认导言区、ACL 和 ICLR 导言区用到的约 210 个宏包和字体文件，约 3.6 MB。
- 其他文件按"格式编号/文件名"从 `https://texlive.texlyre.org/`（SwiftLaTeX 兼容的 TeX Live 文件服务器，支持跨域）下载，存进浏览器的 Cache Storage，下次直接预载。只有文件名离开浏览器，论文内容不会。
- 许可证：SwiftLaTeX 为 AGPL-3.0，pdfTeX 为 GPL。在 `public/texlive/` 附上许可证、源码地址和修改说明。
- 技术验证结果（2026-10-08）：
  - 默认导言区和 ACL、ICLR 真实导言区下的 20 个表格和一段正文全部编译成功，效果与论文 PDF 一致；
  - 冷启动全部从服务器下载约 16 MB，约 20 秒；之后每次编译 0.05–0.2 秒。

### 6.2 导言区与附件

- 每篇论文一份导言区，直接粘贴论文的。新论文有默认导言区：`article` + `times` + booktabs、multirow、`xcolor[table]`、makecell、array、tabularx、amsmath、amssymb、graphicx。
- 附件（会议模板 .sty、`math_commands.tex`、图片等）编译时放在同一目录，导言区和块都可以直接引用。
- 改了导言区或附件后，这篇论文的所有块依次重新编译，然后一次提交。

### 6.3 编译文档

每个块单独编译，网站把它包成一个完整文档：

1. 论文的导言区。导言区里每个带选项的 `\usepackage[选项]{宏包}`，都在 `\documentclass` 之前补一行 `\PassOptionsToPackage{选项}{宏包}`。新版 LaTeX 允许同一个宏包分两次加载、各带不同选项，2020 版会报"选项冲突"；会议模板内部先加载一次也会触发同样的冲突。提前传入选项可以避免；
2. 注入 `\usepackage[active,tightpage]{preview}`，让输出的一页刚好包住内容；
3. `table`、`figure` 改为不浮动的环境（宽度为当前行宽），`\caption` 照常编号；
4. `\begin{document}` 之后恢复上一个块结束时的计数器；
5. 块的内容放在 `preview` 环境里的 `minipage` 中，宽度为：源码含 `table*` 或 `figure*` 时用 `\textwidth`，否则用 `\columnwidth`；文字块在 `minipage` 里恢复正文的 `\parindent`；
6. 文档结束前，把所有计数器的值和本块定义的标签输出到日志，供下一个块使用。

### 6.4 编号与引用

- 计数器（章节、公式、图、表、脚注，以及宏包定义的计数器）从上一个块接着计，和整篇论文连续编译的效果一样。
- 标签表：所有块的 `labels` 合在一起，编译前写进 `.aux`，所以 `\ref` 能引用本页任何块里的标签，包括后面的块。
- 过期判断：块的输入包括源码、导言区、附件内容、起始计数器、引用到的标签值。它们的哈希与 `output.inputHash` 不同，就说明块已过期。
- 改动或调整顺序后，从第一个过期块开始依次重新编译，直到没有过期块（最多 3 轮，防止标签循环依赖），然后一次提交。编辑器显示进度。
- 改动来源包括：保存某个块、调整块的顺序、隐藏或取消隐藏块（隐藏的块仍参与编号，避免公开与否改变编号）、改导言区或附件。

### 6.5 保存规则

- 编译成功（引擎返回 PDF 且日志里没有错误）才能保存。
- 失败时，编辑器显示错误，并换算成块源码里的行号；内容保持不变。
- 保存块时，同一次提交写入源码和新 PDF，删除这个块旧的 PDF。

## 7. 编辑器

### 7.1 共用框架

- 全屏打开。左边编辑，右边是 PDF 预览；窄屏改为"编辑 / 预览"两个标签页。
- 停止输入 1 秒后自动编译；`Ctrl/Cmd+Enter` 立即编译；`Ctrl/Cmd+S` 保存。
- 错误列在预览下方，点击跳到对应行，代码行旁也有标记。
- 代码编辑器用 CodeMirror 6：LaTeX 语法高亮、行号、括号匹配、搜索；自动补全常用命令和环境、导言区里定义的宏和颜色，以及 `\ref{` 后的本页标签。
- 有未保存的修改时关闭，先确认"放弃修改？"，与现有弹窗一致。

### 7.2 三种块

| 块 | 编辑器 |
|---|---|
| 文字块 | 代码 + 预览 |
| 图块 | 上传 PDF/PNG/JPG（单个不超过 20 MB，存为论文附件），自动生成 `figure` 环境代码；之后像普通代码一样修改 |
| 表格块 | "可视化 / 代码"两种模式 + 预览 |

新块的初始代码：

- 文字块：一段示例文字；
- 图块：上传后生成 `\begin{figure}[t] \centering \includegraphics[width=\linewidth]{<文件名>} \caption{} \label{fig:} \end{figure}`；
- 表格块：一个 3×3 的三线表，带 `\caption{}` 和 `\label{tab:}`。

### 7.3 表格的可视化模式

**表格模型**：解析块源码中的第一个 `tabular`、`tabular*` 或 `tabularx` 环境。

- 环境外的代码（`table*`、`\centering`、字号、`\setlength`、`\renewcommand{\arraystretch}`、`\resizebox`、`\caption`、`\label`、注释）原样保留。
- 列格式保留原文，包括 `@{…}`、`!{…}`、`>{…}`、`<{…}`、`*{n}{…}`、`p{…}`/`m{…}`/`b{…}`、`X`、`|` 和 `\newcolumntype` 定义的列。
- 行与行之间的命令依次保留：`\toprule`、`\midrule`、`\bottomrule`（含可选宽度）、`\cmidrule(lr){a-b}`、`\hline`、`\cline{a-b}`、`\addlinespace`。认识但不需要可视化的命令（如 `\rowcolors`、`\arrayrulecolor`、`\specialrule`）原样保留在原位置。
- 每行：可选的 `\rowcolor{…}`，各单元格，以及行尾 `\\[…]` 的可选间距。
- 单元格：去掉整格包裹的格式后剩下的 LaTeX 源码，加上格式：
  - `\multicolumn{n}{格式}{…}`（跨列，或单格改对齐和竖线）；
  - `\multirow[位置]{n}{宽度}[微调]{…}`（可选参数原样保留）；
  - `\cellcolor{…}`、`\textcolor{…}{…}`、`\textbf`、`\textit`/`\emph`、`\underline`。
  - 只包住部分内容的格式留在源码里，比如 `\textbf{82}.4`。
- 颜色表达式原样保存。网格显示时按 xcolor 规则计算颜色，支持命名颜色、`rgb`/`RGB`/`HTML`/`gray`/`cmyk` 模型、`a!p!b` 混色，以及导言区里的 `\definecolor`、`\colorlet`；算不出来的颜色在网格里显示为斜纹。

**网格与编辑栏**

- 网格显示合并、底色、文字颜色、加粗/斜体/下划线、对齐和框线。框线区分 booktabs 粗线、细线、`\cmidrule` 局部线、`\hline`/`\cline` 和竖线。
- 网格上方的编辑栏显示所选单元格的 LaTeX 源码（不含整格格式），可以直接修改。
- 单元格里显示源码文字，精确效果看右边的预览。

**工具栏**

- 撤销、重做。
- 加粗、斜体、下划线。
- 文字颜色和底色：色板先列导言区定义的颜色，然后是常用颜色，自选颜色写成 `[HTML]{RRGGBB}`；选中整行时底色写成 `\rowcolor`。
- 左/中/右对齐：选中整列时修改列格式，否则用 `\multicolumn{1}{…}{…}`。
- 合并和拆分单元格。
- 在上下插入行、在左右插入列，删除行或列。
- 框线：上、下、左、右、外框、全部、清除，以及"三线表"预设。横线可以选 booktabs 风格（`\toprule`/`\midrule`/`\bottomrule`/`\cmidrule(lr)`）或 `\hline`/`\cline` 风格；竖线写进列格式，只涉及部分行时用 `\multicolumn{1}{|c|}{…}`。

**键盘与粘贴**

- 方向键、Tab、Shift+Tab 移动；回车或直接打字开始编辑；Delete 清空。
- 从 Excel、Google 表格、CSV 粘贴的数据按纯文本处理，填入所选位置，必要时扩展表格；`\ % & # _ $ { } ~ ^` 自动转义。
- 在编辑栏里直接输入时，单元格中裸露的 `&` 和 `%` 会自动转义，因为它们会破坏表格结构。

**生成代码**

- 每次可视化修改后，只重新生成 `tabular` 环境内部的代码：每行一行，单元格用 ` & ` 分隔，行间命令各占一行，缩进 4 个空格。
- 环境外的代码不变。`tabular` 内部的注释会丢失，第一次从代码模式切到可视化模式时提示一次。
- 解析不了的表格（找不到 `tabular`、单元格数和列数对不上，或用了 `\hhline`、`\cdashline` 这类改变结构的命令）只能用代码模式，界面说明原因。

### 7.4 导出

- 表格编辑器和页面上的表格块都有"导出 LaTeX"。
- 内容就是块的源码，可以复制或下载为 `<标签或块id>.tex`。
- 默认在开头用注释列出需要的宏包，根据代码里用到的命令判断：booktabs、multirow、`xcolor[table]`、makecell、tabularx、graphicx 等。
- 可勾选"附上用到的颜色和命令定义"：从导言区挑出这张表用到的 `\definecolor`、`\colorlet`、`\newcommand`、`\newcolumntype`，包括它们依赖的定义。

### 7.5 论文信息与设置

- 论文信息用现有的表单弹窗：标题*、页面地址、作者（每行一位）、会议或状态、年份、简介、封面图。封面图上传到私有仓库的附件目录。
- "导言区与附件"弹窗：导言区代码编辑器；附件列表，可上传、删除；"测试编译"按钮用一个示例块检查导言区。

## 8. 出错处理

| 情况 | 处理 |
|---|---|
| 私有仓库不存在、为空，或 GitHub App 没有安装到它上面 | 目录页顶部提示配置步骤；结果相关的编辑按钮不可用，其他编辑功能不受影响 |
| 编译失败 | 显示错误和行号，不能保存 |
| 引擎或宏包下载失败 | 提示检查网络，可重试；已缓存的文件不受影响 |
| 镜像里也找不到某个宏包 | 错误信息写明缺哪个文件，可以把它作为附件上传 |
| 私有仓库提交冲突（422） | 自动重试 3 次，同现有流程 |
| 公开快照同步失败 | 私有仓库已保存；提示"公开内容同步失败"，带"重试" |
| 自动重新编译中途失败 | 停在失败的块，提示是哪一块；已经编译成功的块照常提交 |
| 登录过期、部署失败 | 沿用现有处理 |

## 9. 测试

**单元测试（Vitest）**

| 模块 | 内容 |
|---|---|
| 结果操作 | 块的增删改、排序、隐藏、`patchPaper`、`setOutputs`；对最新内容生效 |
| 公开快照 | 只含已公开论文的可见块；不含源码、导言区和附件；文件增删的计算；内容不变时不提交 |
| 结果后端 | 私有仓库提交和公开同步的调用顺序（模拟 fetch）；422 重试；同步失败时私有仓库已保存 |
| 编译文档 | 包装文档的结构、宽度选择、计数器恢复、`.aux` 标签注入；从日志解析计数器、标签和错误行号 |
| 编号 | 过期判断；按顺序重新编译；标签前向引用两轮收敛 |
| 表格解析与生成 | 用模拟的表格测试解析→生成往返不变：booktabs、`\cmidrule` 裁剪、`\multicolumn`、带可选参数的 `\multirow`、混色 `\cellcolor`、`\rowcolor`、`\makecell`、`@{…}` 列格式、`tabularx`、单元格内的公式和自定义宏 |
| 表格编辑 | 合并、拆分、增删行列、对齐、颜色、各种框线、三线表预设、粘贴 |
| 颜色计算 | 命名颜色、各模型、混色、`\definecolor`/`\colorlet` |
| 导出 | 宏包判断；定义提取（含依赖） |

测试数据全部是虚构的，只模仿写法，不使用任何真实论文的内容。

**浏览器验证（模拟模式 `npm run dev:mock`）**

- 结果数据用内存后端，引擎真实运行。
- 新建论文 → 添加三种块 → 编译 → 可视化编辑表格 → 导出 → 公开 → 以访客视角查看；以及拖动排序后编号更新、手机尺寸。

**真实端到端**（所有者完成配置后）：在私有仓库新建一篇测试论文，公开、确认网站上可见，再隐藏、确认已从网站仓库移除，最后删除。

## 10. 代码结构

```
types.ts                              ResultPaper、ResultBlock 等类型
content/results.json                  公开快照
components/results/ResultsList.tsx    目录页
components/results/ResultPage.tsx     论文页
components/results/PdfView.tsx        pdf.js 渲染（访客和所有者共用）
lib/results.ts                        纯函数：按地址查找、可见块等
editor/results/ops.ts                 块级内容操作
editor/results/snapshot.ts            公开快照与文件差异
editor/results/backend.ts             私有仓库读写、公开同步
editor/results/numbering.ts           编号、标签、过期判断、重新编译顺序
editor/results/BlockEditor.tsx        全屏编辑器
editor/results/CodeEditor.tsx         CodeMirror 封装
editor/results/PaperSettings.tsx      导言区与附件
editor/results/ExportDialog.tsx       导出 LaTeX
editor/tex/engine.ts                  引擎封装（Worker、文件加载、缓存）
editor/tex/document.ts                包装文档
editor/tex/log.ts                     日志解析
editor/table/parse.ts                 tabular → 表格模型
editor/table/generate.ts              表格模型 → tabular
editor/table/edit.ts                  表格编辑操作（纯函数）
editor/table/color.ts                 xcolor 颜色计算
editor/table/export.ts                宏包判断、定义提取
editor/table/TableGrid.tsx            网格、编辑栏、工具栏
public/texlive/                       引擎、格式文件、常用宏包、许可证
docs/admin-setup.md                   增加私有仓库的配置说明
```

## 11. 实施阶段

0. **技术验证**（已完成，结果见 6.1）：在本地用真实的表格和导言区（不提交）验证引擎能否编译，测加载体积、编译时间，确定宏包加载方式和格式文件来源。
1. **编译基础**：引擎封装、包装文档、日志解析、PDF 显示组件。
2. **结果页**：数据与操作、私有仓库后端、公开快照、目录页和论文页、三种块的代码编辑器、编号与重新编译、论文设置。
3. **表格可视化编辑与导出**。
4. **文档与上线**：更新 README 和 `docs/admin-setup.md`，所有者完成配置后做真实端到端测试。

## 12. 需要所有者完成的一次性配置

1. 新建私有仓库 `homepage-private`，勾选 "Add a README file"（Git Data API 不能在空仓库上提交）。
2. GitHub → Settings → Applications → Installed GitHub Apps → `zihanzhao-homepage-editor` → Configure → Repository access，把 `homepage-private` 加进去。权限不用改，现有的 Contents 读写已经够用。

## 13. 白名单协作者（2026-10-08 追加，用户选择方案 A）

**目标**：所有者可以给每篇论文指定 GitHub 用户：一类只能看，一类还能编辑这一篇。协作者看不到其他论文，也不能编辑网站的任何其他地方。

**数据**：`ResultPaper` 增加 `viewers?: string[]` 和 `editors?: string[]`（GitHub 用户名，不区分大小写）。只存在私有仓库，不进入公开快照，也不发给协作者。所有者在论文信息表单里编辑两份名单。

**把关**：Cloudflare Worker 代替协作者访问私有仓库。

- 协作者照常点锁形图标用 GitHub 登录。Worker 换到对方的令牌、确认身份后立即吊销该令牌；如果对方出现在任何一篇论文的名单里，就签发一个 Worker 自己的会话（HMAC 签名，8 小时有效），否则返回 403。
- Worker 用 GitHub App 的私钥签 JWT，换取只限 `homepage-private`、只有 Contents 读写权限的安装令牌（缓存到过期前），由它读写私有仓库。协作者手里从来没有能访问仓库的令牌。
- 接口（都需要协作者会话）：
  - `POST /results/load`：返回对方能看的论文。只能看的人拿到的形状与公开快照相同（只有可见块的 PDF）；能编辑的人拿到这篇论文的完整数据（含源码、导言区、附件列表、隐藏块），但不含名单。
  - `POST /results/file`：读取 `results/<论文id>/` 下的文件；只能看的人只能读可见块的 PDF。
  - `POST /results/save`：只有编辑者可用。只接受针对这一篇论文的 `putBlock`、`deleteBlock`、`reorderBlocks`、`setBlockHidden`、`setOutputs`、`patchPaper`（仅导言区和附件）及其组合；写入和删除的文件必须在 `results/<论文id>/` 下。Worker 在最新的 `results.json` 上应用并提交，提交信息注明 `(by <用户名>)`。
- 公开、隐藏、删除论文，修改论文信息和名单，只有所有者能做。协作者的修改不写网站仓库；所有者下次登录时，编辑器发现公开论文的快照落后，会自动同步并提示。

**网站**：协作者登录后进入"协作者模式"：顶部条显示身份和退出；不出现任何网站编辑按钮；`#/results` 只列出对方能看的论文；能编辑的论文页显示块的编辑、复制 LaTeX、添加块和"导言区与附件"，编辑器与所有者相同（编译仍在对方浏览器里进行）。

**所有者的一次性配置**：在 GitHub App 设置页生成私钥；在 `auth-worker` 目录运行 `wrangler secret put GITHUB_APP_PRIVATE_KEY`（私钥文件内容）和 `wrangler secret put SESSION_SECRET`（随机字符串），再 `wrangler deploy`。
