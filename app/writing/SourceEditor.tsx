import React, { useEffect, useImperativeHandle, useRef } from 'react';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { StreamLanguage, bracketMatching, defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { Diagnostic, lintGutter, setDiagnostics } from '@codemirror/lint';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { EditorState, Extension, Facet, RangeSetBuilder, StateEffect, StateField } from '@codemirror/state';
import {
  Decoration,
  DecorationSet,
  EditorView,
  WidgetType,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { newBlockId } from '../../editor/results/actions';
import { t } from '../../lib/phrases/app';
import { markerLine, readMarker } from './document';

export interface SourceFile {
  name: string;
  text: string;
  /** main.tex holds the blocks under their marker lines. */
  blocks?: boolean;
  latex?: boolean;
}

export interface SourceEditorHandle {
  /** Opens a file at a line (1-based), selecting columns `start` to `end` of it when given, and marks the line. */
  reveal: (file: string, line: number, start?: number, end?: number) => void;
  /** Starts a new block at the cursor's line (main.tex only); false when it cannot. */
  splitBlock: () => boolean;
  /** The cursor's line in the open file. */
  cursorLine: () => number;
}

interface Props {
  files: SourceFile[];
  /** Changing it reloads every file from `files`. */
  version: number;
  active: string;
  onChange: (file: string, text: string) => void;
  onSave: () => void;
  onCompile: () => void;
  problems: Record<string, { line: number; message: string }[]>;
  /** Blocks readers do not see, labelled so on their dividers. */
  hidden: string[];
}

const hiddenBlocks = Facet.define<string[], string[]>({ combine: (values) => values.flat() });

/** The divider a block's marker line shows as: which block it is, its kind, and whether readers see it. */
class BlockDivider extends WidgetType {
  constructor(
    readonly index: number,
    readonly kind: string,
    readonly hidden: boolean,
  ) {
    super();
  }

  eq(other: BlockDivider): boolean {
    return other.index === this.index && other.kind === this.kind && other.hidden === this.hidden;
  }

  toDOM(): HTMLElement {
    const element = document.createElement('div');
    element.className = 'cm-writing-block';
    const kinds: Record<string, string> = { text: t('文字'), figure: t('图'), table: t('表格') };
    const label = document.createElement('span');
    label.textContent = t('块 {n} · {kind}', { n: this.index, kind: kinds[this.kind] ?? this.kind });
    element.append(label);
    if (this.hidden) {
      const badge = document.createElement('span');
      badge.className = 'cm-writing-block-hidden';
      badge.textContent = t('已隐藏');
      element.append(badge);
    }
    return element;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

function dividers(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const hidden = new Set(state.facet(hiddenBlocks));
  let index = 0;
  for (let n = 1; n <= state.doc.lines; n += 1) {
    const line = state.doc.line(n);
    const marker = readMarker(line.text);
    if (!marker) continue;
    index += 1;
    builder.add(line.from, line.to, Decoration.replace({ widget: new BlockDivider(index, marker.kind, hidden.has(marker.id)), block: true }));
  }
  return builder.finish();
}

const blockDividers = StateField.define<DecorationSet>({
  create: dividers,
  update: (value, transaction) => (transaction.docChanged || transaction.reconfigured ? dividers(transaction.state) : value),
  provide: (field) => [EditorView.decorations.from(field), EditorView.atomicRanges.of((view) => view.state.field(field))],
});

/**
 * Marker lines cannot be typed into, deleted or joined to their neighbours (the newline on each side is theirs);
 * typing at the end of the line before one, or at the start of the line after, still works.
 */
const keepMarkers = EditorState.changeFilter.of((transaction) => {
  const ranges: number[] = [];
  const { doc } = transaction.startState;
  transaction.startState.field(blockDividers).between(0, doc.length, (from, to) => {
    const start = Math.max(0, from - 1);
    const end = Math.min(doc.length, to + 1);
    if (ranges.length > 0 && start <= ranges[ranges.length - 1]) ranges[ranges.length - 1] = end;
    else ranges.push(start, end);
  });
  return ranges.length > 0 ? ranges : true;
});

const flashLine = StateEffect.define<number | null>();
const flashField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(flashLine)) {
        if (effect.value === null) return Decoration.none;
        return Decoration.set([Decoration.line({ class: 'cm-writing-flash' }).range(effect.value)]);
      }
    }
    return transaction.docChanged ? value.map(transaction.changes) : value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px' },
  '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', lineHeight: '1.55' },
  '.cm-content': { paddingBottom: '40vh' },
  '&.cm-focused': { outline: 'none' },
  '.cm-gutters': { backgroundColor: '#fafafa', borderRight: '1px solid rgba(0,0,0,0.06)', color: '#a1a1aa' },
  '.cm-writing-block': {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    margin: '6px 0 2px',
    padding: '2px 8px',
    borderTop: '1px dashed rgba(109,40,217,0.35)',
    color: '#6d28d9',
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", system-ui, sans-serif',
    fontSize: '11px',
    userSelect: 'none',
  },
  '.cm-writing-block-hidden': { color: '#a1a1aa' },
  '.cm-writing-flash': { animation: 'writing-flash 1.6s ease-out' },
});

