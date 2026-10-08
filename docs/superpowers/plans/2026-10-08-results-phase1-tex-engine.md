# 论文结果页 第一期：浏览器内 TeX 编译 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在浏览器里用 pdfTeX（SwiftLaTeX，WebAssembly）把一个块的 LaTeX 编译成 PDF，并用 pdf.js 显示；提供一个开发用的试验页面 `#/__tex`。

**Architecture:** `public/texlive/` 放引擎、格式文件和常用 TeX Live 文件（由 `scripts/fetch-texlive.mjs` 下载并给 Worker 打补丁）。`editor/tex/engine.ts` 按 Worker 的消息协议封装编译；`editor/tex/document.ts` 把论文导言区和块源码包成完整文档；`editor/tex/log.ts` 从日志和 .aux 里取出错误、计数器和标签；`components/results/PdfView.tsx` 用 pdf.js 显示 PDF。

**Tech Stack:** React 18、TypeScript 5.9、Vite 5、Vitest 3、pdfjs-dist 6.3.289、SwiftLaTeX v20022022（pdfTeX 1.40.21，LaTeX 2020-02-02）。

**设计文档：** `docs/superpowers/specs/2026-10-08-paper-results-design.md`（第 6 节）

## Global Constraints

- 界面文字和文档用简体中文；代码、注释和提交信息用英文，提交信息末尾加 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- 论文内容只在浏览器里编译，只有 TeX Live 文件名会发给 `https://texlive.texlyre.org/`。
- 测试数据全部虚构，不使用任何真实论文的内容。
- 新依赖：只加 `pdfjs-dist@6.3.289`。
- `tsconfig` 的 `target` 是 ES2020：不要用 `Array.prototype.at`、`Object.hasOwn`、`String.prototype.replaceAll`。
- 访客不下载编辑器代码：引擎和 pdf.js 只能通过动态 `import()` 加载；试验页只在开发模式存在。

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `scripts/fetch-texlive.mjs` | 下载 SwiftLaTeX 引擎并给 Worker 打补丁；按 `public/texlive/files.txt` 下载 TeX Live 文件；生成 `manifest.json` |
| `public/texlive/files.txt` | 网站自带的 TeX Live 文件清单：每行 `格式编号/请求名<TAB>文件名` |
| `public/texlive/manifest.json` | 由脚本生成：预载文件和按需文件 |
| `public/texlive/README.md` | 来源、许可证、补丁说明 |
| `public/texlive/swiftlatexpdftex.{js,wasm}`、`public/texlive/files/*` | 由脚本生成 |
| `editor/tex/document.ts` | 包装文档：导言区预处理、浮动体改写、计数器恢复、.aux 标签 |
| `editor/tex/log.ts` | 解析错误、警告、计数器、.aux 标签；行号换算 |
| `editor/tex/engine.ts` | Worker 封装：启动、预载、编译队列、远程文件缓存 |
| `components/results/pdfjs.ts` | 按需加载 pdf.js；读取 PDF 页面尺寸 |
| `components/results/PdfView.tsx`、`pdfView.css` | 显示 PDF 第一页，带文字层 |
| `editor/tex/TexLab.tsx` | 开发用试验页 |
| `components/SiteRoutes.tsx` | 开发模式下增加 `/__tex` 路由 |

---

### Task 1: 引擎与 TeX Live 文件

**Files:**
- Create: `scripts/fetch-texlive.mjs`
- Create: `public/texlive/files.txt`
- Create: `public/texlive/README.md`
- Generated: `public/texlive/swiftlatexpdftex.js`, `public/texlive/swiftlatexpdftex.wasm`, `public/texlive/files/*`, `public/texlive/manifest.json`

**Interfaces:**
- Produces（Task 4 的 `engine.ts` 依赖）：
  - `public/texlive/manifest.json`：`{ "preload": { "10/swiftlatexpdftex.fmt": "swiftlatexpdftex.fmt", "11/pdftex.map": "pdftex.map" }, "files": { "<格式编号>/<请求名>": "<文件名>", ... } }`；预载文件存为 `files/<文件名>.gz`，其余存为 `files/<文件名>`。
  - Worker 新增消息：`{cmd:'setbundle', base, files}`、`{cmd:'preload', files:[{key, fileid, data}]}`（回复 `{cmd:'preload', result:'ok'}`）、`{cmd:'readfile', url}`（回复 `{cmd:'readfile', result, data}`）；远程下载后发出 `{cmd:'fetched', key, fileid, data}`。
  - 原有消息不变：`flushcache`、`mkdir`、`writefile`、`setmainfile`、`compilelatex`（回复 `{cmd:'compile', result, status, log, pdf}`）、`settexliveurl`。

- [ ] **Step 1: 写文件清单**

`public/texlive/files.txt` 写入技术验证中收集到的 211 行（默认导言区、ACL、ICLR 导言区编译时用到的文件），格式 `格式编号/请求名<TAB>文件名`：

