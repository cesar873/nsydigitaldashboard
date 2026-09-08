export function EmptyChart({ height = 320, message }: { height?: number; message: string }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl border border-dashed border-border/40 text-sm text-muted-foreground"
      style={{ height }}
    >
      {message}
    </div>
  );
}
