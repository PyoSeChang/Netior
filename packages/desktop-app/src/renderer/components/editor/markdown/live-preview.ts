/**
 * Obsidian-style live preview for CodeMirror 6.
 *
 * markPlugin:     Decoration.mark/line — styling (always)
 * replacePlugin:  Decoration.replace — conceal syntax (non-cursor lines, single-line only)
 * tableField:     StateField — table block replace (multi-line, requires StateField)
 * checkboxPlugin: capture-phase mousedown — toggles checkboxes before CM6 steals focus
 * linkHandler:    click handler — opens links
 */

import {
  ViewPlugin,
  Decoration,
  type DecorationSet,
  type ViewUpdate,
  EditorView,
  WidgetType,
} from '@codemirror/view';
import { type EditorState, type Range, StateField } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

// ══════════════════════════════════════
//  WIDGETS
// ══════════════════════════════════════

class BulletWidget extends WidgetType {
  toDOM() {
    const s = document.createElement('span');
    s.className = 'md-bullet';
    s.textContent = '•';
    return s;
  }
}

class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean, readonly lineFrom: number) { super(); }
  eq(o: CheckboxWidget) { return this.checked === o.checked && this.lineFrom === o.lineFrom; }
  toDOM() {
    const w = document.createElement('span');
    w.className = 'md-checkbox-wrapper';
    w.dataset.lineFrom = String(this.lineFrom);

    const box = document.createElement('span');
    box.className = `md-checkbox ${this.checked ? 'md-checkbox-checked' : ''}`;

    if (this.checked) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '11');
      svg.setAttribute('height', '11');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '3');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', 'M20 6 9 17l-5-5');
      svg.appendChild(p);
      box.appendChild(svg);
    }

    w.appendChild(box);
    return w;
  }
  ignoreEvent() { return true; }
}

class HrWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement('hr');
    hr.className = 'md-hr-line';
    return hr;
  }
}

class TableWidget extends WidgetType {
  constructor(readonly text: string) { super(); }
  eq(o: TableWidget) { return this.text === o.text; }
  toDOM() {
    const rows = this.text.split('\n').filter(l => l.trim());
    if (rows.length < 2) { const s = document.createElement('span'); s.textContent = this.text; return s; }

    const parseRow = (row: string): string[] =>
      row.split('|').map(c => c.trim()).filter((c, i, a) => !(i === 0 && c === '') && !(i === a.length - 1 && c === ''));

    const table = document.createElement('table');
    table.className = 'md-table';

    const thead = document.createElement('thead');
    const tr = document.createElement('tr');
    for (const cell of parseRow(rows[0])) {
      const th = document.createElement('th');
      th.textContent = cell;
      tr.appendChild(th);
    }
    thead.appendChild(tr);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (let i = 2; i < rows.length; i++) {
      const row = document.createElement('tr');
      for (const cell of parseRow(rows[i])) {
        const td = document.createElement('td');
        td.textContent = cell;
        row.appendChild(td);
      }
      tbody.appendChild(row);
    }
    table.appendChild(tbody);

    const w = document.createElement('div');
    w.className = 'md-table-wrapper';
    w.appendChild(table);
    return w;
  }
  ignoreEvent() { return false; }
}

// ══════════════════════════════════════
//  REUSABLE DECORATIONS
// ══════════════════════════════════════

const hMark: Record<number, Decoration> = {
  1: Decoration.mark({ class: 'md-h1' }), 2: Decoration.mark({ class: 'md-h2' }),
  3: Decoration.mark({ class: 'md-h3' }), 4: Decoration.mark({ class: 'md-h4' }),
  5: Decoration.mark({ class: 'md-h5' }), 6: Decoration.mark({ class: 'md-h6' }),
};
const boldD = Decoration.mark({ class: 'md-bold' });
const italicD = Decoration.mark({ class: 'md-italic' });
const strikeD = Decoration.mark({ class: 'md-strikethrough' });
const icodeD = Decoration.mark({ class: 'md-inline-code' });
const imgAltD = Decoration.mark({ class: 'md-image-alt' });
const bqLineD = Decoration.line({ class: 'md-blockquote-line' });
const codeLineD = Decoration.line({ class: 'md-code-line' });
const hide = Decoration.replace({});

// ══════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════

function focusedLines(state: EditorState): Set<number> {
  const s = new Set<number>();
  for (const r of state.selection.ranges) {
    const a = state.doc.lineAt(r.from).number, b = state.doc.lineAt(r.to).number;
    for (let i = a; i <= b; i++) s.add(i);
  }
  return s;
}

