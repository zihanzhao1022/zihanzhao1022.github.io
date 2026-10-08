import React, { useCallback, useState } from 'react';
import PdfView from '../../components/results/PdfView';
import { pdfPageSize } from '../../components/results/pdfjs';
import { BlockKind, DEFAULT_PREAMBLE, buildBlockDocument } from './document';
import { getTexEngine } from './engine';
import { TexIssue, locateLine, parseAuxLabels, parseCounters, parseErrors, parseWarnings } from './log';

const SAMPLE = String.raw`\begin{table}[t]
\centering
\begin{tabular}{lcc}
\toprule
\textbf{Method} & \textbf{A} & \textbf{B} \\
\midrule
Baseline & 71.2 & \cellcolor{green!15}68.0 \\
Ours & \textbf{79.8} & 75.3 \\
\bottomrule
\end{tabular}
\caption{A made-up table.}
\label{tab:sample}
\end{table}`;

interface Outcome {
  pdf?: Uint8Array;
  width: number;
  height: number;
  ms: number;
  problems: string[];
  warnings: string[];
  counters: Record<string, number>;
  labels: Record<string, string>;
  log: string;
}

const AREA = { source: '代码', preamble: '导言区', wrapper: '包装' } as const;

/** Development page for the TeX engine (#/__tex under npm run dev). */
const TexLab: React.FC = () => {
  const [preamble, setPreamble] = useState(DEFAULT_PREAMBLE);
  const [source, setSource] = useState(SAMPLE);
  const [kind, setKind] = useState<BlockKind>('table');
  const [counters, setCounters] = useState('{"table": 2}');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const compile = useCallback(async () => {
    setBusy(true);
    setFailure(null);
    try {
      const engine = await getTexEngine();
      const doc = buildBlockDocument({ preamble, source, kind, counters: JSON.parse(counters || '{}') as Record<string, number> });
      const started = performance.now();
      const out = await engine.compile({ main: doc.main, files: { 'main.aux': doc.aux } });
      const ms = Math.round(performance.now() - started);
      const size = out.pdf ? await pdfPageSize(out.pdf) : { width: 0, height: 0 };
      const describe = (issue: TexIssue): string => {
        if (issue.line === undefined) return issue.message;
        if (issue.file) return `${issue.file} 第 ${issue.line} 行：${issue.message}`;
        const where = locateLine(issue.line, doc);
        return `${AREA[where.area]}第 ${where.line} 行：${issue.message}`;
      };
      const problems = parseErrors(out.log).map(describe);
      setOutcome({
        pdf: out.ok && problems.length === 0 ? out.pdf : undefined,
        ...size,
        ms,
        problems,
        warnings: parseWarnings(out.log),
        counters: parseCounters(out.log),
        labels: parseAuxLabels(out.aux ?? ''),
        log: out.log,
      });
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }, [preamble, source, kind, counters]);

  return (
    <div className="pb-20 space-y-4 text-sm">
      <h1 className="text-3xl font-light text-gray-900">TeX lab</h1>
      <textarea
        className="w-full h-32 border rounded p-2 font-mono text-xs"
        value={preamble}
        onChange={(event) => setPreamble(event.target.value)}
      />
      <textarea
        className="w-full h-64 border rounded p-2 font-mono text-xs"
        value={source}
        onChange={(event) => setSource(event.target.value)}
      />
      <div className="flex items-center gap-3">
        <select value={kind} onChange={(event) => setKind(event.target.value as BlockKind)} className="border rounded px-2 py-1">
          <option value="text">text</option>
          <option value="figure">figure</option>
          <option value="table">table</option>
        </select>
        <input
          className="border rounded px-2 py-1 font-mono text-xs w-64"
          value={counters}
          onChange={(event) => setCounters(event.target.value)}
        />
        <button
          type="button"
          onClick={() => void compile()}
          disabled={busy}
          className="px-3 py-1 rounded bg-purple-600 text-white disabled:opacity-50"
        >
          {busy ? '编译中…' : '编译'}
        </button>
        {outcome && <span className="text-gray-500">{outcome.ms} ms</span>}
      </div>
      {failure && <p className="text-red-600">{failure}</p>}
      {outcome && (
        <>
          {outcome.problems.map((problem) => (
            <p key={problem} className="text-red-600">
              {problem}
            </p>
          ))}
          {outcome.pdf && <PdfView data={outcome.pdf} width={outcome.width} height={outcome.height} className="border" />}
          <pre className="text-xs bg-gray-50 p-2 overflow-auto">
            {JSON.stringify({ counters: outcome.counters, labels: outcome.labels, warnings: outcome.warnings }, null, 2)}
          </pre>
          <details>
            <summary className="cursor-pointer text-gray-500">日志</summary>
            <pre className="text-xs bg-gray-50 p-2 overflow-auto max-h-96">{outcome.log}</pre>
          </details>
        </>
      )}
    </div>
  );
};

export default TexLab;
