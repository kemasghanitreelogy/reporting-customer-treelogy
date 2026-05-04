import { getSheetValues, getSpreadsheetMeta } from "@/lib/sheets";
import { compactRows } from "@/lib/analytics";
import Dashboard from "./Dashboard";

export const revalidate = 300;

const SPREADSHEET_ID =
  process.env.SPREADSHEET_ID ?? "1JPtlM4lb-e_JbtNkCqgKaAOmmU05SU6T_Abjbz9lwTw";

export default async function Page() {
  const [meta, values] = await Promise.all([
    getSpreadsheetMeta(SPREADSHEET_ID),
    getSheetValues(SPREADSHEET_ID, "Purchase Order!A4:U"),
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
