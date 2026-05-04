"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  aggregate,
  parseDate,
  uniqueMonths,
  type Aggregates,
  type CompactRow,
  type Metric,
  type Segment,
} from "@/lib/analytics";

const COLORS = {
  ink: "#10221A",
  muted: "#6F7B73",
  border: "#E6E1D6",
  surface: "#FFFFFF",
  bg: "#F7F3EA",
  brand: "#0E5E45",
  brandSoft: "#D6E5DC",
  tokopedia: "#0E5E45",
  shopee: "#C26A4A",
  vip: "#B07327",
  returning: "#1F8A6E",
  new: "#A9A293",
  grid: "#EDE7D8",
};

const fmtInt = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    Math.round(n),
  );
const fmtPct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;
const fmtDate = (d: Date | null) =>
  d
    ? d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

type Period = "all" | "1m" | "3m" | "6m" | "ytd";
type Channel = "all" | "Tokopedia" | "Shopee";
type SegmentFilter = "all" | Segment;

const DEFAULTS = {
  period: "all" as Period,
  channel: "all" as Channel,
  segment: "all" as SegmentFilter,
  metric: "customers" as Metric,
};

export default function Dashboard({
  rows,
  title,
  fetchedAt,
}: {
  rows: CompactRow[];
  title: string;
  fetchedAt: string;
}) {
  const [period, setPeriod] = useState<Period>(DEFAULTS.period);
  const [channel, setChannel] = useState<Channel>(DEFAULTS.channel);
  const [segment, setSegment] = useState<SegmentFilter>(DEFAULTS.segment);
  const [metric, setMetric] = useState<Metric>(DEFAULTS.metric);

  const allMonths = useMemo(() => uniqueMonths(rows), [rows]);
  const latest = allMonths.at(-1) ?? "";

  const monthRange = useMemo(() => {
    if (!latest || !allMonths.length)
      return { start: "", end: "", label: "All time" };
    const first = allMonths[0];
    const idx = allMonths.indexOf(latest);
    if (period === "all")
      return { start: first, end: latest, label: "All time" };
    if (period === "1m")
      return { start: latest, end: latest, label: "Last month" };
    if (period === "3m") {
      const start = allMonths[Math.max(0, idx - 2)];
      return { start, end: latest, label: "Last 3 months" };
    }
    if (period === "6m") {
      const start = allMonths[Math.max(0, idx - 5)];
      return { start, end: latest, label: "Last 6 months" };
    }
    if (period === "ytd") {
      const y = latest.slice(0, 4);
      const start = `${y}-01`;
      return {
        start: start < first ? first : start,
        end: latest,
        label: `${y} YTD`,
      };
    }
    return { start: first, end: latest, label: "All time" };
  }, [allMonths, latest, period]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (channel !== "all" && r.platform !== channel) return false;
        if (segment !== "all" && r.segment !== segment) return false;
        if (monthRange.start && r.month < monthRange.start) return false;
        if (monthRange.end && r.month > monthRange.end) return false;
        return true;
      }),
    [rows, channel, segment, monthRange.start, monthRange.end],
  );

  const agg = useMemo(() => aggregate(filtered), [filtered]);

  const isFiltered =
    period !== DEFAULTS.period ||
    channel !== DEFAULTS.channel ||
    segment !== DEFAULTS.segment ||
    metric !== DEFAULTS.metric;

  const reset = () => {
    setPeriod(DEFAULTS.period);
    setChannel(DEFAULTS.channel);
    setSegment(DEFAULTS.segment);
    setMetric(DEFAULTS.metric);
  };

  const [selectedCustKey, setSelectedCustKey] = useState<string | null>(null);

  const customerDetail = useMemo<CustomerDetail | null>(() => {
    if (!selectedCustKey) return null;
    const orders = rows.filter((r) => r.custKey === selectedCustKey);
    if (!orders.length) return null;
    const sorted = orders.slice().sort((a, b) => {
      const ad = parseDate(a.date)?.getTime() ?? 0;
      const bd = parseDate(b.date)?.getTime() ?? 0;
      return bd - ad;
    });
    const dates = orders
      .map((r) => parseDate(r.date))
      .filter((d): d is Date => d instanceof Date && !Number.isNaN(+d));
    const latest = sorted[0];
    const minD = dates.length
      ? new Date(Math.min(...dates.map((d) => +d)))
      : null;
    const maxD = dates.length
      ? new Date(Math.max(...dates.map((d) => +d)))
      : null;
    const totalQty = orders.reduce((s, o) => s + o.qty, 0);
    const latestSegment: Segment =
      latest.segment === "Other" ? "New" : latest.segment;
    let phone = "";
    let region = "";
    for (const o of sorted) {
      if (!phone && o.phone) phone = o.phone;
      if (
        !region ||
        ((region === "Other / Unknown" || region === "—") &&
          o.region &&
          o.region !== "Other / Unknown")
      ) {
        region = o.region;
      }
      if (phone && region && region !== "Other / Unknown") break;
    }
    return {
      custKey: selectedCustKey,
      name: latest.name || "—",
      phone: phone || "—",
      region: region || "—",
      tier: latestSegment,
      totalQty,
      totalOrders: orders.length,
      firstDate: minD,
      lastDate: maxD,
      orders: sorted,
    };
  }, [selectedCustKey, rows]);

  const fetched = new Date(fetchedAt);

  return (
    <main
      className="min-h-dvh"
      style={{ backgroundColor: COLORS.bg, color: COLORS.ink }}
    >
      <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 sm:py-10">
        <Header
          title={title}
          agg={agg}
          fetchedAt={fetched}
          rangeLabel={monthRange.label}
        />

        <FilterBar
          period={period}
          setPeriod={setPeriod}
          channel={channel}
          setChannel={setChannel}
          segment={segment}
          setSegment={setSegment}
          metric={metric}
          setMetric={setMetric}
          isFiltered={isFiltered}
          reset={reset}
          activeRows={filtered.length}
          totalRows={rows.length}
          rangeLabel={monthRange.label}
        />

        {filtered.length === 0 ? (
          <NoMatch reset={reset} />
        ) : (
          <>
            <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              <KpiCard
                label="Total Orders"
                value={fmtInt(agg.kpis.orders)}
                sub={
                  agg.kpis.lastMonthLabel
                    ? `${agg.kpis.monthsCovered} months · last ${agg.kpis.lastMonthLabel}`
                    : `${agg.kpis.monthsCovered} months in range`
                }
                delta={agg.kpis.momOrders}
                emphasis={metric === "orders"}
              />
              <KpiCard
                label="Units Sold"
                value={fmtInt(agg.kpis.units)}
                sub={`Avg ${agg.kpis.avgUnits.toFixed(2)} units / order`}
                delta={agg.kpis.momUnits}
              />
              <KpiCard
                label="Unique Customers"
                value={fmtInt(agg.kpis.customers)}
                sub={`${fmtPct(agg.kpis.repeatRate)} returned ≥ 2x`}
                emphasis={metric === "customers"}
              />
            </section>

            <section className="mt-4 sm:mt-6">
              <Card>
                <CardHeader
                  eyebrow="Performance"
                  title={
                    metric === "customers"
                      ? "Monthly customers by platform"
                      : "Monthly orders by platform"
                  }
                  hint="Tokopedia + Shopee, stacked"
                />
                <MonthlyChart data={agg.monthlySeries} metric={metric} />
              </Card>
            </section>

            <section className="mt-4 grid gap-3 sm:mt-6 sm:gap-4 md:grid-cols-2">
              <Card>
                <CardHeader
                  eyebrow="Channel mix"
                  title="Tokopedia vs Shopee"
                  hint={`Share of ${metric}`}
                />
                <PlatformDonut
                  split={agg.platformSplit}
                  metric={metric}
                />
              </Card>
              <Card>
                <CardHeader
                  eyebrow="Customer mix"
                  title="New, Returning, VIP"
                  hint={`Share of ${metric} by segment`}
                />
                <CustomerMix mix={agg.customerMix} metric={metric} />
              </Card>
            </section>

            <section className="mt-4 grid gap-3 sm:mt-6 sm:gap-4 md:grid-cols-2">
              <RankCard
                eyebrow="Catalog"
                title="Top products"
                hint={
                  metric === "customers"
                    ? "Unique customers per SKU"
                    : "SKU appears across all order lines"
                }
                items={agg.topProducts.map((p) => ({
                  key: p.sku,
                  label: p.sku,
                  primary: metric === "customers" ? p.customers : p.orders,
                  sub:
                    metric === "customers"
                      ? `${fmtInt(p.orders)} orders`
                      : `≈ ${fmtInt(p.customers)} customers`,
                  color: COLORS.brand,
                }))}
                metricLabel={metric === "customers" ? "customers" : "orders"}
              />
              <RankCard
                eyebrow="Geography"
                title="Top regions"
                hint="Province inferred from shipping address"
                items={agg.topRegions.map((r) => ({
                  key: r.name,
                  label: r.name,
                  primary: metric === "customers" ? r.customers : r.orders,
                  sub: fmtPct(
                    (metric === "customers" ? r.customers : r.orders) /
                      Math.max(
                        metric === "customers"
                          ? agg.kpis.customers
                          : agg.kpis.orders,
                        1,
                      ),
                    1,
                  ),
                  color: COLORS.returning,
                }))}
                metricLabel={metric === "customers" ? "customers" : "orders"}
              />
            </section>

            <section className="mt-4 sm:mt-6">
              <Card>
                <CardHeader
                  eyebrow="Loyalty"
                  title="Top 10 customers"
                  hint="Tap a card to see full order history"
                />
                <TopCustomers
                  items={agg.topCustomers}
                  onSelect={setSelectedCustKey}
                />
              </Card>
            </section>
          </>
        )}

        <Footer
          agg={agg}
          fetchedAt={fetched}
          activeRows={filtered.length}
          totalRows={rows.length}
        />
      </div>

      <CustomerModal
        customer={customerDetail}
        onClose={() => setSelectedCustKey(null)}
      />
    </main>
  );
}

