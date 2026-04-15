import { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useSkole } from '@/hooks/useSkole';
import type { SkoleAssignment, SkoleCourse } from '@/api/types';
import { PdfViewer } from '@/components/patterns';
import { cn } from '@/lib/cn';

const GITHUB_USER_REPO = 'PDP2026/labs-Maxaubert';
const GITHUB_COURSE_REPO = 'PDP2026/labs';
const DAY_NAMES_SHORT = ['SØN', 'MAN', 'TIR', 'ONS', 'TOR', 'FRE', 'LØR'];

interface AssignmentSource {
  title: string;
  myUrl?: string;
  assignUrl?: string;
  pdfLab?: number;
  canvasUrl?: string;
}

export function SkolePage() {
  const { data, isLoading, error } = useSkole();
  const [openAssignment, setOpenAssignment] = useState<AssignmentSource | null>(null);
  const [openPdf, setOpenPdf] = useState<{ title: string; lab: number } | null>(null);

  const lastUpdated = useMemo(() => {
    const d = new Date();
    return `Oppdatert ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="skole-page">
      <div className="skole-title-desktop">
        <span className="skole-title-main">Skole</span>
        <span className="skole-title-sub">{lastUpdated}</span>
      </div>

      {/* Course panels */}
      <div className="skole-section">
        <div className="skole-section-header">
          <div className="skole-section-dot" style={{ background: '#888' }} />
          <div className="skole-section-title">Emner</div>
        </div>

        {error ? (
          <div className="skole-empty-state">
            <div className="skole-empty-label">Kunne ikke laste emner</div>
          </div>
        ) : isLoading || !data ? (
          <div className="skole-empty-state">
            <div className="skole-empty-label">Laster…</div>
          </div>
        ) : (
          <div className="course-panels">
            {data.courses.map((course) => (
              <CoursePanel
                key={course.id}
                course={course}
                onAssignment={(detail) => {
                  // Single-source assignments skip the modal.
                  if (
                    detail.pdfLab !== undefined &&
                    !detail.myUrl &&
                    !detail.assignUrl &&
                    !detail.canvasUrl
                  ) {
                    setOpenPdf({ title: detail.title, lab: detail.pdfLab });
                    return;
                  }
                  setOpenAssignment(detail);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Announcements */}
      <div className="skole-section">
        <div className="skole-section-header">
          <div className="skole-section-dot" style={{ background: '#60a5fa' }} />
          <div className="skole-section-title">Kunngjøringer — siste 7 dager</div>
        </div>
        <div className="ann-list">
          {!data || data.announcements.length === 0 ? (
            <div className="skole-empty-state">
              <div className="skole-empty-label">Ingen kunngjøringer siste 7 dager</div>
            </div>
          ) : (
            data.announcements.map((a, i) => (
              <a
                key={i}
                href={a.html_url}
                target="_blank"
                rel="noreferrer noopener"
                className="ann-link"
              >
                <div className="ann-card">
                  <div className="ann-head">
                    <span
                      className="ann-tag"
                      style={{ color: a.course_color, borderColor: `${a.course_color}33` }}
                    >
                      {a.course_short}
                    </span>
                    <span className="ann-title">{a.title}</span>
                    <span className="ann-date">{formatAnnounceDate(a.posted_at)}</span>
                  </div>
                </div>
              </a>
            ))
          )}
        </div>
      </div>

      {openAssignment && (
        <AssignmentModal
          detail={openAssignment}
          onClose={() => setOpenAssignment(null)}
          onPdf={(p) => {
            setOpenAssignment(null);
            setOpenPdf(p);
          }}
        />
      )}

      {openPdf && (
        <PdfModal
          title={openPdf.title}
          lab={openPdf.lab}
          onClose={() => setOpenPdf(null)}
        />
      )}
    </div>
  );
}

/* ── Course panel ────────────────────────────────────────────────────────── */
interface CoursePanelProps {
  course: SkoleCourse;
  onAssignment: (detail: AssignmentSource) => void;
}

function CoursePanel({ course, onAssignment }: CoursePanelProps) {
  const pending = useMemo(
    () =>
      course.assignments
        .filter((a) => !a.submitted)
        .sort((a, b) => (a.due_at ?? 'z').localeCompare(b.due_at ?? 'z')),
    [course.assignments]
  );
  const next = pending[0];
  const progressPct = course.total > 0 ? (course.submitted / course.total) * 100 : 0;

  return (
    <div className="cp" data-course-id={course.id}>
      <div className="cp-header">
        <div className="cp-hrow">
          <div className="cp-dot" style={{ background: course.color }} />
          <div className="cp-name">{course.name}</div>
        </div>
        <div className="cp-bar-wrap">
          <div
            className="cp-bar-fill"
            style={{ width: `${progressPct}%`, background: course.color }}
          />
        </div>
        <div className="cp-footer">
          <span className="cp-ratio">
            {course.submitted}/{course.total} levert
          </span>
          {pending.length > 0 ? (
            <span className="cp-pending">{pending.length} gjenstår</span>
          ) : (
            <span className="cp-done-tag">Alt levert ✓</span>
          )}
        </div>
      </div>

      <div className="cp-body">
        {next && (
          <>
            <div className="cp-section-lbl">Neste innlevering</div>
            <AssignmentCard
              assignment={next}
              course={course}
              onClick={() => onAssignment(buildAssignmentSource(next, course))}
            />
          </>
        )}

        <div className="cp-section-lbl" style={{ marginTop: 18 }}>Canvas</div>
        <div className="cp-links">
          <a
            className="cp-link-btn"
            href={`https://hiof.instructure.com/courses/${course.id}/assignments`}
            target="_blank"
            rel="noreferrer noopener"
          >
            <span className="cp-link-icon green">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" />
              </svg>
            </span>
            <span className="cp-link-label">Canvas</span>
            <span className="cp-link-ext">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </span>
          </a>
        </div>

        {course.short === 'PARA' && (
          <>
            <div className="cp-section-lbl" style={{ marginTop: 18 }}>Kursmateriell</div>
            <div className="cp-links">
              <a
                className="cp-link-btn"
                href="https://github.com/PDP2026"
                target="_blank"
                rel="noreferrer noopener"
              >
                <span className="cp-link-icon orange">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                </span>
                <span className="cp-link-label">PDP2026 GitHub</span>
                <span className="cp-link-ext">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </span>
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Assignment card ─────────────────────────────────────────────────────── */
interface AssignmentCardProps {
  assignment: SkoleAssignment;
  course: SkoleCourse;
  onClick: () => void;
}

function AssignmentCard({ assignment, course, onClick }: AssignmentCardProps) {
  const due = assignment.due_at ? formatDue(assignment.due_at) : null;
  const cls =
    !due ? '' :
    due.tone === 'overdue' ? 'overdue' :
    due.tone === 'urgent' ? 'urgent' :
    due.tone === 'soon' ? 'soon' : '';

  return (
    <div
      className={cn('assign-card', cls)}
      style={{ ['--bar-color' as string]: course.color }}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className="assign-due-col">
        {due && (
          <>
            <div className={cn('assign-due-top', cls)}>{due.top}</div>
            <div className={cn('assign-due-main', cls)}>{due.main}</div>
          </>
        )}
      </div>
      <div className="assign-body">
        <div className="assign-title">{assignment.title}</div>
        <div className="assign-meta">
          <span
            className="assign-course-tag"
            style={{ color: course.color, borderColor: `${course.color}33` }}
          >
            {course.short}
          </span>
        </div>
      </div>
      <svg
        className="assign-arrow"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </div>
  );
}

function buildAssignmentSource(a: SkoleAssignment, course: SkoleCourse): AssignmentSource {
  const detail: AssignmentSource = {
    title: a.title,
    canvasUrl: a.html_url,
  };
  const labMatch = a.title.trim().toLowerCase().match(/^lab(\d+)$/);
  if (labMatch && course.short === 'PARA') {
    const num = Number(labMatch[1]);
    detail.myUrl = `https://github.com/${GITHUB_USER_REPO}/tree/main/lab${num}`;
    detail.assignUrl = `https://github.com/${GITHUB_COURSE_REPO}/tree/main/lab${num}`;
    detail.pdfLab = num;
  }
  return detail;
}

/* ── Lab modal — uses sport-modal styles (identical 340px design) ──────── */
function AssignmentModal({
  detail,
  onClose,
  onPdf,
}: {
  detail: AssignmentSource;
  onClose: () => void;
  onPdf: (pdf: { title: string; lab: number }) => void;
}) {
  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="sport-modal-overlay" />
        <Dialog.Content className="sport-modal">
          <Dialog.Close asChild>
            <button className="sport-modal-close" aria-label="Lukk">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </Dialog.Close>
          <div className="sport-modal-label">Åpne lab</div>
          <Dialog.Title className="sport-modal-title">{detail.title}</Dialog.Title>
          <Dialog.Description className="sr-only">Velg en kilde</Dialog.Description>
          <div className="sport-modal-sources">
            {detail.myUrl && (
              <a className="source-btn nrk" href={detail.myUrl} target="_blank" rel="noreferrer noopener">
                <span className="src-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                </span>
                <span className="src-name">Min repo</span>
                <ExtIcon />
              </a>
            )}
            {detail.assignUrl && (
              <a className="source-btn tv2" href={detail.assignUrl} target="_blank" rel="noreferrer noopener">
                <span className="src-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                </span>
                <span className="src-name">Labs repo</span>
                <ExtIcon />
              </a>
            )}
            {detail.pdfLab !== undefined && (
              <button
                className="source-btn nrk"
                onClick={() => onPdf({ title: detail.title, lab: detail.pdfLab! })}
                style={{ cursor: 'pointer' }}
              >
                <span className="src-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </span>
                <span className="src-name">Oppgavetekst</span>
                <ExtIcon />
              </button>
            )}
            {detail.canvasUrl && !detail.myUrl && (
              <a className="source-btn tv2" href={detail.canvasUrl} target="_blank" rel="noreferrer noopener">
                <span className="src-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" />
                  </svg>
                </span>
                <span className="src-name">Åpne i Canvas</span>
                <ExtIcon />
              </a>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PdfModal({ title, lab, onClose }: { title: string; lab: number; onClose: () => void }) {
  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="lm-overlay" />
        <Dialog.Content
          className="lm-content lm-compact"
          style={{ width: 'calc(100vw - 2rem)', maxWidth: 820 }}
        >
          <Dialog.Title className="lm-title">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">{title}</Dialog.Description>
          <div style={{ marginTop: 16 }}>
            <PdfViewer lab={lab} title={title} height="65vh" />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ExtIcon() {
  return (
    <svg className="src-ext" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

/* ── Date helpers ────────────────────────────────────────────────────────── */
interface DueLabel {
  top: string;
  main: string;
  tone: 'overdue' | 'urgent' | 'soon' | 'normal';
}

function formatDue(iso: string): DueLabel {
  const due = new Date(iso);
  const now = new Date();

  // Calendar-day diff (not ms/86400000, which rounds "today at 23:00" to
  // "tomorrow" if it's currently morning). Compare midnight-to-midnight.
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.round((dueDay - nowDay) / 86_400_000);
  const isOverdue = due.getTime() < now.getTime();

  const time = `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}`;

  if (isOverdue) return { top: 'FORFALT', main: time, tone: 'overdue' };
  if (diffDays === 0) return { top: 'I DAG', main: time, tone: 'urgent' };
  if (diffDays === 1) return { top: 'I MOR', main: time, tone: 'urgent' };
  if (diffDays < 7) {
    return { top: DAY_NAMES_SHORT[due.getDay()], main: time, tone: 'soon' };
  }
  return {
    top: `${due.getDate()}. ${MONTHS_SHORT[due.getMonth()]}`.toUpperCase(),
    main: time,
    tone: 'normal',
  };
}

const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];

function formatAnnounceDate(iso: string): string {
  const d = new Date(iso);
  const ageMs = Date.now() - d.getTime();
  const days = Math.floor(ageMs / 86_400_000);
  if (days === 0) return 'i dag';
  if (days === 1) return 'i går';
  if (days < 7) return `${days} dager siden`;
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
}
