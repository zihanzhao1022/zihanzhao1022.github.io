# 论文结果页 第二期：结果页、私有存储与代码编辑器 实施计划

> 精简版计划：用户要求提速，本期由主会话直接实现，期末做一次整体审查。每个任务仍然先写测试、再实现、再提交。

**Goal:** 所有者登录后可以在网站上新建论文、添加文字/图/表格块（LaTeX 代码模式，实时预览），内容存在私有仓库；取消隐藏后发布到网站，访客能看到目录页和论文页。

**Architecture:** 私有仓库 `zihanzhao1022/homepage-private` 的 `results.json` 是唯一数据来源；网站仓库只放公开快照（`content/results.json` + `public/results/<论文id>/`）。块在所有者浏览器里用第一期的 TeX 引擎编译成 PDF，页面用 `PdfView` 显示。编号和标签按顺序从上一个块延续，过期的块在保存时自动重新编译。

**设计文档：** `docs/superpowers/specs/2026-10-08-paper-results-design.md`（第 3–8 节）

## Global Constraints

- 第一期的全部约束继续有效（中文界面、英文代码与提交、虚构测试数据、ES2020、访客不下载编辑器代码）。
- 新论文默认 `hidden: true`；新块默认可见。
- 公开快照只含已公开论文的可见块，字段为 `id/slug/title/authors/venue/year/summary` 和块的 `{id, kind, output:{pdf,width,height}}`，不含源码、导言区、附件、`inputHash/counters/labels`。
- 编译成功（有 PDF 且日志无错误）才能保存块。
- 私有仓库提交信息：`results: <动作> "<论文标题>"`；网站仓库提交信息只出现已公开论文的标题。
- 新依赖：CodeMirror 6（`@codemirror/state`、`view`、`commands`、`language`、`legacy-modes`、`autocomplete`、`search`、`lint`），版本选发布超过两周的。
- 本期不做：封面图、表格可视化编辑（第三期）、导出时附带定义（第三期）、参考文献。

---

## Task 1: 类型、内容与路由

**Files:** `types.ts`、`content/results.json`（`[]`）、`content/index.ts`、`content/navigation.json`、`lib/hiddenContent.ts`(+test)、`views/__fixtures__/content.json`（加 `results: []`）、`components/pages.ts`、`components/SiteRoutes.tsx`、`lib/results.ts`(+test)

- `ResultPaper`、`ResultBlock`、`ResultBlockOutput`、`ResultBlockKind`；`SiteContent.results`；`ListCollection` 加 `'results'`；`BUILTIN_PAGES` 加 `'results'`；`EditRequest` 加 `{kind:'block', paperId, blockId?, blockKind?}` 和 `{kind:'paperSettings', paperId}`。
- 导航追加 `{ id: 'results', type: 'builtin', page: 'results', label: 'results', hidden: true }`。
- 路由：`/results` → 目录页；`/results/:slug` → 论文页；两者都只在导航项可见或所有者登录时存在。页面组件懒加载。
- `lib/results.ts`：`findPaper(papers, slug)`、`publicFileUrl(path)`（`results/...` → 站内地址）、`visibleBlocks`。

## Task 2: 内容操作与公开快照（纯函数）

**Files:** `editor/results/ops.ts`(+test)、`editor/results/snapshot.ts`(+test)

- `ResultsOp`：`putPaper`（新建或只更新信息字段，保留最新的块、导言区、附件）、`deletePaper`、`reorderPapers`、`setPaperHidden`、`patchPaper`（导言区、附件）、`putBlock`（按 id 替换或在给定位置插入）、`deleteBlock`、`reorderBlocks`、`setBlockHidden`、`setOutputs`、`batch`。
- `applyResultsOp(papers, op)`；`fromContentOp(op)`：把 `ItemModal`/拖拽产生的通用 `ContentOp`（collection 为 `results`）转成 `ResultsOp`。
- `buildSnapshot(papers)`；`snapshotFiles(papers)`（快照引用的 PDF 路径）；`planPublicSync({snapshot, currentJson, existingFiles})` → `{ json?: string; add: string[]; remove: string[] }`，没有变化时三者为空。

## Task 3: 私有仓库后端

**Files:** `editor/github.ts`(+test)、`editor/config.ts`、`editor/results/backend.ts`(+test)、`editor/results/mockBackend.ts`

