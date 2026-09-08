import { cn } from "@/lib/utils";

export function CardShell({
  title,
  subtitle,
  right,
  className,
  children,
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/40 bg-card/30 p-6 backdrop-blur-sm",
        className,
      )}
    >
      {(title || right) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {subtitle && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}
