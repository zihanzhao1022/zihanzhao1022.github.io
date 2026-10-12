import { ResultBlock } from '../../types';

/** A one-line \definecolor, \providecolor or \colorlet: the color's name and the command as written. */
export interface ColorDefinition {
  name: string;
  text: string;
  start: number;
  end: number;
}

// Each on one line, as tables copied from a paper write them; anything spread over lines is left alone.
const DEFINE = /\\(?:definecolor|providecolor)[ \t]*(?:\[[^\]\n]*\][ \t]*)?\{[ \t]*([^{}\s]+)[ \t]*\}[ \t]*\{[^{}\n]*\}[ \t]*\{[^{}\n]*\}/g;
const COLORLET = /\\colorlet[ \t]*(?:\[[^\]\n]*\][ \t]*)?\{[ \t]*([^{}\s]+)[ \t]*\}[ \t]*(?:\[[^\]\n]*\][ \t]*)?\{[^{}\n]*\}/g;

/** Whether `at` is inside a comment: an unescaped % earlier on its line. */
function commented(source: string, at: number): boolean {
  const line = source.slice(source.lastIndexOf('\n', at - 1) + 1, at);
  return /(^|[^\\])(\\\\)*%/.test(line);
}

/** The color definitions of some LaTeX, in order, leaving out commented ones. */
export function colorDefinitions(source: string): ColorDefinition[] {
  const found = [DEFINE, COLORLET].flatMap((pattern) =>
    [...source.matchAll(pattern)]
      .filter((match) => !commented(source, match.index ?? 0))
      .map((match) => ({ name: match[1], text: match[0], start: match.index ?? 0, end: (match.index ?? 0) + match[0].length })),
  );
  return found.sort((a, b) => a.start - b.start);
}

const form = (text: string): string => text.replace(/\s+/g, '');

/** The colors a \colorlet mixes, e.g. "heatred" and "white" in \colorlet{x}{heatred!40!white}. */
function mixed(text: string): string[] {
  if (!text.startsWith('\\colorlet')) return [];
  const expression = text.slice(text.lastIndexOf('{') + 1, -1);
  return expression.split(/[!:,\s>+-]+/).filter((part) => /^[A-Za-z][A-Za-z0-9.]*$/.test(part));
}

export interface SharedColor {
  name: string;
  /** The definition as the blocks write it. */
  text: string;
  /** The preamble already defines it the same way, so the blocks' copies can go. */
  inPreamble: boolean;
}

/**
 * Colors the paper's blocks define again and again, which the preamble could define once: those defined
 * the same way in two or more blocks, or in any block the same way as the preamble already does. A color
 * defined differently somewhere, or a \colorlet mixing a color that stays in some block, is left out.
 * `blocks` are the blocks that define any of them.
 */
export function sharedColors(blocks: ResultBlock[], preamble: string): { colors: SharedColor[]; blocks: string[] } {
  const inPreamble = new Map(colorDefinitions(preamble).map((definition) => [definition.name, form(definition.text)]));
  const found = new Map<string, { forms: Set<string>; text: string; blocks: Set<string> }>();
  for (const block of blocks) {
    if (!block.source) continue;
    for (const definition of colorDefinitions(block.source)) {
      const entry = found.get(definition.name) ?? { forms: new Set<string>(), text: definition.text, blocks: new Set<string>() };
      entry.forms.add(form(definition.text));
      entry.blocks.add(block.id);
      found.set(definition.name, entry);
    }
  }
  const movable = new Set<string>();
  for (const [name, entry] of found) {
    if (entry.forms.size !== 1) continue;
    const defined = inPreamble.get(name);
    if (defined !== undefined ? defined === [...entry.forms][0] : entry.blocks.size > 1) movable.add(name);
  }
  // A \colorlet mixing a color that some block keeps defining for itself has to stay with it.
  for (let dropped = true; dropped; ) {
    dropped = false;
    for (const name of movable) {
      if (mixed(found.get(name)!.text).some((color) => found.has(color) && !movable.has(color) && !inPreamble.has(color))) {
        movable.delete(name);
        dropped = true;
      }
    }
  }
  // First-appearance order keeps a \colorlet after the colors it mixes.
  const colors = [...found.keys()]
    .filter((name) => movable.has(name))
    .map((name) => ({ name, text: found.get(name)!.text, inPreamble: inPreamble.has(name) }));
  const ids = blocks
    .filter((block) => block.source && colorDefinitions(block.source).some((definition) => movable.has(definition.name)))
    .map((block) => block.id);
  return { colors, blocks: ids };
}

/** The source without the definitions of these colors; a line that held nothing else goes too. */
export function withoutColors(source: string, names: ReadonlySet<string>): string {
  const doomed = colorDefinitions(source).filter((definition) => names.has(definition.name));
  if (doomed.length === 0) return source;
  const kept: string[] = [];
  let offset = 0;
  for (const line of source.split('\n')) {
    const start = offset;
    const end = offset + line.length;
    offset = end + 1;
    const here = doomed.filter((definition) => definition.start >= start && definition.end <= end);
    if (here.length === 0) {
      kept.push(line);
      continue;
    }
    let rest = '';
    let at = start;
    for (const definition of here) {
      rest += source.slice(at, definition.start);
      at = definition.end;
    }
    rest += source.slice(at, end);
    if (!/^\s*%?\s*$/.test(rest)) kept.push(rest);
  }
  return kept.join('\n');
}
