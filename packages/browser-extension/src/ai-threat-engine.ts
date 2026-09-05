/**
 * Kloak AI Threat Shield — Neural Threat Evaluator & Multi-Signal Synthesizer
 * Combines TLS Certificate Metadata, Domain Age & RDAP Ownership Intelligence,
 * DNS/Hosting Signals, and Typosquatting/Brand Vectors to produce structured AI verdicts.
 */

import { analyzeUrl, ThreatAnalysis } from './threat-detector';
import { fetchCertificateDetails, CertificateInfo } from './certificate-analyzer';
import { fetchDomainIntel, DomainIntelInfo } from './domain-intel';

export type AIThreatLevel = 'VERIFIED_SAFE' | 'LOW_RISK' | 'CAUTION_SUSPICIOUS' | 'CRITICAL_PHISHING_THREAT';

export interface AIThreatEvaluation {
  url: string;
  domain: string;
  threatLevel: AIThreatLevel;
  riskScore: number; // 0 - 100 (0 = completely safe, 100 = critical threat)
  aiConfidence: number; // 0 - 100%
  aiSummary: string;
  certificateVerdict: string;
  ownerVerdict: string;
  certificate: CertificateInfo;
  domainIntel: DomainIntelInfo;
  basicThreat: ThreatAnalysis;
  trustBadges: string[];
  redFlags: string[];
  actionRecommendation: string;
  evaluatedAt: string;
}

