export function Spinner({ size = 36, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <span
      role="status"
      aria-label="Загрузка"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `${Math.max(3, size / 9)}px solid ${color}`,
        borderRightColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
  );
}

export function FullscreenSpinner() {
  return (
    <div className="bg-pattern" style={{ minHeight: '100%', display: 'grid', placeItems: 'center' }}>
      <Spinner size={56} />
    </div>
  );
}
