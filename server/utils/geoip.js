export function parseUserAgent(ua) {
  if (!ua) return { browser: null, browserVersion: null, os: null, osVersion: null, device: null, deviceType: null };
  
  let browser = null;
  let browserVersion = null;
  let os = null;
  let osVersion = null;
  let device = null;
  let deviceType = 'desktop';

  if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) {
    deviceType = 'mobile';
  } else if (ua.includes('Tablet') || ua.includes('iPad')) {
    deviceType = 'tablet';
  }

  if (ua.includes('iPhone')) device = 'iPhone';
  else if (ua.includes('iPad')) device = 'iPad';
  else if (ua.includes('Android')) device = 'Android Device';
  else if (ua.includes('Windows')) device = 'Windows PC';
  else if (ua.includes('Mac')) device = 'Mac';
  else if (ua.includes('Linux')) device = 'Linux PC';

  if (ua.includes('Chrome') && !ua.includes('Edg')) {
    browser = 'Chrome';
    const match = ua.match(/Chrome\/(\d+\.?\d*)/);
    if (match) browserVersion = match[1];
  } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
    browser = 'Safari';
    const match = ua.match(/Version\/(\d+\.?\d*)/);
    if (match) browserVersion = match[1];
  } else if (ua.includes('Firefox')) {
    browser = 'Firefox';
    const match = ua.match(/Firefox\/(\d+\.?\d*)/);
    if (match) browserVersion = match[1];
  } else if (ua.includes('Edg')) {
    browser = 'Edge';
    const match = ua.match(/Edg\/(\d+\.?\d*)/);
    if (match) browserVersion = match[1];
  } else if (ua.includes('Opera') || ua.includes('OPR')) {
    browser = 'Opera';
    const match = ua.match(/(?:Opera|OPR)\/(\d+\.?\d*)/);
    if (match) browserVersion = match[1];
  }

  if (ua.includes('Windows NT 10')) { os = 'Windows'; osVersion = '10/11'; }
  else if (ua.includes('Windows NT 6.3')) { os = 'Windows'; osVersion = '8.1'; }
  else if (ua.includes('Windows NT 6.2')) { os = 'Windows'; osVersion = '8'; }
  else if (ua.includes('Windows NT 6.1')) { os = 'Windows'; osVersion = '7'; }
  else if (ua.includes('Mac OS X')) {
    os = 'macOS';
    const match = ua.match(/Mac OS X (\d+[._]\d+)/);
    if (match) osVersion = match[1].replace('_', '.');
  } else if (ua.includes('Android')) {
    os = 'Android';
    const match = ua.match(/Android (\d+\.?\d*)/);
    if (match) osVersion = match[1];
  } else if (ua.includes('iOS') || ua.includes('iPhone OS')) {
    os = 'iOS';
    const match = ua.match(/(?:iPhone OS|iOS) (\d+[._]\d+)/);
    if (match) osVersion = match[1].replace('_', '.');
  } else if (ua.includes('Linux')) {
    os = 'Linux';
  }

  return { browser, browserVersion, os, osVersion, device, deviceType };
}

export async function getGeoFromIP(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { country: 'Local', countryCode: 'LO', city: 'Local', region: 'Local', timezone: 'Local' };
  }

  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,regionName,city,timezone`);
    const data = await response.json();
    
    if (data.status === 'success') {
      return {
        country: data.country,
        countryCode: data.countryCode,
        city: data.city,
        region: data.regionName,
        timezone: data.timezone,
      };
    }
  } catch (error) {
    console.error('GeoIP lookup failed:', error);
  }

  return { country: 'Unknown', countryCode: 'XX', city: 'Unknown', region: 'Unknown', timezone: 'Unknown' };
}

export function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.connection?.remoteAddress || req.socket?.remoteAddress || null;
}
