/**
 * Decorative vertical CJK lettering bleeding down the wide side margins,
 * Frames cyber-editorial flourish. Purely ornamental (aria-hidden, no
 * pointer events), sits behind content, and only shows once the viewport
 * is wide enough to have empty margins beside the centered page.
 */
export function SideGlyphs() {
  return (
    <>
      <div className="side-glyph side-glyph-left" aria-hidden="true">
        ダッシュボード
      </div>
      <div className="side-glyph side-glyph-right" aria-hidden="true">
        ハローマックス
      </div>
    </>
  );
}
