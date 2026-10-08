import { describe, expect, it } from 'vitest';
import { ResultPaper } from '../../types';
import { addBibEntries, bibKeysOf, bibliographyStyle, parseBibEntries } from './bibtex';

// Made-up entries in the shapes Google Scholar and DBLP copy.
const scholar = `@article{doe2024made,
  title={A {Made-Up} Paper},
  author={Doe, Jane and Roe, Rick},
  journal={Journal of Examples},
  year={2024}
}`;
const dblp = `@inproceedings{DBLP:conf/example/Roe23,
  author    = {Rick Roe},
  title     = {Another "Quoted" Title},
  booktitle = {Example Conference},
  year      = {2023}
}`;

describe('parseBibEntries', () => {
  it('finds each citable entry with its key and text', () => {
    const entries = parseBibEntries(`@string{conf = "Conf"}\n${scholar}\n\n${dblp}\n@comment{ignored}`);
    expect(entries.map((entry) => entry.key)).toEqual(['doe2024made', 'DBLP:conf/example/Roe23']);
    expect(entries[0].text).toBe(scholar);
    expect(parseBibEntries('@misc(paren, title = {x})')[0].key).toBe('paren');
    expect(parseBibEntries('no entries here')).toEqual([]);
    expect(parseBibEntries('@article{broken, title={never closed')).toEqual([]);
  });
});

describe('addBibEntries', () => {
  it('appends new entries and keeps ones the file already has', () => {
    const first = addBibEntries('', scholar);
    expect(first).toEqual({ text: `${scholar}\n`, added: ['doe2024made'], skipped: [] });
    const second = addBibEntries(first.text, `${scholar}\n${dblp}`);
    expect(second.added).toEqual(['DBLP:conf/example/Roe23']);
    expect(second.skipped).toEqual(['doe2024made']);
    expect(bibKeysOf(second.text)).toEqual(new Set(['doe2024made', 'DBLP:conf/example/Roe23']));
    expect(addBibEntries(second.text, scholar).text).toBe(second.text);
  });
});

describe('bibliographyStyle', () => {
  const paper = (preamble: string, files: string[] = []): ResultPaper => ({ id: 'p', slug: 'p', title: 't', authors: [], preamble, files, blocks: [] });

  it('uses an uploaded .bst, author-year with natbib, numbers otherwise', () => {
    expect(bibliographyStyle(paper('\\usepackage{natbib}', ['acl_natbib.bst']))).toBe('acl_natbib');
    expect(bibliographyStyle(paper('\\documentclass{article}\n\\usepackage[review]{acl}'))).toBe('plainnat');
    expect(bibliographyStyle(paper('\\usepackage{iclr2025_conference,times}'))).toBe('plainnat');
    expect(bibliographyStyle(paper('\\usepackage[numbers]{natbib}'))).toBe('plainnat');
    expect(bibliographyStyle(paper('\\documentclass{article}\n% \\usepackage{natbib}'))).toBe('unsrt');
  });
});
