# TeX 引擎

论文结果页的编辑器用它在浏览器里编译 LaTeX。

| 文件 | 来源 | 许可证 |
|---|---|---|
| `swiftlatexpdftex.js`、`swiftlatexpdftex.wasm` | [SwiftLaTeX](https://github.com/SwiftLaTeX/SwiftLaTeX) v20022022 发布包，Worker 脚本经 `scripts/fetch-texlive.mjs` 修改 | AGPL-3.0（SwiftLaTeX）、GPL（pdfTeX） |
| `LICENSE-SwiftLaTeX.txt` | SwiftLaTeX 仓库 v20022022 标签下的 `LICENSE`，由 `scripts/fetch-texlive.mjs` 下载 | AGPL-3.0 许可证全文 |
| `files/` | TeX Live 2020，下载自 [TeXlyre](https://texlive.texlyre.org/) 的 SwiftLaTeX 兼容服务器 | 各宏包和字体自己的许可证（LPPL、GPL、OFL 等） |

`manifest.json` 由脚本根据 `files.txt` 生成，页面用它告诉 Worker 网站自带了哪些文件：

- `preload`：每次编译都要用、体积大的文件（格式文件和字体映射表），存为 `files/<文件名>.gz`，页面解压后用 `preload` 消息交给 Worker；
- `files`：其余自带文件，存为 `files/<文件名>`，`"格式编号/请求名"` 对应文件名；
- `missing`：已知服务器上不存在的键（见下面的 `files.txt` 一节）。

## 对 Worker 脚本的修改

修改的代码在 `scripts/texlive-worker-patch.js`，由 `scripts/fetch-texlive.mjs` 拼进发布包里的 Worker：

- TeX 需要文件时的查找顺序：已预载或已下载过的文件，网站自带的 `files/`（同源），最后是 `https://texlive.texlyre.org/`。从远程下载的文件会发给页面，由页面存进浏览器的 Cache Storage。
- 远程请求的超时是 30 秒。服务器回答"文件不存在"（301 或 404）或请求失败（断网、超时）之后，这个 Worker 在存活期间不再请求同一个文件。
- 所有者自己的文件名不会发给远程服务器，见"什么会离开浏览器"。
- 编译后不再自动运行 BibTeX。
- 新增消息 `setbundle`、`preload`、`readfile`，下载文件后发出消息 `fetched`。

## Worker 消息

页面发给 Worker：

- `{cmd:'setbundle', base, files, missing}`：说明网站自带哪些文件，没有回复。
  - `base`：自带文件所在目录的 URL，必须以 `/` 结尾（Worker 把文件名直接接在后面）。
  - `files`：`manifest.json` 的 `files`。
  - `missing`：`manifest.json` 的 `missing`。Worker 对这些键直接回答"不存在"，不发请求。可以省略。
- `{cmd:'preload', files:[{key, fileid, data}]}`：把文件写进 Worker 的文件系统。`key` 是 `格式编号/请求名`，`fileid` 是文件名，`data` 是文件内容（ArrayBuffer，已解压）。回复 `{cmd:'preload', result:'ok'}`，出错时 `result` 为 `'failed'`。
- `{cmd:'readfile', url}`：读工作目录里的文件，`url` 是相对工作目录的路径，例如 `main.log`。回复 `{cmd:'readfile', result:'ok', data}`，`data` 是 UTF-8 文本；读不到时 `result` 为 `'failed'`，没有 `data`。
- 原有消息不变：`flushcache`、`mkdir`、`writefile`、`setmainfile`、`compilelatex`（回复 `{cmd:'compile', result, status, log, pdf}`）、`settexliveurl`。

Worker 发给页面：

- `{cmd:'fetched', key, fileid, data}`：每次从远程服务器下载成功后发出。`key` 是 `格式编号/请求名`，`fileid` 是服务器给的文件名，`data` 是文件内容（ArrayBuffer，所有权转给页面）。页面可以把它存进 Cache Storage，下次启动时用 `preload` 预载。

## 什么会离开浏览器

文档内容不会离开浏览器，编译在浏览器里完成。Worker 发往外部的请求只有一种：向 `https://texlive.texlyre.org/pdftex/<格式编号>/<请求名>` 索取 TeX 要找、而网站没有自带的文件，请求里只有这个文件名。和任何网络请求一样，对方能看到访问者的 IP 地址和浏览器信息。字体点阵文件仍按 SwiftLaTeX 原来的方式请求 `pdftex/pk/<dpi>/<字体名>`，同样只含字体名，这部分没有修改。

所有者自己的文件和作业生成的文件，下面这些名字永远不会发出：Worker 直接当作"不存在"，不请求远程服务器。

- 名字以 `main.` 开头的文件（作业自己的 `main.aux`、`main.toc`、`main.out` 等）；
- 扩展名是 pdf、png、jpg、jpeg、eps、mps、jbig2、jb2、bmp、gif、svg、tif、tiff 的图形文件；
- 扩展名是 bib、bbl、blg 的参考文献文件；
- 扩展名是 aux、toc、lof、lot、out、log、nav、snm、vrb、idx、ind、ilg、glo、gls 的辅助文件；
- 含 `/` 的路径。

名字和扩展名都不分大小写。

原因：graphicx 对每个 `\includegraphics{名字}` 都会先找 `名字.pdf`，再找 `名字.png` 等，不拦截的话附件的名字就会被发出去。网站自带的文件仍然先检查，它们来自同一个网站，不经过第三方。

TeX 找的其他文件名，比如 `\usepackage{xxx}` 的 `xxx.sty`，只有在工作目录里没有、网站也没有自带时才会发出。

## 修改自带的文件

编辑 `files.txt`（每行 `格式编号/请求名<TAB>文件名`），然后在仓库根目录运行 `node scripts/fetch-texlive.mjs`。脚本需要 Node 18 以上和 `unzip` 命令，会清空并重新生成 `files/`、`manifest.json`、Worker 和许可证文件。

文件名一栏写 `-`，表示这个键已知在服务器上不存在，例如 `26/prdefault.cfg<TAB>-`：默认导言区每次编译都会找它，找不到也不影响结果。脚本会向服务器确认它确实回答 301 或 404（回答 200 就报错），再把它记进 `manifest.json` 的 `missing`。页面用 `setbundle` 把 `missing` 交给 Worker 后，Worker 不会再为这些键发请求。
