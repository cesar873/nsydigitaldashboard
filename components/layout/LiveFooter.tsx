import { CLIENT_CONFIG } from "@/lib/config";

export function LiveFooter({ sources }: { sources: string }) {
  return (
    <p className="mt-10 text-[10px] text-muted-foreground">
      Live from{" "}
      <a
        className="underline hover:text-foreground"
        target="_blank"
        rel="noreferrer"
        href={CLIENT_CONFIG.sheetUrl}
      >
        {CLIENT_CONFIG.sheetName}
      </a>
      {" — "}
      {sources} · cached 5 minutes
    </p>
  );
}
