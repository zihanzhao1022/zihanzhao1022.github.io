export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 1600;

// SVG is left out on purpose: served from this origin it could run scripts and read the login token.
const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** An image picked in a form but not committed yet. */
export interface PendingImage {
  pending: true;
  fileName: string;
  type: string;
  base64: string;
  previewUrl: string;
}

export const isPendingImage = (value: unknown): value is PendingImage =>
  typeof value === 'object' && value !== null && (value as PendingImage).pending === true;

export function validateImage(file: { type: string; size: number }): string | null {
  if (!EXTENSIONS[file.type]) return '只支持 PNG、JPG、WebP、GIF 格式的图片';
  if (file.size > MAX_IMAGE_BYTES) return '图片不能超过 5MB';
  return null;
}

/** The size to scale down to when the longest edge exceeds maxEdge, otherwise null. */
export function scaledSize(width: number, height: number, maxEdge = MAX_IMAGE_EDGE): { width: number; height: number } | null {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return null;
  const ratio = maxEdge / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** e.g. public/images/uploads/20261006-153012-hosei-logo.png (UTC). `index` keeps names unique within one save. */
export function uploadPath(fileName: string, type: string, now: Date, index = 0): string {
  const stamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  const slug =
    fileName
      .replace(/\.[^.]*$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'image';
  return `public/images/uploads/${stamp}-${slug}${index ? `-${index}` : ''}.${EXTENSIONS[type] ?? 'png'}`;
}

/** Converts a repository path under public/ into the URL the site serves it from. */
export const publicUrl = (repoPath: string): string => repoPath.replace(/^public/, '');

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** Shrinks large images in the browser (keeping their format) and reads them for upload. */
export async function prepareImage(file: File): Promise<PendingImage> {
  let blob: Blob = file;
  if (file.type !== 'image/gif') {
    const bitmap = await createImageBitmap(file);
    const size = scaledSize(bitmap.width, bitmap.height);
    if (size) {
      const canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, size.width, size.height);
      blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('图片处理失败'))), file.type, 0.9),
      );
    }
    bitmap.close();
  }
  return {
    pending: true,
    fileName: file.name,
    type: file.type,
    base64: await toBase64(blob),
    previewUrl: URL.createObjectURL(blob),
  };
}
