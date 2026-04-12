import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useCreateNote,
  useDeleteNote,
  useNotes,
  useUpdateNote,
} from '@/hooks/useNotes';
import type { Note } from '@/api/types';
import { cn } from '@/lib/cn';

const AUTOSAVE_MS = 600;

/** Font choices offered in the format toolbar's font picker. The `value`
 *  is what gets written into the note's HTML, so it must be a valid CSS
 *  font-family stack. */
const NOTE_FONTS: { label: string; value: string }[] = [
  { label: 'Sans',       value: 'system-ui, sans-serif' },
  { label: 'Serif',      value: 'Georgia, Cambria, serif' },
  { label: 'Mono',       value: 'ui-monospace, "JetBrains Mono", Menlo, monospace' },
  { label: 'Helvetica',  value: 'Helvetica, Arial, sans-serif' },
  { label: 'Courier',    value: '"Courier New", Courier, monospace' },
  { label: 'Times',      value: '"Times New Roman", Times, serif' },
];

/**
 * Notes page — faithful port of notes.html.
 *
 * Layout: 260px sidebar list + flex editor panel.
 *   List header: title + "Ny" button
 *   Editor: title input + delete button + format toolbar + contenteditable body
 *   Body uses contenteditable with execCommand for B/I/U/color/size/HR
 *   PDF download = window.print() with the print stylesheet hiding everything
 *   except the editor body.
 */