function addLineDecos(state: EditorState, from: number, to: number, d: Decoration, out: Range<Decoration>[]) {
  const a = state.doc.lineAt(from).number, b = state.doc.lineAt(to).number;
  for (let i = a; i <= b; i++) out.push(d.range(state.doc.line(i).from));
}

// ══════════════════════════════════════
//  BUILD MARK + INLINE REPLACE DECOS
//  (single-line replaces only — safe for ViewPlugin)
// ══════════════════════════════════════

interface MR { marks: DecorationSet; reps: DecorationSet }

function buildMR(view: EditorView): MR {
  const { state } = view;
  const fl = focusedLines(state);
  const m: Range<Decoration>[] = [];
  const r: Range<Decoration>[] = [];
  let inCode = false;

  syntaxTree(state).iterate({
    enter(nd) {
      const n = nd.name;

      // ── Fenced code ──
      if (n === 'FencedCode') { inCode = true; addLineDecos(state, nd.from, nd.to, codeLineD, m); return; }
      if (n === 'CodeMark' && inCode) {
        const ln = state.doc.lineAt(nd.from).number;
        if (!fl.has(ln)) { const line = state.doc.line(ln); r.push(hide.range(line.from, line.to)); }
        return;
      }
      if (n === 'CodeInfo' || inCode) return;

      // ── Table — skip here, handled by StateField ──
      if (n === 'Table') return false;

      const ln = state.doc.lineAt(nd.from).number;
      const f = fl.has(ln);

      // ── Heading ──
      if (/^ATXHeading\d$/.test(n)) {
        const lv = parseInt(n.charAt(n.length - 1), 10);
        if (hMark[lv]) { const line = state.doc.lineAt(nd.from); m.push(hMark[lv].range(line.from, line.to)); }
      }
      if (n === 'HeaderMark' && !f) {
        const end = state.doc.sliceString(nd.to, nd.to + 1) === ' ' ? nd.to + 1 : nd.to;
        r.push(hide.range(nd.from, end));
      }

      // ── Bold ──
      if (n === 'StrongEmphasis') {
        m.push(boldD.range(nd.from, nd.to));
        if (!f) {
          const t = state.doc.sliceString(nd.from, nd.from + 3);
          const ml = (t.startsWith('***') || t.startsWith('___')) ? 3 : 2;
          r.push(hide.range(nd.from, nd.from + ml)); r.push(hide.range(nd.to - ml, nd.to));
        }
      }

      // ── Italic ──
      if (n === 'Emphasis') {
        m.push(italicD.range(nd.from, nd.to));
        if (!f) { r.push(hide.range(nd.from, nd.from + 1)); r.push(hide.range(nd.to - 1, nd.to)); }
      }

      // ── Strikethrough ──
      if (n === 'Strikethrough') {
        m.push(strikeD.range(nd.from, nd.to));
        if (!f) { r.push(hide.range(nd.from, nd.from + 2)); r.push(hide.range(nd.to - 2, nd.to)); }
      }

      // ── Inline code ──
      if (n === 'InlineCode') {
        m.push(icodeD.range(nd.from, nd.to));
        if (!f) { r.push(hide.range(nd.from, nd.from + 1)); r.push(hide.range(nd.to - 1, nd.to)); }
      }

      // ── Link ──
      if (n === 'Link') {
        const lm: { from: number; to: number }[] = [];
        let uF = -1, uT = -1;
        const c = nd.node.cursor();
        if (c.firstChild()) { do { if (c.name === 'LinkMark') lm.push({ from: c.from, to: c.to }); if (c.name === 'URL') { uF = c.from; uT = c.to; } } while (c.nextSibling()); }
        if (lm.length >= 2) {
          const tF = lm[0].to, tT = lm[1].from;
          if (tF < tT) {
            const url = uF >= 0 ? state.doc.sliceString(uF, uT) : '';
            m.push(Decoration.mark({ class: 'md-link', attributes: { 'data-href': url } }).range(tF, tT));
            if (!f) { r.push(hide.range(nd.from, tF)); r.push(hide.range(tT, nd.to)); }
          }
        }
      }

      // ── Image ──
      if (n === 'Image') {
        const lm: { from: number; to: number }[] = [];
        const c = nd.node.cursor();
        if (c.firstChild()) { do { if (c.name === 'LinkMark') lm.push({ from: c.from, to: c.to }); } while (c.nextSibling()); }
        if (lm.length >= 2) {
          const aF = lm[0].to, aT = lm[1].from;
          if (aF < aT) { m.push(imgAltD.range(aF, aT)); if (!f) { r.push(hide.range(nd.from, aF)); r.push(hide.range(aT, nd.to)); } }
        }
      }

      // ── Blockquote ──
      if (n === 'Blockquote') addLineDecos(state, nd.from, nd.to, bqLineD, m);
      if (n === 'QuoteMark' && !f) {
        const end = state.doc.sliceString(nd.to, nd.to + 1) === ' ' ? nd.to + 1 : nd.to;
        r.push(hide.range(nd.from, end));
      }

      // ── HR ──
      if (n === 'HorizontalRule' && !f) r.push(Decoration.replace({ widget: new HrWidget() }).range(nd.from, nd.to));

      // ── Lists ──
      if (n === 'ListMark' && !f) {
        const mt = state.doc.sliceString(nd.from, nd.to);
        const after = state.doc.sliceString(nd.to, nd.to + 5);
        const task = after.match(/^ \[([xX ])\]/);
        if (task) {
          const checked = task[1] !== ' ';
          const endOff = state.doc.sliceString(nd.to + 4, nd.to + 5) === ' ' ? 5 : 4;
          r.push(Decoration.replace({ widget: new CheckboxWidget(checked, state.doc.lineAt(nd.from).from) }).range(nd.from, nd.to + endOff));
          return;
        }
        if (mt === '-' || mt === '*' || mt === '+') {
          const end = state.doc.sliceString(nd.to, nd.to + 1) === ' ' ? nd.to + 1 : nd.to;
          r.push(Decoration.replace({ widget: new BulletWidget() }).range(nd.from, end));
          return;
        }
        m.push(Decoration.mark({ class: 'md-list-marker' }).range(nd.from, nd.to));
      }
    },
    leave(nd) { if (nd.name === 'FencedCode') inCode = false; },
  });

  return { marks: Decoration.set(m, true), reps: Decoration.set(r, true) };
}

