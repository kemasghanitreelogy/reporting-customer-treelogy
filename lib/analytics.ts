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

export type Metric = "orders" | "customers";

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

function mapCustomerType(s: string): Segment {
  const t = s.trim().toLowerCase();
  if (!t) return "Other";
  if (t.includes("vip")) return "VIP";
  if (t.includes("returning")) return "Returning";
  if (t.includes("new")) return "New";
  return "Other";
}

function buildHeaderMap(headerRow: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headerRow.forEach((h, i) => {
    const key = (h ?? "").trim().toLowerCase();
    if (key && !map.has(key)) map.set(key, i);
  });
  return map;
}

function findCol(headers: Map<string, number>, ...names: string[]): number {
  for (const n of names) {
    const idx = headers.get(n.toLowerCase());
    if (typeof idx === "number") return idx;
  }
  return -1;
}

function findHeaderRow(values: string[][]): number {
  const limit = Math.min(values.length, 10);
  for (let i = 0; i < limit; i++) {
    const row = values[i] ?? [];
    if (
      row.some(
        (c) => (c ?? "").trim().toLowerCase() === "customer type",
      )
    ) {
      return i;
    }
  }
  return -1;
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
  if (values.length === 0) return [];
  const headerRowIdx = findHeaderRow(values);
  if (headerRowIdx < 0) return [];
  const headers = buildHeaderMap(values[headerRowIdx]);

  const idxNo = findCol(headers, "no", "no.");
  const idxDate = findCol(headers, "date");
  const idxPlatform = findCol(headers, "platform");
  const idxName = findCol(headers, "recipient name", "customer name", "name");
  const idxAddress = findCol(headers, "address");
  const idxQty = findCol(headers, "qty", "quantity");
  const idxType = findCol(headers, "customer type");
  const idxPhone = findCol(headers, "phone number", "phone");
  const idxProduct = findCol(
    headers,
    "product name & qty",
    "product name",
    "product",
  );

  const cell = (row: string[], idx: number): string =>
    idx >= 0 ? (row[idx] ?? "").toString() : "";

  const out: CompactRow[] = [];
  for (let i = headerRowIdx + 1; i < values.length; i++) {
    const row = values[i];
    const no = cell(row, idxNo).trim();
    if (!/^\d+$/.test(no)) continue;
    const date = cell(row, idxDate).trim();
    const m = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) continue;
    const month = `${m[3]}-${String(m[2]).padStart(2, "0")}`;
    const monthLabel = `${MONTH_LABEL[+m[2] - 1]} ${m[3].slice(2)}`;
    const platform = cell(row, idxPlatform).trim();
    const name = cell(row, idxName).trim();
    const address = cell(row, idxAddress).trim();
    const qty = Number.parseInt(cell(row, idxQty) || "0", 10) || 0;
    const phone = blankIfNa(cell(row, idxPhone));
    const productLine = blankIfNa(cell(row, idxProduct));
    const skus = productLine
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const normName = name.toLowerCase().replace(/\s+/g, " ").trim();
    const normAddress = address.toLowerCase().replace(/\s+/g, " ").trim();
    const custKey =
      normName || normAddress
        ? `${normName}|${normAddress}`
        : `row-${no}-${i}`;
    out.push({
      date,
      month,
      monthLabel,
      platform,
      qty,
      segment: mapCustomerType(cell(row, idxType)),
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
    tokopediaCustomers: number;
    shopeeCustomers: number;
    otherCustomers: number;
    orders: number;
    units: number;
    customers: number;
  };
  const monthly = new Map<string, MonthBucket>();
  const monthlyCustKeys = new Map<
    string,
    { toko: Set<string>; shopee: Set<string>; other: Set<string>; all: Set<string> }
  >();
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
        tokopediaCustomers: 0,
        shopeeCustomers: 0,
        otherCustomers: 0,
        orders: 0,
        units: 0,
        customers: 0,
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

    const mc =
      monthlyCustKeys.get(r.month) ??
      { toko: new Set<string>(), shopee: new Set<string>(), other: new Set<string>(), all: new Set<string>() };
    mc.all.add(r.custKey);
    if (p === "tokopedia") mc.toko.add(r.custKey);
    else if (p === "shopee") mc.shopee.add(r.custKey);
    else mc.other.add(r.custKey);
    monthlyCustKeys.set(r.month, mc);
  }
  for (const bucket of monthly.values()) {
    const mc = monthlyCustKeys.get(bucket.month);
    if (!mc) continue;
    bucket.tokopediaCustomers = mc.toko.size;
    bucket.shopeeCustomers = mc.shopee.size;
    bucket.otherCustomers = mc.other.size;
    bucket.customers = mc.all.size;
  }
  const monthlySeries = [...monthly.values()].sort((a, b) =>
    a.month.localeCompare(b.month),
  );

  const platformMap = new Map<string, { orders: number; units: number }>();
  const platformCustKeys = new Map<string, Set<string>>();
  for (const r of rows) {
    const cur = platformMap.get(r.platform) ?? { orders: 0, units: 0 };
    cur.orders += 1;
    cur.units += r.qty;
    platformMap.set(r.platform, cur);
    if (!platformCustKeys.has(r.platform))
      platformCustKeys.set(r.platform, new Set());
    platformCustKeys.get(r.platform)!.add(r.custKey);
  }
  const platformSplit = [...platformMap.entries()]
    .map(([name, v]) => ({
      name,
      ...v,
      customers: platformCustKeys.get(name)?.size ?? 0,
    }))
    .sort((a, b) => b.orders - a.orders);

  const mixMap = new Map<string, { orders: number; units: number }>();
  for (const r of rows) {
    const cur = mixMap.get(r.segment) ?? { orders: 0, units: 0 };
    cur.orders += 1;
    cur.units += r.qty;
    mixMap.set(r.segment, cur);
  }

  const productMap = new Map<string, { orders: number; estUnits: number }>();
  const productCustKeys = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.skus.length) continue;
    const per = r.qty / r.skus.length;
    for (const sku of r.skus) {
      const cur = productMap.get(sku) ?? { orders: 0, estUnits: 0 };
      cur.orders += 1;
      cur.estUnits += per;
      productMap.set(sku, cur);
      if (!productCustKeys.has(sku)) productCustKeys.set(sku, new Set());
      productCustKeys.get(sku)!.add(r.custKey);
    }
  }
  const topProducts = [...productMap.entries()]
    .map(([sku, v]) => ({
      sku,
      orders: v.orders,
      units: Math.round(v.estUnits),
      customers: productCustKeys.get(sku)?.size ?? 0,
    }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 10);

  const regionMap = new Map<string, { orders: number; units: number }>();
  const regionCustKeys = new Map<string, Set<string>>();
  for (const r of rows) {
    const cur = regionMap.get(r.region) ?? { orders: 0, units: 0 };
    cur.orders += 1;
    cur.units += r.qty;
    regionMap.set(r.region, cur);
    if (!regionCustKeys.has(r.region))
      regionCustKeys.set(r.region, new Set());
    regionCustKeys.get(r.region)!.add(r.custKey);
  }
  const topRegions = [...regionMap.entries()]
    .map(([name, v]) => ({
      name,
      ...v,
      customers: regionCustKeys.get(name)?.size ?? 0,
    }))
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

  const segmentCustomers = new Map<Segment, number>();
  for (const c of custMap.values()) {
    segmentCustomers.set(
      c.latestSegment,
      (segmentCustomers.get(c.latestSegment) ?? 0) + 1,
    );
  }
  const customerMix = (["New", "Returning", "VIP"] as Segment[])
    .filter((t) => mixMap.has(t) || segmentCustomers.has(t))
    .map((t) => ({
      type: t,
      orders: mixMap.get(t)?.orders ?? 0,
      units: mixMap.get(t)?.units ?? 0,
      customers: segmentCustomers.get(t) ?? 0,
    }));

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
