"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/src/lib/supabase/client";
import Spinner from "@/src/components/Spinner";

const formatRupee = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const COMMISSION_RATE = 0.1; // 10% marketplace commission

type Payout = {
  id: string;
  amount: number;
  status: string;
  method: string | null;
  reference: string | null;
  created_at: string;
};

type DailyData = {
  date: string;
  revenue: number;
  orders: number;
};

export default function FinancesContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Balance metrics
  const [totalEarned, setTotalEarned] = useState(0);
  const [totalCommission, setTotalCommission] = useState(0);
  const [totalPaidOut, setTotalPaidOut] = useState(0);
  const [pendingRevenue, setPendingRevenue] = useState(0);

  // Recent payouts
  const [payouts, setPayouts] = useState<Payout[]>([]);

  // Tooltip state
  const [showTooltip, setShowTooltip] = useState(false);

  // NEW: Daily sales & orders data
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [todayOrders, setTodayOrders] = useState(0);
  const [yesterdayRevenue, setYesterdayRevenue] = useState(0);
  const [yesterdayOrders, setYesterdayOrders] = useState(0);

  // NEW: Day-one metrics
  const [firstSaleDate, setFirstSaleDate] = useState<string | null>(null);
  const [dayOneRevenue, setDayOneRevenue] = useState(0);
  const [dayOneOrders, setDayOneOrders] = useState(0);
  const [daysSinceFirstSale, setDaysSinceFirstSale] = useState(0);
  const [totalLifetimeOrders, setTotalLifetimeOrders] = useState(0);

  // Week range selector (index into weekRanges array, 0 = most recent week)
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(0);

  const loadFinances = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("Please sign in.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_uid", userData.user.id)
      .maybeSingle();

    if (!profile) {
      setError("Profile not found.");
      setLoading(false);
      return;
    }

    const { data: seller } = await supabase
      .from("sellers")
      .select("id")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (!seller) {
      setError("Seller account not found.");
      setLoading(false);
      return;
    }

    // Get all seller listings
    const { data: listings } = await supabase
      .from("seller_listings")
      .select("id")
      .eq("seller_id", seller.id);

    if (!listings || listings.length === 0) {
      setLoading(false);
      return;
    }

    const listingIds = listings.map((l) => l.id);

    // Fetch ALL order items for this seller (no date filter - we need lifetime data)
    const { data: allItems } = await supabase
      .from("order_items")
      .select("id, quantity, price_at_purchase, order_id, orders(id, status, created_at)")
      .in("seller_listing_id", listingIds);

    const revenueStatuses = ["confirmed", "processing", "shipped", "in_transit", "out_for_delivery", "delivered"];
    const pendingStatuses = ["confirmed", "processing", "shipped", "in_transit", "out_for_delivery"];

    if (allItems && allItems.length > 0) {
      let earned = 0;
      let pending = 0;

      // For daily aggregation
      const dailyMap: Record<string, { revenue: number; orderIds: Set<string> }> = {};
      let earliestDate: string | null = null;
      const allOrderIds = new Set<string>();

      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

      let todayRev = 0;
      let todayOrd = new Set<string>();
      let yesterdayRev = 0;
      let yesterdayOrd = new Set<string>();

      for (const item of allItems) {
        const order = item.orders as unknown as { id: string; status: string; created_at: string } | null;
        if (!order) continue;

        const amount = Number(item.price_at_purchase) * Number(item.quantity);

        if (revenueStatuses.includes(order.status)) {
          earned += amount;
          allOrderIds.add(item.order_id);

          // Daily aggregation
          const day = order.created_at?.slice(0, 10);
          if (day) {
            if (!dailyMap[day]) {
              dailyMap[day] = { revenue: 0, orderIds: new Set() };
            }
            dailyMap[day].revenue += amount;
            dailyMap[day].orderIds.add(item.order_id);

            // Track earliest date
            if (!earliestDate || day < earliestDate) {
              earliestDate = day;
            }

            // Today/Yesterday
            if (day === today) {
              todayRev += amount;
              todayOrd.add(item.order_id);
            }
            if (day === yesterday) {
              yesterdayRev += amount;
              yesterdayOrd.add(item.order_id);
            }
          }
        }
        if (pendingStatuses.includes(order.status)) {
          pending += amount;
        }
      }

      setTotalEarned(earned);
      setTotalCommission(earned * COMMISSION_RATE);
      setPendingRevenue(pending);

      // Set today vs yesterday
      setTodayRevenue(todayRev);
      setTodayOrders(todayOrd.size);
      setYesterdayRevenue(yesterdayRev);
      setYesterdayOrders(yesterdayOrd.size);

      // Set day-one metrics
      setFirstSaleDate(earliestDate);
      if (earliestDate) {
        const diffMs = Date.now() - new Date(earliestDate).getTime();
        setDaysSinceFirstSale(Math.max(1, Math.floor(diffMs / 86400000)));
        // Day One revenue & orders
        const dayOneEntry = dailyMap[earliestDate];
        setDayOneRevenue(dayOneEntry?.revenue || 0);
        setDayOneOrders(dayOneEntry?.orderIds.size || 0);
      }
      setTotalLifetimeOrders(allOrderIds.size);

      // Build daily chart data (always 30 days, weeks are sliced in UI)
      const days = 30;
      const chartData: DailyData[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const entry = dailyMap[key];
        chartData.push({
          date: key,
          revenue: entry?.revenue || 0,
          orders: entry?.orderIds.size || 0,
        });
      }
      setDailyData(chartData);
    }

    // Fetch payouts
    const { data: payoutData } = await supabase
      .from("seller_payouts")
      .select("id, amount, status, method, reference, created_at")
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (payoutData) {
      setPayouts(
        payoutData.map((p) => ({
          ...p,
          amount: Number(p.amount),
        }))
      );
      const paidOut = payoutData
        .filter((p) => p.status === "completed")
        .reduce((sum, p) => sum + Number(p.amount), 0);
      setTotalPaidOut(paidOut);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadFinances();
  }, [loadFinances]);

  const netEarnings = totalEarned - totalCommission;
  const availableBalance = netEarnings - totalPaidOut;

  // Build week ranges from dailyData (most recent week first)
  const weekRanges = (() => {
    if (dailyData.length === 0) return [];
    // Build a map from date string -> DailyData
    const dataMap = new Map<string, DailyData>();
    dailyData.forEach((d) => dataMap.set(d.date, d));

    // Find the Monday of the earliest date's week and Sunday of today's week
    const today = new Date();
    const todayDay = today.getDay(); // 0=Sun
    const todaySun = new Date(today);
    todaySun.setDate(today.getDate() + (todayDay === 0 ? 0 : 7 - todayDay)); // end of this week (Sun)

    const earliest = new Date(dailyData[0].date);
    const earliestDay = earliest.getDay();
    const earliestMon = new Date(earliest);
    earliestMon.setDate(earliest.getDate() - (earliestDay === 0 ? 6 : earliestDay - 1)); // Monday of that week

    const ranges: { label: string; data: DailyData[] }[] = [];
    const cursor = new Date(earliestMon);

    while (cursor <= todaySun) {
      const weekData: DailyData[] = [];
      const weekStart = new Date(cursor);
      for (let d = 0; d < 7; d++) {
        const dateStr = cursor.toISOString().slice(0, 10);
        weekData.push(dataMap.get(dateStr) ?? { date: dateStr, revenue: 0, orders: 0 });
        cursor.setDate(cursor.getDate() + 1);
      }
      const s = weekStart;
      const e = new Date(cursor);
      e.setDate(e.getDate() - 1);
      const sMonth = s.toLocaleDateString("en-IN", { month: "short" });
      const eMonth = e.toLocaleDateString("en-IN", { month: "short" });
      const label = sMonth === eMonth
        ? `${s.getDate()}-${e.getDate()} ${sMonth}`
        : `${s.getDate()} ${sMonth} - ${e.getDate()} ${eMonth}`;
      ranges.push({ label, data: weekData });
    }
    // Reverse so most recent week is index 0
    return ranges.reverse();
  })();

  // Get filtered data for selected week
  const selectedWeekData = weekRanges[selectedWeekIdx]?.data ?? [];

  // Chart helpers (for selected week)
  const totalChartRevenue = selectedWeekData.reduce((s, d) => s + d.revenue, 0);
  const totalChartOrders = selectedWeekData.reduce((s, d) => s + d.orders, 0);

  // Percentage change helpers
  const revenueChange = yesterdayRevenue > 0
    ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
    : todayRevenue > 0 ? 100 : 0;
  const ordersChange = yesterdayOrders > 0
    ? ((todayOrders - yesterdayOrders) / yesterdayOrders) * 100
    : todayOrders > 0 ? 100 : 0;

  // Average daily revenue
  const avgDailyRevenue = daysSinceFirstSale > 0 ? totalEarned / daysSinceFirstSale : 0;

  return (

      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">Finances</h1>
              <p className="text-xs text-gray-500 mt-0.5">Manage your earnings, commissions, and payouts</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/seller/finances/payouts"
                className="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition"
              >
                View All Payouts
              </Link>
              <Link
                href="/seller/dashboard"
                className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 transition"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>

        <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center p-16">
              <Spinner />
            </div>
          ) : error ? (
            <div className="bg-white rounded-xl border border-red-200 p-6 text-center">
              <p className="text-sm text-red-600">{error}</p>
              <Link href="/seller/dashboard" className="text-xs text-indigo-500 font-semibold mt-2 inline-block">
                Return to Dashboard
              </Link>
            </div>
          ) : (
            <>
              {/* Balance Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Available Balance</span>
                  <p className="mt-1 text-2xl font-black text-indigo-500">{formatRupee(Math.max(availableBalance, 0))}</p>
                  <p className="text-[11px] text-gray-500 font-medium mt-1">Ready for withdrawal</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Pending</span>
                  <p className="mt-1 text-2xl font-black text-amber-600">{formatRupee(pendingRevenue)}</p>
                  <p className="text-[11px] text-gray-500 font-medium mt-1">From in-transit orders</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Total Earned</span>
                  <p className="mt-1 text-2xl font-black text-gray-900">{formatRupee(totalEarned)}</p>
                  <p className="text-[11px] text-gray-500 font-medium mt-1">Gross revenue (all time)</p>
                </div>
              </div>

              {/* Today vs Yesterday Comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Today&apos;s Revenue</span>
                    {revenueChange !== 0 && (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        revenueChange > 0
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-red-50 text-red-600"
                      }`}>
                        {revenueChange > 0 ? "+" : ""}{revenueChange.toFixed(0)}% vs yesterday
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-black text-gray-900">{formatRupee(todayRevenue)}</p>
                  <div className="mt-2 flex items-center gap-4">
                    <div className="text-[11px] text-gray-500">
                      <span className="font-semibold text-gray-700">Yesterday:</span> {formatRupee(yesterdayRevenue)}
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Today&apos;s Orders</span>
                    {ordersChange !== 0 && (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        ordersChange > 0
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-red-50 text-red-600"
                      }`}>
                        {ordersChange > 0 ? "+" : ""}{ordersChange.toFixed(0)}% vs yesterday
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-black text-indigo-600">{todayOrders}</p>
                  <div className="mt-2 flex items-center gap-4">
                    <div className="text-[11px] text-gray-500">
                      <span className="font-semibold text-gray-700">Yesterday:</span> {yesterdayOrders} orders
                    </div>
                  </div>
                </div>
              </div>

              {/* Weekly Revenue Chart — Google Fit Style */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 pt-4 pb-2 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Weekly Revenue</h3>
                  </div>
                </div>
                <div className="flex items-center justify-between px-4 pt-4 pb-1">
                  <button onClick={() => setSelectedWeekIdx(Math.min(selectedWeekIdx + 1, weekRanges.length - 1))} disabled={selectedWeekIdx >= weekRanges.length - 1} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed transition">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <div className="text-center">
                    <p className="text-[15px] font-semibold text-gray-900">{(() => { const wd = weekRanges[selectedWeekIdx]?.data; if (!wd || wd.length === 0) return ""; const s = new Date(wd[0].date); const e = new Date(wd[wd.length - 1].date); const sM = s.toLocaleDateString("en-IN", { month: "long" }); const eM = e.toLocaleDateString("en-IN", { month: "long" }); return sM === eM ? `${s.getDate()}\u2013${e.getDate()} ${sM}` : `${s.getDate()} ${sM} \u2013 ${e.getDate()} ${eM}`; })()}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatRupee(totalChartRevenue)}</p>
                  </div>
                  <button onClick={() => setSelectedWeekIdx(Math.max(selectedWeekIdx - 1, 0))} disabled={selectedWeekIdx <= 0} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed transition">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
                <div className="px-6 pb-2 pt-4">
                  {(() => {
                    const maxRev = Math.max(...selectedWeekData.map((d) => d.revenue), 1);
                    const todayStr = new Date().toISOString().slice(0, 10);
                    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                    const fmtShort = (v: number) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`;
                    return (
                      <div>
                        <div className="relative" style={{ height: 180 }}>
                          <div className="absolute inset-0 pointer-events-none" style={{ right: 36 }}>
                            <div className="absolute top-0 left-0 right-0 border-b border-dashed border-indigo-100" />
                            <div className="absolute top-1/2 left-0 right-0 border-b border-dashed border-indigo-100" />
                            <div className="absolute bottom-0 left-0 right-0 border-b border-indigo-200/60" />
                          </div>
                          <div className="absolute right-0 top-0 bottom-0 w-8 flex flex-col justify-between items-end pointer-events-none">
                            <span className="text-[10px] text-indigo-400 font-medium -translate-y-1.5">{fmtShort(maxRev)}</span>
                            {Math.floor(maxRev / 2) > 0 && Math.floor(maxRev / 2) !== maxRev ? (
                              <span className="text-[10px] text-indigo-300 -translate-y-1">{fmtShort(Math.floor(maxRev / 2))}</span>
                            ) : <span />}
                            <span className="text-[10px] text-gray-300">0</span>
                          </div>
                          <div className="flex items-end justify-around h-full" style={{ marginRight: 40 }}>
                            {selectedWeekData.map((d) => {
                              const pct = maxRev > 0 ? (d.revenue / maxRev) * 100 : 0;
                              const isToday = d.date === todayStr;
                              return (
                                <div key={d.date} className="flex-1 flex flex-col items-center h-full justify-end group relative mx-1">
                                  <div className="absolute -top-9 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                                    <div className="bg-indigo-600 text-white text-[10px] px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg font-medium">{formatRupee(d.revenue)}</div>
                                    <div className="border-4 border-transparent border-t-indigo-600" />
                                  </div>
                                  <div className={`w-full max-w-[28px] rounded-t-md transition-all duration-300 ${isToday ? "bg-gradient-to-t from-indigo-600 to-indigo-400 shadow-sm shadow-indigo-200" : d.revenue > 0 ? "bg-indigo-400/80 group-hover:bg-indigo-500" : "bg-gray-100"}`} style={{ height: d.revenue > 0 ? `${Math.max(pct, 6)}%` : '4%' }} />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex justify-around mt-2.5" style={{ marginRight: 40 }}>
                          {selectedWeekData.map((d) => { const isToday = d.date === todayStr; const dt = new Date(d.date); return (<div key={d.date} className="flex-1 text-center mx-1"><span className={`text-[11px] ${isToday ? "font-bold text-gray-900" : "text-gray-400"}`}>{dayNames[dt.getDay()]}</span></div>); })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className="border-t border-gray-100">
                  {selectedWeekData.filter((d) => d.revenue > 0).length === 0 ? (
                    <p className="text-xs text-gray-400 py-4 text-center">No revenue this week</p>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {selectedWeekData.slice().sort((a, b) => b.date.localeCompare(a.date)).filter((d) => d.revenue > 0).map((d) => {
                        const dt = new Date(d.date);
                        const isToday = d.date === new Date().toISOString().slice(0, 10);
                        return (<div key={d.date} className="px-6 py-3 flex items-center justify-between"><p className="text-xs text-gray-500">{isToday ? <span className="font-semibold text-gray-700">Today</span> : dt.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p><p className="text-sm font-bold text-gray-900">{formatRupee(d.revenue)}</p></div>);
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Weekly Orders Chart — Google Fit Style */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 pt-4 pb-2 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Weekly Orders</h3>
                  </div>
                </div>
                <div className="flex items-center justify-between px-4 pt-4 pb-1">
                  <button onClick={() => setSelectedWeekIdx(Math.min(selectedWeekIdx + 1, weekRanges.length - 1))} disabled={selectedWeekIdx >= weekRanges.length - 1} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed transition">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <div className="text-center">
                    <p className="text-[15px] font-semibold text-gray-900">{(() => { const wd = weekRanges[selectedWeekIdx]?.data; if (!wd || wd.length === 0) return ""; const s = new Date(wd[0].date); const e = new Date(wd[wd.length - 1].date); const sM = s.toLocaleDateString("en-IN", { month: "long" }); const eM = e.toLocaleDateString("en-IN", { month: "long" }); return sM === eM ? `${s.getDate()}\u2013${e.getDate()} ${sM}` : `${s.getDate()} ${sM} \u2013 ${e.getDate()} ${eM}`; })()}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{totalChartOrders} order{totalChartOrders !== 1 ? "s" : ""}</p>
                  </div>
                  <button onClick={() => setSelectedWeekIdx(Math.max(selectedWeekIdx - 1, 0))} disabled={selectedWeekIdx <= 0} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed transition">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
                <div className="px-6 pb-2 pt-4">
                  {(() => {
                    const maxOrd = Math.max(...selectedWeekData.map((d) => d.orders), 1);
                    const todayStr = new Date().toISOString().slice(0, 10);
                    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                    return (
                      <div>
                        <div className="relative" style={{ height: 180 }}>
                          <div className="absolute inset-0 pointer-events-none" style={{ right: 36 }}>
                            <div className="absolute top-0 left-0 right-0 border-b border-dashed border-emerald-100" />
                            <div className="absolute top-1/2 left-0 right-0 border-b border-dashed border-emerald-100" />
                            <div className="absolute bottom-0 left-0 right-0 border-b border-emerald-200/60" />
                          </div>
                          <div className="absolute right-0 top-0 bottom-0 w-8 flex flex-col justify-between items-end pointer-events-none">
                            <span className="text-[10px] text-emerald-400 font-medium -translate-y-1.5">{maxOrd}</span>
                            {Math.floor(maxOrd / 2) > 0 && Math.floor(maxOrd / 2) !== maxOrd ? (
                              <span className="text-[10px] text-emerald-300 -translate-y-1">{Math.floor(maxOrd / 2)}</span>
                            ) : <span />}
                            <span className="text-[10px] text-gray-300">0</span>
                          </div>
                          <div className="flex items-end justify-around h-full" style={{ marginRight: 40 }}>
                            {selectedWeekData.map((d) => {
                              const pct = maxOrd > 0 ? (d.orders / maxOrd) * 100 : 0;
                              const isToday = d.date === todayStr;
                              return (
                                <div key={d.date} className="flex-1 flex flex-col items-center h-full justify-end group relative mx-1">
                                  <div className="absolute -top-9 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                                    <div className="bg-emerald-600 text-white text-[10px] px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg font-medium">{d.orders} order{d.orders !== 1 ? "s" : ""}</div>
                                    <div className="border-4 border-transparent border-t-emerald-600" />
                                  </div>
                                  <div className={`w-full max-w-[28px] rounded-t-md transition-all duration-300 ${isToday ? "bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-sm shadow-emerald-200" : d.orders > 0 ? "bg-emerald-400/80 group-hover:bg-emerald-500" : "bg-gray-100"}`} style={{ height: d.orders > 0 ? `${Math.max(pct, 6)}%` : '4%' }} />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex justify-around mt-2.5" style={{ marginRight: 40 }}>
                          {selectedWeekData.map((d) => { const isToday = d.date === todayStr; const dt = new Date(d.date); return (<div key={d.date} className="flex-1 text-center mx-1"><span className={`text-[11px] ${isToday ? "font-bold text-gray-900" : "text-gray-400"}`}>{dayNames[dt.getDay()]}</span></div>); })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className="border-t border-gray-100">
                  {selectedWeekData.filter((d) => d.orders > 0).length === 0 ? (
                    <p className="text-xs text-gray-400 py-4 text-center">No orders this week</p>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {selectedWeekData.slice().sort((a, b) => b.date.localeCompare(a.date)).filter((d) => d.orders > 0).map((d) => {
                        const dt = new Date(d.date);
                        const isToday = d.date === new Date().toISOString().slice(0, 10);
                        return (<div key={d.date} className="px-6 py-3 flex items-center justify-between"><p className="text-xs text-gray-500">{isToday ? <span className="font-semibold text-gray-700">Today</span> : dt.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p><p className="text-sm font-bold text-gray-900">{d.orders} order{d.orders !== 1 ? "s" : ""}</p></div>);
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Day-One Sales & Growth */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-sm font-bold text-gray-900 mb-4">Growth Since Day One</h3>
                {firstSaleDate ? (
                  <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="bg-slate-50 rounded-lg p-4 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">First Sale Date</p>
                      <p className="text-sm font-black text-gray-900">
                        {new Date(firstSaleDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-4 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 mb-1">Day One Revenue</p>
                      <p className="text-sm font-black text-emerald-700">{formatRupee(dayOneRevenue)}</p>
                      <p className="text-[10px] text-emerald-500 mt-0.5">{dayOneOrders} order{dayOneOrders !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Days Active</p>
                      <p className="text-sm font-black text-indigo-600">{daysSinceFirstSale} days</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
                    <div className="bg-slate-50 rounded-lg p-4 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Lifetime Orders</p>
                      <p className="text-sm font-black text-gray-900">{totalLifetimeOrders}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Avg Daily Revenue</p>
                      <p className="text-sm font-black text-emerald-600">{formatRupee(avgDailyRevenue)}</p>
                    </div>
                    <div className="bg-indigo-50 rounded-lg p-4 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 mb-1">Growth vs Day One</p>
                      <p className="text-sm font-black text-indigo-700">
                        {dayOneRevenue > 0 && todayRevenue > 0
                          ? `${todayRevenue >= dayOneRevenue ? "+" : ""}${Math.round(((todayRevenue - dayOneRevenue) / dayOneRevenue) * 100)}%`
                          : dayOneRevenue > 0 ? "No sales today" : "—"}
                      </p>
                    </div>
                  </div>
                  </>
                ) : (
                  <div className="rounded-lg bg-gray-50 border border-dashed border-gray-300 p-8 text-center">
                    <svg className="w-8 h-8 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <p className="text-sm font-semibold text-gray-500">No sales yet</p>
                    <p className="text-xs text-gray-400 mt-1">Growth metrics will appear after your first sale.</p>
                  </div>
                )}

                {/* Lifetime summary bar */}
                {firstSaleDate && totalEarned > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-600">Lifetime Revenue Progress</span>
                      <span className="text-xs font-bold text-gray-900">{formatRupee(totalEarned)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600 transition-all duration-500"
                        style={{ width: "100%" }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-gray-400">
                        {formatRupee(totalEarned - totalCommission)} after commission
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {formatRupee(avgDailyRevenue)}/day avg
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Earnings Breakdown */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-sm font-bold text-gray-900 mb-4">Earnings Breakdown</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-xs text-gray-600">Gross Revenue (delivered orders)</span>
                    <span className="text-xs font-bold text-gray-900">{formatRupee(totalEarned)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-xs text-red-600">Marketplace Commission ({(COMMISSION_RATE * 100).toFixed(0)}%)</span>
                    <span className="text-xs font-bold text-red-600">- {formatRupee(totalCommission)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-xs text-gray-600">Net Earnings</span>
                    <span className="text-xs font-bold text-gray-900">{formatRupee(netEarnings)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-xs text-gray-600">Total Paid Out</span>
                    <span className="text-xs font-bold text-gray-600">- {formatRupee(totalPaidOut)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-xs font-bold text-gray-900">Available Balance</span>
                    <span className="text-sm font-black text-indigo-500">{formatRupee(Math.max(availableBalance, 0))}</span>
                  </div>
                </div>
              </div>

              {/* Commission Rate Info */}
              <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-5 flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-indigo-800">Commission Structure</h4>
                  <p className="text-xs text-indigo-600 mt-1">
                    Shopora charges a <strong>10% marketplace commission</strong> on all completed sales. This covers
                    payment processing, platform maintenance, customer support, and marketplace promotion.
                    Commission is deducted automatically from your earnings before payout.
                  </p>
                </div>
              </div>

              {/* Request Payout Button */}
              <div className="flex justify-end relative">
                <div
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  className="relative"
                >
                  <button
                    disabled
                    className="rounded-xl bg-gray-300 px-6 py-2.5 text-xs font-bold text-gray-500 cursor-not-allowed"
                  >
                    Request Payout
                  </button>
                  {showTooltip && (
                    <div className="absolute bottom-full mb-2 right-0 bg-gray-900 text-white text-[11px] px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
                      Coming Soon -- Automated payouts are under development
                      <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Payouts */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-900">Recent Payouts</h3>
                  <Link
                    href="/seller/finances/payouts"
                    className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 transition"
                  >
                    View All
                  </Link>
                </div>
                {payouts.length === 0 ? (
                  <div className="rounded-lg bg-gray-50 border border-dashed border-gray-300 p-8 text-center">
                    <svg className="w-8 h-8 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-sm font-semibold text-gray-500">No payouts yet</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Earnings from completed orders will be available for payout here.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100 text-gray-500 uppercase tracking-wider text-[10px]">
                          <th className="text-left py-2 font-semibold">Date</th>
                          <th className="text-left py-2 font-semibold">Amount</th>
                          <th className="text-left py-2 font-semibold">Status</th>
                          <th className="text-left py-2 font-semibold">Method</th>
                          <th className="text-left py-2 font-semibold">Reference</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {payouts.map((p) => (
                          <tr key={p.id} className="hover:bg-gray-50 transition">
                            <td className="py-2.5 text-gray-600">
                              {new Date(p.created_at).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>
                            <td className="py-2.5 font-bold text-gray-900">{formatRupee(p.amount)}</td>
                            <td className="py-2.5">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                                  p.status === "completed"
                                    ? "bg-indigo-100 text-indigo-700"
                                    : p.status === "pending"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {p.status}
                              </span>
                            </td>
                            <td className="py-2.5 text-gray-600">{p.method || "---"}</td>
                            <td className="py-2.5 text-gray-500 font-mono text-[10px]">{p.reference || "---"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

  );
}
