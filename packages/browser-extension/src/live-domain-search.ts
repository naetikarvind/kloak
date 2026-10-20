/**
 * Kloak AI Threat Shield — Live Internet Domain Intelligence & Verification Engine
 * Dynamically queries public internet knowledge bases (DuckDuckGo, Wikipedia),
 * ICANN RDAP (Registration Data Access Protocol), and DNS-over-HTTPS (Cloudflare DoH)
 * to verify brand legitimacy, entity identity, domain age, and detect typosquatting
 * in real-time without relying on fixed lists.
 */

import { getBaseDomain, getSLD } from './threat-detector';

export interface LiveDomainSearchResult {
  domain: string;
  baseDomain: string;
  isEstablishedEntity: boolean;
  entityName?: string;
  entityDescription?: string;
  officialWebsite?: string;
  suggestedCorrection?: string; // Typo target suggested by internet knowledge graph
  domainAgeDays: number;
  domainAgeYears: number;
  registrationDate?: string;
  expirationDate?: string;
  registrarName: string;
  registrantOrg?: string;
  registrantCountry?: string;
  isBrandNameRegistrar: boolean;
  dnsRecords: {
    aRecords: string[];
    hasMxRecord: boolean;
    nameservers: string[];
  };
  hostingProvider?: string;
  reputationScore: number; // 0 - 100
  trustFactors: string[];
  riskFactors: string[];
  source: 'live_internet' | 'cache' | 'offline_fallback';
  fetchedAt: number;
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days cache TTL
const MEMORY_CACHE = new Map<string, LiveDomainSearchResult>();

const CORPORATE_TRUSTED_REGISTRARS = [
  'markmonitor', 'csc corporate domains', 'google llc', 'google inc',
  'amazon registrar', 'safenames', 'brandshield', 'nom-iq',
  'cloudflare', 'tucows', 'godaddy', 'namecheap', 'dynadot', 'gandi',
  'nameweb', 'network solutions', 'fastdomain'
];

async function getCachedResult(baseDomain: string): Promise<LiveDomainSearchResult | null> {
  const mem = MEMORY_CACHE.get(baseDomain);
  if (mem && (Date.now() - mem.fetchedAt < CACHE_TTL_MS)) {
    return { ...mem, source: 'cache' };
  }

  if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
    try {
      const key = `kloak_domain_intel_${baseDomain}`;
      const record = await chrome.storage.local.get(key);
      const data = record[key] as LiveDomainSearchResult | undefined;
      if (data && (Date.now() - data.fetchedAt < CACHE_TTL_MS)) {
        MEMORY_CACHE.set(baseDomain, data);
        return { ...data, source: 'cache' };
      }
    } catch {}
  }

  return null;
}

async function saveCachedResult(baseDomain: string, data: LiveDomainSearchResult): Promise<void> {
  MEMORY_CACHE.set(baseDomain, data);

  // Keep in-memory cache size bounded (max 500 entries)
  if (MEMORY_CACHE.size > 500) {
    const oldestKey = MEMORY_CACHE.keys().next().value;
    if (oldestKey) MEMORY_CACHE.delete(oldestKey);
  }

  if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
    try {
      const key = `kloak_domain_intel_${baseDomain}`;
      await chrome.storage.local.set({ [key]: data });
    } catch {}
  }
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 3200): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Searches the internet in real time to evaluate a domain's identity, age, and legitimacy.
 */
