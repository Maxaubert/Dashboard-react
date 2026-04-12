import { Link } from 'react-router-dom';
import { Calculator, QrCode, Timer, BookOpen, Download, Eraser, FileText, FileType2, ArrowUpRight } from 'lucide-react';

/**
 * Tools page — workshop / blueprint aesthetic. Each tool is a large
 * tile in a 2-column grid with a per-tool accent color, monospace
 * number badge, animated corner brackets, and a CTA bar at the
 * bottom. The page intentionally diverges from the rest of the
 * dashboard's flatter list/card layouts so it reads as "the toolbox".
 *
 * Add a new tool by appending to the TOOLS array — pick a fresh
 * `accent` so each tile retains its own identity.
 */
export function ToolsPage() {
  return (
    <div className="page tools-workshop">
      <div className="tools-workshop-header">
        <div className="tools-workshop-eyebrow">
          <span>VERKTØYKASSE</span>
          <span className="tools-workshop-eyebrow-count">
            {String(TOOLS.length).padStart(3, '0')}
          </span>
        </div>
        <h1 className="tools-workshop-title">Verktøy</h1>
        <p className="tools-workshop-sub">
          Småverktøy for daglig bruk — velg en for å åpne den.
        </p>
      </div>

      <div className="tools-workshop-grid">
        {TOOLS.map((tool, i) => (
          <Link
            key={tool.to}
            to={tool.to}
            className="tools-tile"
            style={{ ['--tile-accent' as string]: tool.accent }}
          >
            <span className="tools-tile-corner tl" aria-hidden="true" />
            <span className="tools-tile-corner tr" aria-hidden="true" />
            <span className="tools-tile-corner bl" aria-hidden="true" />
            <span className="tools-tile-corner br" aria-hidden="true" />

            <div className="tools-tile-num">
              {String(i + 1).padStart(2, '0')}
            </div>

            <div className="tools-tile-icon">
              <tool.icon size={38} strokeWidth={1.5} />
            </div>

            <div className="tools-tile-body">
              <div className="tools-tile-name">{tool.title}</div>
              <div className="tools-tile-desc">{tool.desc}</div>
            </div>

            <div className="tools-tile-cta">
              <span>ÅPNE</span>
              <ArrowUpRight size={14} strokeWidth={2} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

const TOOLS = [
  {
    to: '/tools/calculator',
    title: 'Kalkulator',
    desc: 'Regn ut tall, funksjoner og uttrykk.',
    icon: Calculator,
    accent: '#f59e0b',
  },
  {
    to: '/tools/qr',
    title: 'QR-kode generator',
    desc: 'Lag en QR-kode fra en lenke eller tekst.',
    icon: QrCode,
    accent: '#22d3ee',
  },
  {
    to: '/tools/timer',
    title: 'Timer & Pomodoro',
    desc: 'Timer, stoppeklokke og Pomodoro i ett.',
    icon: Timer,
    accent: '#ef4444',
  },
  {
    to: '/tools/reader',
    title: 'Reader mode',
    desc: 'Les en artikkel uten reklame eller rot.',
    icon: BookOpen,
    accent: '#fbbf24',
  },
  {
    to: '/tools/video',
    title: 'Video-nedlaster',
    desc: 'Last ned video eller lyd fra nettet.',
    icon: Download,
    accent: '#dc2626',
  },
  {
    to: '/tools/bgremove',
    title: 'Bakgrunnsfjerner',
    desc: 'Fjern bakgrunnen fra et bilde.',
    icon: Eraser,
    accent: '#a855f7',
  },
  {
    to: '/tools/pdf',
    title: 'PDF-verktøy',
    desc: 'Slå sammen, splitt, roter eller komprimer PDF-er.',
    icon: FileText,
    accent: '#fb7185',
  },
  {
    to: '/tools/convert',
    title: 'Fil-konverterer',
    desc: 'Konverter mellom bilde-, lyd- og videoformater.',
    icon: FileType2,
    accent: '#6366f1',
  },
] as const;
