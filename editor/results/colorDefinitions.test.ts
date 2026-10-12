import { describe, expect, it } from 'vitest';
import { ResultBlock } from '../../types';
import { colorDefinitions, sharedColors, withoutColors } from './colorDefinitions';

const table = (id: string, source: string): ResultBlock => ({ id, kind: 'table', source });
const A = '\\definecolor{madeA}{RGB}{10,20,30}';
const B = '\\definecolor{madeB}{HTML}{ABCDEF}';
const body = '\\begin{tabular}{l}\\cellcolor{madeA!40!white} x \\\\\\end{tabular}';

describe('colorDefinitions', () => {
  it('finds one-line definitions outside comments', () => {
    const source = `${A}\n% ${B}\n  \\colorlet{madeC}{madeA!50!white} % note\n\\definecolor{madeD}\n{RGB}{1,2,3}`;
    expect(colorDefinitions(source).map((definition) => definition.name)).toEqual(['madeA', 'madeC']);
  });
});

describe('sharedColors', () => {
  it('offers the colors several blocks define the same way, in the order they first appear', () => {
    const blocks = [table('t1', `\\begin{table}\n${A}\n${B}\n${body}\n\\end{table}`), table('t2', `${B}\n${A}\n${body}`), table('t3', body)];
    const shared = sharedColors(blocks, '\\usepackage{xcolor}');
    expect(shared.colors).toEqual([
      { name: 'madeA', text: A, inPreamble: false },
      { name: 'madeB', text: B, inPreamble: false },
    ]);
    expect(shared.blocks).toEqual(['t1', 't2']);
  });

  it('leaves colors that are defined differently, or only once, where they are', () => {
    const blocks = [
      table('t1', `${A}\n\\definecolor{madeB}{RGB}{1,1,1}`),
      table('t2', `${A}\n${B}`),
      table('t3', '\\definecolor{madeE}{RGB}{9,9,9}'),
    ];
    expect(sharedColors(blocks, '').colors.map((color) => color.name)).toEqual(['madeA']);
  });

  it('removes a copy of what the preamble already defines, but never overrides the preamble', () => {
    const blocks = [table('t1', A), table('t2', '\\definecolor{madeB}{RGB}{1,1,1}')];
    const shared = sharedColors(blocks, `\\usepackage{xcolor}\n\\definecolor{madeA}{RGB}{10, 20, 30}\n${B}`);
    expect(shared.colors).toEqual([{ name: 'madeA', text: A, inPreamble: true }]);
    expect(shared.blocks).toEqual(['t1']);
  });

  it('keeps a \\colorlet with a color that stays in a block', () => {
    const mix = '\\colorlet{madeC}{madeE!30!white}';
    const blocks = [
      table('t1', `\\definecolor{madeE}{RGB}{1,1,1}\n${mix}`),
      table('t2', `\\definecolor{madeE}{RGB}{2,2,2}\n${mix}`),
    ];
    expect(sharedColors(blocks, '').colors).toEqual([]);
  });
});

describe('withoutColors', () => {
  it('drops the definitions and lines left empty, keeping everything else', () => {
    const source = `\\begin{table}\n  ${A}\n${B} % keep this note\n\\centering ${A}\n${body}\n\\end{table}`;
    expect(withoutColors(source, new Set(['madeA']))).toBe(`\\begin{table}\n${B} % keep this note\n\\centering \n${body}\n\\end{table}`);
    expect(withoutColors(source, new Set(['nothing']))).toBe(source);
  });
});
