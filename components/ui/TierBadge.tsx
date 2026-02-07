'use client';

interface TierBadgeProps {
  tier: 'clippers' | 'weekly_wrap';
}

export function TierBadge({ tier }: TierBadgeProps) {
  const label = tier === 'clippers' ? 'CLIP' : 'WEEKLY';
  const colors = tier === 'clippers' 
    ? { bg: 'rgba(239, 68, 68, 0.2)', text: '#ef4444' }
    : { bg: 'rgba(59, 130, 246, 0.2)', text: '#3b82f6' };
  
  return (
    <span
      className="px-2 py-1 text-xs font-bold rounded uppercase flex-shrink-0"
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
      }}
    >
      {label}
    </span>
  );
}
