/** Собственная айдентика: жёлтая «искра» с молнией + надпись */
export function Logo({ size = 40, light = true }: { size?: number; light?: boolean }) {
  return (
    <span className="logo" style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.25 }}>
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="27" fill="#FFC531" stroke="#1A1033" strokeWidth="4" />
        <path d="M35 13 L20 36 H31 L28 52 L45 27 H34 Z" fill="#fff" stroke="#1A1033" strokeWidth="3.5" strokeLinejoin="round" />
      </svg>
      <span style={{ fontWeight: 900, fontSize: size * 0.62, color: light ? '#fff' : 'var(--ink)', letterSpacing: '-0.01em' }}>Викторина</span>
    </span>
  );
}
