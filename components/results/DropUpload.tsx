import React, { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useT } from '../../lib/phrases/site';
import { PickedFile, TooManyFiles, carriesFiles, droppedFiles } from './droppedFiles';

interface Props {
  onFiles: (files: PickedFile[]) => void;
  onTooMany: () => void;
}

// An editor or another dialog open over the page takes its own drops.
const dialogOpen = (): boolean => document.querySelector('[aria-modal="true"]') !== null;

/** While a paper's page is edited, files and folders dragged anywhere onto it upload to its attachments. */
const DropUpload: React.FC<Props> = ({ onFiles, onTooMany }) => {
  const t = useT();
  const [over, setOver] = useState(false);
  const handlers = useRef({ onFiles, onTooMany });
  handlers.current = { onFiles, onTooMany };

  useEffect(() => {
    // dragenter and dragleave fire for every element crossed; the drag has left the window at zero.
    let depth = 0;
    const leaveAll = () => {
      depth = 0;
      setOver(false);
    };
    const enter = (event: DragEvent) => {
      if (!carriesFiles(event) || dialogOpen()) return;
      event.preventDefault();
      depth += 1;
      setOver(true);
    };
    const hover = (event: DragEvent) => {
      if (!carriesFiles(event) || dialogOpen()) return;
      // Without this the browser opens a dropped file itself.
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };
    const leave = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      depth -= 1;
      if (depth <= 0) leaveAll();
    };
    const drop = (event: DragEvent) => {
      if (!carriesFiles(event) || dialogOpen() || !event.dataTransfer) return;
      event.preventDefault();
      leaveAll();
      droppedFiles(event.dataTransfer).then(
        (files) => {
          if (files.length > 0) handlers.current.onFiles(files);
        },
        (error: unknown) => {
          if (error instanceof TooManyFiles) handlers.current.onTooMany();
        },
      );
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', hover);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', hover);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, []);

  if (!over) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[95] flex items-center justify-center bg-purple-50/80 p-6">
      <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-purple-400 bg-white/90 px-10 py-8 text-center shadow-lg">
        <Upload size={28} className="text-purple-600" />
        <p className="text-base font-medium text-gray-900">{t('松开即可上传到这篇论文的附件')}</p>
        <p className="text-sm text-gray-500">{t('可以是多个文件或文件夹，文件夹会保留原来的结构；上传前会先让你确认')}</p>
      </div>
    </div>
  );
};

export default DropUpload;