// ── Cache ──
let ck = ''; let cc: MR = { marks: Decoration.none, reps: Decoration.none };
function getMR(v: EditorView): MR {
  const k = `${v.state.doc.length}:${v.state.selection.main.head}:${v.state.selection.main.anchor}`;
  if (k !== ck) { ck = k; cc = buildMR(v); } return cc;
}

// ══════════════════════════════════════
//  TABLE STATE FIELD (block replace, multi-line)
// ══════════════════════════════════════

function buildTableDecos(state: EditorState): DecorationSet {
  const fl = focusedLines(state);
  const decos: Range<Decoration>[] = [];

  syntaxTree(state).iterate({
    enter(nd) {
      if (nd.name !== 'Table') return;
      const ts = state.doc.lineAt(nd.from).number;
      const te = state.doc.lineAt(nd.to).number;
      let anyFocused = false;
      for (let i = ts; i <= te; i++) { if (fl.has(i)) { anyFocused = true; break; } }

      if (!anyFocused) {
        const text = state.doc.sliceString(nd.from, nd.to);
        decos.push(Decoration.replace({ widget: new TableWidget(text), block: true }).range(nd.from, nd.to));
      }
      return false; // skip children
    },
  });

  return Decoration.set(decos, true);
}

const tableField = StateField.define<DecorationSet>({
  create(state) { return buildTableDecos(state); },
  update(decos, tr) {
    if (tr.docChanged || tr.selection) return buildTableDecos(tr.state);
    return decos;
  },
  provide: f => EditorView.decorations.from(f),
});

// ══════════════════════════════════════
//  CHECKBOX CLICK (capture phase)
// ══════════════════════════════════════

const checkboxPlugin = ViewPlugin.fromClass(class {
  view: EditorView;
  handler: (e: MouseEvent) => void;

  constructor(view: EditorView) {
    this.view = view;
    this.handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const w = t.closest('.md-checkbox-wrapper');
      if (!w) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const lineFrom = parseInt(w.getAttribute('data-line-from') ?? '', 10);
      if (isNaN(lineFrom)) return;
      const line = this.view.state.doc.lineAt(lineFrom);
      const text = line.text;
      const ui = text.indexOf('[ ]');
      const ci = text.search(/\[[xX]\]/);
      if (ui >= 0) this.view.dispatch({ changes: { from: line.from + ui, to: line.from + ui + 3, insert: '[x]' } });
      else if (ci >= 0) this.view.dispatch({ changes: { from: line.from + ci, to: line.from + ci + 3, insert: '[ ]' } });
    };
    view.dom.addEventListener('mousedown', this.handler, true); // CAPTURE phase
  }

  update() {}
  destroy() { this.view.dom.removeEventListener('mousedown', this.handler, true); }
});

