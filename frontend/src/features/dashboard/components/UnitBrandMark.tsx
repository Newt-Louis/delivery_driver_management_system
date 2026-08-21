import { useState } from 'react';
import type { UnitMeta } from '../types';

interface UnitBrandMarkProps {
  meta: Pick<UnitMeta, 'icon' | 'label' | 'logoUrl'>;
  className?: string;
  iconClassName?: string;
}

export default function UnitBrandMark({
  meta,
  className = 'flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/15',
  iconClassName = 'text-xl leading-none',
}: UnitBrandMarkProps) {
  const logoUrl = meta.logoUrl?.trim();
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);

  return (
    <span className={className}>
      {logoUrl && failedLogoUrl !== logoUrl ? (
        <img
          src={logoUrl}
          alt={meta.label}
          className="h-full w-full object-contain p-1"
          onError={() => setFailedLogoUrl(logoUrl)}
        />
      ) : (
        <span className={iconClassName}>{meta.icon}</span>
      )}
    </span>
  );
}
