import type { CSSProperties, ReactNode } from 'react';

type AdaptiveGridProps = {
  children: ReactNode;
  minColumnWidth: number;
  maxColumnWidth?: number;
  className?: string;
};

/**
 * Fluid card grid: the browser fits as many safe columns as the available
 * width permits. A max width keeps dense configuration cards readable on very
 * wide displays; omitting it lets cards fill the last row like Zones does.
 */
export default function AdaptiveGrid({ children, minColumnWidth, maxColumnWidth, className = '' }: AdaptiveGridProps) {
  const style = {
    '--adaptive-grid-min': `${minColumnWidth}px`,
    ...(maxColumnWidth ? { '--adaptive-grid-max': `${maxColumnWidth}px` } : {}),
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, var(--adaptive-grid-min)), var(--adaptive-grid-max, 1fr)))',
  } as CSSProperties;

  return <div className={`grid gap-4 ${maxColumnWidth ? 'justify-center' : ''} ${className}`.trim()} style={style}>{children}</div>;
}
