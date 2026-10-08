# TeX 引擎

论文结果页的编辑器用它在浏览器里编译 LaTeX。

| 文件 | 来源 | 许可证 |
|---|---|---|
| `swiftlatexpdftex.js`、`swiftlatexpdftex.wasm` | [SwiftLaTeX](https://github.com/SwiftLaTeX/SwiftLaTeX) v20022022 发布包，Worker 脚本经 `scripts/fetch-texlive.mjs` 修改 | AGPL-3.0（SwiftLaTeX）、GPL（pdfTeX） |
| `files/` | TeX Live 2020，下载自 [TeXlyre](https://texlive.texlyre.org/) 的 SwiftLaTeX 兼容服务器 | 各宏包和字体自己的许可证（LPPL、GPL、OFL 等） |

对 Worker 脚本的修改：

- TeX 需要文件时，先找 `files/`（清单在 `manifest.json`），找不到再问 `https://texlive.texlyre.org/`；从远程下载的文件会发给页面缓存。
- 编译后不再自动运行 BibTeX。
- 新增消息 `setbundle`、`preload`、`readfile`。

修改自带的文件：编辑 `files.txt`（每行 `格式编号/请求名<TAB>文件名`），然后在仓库根目录运行 `node scripts/fetch-texlive.mjs`。