function Header({
  title,
  agg,
  fetchedAt,
  rangeLabel,
}: {
  title: string;
  agg: Aggregates;
  fetchedAt: Date;
  rangeLabel: string;
}) {
  return (
    <header
      className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-6 sm:pb-6"
      style={{ borderColor: COLORS.border }}
    >
      <div>
        <div
          className="text-[10px] font-medium uppercase tracking-[0.18em] sm:text-[11px]"
          style={{ color: COLORS.brand }}
        >
          Treelogy · Executive Dashboard
        </div>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:mt-2 sm:text-3xl md:text-[34px]">
          {title}
        </h1>
        <p className="mt-1 text-xs sm:text-sm" style={{ color: COLORS.muted }}>
          Customer & sales overview · Tokopedia + Shopee
        </p>
      </div>
      <div className="flex flex-col items-start gap-1 text-sm sm:items-end">
        <Pill>
          {fmtDate(agg.kpis.minDate)} — {fmtDate(agg.kpis.maxDate)} ·{" "}
          {rangeLabel}
        </Pill>
        <span
          className="text-[11px] sm:text-xs"
          style={{ color: COLORS.muted }}
        >
          Synced {fetchedAt.toLocaleString("en-GB", { hour12: false })}
        </span>
      </div>
    </header>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium"
      style={{
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface,
        color: COLORS.ink,
      }}
    >
      {children}
    </span>
  );
}

