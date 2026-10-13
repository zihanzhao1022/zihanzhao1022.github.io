import type { PickedFile } from '../../components/results/droppedFiles';
import { ATTACHMENT_LIMIT, ATTACHMENT_TYPES, attachmentName, extensionOf } from './actions';

/** The most files one upload takes. */
export const MAX_UPLOAD = 200;

/** What uploading picked files would do to a paper's attachments. */
export interface UploadPlan {
  /** The files to upload, by the name each is stored under (with its folders). */
  files: Record<string, Uint8Array>;
  /** Those names that replace attachments the paper has. */
  replaced: string[];
  /** Files left out, by why: a type compiles cannot use, over ATTACHMENT_LIMIT, or past MAX_UPLOAD. */
  skipped: { type: string[]; size: string[]; count: string[] };
}

/** Reads the files an upload takes and names them like the attachments they become. */
export async function planUpload(picked: PickedFile[], existing: string[]): Promise<UploadPlan> {
  const files: Record<string, Uint8Array> = {};
  const skipped: UploadPlan['skipped'] = { type: [], size: [], count: [] };
  for (const { path, file } of picked) {
    const parts = path.split('/');
    const name = parts[parts.length - 1];
    if (!ATTACHMENT_TYPES.includes(extensionOf(name))) skipped.type.push(path);
    else if (file.size > ATTACHMENT_LIMIT) skipped.size.push(path);
    else if (Object.keys(files).length >= MAX_UPLOAD) skipped.count.push(path);
    else {
      const data = new Uint8Array(await file.arrayBuffer());
      files[await attachmentName(name, data, parts.slice(0, -1))] = data;
    }
  }
  return { files, replaced: Object.keys(files).filter((name) => existing.includes(name)), skipped };
}