```
10/swiftlatexpdftex.fmt	swiftlatexpdftex.fmt
11/pdftex.map	pdftex.map
26/article.cls	article.cls
26/size10.clo	size10.clo
26/size11.clo	size11.clo
26/times.sty	times.sty
26/booktabs.sty	booktabs.sty
26/multirow.sty	multirow.sty
26/xcolor.sty	xcolor.sty
26/color.cfg	color.cfg
26/pdftex.def	pdftex.def
26/colortbl.sty	colortbl.sty
26/array.sty	array.sty
26/makecell.sty	makecell.sty
26/amsmath.sty	amsmath.sty
26/amstext.sty	amstext.sty
26/amsgen.sty	amsgen.sty
26/amsbsy.sty	amsbsy.sty
26/amsopn.sty	amsopn.sty
26/amssymb.sty	amssymb.sty
26/amsfonts.sty	amsfonts.sty
26/preview.sty	preview.sty
26/luatex85.sty	luatex85.sty
26/prtightpage.def	prtightpage.def
26/l3backend-pdfmode.def	l3backend-pdfmode.def
26/ot1ptm.fd	ot1ptm.fd
26/supp-pdf.mkii	supp-pdf.mkii
26/umsa.fd	umsa.fd
26/umsb.fd	umsb.fd
33/ptmb7t.vf	ptmb7t.vf
33/ptmr7t.vf	ptmr7t.vf
44/8r.enc	8r.enc
32/cmbx10.pfb	cmbx10.pfb
32/cmmi10.pfb	cmmi10.pfb
32/utmb8a.pfb	utmb8a.pfb
32/utmr8a.pfb	utmr8a.pfb
3/ptmr7t	ptmr7t.tfm
3/cmex7	cmex7.tfm
3/msam10	msam10.tfm
3/msam7	msam7.tfm
3/msam5	msam5.tfm
3/msbm10	msbm10.tfm
3/msbm7	msbm7.tfm
3/msbm5	msbm5.tfm
3/ptmb7t	ptmb7t.tfm
3/cmbx10	cmbx10.tfm
3/cmbx7	cmbx7.tfm
3/cmbx5	cmbx5.tfm
3/ptmb8r	ptmb8r.tfm
3/ptmr8r	ptmr8r.tfm
3/cmr10	cmr10.tfm
26/geometry.sty	geometry.sty
26/keyval.sty	keyval.sty
26/ifvtex.sty	ifvtex.sty
26/iftex.sty	iftex.sty
26/caption.sty	caption.sty
26/caption3.sty	caption3.sty
26/natbib.sty	natbib.sty
26/hyperref.sty	hyperref.sty
26/ltxcmds.sty	ltxcmds.sty
26/pdftexcmds.sty	pdftexcmds.sty
26/infwarerr.sty	infwarerr.sty
26/kvsetkeys.sty	kvsetkeys.sty
26/kvdefinekeys.sty	kvdefinekeys.sty
26/pdfescape.sty	pdfescape.sty
26/hycolor.sty	hycolor.sty
26/letltxmacro.sty	letltxmacro.sty
26/auxhook.sty	auxhook.sty
26/kvoptions.sty	kvoptions.sty
26/pd1enc.def	pd1enc.def
26/intcalc.sty	intcalc.sty
26/etexcmds.sty	etexcmds.sty
26/url.sty	url.sty
26/bitset.sty	bitset.sty
26/bigintcalc.sty	bigintcalc.sty
26/atbegshi.sty	atbegshi.sty
26/hpdftex.def	hpdftex.def
26/atveryend.sty	atveryend.sty
26/rerunfilecheck.sty	rerunfilecheck.sty
26/uniquecounter.sty	uniquecounter.sty
26/latexsym.sty	latexsym.sty
26/fontenc.sty	fontenc.sty
26/t1ptm.fd	t1ptm.fd
3/ptmr8t	ptmr8t.tfm
26/inputenc.sty	inputenc.sty
26/microtype.sty	microtype.sty
26/microtype-pdftex.def	microtype-pdftex.def
26/microtype.cfg	microtype.cfg
26/inconsolata.sty	inconsolata.sty
26/textcomp.sty	textcomp.sty
26/xkeyval.sty	xkeyval.sty
26/xkeyval	xkeyval.tex
26/xkvutils	xkvutils.tex
26/graphicx.sty	graphicx.sty
26/graphics.sty	graphics.sty
26/trig.sty	trig.sty
26/graphics.cfg	graphics.cfg
26/dvipsnam.def	dvipsnam.def
26/marvosym.sty	marvosym.sty
26/tabularx.sty	tabularx.sty
26/listings.sty	listings.sty
26/lstmisc.sty	lstmisc.sty
26/listings.cfg	listings.cfg
26/siunitx.sty	siunitx.sty
26/expl3.sty	expl3.sty
26/xparse.sty	xparse.sty
26/l3keys2e.sty	l3keys2e.sty
26/translator.sty	translator.sty
26/nameref.sty	nameref.sty
26/refcount.sty	refcount.sty
26/gettitlestring.sty	gettitlestring.sty
26/mt-ptm.cfg	mt-ptm.cfg
26/upquote.sty	upquote.sty
26/translator-basic-dictionary-English.dict	translator-basic-dictionary-English.dict
26/siunitx-abbreviations.cfg	siunitx-abbreviations.cfg
26/mt-cmr.cfg	mt-cmr.cfg
3/cmr8	cmr8.tfm
3/cmr6	cmr6.tfm
3/cmmi10	cmmi10.tfm
3/cmmi8	cmmi8.tfm
3/cmmi6	cmmi6.tfm
3/cmsy10	cmsy10.tfm
3/cmsy8	cmsy8.tfm
3/cmsy6	cmsy6.tfm
3/cmex10	cmex10.tfm
3/cmex8	cmex8.tfm
26/ulasy.fd	ulasy.fd
3/lasy10	lasy10.tfm
3/lasy8	lasy8.tfm
3/lasy6	lasy6.tfm
26/mt-msa.cfg	mt-msa.cfg
26/mt-msb.cfg	mt-msb.cfg
3/cmss10	cmss10.tfm
3/cmss8	cmss8.tfm
3/cmtt10	cmtt10.tfm
3/cmtt8	cmtt8.tfm
3/cmr9	cmr9.tfm
3/cmmi9	cmmi9.tfm
3/cmsy9	cmsy9.tfm
3/cmex9	cmex9.tfm
3/cmss9	cmss9.tfm
3/cmtt9	cmtt9.tfm
3/lasy9	lasy9.tfm
3/lasy5	lasy5.tfm
3/ptmb8t	ptmb8t.tfm
3/ptmbi8t	ptmbi8t.tfm
3/lasy7	lasy7.tfm
33/ptmb8t.vf	ptmb8t.vf
33/ptmr8t.vf	ptmr8t.vf
33/ptmbi8t.vf	ptmbi8t.vf
3/ptmbi8r	ptmbi8r.tfm
32/cmmi9.pfb	cmmi9.pfb
32/cmr10.pfb	cmr10.pfb
32/cmr9.pfb	cmr9.pfb
32/cmsy10.pfb	cmsy10.pfb
32/cmsy9.pfb	cmsy9.pfb
32/utmbi8a.pfb	utmbi8a.pfb
32/cmmi7.pfb	cmmi7.pfb
3/cmbx9	cmbx9.tfm
3/cmbx6	cmbx6.tfm
3/cmbx8	cmbx8.tfm
32/cmbx9.pfb	cmbx9.pfb
32/cmmi5.pfb	cmmi5.pfb
32/cmmi6.pfb	cmmi6.pfb
32/cmsy6.pfb	cmsy6.pfb
32/cmsy7.pfb	cmsy7.pfb
3/ptmri8t	ptmri8t.tfm
33/ptmri8t.vf	ptmri8t.vf
3/ptmri8r	ptmri8r.tfm
32/utmri8a.pfb	utmri8a.pfb
26/t1zi4.fd	t1zi4.fd
3/t1-zi4r-0	t1-zi4r-0.tfm
44/i4-t1-0.enc	i4-t1-0.enc
32/Inconsolata-zi4r.pfb	Inconsolata-zi4r.pfb
32/msam10.pfb	msam10.pfb
26/eso-pic.sty	eso-pic.sty
3/phvb	phvb.tfm
26/capt-of.sty	capt-of.sty
26/float.sty	float.sty
26/pgffor.sty	pgffor.sty
26/pgfrcs.sty	pgfrcs.sty
26/pgfutil-common.tex	pgfutil-common.tex
26/pgfutil-common-lists.tex	pgfutil-common-lists.tex
26/pgfutil-latex.def	pgfutil-latex.def
26/everyshi.sty	everyshi.sty
26/pgfrcs.code.tex	pgfrcs.code.tex
26/pgf.revision.tex	pgf.revision.tex
26/pgfkeys.sty	pgfkeys.sty
26/pgfkeys.code.tex	pgfkeys.code.tex
26/pgfkeysfiltered.code.tex	pgfkeysfiltered.code.tex
26/pgfmath.sty	pgfmath.sty
26/pgfmath.code.tex	pgfmath.code.tex
26/pgfmathcalc.code.tex	pgfmathcalc.code.tex
26/pgfmathutil.code.tex	pgfmathutil.code.tex
26/pgfmathparser.code.tex	pgfmathparser.code.tex
26/pgfmathfunctions.code.tex	pgfmathfunctions.code.tex
26/pgfmathfunctions.basic.code.tex	pgfmathfunctions.basic.code.tex
26/pgfmathfunctions.trigonometric.code.tex	pgfmathfunctions.trigonometric.code.tex
26/pgfmathfunctions.random.code.tex	pgfmathfunctions.random.code.tex
26/pgfmathfunctions.comparison.code.tex	pgfmathfunctions.comparison.code.tex
26/pgfmathfunctions.base.code.tex	pgfmathfunctions.base.code.tex
26/pgfmathfunctions.round.code.tex	pgfmathfunctions.round.code.tex
26/pgfmathfunctions.misc.code.tex	pgfmathfunctions.misc.code.tex
26/pgfmathfunctions.integerarithmetics.code.tex	pgfmathfunctions.integerarithmetics.code.tex
26/pgfmathfloat.code.tex	pgfmathfloat.code.tex
26/pgffor.code.tex	pgffor.code.tex
26/enumitem.sty	enumitem.sty
32/cmr5.pfb	cmr5.pfb
32/cmr7.pfb	cmr7.pfb
3/ptmrc8t	ptmrc8t.tfm
33/ptmrc8t.vf	ptmrc8t.vf
```

- [ ] **Step 2: 写下载脚本**

`scripts/fetch-texlive.mjs`：

