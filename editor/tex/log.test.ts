import { describe, expect, it } from 'vitest';
import { locateLine, parseAuxCitations, parseAuxLabels, parseCounters, parseErrors, parseWarnings, unwrapLog } from './log';

const LOG = [
  '(/tex/booktabs.sty)',
  '! Undefined control sequence.',
  'l.42 Baseline & \\foo',
  '                     {1.0} \\\\',
  'LaTeX Warning: Reference `tab:x\' on page 1 undefined on input line 44.',
  '! LaTeX Error: File `missing.sty\' not found.',
  '',
  'Type X to quit or <RETURN> to proceed,',
  'l.7 \\usepackage',
  '               {missing}^^M',
  '!  ==> Fatal error occurred, no output PDF file produced!',
  'Package hyperref Warning: Token not allowed in a PDF string',
  'RESULTS-COUNTER:section=2',
  'RESULTS-COUNTER:table=3',
  'RESULTS-COUNTER:c@weird=x',
].join('\n');

// The logs below have the shape of this engine's output: main.tex opens by its bare name, TeX Live files live
// under /tex/, the owner's attachments are opened by their plain name, and TeX wraps lines at 79 characters.
const lines = (...parts: Array<string | string[]>): string => parts.flat().join('\n');

const HEAD = [
  '**main.tex',
  '(main.tex',
  'LaTeX2e <2020-02-02> patch level 5',
  '(/tex/article.cls',
  'Document Class: article 2019/12/20 v1.4l Standard LaTeX document class',
  '(/tex/size10.clo',
  'File: size10.clo 2019/12/20 v1.4l Standard LaTeX file (size option)',
  ')',
  '\\bibindent=\\dimen134',
];

const UNDEFINED_HELP = [
  'The control sequence at the end of the top line',
  "of your error message was never \\def'ed. If you have",
  "misspelled it (e.g., `\\hobx'), type `I' and the correct",
  "spelling (e.g., `I\\hbox'). Otherwise just continue,",
  "and I'll forget about whatever was undefined.",
  '',
];

// The error TeX prints when \hello, defined in acl.sty, uses an undefined macro. `source` is the source line TeX
// echoes up to the error (acl.sty's line `line`), `rest` the line TeX prints under it.
const aclError = (line: number, source: string, rest: string): string[] => [
  '! Undefined control sequence.',
  '\\hello ->\\undefinedmacroinsty ',
  '                              ',
  `l.${line} ${source}`,
  rest,
  ...UNDEFINED_HELP,
];

// acl.sty fails on its line 4, then main.tex fails on its line 26 once every package is closed again.
const ATTACHMENT_LOG = lines(
  HEAD,
  ') (acl.sty',
  'Package: acl 2020/01/01 v1.0 (Made-up conference style)',
  '',
  aclError(4, '\\hello', '          '),
  ') (/tex/booktabs.sty',
  'Package: booktabs 2020/01/12 v1.61803398 Publication quality tables',
  '\\heavyrulewidth=\\dimen135',
  ')',
  '(main.aux)',
  "\\openout1 = `main.aux'.",
  '',
  'Preview: PDFoutput 1',
  '! Undefined control sequence.',
  'l.26 \\foo',
  '          bar',
  UNDEFINED_HELP,
  '[1{/tex/pdftex.map}]',
  'RESULTS-COUNTER:page=1',
  '(main.aux)',
  ' ) ',
  "Here is how much of TeX's memory you used:",
  ' 696 strings out of 467525',
  '</tex/cmr10.pfb>',
  '',
  'Output written on main.pdf (1 page, 12819 bytes).',
);

// TeX broke this message after 79 characters, in the middle of "setting".
const WRAPPED_ERROR = ["! Package pdftex.def Error: File `no-such-image.png' not found: using draft set", 'ting.'];

const MISSING_IMAGE_LOG = lines(
  HEAD,
  ')',
  'Preview: PDFoutput 1',
  '',
  "LaTeX Warning: File `no-such-image.png' not found on input line 27.",
  '',
  '',
  WRAPPED_ERROR,
  '',
  'See the pdftex.def package documentation for explanation.',
  'Type  H <return>  for immediate help.',
  ' ...                                              ',
  '                                                  ',
  'l.27 \\includegraphics{no-such-image.png}',
  '                                        ',
  'Try typing  <return>  to proceed.',
  "If that doesn't work, type  X <return>  to quit.",
  '',
);

