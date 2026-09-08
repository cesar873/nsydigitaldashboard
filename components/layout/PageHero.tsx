export function PageHero({
  eyebrow,
  title,
  period,
  source,
}: {
  eyebrow: string;
  title: string;
  period: string;
  source: string;
}) {
  return (
    <div className="mb-6">
      <div className="text-[11px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
        {eyebrow}
      </div>
      <h1 className="anton mt-1 text-[40px] leading-[1] md:text-[44px]">{title}</h1>
      <div className="mt-2 text-[12px] text-[color:var(--muted)]">
        {period} · live from {source}
      </div>
    </div>
  );
}