function FilterBar({
  period,
  setPeriod,
  channel,
  setChannel,
  segment,
  setSegment,
  metric,
  setMetric,
  isFiltered,
  reset,
  activeRows,
  totalRows,
  rangeLabel,
}: {
  period: Period;
  setPeriod: (p: Period) => void;
  channel: Channel;
  setChannel: (c: Channel) => void;
  segment: SegmentFilter;
  setSegment: (s: SegmentFilter) => void;
  metric: Metric;
  setMetric: (m: Metric) => void;
  isFiltered: boolean;
  reset: () => void;
  activeRows: number;
  totalRows: number;
  rangeLabel: string;
}) {
  const periodOptions: DropdownOption<Period>[] = [
    { value: "all", label: "All time" },
    { value: "1m", label: "Last 1 month" },
    { value: "3m", label: "Last 3 months" },
    { value: "6m", label: "Last 6 months" },
    { value: "ytd", label: "Year to date" },
  ];
  const channelOptions: DropdownOption<Channel>[] = [
    { value: "all", label: "All channels" },
    { value: "Tokopedia", label: "Tokopedia", dot: COLORS.tokopedia },
    { value: "Shopee", label: "Shopee", dot: COLORS.shopee },
  ];
  const segmentOptions: DropdownOption<SegmentFilter>[] = [
    { value: "all", label: "All segments" },
    { value: "New", label: "New customer", dot: COLORS.new },
    { value: "Returning", label: "Returning customer", dot: COLORS.returning },
    { value: "VIP", label: "VIP customer", dot: COLORS.vip },
  ];
  const metricOptions: DropdownOption<Metric>[] = [
    { value: "customers", label: "View by customers" },
    { value: "orders", label: "View by orders" },
  ];

  return (
    <div className="mt-5 sm:mt-6">
      <div className="flex flex-wrap items-center gap-2">
        <DropdownFilter
          icon={<CalendarIcon />}
          value={period}
          options={periodOptions}
          onChange={setPeriod}
          buttonLabel={(o) => o.label}
        />
        <DropdownFilter
          icon={<StoreIcon />}
          value={channel}
          options={channelOptions}
          onChange={setChannel}
          buttonLabel={(o) => o.label}
        />
        <DropdownFilter
          icon={<UserIcon />}
          value={segment}
          options={segmentOptions}
          onChange={setSegment}
          buttonLabel={(o) =>
            o.value === "all" ? "All segments" : (o.value as string)
          }
        />
        <DropdownFilter
          icon={<BarsIcon />}
          value={metric}
          options={metricOptions}
          onChange={setMetric}
          buttonLabel={(o) =>
            o.value === "customers" ? "Customers" : "Orders"
          }
        />
        {isFiltered && (
          <button
            type="button"
            onClick={reset}
            className="ml-1 cursor-pointer rounded-full px-2.5 py-1.5 text-[12px] font-medium underline-offset-2 transition hover:underline"
            style={{ color: COLORS.muted }}
          >
            Reset
          </button>
        )}
      </div>
      <div
        className="mt-2.5 px-1 text-[11px] sm:text-xs"
        style={{ color: COLORS.muted }}
      >
        Showing{" "}
        <span
          className="font-semibold tabular-nums"
          style={{ color: COLORS.ink }}
        >
          {fmtInt(activeRows)}
        </span>{" "}
        of {fmtInt(totalRows)} orders · {rangeLabel}
      </div>
    </div>
  );
}

type DropdownOption<V extends string> = {
  value: V;
  label: string;
  dot?: string;
};