// nonstopmode: TeX cannot ask for another file name, so it gives up right after reporting the missing file.
const MISSING_PACKAGE_LOG = lines(
  HEAD,
  ')',
  "! LaTeX Error: File `nosuchpackage.sty' not found.",
  '',
  'Type X to quit or <RETURN> to proceed,',
  'or enter new name. (Default extension: sty)',
  '',
  'Enter file name: ',
  '! Emergency stop.',
  '<read *> ',
  '         ',
  'l.4 \\usepackage',
  '               {booktabs}^^M',
  '*** (cannot \\read from terminal in nonstop modes)',
  '',
  ' ',
  "Here is how much of TeX's memory you used:",
  ' 943 strings out of 467525',
  '!  ==> Fatal error occurred, no output PDF file produced!',
);

describe('parseAuxCitations', () => {
  it('reads natbib and plain \\bibcite entries', () => {
    const aux = '\\relax\n\\citation{a}\n\\bibcite{a}{{1}{2024}{{Doe and Roe}}{{Doe and Roe}}}\n\\bibcite{b}{2}\n';
    expect(parseAuxCitations(aux)).toEqual({ a: '{1}{2024}{{Doe and Roe}}{{Doe and Roe}}', b: '2' });
  });
});

describe('unwrapLog', () => {
  const full = 'x'.repeat(79);

  it('joins a line of exactly 79 characters with the line TeX wrapped onto', () => {
    expect(unwrapLog(`${full}\nrest\nnext`)).toBe(`${full}rest\nnext`);
  });

  it('keeps joining while every piece fills the whole width', () => {
    expect(unwrapLog(`${full}\n${full}\nend\nnext`)).toBe(`${full}${full}end\nnext`);
  });

  it('leaves lines of any other length alone', () => {
    const log = `${'x'.repeat(78)}\nnext\n${'x'.repeat(80)}\nlast`;
    expect(unwrapLog(log)).toBe(log);
  });

  it.each([
    ['an empty line', ''],
    ['an error', '! Undefined control sequence.'],
    ['a source line', 'l.12 \\foo'],
    ['a counter', 'RESULTS-COUNTER:table=3'],
  ])('starts a new line for %s after a full line', (_name, next) => {
    expect(unwrapLog(`${full}\n${next}`)).toBe(`${full}\n${next}`);
  });

  it('keeps a full line that ends the log', () => {
    expect(unwrapLog(full)).toBe(full);
    expect(unwrapLog(`${full}\n`)).toBe(`${full}\n`);
  });

  it('returns an empty log as it is', () => {
    expect(unwrapLog('')).toBe('');
  });
});

