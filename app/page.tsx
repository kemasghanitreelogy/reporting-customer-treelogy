import { getSheetValues, getSpreadsheetMeta } from "@/lib/sheets";
import { compactRows } from "@/lib/analytics";
import Dashboard from "./Dashboard";

export const revalidate = 300;

const SPREADSHEET_ID = (() => {
  const v = process.env.SPREADSHEET_ID;
  if (!v) throw new Error("Missing required env variable: SPREADSHEET_ID");
  return v;
})();
const SHEET_RANGE = "Purchase Order!A4:U";

export default async function Page() {
  const [meta, values] = await Promise.all([
    getSpreadsheetMeta(SPREADSHEET_ID),
    getSheetValues(SPREADSHEET_ID, SHEET_RANGE),
  ]);
  const rows = compactRows(values);
  const title = meta.properties?.title ?? "Customer Data";

  return (
    <Dashboard
      title={title}
      rows={rows}
      fetchedAt={new Date().toISOString()}
    />
  );
}
