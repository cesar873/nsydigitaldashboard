import { revalidatePath } from "next/cache";
import { clearSheetCache } from "@/lib/sources/sheets-live";

/** Never cache the refresh endpoint itself. */
export const dynamic = "force-dynamic";

export async function POST() {
  clearSheetCache();
  revalidatePath("/", "layout");
  return Response.json({ ok: true, at: new Date().toISOString() });
}
