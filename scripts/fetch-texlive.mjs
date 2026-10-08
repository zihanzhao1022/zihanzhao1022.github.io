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
