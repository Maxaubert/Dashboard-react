import { useEffect, useRef, useState } from 'react';
import { faviconUrl } from '@/api/pdf';
import { cn } from '@/lib/cn';

interface FaviconImageProps {
  /** Domain like "github.com". */
  domain: string;
  size?: number;
  /** Run the canvas-based light-background removal pass. Default false. */
  removeBg?: boolean;
  className?: string;
  alt?: string;
}

/**
 * Renders a favicon for `domain` via the /api/favicon proxy. The proxy
 * exists because the browser can't read pixels from cross-origin images,
 * so the canvas-based background removal needs the bytes to come from
 * our own host.
 */
export function FaviconImage({
  domain,
  size = 32,
  removeBg = false,
  className,
  alt = '',
}: FaviconImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [processed, setProcessed] = useState<string | null>(null);

  useEffect(() => {
    if (!removeBg) {
      setProcessed(null);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = faviconUrl(domain);

    img.onload = () => {
      if (cancelled) return;
      const c = canvasRef.current ?? document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, c.width, c.height);
      const data = imageData.data;

      // Remove pixels lighter than ~85% lightness — matches the legacy
      // links.html logic for hiding white card backgrounds.
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const lightness = (Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255;
        if (lightness > 0.85) {
          data[i + 3] = 0;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      setProcessed(c.toDataURL('image/png'));
    };

    return () => {
      cancelled = true;
    };
  }, [domain, removeBg]);

  return (
    <>
      {/* Hidden canvas for processing — only used when removeBg is on. */}
      {removeBg && <canvas ref={canvasRef} className="hidden" aria-hidden />}
      <img
        src={processed ?? faviconUrl(domain)}
        width={size}
        height={size}
        alt={alt}
        className={cn('block object-contain', className)}
        loading="lazy"
        decoding="async"
      />
    </>
  );
}
