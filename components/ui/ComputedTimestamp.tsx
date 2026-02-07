'use client';

import { formatDistanceToNow } from 'date-fns';

interface ComputedTimestampProps {
  timestamp: string | Date;
  prefix?: string;
}

export function ComputedTimestamp({ timestamp, prefix = 'Updated' }: ComputedTimestampProps) {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  
  return (
    <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
      {prefix} {formatDistanceToNow(date, { addSuffix: true })}
    </div>
  );
}
