export default function UnitLogo({ logoUrl, icon, px = 28 }: {
  logoUrl: string | null | undefined;
  icon: string;
  px?: number;
}) {
  if (logoUrl) {
    return <img src={logoUrl} alt="" style={{ width: px, height: px, objectFit: 'contain', flexShrink: 0 }} className="rounded" />;
  }
  const em = px <= 20 ? 'text-base' : px <= 30 ? 'text-2xl' : 'text-3xl';
  return <span className={`${em} leading-none`}>{icon}</span>;
}
