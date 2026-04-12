import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { QrCode } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

/**
 * QR code generator page. Standalone route under /tools/qr — has a back
 * link to /tools and the generator UI laid out with the input on the
 * left and a live preview on the right.
 */
export function ToolQrPage() {
  return (
    <div className="page">
      <Link to="/tools" className="tools-back-link tools-back-link-eyebrow">
        ← Verktøy
      </Link>
      <PageHeader
        title="QR-kode generator"
        subtitle="Lag en QR-kode fra en lenke eller tekst."
      />

      <div className="surface" style={{ padding: '24px' }}>
        <QrCodeTool />
      </div>
    </div>
  );
}

function QrCodeTool() {
  const [text, setText] = useState('');
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  function downloadPng() {
    const canvas = canvasContainerRef.current?.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    const safeName =
      text
        .replace(/^https?:\/\//, '')
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .slice(0, 40) || 'qrcode';
    link.download = `${safeName}.png`;
    link.click();
  }

  function copyImage() {
    const canvas = canvasContainerRef.current?.querySelector('canvas');
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      navigator.clipboard
        .write([new ClipboardItem({ 'image/png': blob })])
        .catch(() => {
          /* clipboard API may be blocked — fail silently */
        });
    });
  }

  const isEmpty = !text.trim();

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: 28,
        alignItems: 'start',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="reader-input-wrap qr-input-wrap">
          <QrCode size={18} className="reader-input-icon" />
          <input
            id="qr-input"
            type="text"
            placeholder="https://example.com"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            autoFocus
            className="reader-input"
          />
        </div>
        <p
          style={{
            fontSize: '0.78rem',
            color: 'var(--color-text-muted)',
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          Klikk «Last ned» for å lagre koden som PNG, eller «Kopier» for å
          legge bildet i utklippstavlen.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            className="qr-btn qr-btn-primary"
            onClick={downloadPng}
            disabled={isEmpty}
          >
            Last ned PNG
          </button>
          <button
            type="button"
            className="qr-btn"
            onClick={copyImage}
            disabled={isEmpty}
          >
            Kopier bilde
          </button>
        </div>
      </div>

      <div
        ref={canvasContainerRef}
        style={{
          width: 220,
          height: 220,
          background: '#fff',
          padding: 14,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
        }}
      >
        <QRCodeCanvas
          value={text || ' '}
          size={192}
          level="M"
          marginSize={0}
          fgColor="#0a0a0a"
          bgColor="#ffffff"
        />
      </div>
    </div>
  );
}
