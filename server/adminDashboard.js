import express from "express";
import { supabase } from "./helpers/supabase.js";
import { requireAuth, requireRole } from "./adminRoutes.js";

const router = express.Router();

const requireAdmin = (req, res, next) => {
  requireAuth(req, res, () => requireRole("admin")(req, res, next));
};

router.get("/", requireAdmin, async (req, res) => {
  try {
    // TOPLAM BAŞVURU
    const { count: total } = await supabase
      .from("submissions")
      .select("*", { count: "exact", head: true });

    // BUGÜN
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todayCount } = await supabase
      .from("submissions")
      .select("*", { count: "exact", head: true })
      .gte("created_at", today.toISOString());

    // SON 7 GÜN
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { count: weekCount } = await supabase
      .from("submissions")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekAgo.toISOString());

    // TAMAMLANMA ORANI
    const { data: completedRows } = await supabase
      .from("submissions")
      .select("status");

    const completed =
      completedRows?.filter((x) => x.status === "completed").length || 0;

    const completionRate =
      total === 0 ? 0 : Math.round((completed / total) * 100);

    // ÜLKE DAĞILIMI
    const { data: countryData } = await supabase
      .from("activity_logs")
      .select("country");

    const countryCounts = {};
    countryData?.forEach((x) => {
      if (!x.country) return;
      countryCounts[x.country] = (countryCounts[x.country] || 0) + 1;
    });

    // CİHAZ / TARAYICI
    const { data: deviceData } = await supabase
      .from("activity_logs")
      .select("device, browser");

    const deviceCounts = {};
    const browserCounts = {};

    deviceData?.forEach((x) => {
      if (x.device) deviceCounts[x.device] = (deviceCounts[x.device] || 0) + 1;
      if (x.browser)
        browserCounts[x.browser] = (browserCounts[x.browser] || 0) + 1;
    });

    // SAATLİK AKTİVİTE
    const hourly = {};
    for (let i = 0; i < 24; i++) hourly[i] = 0;

    deviceData?.forEach((x) => {
      const hour = new Date(x.created_at).getHours();
      hourly[hour] += 1;
    });

    // SON 30 GÜN TREND
    const { data: trendData } = await supabase
      .from("submissions")
      .select("created_at");

    const trend = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      trend[key] = 0;
    }

    trendData?.forEach((x) => {
      const dateKey = x.created_at.split("T")[0];
      if (trend[dateKey] !== undefined) trend[dateKey]++;
    });

    // POPÜLER HİZMETLER
    const { data: servicesData } = await supabase
      .from("submissions")
      .select("service_name");

    const serviceCounts = {};
    servicesData?.forEach((x) => {
      if (x.service_name)
        serviceCounts[x.service_name] =
          (serviceCounts[x.service_name] || 0) + 1;
    });

    // SON BAŞVURULAR
    const { data: recent } = await supabase
      .from("submissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    res.json({
      total,
      today: todayCount,
      week: weekCount,
      completionRate,
      countries: countryCounts,
      devices: deviceCounts,
      browsers: browserCounts,
      hourly,
      trend,
      services: serviceCounts,
      recent,
    });
  } catch (err) {
    console.error("Dashboard error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
