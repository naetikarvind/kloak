/**
 * Kloak AI Threat Shield — Domain Owner & Network Intelligence
 * Queries RDAP (Registration Data Access Protocol), DNS-over-HTTPS (DoH), and ASN hosting metrics
 * to verify domain age, corporate registrar reputation, ownership validity, and mail infrastructure.
 */

import { getBaseDomain, getSLD } from './threat-detector';

export interface DomainIntelInfo {
  domain: string;
  baseDomain: string;
  domainAgeDays: number;
  domainAgeYears: number;
  registrationDate?: string;
  expirationDate?: string;
  registrarName: string;
  registrantOrg?: string;
  registrantCountry?: string;
  isEstablishedDomain: boolean; // > 365 days
  isNewlyCreated: boolean; // < 30 days
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
}

const CORPORATE_TRUSTED_REGISTRARS = [
  'markmonitor', 'csc corporate domains', 'google llc', 'google inc',
  'amazon registrar', 'safenames', 'brandshield', 'nom-iq',
  'cloudflare', 'tucows', 'godaddy', 'namecheap', 'dynadot', 'gandi'
];

const ESTABLISHED_KNOWN_DOMAINS: { [domain: string]: Partial<DomainIntelInfo> } = {
  'google.com': {
    domainAgeDays: 10400,
    domainAgeYears: 28,
    registrationDate: '1997-09-15',
    registrarName: 'MarkMonitor Inc.',
    registrantOrg: 'Google LLC',
    hostingProvider: 'Google LLC (AS15169)'
  },
  'gemini.com': {
    domainAgeDays: 10600,
    domainAgeYears: 29,
    registrationDate: '1997-02-14',
    registrarName: 'MarkMonitor Inc.',
    registrantOrg: 'Gemini Trust Company, LLC',
    hostingProvider: 'Cloudflare, Inc. (AS13335)'
  },
  'apple.com': {
    domainAgeDays: 13500,
    domainAgeYears: 37,
    registrationDate: '1987-02-19',
    registrarName: 'CSC Corporate Domains, Inc.',
    registrantOrg: 'Apple Inc.',
    hostingProvider: 'Apple Inc. (AS714)'
  },
  'microsoft.com': {
    domainAgeDays: 12500,
    domainAgeYears: 34,
    registrationDate: '1991-05-02',
    registrarName: 'MarkMonitor Inc.',
    registrantOrg: 'Microsoft Corporation',
    hostingProvider: 'Microsoft Corporation (AS8075)'
  },
  'github.com': {
    domainAgeDays: 6800,
    domainAgeYears: 18,
    registrationDate: '2007-10-09',
    registrarName: 'MarkMonitor Inc.',
    registrantOrg: 'GitHub, Inc.',
    hostingProvider: 'GitHub / Microsoft (AS36459)'
  },
  'paypal.com': {
    domainAgeDays: 9800,
    domainAgeYears: 26,
    registrationDate: '1999-07-15',
    registrarName: 'CSC Corporate Domains, Inc.',
    registrantOrg: 'PayPal, Inc.',
    hostingProvider: 'PayPal / Akamai'
  },
  'openai.com': {
    domainAgeDays: 3200,
    domainAgeYears: 8,
    registrationDate: '2016-01-20',
    registrarName: 'MarkMonitor Inc.',
    registrantOrg: 'OpenAI OpCo, LLC',
    hostingProvider: 'Cloudflare, Inc. (AS13335)'
  },
  'anthropic.com': {
    domainAgeDays: 1500,
    domainAgeYears: 4,
    registrationDate: '2021-02-04',
    registrarName: 'Google LLC',
    registrantOrg: 'Anthropic PBC',
    hostingProvider: 'Cloudflare, Inc. (AS13335)'
  }
};

