// Code that scripts/fetch-texlive.mjs splices into SwiftLaTeX's pdfTeX worker
// (public/texlive/swiftlatexpdftex.js). Node never runs this file: the script reads it as text.
//
// It runs inside the worker, where these already exist: UTF8ToString, allocate, intArrayFromString,
// ALLOC_NORMAL, FS, TEXCACHEROOT, WORKROOT, texlive404_cache, texlive200_cache, self.texlive_endpoint,
// self.bundle and self.bundleBase. Keep it to function declarations (they are hoisted, so where the
// script puts them does not matter), and to syntax that every browser with module workers parses.
//
// Where TeX gets a file from, in order:
//   1. texlive200_cache: files handed over with `preload`, or downloaded earlier by this worker.
//   2. The site's own bundle (same origin), described by the `setbundle` message.
//   3. The remote TeX Live server (self.texlive_endpoint), never for the owner's own files.
// Names the server does not have are remembered in texlive404_cache, so each is asked for only once.

// Synchronous GET (TeX cannot continue before it has the answer). Status 0 means the request itself
// failed: no network, a blocked request or a timeout.
function fetchSync(url) {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', url, false);
  xhr.timeout = 3e4;
  xhr.responseType = 'arraybuffer';
  try {
    xhr.send();
  } catch (err) {
    return { status: 0, data: null, fileid: null };
  }
  // Only successful answers carry a readable fileid header; asking an error response for it makes the
  // browser log "Refused to get unsafe header".
  const ok = xhr.status === 200;
  return {
    status: xhr.status,
    data: ok ? new Uint8Array(xhr.response) : null,
    fileid: ok ? xhr.getResponseHeader('fileid') : null,
  };
}

// Replaces SwiftLaTeX's lookup. TeX calls this for every file it cannot find in the working directory.
// Returns the path of the file inside the worker's file system, or 0 if there is no such file.
function kpse_find_file_impl(nameptr, format, _mustexist) {
  const reqname = UTF8ToString(nameptr);
  if (reqname.includes('/')) {
    return 0;
  }
  const cacheKey = format + '/' + reqname;
  if (cacheKey in texlive404_cache) {
    return 0;
  }
  if (cacheKey in texlive200_cache) {
    return allocate(intArrayFromString(texlive200_cache[cacheKey]), 'i8', ALLOC_NORMAL);
  }

  // The site's own bundle. `bundle` maps "<format>/<name>" to the file name below `bundleBase`.
  let fileid = self.bundle[cacheKey];
  let res = fileid ? fetchSync(self.bundleBase + fileid) : null;
  let remote = false;

  if (!res || res.status !== 200) {
    // Only names of TeX Live files may leave the browser. The owner's own files must not: graphicx,
    // for one, probes `<name>.pdf`, `<name>.png`, ... for every \includegraphics, so the name of an
    // attachment would otherwise be sent to the remote server. These are the job's own files
    // (main.aux, main.toc, ...) and file types the owner supplies (images, bibliographies) or TeX
    // writes (auxiliary files). Treat them as missing without asking.
    // TeX Live file names are plain too: anything else (a name TeX built from document text, for
    // instance) is not sent either.
    if (
      !/^[A-Za-z0-9._+-]+$/.test(reqname) ||
      /^main\.|\.(pdf|png|jpg|jpeg|eps|mps|jbig2|jb2|bmp|gif|svg|tif|tiff|bib|bbl|blg|aux|toc|lof|lot|out|log|nav|snm|vrb|idx|ind|ilg|glo|gls)$/i.test(reqname)
    ) {
      texlive404_cache[cacheKey] = 1;
      return 0;
    }
    res = fetchSync(self.texlive_endpoint + 'pdftex/' + cacheKey);
    fileid = res.fileid;
    remote = true;
  }

  // The file name comes from the server: accept only a plain name, never a path.
  if (res.status !== 200 || !fileid || !/^[A-Za-z0-9._+-]+$/.test(fileid)) {
    // 301 and 404 are how the servers say "no such file". Status 0 is a network failure or timeout:
    // remember it too, so an unreachable server cannot stall every compile.
    if (res.status === 0 || res.status === 301 || res.status === 404) {
      texlive404_cache[cacheKey] = 1;
    }
    return 0;
  }

  const savepath = TEXCACHEROOT + '/' + fileid;
  FS.writeFile(savepath, res.data);
  texlive200_cache[cacheKey] = savepath;
  if (remote) {
    // Give the download to the page so it can keep it in Cache Storage. The buffer is transferred.
    self.postMessage({ cmd: 'fetched', key: cacheKey, fileid: fileid, data: res.data.buffer }, [res.data.buffer]);
  }
  return allocate(intArrayFromString(savepath), 'i8', ALLOC_NORMAL);
}

// Handles the messages this patch adds. The worker's onmessage calls it for every command it does not
// know. Returns true if the command was handled.
//
//   setbundle {base, files, missing}
//       base:    URL of the bundle directory, ending in "/" (a file is fetched from base + file name)
//       files:   { "<format>/<name>": "<file name>" }, manifest.json's "files"
//       missing: ["<format>/<name>", ...], names known not to exist remotely, manifest.json's "missing"
//   preload {files: [{key, fileid, data}]}
//       Writes the files into the worker's file system. Replies {cmd: 'preload', result: 'ok' | 'failed'}.
//   readfile {url}
//       Reads a file of the working directory as UTF-8. Replies {cmd: 'readfile', result, data}.
function handleExtraCommand(cmd, data) {
  if (cmd === 'setbundle') {
    self.bundleBase = data.base || '';
    self.bundle = data.files || {};
    for (const key of data.missing || []) {
      texlive404_cache[key] = 1;
    }
    return true;
  }
  if (cmd === 'preload') {
    try {
      for (const file of data.files) {
        const savepath = TEXCACHEROOT + '/' + file.fileid;
        FS.writeFile(savepath, new Uint8Array(file.data));
        texlive200_cache[file.key] = savepath;
      }
      self.postMessage({ result: 'ok', cmd: 'preload' });
    } catch (err) {
      self.postMessage({ result: 'failed', cmd: 'preload' });
    }
    return true;
  }
  if (cmd === 'readfile') {
    try {
      const text = FS.readFile(WORKROOT + '/' + data.url, { encoding: 'utf8' });
      self.postMessage({ result: 'ok', cmd: 'readfile', data: text });
    } catch (err) {
      self.postMessage({ result: 'failed', cmd: 'readfile' });
    }
    return true;
  }
  return false;
}
