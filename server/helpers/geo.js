import fetch from 'node-fetch';

const GEO_CACHE_TTL = 5 * 60 * 1000;
const geoCache = new Map();

function normalizeGeo(data) {
  if (!data) return null;
  return {
    country: data.country_name || data.country || data.countryCode || "Unknown",
    country_code: (data.country || data.country_code || data.countryCode || "XX").toUpperCase(),
    city: data.city || data.city_name || "Unknown",
    region: data.region || data.region_name || "Unknown",
    timezone: data.timezone || data.time_zone || "Unknown",
  };
}

async function fetchGeoDetails(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Geo-IP provider returned ${res.status}`);
  }
  const data = await res.json();
  return normalizeGeo(data);
}

export async function getGeoFromIP(ip) {
  try {
    if (!ip || ip === "127.0.0.1" || ip.startsWith("192.168")) {
      return {
        country: "Unknown",
        country_code: "XX",
        city: "Unknown",
        region: "Unknown",
        timezone: "Unknown",
      };
    }

    const cached = geoCache.get(ip);
    if (cached && cached.expires > Date.now()) {
      return cached.geo;
    }

    const providers = [
      `https://ipwhois.app/json/${ip}?objects=country,city,region,timezone`,
      `https://ipapi.co/${ip}/json/`,
    ];

    let geo = null;
    for (const url of providers) {
      try {
        geo = await fetchGeoDetails(url);
        if (geo) break;
      } catch (err) {
        console.warn('Geo-IP provider error:', err.message);
      }
    }

    if (!geo) {
      throw new Error('All geo providers failed');
    }

    geoCache.set(ip, { geo, expires: Date.now() + GEO_CACHE_TTL });
    return geo;
  } catch (err) {
    console.error("Geo-IP lookup error:", err.message || err);
    return {
      country: "Unknown",
      country_code: "XX",
      city: "Unknown",
      region: "Unknown",
      timezone: "Unknown",
    };
  }
}
