import { NextRequest, NextResponse } from "next/server";
import { getSheetValues, getSpreadsheetMeta } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env variable: ${name}`);
  return v;
}

const DEFAULT_SPREADSHEET_ID = requireEnv("SPREADSHEET_ID");
const DEFAULT_SHEET_NAME = process.env.DEFAULT_SHEET_NAME ?? "Sheet1";
const DEFAULT_RANGE = process.env.SHEET_RANGE;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const spreadsheetId = searchParams.get("id") ?? DEFAULT_SPREADSHEET_ID;
  const rangeParam = searchParams.get("range");

  try {
    const meta = await getSpreadsheetMeta(spreadsheetId);
    const sheetTitles =
      meta.sheets?.map((s) => s.properties?.title ?? "").filter(Boolean) ?? [];

    const range =
      rangeParam ?? DEFAULT_RANGE ?? sheetTitles[0] ?? DEFAULT_SHEET_NAME;
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
