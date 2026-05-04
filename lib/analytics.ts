const PROVINCES = [
  "Aceh",
  "Sumatera Utara",
  "Sumatera Selatan",
  "Sumatera Barat",
  "Riau",
  "Kepulauan Riau",
  "Jambi",
  "Bengkulu",
  "Lampung",
  "Bangka Belitung",
  "DKI Jakarta",
  "Jawa Barat",
  "Jawa Tengah",
  "Jawa Timur",
  "Banten",
  "DI Yogyakarta",
  "Yogyakarta",
  "Bali",
  "Nusa Tenggara Barat",
  "Nusa Tenggara Timur",
  "Kalimantan Barat",
  "Kalimantan Tengah",
  "Kalimantan Selatan",
  "Kalimantan Timur",
  "Kalimantan Utara",
  "Sulawesi Utara",
  "Sulawesi Tengah",
  "Sulawesi Selatan",
  "Sulawesi Tenggara",
  "Sulawesi Barat",
  "Gorontalo",
  "Maluku",
  "Maluku Utara",
  "Papua",
  "Papua Barat",
];

const MONTH_LABEL = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export type Segment = "New" | "Returning" | "VIP" | "Other";

export type CompactRow = {
  date: string;
  month: string;
  monthLabel: string;
  platform: string;
  qty: number;
  segment: Segment;
  name: string;
  phone: string;
  region: string;
  skus: string[];
  custKey: string;
};

export type Aggregates = ReturnType<typeof aggregate>;

export type Metric = "orders" | "units";

function detectProvince(address: string): string {
  const a = address.toLowerCase();
  for (const p of PROVINCES) {
    if (a.includes(p.toLowerCase())) {
      return p === "Yogyakarta" ? "DI Yogyakarta" : p;
    }
  }
  if (/\bjakarta\b/.test(a)) return "DKI Jakarta";
  if (/\b(bekasi|depok|bogor|bandung|cimahi|cirebon)\b/.test(a))
    return "Jawa Barat";
  if (/\b(tangerang|serang|cilegon)\b/.test(a)) return "Banten";
  if (/\b(surabaya|malang|kediri|sidoarjo|gresik)\b/.test(a))
    return "Jawa Timur";
  if (/\b(semarang|solo|surakarta|magelang)\b/.test(a)) return "Jawa Tengah";
  if (/\b(yogyakarta|jogja|sleman|bantul)\b/.test(a)) return "DI Yogyakarta";
  if (/\b(medan|deli serdang|binjai)\b/.test(a)) return "Sumatera Utara";
  if (/\bdenpasar\b/.test(a)) return "Bali";
  return "Other / Unknown";
}

function classifyByQty(qty: number): Segment {
  if (qty >= 4) return "VIP";
  if (qty >= 2) return "Returning";
  if (qty >= 1) return "New";
  return "Other";
}

function blankIfNa(v: string): string {
  const s = v.trim();
  if (!s) return "";
  const u = s.toUpperCase();
  if (u === "N/A" || u === "NA" || s === "-" || s === "—") return "";
  return s;
}

export function parseDate(s: string): Date | null {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1]);
}

export function compactRows(values: string[][]): CompactRow[] {
  const out: CompactRow[] = [];
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const no = (row[0] ?? "").trim();
    if (!/^\d+$/.test(no)) continue;
    const date = (row[1] ?? "").trim();
    const m = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) continue;
    const month = `${m[3]}-${String(m[2]).padStart(2, "0")}`;
    const monthLabel = `${MONTH_LABEL[+m[2] - 1]} ${m[3].slice(2)}`;
    const platform = (row[2] ?? "").trim();
    const name = (row[3] ?? "").trim();
    const address = (row[4] ?? "").trim();
    const qty = Number.parseInt(row[5] ?? "0", 10) || 0;
    const phone = blankIfNa(row[7] ?? "");
    const productLine = blankIfNa(row[8] ?? "");
    const skus = productLine
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const custKey = `row-${no}-${i}`;
    out.push({
      date,
      month,
      monthLabel,
      platform,
      qty,
      segment: classifyByQty(qty),
      name,
      phone,
      region: detectProvince(address),
      skus,
      custKey,
    });
  }
  return out;
}

export function uniqueMonths(rows: CompactRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) set.add(r.month);
  return [...set].sort();
}

export function monthLabelOf(month: string): string {
  const m = month.match(/^(\d{4})-(\d{2})$/);
  if (!m) return month;
  return `${MONTH_LABEL[+m[2] - 1]} ${m[1].slice(2)}`;
}

