import React, { useEffect, useState } from 'react';
import { publicFilePath } from '../../lib/results';
import { ResultBlock } from '../../types';
import { readsPrivately, useResultsAccess } from './access';
import PdfView from './PdfView';

/** A block's compiled PDF: read privately by the signed-in editor, or from the site for visitors. */
const BlockView: React.FC<{ paperId: string; block: ResultBlock }> = ({ paperId, block }) => {
  const access = useResultsAccess();
  const output = block.output;
  const isPrivate = readsPrivately(access, paperId);
  const [data, setData] = useState<Uint8Array | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isPrivate || !output || !access) return undefined;
    let cancelled = false;
    setData(undefined);
    setFailed(false);
    access
      .readFile(output.pdf)
      .then((bytes) => {
        if (!cancelled) setData(bytes);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isPrivate, output, access]);

  if (!output) {
    return <div className="py-8 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded">还没有编译</div>;
  }
  if (failed) {
    return <div className="py-8 text-center text-sm text-red-500 border border-dashed border-red-200 rounded">读取 PDF 失败，请刷新页面重试</div>;
  }
  return (
    <PdfView
      data={isPrivate ? data : undefined}
      url={isPrivate ? undefined : publicFilePath(output.pdf)}
      width={output.width}
      height={output.height}
    />
  );
};

export default BlockView;
