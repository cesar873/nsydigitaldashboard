import { BOOKKEEPING_CATEGORY_COL, BOOKKEEPING_COMMENT_COL } from "@/lib/sources/bookkeeping";
import { describeWriteError, updateCell } from "@/lib/sources/sheets-write";
import { TABS } from "@/lib/config";

type Body = { sheetRow?: number; field?: "category" | "comment"; value?: string };

export async function POST(request: Request) {
  try {
    const { sheetRow, field, value } = (await request.json()) as Body;

    if (typeof sheetRow !== "number" || sheetRow < 2) {
      return Response.json({ error: "A valid sheetRow is required" }, { status: 400 });
    }
    if (field !== "category" && field !== "comment") {
      return Response.json({ error: "field must be 'category' or 'comment'" }, { status: 400 });
    }

    const column = field === "category" ? BOOKKEEPING_CATEGORY_COL : BOOKKEEPING_COMMENT_COL;
    await updateCell(TABS.bookkeeping, `${column}${sheetRow}`, value ?? "");

    return Response.json({ ok: true, cell: `${column}${sheetRow}` });
  } catch (err) {
    return Response.json({ error: describeWriteError(err) }, { status: 500 });
  }
}
