import fetch from 'node-fetch';

export async function getGeoFromIP(ip) {
  try {
    if (!ip || ip === "127.0.0.1" || ip.startsWith("192.168")) {
      return {
        country: "Unknown",
        country_code: "XX",
        city: "Unknown",
        region: "Unknown",
        timezone: "Unknown"
      };
    }

    const res = await fetch(`https://ipapi.co/${ip}/json/`);
    const data = await res.json();

    return {
      country: data.country_name || "Unknown",
      country_code: data.country || "XX",
      city: data.city || "Unknown",
      region: data.region || "Unknown",
      timezone: data.timezone || "Unknown",
    };
  } catch (err) {
    console.error("Geo-IP lookup error:", err);
    return {
      country: "Unknown",
      country_code: "XX",
      city: "Unknown",
      region: "Unknown",
      timezone: "Unknown"
    };
  }
}