describe('parseErrors', () => {
  it('reads each error with its line number and skips the final fatal line', () => {
    expect(parseErrors(LOG)).toEqual([
      { message: 'Undefined control sequence.', line: 42 },
      { message: "LaTeX Error: File `missing.sty' not found.", line: 7 },
    ]);
  });

  it('leaves the line out when TeX did not print one', () => {
    expect(parseErrors('! Emergency stop.\n<*> main.tex')).toEqual([{ message: 'Emergency stop.' }]);
  });

  it('stops looking for the source line at the next error', () => {
    const log = lines('! First error, no context.', '! Second error.', 'l.9 \\foo');
    expect(parseErrors(log)).toEqual([{ message: 'First error, no context.' }, { message: 'Second error.', line: 9 }]);
  });

  it('looks for the source line in the 19 lines after the error', () => {
    const filler = (count: number) => Array.from({ length: count }, (_, i) => `context ${i + 1}`);
    expect(parseErrors(lines('! Far away.', filler(18), 'l.9 \\foo'))).toEqual([{ message: 'Far away.', line: 9 }]);
    expect(parseErrors(lines('! Far away.', filler(19), 'l.9 \\foo'))).toEqual([{ message: 'Far away.' }]);
  });

  it('joins an error message that TeX wrapped at 79 characters', () => {
    expect(WRAPPED_ERROR[0]).toHaveLength(79);
    expect(parseErrors(MISSING_IMAGE_LOG)).toEqual([
      { message: "Package pdftex.def Error: File `no-such-image.png' not found: using draft setting.", line: 27 },
    ]);
  });

  it('reports a missing package once: the Emergency stop after it only repeats that TeX gave up', () => {
    expect(parseErrors(MISSING_PACKAGE_LOG)).toEqual([{ message: "LaTeX Error: File `nosuchpackage.sty' not found." }]);
  });

  it('drops an Emergency stop that follows another error', () => {
    const log = lines('! Undefined control sequence.', 'l.5 \\foo', '', '! Emergency stop.', '<*> main.tex', '', '*** (job aborted)');
    expect(parseErrors(log)).toEqual([{ message: 'Undefined control sequence.', line: 5 }]);
  });

  describe('file', () => {
    it('names the attachment TeX was reading and gives that file its own line number', () => {
      const log = lines(
        '(main.tex (/tex/article.cls (/tex/size10.clo)) (acl.sty',
        '! Undefined control sequence.',
        '\\hello ->\\undefinedmacroinsty ',
        '                              ',
        'l.4 \\hello',
      );
      expect(parseErrors(log)).toEqual([{ message: 'Undefined control sequence.', line: 4, file: 'acl.sty' }]);
    });

    it('leaves the file out for an error in main.tex once the other files are closed', () => {
      expect(parseErrors(ATTACHMENT_LOG)).toEqual([
        { message: 'Undefined control sequence.', line: 4, file: 'acl.sty' },
        { message: 'Undefined control sequence.', line: 26 },
      ]);
    });

    it.each(['(acl.sty', '(./acl.sty', '(/tex/acl.sty', '(/usr/local/texlive/tex/latex/acl/acl.sty'])(
      'reads the base name of %s',
      (opening) => {
        const log = lines('(main.tex', opening, '! Undefined control sequence.', 'l.4 \\hello');
        expect(parseErrors(log)).toEqual([{ message: 'Undefined control sequence.', line: 4, file: 'acl.sty' }]);
      },
    );

    it.each('tex sty cls clo cfg def fd aux ldf dict mkii ltx bbl toc lof lot out nav snm vrb lbx bbx cbx dbx lua'.split(' '))(
      'recognizes a .%s file',
      (extension) => {
        const log = lines('(main.tex', `(/tex/demo.${extension}`, '! Undefined control sequence.', 'l.4 \\hello');
        expect(parseErrors(log)).toEqual([{ message: 'Undefined control sequence.', line: 4, file: `demo.${extension}` }]);
      },
    );

    it('names a TeX Live file by its base name', () => {
      const log = lines(
        HEAD,
        ') (/tex/xcolor.sty',
        'Package: xcolor 2016/05/11 v2.12 LaTeX color extensions (UK)',
        '',
        '(/tex/color.cfg)',
        '',
        "! LaTeX Error: Unknown option 'nosuchoption' for package xcolor.",
        '',
        'For immediate help type H <return>.',
        ' ...                                              ',
        '                                                  ',
        'l.265 \\ProcessKeyOptions\\relax',
        '                              ',
        '',
        "LaTeX has been asked to set an option called 'nosuchoption' but the package",
        '"xcolor" has not created an option with this name.',
        '',
      );
      expect(parseErrors(log)).toEqual([
        { message: "LaTeX Error: Unknown option 'nosuchoption' for package xcolor.", line: 265, file: 'xcolor.sty' },
      ]);
    });

    it('names main.aux when the error happened while TeX read it, and not later', () => {
      const log = lines(
        HEAD,
        ')',
        '(main.aux',
        '! Undefined control sequence.',
        'l.3 \\undefinedauxcommand',
        '                        ',
        UNDEFINED_HELP,
        ')',
        "\\openout1 = `main.aux'.",
        '',
        'Preview: PDFoutput 1',
        '! Undefined control sequence.',
        'l.26 \\foo',
        '          bar',
      );
      expect(parseErrors(log)).toEqual([
        { message: 'Undefined control sequence.', line: 3, file: 'main.aux' },
        { message: 'Undefined control sequence.', line: 26 },
      ]);
    });

    it('is not thrown off by the parentheses of an Overfull box message', () => {
      const log = lines(
        HEAD,
        ') (acl.sty',
        'Package: acl 2020/01/01 v1.0',
        ')',
        'Preview: PDFoutput 1',
        '',
        'Overfull \\hbox (264.0pt too wide) in paragraph at lines 23--31',
        '\\OT1/cmr/m/n/10 xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        ' []',
        '',
        '! Undefined control sequence.',
        'l.33 \\foo',
        '          bar',
      );
      expect(parseErrors(log)).toEqual([{ message: 'Undefined control sequence.', line: 33 }]);
    });

    it('keeps the attachment open across parentheses in the messages TeX prints while reading it', () => {
      const log = lines(
        HEAD,
        ') (acl.sty',
        'Package: acl 2020/01/01 v1.0 (Made-up conference style)',
        '',
        'Underfull \\hbox (badness 10000) in paragraph at lines 5--7',
        ' []',
        '',
        'LaTeX Font Info:    External font `cmex10\' loaded for size',
        '(Font)              <7> on input line 6.',
        aclError(8, '\\hello', '          '),
      );
      expect(parseErrors(log)).toEqual([{ message: 'Undefined control sequence.', line: 8, file: 'acl.sty' }]);
    });

    it('does not read the parentheses of the echoed source line, so an open one cannot leak', () => {
      const log = lines(
        HEAD,
        ') (acl.sty',
        'Package: acl 2020/01/01 v1.0',
        '',
        aclError(12, 'Results (a \\hello', '                       b'),
        ') (/tex/booktabs.sty)',
        'Preview: PDFoutput 1',
        '! Undefined control sequence.',
        'l.30 \\foo',
        '          bar',
      );
      expect(parseErrors(log)).toEqual([
        { message: 'Undefined control sequence.', line: 12, file: 'acl.sty' },
        { message: 'Undefined control sequence.', line: 30 },
      ]);
    });

    it('does not read the parentheses of the echoed source line, so a closing one cannot close the file', () => {
      const log = lines(
        HEAD,
        ') (acl.sty',
        'Package: acl 2020/01/01 v1.0',
        '',
        aclError(12, 'a) \\hello', '           b'),
        aclError(13, '\\hello', '          '),
        ')',
      );
      expect(parseErrors(log)).toEqual([
        { message: 'Undefined control sequence.', line: 12, file: 'acl.sty' },
        { message: 'Undefined control sequence.', line: 13, file: 'acl.sty' },
      ]);
    });

    it('does not read the parentheses in the rest of the echoed line either', () => {
      const log = lines(
        HEAD,
        ') (acl.sty',
        'Package: acl 2020/01/01 v1.0',
        '',
        aclError(12, '\\hello', '            b) (other.tex'),
        aclError(13, '\\hello', '          '),
        ')',
      );
      expect(parseErrors(log)).toEqual([
        { message: 'Undefined control sequence.', line: 12, file: 'acl.sty' },
        { message: 'Undefined control sequence.', line: 13, file: 'acl.sty' },
      ]);
    });

    it.each([
      ['a name in the middle of a parenthesized text', 'Some text (see acl.sty for details'],
      ['a measure', 'Overfull \\hbox (264.0pt too wide'],
      ['a name with a longer extension', 'Some text (acl.sty.bak'],
    ])('does not take %s for an opened file', (_name, text) => {
      const log = lines('(main.tex', text, '! Undefined control sequence.', 'l.4 \\hello');
      expect(parseErrors(log)).toEqual([{ message: 'Undefined control sequence.', line: 4 }]);
    });

    it('reads a file name that TeX wrapped in the middle', () => {
      const wrapped = [') (/tex/color.cfg) (/tex/graphics.cfg) (/tex/pdftex.def) (/tex/gettitlestring.s', 'ty'];
      expect(wrapped[0]).toHaveLength(79);
      const log = lines(
        HEAD,
        wrapped,
        'Package: gettitlestring 2016/05/16 v1.5 Cleanup title references (HO)',
        '',
        '! Undefined control sequence.',
        'l.6 \\GetTitleString',
      );
      expect(parseErrors(log)).toEqual([{ message: 'Undefined control sequence.', line: 6, file: 'gettitlestring.sty' }]);
    });

    it('copes with more closing than opening parentheses', () => {
      expect(parseErrors(lines('))) )', '! Undefined control sequence.', 'l.3 \\foo'))).toEqual([
        { message: 'Undefined control sequence.', line: 3 },
      ]);
    });
  });
});

