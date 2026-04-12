/**
 * Canvas-based "remove white background" — ported verbatim from
 * links.html so the React rewrite produces identical output.
 *
 * Loads `src` (URL or data-URL), draws it into a 128×128 canvas, and
 * sets the alpha to 0 for any pixel where all three RGB channels are
 * above 220 (i.e. near-white). Returns a Promise that resolves to a
 * PNG data URL on success, or rejects with an error message on failure
 * (the most common cause is a CORS-tainted canvas).
 */
export function removeWhiteBg(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const SIZE = 128;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas-kontekst utilgjengelig.'));
          return;
        }
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        const data = ctx.getImageData(0, 0, SIZE, SIZE);
        const px = data.data;
        for (let i = 0; i < px.length; i += 4) {
          const r = px[i];
          const g = px[i + 1];
          const b = px[i + 2];
          if (r > 220 && g > 220 && b > 220) {
            px[i + 3] = 0;
          }
        }
        ctx.putImageData(data, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        reject(
          new Error(
            'CORS: bildet tillater ikke behandling. Last ned bildet og last det opp som fil i stedet.'
          )
        );
      }
    };
    img.onerror = () => reject(new Error('Kunne ikke laste bildet.'));
    img.src = src;
  });
}
