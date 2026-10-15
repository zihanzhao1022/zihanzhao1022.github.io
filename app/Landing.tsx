import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Code2, FileText, Folder, FolderOpen, Inbox, Lock, Scale } from 'lucide-react';
import { useLang } from '../lib/i18n';
import { useT } from '../lib/phrases/app';
import { ACCOUNTS, Account } from './accounts';
import Avatar from './Avatar';
import { TAG_LOOK } from './look';
import { TagColor } from './organizer';

/** When a picture's part comes in, after the picture starts. */
const at = (ms: number): React.CSSProperties => ({ '--d': `${ms}ms` }) as React.CSSProperties;

const calm = (): boolean => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Whether an element has come into view (once) and whether it is in view now. */
function useInView<T extends Element>(threshold = 0.3): { ref: React.RefObject<T>; seen: boolean; visible: boolean } {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting) setSeen(true);
      },
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, seen, visible };
}

/** A picture whose parts (`g-in`) put themselves together the first time it comes into view. */
const Stage: React.FC<{ className?: string; threshold?: number; decorative?: boolean; children: React.ReactNode }> = ({ className = '', threshold, decorative = true, children }) => {
  const { ref, seen } = useInView<HTMLDivElement>(threshold);
  return (
    <div ref={ref} data-shown={seen ? '' : undefined} className={className} aria-hidden={decorative || undefined}>
      {children}
    </div>
  );
};

const GitHubMark: React.FC = () => (
  <svg viewBox="0 0 16 16" width="17" height="17" fill="currentColor" aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

const SignIn: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const t = useT();
  return (
    <button type="button" onClick={onClick} className="galley-press inline-flex items-center gap-2 rounded-full bg-violet-700 px-6 py-3 text-[15px] font-medium text-white hover:bg-violet-800">
      <GitHubMark />
      {t('用 GitHub 登录')}
    </button>
  );
};

/** Accuracy of two made-up methods on four made-up tasks; the bars grow from the axis when the picture comes in. */
const BARS: [number, number][] = [
  [56, 40],
  [70, 52],
  [62, 44],
  [80, 58],
];

const Chart: React.FC<{ from?: number; className?: string }> = ({ from = 0, className = '' }) => (
  <svg viewBox="0 0 280 120" className={className}>
    <line x1="20" y1="104" x2="276" y2="104" stroke="#d4d4d8" />
    {BARS.map(([ours, base], index) => (
      <g key={index} transform={`translate(${36 + index * 62} 0)`}>
        <rect className="g-in g-grow" style={at(from + index * 80)} x="0" y={104 - base} width="18" height={base} rx="1" fill="#d4d4d8" />
        <rect className="g-in g-grow" style={at(from + index * 80 + 40)} x="21" y={104 - ours - 18} width="18" height={ours + 18} rx="1" fill="#6d28d9" />
      </g>
    ))}
  </svg>
);

