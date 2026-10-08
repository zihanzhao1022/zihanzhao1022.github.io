#!/usr/bin/env node
/**
 * Vendors the in-browser TeX engine into public/texlive/:
 * - pdfTeX and its worker from the SwiftLaTeX release; the worker is patched with
 *   scripts/texlive-worker-patch.js (see patchWorker);
 * - SwiftLaTeX's licence text (AGPL-3.0), taken from its repository at the release tag;
 * - the TeX Live files listed in public/texlive/files.txt, from TeXlyre's SwiftLaTeX-compatible server,
 *   and public/texlive/manifest.json that describes them.
 *
 * Run: node scripts/fetch-texlive.mjs (from any directory; paths are resolved from this file).
 * Needs Node 18+ (global fetch), the `unzip` command and network access. The output is committed.
 *
 * files.txt has one line per file: "<format>/<requested name>", a TAB, and the file name the server
 * answers with. A file name of "-" marks a key that is known NOT to exist on the server (TeX probes for
 * it on every run): the script checks that the server really answers 301 or 404, and lists the key under
 * "missing" in manifest.json so the worker never asks for it.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { gzipSync } from 'node:zlib';

const TAG = 'v20022022';
const RELEASE = `https://github.com/SwiftLaTeX/SwiftLaTeX/releases/download/${TAG}/20-02-2022.zip`;
const LICENSE = `https://raw.githubusercontent.com/SwiftLaTeX/SwiftLaTeX/${TAG}/LICENSE`;
const TEXLIVE = 'https://texlive.texlyre.org/pdftex/';
const HERE = fileURLToPath(new URL('.', import.meta.url));
const OUT = join(HERE, '..', 'public', 'texlive');
const WORKER_PATCH = join(HERE, 'texlive-worker-patch.js');
/** Needed by every run and large: stored gzipped and handed to the worker before the first compile. */
const PRELOAD = new Set(['10/swiftlatexpdftex.fmt', '11/pdftex.map']);

function countOf(source, needle) {
  return source.split(needle).length - 1;
}

function indexOfOnce(source, needle) {
  const at = source.indexOf(needle);
  if (at === -1 || source.indexOf(needle, at + 1) !== -1) throw new Error(`Patch anchor not found exactly once: ${needle.slice(0, 60)}`);
  return at;
}

function replaceOnce(source, from, to) {
  const at = indexOfOnce(source, from);
  return source.slice(0, at) + to + source.slice(at + from.length);
}

function patchWorker(js) {
  const patch = readFileSync(WORKER_PATCH, 'utf8');
  new Script(patch, { filename: WORKER_PATCH }); // parse only: a syntax error shows up here, not in the browser
  if (/fetchSync|handleExtraCommand/.test(js)) throw new Error('The worker already uses a name the patch defines');

  // SwiftLaTeX's own TeX Live servers are gone; TeXlyre runs a compatible one.
  let out = replaceOnce(
    js,
    'self.texlive_endpoint="https://texlive2.swiftlatex.com/";',
    'self.texlive_endpoint="https://texlive.texlyre.org/";self.bundle={};self.bundleBase="";',
  );
  // Every compile used to run BibTeX as well; nothing here needs it yet.
  out = replaceOnce(out, '_compileBibtex();', '');
  // SwiftLaTeX's kpse_find_file_impl is everything between these two anchors; the patch replaces it.
  // The PK font lookup after it stays as it is. The original function is about 1,000 characters long:
  // a much longer stretch means the release changed and something else would be cut out.
  const start = indexOfOnce(out, 'function kpse_find_file_impl(');
  const end = indexOfOnce(out, 'let pk404_cache={};');
  if (end < start || end - start > 2000) throw new Error('Unexpected code between the kpse_find_file_impl anchors');
  out = `${out.slice(0, start)}\n${patch.trim()}\n${out.slice(end)}`;
  // Commands the worker does not know go to the patch before they are reported as unknown.
  out = replaceOnce(out, 'else{console.error("Unknown command "+cmd)}', 'else if(!handleExtraCommand(cmd,data)){console.error("Unknown command "+cmd)}');

  for (const name of ['fetchSync', 'kpse_find_file_impl', 'handleExtraCommand', 'kpse_find_pk_impl']) {
    if (countOf(out, `function ${name}(`) !== 1) throw new Error(`The patched worker should define ${name} exactly once`);
  }
  new Script(out, { filename: 'swiftlatexpdftex.js' }); // parse only: the result must still be a valid classic script
  return out;
}

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return { data: Buffer.from(await res.arrayBuffer()), fileid: res.headers.get('fileid') };
}

/** SwiftLaTeX's servers answer 301 for a file they do not have; 404 is accepted as well. Redirects are not followed. */
async function assertMissing(key) {
  const res = await fetch(TEXLIVE + key, { redirect: 'manual' });
  await res.arrayBuffer();
  if (res.status !== 301 && res.status !== 404) throw new Error(`${key} is marked missing in files.txt but the server answered ${res.status}`);
}

/** Reads files.txt into [{ key, name }]; name is "-" for a key known not to exist on the server. */
function readFileList() {
  const entries = [];
  const keys = new Set();
  const names = new Set();
  for (const line of readFileSync(join(OUT, 'files.txt'), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const [key, name, ...extra] = line.trim().split('\t');
    if (!key || !name || extra.length) throw new Error(`Bad line in files.txt: ${line}`);
    if (!/^\d+\/[^\s/]+$/.test(key)) throw new Error(`Bad key in files.txt: ${key}`);
    if (keys.has(key)) throw new Error(`Duplicate key: ${key}`);
    keys.add(key);
    if (name !== '-') {
      if (names.has(name)) throw new Error(`Duplicate file name: ${name}`);
      names.add(name);
    }
    entries.push({ key, name });
  }
  return entries;
}

// Everything that can be wrong with the inputs is checked before anything in public/texlive is replaced.
const entries = readFileList();
mkdirSync(OUT, { recursive: true });

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
writeFileSync(join(OUT, 'LICENSE-SwiftLaTeX.txt'), (await download(LICENSE)).data);

// Start from an empty directory so that files removed from files.txt do not linger.
rmSync(join(OUT, 'files'), { recursive: true, force: true });
mkdirSync(join(OUT, 'files'), { recursive: true });

const manifest = { preload: {}, files: {}, missing: [] };
for (const { key, name } of entries) {
  if (name === '-') {
    await assertMissing(key);
    manifest.missing.push(key);
  } else {
    const { data, fileid } = await download(TEXLIVE + key);
    if (fileid !== name) throw new Error(`${key}: server sent ${fileid}, files.txt says ${name}`);
    if (PRELOAD.has(key)) {
      writeFileSync(join(OUT, 'files', `${name}.gz`), gzipSync(data, { level: 9 }));
      manifest.preload[key] = name;
    } else {
      writeFileSync(join(OUT, 'files', name), data);
      manifest.files[key] = name;
    }
  }
  process.stdout.write('.');
}
if (Object.keys(manifest.preload).length !== PRELOAD.size) throw new Error('A preload file is not listed in files.txt');
writeFileSync(join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\n${entries.length - manifest.missing.length} files, ${manifest.missing.length} known-missing keys`);
