import { describe, expect, it } from 'vitest';
import { locateLine, parseAuxLabels, parseCounters, parseErrors, parseWarnings } from './log';

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
});

describe('parseWarnings', () => {
  it('keeps the first line of LaTeX and package warnings', () => {
    expect(parseWarnings(LOG)).toEqual([
      "LaTeX Warning: Reference `tab:x' on page 1 undefined on input line 44.",
      'Package hyperref Warning: Token not allowed in a PDF string',
    ]);
  });
});

describe('parseCounters', () => {
  it('reads the counter dump', () => {
    expect(parseCounters(LOG)).toEqual({ section: 2, table: 3 });
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