/** A results page in miniature, putting itself together: the outline, a section with a figure, a comment in the margin. */
const Sheet: React.FC = () => {
  const t = useT();
  const [, alice, bob] = ACCOUNTS;
  const outline = ['1 Setup', '2 Method', '3 Results', t('图 2'), t('表 1'), 'References'];
  return (
    <div
      className="g-in g-rise grid grid-cols-[minmax(0,1fr)] gap-6 rounded-[1.25rem] border border-black/[0.06] bg-white p-6 text-left shadow-[0_2px_4px_rgba(0,0,0,0.03),0_40px_80px_-32px_rgba(24,24,27,0.35)] sm:grid-cols-[7rem_minmax(0,1fr)_11rem] sm:p-8"
      style={{ ...at(320), animationDuration: '1100ms' }}
    >
      <nav className="hidden space-y-2.5 pt-1 text-[12px] text-gray-400 sm:block">
        <p className="g-in g-fade text-gray-500" style={at(760)}>
          {t('目录')}
        </p>
        {outline.map((item, index) => (
          <p
            key={item}
            className={`g-in g-fade ${index === 2 ? '-ml-1.5 rounded-md bg-violet-50 px-1.5 py-0.5 text-violet-700' : ''} ${index === 3 || index === 4 ? 'pl-3' : ''}`}
            style={at(800 + index * 45)}
          >
            {item}
          </p>
        ))}
      </nav>
      <div className="font-serif-display text-[14px] leading-relaxed text-gray-800">
        <div className="mb-3 flex items-center justify-between">
          <p className="g-in g-fade text-[17px] font-semibold" style={at(860)}>
            3&nbsp;&nbsp;Results
          </p>
          <span className="flex -space-x-1.5">
            <span className="g-in g-pop" style={at(2050)}>
              <Avatar account={alice} size={24} className="ring-2 ring-white" />
            </span>
            <span className="g-in g-pop" style={at(2130)}>
              <Avatar account={bob} size={24} className="ring-2 ring-white" />
            </span>
          </span>
        </div>
        <p className="g-in g-fade" style={at(920)}>
          Ours improves accuracy on{' '}
          <span className="g-in g-mark" style={at(1600)}>
            all four made-up tasks
          </span>
          , while the baseline drops on the last two.
        </p>
        <Chart from={1080} className="mx-auto my-5 w-full max-w-[26rem]" />
        <p className="g-in g-fade text-center text-[12.5px] text-gray-600" style={at(1400)}>
          Figure 2: Accuracy of the made-up methods.
        </p>
      </div>
      {/* The margin, where comments sit beside what they are about. */}
      <div className="hidden pt-10 sm:block">
        <div className="g-in g-slide rounded-xl border border-amber-200/80 bg-amber-50 p-3 text-[12.5px] leading-snug text-gray-800 shadow-[0_8px_20px_-14px_rgba(180,83,9,0.5)]" style={at(1850)}>
          <div className="mb-1.5 flex items-center gap-1.5 text-gray-500">
            <Avatar account={alice} size={18} />
            <span>Alice</span>
          </div>
          {t('这个提升是 5 次运行的平均吗？')}
        </div>
      </div>
    </div>
  );
};

/** A section's headline and what it says, set large. */
const Heading: React.FC<{ title: string; body: string; dark?: boolean; center?: boolean }> = ({ title, body, dark = false, center = true }) => (
  <div className={center ? 'mx-auto max-w-[46rem] text-center' : 'max-w-[24rem]'}>
    {/* Beside a picture the headline is a size smaller, so a Chinese phrase keeps to one line. */}
    <h2 className={`galley-display ${center ? 'text-[clamp(1.75rem,1rem+2.9vw,3.25rem)]' : 'text-[clamp(1.75rem,1.1rem+1.8vw,2.5rem)]'} ${dark ? 'text-white' : 'text-[#1d1d1f]'}`}>{title}</h2>
    <p className={`galley-prose mt-5 text-[clamp(1.0625rem,1rem+0.3vw,1.25rem)] leading-relaxed ${dark ? 'text-[#a1a1a6]' : 'text-[#6e6e73]'}`}>{body}</p>
  </div>
);

const SOURCE = [
  '\\begin{table}',
  '  \\centering',
  '  \\begin{tabular}{lcc}',
  '    \\toprule',
  '    Method & Acc. & F1 \\\\',
  '    \\midrule',
  '    Baseline & 71.2 & 68.0 \\\\',
  '    Ours & \\textbf{78.4} & \\textbf{75.1} \\\\',
  '    \\bottomrule',
  '  \\end{tabular}',
  '  \\caption{Made-up benchmark results.}',
  '\\end{table}',
];

/** A line of LaTeX with its commands in color. */
const Code: React.FC<{ line: string }> = ({ line }) => (
  <>
    {line.split(/(\\[a-zA-Z]+)/).map((part, index) =>
      part.startsWith('\\') && part.length > 1 ? (
        <span key={index} className="text-violet-700">
          {part}
        </span>
      ) : (
        <React.Fragment key={index}>{part}</React.Fragment>
      ),
    )}
  </>
);

