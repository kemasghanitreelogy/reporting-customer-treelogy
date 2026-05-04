import { getSheetValues, getSpreadsheetMeta } from "@/lib/sheets";
import { compactRows } from "@/lib/analytics";
import Dashboard from "./Dashboard";

export const revalidate = Number(process.env.REVALIDATE_SECONDS ?? 300);

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env variable: ${name}`);
  return v;
}

const SPREADSHEET_ID = requireEnv("SPREADSHEET_ID");
const SHEET_RANGE = requireEnv("SHEET_RANGE");
const DEFAULT_TITLE = process.env.DEFAULT_TITLE ?? "Customer Data";

export default async function Page() {
  const [meta, values] = await Promise.all([
    getSpreadsheetMeta(SPREADSHEET_ID),
    getSheetValues(SPREADSHEET_ID, SHEET_RANGE),
  ]);
  const rows = compactRows(values);
  const title = meta.properties?.title ?? DEFAULT_TITLE;

  return (
    <Dashboard
      title={title}
      rows={rows}
      fetchedAt={new Date().toISOString()}
    />
  );
}
