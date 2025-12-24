// server/adminStats.js
import express from "express";
import { supabase } from "./helpers/supabase.js";
import { requireAuth, requireRole } from "./adminRoutes.js";

const router = express.Router();

const requireAdmin = (req, res, next) => {
  requireAuth(req, res, () => requireRole("admin")(req, res, next));
};

router.get("/", requireAdmin, async (req, res) => {
  try {
    // --- 1) Overview Stats ---
    const { data: totalRows } = await supabase.rpc("count_submissions");
    const { data: todayRows } = await supabase.rpc("count_submissions_today");
    const { data: weekRows } = await supabase.rpc("count_submissions_week");
    const { data: monthRows } = await supabase.rpc("count_submissions_month");

    // --- 2) By Status ---
    const { data: byStatusData } = await supabase.rpc("stats_by_status");

    // --- 3) Country Breakdown ---
    const { data: byCountryData } = await supabase.rpc("stats_by_country");

    // --- 4) Browser Breakdown ---
    const { data: byBrowserData } = await supabase.rpc("stats_by_browser");

    // --- 5) Device Breakdown ---
    const { data: byDeviceTypeData } = await supabase.rpc("stats_by_device");

    // --- 6) OS Breakdown ---
    const { data: byOSData } = await supabase.rpc("stats_by_os");

    // --- 7) 30-day Trend ---
    const { data: dailyTrendData } = await supabase.rpc("stats_daily_trend");

    // --- 8) Hourly ---
    const { data: hourlyDistributionData } = await supabase.rpc("stats_hourly");

    // --- 9) Weekday ---
    const { data: weekdayDistributionData } = await supabase.rpc("stats_weekday");

    return res.json({
      overview: {
        total: Number(totalRows?.count || 0),
        today: Number(todayRows?.count || 0),
        thisWeek: Number(weekRows?.count || 0),
        thisMonth: Number(monthRows?.count || 0),
      },
      byStatus: byStatusData || {},
      byCountry: byCountryData || [],
      byBrowser: byBrowserData || [],
      byDeviceType: byDeviceTypeData || [],
      byOS: byOSData || [],
      dailyTrend: dailyTrendData || [],
      hourlyDistribution: hourlyDistributionData || [],
      weekdayDistribution: weekdayDistributionData || [],
    });
  } catch (err) {
    console.error("Stats error:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
