'use client';

interface RelatedCountProps {
  count: number;
}

export function RelatedCount({ count }: RelatedCountProps) {
  if (count <= 1) return null;
  
  return (
    <div
      className="text-xs font-semibold"
      style={{ color: 'var(--color-broadcast-accent)' }}
    >
      1 event • {count} related {count === 2 ? 'post' : 'posts'}
    </div>
  );
}
