import { Image, Icon, Color } from "@raycast/api";
import { KloakItem } from "./kloak-ipc.js";

const BRAND_MAP: Record<string, string> = {
  github: "github.com",
  copilot: "github.com",
  cursor: "cursor.com",
  gemini: "gemini.google.com",
  google: "google.com",
  gmail: "google.com",
  deepmind: "deepmind.google",
  proton: "proton.me",
  protonmail: "proton.me",
  apple: "apple.com",
  icloud: "apple.com",
  amazon: "amazon.com",
  aws: "aws.amazon.com",
  netflix: "netflix.com",
  spotify: "spotify.com",
  discord: "discord.com",
  slack: "slack.com",
  notion: "notion.so",
  figma: "figma.com",
  dropbox: "dropbox.com",
  openai: "openai.com",
  chatgpt: "openai.com",
  claude: "anthropic.com",
  anthropic: "anthropic.com",
  huggingface: "huggingface.co",
  replicate: "replicate.com",
  midjourney: "midjourney.com",
  perplexity: "perplexity.ai",
  twitter: "x.com",
  "x.com": "x.com",
  reddit: "reddit.com",
  linkedin: "linkedin.com",
  facebook: "facebook.com",
  meta: "meta.com",
  instagram: "instagram.com",
  gitlab: "gitlab.com",
  bitbucket: "bitbucket.org",
  atlassian: "atlassian.com",
  jira: "atlassian.com",
  stripe: "stripe.com",
  paypal: "paypal.com",
  linear: "linear.app",
  vercel: "vercel.com",
  supabase: "supabase.com",
  tailscale: "tailscale.com",
  docker: "docker.com",
  cloudflare: "cloudflare.com",
  digitalocean: "digitalocean.com",
  heroku: "heroku.com",
  zoom: "zoom.us",
  uber: "uber.com",
  airbnb: "airbnb.com",
  pinterest: "pinterest.com",
  twitch: "twitch.tv",
  steam: "steampowered.com",
  roblox: "roblox.com",
  autodesk: "autodesk.com",
  microsoft: "microsoft.com",
  live: "live.com",
  outlook: "outlook.com",
  dribbble: "dribbble.com",
  macosicons: "macosicons.com",
  epicgames: "epicgames.com",
  playstation: "playstation.com",
  xbox: "xbox.com",
  nintendo: "nintendo.com",
  ebay: "ebay.com",
  adobe: "adobe.com",
  shopify: "shopify.com",
  whatsapp: "whatsapp.com",
  telegram: "telegram.org",
  signal: "signal.org",
  "1password": "1password.com",
  bitwarden: "bitwarden.com",
  chase: "chase.com",
  "bank of america": "bankofamerica.com",
  "wells fargo": "wellsfargo.com",
  citi: "citi.com",
  "american express": "americanexpress.com",
  amex: "americanexpress.com",
  mastercard: "mastercard.com",
  visa: "visa.com",
  bandlab: "bandlab.com"
};

/**
 * Extract clean domain hostname from a URL or title
 */
export function extractDomain(item: KloakItem): string | null {
  // 1. From item URLs
  if (item.urls && item.urls.length > 0) {
    for (const u of item.urls) {
      const cleaned = u.trim();
      if (!cleaned) continue;
      try {
        const urlObj = new URL(cleaned.startsWith("http") ? cleaned : `https://${cleaned}`);
        if (urlObj.hostname) return urlObj.hostname;
      } catch {}
    }
  }

  // 2. From title if formatted like a domain (e.g. account.live.com, github.com, macosicons.com)
  const title = item.title.trim().toLowerCase();
  if (title.includes(".") && !title.includes(" ")) {
    try {
      const urlObj = new URL(title.startsWith("http") ? title : `https://${title}`);
      if (urlObj.hostname) return urlObj.hostname;
    } catch {
      return title;
    }
  }

  // 3. From Authenticator Issuer
  if (item.authenticatorDetails?.issuer) {
    const issuer = item.authenticatorDetails.issuer.toLowerCase().trim();
    if (BRAND_MAP[issuer]) return BRAND_MAP[issuer];
    for (const [brand, domain] of Object.entries(BRAND_MAP)) {
      if (issuer.includes(brand)) return domain;
    }
  }

  // 4. From Brand Name Dictionary Match
  for (const [brand, domain] of Object.entries(BRAND_MAP)) {
    if (title === brand || title.includes(brand)) {
      return domain;
    }
  }

  return null;
}

/**
 * Return high-resolution favicon / brand logo with fallback icon
 */
export function getItemIcon(item: KloakItem): Image.ImageLike {
  const domain = extractDomain(item);

  if (domain && (item.type === "login" || item.type === "authenticator" || !item.type)) {
    return {
      source: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
      fallback: item.type === "authenticator" ? Icon.Lock : Icon.Key,
      mask: Image.Mask.RoundedRectangle
    };
  }

  switch (item.type) {
    case "card":
      return { source: Icon.CreditCard, tintColor: Color.Green };
    case "identity":
      return { source: Icon.Person, tintColor: Color.Orange };
    case "email_alias":
      return { source: Icon.Envelope, tintColor: Color.Purple };
    case "authenticator":
      return { source: Icon.Lock, tintColor: Color.Blue };
    case "secure_note":
      return { source: Icon.Document, tintColor: Color.Yellow };
    default:
      return { source: Icon.Key, tintColor: Color.Blue };
  }
}
