import { SourceBadge } from './Badge';
import { SourcesBreakdown, PlatformType } from '@/lib/types';

interface SourcePillsProps {
  sources: SourcesBreakdown;
  className?: string;
}

export function SourcePills({ sources, className }: SourcePillsProps) {
  const activeSources = (Object.entries(sources) as [PlatformType, number][])
    .filter(([_, value]) => value > 0)
    .sort(([_, a], [__, b]) => b - a)
    .map(([platform]) => platform);

  if (activeSources.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {activeSources.map((platform) => (
        <SourceBadge key={platform} platform={platform} />
      ))}
    </div>
  );
}
