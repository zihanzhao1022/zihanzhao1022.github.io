import React, { useEffect, useImperativeHandle, useRef } from 'react';
import { autocompletion, closeBrackets, closeBracketsKeymap, CompletionContext, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { StreamLanguage, bracketMatching, defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { Diagnostic, lintGutter, setDiagnostics } from '@codemirror/lint';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { Compartment, EditorState } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';

const COMMANDS = [
  'textbf', 'textit', 'emph', 'underline', 'texttt', 'textsc', 'textsf', 'textrm', 'textsuperscript', 'textsubscript',
  'textcolor', 'color', 'colorbox', 'cellcolor', 'rowcolor', 'multicolumn', 'multirow', 'makecell', 'toprule', 'midrule',
  'bottomrule', 'cmidrule', 'hline', 'cline', 'addlinespace', 'caption', 'label', 'ref', 'eqref', 'autoref', 'cref',
  'cite', 'citep', 'citet', 'includegraphics', 'centering', 'raggedright', 'small', 'footnotesize', 'scriptsize', 'tiny',
  'normalsize', 'large', 'Large', 'resizebox', 'rotatebox', 'setlength', 'tabcolsep', 'arraystretch', 'renewcommand',
  'section', 'subsection', 'subsubsection', 'paragraph', 'item', 'footnote', 'url', 'href', 'hspace', 'vspace', 'quad',
  'qquad', 'frac', 'sqrt', 'mathbf', 'mathrm', 'mathcal', 'boldsymbol', 'text', 'pm', 'times', 'cdot', 'leq', 'geq',
  'approx', 'sim', 'uparrow', 'downarrow', 'rightarrow', 'alpha', 'beta', 'gamma', 'delta', 'Delta', 'lambda', 'mu',
  'sigma', 'tau', 'checkmark', 'textwidth', 'columnwidth', 'linewidth', 'begin', 'end',
];

const ENVIRONMENTS = [
  'table', 'table*', 'figure', 'figure*', 'tabular', 'tabular*', 'tabularx', 'center', 'minipage', 'itemize', 'enumerate',
  'description', 'equation', 'equation*', 'align', 'align*', 'gather', 'cases', 'array', 'quote',
];

export interface CodeEditorHandle {
  /** Moves the cursor to a 1-based line and scrolls it into view. */
  goToLine: (line: number) => void;
  /** Inserts text at the cursor. */
  insert: (text: string) => void;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Problems to mark, by 1-based line of this editor's text. */
  problems?: { line: number; message: string }[];
  /** Commands defined in the paper's preamble, without the backslash. */
  macros?: string[];
  colors?: string[];
  /** Labels on the page, offered after \ref{. */
  labels?: string[];
  onRun?: () => void;
  onSave?: () => void;
  className?: string;
}

function completions(names: React.MutableRefObject<{ macros: string[]; colors: string[]; labels: string[] }>) {
  return (context: CompletionContext) => {
    const reference = context.matchBefore(/\\(?:ref|eqref|autoref|cref|Cref|pageref|nameref)\{[^}]*/);
    if (reference) {
      return { from: reference.from + reference.text.indexOf('{') + 1, options: names.current.labels.map((label) => ({ label, type: 'variable' })) };
    }
    const color = context.matchBefore(/\\(?:textcolor|color|cellcolor|rowcolor|colorbox)\{[^}]*/);
    if (color) {
      return { from: color.from + color.text.indexOf('{') + 1, options: names.current.colors.map((label) => ({ label, type: 'constant' })) };
    }
    const environment = context.matchBefore(/\\(?:begin|end)\{[A-Za-z*]*/);
    if (environment) {
      return { from: environment.from + environment.text.indexOf('{') + 1, options: ENVIRONMENTS.map((label) => ({ label, type: 'type' })) };
    }
    const command = context.matchBefore(/\\[A-Za-z]*/);
    if (!command || (command.from === command.to && !context.explicit)) return null;
    const own = names.current.macros.map((name) => ({ label: `\\${name}`, type: 'function', detail: '导言区' }));
    return { from: command.from, options: [...own, ...COMMANDS.map((name) => ({ label: `\\${name}`, type: 'keyword' }))] };
  };
}

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px' },
  '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', lineHeight: '1.5' },
  '.cm-content': { paddingBottom: '40vh' },
  '&.cm-focused': { outline: 'none' },
});

/** A LaTeX code editor (CodeMirror 6) with highlighting, completion and problem markers. */
const CodeEditor = React.forwardRef<CodeEditorHandle, Props>(function CodeEditor(
  { value, onChange, problems = [], macros = [], colors = [], labels = [], onRun, onSave, className = '' },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const callbacks = useRef({ onChange, onRun, onSave });
  callbacks.current = { onChange, onRun, onSave };
  const names = useRef({ macros, colors, labels });
  names.current = { macros, colors, labels };
  const readOnly = useRef(new Compartment());

  useEffect(() => {
    if (!host.current) return undefined;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          history(),
          drawSelection(),
          bracketMatching(),
          closeBrackets(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          lintGutter(),
          StreamLanguage.define(stex),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          autocompletion({ override: [completions(names)] }),
          EditorView.lineWrapping,
          readOnly.current.of([]),
          keymap.of([
            { key: 'Mod-Enter', run: () => (callbacks.current.onRun?.(), true) },
            { key: 'Mod-s', run: () => (callbacks.current.onSave?.(), true), preventDefault: true },
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...completionKeymap,
            indentWithTab,
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) callbacks.current.onChange(update.state.doc.toString());
          }),
          theme,
        ],
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
    // The editor is created once; later values arrive through the effect below.
  }, []);

  // Text set from outside (not typed here) replaces the document.
  useEffect(() => {
    const editor = view.current;
    if (!editor || editor.state.doc.toString() === value) return;
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
  }, [value]);

  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    const doc = editor.state.doc;
    const diagnostics: Diagnostic[] = problems
      .filter((problem) => problem.line >= 1 && problem.line <= doc.lines)
      .map((problem) => {
        const line = doc.line(problem.line);
        return { from: line.from, to: line.to, severity: 'error', message: problem.message };
      });
    editor.dispatch(setDiagnostics(editor.state, diagnostics));
  }, [problems]);

  useImperativeHandle(ref, () => ({
    goToLine: (line) => {
      const editor = view.current;
      if (!editor) return;
      const target = editor.state.doc.line(Math.max(1, Math.min(line, editor.state.doc.lines)));
      editor.dispatch({ selection: { anchor: target.from }, effects: EditorView.scrollIntoView(target.from, { y: 'center' }) });
      editor.focus();
    },
    insert: (text) => {
      const editor = view.current;
      if (!editor) return;
      const { from, to } = editor.state.selection.main;
      editor.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
      editor.focus();
    },
  }));

  return <div ref={host} className={`h-full min-h-0 overflow-hidden ${className}`} />;
});

export default CodeEditor;
