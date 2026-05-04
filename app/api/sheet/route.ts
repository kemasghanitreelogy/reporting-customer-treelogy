import { NextRequest, NextResponse } from "next/server";
import { getSheetValues, getSpreadsheetMeta } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_SPREADSHEET_ID =
  process.env.SPREADSHEET_ID ?? "10WeFeTkA4PCs7ngNkpJ4D6giLwqu5U68";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const spreadsheetId = searchParams.get("id") ?? DEFAULT_SPREADSHEET_ID;
  const rangeParam = searchParams.get("range");

  try {
    const meta = await getSpreadsheetMeta(spreadsheetId);
    const sheetTitles =
      meta.sheets?.map((s) => s.properties?.title ?? "").filter(Boolean) ?? [];

    const range = rangeParam ?? sheetTitles[0] ?? "Sheet1";
    const values = await getSheetValues(spreadsheetId, range);

    return NextResponse.json(
      {
        ok: true,
        title: meta.properties?.title ?? null,
        sheets: sheetTitles,
        activeRange: range,
        values,
        fetchedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const error = err as { message?: string; code?: number };
    return NextResponse.json(
      {
        ok: false,
        error: error.message ?? "Unknown error",
        code: error.code ?? 500,
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