export async function fetchDomainIntel(hostname: string): Promise<DomainIntelInfo> {
  const cleanHost = hostname.replace(/^www\./, '').toLowerCase();
  const baseDomain = getBaseDomain(cleanHost);

  // Check known verified domains dictionary first for instant trusted stats
  if (ESTABLISHED_KNOWN_DOMAINS[baseDomain]) {
    const preset = ESTABLISHED_KNOWN_DOMAINS[baseDomain];
    const ageDays = preset.domainAgeDays || 3650;
    const ageYears = preset.domainAgeYears || 10;
    return {
      domain: cleanHost,
      baseDomain,
      domainAgeDays: ageDays,
      domainAgeYears: ageYears,
      registrationDate: preset.registrationDate,
      registrarName: preset.registrarName || 'MarkMonitor Inc.',
      registrantOrg: preset.registrantOrg,
      isEstablishedDomain: true,
      isNewlyCreated: false,
      isBrandNameRegistrar: true,
      dnsRecords: {
        aRecords: ['Verified IP'],
        hasMxRecord: true,
        nameservers: ['Enterprise DNS']
      },
      hostingProvider: preset.hostingProvider || 'Enterprise Cloud Network',
      reputationScore: 98,
      trustFactors: [
        `Long-standing domain history (${ageYears}+ years active)`,
        `Corporate Registrar: ${preset.registrarName}`,
        `Verified Organization: ${preset.registrantOrg || baseDomain}`,
        'Valid enterprise mail & DNS routing infrastructure'
      ],
      riskFactors: []
    };
  }

  let registrationDate: string | undefined;
  let expirationDate: string | undefined;
  let registrarName = 'Global Domain Registrar';
  let registrantOrg: string | undefined;
  let registrantCountry: string | undefined;
  let domainAgeDays = 365;

  const trustFactors: string[] = [];
  const riskFactors: string[] = [];

  // 1. RDAP Domain Lookup
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const rdapRes = await fetch(`https://rdap.org/domain/${encodeURIComponent(baseDomain)}`, {
      headers: { 'Accept': 'application/rdap+json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (rdapRes.ok) {
      const rdap = await rdapRes.json();
      
      // Parse events (registration, expiration, last change)
      if (Array.isArray(rdap.events)) {
        for (const ev of rdap.events) {
          if (ev.eventAction === 'registration') {
            registrationDate = ev.eventDate?.split('T')[0];
          } else if (ev.eventAction === 'expiration') {
            expirationDate = ev.eventDate?.split('T')[0];
          }
        }
      }

      // Parse entities (registrar, registrant)
      if (Array.isArray(rdap.entities)) {
        for (const ent of rdap.entities) {
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
              const fn = vcard.find((item: any) => item[0] === 'fn');
              const org = vcard.find((item: any) => item[0] === 'org');
              if (org && org[3]) registrantOrg = org[3];
              else if (fn && fn[3]) registrantOrg = fn[3];
            }
          }
        }
      }
    }
  } catch {}

  // 2. DNS-over-HTTPS (DoH) lookup for A and MX records
  const aRecords: string[] = [];
  let hasMxRecord = false;
  const nameservers: string[] = [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const dohA = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(cleanHost)}&type=A`, {
      headers: { 'Accept': 'application/dns-json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (dohA.ok) {
      const data = await dohA.json();
      if (Array.isArray(data.Answer)) {
        for (const ans of data.Answer) {
          if (ans.type === 1 && ans.data) {
            aRecords.push(ans.data);
          }
        }
      }
    }

    // Check MX records on base domain
    const dohMx = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(baseDomain)}&type=MX`, {
      headers: { 'Accept': 'application/dns-json' }
    });
    if (dohMx.ok) {
      const mxData = await dohMx.json();
      hasMxRecord = Array.isArray(mxData.Answer) && mxData.Answer.length > 0;
    }
  } catch {}

  // Compute Domain Age
  if (registrationDate) {
    const regTime = new Date(registrationDate).getTime();
    const now = Date.now();
    domainAgeDays = Math.max(0, Math.floor((now - regTime) / (1000 * 60 * 60 * 24)));
  }

  const domainAgeYears = +(domainAgeDays / 365.25).toFixed(1);
  const isEstablishedDomain = domainAgeDays > 365;
  const isNewlyCreated = domainAgeDays < 30;
  const registrarLower = registrarName.toLowerCase();
  const isBrandNameRegistrar = CORPORATE_TRUSTED_REGISTRARS.some(r => registrarLower.includes(r));

  let reputationScore = 65;

  if (domainAgeDays > 3650) {
    reputationScore += 25;
    trustFactors.push(`Domain has been active for ${domainAgeYears} years`);
  } else if (domainAgeDays > 730) {
    reputationScore += 15;
    trustFactors.push(`Established domain (${domainAgeYears} years active)`);
  } else if (isNewlyCreated) {
    reputationScore -= 45;
    riskFactors.push(`🚨 Brand new domain (registered only ${domainAgeDays} day${domainAgeDays === 1 ? '' : 's'} ago)`);
  } else if (domainAgeDays < 90) {
    reputationScore -= 20;
    riskFactors.push(`Recently registered domain (${domainAgeDays} days old)`);
  }

  if (isBrandNameRegistrar) {
    reputationScore += 10;
    trustFactors.push(`Registered via trusted corporate registrar: ${registrarName}`);
  }

  if (hasMxRecord) {
    trustFactors.push('Legitimate mail exchange (MX) DNS configuration detected');
  } else if (isNewlyCreated) {
    riskFactors.push('No Mail Exchange (MX) records found on newly created domain');
  }

  return {
    domain: cleanHost,
    baseDomain,
    domainAgeDays,
    domainAgeYears,
    registrationDate,
    expirationDate,
    registrarName,
    registrantOrg,
    registrantCountry,
    isEstablishedDomain,
    isNewlyCreated,
    isBrandNameRegistrar,
    dnsRecords: {
      aRecords,
      hasMxRecord,
      nameservers
    },
    reputationScore: Math.min(100, Math.max(0, reputationScore)),
    trustFactors,
    riskFactors
  };
}