/** The same made-up result as a booktabs table, or as a figure: the picture's switch flips between them. */
const Compiled: React.FC = () => {
  const t = useT();
  const [kind, setKind] = useState<'table' | 'figure'>('table');
  const face = (on: boolean) =>
    `[grid-area:1/1] flex flex-col items-center justify-center transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${on ? 'opacity-100' : 'pointer-events-none scale-[0.98] opacity-0'}`;
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-end border-b border-black/[0.06] px-5 py-3">
        <div className="flex rounded-lg bg-black/[0.05] p-0.5 text-[13px]" role="group" aria-label={t('图和表格互相切换')}>
          {(['figure', 'table'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={kind === option}
              onClick={() => setKind(option)}
              className={`rounded-md px-3 py-1 transition-[background-color,box-shadow,color] duration-200 ${kind === option ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.12)]' : 'text-gray-500 hover:text-gray-800'}`}
            >
              {option === 'figure' ? t('图') : t('表格')}
            </button>
          ))}
        </div>
      </div>
      <div className="grid flex-1 px-6 py-10 font-serif-display text-[14px] text-gray-900 sm:px-10">
        <div className={face(kind === 'table')}>
          <table className="w-full max-w-[19rem] border-y-[1.5px] border-gray-900 text-center tabular-nums">
            <thead>
              <tr className="border-b border-gray-900">
                <th className="py-1.5 text-left font-normal">Method</th>
                <th className="py-1.5 font-normal">Acc.</th>
                <th className="py-1.5 font-normal">F1</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="pt-1.5 text-left">Baseline</td>
                <td className="pt-1.5">71.2</td>
                <td className="pt-1.5">68.0</td>
              </tr>
              <tr>
                <td className="pb-1.5 text-left">Ours</td>
                <td className="pb-1.5 font-semibold">78.4</td>
                <td className="pb-1.5 font-semibold">75.1</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-4 text-[12.5px] text-gray-600">Table 1: Made-up benchmark results.</p>
        </div>
        <div className={face(kind === 'figure')}>
          <svg viewBox="0 0 200 110" className="w-full max-w-[17rem]">
            <line x1="10" y1="96" x2="196" y2="96" stroke="#d4d4d8" />
            {[
              [71.2, 78.4],
              [68.0, 75.1],
            ].map(([base, ours], index) => (
              <g key={index} transform={`translate(${40 + index * 80} 0)`}>
                <rect x="0" y={96 - (base - 50) * 3} width="24" height={(base - 50) * 3} rx="1" fill="#d4d4d8" />
                <rect x="28" y={96 - (ours - 50) * 3} width="24" height={(ours - 50) * 3} rx="1" fill="#6d28d9" />
                <text x="26" y="108" textAnchor="middle" fontSize="9" fill="#52525b">
                  {index === 0 ? 'Acc.' : 'F1'}
                </text>
              </g>
            ))}
          </svg>
          <p className="mt-3 text-[12.5px] text-gray-600">Figure 1: Made-up benchmark results.</p>
        </div>
      </div>
    </div>
  );
};

/** One comment of the thread in the margin. */
const Comment: React.FC<{ who: Account; text: string; tone: 'amber' | 'white'; start: number }> = ({ who, text, tone, start }) => (
  <div
    className={`g-in g-slide rounded-2xl border p-4 text-[14px] leading-snug text-gray-800 ${tone === 'amber' ? 'border-amber-200/80 bg-amber-50 shadow-[0_12px_24px_-18px_rgba(180,83,9,0.55)]' : 'border-black/[0.06] bg-white shadow-[0_12px_24px_-18px_rgba(0,0,0,0.35)]'}`}
    style={at(start)}
  >
    <div className="mb-2 flex items-center gap-2 text-[13px] text-gray-500">
      <Avatar account={who} size={22} />
      <span className="font-medium text-gray-700">{who.name}</span>
    </div>
    {text}
  </div>
);