describe('parseWarnings', () => {
  it('keeps the first line of LaTeX and package warnings', () => {
    expect(parseWarnings(LOG)).toEqual([
      "LaTeX Warning: Reference `tab:x' on page 1 undefined on input line 44.",
      'Package hyperref Warning: Token not allowed in a PDF string',
    ]);
  });

  it('also keeps font and class warnings, but no Overfull or Underfull lines', () => {
    const log = lines(
      "LaTeX Font Warning: Font shape `OT1/cmr/bx/sc' undefined",
      "(Font)              using `OT1/cmr/bx/n' instead on input line 12.",
      'Class article Warning: Demo class warning on input line 14.',
      'LaTeX Info: Redefining \\frac on input line 233.',
      'Underfull \\hbox (badness 10000) in paragraph at lines 5--7',
      'Overfull \\hbox (264.0pt too wide) in paragraph at lines 23--31',
    );
    expect(parseWarnings(log)).toEqual([
      "LaTeX Font Warning: Font shape `OT1/cmr/bx/sc' undefined",
      'Class article Warning: Demo class warning on input line 14.',
    ]);
  });

  it('joins a warning that TeX wrapped at 79 characters', () => {
    const wrapped = ["LaTeX Warning: Reference `tab:a-fairly-long-label-name-used-to-test-wrapping-of", "-log-lines' on page 1 undefined on input line 25."];
    expect(wrapped[0]).toHaveLength(79);
    const spaced = ['Package demo Warning: A demo package warning that is intentionally long so that', ' it wraps around on input line 26.'];
    expect(spaced[0]).toHaveLength(79);
    expect(parseWarnings(lines(wrapped, '', spaced, ''))).toEqual([
      "LaTeX Warning: Reference `tab:a-fairly-long-label-name-used-to-test-wrapping-of-log-lines' on page 1 undefined on input line 25.",
      'Package demo Warning: A demo package warning that is intentionally long so that it wraps around on input line 26.',
    ]);
  });
});