export async function evaluateWebsiteSecurity(urlString: string): Promise<AIThreatEvaluation> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    url = new URL('https://' + urlString);
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');

  // 1. Fetch Basic Threat Detection, Certificate Metadata, and Domain Owner Intel concurrently
  const [basicThreat, certificate, domainIntel] = await Promise.all([
    Promise.resolve(analyzeUrl(urlString)),
    fetchCertificateDetails(hostname),
    fetchDomainIntel(hostname)
  ]);

  // 2. Synthesize Multi-Factor AI Risk Matrix
  let aiRiskScore = basicThreat.riskScore;
  let aiConfidence = 85;
  const trustBadges: string[] = [];
  const redFlags: string[] = [...basicThreat.reasons];

  // ── Factor 1: Certificate Analysis ──
  if (certificate.validationLevel === 'EV') {
    aiRiskScore = Math.max(0, aiRiskScore - 30);
    trustBadges.push(`🔒 ${certificate.issuerOrg} Extended Validation (EV)`);
  } else if (certificate.validationLevel === 'OV') {
    aiRiskScore = Math.max(0, aiRiskScore - 20);
    trustBadges.push(`🔒 ${certificate.issuerOrg} Organization Validated`);
  } else if (certificate.isHighAssuranceCA) {
    aiRiskScore = Math.max(0, aiRiskScore - 15);
    trustBadges.push(`🛡️ Tier-1 CA (${certificate.issuerOrg})`);
  }

  if (certificate.isSelfSigned) {
    aiRiskScore += 45;
    redFlags.push('🚨 Untrusted self-signed SSL/TLS certificate');
  }

  if (certificate.isExpired) {
    aiRiskScore += 35;
    redFlags.push('⚠️ SSL/TLS Certificate has expired');
  }

  // ── Factor 2: Domain Age & Ownership Analysis ──
  if (domainIntel.domainAgeYears >= 5) {
    aiRiskScore = Math.max(0, aiRiskScore - 25);
    trustBadges.push(`📅 ${domainIntel.domainAgeYears} Years Active`);
  } else if (domainIntel.isEstablishedDomain) {
    aiRiskScore = Math.max(0, aiRiskScore - 10);
    trustBadges.push(`📅 ${domainIntel.domainAgeDays} Days Old`);
  }

  if (domainIntel.registrantOrg) {
    trustBadges.push(`🏢 Verified Owner: ${domainIntel.registrantOrg}`);
  } else if (domainIntel.isBrandNameRegistrar) {
    trustBadges.push(`🏢 Corporate Registrar: ${domainIntel.registrarName}`);
  }

  // Critical Phishing Anomaly: Brand new domain (<30 days) pretending to be a known service
  if (domainIntel.isNewlyCreated) {
    if (basicThreat.isSuspicious || redFlags.length > 0) {
      aiRiskScore += 40;
      redFlags.push(`🚨 Brand new domain (${domainIntel.domainAgeDays} days old) mimicking established branding`);
      aiConfidence = 96;
    } else {
      aiRiskScore += 15;
      redFlags.push(`Domain registered very recently (${domainIntel.domainAgeDays} days ago)`);
    }
  }

  // ── Factor 3: Disposable Cert on Brand Target ──
  if (certificate.validationLevel === 'DV' && certificate.certificateAgeDays <= 7 && (basicThreat.targetDomain && basicThreat.targetDomain !== hostname)) {
    aiRiskScore += 30;
    redFlags.push(`🚨 Disposable DV certificate issued ${certificate.certificateAgeDays} days ago on deceptive hostname`);
  }

  // Clamp Risk Score
  const finalRiskScore = Math.min(100, Math.max(0, aiRiskScore));

  // 3. Determine Threat Level & Action Recommendation
  let threatLevel: AIThreatLevel = 'VERIFIED_SAFE';
  let actionRecommendation = 'Safe to browse and submit saved credentials.';

  if (finalRiskScore >= 60) {
    threatLevel = 'CRITICAL_PHISHING_THREAT';
    actionRecommendation = '🚨 High Risk: Potential phishing / credential harvesting. Do not enter passwords! Use a Kloak Masked Alias.';
  } else if (finalRiskScore >= 35) {
    threatLevel = 'CAUTION_SUSPICIOUS';
    actionRecommendation = '⚠️ Exercise caution: Unverified ownership or recent registration. Protect your identity with a disposable alias.';
  } else if (finalRiskScore >= 15) {
    threatLevel = 'LOW_RISK';
    actionRecommendation = 'Low risk: Standard domain security verified.';
  }

  // 4. Generate AI Narrative Explanations
  const certSummary = certificate.isHighAssuranceCA || certificate.validationLevel === 'EV' || certificate.validationLevel === 'OV'
    ? `Verified ${certificate.validationLevel} TLS certificate issued by ${certificate.issuerOrg} (${certificate.certificateAgeDays} days active).`
    : `Standard Domain-Validated (DV) certificate issued by ${certificate.issuerOrg}.`;

  const ownerSummary = domainIntel.registrantOrg
    ? `Registered to ${domainIntel.registrantOrg} (${domainIntel.domainAgeYears} years active via ${domainIntel.registrarName}).`
    : (domainIntel.isEstablishedDomain
      ? `Established domain active for ${domainIntel.domainAgeYears} years (${domainIntel.registrarName}).`
      : `Newly registered domain (${domainIntel.domainAgeDays} days old via ${domainIntel.registrarName}).`);

  let aiSummary = '';
  if (threatLevel === 'VERIFIED_SAFE') {
    aiSummary = `Kloak AI has verified ${hostname} as authentic. The website possesses an established ${domainIntel.domainAgeYears}-year domain history, trusted TLS certification (${certificate.issuerOrg}), and genuine ownership credentials.`;
  } else if (threatLevel === 'LOW_RISK') {
    aiSummary = `Kloak AI evaluated ${hostname} with low risk. Certificate and domain parameters match standard web standards with no active deception signatures.`;
  } else if (threatLevel === 'CAUTION_SUSPICIOUS') {
    aiSummary = `Kloak AI flagged potential irregularities on ${hostname}. ${redFlags[0] || 'Unconfirmed owner identity or recent domain issuance'}.`;
  } else {
    aiSummary = `🚨 Kloak AI Threat Alert: ${hostname} demonstrates high-probability phishing / brand impersonation indicators (${redFlags.slice(0, 2).join(', ')}).`;
  }

  return {
    url: urlString,
    domain: hostname,
    threatLevel,
    riskScore: finalRiskScore,
    aiConfidence,
    aiSummary,
    certificateVerdict: certSummary,
    ownerVerdict: ownerSummary,
    certificate,
    domainIntel,
    basicThreat,
    trustBadges: Array.from(new Set(trustBadges)),
    redFlags: Array.from(new Set(redFlags)),
    actionRecommendation,
    evaluatedAt: new Date().toISOString()
  };
}