/** A presentation stepping through three blocks; it moves on by itself while in view, or with its arrow keys. */
const Slides: React.FC = () => {
  const t = useT();
  const { ref, seen, visible } = useInView<HTMLDivElement>(0.4);
  const [index, setIndex] = useState(0);
  const [pressed, setPressed] = useState<'previous' | 'next' | null>(null);
  const go = (step: 1 | -1) => {
    setIndex((current) => (current + step + 3) % 3);
    setPressed(step === 1 ? 'next' : 'previous');
  };
  useEffect(() => {
    if (!pressed) return undefined;
    const timer = window.setTimeout(() => setPressed(null), 160);
    return () => window.clearTimeout(timer);
  }, [pressed]);
  useEffect(() => {
    if (!visible || calm()) return undefined;
    const timer = window.setTimeout(() => go(1), 3000);
    return () => window.clearTimeout(timer);
  }, [visible, index]);

  const slide = (position: number) =>
    `absolute inset-0 m-auto flex h-[78%] w-[72%] flex-col justify-center rounded-lg bg-white p-[6%] text-left font-serif-display text-gray-900 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)] transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${
      position === index ? 'opacity-100' : position === (index + 2) % 3 ? 'pointer-events-none -translate-x-[6%] opacity-0' : 'pointer-events-none translate-x-[6%] opacity-0'
    }`;
  const key = (which: 'previous' | 'next') =>
    `galley-press flex h-11 w-14 items-center justify-center rounded-lg border border-white/15 bg-white/[0.07] text-lg text-white/80 shadow-[inset_0_-2px_0_rgba(255,255,255,0.06)] transition-[transform,background-color] duration-150 hover:bg-white/[0.12] ${pressed === which ? 'scale-[0.94] bg-white/20' : ''}`;

  return (
    <div ref={ref} data-shown={seen ? '' : undefined}>
      <div className="g-in g-rise relative mx-auto mt-14 aspect-[16/10] w-full max-w-[52rem] overflow-hidden rounded-[1.25rem] border border-white/10 bg-white/[0.04]" style={at(0)} aria-hidden="true">
        <div className={slide(0)}>
          <p className="text-[clamp(1rem,0.6rem+1.6vw,1.75rem)] font-semibold">3&nbsp;&nbsp;Results</p>
          <p className="mt-3 text-[clamp(0.7rem,0.5rem+0.8vw,1.0625rem)] leading-relaxed text-gray-700">
            Ours improves accuracy on all four made-up tasks, while the baseline drops on the last two.
          </p>
        </div>
        <div className={`${slide(1)} items-center`}>
          <svg viewBox="0 0 280 120" className="w-[88%]">
            <line x1="20" y1="104" x2="276" y2="104" stroke="#d4d4d8" />
            {BARS.map(([ours, base], bar) => (
              <g key={bar} transform={`translate(${36 + bar * 62} 0)`}>
                <rect x="0" y={104 - base} width="18" height={base} rx="1" fill="#d4d4d8" />
                <rect x="21" y={104 - ours - 18} width="18" height={ours + 18} rx="1" fill="#6d28d9" />
              </g>
            ))}
          </svg>
          <p className="mt-2 text-[clamp(0.6rem,0.45rem+0.6vw,0.875rem)] text-gray-600">Figure 2: Accuracy of the made-up methods.</p>
        </div>
        <div className={`${slide(2)} items-center`}>
          <table className="w-[80%] border-y-[1.5px] border-gray-900 text-center text-[clamp(0.65rem,0.45rem+0.8vw,1rem)] tabular-nums">
            <tbody>
              <tr className="border-b border-gray-900">
                <td className="py-[1.5%] text-left">Method</td>
                <td>Acc.</td>
                <td>F1</td>
              </tr>
              <tr>
                <td className="pt-[1.5%] text-left">Baseline</td>
                <td>71.2</td>
                <td>68.0</td>
              </tr>
              <tr>
                <td className="pb-[1.5%] text-left">Ours</td>
                <td className="font-semibold">78.4</td>
                <td className="font-semibold">75.1</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-[clamp(0.6rem,0.45rem+0.6vw,0.875rem)] text-gray-600">Table 1: Made-up benchmark results.</p>
        </div>
        <p className="absolute bottom-3 right-4 text-xs tabular-nums text-white/45">{index + 3} / 7</p>
      </div>
      <div className="mt-8 flex justify-center gap-3">
        <button type="button" onClick={() => go(-1)} aria-label={t('上一页')} className={key('previous')}>
          ←
        </button>
        <button type="button" onClick={() => go(1)} aria-label={t('下一页')} className={key('next')}>
          →
        </button>
      </div>
    </div>
  );
};

