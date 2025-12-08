import type { ServiceType } from '../types/quote';
import { apiUrl } from './api';

export type ServiceSuggestion = { service: ServiceType; reason: string };

export async function suggestServicesWithAI(
  query: string,
  allowedServices: ServiceType[]
): Promise<ServiceSuggestion[]> {
  if (!query.trim()) return [];

  const endpoint = import.meta.env.VITE_SUGGEST_URL || '/api/suggest';
  const resolvedEndpoint = apiUrl(endpoint);
  const vercelBypass = import.meta.env.VITE_VERCEL_PROTECTION_BYPASS?.trim();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (vercelBypass) {
    headers['x-vercel-protection-bypass'] = vercelBypass;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(resolvedEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`Suggestion request failed (${res.status})`);
      return [];
    }

    const data = await res.json();
    const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];

    const allowedLower = new Map(allowedServices.map((s) => [s.toLowerCase(), s]));
    const seen = new Set<string>();
    const result: ServiceSuggestion[] = [];

    for (const item of suggestions) {
      let service: string | undefined;
      let reason = '';
      if (typeof item === 'object' && item !== null && 'service' in item) {
        service = (item as any).service;
        if ((item as any).reason) reason = String((item as any).reason);
      } else if (typeof item === 'string') {
        service = item;
      }
      if (!service) continue;
      const norm = String(service).toLowerCase().trim();
      const match = allowedLower.get(norm);
      if (match && !seen.has(match)) {
        seen.add(match);
        result.push({ service: match, reason: reason || '' });
      }
      if (result.length >= 4) break;
    }

    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn('AI suggestions failed, using fallback:', error);
    return [];
  }
}
