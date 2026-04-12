import { useRef, useState, type KeyboardEvent } from 'react';
import { evaluate } from 'mathjs';

interface CalcEntry {
  expr: string;
  result: string;
}

/**
 * Translate user-friendly unicode math symbols into mathjs syntax so the
 * user can type or paste √, π, ÷, ×, − directly. The √ symbol is the only
 * tricky one — it needs the next operand wrapped in parentheses, e.g.
 * `√16` → `sqrt(16)`, `√(2+3)` → `sqrt(2+3)`, `√pi` → `sqrt(pi)`. If √ is
 * followed by nothing parseable, it falls back to a bare `sqrt(` so the
 * user can keep typing.
 */
function normalizeExpression(input: string): string {
  const s = input
    .replace(/÷/g, '/')
    .replace(/×/g, '*')
    .replace(/−/g, '-') // unicode minus → ASCII hyphen
    .replace(/π/g, 'pi');

  // Match √ followed (optionally) by a number, identifier, or balanced
  // (non-nested) paren group. The regex handles one level of parens; deep
  // nesting is rare in calculator input and the user can use the keypad
  // button which inserts `sqrt(` directly for those cases.
  return s.replace(
    /√\s*(\([^()]*\)|\d+(?:\.\d+)?|[a-zA-Z_][a-zA-Z0-9_]*)?/g,
    (_match, operand?: string) => {
      if (!operand) return 'sqrt(';
      if (operand.startsWith('(')) return `sqrt${operand}`;
      return `sqrt(${operand})`;
    }
  );
}

export function ScientificCalculator() {
  const [expr, setExpr] = useState('');
  const [history, setHistory] = useState<CalcEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  function tryEvaluate(input: string): { ok: true; value: string } | { ok: false; error: string } {
    if (!input.trim()) return { ok: true, value: '' };
    try {
      const result = evaluate(normalizeExpression(input));
      const out = typeof result === 'function' ? '(funksjon)' : String(result);
      return { ok: true, value: out };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Feil i uttrykket' };
    }
  }

  const evaluation = tryEvaluate(expr);
  const liveResult = evaluation.ok ? evaluation.value : null;
  const errorMsg = !evaluation.ok ? evaluation.error : null;

  function commit() {
    if (!expr.trim() || !evaluation.ok || !evaluation.value) return;
    setHistory((prev) => [{ expr, result: evaluation.value }, ...prev].slice(0, 12));
    setExpr('');
    inputRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    }
  }

  function appendKey(s: string) {
    const input = inputRef.current;
    if (!input) {
      setExpr((prev) => prev + s);
      return;
    }
    // Insert at the current caret position (or replace the current
    // selection). Read selection from the live DOM input rather than
    // relying on a react-tracked value, which doesn't expose selection.
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const newValue = input.value.slice(0, start) + s + input.value.slice(end);
    setExpr(newValue);
    // Restore the caret to just after the inserted text on the next
    // frame, after React has committed the new value to the DOM.
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const pos = start + s.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function clear() {
    setExpr('');
    inputRef.current?.focus();
  }

  function backspace() {
    setExpr((prev) => prev.slice(0, -1));
    inputRef.current?.focus();
  }

  function recall(entry: CalcEntry) {
    setExpr(entry.expr);
    inputRef.current?.focus();
  }

  // 6-column key grid: numbers + operators + common functions
  const KEYS: Array<{ label: string; insert?: string; action?: () => void; accent?: boolean; span?: number }> = [
    { label: '7', insert: '7' }, { label: '8', insert: '8' }, { label: '9', insert: '9' },
    { label: '÷', insert: '/' }, { label: '(', insert: '(' }, { label: ')', insert: ')' },

    { label: '4', insert: '4' }, { label: '5', insert: '5' }, { label: '6', insert: '6' },
    { label: '×', insert: '*' }, { label: '√', insert: '√' }, { label: 'π', insert: 'pi' },

    { label: '1', insert: '1' }, { label: '2', insert: '2' }, { label: '3', insert: '3' },
    { label: '−', insert: '-' }, { label: 'x²', insert: '^2' }, { label: 'xʸ', insert: '^' },

    { label: '0', insert: '0' }, { label: '.', insert: '.' }, { label: '%', insert: '%' },
    { label: '+', insert: '+' }, { label: 'sin', insert: 'sin(' }, { label: 'cos', insert: 'cos(' },

    { label: 'tan', insert: 'tan(' }, { label: 'log', insert: 'log10(' }, { label: 'ln', insert: 'log(' },
    { label: 'eˣ', insert: 'exp(' }, { label: 'e', insert: 'e' }, { label: '!', insert: '!' },

    { label: '⌫', action: backspace, span: 3 }, { label: 'C', action: clear, accent: true, span: 3 },
  ];

  return (
    <div>
      <div className="calc-input-box">
        <input
          ref={inputRef}
          className="calc-input"
          type="text"
          spellCheck={false}
          autoComplete="off"
          placeholder="Skriv et uttrykk…"
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus
        />
      </div>

      <div className="calc-output-box">
        <span className="calc-output-label">=</span>
        {errorMsg ? (
          <span className="calc-result error">{errorMsg}</span>
        ) : !expr.trim() ? (
          <span className="calc-result placeholder">resultat vises her</span>
        ) : (
          <span className="calc-result">{liveResult || '—'}</span>
        )}
      </div>

      <div className="calc-keys">
        {KEYS.map((k, i) => (
          <button
            key={i}
            type="button"
            className={`calc-key${k.accent ? ' accent' : ''}`}
            style={k.span ? { gridColumn: `span ${k.span}` } : undefined}
            onClick={() => (k.action ? k.action() : appendKey(k.insert!))}
            title={k.insert}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="calc-history">
        {history.length === 0 ? (
          <div className="calc-history-empty">Trykk Enter for å lagre resultatet i historikken.</div>
        ) : (
          history.map((h, i) => (
            <div
              key={i}
              className="calc-history-row"
              onClick={() => recall(h)}
              title="Klikk for å bruke på nytt"
            >
              <span className="calc-history-expr">{h.expr}</span>
              <span className="calc-history-result">= {h.result}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