export function aggregate(rows: CompactRow[]) {
  const orders = rows.length;
  const units = rows.reduce((s, r) => s + r.qty, 0);

  const customerKeys = new Set<string>();
  for (const r of rows) customerKeys.add(r.custKey);
  const customers = customerKeys.size;
  const avgUnits = orders ? units / orders : 0;

  const dates = rows
    .map((r) => parseDate(r.date))
    .filter((d): d is Date => d instanceof Date && !Number.isNaN(+d));
  const minDate = dates.length
    ? new Date(Math.min(...dates.map((d) => +d)))
    : null;
  const maxDate = dates.length
    ? new Date(Math.max(...dates.map((d) => +d)))
    : null;

  type MonthBucket = {
    month: string;
    label: string;
    tokopediaOrders: number;
    shopeeOrders: number;
    otherOrders: number;
    tokopediaUnits: number;
    shopeeUnits: number;
    otherUnits: number;
    orders: number;
    units: number;
  };
  const monthly = new Map<string, MonthBucket>();
  for (const r of rows) {
    const cur =
      monthly.get(r.month) ??
      ({
        month: r.month,
        label: r.monthLabel,
        tokopediaOrders: 0,
        shopeeOrders: 0,
        otherOrders: 0,
        tokopediaUnits: 0,
        shopeeUnits: 0,
        otherUnits: 0,
        orders: 0,
        units: 0,
      } as MonthBucket);
    cur.orders += 1;
    cur.units += r.qty;
    const p = r.platform.toLowerCase();
    if (p === "tokopedia") {
      cur.tokopediaOrders += 1;
      cur.tokopediaUnits += r.qty;
    } else if (p === "shopee") {
      cur.shopeeOrders += 1;
      cur.shopeeUnits += r.qty;
    } else {
      cur.otherOrders += 1;
      cur.otherUnits += r.qty;
    }
    monthly.set(r.month, cur);
  }
  const monthlySeries = [...monthly.values()].sort((a, b) =>
    a.month.localeCompare(b.month),
  );

  const platformMap = new Map<string, { orders: number; units: number }>();
  for (const r of rows) {
    const cur = platformMap.get(r.platform) ?? { orders: 0, units: 0 };
    cur.orders += 1;
    cur.units += r.qty;
    platformMap.set(r.platform, cur);
  }
  const platformSplit = [...platformMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.orders - a.orders);

  const mixMap = new Map<string, { orders: number; units: number }>();
  for (const r of rows) {
    const cur = mixMap.get(r.segment) ?? { orders: 0, units: 0 };
    cur.orders += 1;
    cur.units += r.qty;
    mixMap.set(r.segment, cur);
  }
  const customerMix = (["New", "Returning", "VIP"] as Segment[])
    .filter((t) => mixMap.has(t))
    .map((t) => ({
      type: t,
      ...(mixMap.get(t) as { orders: number; units: number }),
    }));

  const productMap = new Map<string, { orders: number; estUnits: number }>();
  for (const r of rows) {
    if (!r.skus.length) continue;
    const per = r.qty / r.skus.length;
    for (const sku of r.skus) {
      const cur = productMap.get(sku) ?? { orders: 0, estUnits: 0 };
      cur.orders += 1;
      cur.estUnits += per;
      productMap.set(sku, cur);
    }
  }
  const topProducts = [...productMap.entries()]
    .map(([sku, v]) => ({
      sku,
      orders: v.orders,
      units: Math.round(v.estUnits),
    }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 10);

  const regionMap = new Map<string, { orders: number; units: number }>();
  for (const r of rows) {
    const cur = regionMap.get(r.region) ?? { orders: 0, units: 0 };
    cur.orders += 1;
    cur.units += r.qty;
    regionMap.set(r.region, cur);
  }
  const topRegions = [...regionMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 10);

  type CustomerAgg = {
    custKey: string;
    name: string;
    phone: string;
    region: string;
    qty: number;
    orders: number;
    latestTs: number;
    latestSegment: Segment;
  };
  const custMap = new Map<string, CustomerAgg>();
  for (const r of rows) {
    const ts = parseDate(r.date)?.getTime() ?? 0;
    const cur = custMap.get(r.custKey);
    if (!cur) {
      custMap.set(r.custKey, {
        custKey: r.custKey,
        name: r.name,
        phone: r.phone,
        region: r.region,
        qty: r.qty,
        orders: 1,
        latestTs: ts,
        latestSegment: r.segment,
      });
      continue;
    }
    cur.qty += r.qty;
    cur.orders += 1;
    if (!cur.phone && r.phone) cur.phone = r.phone;
    if (
      (cur.region === "Other / Unknown" || !cur.region) &&
      r.region &&
      r.region !== "Other / Unknown"
    )
      cur.region = r.region;
    if (ts >= cur.latestTs) {
      cur.latestTs = ts;
      cur.latestSegment = r.segment;
      if (r.name) cur.name = r.name;
    }
  }
  for (const c of custMap.values()) {
    if (!c.phone) c.phone = "—";
    if (!c.region) c.region = "—";
  }
  const topCustomers = [...custMap.values()]
    .sort((a, b) => b.qty - a.qty || b.orders - a.orders)
    .slice(0, 10);

  let returningCustomers = 0;
  for (const c of custMap.values()) if (c.orders >= 2) returningCustomers += 1;
  const repeatRate = customers ? returningCustomers / customers : 0;

  const monthsCovered = monthlySeries.length;
  const lastMonth = monthlySeries.at(-1);
  const prevMonth = monthlySeries.at(-2);
  const momOrders =
    lastMonth && prevMonth && prevMonth.orders
      ? (lastMonth.orders - prevMonth.orders) / prevMonth.orders
      : null;
  const momUnits =
    lastMonth && prevMonth && prevMonth.units
      ? (lastMonth.units - prevMonth.units) / prevMonth.units
      : null;

  return {
    kpis: {
      orders,
      units,
      customers,
      avgUnits,
      minDate,
      maxDate,
      monthsCovered,
      repeatRate,
      momOrders,
      momUnits,
      lastMonthLabel: lastMonth?.label ?? null,
    },
    monthlySeries,
    platformSplit,
    customerMix,
    topProducts,
    topRegions,
    topCustomers,
  };
}