function DropdownFilter<V extends string>({
  icon,
  value,
  options,
  onChange,
  buttonLabel,
}: {
  icon: React.ReactNode;
  value: V;
  options: DropdownOption<V>[];
  onChange: (v: V) => void;
  buttonLabel: (selected: DropdownOption<V>) => string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) ?? options[0];
  const isDefault = options[0].value === value;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border bg-white px-3 py-2 text-[13px] font-medium leading-none transition focus:outline-none"
        style={{
          borderColor: open
            ? COLORS.brand
            : isDefault
              ? COLORS.border
              : COLORS.brand,
          color: COLORS.ink,
          boxShadow: open
            ? `0 0 0 3px ${COLORS.brandSoft}`
            : isDefault
              ? "0 1px 2px rgba(0,0,0,0.04)"
              : `0 0 0 2px ${COLORS.brandSoft}`,
        }}
      >
        <span
          className="inline-flex"
          style={{ color: isDefault ? COLORS.muted : COLORS.brand }}
        >
          {selected.dot ? (
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: selected.dot }}
            />
          ) : (
            icon
          )}
        </span>
        <span className="whitespace-nowrap">{buttonLabel(selected)}</span>
        <Chevron open={open} />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-30 mt-2 min-w-[210px] overflow-hidden rounded-xl border bg-white"
          style={{
            borderColor: COLORS.border,
            boxShadow:
              "0 12px 32px -10px rgba(16, 34, 26, 0.18), 0 4px 12px -4px rgba(16, 34, 26, 0.08)",
          }}
        >
          <ul className="py-1">
            {options.map((o) => {
              const active = o.value === value;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-[13px] transition hover:bg-[rgba(0,0,0,0.03)]"
                    style={{
                      backgroundColor: active ? COLORS.bg : "transparent",
                      color: COLORS.ink,
                    }}
                  >
                    <span className="flex items-center gap-2">
                      {o.dot && (
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: o.dot }}
                        />
                      )}
                      <span>{o.label}</span>
                    </span>
                    {active && (
                      <span style={{ color: COLORS.brand }}>
                        <CheckIcon />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Chevron({
  open,
  className = "",
}: {
  open: boolean;
  className?: string;
}) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 transition-transform ${open ? "rotate-180" : ""} ${className}`}
      style={{ color: COLORS.muted }}
    >
      <polyline points="5,8 10,13 15,8" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function StoreIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 9l1.5-5h15L21 9" />
      <path d="M4 9v11h16V9" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function BarsIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="3" y1="20" x2="21" y2="20" />
      <rect x="6" y="11" width="3" height="9" />
      <rect x="11" y="6" width="3" height="14" />
      <rect x="16" y="14" width="3" height="6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function NoMatch({ reset }: { reset: () => void }) {
  return (
    <div
      className="mt-6 rounded-2xl border p-8 text-center"
      style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}
    >
      <div className="text-base font-semibold">No orders match filters</div>
      <p className="mt-1 text-sm" style={{ color: COLORS.muted }}>
        Try widening the period or clearing channel/segment.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 cursor-pointer rounded-full border px-4 py-2 text-sm font-medium"
        style={{
          backgroundColor: COLORS.brand,
          borderColor: COLORS.brand,
          color: "#fff",
        }}
      >
        Reset filters
      </button>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border"
      style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}
    >
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}

function CardHeader({
  eyebrow,
  title,
  hint,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-4 sm:mb-5">
      <div
        className="text-[10px] font-medium uppercase tracking-[0.18em] sm:text-[11px]"
        style={{ color: COLORS.brand }}
      >
        {eyebrow}
      </div>
      <h2 className="mt-1 text-base font-semibold tracking-tight sm:text-lg">
        {title}
      </h2>
      {hint && (
        <p
          className="mt-0.5 text-[11px] sm:text-xs"
          style={{ color: COLORS.muted }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  delta,
  tone = "primary",
  emphasis = false,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
  tone?: "primary" | "muted";
  emphasis?: boolean;
}) {
  return (
    <div
      className="rounded-2xl border p-4 transition-shadow sm:p-5"
      style={{
        backgroundColor: COLORS.surface,
        borderColor: emphasis ? COLORS.brand : COLORS.border,
        boxShadow: emphasis
          ? "0 0 0 1px rgba(14,94,69,0.18)"
          : undefined,
      }}
    >
      <div
        className="text-[10px] font-medium uppercase tracking-[0.16em] sm:text-[11px] sm:tracking-[0.18em]"
        style={{ color: COLORS.muted }}
      >
        {label}
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-x-2 gap-y-1 sm:mt-3">
        <div
          className="text-[26px] font-semibold leading-none tracking-tight tabular-nums sm:text-[34px]"
          style={{ color: tone === "primary" ? COLORS.ink : COLORS.muted }}
        >
          {value}
        </div>
        {delta !== undefined && delta !== null && <DeltaBadge value={delta} />}
      </div>
      {sub && (
        <div
          className="mt-2 text-[11px] leading-snug sm:mt-3 sm:text-xs"
          style={{ color: COLORS.muted }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function DeltaBadge({ value }: { value: number }) {
  const positive = value >= 0;
  const color = positive ? COLORS.returning : COLORS.shopee;
  const arrow = positive ? "▲" : "▼";
  return (
    <span
      className="ml-1 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums"
      style={{ color, backgroundColor: positive ? "#E6F1EC" : "#F4E0D6" }}
    >
      {arrow} {fmtPct(Math.abs(value))}
    </span>
  );
}

function MonthlyChart({
  data,
  metric,
}: {
  data: Aggregates["monthlySeries"];
  metric: Metric;
}) {
  if (data.length === 0) return <Empty />;
  const W = 1180;
  const H = 340;
  const P = { l: 56, r: 32, t: 36, b: 44 };
  const innerW = W - P.l - P.r;
  const innerH = H - P.t - P.b;

  const valToko = (
    d: Aggregates["monthlySeries"][number],
  ): number =>
    metric === "customers" ? d.tokopediaCustomers : d.tokopediaOrders;
  const valShopee = (
    d: Aggregates["monthlySeries"][number],
  ): number =>
    metric === "customers"
      ? d.shopeeCustomers + d.otherCustomers
      : d.shopeeOrders + d.otherOrders;

  const max = Math.max(...data.map((d) => valToko(d) + valShopee(d)), 1);
  const ticks = niceTicks(max, 4);
  const tickMax = ticks[ticks.length - 1];
  const barW = innerW / data.length;
  const innerBarW = Math.max(barW * 0.62, 6);
  const x = (i: number) => P.l + i * barW + (barW - innerBarW) / 2;
  const y = (v: number) => P.t + (1 - v / tickMax) * innerH;

  return (
    <div>
      <div
        className="-mx-1 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "thin" }}
      >
        <div className="inline-block min-w-full px-3">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="Monthly performance by platform"
            style={{
              width: "100%",
              minWidth: 540,
              height: "auto",
              display: "block",
              overflow: "visible",
            }}
            preserveAspectRatio="xMinYMid meet"
          >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={P.l}
                x2={W - P.r}
                y1={y(t)}
                y2={y(t)}
                stroke={COLORS.grid}
                strokeWidth={1}
              />
              <text
                x={P.l - 10}
                y={y(t) + 4}
                fontSize={12}
                textAnchor="end"
                fill={COLORS.muted}
              >
                {fmtInt(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const t = valToko(d);
            const s = valShopee(d);
            const total = t + s;
            const top = y(total);
            const tokoH = (t / tickMax) * innerH;
            const shopeeH = (s / tickMax) * innerH;
            const center = x(i) + innerBarW / 2;
            return (
              <g key={d.month}>
                <rect
                  x={x(i)}
                  y={top}
                  width={innerBarW}
                  height={tokoH}
                  rx={3}
                  fill={COLORS.tokopedia}
                />
                <rect
                  x={x(i)}
                  y={top + tokoH}
                  width={innerBarW}
                  height={shopeeH}
                  rx={3}
                  fill={COLORS.shopee}
                  opacity={0.95}
                />
                <text
                  x={center}
                  y={H - P.b + 22}
                  fontSize={12}
                  textAnchor="middle"
                  fill={COLORS.muted}
                >
                  {d.label}
                </text>
              </g>
            );
          })}
          {data.map((d, i) => {
            const t = valToko(d);
            const s = valShopee(d);
            const total = t + s;
            const top = y(total);
            const barH = ((t + s) / tickMax) * innerH;
            const center = x(i) + innerBarW / 2;
            const labelText = fmtInt(total);
            const insideBar = barH >= 30;
            return (
              <text
                key={`label-${d.month}`}
                x={center}
                y={insideBar ? top + 20 : top - 8}
                fontSize={12}
                textAnchor="middle"
                fontWeight={600}
                fill={insideBar ? "#FFFFFF" : COLORS.ink}
              >
                {labelText}
              </text>
            );
          })}
          <line
            x1={P.l}
            x2={W - P.r}
            y1={H - P.b}
            y2={H - P.b}
            stroke={COLORS.border}
            strokeWidth={1}
          />
          </svg>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-[11px] sm:text-xs">
        <Legend color={COLORS.tokopedia} label="Tokopedia" />
        <Legend color={COLORS.shopee} label="Shopee" />
        <span
          className="ml-auto text-[10px] sm:hidden"
          style={{ color: COLORS.muted }}
        >
          ← geser untuk lihat semua bulan →
        </span>
      </div>
    </div>
  );
}

function PlatformDonut({
  split,
  metric,
}: {
  split: Aggregates["platformSplit"];
  metric: Metric;
}) {
  const colorFor = (name: string) =>
    name.toLowerCase() === "tokopedia"
      ? COLORS.tokopedia
      : name.toLowerCase() === "shopee"
        ? COLORS.shopee
        : COLORS.muted;
  const total = split.reduce(
    (s, x) => s + (metric === "customers" ? x.customers : x.orders),
    0,
  );
  const items = split.map((s) => ({
    name: s.name,
    value: metric === "customers" ? s.customers : s.orders,
    sub:
      metric === "customers"
        ? `${fmtInt(s.orders)} orders`
        : `${fmtInt(s.customers)} customers`,
    color: colorFor(s.name),
  }));

  return (
    <div className="flex flex-col items-center gap-5 sm:grid sm:grid-cols-[auto_1fr] sm:items-center sm:gap-6">
      <Donut
        items={items}
        size={172}
        centerTop={fmtInt(total)}
        centerSub={metric === "customers" ? "customers" : "orders"}
      />
      <div className="flex w-full flex-col gap-3">
        {items.map((it) => (
          <div
            key={it.name}
            className="flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: it.color }}
              />
              <span className="text-sm font-medium">{it.name}</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold tabular-nums">
                {fmtInt(it.value)}
              </div>
              <div
                className="text-[11px]"
                style={{ color: COLORS.muted }}
              >
                {fmtPct(it.value / Math.max(total, 1), 1)} · {it.sub}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomerMix({
  mix,
  metric,
}: {
  mix: Aggregates["customerMix"];
  metric: Metric;
}) {
  const colorFor = (t: string) =>
    t === "VIP"
      ? COLORS.vip
      : t === "Returning"
        ? COLORS.returning
        : COLORS.new;
  const total = mix.reduce(
    (s, x) => s + (metric === "customers" ? x.customers : x.orders),
    0,
  );
  const items = mix.map((m) => ({
    name: m.type,
    value: metric === "customers" ? m.customers : m.orders,
    sub:
      metric === "customers"
        ? `${fmtInt(m.orders)} orders`
        : `${fmtInt(m.customers)} customers`,
    color: colorFor(m.type),
  }));
  return (
    <div>
      <div
        className="flex h-3 overflow-hidden rounded-full"
        style={{ backgroundColor: COLORS.bg }}
      >
        {items.map((it) => (
          <div
            key={it.name}
            style={{
              width: `${(it.value / Math.max(total, 1)) * 100}%`,
              backgroundColor: it.color,
            }}
          />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:mt-5 sm:gap-3">
        {items.map((it) => (
          <div
            key={it.name}
            className="rounded-xl border p-2.5 sm:p-3"
            style={{ borderColor: COLORS.border }}
          >
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5"
                style={{ backgroundColor: it.color }}
              />
              <span
                className="text-[10px] font-medium uppercase tracking-wider sm:text-xs"
                style={{ color: COLORS.muted }}
              >
                {it.name}
              </span>
            </div>
            <div className="mt-1.5 text-xl font-semibold tabular-nums leading-none sm:mt-2 sm:text-2xl">
              {fmtInt(it.value)}
            </div>
            <div
              className="mt-1 text-[10px] leading-tight sm:text-[11px]"
              style={{ color: COLORS.muted }}
            >
              {fmtPct(it.value / Math.max(total, 1), 1)} · {it.sub}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RankCard({
  eyebrow,
  title,
  hint,
  items,
  metricLabel,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
  items: {
    key: string;
    label: string;
    primary: number;
    sub: string;
    color: string;
  }[];
  metricLabel: string;
}) {
  const sorted = [...items].sort((a, b) => b.primary - a.primary);
  const max = sorted[0]?.primary ?? 1;
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <CardHeader eyebrow={eyebrow} title={title} hint={hint} />
        <span
          className="text-[10px] font-medium uppercase tracking-wider"
          style={{ color: COLORS.muted }}
        >
          by {metricLabel}
        </span>
      </div>
      <div className="space-y-3">
        {sorted.map((p) => (
          <div
            key={p.key}
            className="grid grid-cols-[1fr_auto] items-center gap-3"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{p.label}</div>
              <div
                className="mt-1 h-2 rounded-full"
                style={{ backgroundColor: COLORS.bg }}
              >
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${(p.primary / Math.max(max, 1)) * 100}%`,
                    backgroundColor: p.color,
                  }}
                />
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold tabular-nums">
                {fmtInt(p.primary)}
              </div>
              <div
                className="text-[11px]"
                style={{ color: COLORS.muted }}
              >
                {p.sub}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TopCustomers({
  items,
  onSelect,
}: {
  items: Aggregates["topCustomers"];
  onSelect: (custKey: string) => void;
}) {
  const sorted = [...items].sort(
    (a, b) => b.orders - a.orders || b.qty - a.qty,
  );
  return (
    <>
      <div className="space-y-2 sm:hidden">
        {sorted.map((c, i) => {
          const big = c.orders;
          const small = `${fmtInt(c.qty)} units`;
          return (
            <button
              type="button"
              key={`${c.custKey}-${i}-m`}
              onClick={() => onSelect(c.custKey)}
              className="w-full cursor-pointer rounded-xl border p-3 text-left transition active:scale-[0.99]"
              style={{ borderColor: COLORS.border, backgroundColor: COLORS.surface }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-medium tabular-nums"
                      style={{ color: COLORS.muted }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="truncate text-sm font-medium">
                      {c.name}
                    </span>
                    <TierTag segment={c.latestSegment} />
                  </div>
                  <div
                    className="mt-0.5 truncate text-[11px]"
                    style={{ color: COLORS.muted }}
                  >
                    {c.region}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <div>
                    <div className="text-base font-semibold tabular-nums leading-none">
                      {fmtInt(big)}
                    </div>
                    <div
                      className="mt-1 text-[11px] tabular-nums"
                      style={{ color: COLORS.muted }}
                    >
                      {small}
                    </div>
                  </div>
                  <ChevronRight />
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div
        className="hidden overflow-hidden rounded-xl border sm:block"
        style={{ borderColor: COLORS.border }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-left text-[11px] uppercase tracking-wider"
              style={{ color: COLORS.muted, backgroundColor: COLORS.bg }}
            >
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-4 py-2 font-medium">Customer</th>
              <th className="px-4 py-2 font-medium">Tier</th>
              <th className="px-4 py-2 font-medium">Region</th>
              <th className="px-4 py-2 text-right font-medium">Orders</th>
              <th className="px-4 py-2 text-right font-medium">Units</th>
              <th className="w-8 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => (
              <tr
                key={`${c.custKey}-${i}`}
                onClick={() => onSelect(c.custKey)}
                className="cursor-pointer border-t transition hover:bg-[rgba(0,0,0,0.02)]"
                style={{ borderColor: COLORS.border }}
              >
                <td
                  className="px-4 py-3 text-[12px]"
                  style={{ color: COLORS.muted }}
                >
                  {String(i + 1).padStart(2, "0")}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{c.name}</div>
                  <div
                    className="text-[11px]"
                    style={{ color: COLORS.muted }}
                  >
                    {c.phone}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <TierTag segment={c.latestSegment} />
                </td>
                <td
                  className="px-4 py-3 text-[13px]"
                  style={{ color: COLORS.muted }}
                >
                  {c.region}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  {fmtInt(c.orders)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {fmtInt(c.qty)}
                </td>
                <td className="pr-3 text-right">
                  <ChevronRight />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TierTag({ segment }: { segment: Segment }) {
  if (segment === "Other") return null;
  const color =
    segment === "VIP"
      ? COLORS.vip
      : segment === "Returning"
        ? COLORS.returning
        : COLORS.new;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: `${color}1A`, color }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {segment}
    </span>
  );
}

function ChevronRight() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
      style={{ color: COLORS.muted }}
    >
      <polyline points="8,5 13,10 8,15" />
    </svg>
  );
}

type CustomerDetail = {
  custKey: string;
  name: string;
  phone: string;
  region: string;
  tier: Segment;
  totalQty: number;
  totalOrders: number;
  firstDate: Date | null;
  lastDate: Date | null;
  orders: CompactRow[];
};

function CustomerModal({
  customer,
  onClose,
}: {
  customer: CustomerDetail | null;
  onClose: () => void;
}) {
  const [show, setShow] = useState(false);
  const [renderCustomer, setRenderCustomer] = useState<CustomerDetail | null>(
    null,
  );

  useEffect(() => {
    if (customer) {
      setRenderCustomer(customer);
      const id = requestAnimationFrame(() => setShow(true));
      return () => cancelAnimationFrame(id);
    }
    setShow(false);
    const t = setTimeout(() => setRenderCustomer(null), 320);
    return () => clearTimeout(t);
  }, [customer]);

  useEffect(() => {
    if (!renderCustomer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [renderCustomer]);

  useEffect(() => {
    if (!renderCustomer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [renderCustomer, onClose]);

  if (!renderCustomer) return null;

  const tierColor =
    renderCustomer.tier === "VIP"
      ? COLORS.vip
      : renderCustomer.tier === "Returning"
        ? COLORS.returning
        : COLORS.new;

  const range =
    renderCustomer.firstDate && renderCustomer.lastDate
      ? `${fmtDate(renderCustomer.firstDate)} → ${fmtDate(renderCustomer.lastDate)}`
      : "—";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        onClick={onClose}
        aria-hidden
        className={`absolute inset-0 bg-black/45 transition-opacity duration-300 ${
          show ? "opacity-100 backdrop-blur-sm" : "opacity-0"
        }`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${renderCustomer.name} details`}
        className={`relative flex w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white transition-all duration-300 ease-out sm:max-w-lg sm:rounded-2xl ${
          show
            ? "translate-y-0 opacity-100 sm:scale-100"
            : "translate-y-full opacity-0 sm:translate-y-0 sm:scale-95"
        }`}
        style={{
          maxHeight: "min(88vh, 760px)",
          boxShadow:
            "0 -10px 40px -10px rgba(16,34,26,0.30), 0 0 0 1px rgba(16,34,26,0.04)",
        }}
      >
        <div className="relative shrink-0 px-5 pb-3 pt-3 sm:px-7 sm:pb-4 sm:pt-5">
          <div className="mx-auto h-1 w-10 rounded-full bg-stone-300/80 sm:hidden" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 cursor-pointer rounded-full p-2 transition hover:bg-[rgba(0,0,0,0.05)] sm:right-4 sm:top-4"
          >
            <CloseIcon />
          </button>
          <div className="mt-2 flex items-start gap-3 pr-9 sm:mt-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{
                    backgroundColor: `${tierColor}1A`,
                    color: tierColor,
                  }}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: tierColor }}
                  />
                  {renderCustomer.tier} Customer
                </span>
              </div>
              <h3 className="mt-2 truncate text-xl font-semibold tracking-tight sm:text-2xl">
                {renderCustomer.name}
              </h3>
              <p
                className="mt-1 text-sm"
                style={{ color: COLORS.muted }}
              >
                {renderCustomer.region} · {renderCustomer.phone}
              </p>
            </div>
          </div>
        </div>

        <div
          className="border-t px-5 py-4 sm:px-7"
          style={{ borderColor: COLORS.border }}
        >
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <Stat
              label="Orders"
              value={fmtInt(renderCustomer.totalOrders)}
            />
            <Stat label="Units" value={fmtInt(renderCustomer.totalQty)} />
          </div>
          <div
            className="mt-3 text-[11px]"
            style={{ color: COLORS.muted }}
          >
            Active period · {range}
          </div>
        </div>

        <div
          className="flex min-h-0 flex-1 flex-col border-t"
          style={{ borderColor: COLORS.border }}
        >
          <div className="flex items-center justify-between px-5 pb-2 pt-4 sm:px-7">
            <div
              className="text-[10px] font-medium uppercase tracking-[0.18em] sm:text-[11px]"
              style={{ color: COLORS.brand }}
            >
              Order History
            </div>
            <span
              className="text-[11px] tabular-nums"
              style={{ color: COLORS.muted }}
            >
              {fmtInt(renderCustomer.orders.length)} orders
            </span>
          </div>
          <ul
            className="min-h-0 flex-1 overflow-y-auto px-3 pb-5 sm:px-5"
            style={{ overscrollBehavior: "contain" }}
          >
            {renderCustomer.orders.map((o, i) => {
              const segColor =
                o.segment === "VIP"
                  ? COLORS.vip
                  : o.segment === "Returning"
                    ? COLORS.returning
                    : COLORS.new;
              return (
                <li
                  key={`${o.date}-${i}`}
                  className="rounded-xl px-3 py-2.5 transition hover:bg-[rgba(0,0,0,0.02)] sm:px-3 sm:py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {formatRowDate(o.date)}
                      </div>
                      {o.segment !== "Other" && (
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                            style={{
                              backgroundColor: `${segColor}1A`,
                              color: segColor,
                            }}
                          >
                            {o.segment}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold tabular-nums">
                        {fmtInt(o.qty)}{" "}
                        <span
                          className="text-[11px] font-normal"
                          style={{ color: COLORS.muted }}
                        >
                          units
                        </span>
                      </div>
                      <div
                        className="mt-0.5 max-w-[180px] truncate text-[11px]"
                        style={{ color: COLORS.muted }}
                      >
                        {o.skus.length ? o.skus.join(", ") : "—"}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  small = false,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: COLORS.border, backgroundColor: COLORS.bg }}
    >
      <div
        className="text-[10px] font-medium uppercase tracking-wider"
        style={{ color: COLORS.muted }}
      >
        {label}
      </div>
      <div
        className={`mt-1 font-semibold tabular-nums leading-tight ${small ? "text-[13px] sm:text-sm" : "text-lg sm:text-xl"}`}
      >
        {value}
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ color: COLORS.muted }}
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function formatRowDate(s: string): string {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return s || "—";
  const d = new Date(+m[3], +m[2] - 1, +m[1]);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Donut({
  items,
  size = 180,
  centerTop,
  centerSub,
}: {
  items: { name: string; value: number; color: string }[];
  size?: number;
  centerTop?: string;
  centerSub?: string;
}) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const r = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;
  const stroke = 22;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={COLORS.bg}
        strokeWidth={stroke}
      />
      {items.map((it) => {
        const start = (acc / total) * 2 * Math.PI - Math.PI / 2;
        acc += it.value;
        const end = (acc / total) * 2 * Math.PI - Math.PI / 2;
        const large = end - start > Math.PI ? 1 : 0;
        const x1 = cx + r * Math.cos(start);
        const y1 = cy + r * Math.sin(start);
        const x2 = cx + r * Math.cos(end);
        const y2 = cy + r * Math.sin(end);
        const d = `M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2}`;
        return (
          <path
            key={it.name}
            d={d}
            fill="none"
            stroke={it.color}
            strokeWidth={stroke}
            strokeLinecap="butt"
          />
        );
      })}
      {centerTop && (
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          fontSize={22}
          fontWeight={600}
          fill={COLORS.ink}
        >
          {centerTop}
        </text>
      )}
      {centerSub && (
        <text
          x={cx}
          y={cy + 18}
          textAnchor="middle"
          fontSize={11}
          fill={COLORS.muted}
        >
          {centerSub}
        </text>
      )}
    </svg>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-2"
      style={{ color: COLORS.muted }}
    >
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function Empty() {
  return (
    <div
      className="flex h-40 items-center justify-center rounded-xl border text-sm"
      style={{ borderColor: COLORS.border, color: COLORS.muted }}
    >
      No data
    </div>
  );
}

function Footer({
  agg,
  fetchedAt,
  activeRows,
  totalRows,
}: {
  agg: Aggregates;
  fetchedAt: Date;
  activeRows: number;
  totalRows: number;
}) {
  return (
    <footer
      className="mt-10 border-t pt-5 text-xs"
      style={{ borderColor: COLORS.border, color: COLORS.muted }}
    >
      Source: Customer Data · Purchase Order ·{" "}
      {fmtInt(activeRows)} of {fmtInt(totalRows)} orders shown ·{" "}
      {fmtInt(agg.kpis.units)} units · synced{" "}
      {fetchedAt.toLocaleString("en-GB", { hour12: false })}.
    </footer>
  );
}

function niceTicks(max: number, count: number): number[] {
  if (max <= 0) return [0, 1];
  const exp = Math.floor(Math.log10(max));
  const base = Math.pow(10, exp);
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * base);
  let step = candidates[0];
  for (const c of candidates) {
    if (max / c <= count) {
      step = c;
      break;
    }
  }
  const maxTick = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= maxTick; v += step) ticks.push(v);
  return ticks;
}
