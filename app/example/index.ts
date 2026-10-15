import { ResultPaper } from '../../types';
import compiled from './papers.json';

// The PDFs the example papers were compiled to, and their one attachment (a made-up chart).
const assets = import.meta.glob<string>('./*.pdf', { query: '?url', import: 'default', eager: true });

/**
 * The prototype's example papers, already compiled (all made up), with the files they need under the paths
 * the repository keeps them at.
 */
export async function examplePapers(): Promise<{ papers: ResultPaper[]; files: Map<string, Uint8Array> }> {
  const papers = structuredClone(compiled) as unknown as ResultPaper[];
  const wanted: [path: string, asset: string][] = [];
  for (const paper of papers) {
    for (const block of paper.blocks) if (block.output) wanted.push([block.output.pdf, block.output.pdf.split('/').pop()!]);
    for (const name of paper.files ?? []) wanted.push([`results/${paper.id}/files/${name}`, name.split('/').pop()!]);
  }
  const files = new Map<string, Uint8Array>();
  await Promise.all(
    wanted.map(async ([path, asset]) => {
      const url = assets[`./${asset}`];
      if (url) files.set(path, new Uint8Array(await (await fetch(url)).arrayBuffer()));
    }),
  );
  return { papers, files };
}
