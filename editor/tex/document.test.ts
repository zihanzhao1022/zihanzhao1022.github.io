import { describe, expect, it } from 'vitest';
import { DEFAULT_PREAMBLE, buildBlockDocument, passOptionsLines, stripComments } from './document';

const TABLE = '\\begin{table}[t]\n\\centering\n\\begin{tabular}{lc}\nA & 1 \\\\\n\\end{tabular}\n\\caption{Demo}\n\\end{table}';
const FIGURE = '\\begin{figure}[t]\n\\centering\n\\rule{2cm}{1cm}\n\\caption{Demo}\n\\end{figure}';

describe('stripComments', () => {
  it('drops comments but keeps escaped percent signs', () => {
    expect(stripComments('a % note\n50\\% b % more\n% whole line')).toBe('a \n50\\% b \n');
  });

  it('strips a comment that follows an escaped backslash', () => {
    expect(stripComments(String.raw`A & 1 \\% note`)).toBe(String.raw`A & 1 \\`);
  });

  it('keeps a percent sign that follows an odd number of backslashes', () => {
    expect(stripComments(String.raw`50\\\% b % more`)).toBe(String.raw`50\\\% b `);
  });
});

describe('passOptionsLines', () => {
  it('passes the options of every package loaded with options', () => {
    expect(passOptionsLines('\\documentclass{article}\n\\usepackage[T1]{fontenc}\n\\usepackage{times}')).toEqual([
      '\\PassOptionsToPackage{T1}{fontenc}',
    ]);
  });

  it('merges repeated loads and package lists', () => {
    const preamble = '\\usepackage[dvipsnames]{xcolor}\n\\usepackage[table, dvipsnames]{xcolor}\n\\usepackage[utf8]{inputenc,demo}';
    expect(passOptionsLines(preamble)).toEqual([
      '\\PassOptionsToPackage{dvipsnames,table}{xcolor}',
      '\\PassOptionsToPackage{utf8}{inputenc}',
      '\\PassOptionsToPackage{utf8}{demo}',
    ]);
  });

  it('ignores commented-out packages', () => {
    expect(passOptionsLines('% \\usepackage[review]{acl}\n\\usepackage[final]{acl} % [draft]{x}')).toEqual([
      '\\PassOptionsToPackage{final}{acl}',
    ]);
  });

  it('splits options only on commas outside braces', () => {
    const preamble = '\\usepackage[a={x,y}]{p}\n\\usepackage[b={x,y}]{p}';
    expect(passOptionsLines(preamble)).toEqual(['\\PassOptionsToPackage{a={x,y},b={x,y}}{p}']);
  });

  it('puts an option that spans lines on one line and still dedupes it', () => {
    const preamble = '\\usepackage[pdftitle={Long\n  Title}]{hyperref}\n\\usepackage[pdftitle={Long Title}]{hyperref}';
    expect(passOptionsLines(preamble)).toEqual(['\\PassOptionsToPackage{pdftitle={Long Title}}{hyperref}']);
  });
});