describe('parseCounters', () => {
  it('reads the counter dump', () => {
    expect(parseCounters(LOG)).toEqual({ section: 2, table: 3 });
  });

  it('reads counter names with digits and negative values', () => {
    const log = lines('RESULTS-COUNTER:theorem2=3', 'RESULTS-COUNTER:Hy@linkcounter1=0', 'RESULTS-COUNTER:footnote=-2', 'RESULTS-COUNTER:bad-name=5');
    expect(parseCounters(log)).toEqual({ theorem2: 3, 'Hy@linkcounter1': 0, footnote: -2 });
  });
});

describe('parseAuxLabels', () => {
  it('reads plain and hyperref labels with nested braces', () => {
    const aux = [
      '\\relax',
      '\\newlabel{tab:main}{{2}{1}}',
      '\\newlabel{eq:loss}{{3}{1}{}{equation.0.3}{}}',
      '\\@writefile{lot}{\\contentsline {table}{\\numberline {2}{\\ignorespaces Demo}}{1}}',
      '\\newlabel{sec:a}{{1}{1}{Intro {\\em first}}{section.1}{}}',
    ].join('\n');
    expect(parseAuxLabels(aux)).toEqual({
      'tab:main': '{2}{1}',
      'eq:loss': '{3}{1}{}{equation.0.3}{}',
      'sec:a': '{1}{1}{Intro {\\em first}}{section.1}{}',
    });
  });

  it('does not count escaped braces when it matches the groups', () => {
    const aux = ['\\newlabel{a}{{1}{\\{}}', '\\newlabel{b}{{2}{1}{Use \\{ and \\} here}{section.2}{}}', '\\newlabel{c}{{3}{\\\\{x}}}'].join('\n');
    expect(parseAuxLabels(aux)).toEqual({
      a: '{1}{\\{}',
      b: '{2}{1}{Use \\{ and \\} here}{section.2}{}',
      c: '{3}{\\\\{x}}',
    });
  });

  it('skips a label whose value never closes and still reads the ones after it', () => {
    const aux = ['\\newlabel{a}{{1}{1}}', '\\newlabel{broken}{{2}{1}', '\\newlabel{c}{{3}{1}}'].join('\n');
    expect(parseAuxLabels(aux)).toEqual({ a: '{1}{1}', c: '{3}{1}' });
  });

  it('skips a label cut off at the end of the file', () => {
    expect(parseAuxLabels('\\newlabel{a}{{1}{1}}\n\\newlabel{b}{{2}{')).toEqual({ a: '{1}{1}' });
    expect(parseAuxLabels('\\newlabel{a}{{1}{1}}\n\\newlabel{b}')).toEqual({ a: '{1}{1}' });
    expect(parseAuxLabels('\\newlabel{a}{{1}{1}}\n\\newlabel{b')).toEqual({ a: '{1}{1}' });
    expect(parseAuxLabels('\\newlabel{')).toEqual({});
  });

  it('skips an unclosed \\newlabel{ in the middle of the file without losing the next label', () => {
    const aux = ['\\newlabel{a}{{1}{1}}', '\\newlabel{b', '\\newlabel{c}{{3}{1}}'].join('\n');
    expect(parseAuxLabels(aux)).toEqual({ a: '{1}{1}', c: '{3}{1}' });
  });
});

describe('locateLine', () => {
  const doc = { preambleStartLine: 3, preambleLineCount: 5, sourceStartLine: 30, sourceLineCount: 10 };

  it('maps main.tex lines to the block or the preamble', () => {
    expect(locateLine(30, doc)).toEqual({ area: 'source', line: 1 });
    expect(locateLine(39, doc)).toEqual({ area: 'source', line: 10 });
    expect(locateLine(3, doc)).toEqual({ area: 'preamble', line: 1 });
    expect(locateLine(7, doc)).toEqual({ area: 'preamble', line: 5 });
    expect(locateLine(8, doc)).toEqual({ area: 'wrapper', line: 8 });
    expect(locateLine(40, doc)).toEqual({ area: 'wrapper', line: 40 });
  });
});
