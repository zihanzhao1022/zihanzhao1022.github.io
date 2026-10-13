import { describe, expect, it } from 'vitest';
import { fileTree, insertionFor } from './attachmentTree';

describe('fileTree', () => {
  it('puts the names into folders, folders first and both sorted by name', () => {
    const tree = fileTree(['references.bib', 'figs/b.pdf', 'acl.sty', 'figs/v2/c.png', 'figs/a10.pdf', 'figs/a9.pdf', 'appendix/proof.tex']);
    expect(tree.files).toEqual(['acl.sty', 'references.bib']);
    expect(tree.folders.map((folder) => folder.path)).toEqual(['appendix', 'figs']);
    const figs = tree.folders[1];
    expect(figs.files).toEqual(['figs/a9.pdf', 'figs/a10.pdf', 'figs/b.pdf']);
    expect(figs.folders).toEqual([{ name: 'v2', path: 'figs/v2', folders: [], files: ['figs/v2/c.png'] }]);
  });
});

describe('insertionFor', () => {
  it('uses pictures with \\includegraphics and .tex files with \\input, and nothing else', () => {
    expect(insertionFor('figs/plot.pdf')).toBe('\\includegraphics[width=\\linewidth]{figs/plot.pdf}\n');
    expect(insertionFor('photo.JPG')).toBe('\\includegraphics[width=\\linewidth]{photo.JPG}\n');
    expect(insertionFor('sections/method.tex')).toBe('\\input{sections/method.tex}\n');
    expect(insertionFor('acl.sty')).toBeNull();
    expect(insertionFor('references.bib')).toBeNull();
  });
});