/** A few papers in folders and tags; choosing a folder or a tag on the left narrows the list. */
const LIBRARY: { title: string; folder: string | null; tags: string[] }[] = [
  { title: 'Made-up study: adapters under distribution shift', folder: 'ACL 2027', tags: ['submitted'] },
  { title: 'Made-up rebuttal notes', folder: 'ACL 2027', tags: ['draft'] },
  { title: 'Made-up survey of evaluation protocols', folder: 'Surveys', tags: [] },
  { title: 'Made-up workshop poster', folder: null, tags: ['draft', 'poster'] },
];
const LIBRARY_TAGS: [string, TagColor][] = [
  ['submitted', 'red'],
  ['draft', 'yellow'],
  ['poster', 'violet'],
];

const Library: React.FC = () => {
  const t = useT();
  const [filter, setFilter] = useState<string | null>(null);
  const shown = LIBRARY.filter((paper) => !filter || paper.folder === filter || paper.tags.includes(filter));
  const item = (value: string | null, icon: React.ReactNode, label: string, count: number) => (
    <button
      key={label}
      type="button"
      onClick={() => setFilter(value)}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors duration-150 ${filter === value ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-gray-700 hover:bg-black/[0.04]'}`}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      <span className="text-xs tabular-nums text-gray-400">{count}</span>
    </button>
  );
  const color = (tag: string) => LIBRARY_TAGS.find(([name]) => name === tag)?.[1] ?? 'gray';
  return (
    <div className="grid overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-white shadow-[0_30px_60px_-36px_rgba(0,0,0,0.35)] sm:grid-cols-[12rem_minmax(0,1fr)]">
      <div className="space-y-0.5 bg-[#f5f5f7] p-3">
        {item(null, <Inbox size={14} className="text-gray-400" />, t('全部论文'), LIBRARY.length)}
        <p className="px-2 pb-1 pt-4 text-xs text-gray-500">{t('文件夹')}</p>
        {['ACL 2027', 'Surveys'].map((folder) =>
          item(folder, filter === folder ? <FolderOpen size={14} className="text-violet-600" /> : <Folder size={14} className="text-gray-400" />, folder, LIBRARY.filter((paper) => paper.folder === folder).length),
        )}
        <p className="px-2 pb-1 pt-4 text-xs text-gray-500">{t('标签')}</p>
        {LIBRARY_TAGS.map(([tag, tone]) => item(tag, <span className={`ml-0.5 h-2.5 w-2.5 rounded-full ${TAG_LOOK[tone].dot}`} />, tag, LIBRARY.filter((paper) => paper.tags.includes(tag)).length))}
      </div>
      <ul key={filter ?? 'all'} className="min-h-[15rem] px-4 py-2">
        {shown.map((paper, index) => (
          <li key={paper.title} className="galley-row flex flex-wrap items-center gap-2 border-b border-black/[0.06] py-3 text-[14px] last:border-b-0" style={{ animationDelay: `${index * 40}ms` }}>
            <FileText size={15} className="shrink-0 text-gray-400" />
            <span className="min-w-0 truncate text-gray-900">{paper.title}</span>
            {paper.tags.map((tag) => (
              <span key={tag} className={`rounded-full px-2 py-0.5 text-xs ${TAG_LOOK[color(tag)].chip}`}>
                {tag}
              </span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
};

/** The repository Galley keeps a paper in, as GitHub would list it. */
const Repository: React.FC = () => {
  const t = useT();
  const rows: [number, 'folder' | 'file', string, string?][] = [
    [0, 'file', 'galley.json', t('文件夹和标签')],
    [0, 'folder', 'results/'],
    [1, 'folder', 'made-up-adapters/'],
    [2, 'file', 'paper.json'],
    [2, 'folder', 'figs/'],
    [3, 'file', 'accuracy.pdf'],
    [2, 'file', 'blk-exa1-08dc6cdd.pdf'],
    [1, 'folder', 'made-up-survey/'],
  ];
  return (
    <Stage className="overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-white shadow-[0_30px_60px_-36px_rgba(0,0,0,0.35)]">
      <div className="flex items-center gap-2 border-b border-black/[0.06] px-5 py-3.5 text-[14px]">
        <Lock size={14} className="text-gray-500" />
        <span className="font-medium text-gray-900">you/results</span>
        <span className="rounded-full border border-black/10 px-2 py-0.5 text-xs text-gray-500">{t('私有')}</span>
      </div>
      <ul className="py-2 font-mono text-[13px] text-gray-700">
        {rows.map(([depth, kind, name, note], index) => (
          <li key={`${depth}${name}`} className="g-in g-fade flex items-center gap-2 py-1.5 pr-5" style={{ ...at(150 + index * 60), paddingLeft: `${1.25 + depth * 1.25}rem` }}>
            {kind === 'folder' ? <Folder size={14} className="shrink-0 text-violet-500" /> : <FileText size={14} className="shrink-0 text-gray-400" />}
            <span className="truncate">{name}</span>
            {note && <span className="ml-auto shrink-0 font-sans text-xs text-gray-400">{note}</span>}
          </li>
        ))}
      </ul>
    </Stage>
  );
};

/** What a visitor sees first: what Galley is for, and the way in. */
const Landing: React.FC<{ onSignIn: () => void }> = ({ onSignIn }) => {
  const t = useT();
  const lang = useLang();
  const [me, alice, bob] = ACCOUNTS;
  const facts = [
    { icon: Lock, title: t('私有仓库'), body: t('论文只存在你选的仓库里，随时可以带走。') },
    { icon: Code2, title: t('在浏览器里编译'), body: t('LaTeX 在你的浏览器里编译，不需要编译服务器。') },
    { icon: Scale, title: t('开源'), body: t('Galley 以 AGPL-3.0 开源，可以自己部署。') },
  ];
  return (
    <div className="overflow-x-clip">
      {/* The first screen: the promise, the way in, and a results page putting itself together. */}
      <section data-shown="" className="relative">
        <div className="mx-auto flex min-h-[calc(100svh-5.25rem)] max-w-[1120px] flex-col items-center px-4 pb-16 pt-[clamp(3rem,9vh,6.5rem)] text-center sm:px-6">
          <h1 className="galley-display text-[clamp(2rem,1rem+4.6vw,4.75rem)] text-[#1d1d1f]">
            <span className="g-in g-rise block" style={at(0)}>
              {t('写论文用 Overleaf，')}
            </span>
            <span className="g-in g-rise block" style={at(90)}>
              {t('给人看结果用 Galley。')}
            </span>
          </h1>
          {/* One sentence a line where there is room. */}
          <p className="g-in g-rise galley-prose mt-6 max-w-[44rem] text-[clamp(1.0625rem,0.95rem+0.5vw,1.3125rem)] leading-relaxed text-[#6e6e73]" style={at(180)}>
            <span className="sm:block">{t('把 LaTeX 写的文字、图和表格编译成清楚的网页，按章节排好。')}</span>
            {lang === 'en' ? ' ' : ''}
            <span className="sm:block">{t('合作者在页边批注，组会时直接演示。')}</span>
          </p>
          <div className="g-in g-rise mt-9 flex flex-wrap items-center justify-center gap-x-7 gap-y-3" style={at(260)}>
            <SignIn onClick={onSignIn} />
            <button
              type="button"
              onClick={() => document.getElementById('galley-compile')?.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth' })}
              className="inline-flex items-center gap-1 text-[15px] text-violet-700 hover:underline"
            >
              {t('了解更多')}
              <ChevronDown size={16} />
            </button>
          </div>
          <div className="g-tilt mt-10 w-full max-w-[60rem] sm:mt-12" aria-hidden="true">
            <Sheet />
          </div>
        </div>
      </section>

      <section id="galley-compile" className="scroll-mt-14 bg-[#f5f5f7] py-24 sm:py-32">
        <div className="mx-auto max-w-[1040px] px-4 sm:px-6">
          <Heading
            title={t('LaTeX 进去，清楚的页面出来。')}
            body={t('粘贴一段 LaTeX，或者把图和表格文件拖进来，在浏览器里直接编译。PDF 矢量图放大也清楚；同一份结果可以在图和表格之间切换，两份都留着。')}
          />
          <Stage decorative={false} className="mt-14 grid overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-white shadow-[0_30px_60px_-36px_rgba(0,0,0,0.35)] md:grid-cols-2">
            <pre className="overflow-x-auto border-b border-black/[0.06] bg-[#fbfbfd] px-5 py-6 font-mono text-[11px] leading-6 text-[#424245] [scrollbar-width:none] sm:px-6 sm:text-[12.5px] md:border-b-0 md:border-r">
              {SOURCE.map((line, index) => (
                <span key={index} className="g-in g-fade block" style={at(index * 55)}>
                  <Code line={line} />
                </span>
              ))}
            </pre>
            <div className="g-in g-wipe" style={at(700)}>
              <Compiled />
            </div>
          </Stage>
        </div>
      </section>

      <section className="py-24 sm:py-32">
        <div className="mx-auto grid max-w-[1120px] items-center gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
          <Heading center={false} title={t('批注，就贴在那句话旁边。')} body={t('选中一句话就能留言，回复排在页边。谁正在看哪一节，也一目了然。')} />
          <Stage className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_13rem]" threshold={0.4}>
            <div className="g-in g-fade rounded-[1.25rem] border border-black/[0.06] bg-white p-7 shadow-[0_30px_60px_-36px_rgba(0,0,0,0.35)]" style={at(0)}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="font-serif-display text-[17px] font-semibold text-gray-900">3.2&nbsp;&nbsp;Main results</p>
                <span className="g-in g-fade inline-flex items-center gap-1.5 rounded-full bg-emerald-50 py-0.5 pl-0.5 pr-2.5 text-xs text-emerald-800" style={at(1500)}>
                  <Avatar account={bob} size={18} />
                  {t('{name} 正在看', { name: bob.name.split(' ')[0] })}
                </span>
              </div>
              <p className="font-serif-display text-[15px] leading-7 text-gray-800">
                On all four made-up tasks, ours improves accuracy by{' '}
                <span className="g-in g-mark" style={at(350)}>
                  6.8 points on average
                </span>
                , while the baseline drops on the last two. The gap is widest for the smallest model.
              </p>
            </div>
            <div className="space-y-3 sm:pt-12">
              <Comment who={alice} text={t('这个提升是 5 次运行的平均吗？')} tone="amber" start={850} />
              <Comment who={me} text={t('是的，标准差在附录的表 3。')} tone="white" start={1250} />
            </div>
          </Stage>
        </div>
      </section>

      <section data-under="dark" className="bg-black py-24 sm:py-32">
        <div className="mx-auto max-w-[1040px] px-4 sm:px-6">
          <Heading dark title={t('组会时，直接演示。')} body={t('一块结果占一屏，方向键翻页，不用另做一份幻灯片。')} />
          <Slides />
        </div>
      </section>

      <section className="py-24 sm:py-32">
        <div className="mx-auto grid max-w-[1120px] items-center gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
          <div className="lg:order-2">
            <Heading center={false} title={t('论文多了，也找得到。')} body={t('用文件夹分组，用彩色标签标记进度；投完的稿子归档，列表保持清爽。')} />
          </div>
          <Library />
        </div>
      </section>

      <section className="bg-[#f5f5f7] py-24 sm:py-32">
        <div className="mx-auto max-w-[1040px] px-4 sm:px-6">
          <Heading title={t('数据留在你自己的仓库里。')} body={t('登录后选一个 GitHub 私有仓库，Galley 只读写这一个。')} />
          <div className="mt-14 grid items-start gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <Repository />
            <ul className="space-y-8">
              {facts.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-violet-700 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                    <Icon size={18} />
                  </span>
                  <span>
                    <span className="block font-semibold text-[#1d1d1f]">{title}</span>
                    <span className="galley-prose mt-1 block text-[15px] leading-relaxed text-[#6e6e73]">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="px-4 py-28 text-center sm:py-40">
        <h2 className="galley-display text-[clamp(2.25rem,1.2rem+3.6vw,4.25rem)] text-[#1d1d1f]">{t('把下一张图放进 Galley。')}</h2>
        <div className="mt-10">
          <SignIn onClick={onSignIn} />
        </div>
      </section>
    </div>
  );
};

export default Landing;