function stateFor(file: SourceFile, hidden: string[], handlers: Extension): EditorState {
  return EditorState.create({
    doc: file.text,
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
      ...(file.latex === false ? [] : [StreamLanguage.define(stex), syntaxHighlighting(defaultHighlightStyle, { fallback: true })]),
      EditorView.lineWrapping,
      ...(file.blocks ? [hiddenBlocks.of(hidden), blockDividers, keepMarkers] : []),
      flashField,
      handlers,
      theme,
    ],
  });
}

/** The writing view's editor: one CodeMirror view showing one file at a time, each file keeping its own history. */
const SourceEditor = React.forwardRef<SourceEditorHandle, Props>(function SourceEditor({ files, version, active, onChange, onSave, onCompile, problems, hidden }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const states = useRef(new Map<string, EditorState>());
  const shown = useRef(active);
  const callbacks = useRef({ onChange, onSave, onCompile });
  callbacks.current = { onChange, onSave, onCompile };
  const problemsRef = useRef(problems);
  problemsRef.current = problems;

  // Shared by every file's state; reads the open file's name when it reports a change.
  const handlers = useRef<Extension>([
    keymap.of([
      { key: 'Mod-s', run: () => (callbacks.current.onSave(), true), preventDefault: true },
      { key: 'Mod-Enter', run: () => (callbacks.current.onCompile(), true) },
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      indentWithTab,
    ]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) callbacks.current.onChange(shown.current, update.state.doc.toString());
    }),
  ]);

  const withProblems = (name: string, state: EditorState): EditorState => {
    const doc = state.doc;
    const diagnostics: Diagnostic[] = (problemsRef.current[name] ?? [])
      .filter((problem) => problem.line >= 1 && problem.line <= doc.lines)
      .map((problem) => ({ from: doc.line(problem.line).from, to: doc.line(problem.line).to, severity: 'error', message: problem.message }));
    return state.update(setDiagnostics(state, diagnostics)).state;
  };

  useEffect(() => {
    if (!host.current) return undefined;
    const editor = new EditorView({ parent: host.current });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
  }, []);

  // Every file starts again from what it was given.
  useEffect(() => {
    states.current = new Map(files.map((file) => [file.name, stateFor(file, hidden, handlers.current)]));
    const first = states.current.get(active);
    if (first && view.current) {
      shown.current = active;
      view.current.setState(withProblems(active, first));
    }
    // Only a new version reloads; the texts keep changing as the owner types.
  }, [version]);

  // Another file: the open one keeps its state (and undo history) for later.
  useEffect(() => {
    const editor = view.current;
    if (!editor || shown.current === active) return;
    states.current.set(shown.current, editor.state);
    const next = states.current.get(active);
    if (!next) return;
    shown.current = active;
    editor.setState(withProblems(active, next));
  }, [active]);

  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    const doc = editor.state.doc;
    const diagnostics: Diagnostic[] = (problems[shown.current] ?? [])
      .filter((problem) => problem.line >= 1 && problem.line <= doc.lines)
      .map((problem) => ({ from: doc.line(problem.line).from, to: doc.line(problem.line).to, severity: 'error', message: problem.message }));
    editor.dispatch(setDiagnostics(editor.state, diagnostics));
  }, [problems]);

  useImperativeHandle(ref, () => ({
    reveal: (file, line, start, end) => {
      const editor = view.current;
      if (!editor) return;
      if (shown.current !== file) {
        states.current.set(shown.current, editor.state);
        const next = states.current.get(file);
        if (!next) return;
        shown.current = file;
        editor.setState(withProblems(file, next));
      }
      const doc = editor.state.doc;
      const target = doc.line(Math.max(1, Math.min(line, doc.lines)));
      const anchor = start === undefined ? target.from : Math.min(target.to, target.from + start);
      const head = end === undefined ? anchor : Math.min(target.to, target.from + end);
      editor.dispatch({
        selection: { anchor, head },
        effects: [EditorView.scrollIntoView(anchor, { y: 'center' }), flashLine.of(target.from)],
      });
      editor.focus();
      window.setTimeout(() => view.current?.dispatch({ effects: flashLine.of(null) }), 1600);
    },
    splitBlock: () => {
      const editor = view.current;
      if (!editor) return false;
      const { state } = editor;
      const line = state.doc.lineAt(state.selection.main.head);
      const above = line.number > 1 ? state.doc.line(line.number - 1).text : '';
      // Not on a marker, and not right under one: the block above would be left empty.
      if (readMarker(line.text) || readMarker(above) || line.number === 1) return false;
      editor.dispatch({ changes: { from: line.from, insert: `${markerLine(newBlockId(), 'text')}\n` }, filter: false });
      return true;
    },
    cursorLine: () => {
      const editor = view.current;
      return editor ? editor.state.doc.lineAt(editor.state.selection.main.head).number : 1;
    },
  }));

  return <div ref={host} className="h-full min-h-0 overflow-hidden" />;
});

export default SourceEditor;
