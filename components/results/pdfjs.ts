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
  const loading = pdfjs.getDocument({ data: data.slice() });
  try {
    const doc = await loading.promise;
    const { width, height } = (await doc.getPage(1)).getViewport({ scale: 1 });
    return { width, height };
  } finally {
    void loading.destroy();
  }
}