```js
#!/usr/bin/env node
/**
 * Vendors the in-browser TeX engine into public/texlive/:
 * - pdfTeX from the SwiftLaTeX release, with the worker patched (see patchWorker);
 * - the TeX Live files listed in public/texlive/files.txt, from TeXlyre's SwiftLaTeX-compatible server.
 *
 * Run from the repository root: node scripts/fetch-texlive.mjs
 * Needs network access and the `unzip` command. The output is committed.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const RELEASE = 'https://github.com/SwiftLaTeX/SwiftLaTeX/releases/download/v20022022/20-02-2022.zip';
const TEXLIVE = 'https://texlive.texlyre.org/pdftex/';
const OUT = 'public/texlive';
/** Needed by every run and large: stored gzipped and handed to the worker before the first compile. */
const PRELOAD = new Set(['10/swiftlatexpdftex.fmt', '11/pdftex.map']);

// Replaces SwiftLaTeX's lookup: the site's bundle first, then the remote server.
// Remote downloads are sent to the page so it can keep them in Cache Storage.
const FIND_FILE = `function fetchSync(url){const xhr=new XMLHttpRequest;xhr.open("GET",url,false);xhr.timeout=15e4;xhr.responseType="arraybuffer";try{xhr.send()}catch(err){return{status:0,data:null,fileid:null}}return{status:xhr.status,data:xhr.status===200?new Uint8Array(xhr.response):null,fileid:xhr.getResponseHeader("fileid")}}
function kpse_find_file_impl(nameptr,format,_mustexist){const reqname=UTF8ToString(nameptr);if(reqname.includes("/")){return 0}const cacheKey=format+"/"+reqname;if(cacheKey in texlive404_cache){return 0}if(cacheKey in texlive200_cache){return allocate(intArrayFromString(texlive200_cache[cacheKey]),"i8",ALLOC_NORMAL)}let fileid=self.bundle[cacheKey];let res=fileid?fetchSync(self.bundleBase+fileid):null;let remote=false;if(!res||res.status!==200){res=fetchSync(self.texlive_endpoint+"pdftex/"+cacheKey);fileid=res.fileid;remote=true}if(res.status!==200||!fileid){if(res.status===301||res.status===404){texlive404_cache[cacheKey]=1}return 0}const savepath=TEXCACHEROOT+"/"+fileid;FS.writeFile(savepath,res.data);texlive200_cache[cacheKey]=savepath;if(remote){self.postMessage({"cmd":"fetched","key":cacheKey,"fileid":fileid,"data":res.data.buffer},[res.data.buffer])}return allocate(intArrayFromString(savepath),"i8",ALLOC_NORMAL)}
`;

const EXTRA_COMMANDS =
  'else if(cmd==="setbundle"){self.bundleBase=data["base"];self.bundle=data["files"]}' +
  'else if(cmd==="preload"){for(const f of data["files"]){const savepath=TEXCACHEROOT+"/"+f["fileid"];FS.writeFile(savepath,new Uint8Array(f["data"]));texlive200_cache[f["key"]]=savepath}self.postMessage({"result":"ok","cmd":"preload"})}' +
  'else if(cmd==="readfile"){try{self.postMessage({"result":"ok","cmd":"readfile","data":FS.readFile(WORKROOT+"/"+data["url"],{encoding:"utf8"})})}catch(err){self.postMessage({"result":"failed","cmd":"readfile"})}}';

function replaceOnce(source, from, to) {
  const at = source.indexOf(from);
  if (at === -1 || source.indexOf(from, at + 1) !== -1) throw new Error(`Patch anchor not found exactly once: ${from.slice(0, 60)}`);
  return source.slice(0, at) + to + source.slice(at + from.length);
}

function patchWorker(js) {
  // SwiftLaTeX's own TeX Live servers are gone; TeXlyre runs a compatible one.
  let out = replaceOnce(
    js,
    'self.texlive_endpoint="https://texlive2.swiftlatex.com/";',
    'self.texlive_endpoint="https://texlive.texlyre.org/";self.bundle={};self.bundleBase="";',
  );
  // Every compile used to run BibTeX as well; nothing here needs it yet.
  out = replaceOnce(out, '_compileBibtex();', '');
  const start = out.indexOf('function kpse_find_file_impl(');
  const end = out.indexOf('let pk404_cache={};');
  if (start === -1 || end === -1 || end < start) throw new Error('kpse_find_file_impl not found');
  out = out.slice(0, start) + FIND_FILE + out.slice(end);
  return replaceOnce(out, 'else if(cmd==="flushcache"){cleanDir(WORKROOT)}', `else if(cmd==="flushcache"){cleanDir(WORKROOT)}${EXTRA_COMMANDS}`);
}

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return { data: Buffer.from(await res.arrayBuffer()), fileid: res.headers.get('fileid') };
}

mkdirSync(join(OUT, 'files'), { recursive: true });

const tmp = mkdtempSync(join(tmpdir(), 'swiftlatex-'));
try {
  const zip = join(tmp, 'release.zip');
  writeFileSync(zip, (await download(RELEASE)).data);
  const unzip = (name) => execFileSync('unzip', ['-p', zip, name], { maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(join(OUT, 'swiftlatexpdftex.wasm'), unzip('swiftlatexpdftex.wasm'));
  writeFileSync(join(OUT, 'swiftlatexpdftex.js'), patchWorker(unzip('swiftlatexpdftex.js').toString('utf8')));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const manifest = { preload: {}, files: {} };
const names = new Set();
const lines = readFileSync(join(OUT, 'files.txt'), 'utf8').split('\n').map((line) => line.trim()).filter(Boolean);
for (const line of lines) {
  const [key, fileid] = line.split('\t');
  if (!key || !fileid) throw new Error(`Bad line in files.txt: ${line}`);
  if (names.has(fileid)) throw new Error(`Duplicate file name: ${fileid}`);
  names.add(fileid);
  const { data, fileid: served } = await download(TEXLIVE + key);
  if (served !== fileid) throw new Error(`${key}: server sent ${served}, files.txt says ${fileid}`);
  if (PRELOAD.has(key)) {
    writeFileSync(join(OUT, 'files', `${fileid}.gz`), gzipSync(data, { level: 9 }));
    manifest.preload[key] = fileid;
  } else {
    writeFileSync(join(OUT, 'files', fileid), data);
    manifest.files[key] = fileid;
  }
  process.stdout.write('.');
}
writeFileSync(join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\n${lines.length} files`);
```

- [ ] **Step 3: 运行脚本**

Run: `node scripts/fetch-texlive.mjs`
Expected: 打印 211 个点，然后 `211 files`；`public/texlive/files/` 下 211 个文件（其中两个 `.gz`）；`public/texlive/manifest.json` 的 `preload` 有 2 项、`files` 有 209 项。

- [ ] **Step 4: 检查补丁和体积**

Run: `grep -c 'setbundle' public/texlive/swiftlatexpdftex.js; grep -c '_compileBibtex();' public/texlive/swiftlatexpdftex.js; grep -c 'texlive.texlyre.org' public/texlive/swiftlatexpdftex.js; du -sh public/texlive`
Expected: `1`、`0`、`1`；总体积约 8 MB。

- [ ] **Step 5: 写 README**

`public/texlive/README.md`：

```markdown
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
```

- [ ] **Step 6: 提交**

```bash
git add scripts/fetch-texlive.mjs public/texlive
git commit -m "feat: vendor the pdfTeX engine and common TeX Live files"
```

---

### Task 2: 包装文档

**Files:**
- Create: `editor/tex/document.ts`
- Test: `editor/tex/document.test.ts`

**Interfaces:**
- Produces:
  - `DEFAULT_PREAMBLE: string`
  - `type BlockKind = 'text' | 'figure' | 'table'`
  - `interface DocLines { preambleStartLine: number; preambleLineCount: number; sourceStartLine: number; sourceLineCount: number }`
  - `interface BlockDoc extends DocLines { main: string; aux: string }`
  - `interface BlockDocInput { preamble: string; source: string; kind: BlockKind; counters?: Record<string, number>; labels?: Record<string, string> }`
  - `passOptionsLines(preamble: string): string[]`
  - `stripComments(tex: string): string`
  - `buildBlockDocument(input: BlockDocInput): BlockDoc`
  - 日志标记：文档结束时每个计数器输出一行 `RESULTS-COUNTER:<名字>=<值>`

- [ ] **Step 1: 写失败的测试**

`editor/tex/document.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_PREAMBLE, buildBlockDocument, passOptionsLines, stripComments } from './document';

const TABLE = '\\begin{table}[t]\n\\centering\n\\begin{tabular}{lc}\nA & 1 \\\\\n\\end{tabular}\n\\caption{Demo}\n\\end{table}';

describe('stripComments', () => {
  it('drops comments but keeps escaped percent signs', () => {
    expect(stripComments('a % note\n50\\% b % more\n% whole line')).toBe('a \n50\\% b \n');
  });
});