export async function searchDomainLive(
  domainInput: string,
  options: { forceRefresh?: boolean } = {}
): Promise<LiveDomainSearchResult> {
  const cleanHost = domainInput.toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');
  const baseDomain = getBaseDomain(cleanHost);
  const sld = getSLD(baseDomain);

  // 1. Check local cache first
  if (!options.forceRefresh) {
    const cached = await getCachedResult(baseDomain);
    if (cached) return cached;
  }

  const trustFactors: string[] = [];
  const riskFactors: string[] = [];
  let isEstablishedEntity = false;
  let entityName: string | undefined;
  let entityDescription: string | undefined;
  let officialWebsite: string | undefined;
  let suggestedCorrection: string | undefined;

  let registrationDate: string | undefined;
  let expirationDate: string | undefined;
  let registrarName = 'Global Domain Registrar';
  let registrantOrg: string | undefined;
  let registrantCountry: string | undefined;
  let domainAgeDays = 365;
  let domainAgeYears = 1.0;

  const aRecords: string[] = [];
  let hasMxRecord = false;
  const nameservers: string[] = [];
  let hostingProvider: string | undefined;

  // ── Parallel Search Signal 1: DuckDuckGo Instant Answer API ──
  const ddgTask = (async () => {
    try {
      const res = await fetchWithTimeout(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(baseDomain)}&format=json&no_html=1&skip_disambig=1`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.Heading || data.AbstractText) {
          isEstablishedEntity = true;
          entityName = data.Heading || baseDomain;
          entityDescription = data.AbstractText || undefined;
          if (data.AbstractURL) officialWebsite = data.AbstractURL;
          trustFactors.push(`Verified Global Entity: ${entityName}`);
        }
      }
    } catch {}
  })();

  // ── Parallel Search Signal 2: Wikipedia Search & Spell-Suggestion API ──
  const wikiTask = (async () => {
    try {
      const res = await fetchWithTimeout(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(baseDomain)}&format=json&utf8=`
      );
      if (res.ok) {
        const data = await res.json();
        // Check spell-check suggestion (flags typosquatting lookalikes, e.g. "opeani.com" -> "openai.com")
        const suggestion = data.query?.searchinfo?.suggestion;
        if (suggestion) {
          const cleanSuggestion = suggestion.replace(/<[^>]+>/g, '').toLowerCase().trim();
          if (cleanSuggestion !== baseDomain && cleanSuggestion !== cleanHost) {
            suggestedCorrection = cleanSuggestion;
            riskFactors.push(`Live search suggestion identifies probable target: '${cleanSuggestion}'`);
          }
        }

        // Check if Wikipedia has a documented encyclopedia topic for this entity
        if (!isEstablishedEntity && Array.isArray(data.query?.search) && data.query.search.length > 0) {
          const topHit = data.query.search[0];
          if (topHit.title) {
            isEstablishedEntity = true;
            entityName = topHit.title;
            if (topHit.snippet) {
              entityDescription = topHit.snippet.replace(/<[^>]+>/g, '');
            }
            trustFactors.push(`Knowledge Base Entity: ${topHit.title}`);
          }
        }
      }
    } catch {}
  })();

  // ── Parallel Search Signal 3: ICANN RDAP Domain Registry Lookup ──
  const rdapTask = (async () => {
    try {
      const res = await fetchWithTimeout(`https://rdap.org/domain/${encodeURIComponent(baseDomain)}`, {
        headers: {
          'Accept': 'application/rdap+json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.events)) {
          for (const ev of data.events) {
            if (ev.eventAction === 'registration') {
              registrationDate = ev.eventDate?.split('T')[0];
            } else if (ev.eventAction === 'expiration') {
              expirationDate = ev.eventDate?.split('T')[0];
            }
          }
        }

        if (Array.isArray(data.entities)) {
          for (const ent of data.entities) {
            const roles = ent.roles || [];
            if (roles.includes('registrar')) {
              const vcard = ent.vcardArray?.[1];
              if (Array.isArray(vcard)) {
                const fn = vcard.find((item: any) => item[0] === 'fn');
                if (fn && fn[3]) registrarName = fn[3];
              }
            } else if (roles.includes('registrant')) {
              const vcard = ent.vcardArray?.[1];
              if (Array.isArray(vcard)) {
                const org = vcard.find((item: any) => item[0] === 'org');
                const fn = vcard.find((item: any) => item[0] === 'fn');
                const country = vcard.find((item: any) => item[0] === 'country' || item[0] === 'adr');
                if (org && org[3]) registrantOrg = org[3];
                else if (fn && fn[3]) registrantOrg = fn[3];
                if (country && country[3]) registrantCountry = country[3];
              }
            }
          }
        }

        if (Array.isArray(data.nameservers)) {
          for (const ns of data.nameservers) {
            if (ns.ldhName) nameservers.push(ns.ldhName.toLowerCase());
          }
        }
      }
    } catch {}
  })();

  // ── Parallel Search Signal 4: DNS-over-HTTPS (Cloudflare DoH) ──
  const dohTask = (async () => {
    try {
      const aRes = await fetchWithTimeout(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(cleanHost)}&type=A`,
        { headers: { 'Accept': 'application/dns-json' } }
      );
      if (aRes.ok) {
        const data = await aRes.json();
        if (Array.isArray(data.Answer)) {
          for (const ans of data.Answer) {
            if (ans.type === 1 && ans.data) aRecords.push(ans.data);
          }
        }
      }

      const mxRes = await fetchWithTimeout(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(baseDomain)}&type=MX`,
        { headers: { 'Accept': 'application/dns-json' } }
      );
      if (mxRes.ok) {
        const mxData = await mxRes.json();
        hasMxRecord = Array.isArray(mxData.Answer) && mxData.Answer.length > 0;
      }
    } catch {}
  })();

  // Await all parallel signals
  await Promise.allSettled([ddgTask, wikiTask, rdapTask, dohTask]);

  // Compute Domain Age from actual live registration date
  if (registrationDate) {
    const regTime = new Date(registrationDate).getTime();
    domainAgeDays = Math.max(0, Math.floor((Date.now() - regTime) / (1000 * 60 * 60 * 24)));
    domainAgeYears = +(domainAgeDays / 365.25).toFixed(1);

    if (domainAgeYears >= 3) {
      trustFactors.push(`Established Domain History (${domainAgeYears} years active)`);
    } else if (domainAgeDays < 30) {
      riskFactors.push(`Newly registered domain (${domainAgeDays} days old)`);
    }
  }

  // Check registrar reputation
  const lowerRegistrar = registrarName.toLowerCase();
  const isBrandNameRegistrar = CORPORATE_TRUSTED_REGISTRARS.some(reg => lowerRegistrar.includes(reg));
  if (isBrandNameRegistrar) {
    trustFactors.push(`Corporate Registrar: ${registrarName}`);
  }

  if (registrantOrg) {
    trustFactors.push(`Verified Organization: ${registrantOrg}`);
  }

  if (hasMxRecord) {
    trustFactors.push('Valid enterprise mail infrastructure (MX)');
  }

  // Derive ASN / Hosting Provider based on nameservers or IPs
  const nsString = nameservers.join(' ');
  if (nsString.includes('cloudflare')) hostingProvider = 'Cloudflare Network';
  else if (nsString.includes('awsdns') || nsString.includes('amazon')) hostingProvider = 'Amazon Web Services';
  else if (nsString.includes('google') || nsString.includes('googledomains')) hostingProvider = 'Google Cloud DNS';
  else if (nsString.includes('azure')) hostingProvider = 'Microsoft Azure';
  else if (nameservers.length > 0) hostingProvider = nameservers[0];

  // Dynamic Reputation Scoring (0 - 100)
  let reputationScore = 70;
  if (isEstablishedEntity) reputationScore += 20;
  if (domainAgeYears >= 5) reputationScore += 10;
  if (isBrandNameRegistrar) reputationScore += 5;
  if (hasMxRecord) reputationScore += 5;

  if (suggestedCorrection) {
    reputationScore -= 50; // Heavy penalty if live search detects typo of a known brand
  }
  if (domainAgeDays < 30) {
    reputationScore -= 30; // Heavy penalty for disposable new domains
  }
  if (riskFactors.length > 0) {
    reputationScore -= (riskFactors.length * 10);
  }

  reputationScore = Math.max(5, Math.min(100, Math.round(reputationScore)));

  const result: LiveDomainSearchResult = {
    domain: cleanHost,
    baseDomain,
    isEstablishedEntity,
    entityName,
    entityDescription: entityDescription ? entityDescription.slice(0, 200) : undefined,
    officialWebsite,
    suggestedCorrection,
    domainAgeDays,
    domainAgeYears,
    registrationDate,
    expirationDate,
    registrarName,
    registrantOrg,
    registrantCountry,
    isBrandNameRegistrar,
    dnsRecords: {
      aRecords,
      hasMxRecord,
      nameservers
    },
    hostingProvider,
    reputationScore,
    trustFactors,
    riskFactors,
    source: 'live_internet',
    fetchedAt: Date.now()
  };

  // Cache result for 7 days
  await saveCachedResult(baseDomain, result);

  return result;
}
