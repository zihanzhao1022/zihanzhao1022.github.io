import { BlockSection, ResultBlock, SectionLevel } from '../types';
import { countersBefore } from './headings';

/** The levels LaTeX's article class numbers, as \setcounter{secnumdepth} counts them. */
const DEPTH: Record<SectionLevel, number> = { section: 1, subsection: 2, subsubsection: 3, paragraph: 4 };
const LEVELS: SectionLevel[] = ['section', 'subsection', 'subsubsection', 'paragraph'];
const COMMAND = /\\appendix(?![A-Za-z@])|\\(section|subsection|subsubsection|paragraph)(?![A-Za-z@])(\*?)\s*(?:\[[^\]]*\]\s*)?\{/g;

/** Without % comments (a % after an odd number of backslashes is a percent sign). */
const uncommented = (tex: string): string => tex.replace(/(^|[^\\])((?:\\\\)*)%.*$/gm, '$1$2');

/** Whether a block's source starts the appendix. */
export const hasAppendix = (block: ResultBlock): boolean =>
  block.kind === 'text' && /\\appendix(?![A-Za-z@])/.test(uncommented(block.source ?? ''));

/** The text of a brace group whose opening brace is just before `start`. */
function group(text: string, start: number): string {
  let depth = 1;
  for (let at = start; at < text.length; at += 1) {
    if (text[at] === '\\') at += 1;
    else if (text[at] === '{') depth += 1;
    else if (text[at] === '}' && --depth === 0) return text.slice(start, at);
  }
  return text.slice(start);
}

/** A heading's title as plain text: escapes undone, labels and citations dropped, other commands' text kept. */
export function plainTitle(tex: string): string {
  const kept: string[] = [];
  return tex
    .replace(/\\(?:label|cite[A-Za-z]*|footnote|thanks|index|ref|eqref)\*?\s*(?:\[[^\]]*\]\s*)*\{[^{}]*\}/g, '')
    .replace(/\\([&%_#${}])/g, (_, char: string) => `\u0000${kept.push(char) - 1}\u0000`)
    .replace(/\\(LaTeX|TeX)(?![A-Za-z])\s*/g, '$1')
    .replace(/\\\\|~/g, ' ')
    .replace(/---/g, '—')
    .replace(/--/g, '–')
    .replace(/\\[A-Za-z@]+\*?\s*/g, '')
    .replace(/\\./g, '')
    .replace(/[{}$]/g, '')
    .replace(/\u0000(\d+)\u0000/g, (_, index: string) => kept[Number(index)])
    .replace(/\s+/g, ' ')
    .trim();
}

const alph = (value: number): string => (value >= 1 && value <= 26 ? String.fromCharCode(64 + value) : String(value));

/**
 * The headings each text block typesets, by block ID, numbered as LaTeX numbers them: each block starts from
 * the counters the previous ones ended with, and sections are lettered after \appendix. Blocks need their
 * source, so this is for the owner's and collaborators' copies; visitors get the result (publicView).
 */
export function sectionsOf(blocks: ResultBlock[], preamble = ''): Record<string, BlockSection[]> {
  const depthSetting = /\\setcounter\s*\{secnumdepth\}\s*\{\s*(-?\d+)\s*\}/.exec(uncommented(preamble));
  const numbered = depthSetting ? Number(depthSetting[1]) : 3;
  const found: Record<string, BlockSection[]> = {};
  let appendix = false;
  blocks.forEach((block, index) => {
    if (block.kind !== 'text' || !block.source) return;
    const source = uncommented(block.source);
    const start = countersBefore(blocks, index);
    const counters = LEVELS.map((level) => start[level] ?? 0);
    const sections: BlockSection[] = [];
    for (const match of source.matchAll(COMMAND)) {
      const level = match[1] as SectionLevel | undefined;
      if (!level) {
        appendix = true;
        counters[0] = 0;
        counters[1] = 0;
        sections.push({ level: 'appendix', title: 'Appendix' });
        continue;
      }
      const title = plainTitle(group(source, (match.index ?? 0) + match[0].length));
      const depth = DEPTH[level];
      if (match[2] || depth > numbered) {
        sections.push({ level, title });
        continue;
      }
      // \refstepcounter: this level steps, the ones below it start over.
      counters[depth - 1] += 1;
      for (let below = depth; below < counters.length; below += 1) counters[below] = 0;
      const parts = counters.slice(0, depth).map((value, at) => (at === 0 && appendix ? alph(value) : String(value)));
      sections.push({ level, title, number: parts.join('.') });
    }
    if (sections.length > 0) found[block.id] = sections;
  });
  return found;
}
