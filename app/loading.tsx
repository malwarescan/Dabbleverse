export default function Loading() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-broadcast-bg, #0a0b0d)',
        color: 'var(--color-text-tertiary, #7e8391)',
      }}
    >
      <p>Loading...</p>
    </div>
  );
}