- `GitHubApi` 增加 `readBytes(path, ref)`（raw 媒体类型）、`readTextIfExists(path, ref)`（404 → null）、`listFiles(treeSha, prefix)`（递归树）、删除用的树条目（`sha: null`）。
- `EDITOR_CONFIG.privateRepo = 'homepage-private'`。
- `ResultsBackend`：`load()` → `{ papers, state: 'ready' | 'unavailable' }`；`readFile(path)`（带内存缓存）；`save(op, writes, deletes, message)` → `{ papers, publicCommit?: string }`：先提交私有仓库（422 重试 3 次），保存前或保存后有已公开论文时再同步公开快照（复制新增文件、删除多余文件，422 重试）；`retryPublicSync(papers)`。
- 模拟模式：内存实现，`localStorage['mock-fail']` 规则同现有模拟后端。

## Task 4: 编译服务与编号

**Files:** `editor/results/compile.ts`(+test)、`editor/results/numbering.ts`(+test)

- `compileBlock(engine, {paper, block, counters, labels, files})`：包装、编译；如果本块新定义的标签被本块引用而第一遍没有，就带上新标签再编一遍；返回 `{ ok, pdf, width, height, counters, labels, issues, warnings, log, doc }`。过滤掉 "Label(s) may have changed" 警告。
- `blockContext(paper, index)`：上一个块结束时的计数器、全页标签表。
- `referencedLabels(source)`：`\ref`、`\eqref`、`\autoref`、`\cref`、`\Cref`、`\pageref`、`\nameref` 的标签（`\cref` 支持逗号分隔）。
- `inputHash(paper, block, context)`：导言区、附件名、类型、源码、起始计数器、被引用标签的值。
- `rebuild(paper, compile)`：按顺序重编过期块，标签变化时最多 3 轮；返回新的 `outputs` 和要写入、删除的 PDF；遇到失败停在该块。

## Task 5: 页面

**Files:** `components/results/ResultsList.tsx`、`components/results/ResultPage.tsx`、`components/results/BlockView.tsx`、`components/results/files.tsx`（所有者读取私有文件的 context）、`views/results.test.tsx`

- 目录页：卡片式（标题、作者、会议/状态、年份、简介），点击进入论文页；编辑模式下"＋ 添加论文"、铅笔、拖拽、"已隐藏"标签；私有仓库不可用时显示配置提示。
- 论文页：标题信息、块列表（`PdfView`）；编辑模式下"导言区与附件"、每块的编辑/隐藏/删除/拖拽、末尾"＋ 文字 / ＋ 图 / ＋ 表格"、表格块的"导出 LaTeX"。
- 测试（SSR）：访客只看到已公开论文和可见块；所有者看到隐藏论文和块并带标签；未知地址；导航项隐藏时访客打不开。

## Task 6: 编辑器

**Files:** `package.json`、`editor/results/CodeEditor.tsx`、`editor/results/BlockEditor.tsx`、`editor/results/PaperSettings.tsx`、`editor/results/ExportDialog.tsx`、`editor/schemas.ts`（论文表单）、`editor/EditorRoot.tsx`

- CodeMirror：stex 语法高亮、行号、括号匹配、搜索、撤销；补全常用命令和环境、导言区里的宏和颜色、`\ref{` 后的本页标签；错误行用 lint 标记。
- 块编辑器：全屏，左边代码、右边预览，1 秒防抖自动编译，`Ctrl/Cmd+Enter` 编译、`Ctrl/Cmd+S` 保存；错误列表点击跳行；图块有附件上传（PDF/PNG/JPG，≤20 MB）和"插入图片"；已公开论文提示"保存后访客可见"。
- 导言区与附件：导言区编辑、附件上传删除、测试编译；保存后全部块重新编译。
- 论文表单：标题*、页面地址（同自定义页面规则）、作者（每行一位）、会议或状态、年份、简介；新论文默认隐藏；取消隐藏前确认公开提示。
- `EditorRoot`：加载私有结果；路由 `block` / `paperSettings` 请求；`results` 集合的保存走结果后端；结构变化后自动 `rebuild` 并一次提交；公开同步的提交纳入部署状态。

## Task 7: 文档与验证

- `README.md`、`docs/admin-setup.md`：私有仓库的配置步骤、结果页的用法。
- 模拟模式下用浏览器走一遍：新建论文 → 三种块 → 编号与引用 → 拖动排序后编号更新 → 公开 → 访客视角 → 手机尺寸。
- 整体代码审查。
