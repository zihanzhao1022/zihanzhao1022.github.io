// Images uploaded in this tab are shown from local previews until the deployment containing them is live.
const previews = new Map<string, string>();

export function registerLocalImage(url: string, previewUrl: string): void {
  previews.set(url, previewUrl);
}

export function resolveImage(url: string): string;
export function resolveImage(url: string | undefined): string | undefined;
export function resolveImage(url: string | undefined): string | undefined {
  return url ? (previews.get(url) ?? url) : url;
}