describe('passOptionsLines', () => {
  it('passes the options of every package loaded with options', () => {
    expect(passOptionsLines('\\documentclass{article}\n\\usepackage[T1]{fontenc}\n\\usepackage{times}')).toEqual([
      '\\PassOptionsToPackage{T1}{fontenc}',
    ]);
  });

  it('merges repeated loads and package lists', () => {
    const preamble = '\\usepackage[dvipsnames]{xcolor}\n\\usepackage[table, dvipsnames]{xcolor}\n\\usepackage[utf8]{inputenc,demo}';
    expect(passOptionsLines(preamble)).toEqual([
      '\\PassOptionsToPackage{dvipsnames,table}{xcolor}',
      '\\PassOptionsToPackage{utf8}{inputenc}',
      '\\PassOptionsToPackage{utf8}{demo}',
    ]);
  });

  it('ignores commented-out packages', () => {
    expect(passOptionsLines('% \\usepackage[review]{acl}\n\\usepackage[final]{acl} % [draft]{x}')).toEqual([
      '\\PassOptionsToPackage{final}{acl}',
    ]);
  });
});

describe('buildBlockDocument', () => {
  it('puts the options first, then the preamble, then the block in a cropped minipage', () => {
    const doc = buildBlockDocument({ preamble: DEFAULT_PREAMBLE, source: TABLE, kind: 'table' });
    const lines = doc.main.split('\n');
    expect(lines[0]).toBe('\\PassOptionsToPackage{T1}{fontenc}');
    expect(lines[doc.preambleStartLine - 1]).toBe('\\documentclass{article}');
    expect(doc.preambleLineCount).toBe(DEFAULT_PREAMBLE.split('\n').length);
    expect(lines[doc.sourceStartLine - 1]).toBe('\\begin{table}[t]');
    expect(doc.sourceLineCount).toBe(7);
    expect(lines[doc.sourceStartLine - 2]).toBe('\\begin{preview}\\begin{minipage}{\\columnwidth}');
    expect(lines[doc.sourceStartLine - 1 + doc.sourceLineCount]).toBe('\\end{minipage}\\end{preview}');
    expect(doc.main).toContain('\\usepackage[active,tightpage]{preview}');
    expect(doc.main).toContain('\\renewenvironment{table*}[1][]{\\results@float{table}}{\\endresults@float}');
    expect(doc.main.trimEnd().endsWith('\\end{document}')).toBe(true);
  });

  it('uses the text width for starred floats', () => {
    const doc = buildBlockDocument({ preamble: DEFAULT_PREAMBLE, source: TABLE.replace(/table\}/g, 'table*}'), kind: 'table' });
    expect(doc.main).toContain('\\begin{preview}\\begin{minipage}{\\textwidth}');
  });

  it('adds a document class when the preamble has none', () => {
    const doc = buildBlockDocument({ preamble: '\\usepackage{booktabs}', source: 'Hi', kind: 'text' });
    const lines = doc.main.split('\n');
    expect(lines[doc.preambleStartLine - 2]).toBe('\\documentclass{article}');
    expect(lines[doc.preambleStartLine - 1]).toBe('\\usepackage{booktabs}');
  });

  it('restores counters, skipping page and list counters and odd names', () => {
    const doc = buildBlockDocument({
      preamble: DEFAULT_PREAMBLE,
      source: 'Hi',
      kind: 'text',
      counters: { table: 2, equation: 5, page: 3, enumi: 1, 'bad}name': 4 },
    });
    expect(doc.main).toContain('\\@ifundefined{c@table}{}{\\setcounter{table}{2}}');
    expect(doc.main).toContain('\\@ifundefined{c@equation}{}{\\setcounter{equation}{5}}');
    expect(doc.main).not.toContain('{c@page}');
    expect(doc.main).not.toContain('{c@enumi}');
    expect(doc.main).not.toContain('bad}name');
  });

  it('restores paragraph settings only for text blocks', () => {
    const text = buildBlockDocument({ preamble: DEFAULT_PREAMBLE, source: 'Hi', kind: 'text' });
    const table = buildBlockDocument({ preamble: DEFAULT_PREAMBLE, source: TABLE, kind: 'table' });
    expect(text.main).toContain('\\begin{minipage}{\\columnwidth}\\results@restorepar');
    expect(table.main).not.toContain('\\begin{minipage}{\\columnwidth}\\results@restorepar');
  });

  it('writes the labels of other blocks to the aux file', () => {
    const doc = buildBlockDocument({
      preamble: DEFAULT_PREAMBLE,
      source: 'See Table~\\ref{tab:a}.',
      kind: 'text',
      labels: { 'tab:a': '{1}{1}', 'eq:b': '{{2}{1}{}{equation.0.2}{}}' },
    });
    expect(doc.aux.split('\n')).toEqual([
      '\\relax',
      '\\providecommand\\hyper@newdestlabel[2]{}',
      '\\newlabel{tab:a}{{1}{1}}',
      '\\newlabel{eq:b}{{{2}{1}{}{equation.0.2}{}}}',
      '',
    ]);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run editor/tex/document.test.ts`
Expected: FAIL，`Failed to resolve import "./document"`。

- [ ] **Step 3: 实现**

`editor/tex/document.ts`：

```ts
/** Wraps one block of LaTeX into a complete document that compiles to a single tightly cropped page. */

export type BlockKind = 'text' | 'figure' | 'table';

/** Preamble for new papers; the owner usually pastes the paper's own. */
export const DEFAULT_PREAMBLE = String.raw`\documentclass{article}
\usepackage{times}
\usepackage[T1]{fontenc}
\usepackage{amsmath,amssymb}
\usepackage{graphicx}
\usepackage[table]{xcolor}
\usepackage{booktabs,multirow,makecell,array,tabularx}`;

/** Where the preamble and the block sit in main.tex (1-based lines), for mapping TeX's line numbers back. */
export interface DocLines {
  preambleStartLine: number;
  preambleLineCount: number;
  sourceStartLine: number;
  sourceLineCount: number;
}

export interface BlockDoc extends DocLines {
  main: string;
  aux: string;
}

export interface BlockDocInput {
  preamble: string;
  source: string;
  kind: BlockKind;
  /** Counter values at the end of the previous block. */
  counters?: Record<string, number>;
  /** Labels defined by the page's blocks: name → the second argument of \newlabel. */
  labels?: Record<string, string>;
}

// Reset by LaTeX itself or meaningless across blocks.
const SKIPPED_COUNTERS = new Set(['page', 'enumi', 'enumii', 'enumiii', 'enumiv', 'mpfootnote']);
const COUNTER_NAME = /^[A-Za-z@]+$/;

// Floats become minipages so they sit inside the cropped box; \caption still numbers them.
// At the end every counter (the list \include checkpoints) goes to the log for the next block.
const SUPPORT = String.raw`\makeatletter
\usepackage[active,tightpage]{preview}
\setlength\PreviewBorder{2pt}
\def\results@float#1{\def\@captype{#1}\par\noindent\begin{minipage}{\linewidth}}
\def\endresults@float{\end{minipage}\par}
\renewenvironment{table}[1][]{\results@float{table}}{\endresults@float}
\renewenvironment{table*}[1][]{\results@float{table}}{\endresults@float}
\renewenvironment{figure}[1][]{\results@float{figure}}{\endresults@float}
\renewenvironment{figure*}[1][]{\results@float{figure}}{\endresults@float}
\newlength\results@parindent
\newskip\results@parskip
\def\results@capture{\setlength\results@parindent{\parindent}\setlength\results@parskip{\parskip}}
\def\results@restorepar{\setlength\parindent{\results@parindent}\setlength\parskip{\results@parskip}}
\def\results@counter#1{\typeout{RESULTS-COUNTER:#1=\the\value{#1}}}
\AtEndDocument{\begingroup\let\@elt\results@counter\cl@@ckpt\endgroup}
\makeatother`;

/** Removes % comments, keeping escaped \%. */
export const stripComments = (tex: string): string => tex.replace(/(^|[^\\])%.*$/gm, '$1');

/**
 * \PassOptionsToPackage lines for every package the preamble loads with options. LaTeX 2020 reports an
 * option clash when a package is loaded again with new options (or was loaded earlier by a class or
 * style file); passing all options before \documentclass avoids that.
 */
export function passOptionsLines(preamble: string): string[] {
  const options = new Map<string, string[]>();
  for (const match of stripComments(preamble).matchAll(/\\usepackage\s*\[([^\]]*)\]\s*\{([^}]*)\}/g)) {
    const given = match[1].split(',').map((option) => option.trim()).filter(Boolean);
    for (const name of match[2].split(',').map((item) => item.trim()).filter(Boolean)) {
      const list = options.get(name) ?? [];
      for (const option of given) if (!list.includes(option)) list.push(option);
      options.set(name, list);
    }
  }
  return [...options].filter(([, list]) => list.length > 0).map(([name, list]) => `\\PassOptionsToPackage{${list.join(',')}}{${name}}`);
}

const auxFor = (labels: Record<string, string>): string =>
  [
    '\\relax',
    '\\providecommand\\hyper@newdestlabel[2]{}',
    ...Object.entries(labels).map(([name, value]) => `\\newlabel{${name}}{${value}}`),
    '',
  ].join('\n');

export function buildBlockDocument({ preamble, source, kind, counters = {}, labels = {} }: BlockDocInput): BlockDoc {
  const ownPreamble = preamble.replace(/\s+$/, '');
  const head = passOptionsLines(ownPreamble);
  if (!/\\documentclass/.test(stripComments(ownPreamble))) head.push('\\documentclass{article}');
  const preambleStartLine = head.length + 1;
  const preambleLineCount = ownPreamble.split('\n').length;

  const restore = Object.entries(counters)
    .filter(([name, value]) => COUNTER_NAME.test(name) && !SKIPPED_COUNTERS.has(name) && Number.isFinite(value))
    .map(([name, value]) => `\\@ifundefined{c@${name}}{}{\\setcounter{${name}}{${Math.trunc(value)}}}`);
  const width = /\\begin\{(?:table|figure)\*\}/.test(source) ? '\\textwidth' : '\\columnwidth';
  const body = source.replace(/\s+$/, '');

  const before = [
    ...head,
    ownPreamble,
    SUPPORT,
    '\\begin{document}',
    '\\makeatletter',
    ...restore,
    '\\results@capture',
    '\\makeatother',
    `\\begin{preview}\\begin{minipage}{${width}}${kind === 'text' ? '\\results@restorepar' : ''}`,
  ].join('\n');
  const main = `${before}\n${body}\n\\end{minipage}\\end{preview}\n\\end{document}\n`;
  return {
    main,
    aux: auxFor(labels),
    preambleStartLine,
    preambleLineCount,
    sourceStartLine: before.split('\n').length + 1,
    sourceLineCount: body.split('\n').length,
  };
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run editor/tex/document.test.ts`
Expected: PASS（10 tests）

- [ ] **Step 5: 提交**

```bash
git add editor/tex/document.ts editor/tex/document.test.ts
git commit -m "feat: wrap a block of LaTeX into a cropped standalone document"
```

---

### Task 3: 日志与 .aux 解析

**Files:**
- Create: `editor/tex/log.ts`
- Test: `editor/tex/log.test.ts`

**Interfaces:**
- Consumes: `DocLines`（Task 2）
- Produces:
  - `interface TexIssue { message: string; line?: number }`
  - `parseErrors(log: string): TexIssue[]`
  - `parseWarnings(log: string): string[]`
  - `parseCounters(log: string): Record<string, number>`
  - `parseAuxLabels(aux: string): Record<string, string>`
  - `interface LineLocation { area: 'source' | 'preamble' | 'wrapper'; line: number }`
  - `locateLine(line: number, doc: DocLines): LineLocation`

- [ ] **Step 1: 写失败的测试**

`editor/tex/log.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { locateLine, parseAuxLabels, parseCounters, parseErrors, parseWarnings } from './log';

const LOG = [
  '(/tex/booktabs.sty)',
  '! Undefined control sequence.',
  'l.42 Baseline & \\foo',
  '                     {1.0} \\\\',
  'LaTeX Warning: Reference `tab:x\' on page 1 undefined on input line 44.',
  '! LaTeX Error: File `missing.sty\' not found.',
  '',
  'Type X to quit or <RETURN> to proceed,',
  'l.7 \\usepackage',
  '               {missing}^^M',
  '!  ==> Fatal error occurred, no output PDF file produced!',
  'Package hyperref Warning: Token not allowed in a PDF string',
  'RESULTS-COUNTER:section=2',
  'RESULTS-COUNTER:table=3',
  'RESULTS-COUNTER:c@weird=x',
].join('\n');

describe('parseErrors', () => {
  it('reads each error with its line number and skips the final fatal line', () => {
    expect(parseErrors(LOG)).toEqual([
      { message: 'Undefined control sequence.', line: 42 },
      { message: "LaTeX Error: File `missing.sty' not found.", line: 7 },
    ]);
  });

  it('leaves the line out when TeX did not print one', () => {
    expect(parseErrors('! Emergency stop.\n<*> main.tex')).toEqual([{ message: 'Emergency stop.' }]);
  });
});

describe('parseWarnings', () => {
  it('keeps the first line of LaTeX and package warnings', () => {
    expect(parseWarnings(LOG)).toEqual([
      "LaTeX Warning: Reference `tab:x' on page 1 undefined on input line 44.",
      'Package hyperref Warning: Token not allowed in a PDF string',
    ]);
  });
});

describe('parseCounters', () => {
  it('reads the counter dump', () => {
    expect(parseCounters(LOG)).toEqual({ section: 2, table: 3 });
  });
});

describe('parseAuxLabels', () => {
  it('reads plain and hyperref labels with nested braces', () => {
    const aux = [
      '\\relax',
      '\\newlabel{tab:main}{{2}{1}}',
      '\\newlabel{eq:loss}{{{3}{1}{}{equation.0.3}{}}}',
      '\\@writefile{lot}{\\contentsline {table}{\\numberline {2}{\\ignorespaces Demo}}{1}}',
      '\\newlabel{sec:a}{{1}{1}{Intro {\\em first}}{section.1}{}}',
    ].join('\n');
    expect(parseAuxLabels(aux)).toEqual({
      'tab:main': '{2}{1}',
      'eq:loss': '{{3}{1}{}{equation.0.3}{}}',
      'sec:a': '{1}{1}{Intro {\\em first}}{section.1}{}',
    });
  });
});

describe('locateLine', () => {
  const doc = { preambleStartLine: 3, preambleLineCount: 5, sourceStartLine: 30, sourceLineCount: 10 };

  it('maps main.tex lines to the block or the preamble', () => {
    expect(locateLine(30, doc)).toEqual({ area: 'source', line: 1 });
    expect(locateLine(39, doc)).toEqual({ area: 'source', line: 10 });
    expect(locateLine(3, doc)).toEqual({ area: 'preamble', line: 1 });
    expect(locateLine(7, doc)).toEqual({ area: 'preamble', line: 5 });
    expect(locateLine(8, doc)).toEqual({ area: 'wrapper', line: 8 });
    expect(locateLine(40, doc)).toEqual({ area: 'wrapper', line: 40 });
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run editor/tex/log.test.ts`
Expected: FAIL，`Failed to resolve import "./log"`。

- [ ] **Step 3: 实现**

`editor/tex/log.ts`：

```ts
import type { DocLines } from './document';

export interface TexIssue {
  message: string;
  /** Line in main.tex, when TeX printed one. */
  line?: number;
}

export interface LineLocation {
  area: 'source' | 'preamble' | 'wrapper';
  /** 1-based line within that area (main.tex line for 'wrapper'). */
  line: number;
}

/** TeX errors: lines starting with "! ", each followed (usually) by "l.<n> ..." within a few lines. */
export function parseErrors(log: string): TexIssue[] {
  const lines = log.split('\n');
  const issues: TexIssue[] = [];
  lines.forEach((text, index) => {
    if (!text.startsWith('! ')) return;
    const message = text.slice(2).trim();
    if (message.startsWith('==> Fatal error')) return;
    let line: number | undefined;
    for (let next = index + 1; next < Math.min(lines.length, index + 20); next += 1) {
      if (lines[next].startsWith('! ')) break;
      const found = /^l\.(\d+)/.exec(lines[next]);
      if (found) {
        line = Number(found[1]);
        break;
      }
    }
    issues.push(line === undefined ? { message } : { message, line });
  });
  return issues;
}

export const parseWarnings = (log: string): string[] =>
  log
    .split('\n')
    .filter((line) => /^(LaTeX|Package \S+) Warning:/.test(line))
    .map((line) => line.trim());

/** The counter values printed by the wrapper at the end of the document. */
export function parseCounters(log: string): Record<string, number> {
  const counters: Record<string, number> = {};
  for (const match of log.matchAll(/^RESULTS-COUNTER:([A-Za-z@]+)=(-?\d+)\s*$/gm)) counters[match[1]] = Number(match[2]);
  return counters;
}

function readGroup(text: string, at: number): { body: string; end: number } | null {
  if (text[at] !== '{') return null;
  let depth = 0;
  for (let index = at; index < text.length; index += 1) {
    const char = text[index];
    if (char === '\\') {
      index += 1;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) return { body: text.slice(at + 1, index), end: index + 1 };
    }
  }
  return null;
}

/** \newlabel{name}{value} entries of an .aux file: name → value. */
export function parseAuxLabels(aux: string): Record<string, string> {
  const labels: Record<string, string> = {};
  const marker = '\\newlabel{';
  let at = aux.indexOf(marker);
  while (at !== -1) {
    const nameEnd = aux.indexOf('}', at + marker.length);
    if (nameEnd === -1) break;
    const value = readGroup(aux, nameEnd + 1);
    if (value) labels[aux.slice(at + marker.length, nameEnd)] = value.body;
    at = aux.indexOf(marker, value ? value.end : nameEnd + 1);
  }
  return labels;
}

export function locateLine(line: number, doc: DocLines): LineLocation {
  if (line >= doc.sourceStartLine && line < doc.sourceStartLine + doc.sourceLineCount) {
    return { area: 'source', line: line - doc.sourceStartLine + 1 };
  }
  if (line >= doc.preambleStartLine && line < doc.preambleStartLine + doc.preambleLineCount) {
    return { area: 'preamble', line: line - doc.preambleStartLine + 1 };
  }
  return { area: 'wrapper', line };
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npx vitest run editor/tex/log.test.ts`
Expected: PASS（6 tests）

- [ ] **Step 5: 提交**

```bash
git add editor/tex/log.ts editor/tex/log.test.ts
git commit -m "feat: read errors, counters and labels from pdfTeX output"
```

---

### Task 4: 引擎封装

**Files:**
- Create: `editor/tex/engine.ts`

**Interfaces:**
- Consumes: `public/texlive/manifest.json` 和 Worker 消息（Task 1）
- Produces:
  - `interface CompileInput { main: string; files?: Record<string, string | Uint8Array> }`
  - `interface CompileOutput { ok: boolean; status: number; log: string; pdf?: Uint8Array; aux?: string }`
  - `interface TexEngine { compile(input: CompileInput): Promise<CompileOutput> }`
  - `getTexEngine(): Promise<TexEngine>`（单例，第一次调用时启动；启动失败后下次重试）

这个模块依赖 Worker、Cache Storage 和 DecompressionStream，在 Task 6 用浏览器验证，不写单元测试。

- [ ] **Step 1: 实现**

`editor/tex/engine.ts`：

```ts
/**
 * pdfTeX (SwiftLaTeX, WebAssembly) in a worker. The site bundles the engine and common TeX Live files
 * under public/texlive/; anything else comes from TeXlyre's TeX Live server and is kept in Cache Storage.
 * Only file names leave the browser, never the document being compiled.
 */

export interface CompileInput {
  /** The text of main.tex. */
  main: string;
  /** Other files in the working directory, by relative path (attachments, main.aux). */
  files?: Record<string, string | Uint8Array>;
}

export interface CompileOutput {
  /** pdfTeX finished without errors and wrote a PDF. */
  ok: boolean;
  status: number;
  log: string;
  pdf?: Uint8Array;
  /** main.aux after the run: the labels this document defined. */
  aux?: string;
}

export interface TexEngine {
  compile(input: CompileInput): Promise<CompileOutput>;
}

interface Manifest {
  /** Handed to the worker up front; stored as files/<name>.gz. */
  preload: Record<string, string>;
  /** Fetched by the worker from files/ when TeX asks: "format/request" → file name. */
  files: Record<string, string>;
}

interface WorkerReply {
  cmd?: string;
  result?: string;
  status?: number;
  log?: string;
  pdf?: ArrayBuffer;
  data?: unknown;
  key?: string;
  fileid?: string;
}

interface PreloadFile {
  key: string;
  fileid: string;
  data: ArrayBuffer;
}

const REMOTE_CACHE = 'texlive-remote-v1';
const REMOTE_PREFIX = '/texlive-remote/';
const LOAD_FAILED = 'TeX 引擎加载失败，请检查网络后重试';

const assetUrl = (path: string): string => new URL(`texlive/${path}`, document.baseURI).href;

async function gunzip(res: Response): Promise<ArrayBuffer> {
  if (!res.ok || !res.body) throw new Error(LOAD_FAILED);
  return new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}

async function cachedRemoteFiles(): Promise<PreloadFile[]> {
  try {
    const cache = await caches.open(REMOTE_CACHE);
    const files = await Promise.all(
      (await cache.keys()).map(async (request) => {
        const res = await cache.match(request);
        const fileid = res?.headers.get('fileid');
        if (!res || !fileid) return null;
        const key = decodeURIComponent(new URL(request.url).pathname.slice(REMOTE_PREFIX.length));
        return { key, fileid, data: await res.arrayBuffer() };
      }),
    );
    return files.filter((file): file is PreloadFile => file !== null);
  } catch {
    // Cache Storage can be unavailable (private windows); the files are simply downloaded again.
    return [];
  }
}

function rememberRemoteFile(key: string, fileid: string, data: ArrayBuffer): void {
  caches
    .open(REMOTE_CACHE)
    .then((cache) => cache.put(REMOTE_PREFIX + encodeURIComponent(key), new Response(data, { headers: { fileid } })))
    .catch(() => undefined);
}

class WorkerEngine implements TexEngine {
  private waiting: { cmd: string; resolve: (reply: WorkerReply) => void } | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly worker: Worker,
    private readonly onCrash: () => void,
  ) {
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      const reply = event.data;
      if (reply.cmd === 'fetched') {
        if (reply.key && reply.fileid && reply.data instanceof ArrayBuffer) rememberRemoteFile(reply.key, reply.fileid, reply.data);
        return;
      }
      if (this.waiting && reply.cmd === this.waiting.cmd) {
        const { resolve } = this.waiting;
        this.waiting = null;
        resolve(reply);
      }
    };
    worker.onerror = () => {
      this.onCrash();
      if (this.waiting) {
        const { cmd, resolve } = this.waiting;
        this.waiting = null;
        resolve({ cmd, result: 'failed', status: -254, log: 'TeX 引擎意外退出' });
      }
    };
  }

  private post(message: Record<string, unknown>, transfer: Transferable[] = []): void {
    this.worker.postMessage(message, transfer);
  }

  private request(message: Record<string, unknown>, cmd: string, transfer: Transferable[] = []): Promise<WorkerReply> {
    return new Promise((resolve) => {
      this.waiting = { cmd, resolve };
      this.post(message, transfer);
    });
  }

  preload(files: PreloadFile[]): Promise<WorkerReply> {
    return this.request({ cmd: 'preload', files }, 'preload', files.map((file) => file.data));
  }

  compile(input: CompileInput): Promise<CompileOutput> {
    const run = this.queue.then(() => this.run(input));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async run({ main, files = {} }: CompileInput): Promise<CompileOutput> {
    // Start from an empty working directory so nothing leaks from the previous block.
    this.post({ cmd: 'flushcache' });
    const dirs = new Set<string>();
    for (const path of Object.keys(files)) {
      const parts = path.split('/');
      for (let depth = 1; depth < parts.length; depth += 1) dirs.add(parts.slice(0, depth).join('/'));
    }
    [...dirs]
      .sort((a, b) => a.split('/').length - b.split('/').length)
      .forEach((dir) => this.post({ cmd: 'mkdir', url: dir }));
    for (const [path, content] of Object.entries(files)) this.post({ cmd: 'writefile', url: path, src: content });
    this.post({ cmd: 'writefile', url: 'main.tex', src: main });
    this.post({ cmd: 'setmainfile', url: 'main.tex' });

    const reply = await this.request({ cmd: 'compilelatex' }, 'compile');
    if (reply.status === -254) {
      // The WebAssembly module aborted and cannot be reused; the next compile starts a new worker.
      this.worker.terminate();
      this.onCrash();
      return { ok: false, status: -254, log: reply.log ?? '' };
    }
    const pdf = reply.result === 'ok' && reply.pdf ? new Uint8Array(reply.pdf) : undefined;
    const aux = await this.request({ cmd: 'readfile', url: 'main.aux' }, 'readfile');
    return {
      ok: reply.status === 0 && pdf !== undefined,
      status: reply.status ?? -1,
      log: reply.log ?? '',
      pdf,
      aux: aux.result === 'ok' && typeof aux.data === 'string' ? aux.data : undefined,
    };
  }
}

async function startEngine(onCrash: () => void): Promise<TexEngine> {
  const worker = new Worker(assetUrl('swiftlatexpdftex.js'));
  await new Promise<void>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      if (event.data.result === 'ok' && !event.data.cmd) resolve();
      else reject(new Error(LOAD_FAILED));
    };
    worker.onerror = () => reject(new Error(LOAD_FAILED));
  });
  try {
    const res = await fetch(assetUrl('manifest.json'));
    if (!res.ok) throw new Error(LOAD_FAILED);
    const manifest = (await res.json()) as Manifest;
    worker.postMessage({ cmd: 'setbundle', base: assetUrl('files/'), files: manifest.files });
    const bundled = await Promise.all(
      Object.entries(manifest.preload).map(async ([key, fileid]) => ({
        key,
        fileid,
        data: await gunzip(await fetch(assetUrl(`files/${fileid}.gz`))),
      })),
    );
    const engine = new WorkerEngine(worker, onCrash);
    await engine.preload([...bundled, ...(await cachedRemoteFiles())]);
    return engine;
  } catch (error) {
    worker.terminate();
    throw error instanceof Error ? error : new Error(LOAD_FAILED);
  }
}

let started: Promise<TexEngine> | null = null;

/** The shared engine, started on first use (about 4 MB of downloads the first time). */
export function getTexEngine(): Promise<TexEngine> {
  if (!started) {
    const reset = (): void => {
      started = null;
    };
    started = startEngine(reset).catch((error: unknown) => {
      reset();
      throw error;
    });
  }
  return started;
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 没有输出（通过）。

- [ ] **Step 3: 提交**

```bash
git add editor/tex/engine.ts
git commit -m "feat: run pdfTeX in a worker with bundled and cached TeX Live files"
```

---

### Task 5: PDF 显示组件

**Files:**
- Modify: `package.json`、`package-lock.json`（加入 `pdfjs-dist@6.3.289`）
- Create: `components/results/pdfjs.ts`
- Create: `components/results/PdfView.tsx`
- Create: `components/results/pdfView.css`

**Interfaces:**
- Produces:
  - `loadPdfjs(): Promise<typeof import('pdfjs-dist')>`
  - `pdfPageSize(data: Uint8Array): Promise<{ width: number; height: number }>`（第一页的尺寸，单位 pt）
  - `PDF_SCALE: number`（1.25 × 4/3：每个 PDF 点对应的 CSS 像素）
  - `PdfView`（默认导出）：`{ data?: Uint8Array; url?: string; width: number; height: number; className?: string; onError?: (message: string) => void }`

- [ ] **Step 1: 安装依赖**

Run: `npm install pdfjs-dist@6.3.289`
Expected: `package.json` 的 dependencies 出现 `"pdfjs-dist": "^6.3.289"`，`package-lock.json` 锁定 6.3.289。

- [ ] **Step 2: pdf.js 加载器**

`components/results/pdfjs.ts`：

```ts
import type * as Pdfjs from 'pdfjs-dist';

let loading: Promise<typeof Pdfjs> | null = null;

/** pdf.js and its worker, loaded on first use so visitors of other pages never download them. */
export function loadPdfjs(): Promise<typeof Pdfjs> {
  loading ??= Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(
    ([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    },
  );
  return loading;
}

/** Size of the first page in points. */
export async function pdfPageSize(data: Uint8Array): Promise<{ width: number; height: number }> {
  const pdfjs = await loadPdfjs();
  // pdf.js takes ownership of the bytes it is given, so it gets a copy.
  const doc = await pdfjs.getDocument({ data: data.slice() }).promise;
  try {
    const { width, height } = (await doc.getPage(1)).getViewport({ scale: 1 });
    return { width, height };
  } finally {
    void doc.destroy();
  }
}
```

- [ ] **Step 3: 文字层样式**

`components/results/pdfView.css`（从 pdf.js 的 `web/pdf_viewer.css` 中取出文字层需要的规则）：

```css
/* Transparent, selectable text over the rendered page (the text layer rules of pdf.js's viewer CSS). */
.textLayer {
  position: absolute;
  inset: 0;
  overflow: clip;
  line-height: 1;
  text-align: initial;
  transform-origin: 0 0;
  forced-color-adjust: none;
  --min-font-size: 1;
  --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size));
  --min-font-size-inv: calc(1 / var(--min-font-size));
}

.textLayer span,
.textLayer br {
  color: transparent;
  position: absolute;
  white-space: pre;
  cursor: text;
  transform-origin: 0% 0%;
}

.textLayer > :not(.markedContent),
.textLayer .markedContent span:not(.markedContent) {
  z-index: 1;
  --font-height: 0;
  font-size: calc(var(--text-scale-factor) * var(--font-height));
  --scale-x: 1;
  --rotate: 0deg;
  transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv));
}

.textLayer .markedContent {
  display: contents;
}

.textLayer ::selection {
  background: rgba(147, 51, 234, 0.25);
}

.textLayer br::selection {
  background: transparent;
}
```

- [ ] **Step 4: 组件**

`components/results/PdfView.tsx`：

```tsx
import React, { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { loadPdfjs } from './pdfjs';
import './pdfView.css';

/** CSS pixels per PDF point at full size: 10pt text comes out about as large as the site's body text. */
export const PDF_SCALE = 1.25 * (4 / 3);

interface Props {
  /** PDF bytes: a fresh compile, or a private file read through the GitHub API. */
  data?: Uint8Array;
  /** Or the address of a published file. */
  url?: string;
  /** Page size in points, so the space is reserved before the PDF arrives. */
  width: number;
  height: number;
  className?: string;
  onError?: (message: string) => void;
}

/** The first page of a PDF, at PDF_SCALE or narrower to fit, with selectable text. */
const PdfView: React.FC<Props> = ({ data, url, width, height, className = '', onError }) => {
  const frame = useRef<HTMLDivElement>(null);
  const layers = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const errorRef = useRef(onError);
  errorRef.current = onError;

  useEffect(() => {
    const element = frame.current;
    if (!element) return undefined;
    const measure = () => setAvailable(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = available ? Math.min(PDF_SCALE, available / width) : PDF_SCALE;

  useEffect(() => {
    const target = layers.current;
    if (!target || !available || (!data && !url)) return undefined;
    let cancelled = false;
    let doc: PDFDocumentProxy | null = null;
    let task: RenderTask | null = null;
    setFailed(false);
    (async () => {
      const pdfjs = await loadPdfjs();
      doc = await pdfjs.getDocument(data ? { data: data.slice() } : { url }).promise;
      const page = await doc.getPage(1);
      if (cancelled) return;
      const ratio = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      canvas.style.display = 'block';
      task = page.render({ canvas, viewport: page.getViewport({ scale: scale * ratio }) });
      await task.promise;
      if (cancelled) return;
      const text = document.createElement('div');
      text.className = 'textLayer';
      text.style.setProperty('--scale-factor', String(scale));
      text.style.setProperty('--total-scale-factor', String(scale));
      await new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: text, viewport }).render();
      if (!cancelled) target.replaceChildren(canvas, text);
    })().catch((error: unknown) => {
      if (cancelled || (error instanceof Error && error.name === 'RenderingCancelledException')) return;
      setFailed(true);
      errorRef.current?.('PDF 显示失败');
    });
    return () => {
      cancelled = true;
      task?.cancel();
      void doc?.destroy();
    };
  }, [data, url, scale, available]);

  return (
    <div ref={frame} className={`w-full ${className}`}>
      <div className="relative mx-auto bg-white" style={{ width: width * scale, height: height * scale }}>
        <div ref={layers} className="absolute inset-0" />
        {failed && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">PDF 显示失败</div>
        )}
      </div>
    </div>
  );
};

export default PdfView;
```

- [ ] **Step 5: 类型检查**

Run: `npx tsc --noEmit`
Expected: 通过。

- [ ] **Step 6: 提交**

```bash
git add package.json package-lock.json components/results/pdfjs.ts components/results/PdfView.tsx components/results/pdfView.css
git commit -m "feat: show PDF pages with pdf.js, scaled to fit and with selectable text"
```

---

### Task 6: 开发用试验页与浏览器验证

**Files:**
- Create: `editor/tex/TexLab.tsx`
- Modify: `components/SiteRoutes.tsx`

**Interfaces:**
- Consumes: `getTexEngine`（Task 4）、`buildBlockDocument`/`DEFAULT_PREAMBLE`（Task 2）、`parseErrors`/`parseWarnings`/`parseCounters`/`parseAuxLabels`/`locateLine`（Task 3）、`PdfView`/`pdfPageSize`（Task 5）

- [ ] **Step 1: 试验页**

`editor/tex/TexLab.tsx`：

```tsx
import React, { useCallback, useState } from 'react';
import PdfView from '../../components/results/PdfView';
import { pdfPageSize } from '../../components/results/pdfjs';
import { BlockKind, DEFAULT_PREAMBLE, buildBlockDocument } from './document';
import { getTexEngine } from './engine';
import { locateLine, parseAuxLabels, parseCounters, parseErrors, parseWarnings } from './log';

const SAMPLE = String.raw`\begin{table}[t]
\centering
\begin{tabular}{lcc}
\toprule
\textbf{Method} & \textbf{A} & \textbf{B} \\
\midrule
Baseline & 71.2 & \cellcolor{green!15}68.0 \\
Ours & \textbf{79.8} & 75.3 \\
\bottomrule
\end{tabular}
\caption{A made-up table.}
\label{tab:sample}
\end{table}`;

interface Outcome {
  pdf?: Uint8Array;
  width: number;
  height: number;
  ms: number;
  problems: string[];
  warnings: string[];
  counters: Record<string, number>;
  labels: Record<string, string>;
  log: string;
}

const AREA = { source: '代码', preamble: '导言区', wrapper: '包装' } as const;

/** Development page for the TeX engine (#/__tex under npm run dev). */
const TexLab: React.FC = () => {
  const [preamble, setPreamble] = useState(DEFAULT_PREAMBLE);
  const [source, setSource] = useState(SAMPLE);
  const [kind, setKind] = useState<BlockKind>('table');
  const [counters, setCounters] = useState('{"table": 2}');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const compile = useCallback(async () => {
    setBusy(true);
    setFailure(null);
    try {
      const engine = await getTexEngine();
      const doc = buildBlockDocument({ preamble, source, kind, counters: JSON.parse(counters || '{}') as Record<string, number> });
      const started = performance.now();
      const out = await engine.compile({ main: doc.main, files: { 'main.aux': doc.aux } });
      const ms = Math.round(performance.now() - started);
      const size = out.pdf ? await pdfPageSize(out.pdf) : { width: 0, height: 0 };
      setOutcome({
        pdf: out.ok ? out.pdf : undefined,
        ...size,
        ms,
        problems: parseErrors(out.log).map((issue) => {
          if (issue.line === undefined) return issue.message;
          const where = locateLine(issue.line, doc);
          return `${AREA[where.area]}第 ${where.line} 行：${issue.message}`;
        }),
        warnings: parseWarnings(out.log),
        counters: parseCounters(out.log),
        labels: parseAuxLabels(out.aux ?? ''),
        log: out.log,
      });
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }, [preamble, source, kind, counters]);

  return (
    <div className="pb-20 space-y-4 text-sm">
      <h1 className="text-3xl font-light text-gray-900">TeX lab</h1>
      <textarea className="w-full h-32 border rounded p-2 font-mono text-xs" value={preamble} onChange={(e) => setPreamble(e.target.value)} />
      <textarea className="w-full h-64 border rounded p-2 font-mono text-xs" value={source} onChange={(e) => setSource(e.target.value)} />
      <div className="flex items-center gap-3">
        <select value={kind} onChange={(e) => setKind(e.target.value as BlockKind)} className="border rounded px-2 py-1">
          <option value="text">text</option>
          <option value="figure">figure</option>
          <option value="table">table</option>
        </select>
        <input className="border rounded px-2 py-1 font-mono text-xs w-64" value={counters} onChange={(e) => setCounters(e.target.value)} />
        <button type="button" onClick={() => void compile()} disabled={busy} className="px-3 py-1 rounded bg-purple-600 text-white disabled:opacity-50">
          {busy ? '编译中…' : '编译'}
        </button>
        {outcome && <span className="text-gray-500">{outcome.ms} ms</span>}
      </div>
      {failure && <p className="text-red-600">{failure}</p>}
      {outcome && (
        <>
          {outcome.problems.map((problem) => (
            <p key={problem} className="text-red-600">{problem}</p>
          ))}
          {outcome.pdf && <PdfView data={outcome.pdf} width={outcome.width} height={outcome.height} className="border" />}
          <pre className="text-xs bg-gray-50 p-2 overflow-auto">
            {JSON.stringify({ counters: outcome.counters, labels: outcome.labels, warnings: outcome.warnings }, null, 2)}
          </pre>
          <details>
            <summary className="cursor-pointer text-gray-500">日志</summary>
            <pre className="text-xs bg-gray-50 p-2 overflow-auto max-h-96">{outcome.log}</pre>
          </details>
        </>
      )}
    </div>
  );
};

export default TexLab;
```

- [ ] **Step 2: 路由**

`components/SiteRoutes.tsx` 在 import 之后加：

```tsx
// Development only: a page for trying the TeX engine. Production builds drop it and the engine.
const TexLab = import.meta.env.DEV ? React.lazy(() => import('../editor/tex/TexLab')) : null;
```

并在 `<Route path="*" .../>` 之前加：

```tsx
      {TexLab && (
        <Route
          path="/__tex"
          element={
            <React.Suspense fallback={null}>
              <TexLab />
            </React.Suspense>
          }
        />
      )}
```

- [ ] **Step 3: 全部测试和类型检查**

Run: `npm test && npx tsc --noEmit`
Expected: 全部通过，原有快照不变。

- [ ] **Step 4: 浏览器验证（`npm run dev`，打开 `http://localhost:3000/#/__tex`）**

1. 点"编译"：约几秒后出现表格 PDF；标题为 "Table 3: A made-up table."（起始计数器 table=2）；计数器里 `table` 为 3；标签里有 `tab:sample`。
2. 再点一次：耗时小于 300 ms。
3. 用 `read_network_requests` 确认：只请求了 `/texlive/...`，没有请求 `texlive.texlyre.org`（默认导言区的文件都已自带）。
4. 把 `\textbf{79.8}` 改成 `\textbff{79.8}` 再编译：显示"代码第 7 行：Undefined control sequence."，不显示 PDF。
5. 在导言区加 `\usepackage{lipsum}`，正文加 `\lipsum[1]`，类型选 text：编译成功；网络请求里出现 `texlive.texlyre.org/pdftex/26/lipsum.sty`；刷新页面再编译，不再请求它（来自 Cache Storage）。
6. 拖动 PDF 上的文字能选中；把浏览器窗口缩窄，PDF 等比缩小。

- [ ] **Step 5: 生产构建检查**

Run: `npm run build && grep -l "swiftlatex\|__tex\|TextLayer" dist/assets/*.js; echo "exit $?"`
Expected: 构建成功；grep 没有找到任何文件（`exit 1`），说明试验页、引擎和 pdf.js 都没有进入生产包。

- [ ] **Step 6: 提交**

```bash
git add editor/tex/TexLab.tsx components/SiteRoutes.tsx
git commit -m "feat: add a development page for trying the TeX engine"
```