export function NotesPage() {
  const { data: notes } = useNotes();
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [textColor, setTextColor] = useState('#e8e8e2');
  const [currentFont, setCurrentFont] = useState<string>('');
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<number | null>(null);
  const [savedVisible, setSavedVisible] = useState(false);

  const sorted = useMemo(() => {
    if (!notes) return [];
    // updatedAt may be a number (legacy Date.now()) or a string. Coerce to
    // a comparable numeric timestamp before sorting.
    const ts = (n: Note) =>
      typeof n.updatedAt === 'number' ? n.updatedAt : new Date(n.updatedAt).getTime();
    return [...notes].sort((a, b) => ts(b) - ts(a));
  }, [notes]);

  const activeNote = sorted.find((n) => n.id === activeId) ?? null;

  // Hydrate editor when active note changes.
  useEffect(() => {
    setDraftTitle(activeNote?.title ?? '');
    if (editorRef.current) {
      editorRef.current.innerHTML = activeNote?.body ?? '';
    }
  }, [activeNote?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track which font the cursor is currently inside so the font picker
  // can show that font as its selected value (instead of always
  // displaying the placeholder "Skrift"). We walk up from the selection
  // anchor looking for the nearest ancestor with an inline font-family
  // — that's how applyFontFamily writes the value into the markup.
  useEffect(() => {
    function update() {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        setCurrentFont('');
        return;
      }
      let node: Node | null = sel.anchorNode;
      if (!node) {
        setCurrentFont('');
        return;
      }
      if (!editorRef.current?.contains(node)) {
        // Selection isn't inside our editor — leave the picker unchanged.
        return;
      }
      let el: HTMLElement | null =
        node.nodeType === Node.TEXT_NODE
          ? (node.parentElement as HTMLElement | null)
          : (node as HTMLElement);
      while (el && editorRef.current?.contains(el)) {
        const ff = el.style?.fontFamily;
        if (ff) {
          setCurrentFont(ff);
          return;
        }
        el = el.parentElement;
      }
      setCurrentFont('');
    }
    document.addEventListener('selectionchange', update);
    return () => document.removeEventListener('selectionchange', update);
  }, []);

  // Match the current font against NOTE_FONTS so we can drive the
  // controlled <select>'s value. Browsers normalize font-family
  // strings (whitespace, quoting), so we strip both sides for compare.
  const matchedFontValue = useMemo(() => {
    if (!currentFont) return '';
    const norm = (s: string) =>
      s.replace(/['"]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
    const cur = norm(currentFont);
    return NOTE_FONTS.find((f) => norm(f.value) === cur)?.value ?? '';
  }, [currentFont]);

  function scheduleSave() {
    if (!activeNote) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      const body = editorRef.current?.innerHTML ?? '';
      updateNote.mutate(
        {
          id: activeNote.id,
          patch: {
            title: draftTitle,
            body,
            updatedAt: Date.now(),
          },
        },
        {
          onSuccess: () => {
            setSavedVisible(true);
            window.setTimeout(() => setSavedVisible(false), 1200);
          },
        }
      );
    }, AUTOSAVE_MS);
  }

  function handleNew() {
    // Match the legacy createNote: client generates an id, sends an empty
    // title/body, and uses a numeric `Date.now()` for updatedAt.
    const id = `note_${Date.now()}`;
    createNote.mutate(
      {
        id,
        title: '',
        body: '',
        updatedAt: Date.now(),
      } as unknown as Omit<Note, 'id'>,
      {
        onSuccess: () => setActiveId(id),
      }
    );
  }

  function handleDelete() {
    if (!activeNote) return;
    if (!confirm(`Slette «${activeNote.title}»?`)) return;
    deleteNote.mutate(activeNote.id, {
      onSuccess: () => setActiveId(null),
    });
  }

  // ── Format commands (execCommand is deprecated but still works) ──────
  function fmtCmd(cmd: string, value?: string) {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
    scheduleSave();
  }
  function applyFontSize(size: string) {
    document.execCommand('fontSize', false, '7');
    // Browsers normalize fontSize to <font size="7">. Replace with span.
    const fontEls = editorRef.current?.querySelectorAll('font[size="7"]');
    fontEls?.forEach((el) => {
      const span = document.createElement('span');
      span.style.fontSize = `${size}px`;
      span.innerHTML = (el as HTMLElement).innerHTML;
      el.replaceWith(span);
    });
    scheduleSave();
  }
  function applyColor(color: string) {
    setTextColor(color);
    document.execCommand('foreColor', false, color);
    scheduleSave();
  }
  function applyFontFamily(family: string) {
    // execCommand('fontName') wraps the selection in <font face="...">.
    // Browsers still implement this even though execCommand is deprecated.
    // Afterwards we walk the editor and rewrite ANY <font face="..."> we
    // find into a <span style="font-family: ...">, so the markup stays
    // portable (and survives copy/paste / re-renders without needing
    // <font> support).
    document.execCommand('fontName', false, family);
    const fontEls = editorRef.current?.querySelectorAll('font[face]');
    fontEls?.forEach((el) => {
      const span = document.createElement('span');
      span.style.fontFamily = (el as HTMLElement).getAttribute('face') || family;
      span.innerHTML = (el as HTMLElement).innerHTML;
      el.replaceWith(span);
    });
    editorRef.current?.focus();
    scheduleSave();
  }
  function insertHR() {
    document.execCommand('insertHTML', false, '<hr>');
    scheduleSave();
  }
  function downloadPDF() {
    window.print();
  }

  return (
    <div className="notes-shell">
      <div className="notes-list-panel">
        <div className="notes-list-header">
          <span className="notes-list-title">Notater</span>
          <button className="notes-btn-new" onClick={handleNew}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Ny
          </button>
        </div>
        <div className="notes-list">
          {sorted.length === 0 ? (
            <div className="notes-empty-state">
              Ingen notater ennå.
              <br />
              Klikk «Ny» for å begynne.
            </div>
          ) : (
            sorted.map((n) => (
              <NoteListItem
                key={n.id}
                note={n}
                active={n.id === activeId}
                onClick={() => setActiveId(n.id)}
              />
            ))
          )}
        </div>
      </div>

      <div className="notes-editor-panel">
        {activeNote ? (
          <>
            <div className="editor-toolbar">
              <input
                className="editor-title-input"
                type="text"
                placeholder="Tittel…"
                value={draftTitle}
                onChange={(e) => {
                  setDraftTitle(e.target.value);
                  scheduleSave();
                }}
              />
              <div className="editor-actions">
                <span
                  className="editor-saved-label"
                  style={{ opacity: savedVisible ? 1 : 0 }}
                >
                  Lagret
                </span>
                <button className="btn-delete-notes" onClick={handleDelete}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6m4-6v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                  Slett
                </button>
              </div>
            </div>

            <div className="format-toolbar">
              <select
                className="fmt-select fmt-select-font"
                title="Skrifttype"
                value={matchedFontValue}
                onChange={(e) => {
                  if (e.target.value) applyFontFamily(e.target.value);
                }}
              >
                <option value="" disabled>Skrift</option>
                {NOTE_FONTS.map((f) => (
                  <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                    {f.label}
                  </option>
                ))}
              </select>
              <div className="fmt-sep" />
              <select
                className="fmt-select"
                title="Skriftstørrelse"
                defaultValue="16"
                onChange={(e) => applyFontSize(e.target.value)}
              >
                {[10, 12, 14, 16, 18, 20, 24, 32, 48].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <div className="fmt-sep" />
              <button className="fmt-btn" onClick={() => fmtCmd('bold')} title="Fet (Ctrl+B)">
                <b>B</b>
              </button>
              <button className="fmt-btn" onClick={() => fmtCmd('italic')} title="Kursiv (Ctrl+I)">
                <i>I</i>
              </button>
              <button className="fmt-btn" onClick={() => fmtCmd('underline')} title="Understreking (Ctrl+U)">
                <u>U</u>
              </button>
              <div className="fmt-sep" />
              <div className="fmt-color-wrap" title="Tekstfarge">
                <div className="fmt-color-swatch">
                  <span className="fmt-color-letter">A</span>
                  <div className="fmt-color-bar" style={{ background: textColor }} />
                </div>
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => applyColor(e.target.value)}
                />
              </div>
              <div className="fmt-sep" />
              <button className="fmt-btn" onClick={insertHR} title="Skillelinje">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="12" x2="21" y2="12" />
                </svg>
              </button>
              <div className="fmt-sep" />
              <button
                className="fmt-btn"
                onClick={downloadPDF}
                title="Last ned som PDF"
                style={{ width: 'auto', padding: '0 8px', gap: 5, fontSize: '0.74rem' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                PDF
              </button>
            </div>

            <div className="editor-body">
              <div
                id="editor-body"
                ref={editorRef}
                className="editor-content"
                contentEditable
                suppressContentEditableWarning
                data-placeholder="Skriv her…"
                onInput={scheduleSave}
              />
            </div>
          </>
        ) : (
          <div className="no-note-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 18h12v-2H3v2zm0-5h12v-2H3v2zm0-7v2h12V6H3zm14 9.34V7h-2v11.34l1 .66 1-.66z" />
            </svg>
            <p>
              Ingen notat valgt.
              <br />
              Opprett et nytt eller velg et fra listen.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── List item ───────────────────────────────────────────────────────────── */
function NoteListItem({
  note,
  active,
  onClick,
}: {
  note: Note;
  active: boolean;
  onClick: () => void;
}) {
  const preview = stripHtml(note.body).slice(0, 80) || '—';
  const ts = typeof note.updatedAt === 'number' ? note.updatedAt : new Date(note.updatedAt).getTime();
  const date = new Date(ts);
  return (
    <div className={cn('note-item', active && 'active')} onClick={onClick}>
      <div className="note-item-title">{note.title || 'Uten tittel'}</div>
      <div className="note-item-preview">{preview}</div>
      <div className="note-item-date">{formatNoteDate(date)}</div>
    </div>
  );
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function formatNoteDate(date: Date): string {
  const ageMs = Date.now() - date.getTime();
  const min = ageMs / 60_000;
  const hr = min / 60;
  if (min < 1) return 'Akkurat nå';
  if (min < 60) return `${Math.round(min)} min siden`;
  if (hr < 24) return `${Math.round(hr)} t siden`;
  return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
}