describe('buildBlockDocument', () => {
  it('puts the options first, then the preamble, then the block in a cropped minipage', () => {
    const doc = buildBlockDocument({ preamble: DEFAULT_PREAMBLE, source: TABLE, kind: 'table' });
    const lines = doc.main.split('\n');
    expect(lines[0]).toBe('\\PassOptionsToPackage{T1}{fontenc}');
    expect(lines[doc.preambleStartLine - 1]).toBe('\\documentclass{article}');
    expect(doc.preambleLineCount).toBe(DEFAULT_PREAMBLE.split('\n').length);
    expect(lines[doc.sourceStartLine - 1]).toBe('\\begin{table}[t]');
    expect(doc.sourceLineCount).toBe(7);
    expect(lines[doc.sourceStartLine - 2]).toBe('\\begin{preview}\\begin{minipage}{\\columnwidth}');
    expect(lines[doc.sourceStartLine - 1 + doc.sourceLineCount]).toBe('\\end{minipage}\\end{preview}');
    expect(doc.main).toContain('\\usepackage[active,tightpage]{preview}');
    expect(doc.main).toContain('\\renewenvironment{table*}[1][]{\\results@float{table}}{\\endresults@float}');
    expect(doc.main.trimEnd().endsWith('\\end{document}')).toBe(true);
  });

  it('uses the text width for starred floats', () => {
    const doc = buildBlockDocument({ preamble: DEFAULT_PREAMBLE, source: TABLE.replace(/table\}/g, 'table*}'), kind: 'table' });
    expect(doc.main).toContain('\\begin{preview}\\begin{minipage}{\\textwidth}');
  });

  it('uses the text width for a starred figure', () => {
    const doc = buildBlockDocument({ preamble: DEFAULT_PREAMBLE, source: FIGURE.replace(/figure\}/g, 'figure*}'), kind: 'figure' });
    expect(doc.main).toContain('\\begin{preview}\\begin{minipage}{\\textwidth}');
  });

  it('ignores a commented-out starred float when choosing the width', () => {
    const doc = buildBlockDocument({ preamble: DEFAULT_PREAMBLE, source: `% \\begin{table*}\n${TABLE}`, kind: 'table' });
    expect(doc.main).toContain('\\begin{preview}\\begin{minipage}{\\columnwidth}');
    expect(doc.main).not.toContain('\\begin{minipage}{\\textwidth}');
  });

  it('uses the column width and no paragraph restore for a figure', () => {
    const doc = buildBlockDocument({ preamble: DEFAULT_PREAMBLE, source: FIGURE, kind: 'figure' });
    const lines = doc.main.split('\n');
    expect(lines[doc.sourceStartLine - 2]).toBe('\\begin{preview}\\begin{minipage}{\\columnwidth}');
  });

  it('adds a document class when the preamble has none', () => {
    const doc = buildBlockDocument({ preamble: '\\usepackage{booktabs}', source: 'Hi', kind: 'text' });
    const lines = doc.main.split('\n');
    expect(lines[doc.preambleStartLine - 2]).toBe('\\documentclass{article}');
    expect(lines[doc.preambleStartLine - 1]).toBe('\\usepackage{booktabs}');
  });

  it('keeps the preamble start line right when a package option spans lines', () => {
    const preamble = '\\documentclass{article}\n\\usepackage[pdftitle={Long\n  Title},colorlinks]{hyperref}';
    const doc = buildBlockDocument({ preamble, source: 'Hi', kind: 'text' });
    const lines = doc.main.split('\n');
    expect(lines[0]).toBe('\\PassOptionsToPackage{pdftitle={Long Title},colorlinks}{hyperref}');
    expect(doc.preambleStartLine).toBe(2);
    expect(lines[doc.preambleStartLine - 1]).toBe('\\documentclass{article}');
  });

  it('restores counters, skipping page and list counters and odd names', () => {
    const doc = buildBlockDocument({
      preamble: DEFAULT_PREAMBLE,
      source: 'Hi',
      kind: 'text',
      counters: { table: 2, equation: 5, page: 3, enumi: 1, 'bad}name': 4 },
    });
    expect(doc.main).toContain('\\@ifundefined{c@table}{}{\\setcounter{table}{2}}');
    expect(doc.main).toContain('\\@ifundefined{c@equation}{}{\\setcounter{equation}{5}}');
    expect(doc.main).not.toContain('{c@page}');
    expect(doc.main).not.toContain('{c@enumi}');
    expect(doc.main).not.toContain('bad}name');
  });

  it('restores counters whose names contain digits', () => {
    const doc = buildBlockDocument({
      preamble: DEFAULT_PREAMBLE,
      source: 'Hi',
      kind: 'text',
      counters: { theorem2: 3, 'Hy@linkcounter1': 4, footnote: -1, 'bad-name2': 5 },
    });
    expect(doc.main).toContain('\\@ifundefined{c@theorem2}{}{\\setcounter{theorem2}{3}}');
    expect(doc.main).toContain('\\@ifundefined{c@Hy@linkcounter1}{}{\\setcounter{Hy@linkcounter1}{4}}');
    expect(doc.main).toContain('\\@ifundefined{c@footnote}{}{\\setcounter{footnote}{-1}}');
    expect(doc.main).not.toContain('bad-name2');
  });

  it('truncates a non-integer counter value', () => {
    const doc = buildBlockDocument({ preamble: DEFAULT_PREAMBLE, source: 'Hi', kind: 'text', counters: { table: 2.7 } });
    expect(doc.main).toContain('\\@ifundefined{c@table}{}{\\setcounter{table}{2}}');
    expect(doc.main).not.toContain('2.7');
  });

  it('restores paragraph settings only for text blocks', () => {
    const text = buildBlockDocument({ preamble: DEFAULT_PREAMBLE, source: 'Hi', kind: 'text' });
    const table = buildBlockDocument({ preamble: DEFAULT_PREAMBLE, source: TABLE, kind: 'table' });
    expect(text.main).toContain('\\begin{minipage}{\\columnwidth}\\csname results@restorepar\\endcsname');
    expect(table.main).not.toContain('\\csname results@restorepar');
  });

  it.each(['text', 'figure', 'table'] as const)('never reads an @ macro name after \\makeatother in a %s block', (kind) => {
    const source = { text: 'Hi', figure: FIGURE, table: TABLE }[kind];
    const { main } = buildBlockDocument({ preamble: DEFAULT_PREAMBLE, source, kind });
    // Once @ is no longer a letter, `\results@restorepar` would read as `\results` plus the text `@restorepar`.
    // Inside \csname ... \endcsname @ is just a character of the name, so that is the one place it may appear.
    const afterMakeatother = main.slice(main.lastIndexOf('\\makeatother')).replace(/\\csname [^\\]*\\endcsname/g, '');
    expect(afterMakeatother).not.toContain('@');
  });

  it('writes the labels of other blocks to the aux file', () => {
    const doc = buildBlockDocument({
      preamble: DEFAULT_PREAMBLE,
      source: 'See Table~\\ref{tab:a}.',
      kind: 'text',
      labels: { 'tab:a': '{1}{1}', 'eq:b': '{2}{1}{}{equation.0.2}{}' },
    });
    expect(doc.aux.split('\n')).toEqual([
      '\\relax',
      '\\providecommand\\hyper@newdestlabel[2]{}',
      '\\newlabel{tab:a}{{1}{1}}',
      '\\newlabel{eq:b}{{2}{1}{}{equation.0.2}{}}',
      '',
    ]);
  });
});