// ══════════════════════════════════════
//  LINK CLICK
// ══════════════════════════════════════

const linkHandler = EditorView.domEventHandlers({
  click(e) {
    const el = (e.target as HTMLElement).closest('.md-link');
    if (!el) return false;
    const href = el.getAttribute('data-href');
    if (href) { e.preventDefault(); window.open(href, '_blank'); return true; }
    return false;
  },
});

// ══════════════════════════════════════
//  MARK + REPLACE PLUGINS
// ══════════════════════════════════════

const markPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(v: EditorView) { this.decorations = getMR(v).marks; }
    update(u: ViewUpdate) { if (u.docChanged || u.selectionSet || u.viewportChanged) { ck = ''; this.decorations = getMR(u.view).marks; } }
  },
  { decorations: v => v.decorations },
);

const replacePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(v: EditorView) { this.decorations = getMR(v).reps; }
    update(u: ViewUpdate) { if (u.docChanged || u.selectionSet || u.viewportChanged) { this.decorations = getMR(u.view).reps; } }
  },
  { decorations: v => v.decorations },
);

// ══════════════════════════════════════
//  EXPORT
// ══════════════════════════════════════

export const livePreviewPlugin = [markPlugin, replacePlugin, tableField, checkboxPlugin, linkHandler];

// ══════════════════════════════════════
//  THEME
// ══════════════════════════════════════

export const livePreviewTheme = EditorView.theme({
  '.md-h1': { fontSize: '1.8em', fontWeight: '700', lineHeight: '1.4' },
  '.md-h2': { fontSize: '1.5em', fontWeight: '700', lineHeight: '1.4' },
  '.md-h3': { fontSize: '1.25em', fontWeight: '600', lineHeight: '1.4' },
  '.md-h4': { fontSize: '1.1em', fontWeight: '600', lineHeight: '1.4' },
  '.md-h5': { fontSize: '1.05em', fontWeight: '600', lineHeight: '1.4' },
  '.md-h6': { fontSize: '1em', fontWeight: '500', opacity: '0.7', lineHeight: '1.4' },

  '.md-bold': { fontWeight: '700' },
  '.md-italic': { fontStyle: 'italic' },
  '.md-strikethrough': { textDecoration: 'line-through', opacity: '0.5' },
  '.md-inline-code': {
    fontFamily: '"SF Mono", Monaco, "Cascadia Code", Consolas, monospace',
    fontSize: '0.9em', backgroundColor: 'var(--surface-base)', borderRadius: '3px', padding: '1px 4px',
  },

  '.md-link': { color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer' },
  '.md-image-alt': { color: 'var(--accent)', fontStyle: 'italic' },

  '.md-blockquote-line': { borderLeft: '3px solid var(--border-default)', paddingLeft: '12px', opacity: '0.85' },

  '.md-code-line': {
    backgroundColor: 'var(--surface-base)',
    fontFamily: '"SF Mono", Monaco, "Cascadia Code", Consolas, monospace',
    fontSize: '0.9em',
  },

  '.md-hr-line': { border: 'none', borderTop: '1px solid var(--border-default)', margin: '0.5em 0' },

  '.md-list-marker': { color: 'var(--text-muted)' },
  '.md-bullet': { color: 'var(--text-muted)', paddingRight: '4px' },

  '.md-checkbox-wrapper': {
    display: 'inline-flex', alignItems: 'center', paddingRight: '6px',
    cursor: 'pointer', verticalAlign: 'middle',
  },
  '.md-checkbox': {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: '16px', height: '16px', borderRadius: '3px',
    border: '1px solid var(--border-subtle)', backgroundColor: 'transparent',
    color: 'transparent', transition: 'all 150ms',
  },
  '.md-checkbox:hover': { borderColor: 'var(--border-default)' },
  '.md-checkbox-checked': { backgroundColor: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--text-on-accent)' },

  '.md-table-wrapper': { overflow: 'auto', margin: '4px 0' },
  '.md-table': { width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' },
  '.md-table th, .md-table td': { border: '1px solid var(--border-subtle)', padding: '6px 12px', textAlign: 'left' },
  '.md-table th': { fontWeight: '600', backgroundColor: 'var(--surface-base)' },
});
