import { backgroundUrl, hasBackdrop, type TermTheme } from '../lib/themes';

/** Gradient or picture behind the terminal text of a custom theme. */
export function Backdrop({ theme }: { theme: TermTheme }) {
  const b = theme.backdrop;
  if (!b || !hasBackdrop(theme)) return null;
  if (b.type === 'gradient') {
    return <div className="term-backdrop" style={{ background: `linear-gradient(${b.gradientAngle}deg, ${theme.colors.background}, ${b.gradientTo})` }} />;
  }
  return (
    <div
      className="term-backdrop"
      style={{
        backgroundImage: `url("${backgroundUrl(b.image)}")`,
        backgroundSize: b.fit === 'cover' || b.fit === 'contain' ? b.fit : 'auto',
        backgroundRepeat: b.fit === 'tile' ? 'repeat' : 'no-repeat',
        backgroundPosition: 'center',
        opacity: b.imageOpacity,
        // blurred edges fade out: draw the picture a little larger
        filter: b.blur ? `blur(${b.blur}px)` : undefined,
        transform: b.blur ? 'scale(1.06)' : undefined,
      }}
    />
  );
}
