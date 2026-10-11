import { ResultBlock, ResultHeading } from '../types';

/** The label a numbered heading's compile reads its number and anchor from; never shared with other blocks. */
export const HEADING_LABEL = 'results-heading';

/** Top-level brace groups of a \newlabel value: `{2.1}{3}{Method}{subsection.2.1}{}` gives 2.1, 3, Method, subsection.2.1 and ''. */
export function labelGroups(value: string): string[] {
  const groups: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === '\\') {
      index += 1;
    } else if (char === '{') {
      if (depth === 0) start = index + 1;
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth < 0) break;
      if (depth === 0) groups.push(value.slice(start, index));
    }
  }
  return groups;
}

/** A number as LaTeX wrote it into the aux file, without formatting commands: `\textbf {2}` gives 2. */
const plainNumber = (text: string): string => text.replace(/\\[A-Za-z@]+\s*/g, '').replace(/[{}]/g, '').trim();

/** The heading as LaTeX. With `numbering`, it also writes the label the page reads the number from. */
export function headingTex(heading: ResultHeading, { numbering = false }: { numbering?: boolean } = {}): string {
  const labels = heading.starred ? '' : `${heading.label ? `\\label{${heading.label}}` : ''}${numbering ? `\\label{${HEADING_LABEL}}` : ''}`;
  const command = `\\${heading.level}${heading.starred ? '*' : ''}{${heading.title}}${labels}`;
  return heading.appendix && heading.level === 'section' ? `\\appendix\n${command}` : command;
}

/** The number and anchor a heading's compile wrote, and its other labels (without the internal one). */
export function readHeadingNumber(labels: Record<string, string>): { number?: string; anchor?: string; labels: Record<string, string> } {
  const { [HEADING_LABEL]: own, ...rest } = labels;
  const groups = own === undefined ? [] : labelGroups(own);
  // A heading LaTeX does not number leaves the label with the empty start of the document.
  const number = plainNumber(groups[0] ?? '');
  if (!number) return { labels: rest };
  return { number, ...(groups[3] ? { anchor: groups[3] } : {}), labels: rest };
}

/** A heading's title for the page: the usual escapes undone, other LaTeX left as typed. */
export const headingText = (title: string): string => title.replace(/\\([&%_#${}])/g, '$1').replace(/~/g, ' ');

/** Identifies a heading's fields, so a numbering is kept only for the heading it was compiled from. */
export const headingKey = (heading: ResultHeading | undefined): string =>
  JSON.stringify(heading ? [heading.level, heading.starred === true, heading.title, heading.label ?? '', heading.appendix === true] : null);

/** Whether this block is the heading the appendix starts at. */
export const startsAppendix = (block: ResultBlock): boolean =>
  block.kind === 'heading' && block.heading?.appendix === true && block.heading.level === 'section';

/** The counters where the page left off before block `index`: those of the nearest earlier block or heading with any. */
export function countersBefore(blocks: ResultBlock[], index: number): Record<string, number> {
  for (let previous = index - 1; previous >= 0; previous -= 1) {
    const found = blocks[previous].output?.counters ?? blocks[previous].numbering?.counters;
    if (found) return found;
  }
  return {};
}

/** The figure or table number a block shows, e.g. "3", "2.1" or "3–4"; absent for other blocks or without one. */
export function blockNumber(blocks: ResultBlock[], index: number): string | undefined {
  const block = blocks[index];
  const output = block.output;
  if ((block.kind !== 'figure' && block.kind !== 'table') || !output) return undefined;
  if (output.number) return output.number;
  // Labels give the number as LaTeX prints it; hyperref names the anchor after the counter.
  const labelled = Object.values(output.labels ?? {})
    .map(labelGroups)
    .filter((groups) => groups[3]?.startsWith(`${block.kind}.`))
    .map((groups) => plainNumber(groups[0]))
    .filter(Boolean);
  if (labelled.length > 0) return [...new Set(labelled)].join(', ');
  const end = output.counters?.[block.kind];
  const start = countersBefore(blocks, index)[block.kind] ?? 0;
  if (end === undefined || end <= start) return undefined;
  return end === start + 1 ? String(end) : `${start + 1}–${end}`;
}
