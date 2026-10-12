import { ResultBlock } from '../types';

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

/** The counters where the page left off before block `index`: those of the nearest earlier block with any. */
export function countersBefore(blocks: ResultBlock[], index: number): Record<string, number> {
  for (let previous = index - 1; previous >= 0; previous -= 1) {
    const found = blocks[previous].output?.counters;
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
