/**
 * Kloak Browser Extension — Service Domain Intelligence & Auto-Resolution Engine
 *
 * Automatically resolves and suggests all canonical, login, API, and associated domains
 * when creating or editing credentials in the Kloak Browser Extension.
 *
 * Capabilities:
 * 1. Comprehensive multi-domain database for 120+ top web services & platforms
 * 2. Instant auto-fill of primary URL upon typing the service name
 * 3. Interactive smart domain chips (+ domain / ✓ added) for multi-domain ecosystems (Google, Microsoft, Amazon, etc.)
 * 4. Bi-directional inference: paste a domain -> infer service name & trigger logo
 * 5. Fuzzy and prefix matching with smart TLD fallback
 */

export interface ServiceDefinition {
  id: string;
  displayName: string;
  category?: 'developer' | 'cloud' | 'ai' | 'social' | 'entertainment' | 'productivity' | 'finance' | 'tools' | 'other';
  primaryUrl: string;
  primaryDomain: string;
  domains: string[];
  aliases?: string[];
}

export interface ServiceDomainInfo {
  serviceId: string;
  displayName: string;
  primaryUrl: string;
  primaryDomain: string;
  domains: string[];
  urls: string[];
  matchType: 'exact' | 'alias' | 'prefix' | 'url_domain' | 'heuristic';
}

// ── 1. Comprehensive Multi-Domain Service Registry ──
export const KNOWN_SERVICES: ServiceDefinition[] = [
  // ── Tech Giants & Core Ecosystems ──
  {
    id: 'google',
    displayName: 'Google',
    category: 'cloud',
    primaryUrl: 'https://accounts.google.com',
    primaryDomain: 'accounts.google.com',
    domains: [
      'accounts.google.com',
      'google.com',
      'gmail.com',
      'drive.google.com',
      'docs.google.com',
      'sheets.google.com',
      'slides.google.com',
      'calendar.google.com',
      'meet.google.com',
      'photos.google.com',
      'cloud.google.com',
      'console.cloud.google.com'
    ],
    aliases: ['gmail', 'googlemail', 'gsuite', 'google workspace', 'google account']
  },
  {
    id: 'microsoft',
    displayName: 'Microsoft',
    category: 'cloud',
    primaryUrl: 'https://login.microsoftonline.com',
    primaryDomain: 'login.microsoftonline.com',
    domains: [
      'login.microsoftonline.com',
      'microsoft.com',
      'account.live.com',
      'outlook.com',
      'office.com',
      'office365.com',
      'onedrive.live.com',
      'teams.microsoft.com',
      'portal.azure.com',
      'azure.com',
      'live.com',
      'hotmail.com',
      'msn.com',
      'bing.com'
    ],
    aliases: ['outlook', 'hotmail', 'office', 'office365', 'o365', 'azure', 'live', 'msn', 'teams']
  },
  {
    id: 'apple',
    displayName: 'Apple',
    category: 'cloud',
    primaryUrl: 'https://appleid.apple.com',
    primaryDomain: 'appleid.apple.com',
    domains: [
      'appleid.apple.com',
      'icloud.com',
      'apple.com',
      'developer.apple.com',
      'music.apple.com',
      'tv.apple.com'
    ],
    aliases: ['icloud', 'apple id', 'appleid', 'itunes', 'apple developer']
  },
  {
    id: 'amazon',
    displayName: 'Amazon',
    category: 'entertainment',
    primaryUrl: 'https://amazon.com',
    primaryDomain: 'amazon.com',
    domains: [
      'amazon.com',
      'primevideo.com',
      'audible.com',
      'kindle.com'
    ],
    aliases: ['prime video', 'primevideo', 'audible']
  },
  {
    id: 'aws',
    displayName: 'AWS',
    category: 'cloud',
    primaryUrl: 'https://console.aws.amazon.com',
    primaryDomain: 'console.aws.amazon.com',
    domains: [
      'console.aws.amazon.com',
      'aws.amazon.com',
      'signin.aws.amazon.com'
    ],
    aliases: ['amazon web services', 'aws console', 'amazon aws']
  },
  {
    id: 'youtube',
    displayName: 'YouTube',
    category: 'entertainment',
    primaryUrl: 'https://youtube.com',
    primaryDomain: 'youtube.com',
    domains: [
      'youtube.com',
      'music.youtube.com',
      'studio.youtube.com',
      'youtu.be'
    ],
    aliases: ['yt', 'youtube music', 'yt music']
  },
  {
    id: 'meta',
    displayName: 'Meta (Facebook)',
    category: 'social',
    primaryUrl: 'https://facebook.com',
    primaryDomain: 'facebook.com',
    domains: [
      'facebook.com',
      'fb.com',
      'meta.com',
      'messenger.com'
    ],
    aliases: ['facebook', 'fb', 'messenger']
  },
  {
    id: 'instagram',
    displayName: 'Instagram',
    category: 'social',
    primaryUrl: 'https://instagram.com',
    primaryDomain: 'instagram.com',
    domains: [
      'instagram.com',
      'threads.net'
    ],
    aliases: ['insta', 'ig', 'threads']
  },
  {
    id: 'whatsapp',
    displayName: 'WhatsApp',
    category: 'social',
    primaryUrl: 'https://web.whatsapp.com',
    primaryDomain: 'web.whatsapp.com',
    domains: [
      'web.whatsapp.com',
      'whatsapp.com'
    ],
    aliases: ['wa', 'whatsapp web']
  },
  {
    id: 'twitter',
    displayName: 'X (Twitter)',
    category: 'social',
    primaryUrl: 'https://x.com',
    primaryDomain: 'x.com',
    domains: ['x.com', 'twitter.com'],
    aliases: ['x', 'twitter', 'tweetdeck']
  },

  // ── Developer Platforms & DevOps ──
  {
    id: 'github',
    displayName: 'GitHub',
    category: 'developer',
    primaryUrl: 'https://github.com',
    primaryDomain: 'github.com',
    domains: ['github.com', 'gist.github.com', 'github.dev', 'copilot.github.com'],
    aliases: ['gh', 'copilot', 'gist']
  },
  {
    id: 'gitlab',
    displayName: 'GitLab',
    category: 'developer',
    primaryUrl: 'https://gitlab.com',
    primaryDomain: 'gitlab.com',
    domains: ['gitlab.com'],
    aliases: []
  },
  {
    id: 'bitbucket',
    displayName: 'Bitbucket',
    category: 'developer',
    primaryUrl: 'https://bitbucket.org',
    primaryDomain: 'bitbucket.org',
    domains: ['bitbucket.org'],
    aliases: []
  },
  {
    id: 'atlassian',
    displayName: 'Atlassian',
    category: 'productivity',
    primaryUrl: 'https://id.atlassian.com',
    primaryDomain: 'id.atlassian.com',
    domains: [
      'id.atlassian.com',
      'atlassian.com',
      'jira.atlassian.com',
      'confluence.atlassian.com',
      'trello.com',
      'bitbucket.org'
    ],
    aliases: ['jira', 'confluence', 'trello']
  },
  {
    id: 'vercel',
    displayName: 'Vercel',
    category: 'developer',
    primaryUrl: 'https://vercel.com',
    primaryDomain: 'vercel.com',
    domains: ['vercel.com', 'vercel.app'],
    aliases: ['zeit']
  },
  {
    id: 'supabase',
    displayName: 'Supabase',
    category: 'developer',
    primaryUrl: 'https://supabase.com',
    primaryDomain: 'supabase.com',
    domains: ['supabase.com', 'app.supabase.com'],
    aliases: []
  },
  {
    id: 'cloudflare',
    displayName: 'Cloudflare',
    category: 'cloud',
    primaryUrl: 'https://dash.cloudflare.com',
    primaryDomain: 'dash.cloudflare.com',
    domains: ['dash.cloudflare.com', 'cloudflare.com'],
    aliases: ['cf']
  },
  {
    id: 'docker',
    displayName: 'Docker',
    category: 'developer',
    primaryUrl: 'https://hub.docker.com',
    primaryDomain: 'hub.docker.com',
    domains: ['hub.docker.com', 'docker.com'],
    aliases: ['docker hub']
  },
  {
    id: 'digitalocean',
    displayName: 'DigitalOcean',
    category: 'cloud',
    primaryUrl: 'https://cloud.digitalocean.com',
    primaryDomain: 'cloud.digitalocean.com',
    domains: ['cloud.digitalocean.com', 'digitalocean.com'],
    aliases: ['do']
  },
  {
    id: 'heroku',
    displayName: 'Heroku',
    category: 'cloud',
    primaryUrl: 'https://dashboard.heroku.com',
    primaryDomain: 'dashboard.heroku.com',
    domains: ['dashboard.heroku.com', 'heroku.com'],
    aliases: []
  },
  {
    id: 'tailscale',
    displayName: 'Tailscale',
    category: 'tools',
    primaryUrl: 'https://login.tailscale.com',
    primaryDomain: 'login.tailscale.com',
    domains: ['login.tailscale.com', 'tailscale.com'],
    aliases: []
  },
  {
    id: 'netlify',
    displayName: 'Netlify',
    category: 'developer',
    primaryUrl: 'https://app.netlify.com',
    primaryDomain: 'app.netlify.com',
    domains: ['app.netlify.com', 'netlify.com'],
    aliases: []
  },
  {
    id: 'railway',
    displayName: 'Railway',
    category: 'developer',
    primaryUrl: 'https://railway.app',
    primaryDomain: 'railway.app',
    domains: ['railway.app'],
    aliases: []
  },
  {
    id: 'render',
    displayName: 'Render',
    category: 'developer',
    primaryUrl: 'https://dashboard.render.com',
    primaryDomain: 'dashboard.render.com',
    domains: ['dashboard.render.com', 'render.com'],
    aliases: []
  },
  {
    id: 'cursor',
    displayName: 'Cursor',
    category: 'developer',
    primaryUrl: 'https://cursor.com',
    primaryDomain: 'cursor.com',
    domains: ['cursor.com'],
    aliases: ['cursor ai']
  },
  {
    id: 'linear',
    displayName: 'Linear',
    category: 'productivity',
    primaryUrl: 'https://linear.app',
    primaryDomain: 'linear.app',
    domains: ['linear.app'],
    aliases: []
  },
  {
    id: 'npm',
    displayName: 'npm',
    category: 'developer',
    primaryUrl: 'https://npmjs.com',
    primaryDomain: 'npmjs.com',
    domains: ['npmjs.com'],
    aliases: ['node package manager']
  },
  {
    id: 'postman',
    displayName: 'Postman',
    category: 'developer',
    primaryUrl: 'https://identity.getpostman.com',
    primaryDomain: 'identity.getpostman.com',
    domains: ['identity.getpostman.com', 'postman.com', 'web.postman.co'],
    aliases: []
  },
  {
    id: 'sentry',
    displayName: 'Sentry',
    category: 'developer',
    primaryUrl: 'https://sentry.io',
    primaryDomain: 'sentry.io',
    domains: ['sentry.io'],
    aliases: []
  },
  {
    id: 'datadog',
    displayName: 'Datadog',
    category: 'developer',
    primaryUrl: 'https://app.datadoghq.com',
    primaryDomain: 'app.datadoghq.com',
    domains: ['app.datadoghq.com', 'datadoghq.com'],
    aliases: []
  },

  // ── AI & Machine Learning ──
  {
    id: 'openai',
    displayName: 'OpenAI (ChatGPT)',
    category: 'ai',
    primaryUrl: 'https://chatgpt.com',
    primaryDomain: 'chatgpt.com',
    domains: ['chatgpt.com', 'platform.openai.com', 'openai.com'],
    aliases: ['chatgpt', 'gpt', 'dall-e', 'openai api']
  },
  {
    id: 'anthropic',
    displayName: 'Anthropic (Claude)',
    category: 'ai',
    primaryUrl: 'https://claude.ai',
    primaryDomain: 'claude.ai',
    domains: ['claude.ai', 'anthropic.com', 'console.anthropic.com'],
    aliases: ['claude', 'claude ai', 'anthropic api']
  },
  {
    id: 'gemini',
    displayName: 'Google Gemini',
    category: 'ai',
    primaryUrl: 'https://gemini.google.com',
    primaryDomain: 'gemini.google.com',
    domains: ['gemini.google.com', 'deepmind.google', 'ai.google.dev'],
    aliases: ['google gemini', 'bard', 'deepmind']
  },
  {
    id: 'perplexity',
    displayName: 'Perplexity AI',
    category: 'ai',
    primaryUrl: 'https://perplexity.ai',
    primaryDomain: 'perplexity.ai',
    domains: ['perplexity.ai'],
    aliases: ['perplexity']
  },
  {
    id: 'huggingface',
    displayName: 'Hugging Face',
    category: 'ai',
    primaryUrl: 'https://huggingface.co',
    primaryDomain: 'huggingface.co',
    domains: ['huggingface.co'],
    aliases: ['hf']
  },
  {
    id: 'midjourney',
    displayName: 'Midjourney',
    category: 'ai',
    primaryUrl: 'https://midjourney.com',
    primaryDomain: 'midjourney.com',
    domains: ['midjourney.com'],
    aliases: []
  },
  {
    id: 'replicate',
    displayName: 'Replicate',
    category: 'ai',
    primaryUrl: 'https://replicate.com',
    primaryDomain: 'replicate.com',
    domains: ['replicate.com'],
    aliases: []
  },

  // ── Privacy & Security ──
  {
    id: 'proton',
    displayName: 'Proton',
    category: 'tools',
    primaryUrl: 'https://account.proton.me',
    primaryDomain: 'account.proton.me',
    domains: [
      'account.proton.me',
      'proton.me',
      'protonmail.com',
      'protonvpn.com',
      'pass.proton.me',
      'drive.proton.me'
    ],
    aliases: ['protonmail', 'proton mail', 'proton vpn', 'proton pass']
  },
  {
    id: 'kloak',
    displayName: 'Kloak',
    category: 'tools',
    primaryUrl: 'https://naetikarvind.github.io/kloak/',
    primaryDomain: 'naetikarvind.github.io',
    domains: ['naetikarvind.github.io', 'kloak.app'],
    aliases: ['kloak password manager']
  },
  {
    id: 'bitwarden',
    displayName: 'Bitwarden',
    category: 'tools',
    primaryUrl: 'https://vault.bitwarden.com',
    primaryDomain: 'vault.bitwarden.com',
    domains: ['vault.bitwarden.com', 'bitwarden.com'],
    aliases: []
  },
  {
    id: 'onepassword',
    displayName: '1Password',
    category: 'tools',
    primaryUrl: 'https://my.1password.com',
    primaryDomain: 'my.1password.com',
    domains: ['my.1password.com', '1password.com'],
    aliases: ['1password']
  },
  {
    id: 'lastpass',
    displayName: 'LastPass',
    category: 'tools',
    primaryUrl: 'https://lastpass.com',
    primaryDomain: 'lastpass.com',
    domains: ['lastpass.com'],
    aliases: []
  },

  // ── Productivity & Collaboration ──
  {
    id: 'notion',
    displayName: 'Notion',
    category: 'productivity',
    primaryUrl: 'https://notion.so',
    primaryDomain: 'notion.so',
    domains: ['notion.so', 'notion.site'],
    aliases: []
  },
  {
    id: 'figma',
    displayName: 'Figma',
    category: 'productivity',
    primaryUrl: 'https://figma.com',
    primaryDomain: 'figma.com',
    domains: ['figma.com'],
    aliases: ['figjam']
  },
  {
    id: 'canva',
    displayName: 'Canva',
    category: 'productivity',
    primaryUrl: 'https://canva.com',
    primaryDomain: 'canva.com',
    domains: ['canva.com'],
    aliases: []
  },
  {
    id: 'slack',
    displayName: 'Slack',
    category: 'social',
    primaryUrl: 'https://slack.com',
    primaryDomain: 'slack.com',
    domains: ['slack.com', 'app.slack.com'],
    aliases: []
  },
  {
    id: 'discord',
    displayName: 'Discord',
    category: 'social',
    primaryUrl: 'https://discord.com',
    primaryDomain: 'discord.com',
    domains: ['discord.com', 'discord.gg'],
    aliases: []
  },
  {
    id: 'zoom',
    displayName: 'Zoom',
    category: 'productivity',
    primaryUrl: 'https://zoom.us',
    primaryDomain: 'zoom.us',
    domains: ['zoom.us', 'us04web.zoom.us', 'us02web.zoom.us'],
    aliases: ['zoom video']
  },
  {
    id: 'dropbox',
    displayName: 'Dropbox',
    category: 'productivity',
    primaryUrl: 'https://dropbox.com',
    primaryDomain: 'dropbox.com',
    domains: ['dropbox.com', 'paper.dropbox.com'],
    aliases: []
  },
  {
    id: 'box',
    displayName: 'Box',
    category: 'productivity',
    primaryUrl: 'https://box.com',
    primaryDomain: 'box.com',
    domains: ['box.com', 'app.box.com'],
    aliases: []
  },
  {
    id: 'miro',
    displayName: 'Miro',
    category: 'productivity',
    primaryUrl: 'https://miro.com',
    primaryDomain: 'miro.com',
    domains: ['miro.com', 'realtimeboard.com'],
    aliases: []
  },
  {
    id: 'airtable',
    displayName: 'Airtable',
    category: 'productivity',
    primaryUrl: 'https://airtable.com',
    primaryDomain: 'airtable.com',
    domains: ['airtable.com'],
    aliases: []
  },
  {
    id: 'asana',
    displayName: 'Asana',
    category: 'productivity',
    primaryUrl: 'https://app.asana.com',
    primaryDomain: 'app.asana.com',
    domains: ['app.asana.com', 'asana.com'],
    aliases: []
  },
  {
    id: 'monday',
    displayName: 'Monday.com',
    category: 'productivity',
    primaryUrl: 'https://monday.com',
    primaryDomain: 'monday.com',
    domains: ['monday.com'],
    aliases: ['monday']
  },
  {
    id: 'clickup',
    displayName: 'ClickUp',
    category: 'productivity',
    primaryUrl: 'https://app.clickup.com',
    primaryDomain: 'app.clickup.com',
    domains: ['app.clickup.com', 'clickup.com'],
    aliases: []
  },
  {
    id: 'loom',
    displayName: 'Loom',
    category: 'productivity',
    primaryUrl: 'https://loom.com',
    primaryDomain: 'loom.com',
    domains: ['loom.com'],
    aliases: []
  },
  {
    id: 'evernote',
    displayName: 'Evernote',
    category: 'productivity',
    primaryUrl: 'https://evernote.com',
    primaryDomain: 'evernote.com',
    domains: ['evernote.com'],
    aliases: []
  },
  {
    id: 'adobe',
    displayName: 'Adobe Creative Cloud',
    category: 'productivity',
    primaryUrl: 'https://account.adobe.com',
    primaryDomain: 'account.adobe.com',
    domains: ['account.adobe.com', 'adobe.com', 'creativecloud.adobe.com', 'behance.net'],
    aliases: ['adobe', 'photoshop', 'illustrator', 'creative cloud', 'behance']
  },
  {
    id: 'salesforce',
    displayName: 'Salesforce',
    category: 'productivity',
    primaryUrl: 'https://login.salesforce.com',
    primaryDomain: 'login.salesforce.com',
    domains: ['login.salesforce.com', 'salesforce.com', 'force.com'],
    aliases: []
  },

  // ── Social, Community & Content ──
  {
    id: 'linkedin',
    displayName: 'LinkedIn',
    category: 'social',
    primaryUrl: 'https://linkedin.com',
    primaryDomain: 'linkedin.com',
    domains: ['linkedin.com', 'learning.linkedin.com', 'recruiter.linkedin.com'],
    aliases: []
  },
  {
    id: 'reddit',
    displayName: 'Reddit',
    category: 'social',
    primaryUrl: 'https://reddit.com',
    primaryDomain: 'reddit.com',
    domains: ['reddit.com', 'old.reddit.com'],
    aliases: []
  },
  {
    id: 'pinterest',
    displayName: 'Pinterest',
    category: 'social',
    primaryUrl: 'https://pinterest.com',
    primaryDomain: 'pinterest.com',
    domains: ['pinterest.com'],
    aliases: []
  },
  {
    id: 'tiktok',
    displayName: 'TikTok',
    category: 'social',
    primaryUrl: 'https://tiktok.com',
    primaryDomain: 'tiktok.com',
    domains: ['tiktok.com'],
    aliases: []
  },
  {
    id: 'telegram',
    displayName: 'Telegram',
    category: 'social',
    primaryUrl: 'https://web.telegram.org',
    primaryDomain: 'web.telegram.org',
    domains: ['web.telegram.org', 'telegram.org', 't.me'],
    aliases: ['tg']
  },
  {
    id: 'signal',
    displayName: 'Signal',
    category: 'social',
    primaryUrl: 'https://signal.org',
    primaryDomain: 'signal.org',
    domains: ['signal.org'],
    aliases: []
  },
  {
    id: 'medium',
    displayName: 'Medium',
    category: 'social',
    primaryUrl: 'https://medium.com',
    primaryDomain: 'medium.com',
    domains: ['medium.com'],
    aliases: []
  },
  {
    id: 'substack',
    displayName: 'Substack',
    category: 'social',
    primaryUrl: 'https://substack.com',
    primaryDomain: 'substack.com',
    domains: ['substack.com'],
    aliases: []
  },
  {
    id: 'wordpress',
    displayName: 'WordPress',
    category: 'productivity',
    primaryUrl: 'https://wordpress.com',
    primaryDomain: 'wordpress.com',
    domains: ['wordpress.com', 'wordpress.org'],
    aliases: ['wp']
  },

  // ── Streaming & Entertainment ──
  {
    id: 'netflix',
    displayName: 'Netflix',
    category: 'entertainment',
    primaryUrl: 'https://netflix.com',
    primaryDomain: 'netflix.com',
    domains: ['netflix.com'],
    aliases: []
  },
  {
    id: 'spotify',
    displayName: 'Spotify',
    category: 'entertainment',
    primaryUrl: 'https://accounts.spotify.com',
    primaryDomain: 'accounts.spotify.com',
    domains: ['accounts.spotify.com', 'open.spotify.com', 'spotify.com'],
    aliases: []
  },
  {
    id: 'hotstar',
    displayName: 'Disney+ Hotstar',
    category: 'entertainment',
    primaryUrl: 'https://hotstar.com',
    primaryDomain: 'hotstar.com',
    domains: ['hotstar.com', 'disneyplus.com'],
    aliases: ['disney', 'disney+', 'disneyplus', 'hotstar']
  },
  {
    id: 'hulu',
    displayName: 'Hulu',
    category: 'entertainment',
    primaryUrl: 'https://hulu.com',
    primaryDomain: 'hulu.com',
    domains: ['hulu.com'],
    aliases: []
  },
  {
    id: 'max',
    displayName: 'Max (HBO)',
    category: 'entertainment',
    primaryUrl: 'https://max.com',
    primaryDomain: 'max.com',
    domains: ['max.com', 'hbomax.com'],
    aliases: ['hbo', 'hbomax']
  },
  {
    id: 'twitch',
    displayName: 'Twitch',
    category: 'entertainment',
    primaryUrl: 'https://twitch.tv',
    primaryDomain: 'twitch.tv',
    domains: ['twitch.tv'],
    aliases: []
  },
  {
    id: 'bandlab',
    displayName: 'BandLab',
    category: 'entertainment',
    primaryUrl: 'https://bandlab.com',
    primaryDomain: 'bandlab.com',
    domains: ['bandlab.com'],
    aliases: []
  },

  // ── Gaming ──
  {
    id: 'steam',
    displayName: 'Steam',
    category: 'entertainment',
    primaryUrl: 'https://steampowered.com',
    primaryDomain: 'steampowered.com',
    domains: ['steampowered.com', 'steamcommunity.com'],
    aliases: ['valve', 'steamcommunity']
  },
  {
    id: 'epicgames',
    displayName: 'Epic Games',
    category: 'entertainment',
    primaryUrl: 'https://store.epicgames.com',
    primaryDomain: 'store.epicgames.com',
    domains: ['store.epicgames.com', 'epicgames.com', 'unrealengine.com'],
    aliases: ['epic', 'fortnite', 'unreal']
  },
  {
    id: 'playstation',
    displayName: 'PlayStation (Sony)',
    category: 'entertainment',
    primaryUrl: 'https://my.playstation.com',
    primaryDomain: 'my.playstation.com',
    domains: ['my.playstation.com', 'playstation.com', 'sony.com'],
    aliases: ['psn', 'sony']
  },
  {
    id: 'xbox',
    displayName: 'Xbox',
    category: 'entertainment',
    primaryUrl: 'https://xbox.com',
    primaryDomain: 'xbox.com',
    domains: ['xbox.com'],
    aliases: []
  },
  {
    id: 'nintendo',
    displayName: 'Nintendo',
    category: 'entertainment',
    primaryUrl: 'https://accounts.nintendo.com',
    primaryDomain: 'accounts.nintendo.com',
    domains: ['accounts.nintendo.com', 'nintendo.com'],
    aliases: []
  },
  {
    id: 'roblox',
    displayName: 'Roblox',
    category: 'entertainment',
    primaryUrl: 'https://roblox.com',
    primaryDomain: 'roblox.com',
    domains: ['roblox.com'],
    aliases: []
  },

  // ── Finance, Payments & Crypto ──
  {
    id: 'stripe',
    displayName: 'Stripe',
    category: 'finance',
    primaryUrl: 'https://dashboard.stripe.com',
    primaryDomain: 'dashboard.stripe.com',
    domains: ['dashboard.stripe.com', 'stripe.com'],
    aliases: []
  },
  {
    id: 'paypal',
    displayName: 'PayPal',
    category: 'finance',
    primaryUrl: 'https://paypal.com',
    primaryDomain: 'paypal.com',
    domains: ['paypal.com', 'paypal.me'],
    aliases: []
  },
  {
    id: 'coinbase',
    displayName: 'Coinbase',
    category: 'finance',
    primaryUrl: 'https://coinbase.com',
    primaryDomain: 'coinbase.com',
    domains: ['coinbase.com', 'pro.coinbase.com'],
    aliases: []
  },
  {
    id: 'binance',
    displayName: 'Binance',
    category: 'finance',
    primaryUrl: 'https://binance.com',
    primaryDomain: 'binance.com',
    domains: ['binance.com', 'binance.us'],
    aliases: []
  },
  {
    id: 'kraken',
    displayName: 'Kraken',
    category: 'finance',
    primaryUrl: 'https://kraken.com',
    primaryDomain: 'kraken.com',
    domains: ['kraken.com'],
    aliases: []
  },
  {
    id: 'robinhood',
    displayName: 'Robinhood',
    category: 'finance',
    primaryUrl: 'https://robinhood.com',
    primaryDomain: 'robinhood.com',
    domains: ['robinhood.com'],
    aliases: []
  },
  {
    id: 'wise',
    displayName: 'Wise',
    category: 'finance',
    primaryUrl: 'https://wise.com',
    primaryDomain: 'wise.com',
    domains: ['wise.com', 'transferwise.com'],
    aliases: ['transferwise']
  },
  {
    id: 'revolut',
    displayName: 'Revolut',
    category: 'finance',
    primaryUrl: 'https://revolut.com',
    primaryDomain: 'revolut.com',
    domains: ['revolut.com', 'app.revolut.com'],
    aliases: []
  },
  {
    id: 'chase',
    displayName: 'Chase Bank',
    category: 'finance',
    primaryUrl: 'https://chase.com',
    primaryDomain: 'chase.com',
    domains: ['chase.com'],
    aliases: ['chase']
  },
  {
    id: 'bankofamerica',
    displayName: 'Bank of America',
    category: 'finance',
    primaryUrl: 'https://bankofamerica.com',
    primaryDomain: 'bankofamerica.com',
    domains: ['bankofamerica.com', 'bofa.com'],
    aliases: ['bofa']
  },
  {
    id: 'wellsfargo',
    displayName: 'Wells Fargo',
    category: 'finance',
    primaryUrl: 'https://wellsfargo.com',
    primaryDomain: 'wellsfargo.com',
    domains: ['wellsfargo.com'],
    aliases: []
  },
  {
    id: 'citi',
    displayName: 'Citibank',
    category: 'finance',
    primaryUrl: 'https://citi.com',
    primaryDomain: 'citi.com',
    domains: ['citi.com', 'citibank.com'],
    aliases: ['citi']
  },
  {
    id: 'capitalone',
    displayName: 'Capital One',
    category: 'finance',
    primaryUrl: 'https://capitalone.com',
    primaryDomain: 'capitalone.com',
    domains: ['capitalone.com'],
    aliases: []
  },
  {
    id: 'amex',
    displayName: 'American Express',
    category: 'finance',
    primaryUrl: 'https://americanexpress.com',
    primaryDomain: 'americanexpress.com',
    domains: ['americanexpress.com', 'amex.com'],
    aliases: ['amex']
  },

  // ── Commerce & Marketplaces ──
  {
    id: 'shopify',
    displayName: 'Shopify',
    category: 'finance',
    primaryUrl: 'https://admin.shopify.com',
    primaryDomain: 'admin.shopify.com',
    domains: ['admin.shopify.com', 'shopify.com', 'myshopify.com'],
    aliases: []
  },
  {
    id: 'ebay',
    displayName: 'eBay',
    category: 'finance',
    primaryUrl: 'https://ebay.com',
    primaryDomain: 'ebay.com',
    domains: ['ebay.com'],
    aliases: []
  },
  {
    id: 'etsy',
    displayName: 'Etsy',
    category: 'finance',
    primaryUrl: 'https://etsy.com',
    primaryDomain: 'etsy.com',
    domains: ['etsy.com'],
    aliases: []
  },
  {
    id: 'uber',
    displayName: 'Uber',
    category: 'tools',
    primaryUrl: 'https://uber.com',
    primaryDomain: 'uber.com',
    domains: ['uber.com', 'm.uber.com', 'ubereats.com'],
    aliases: ['uber eats']
  },
  {
    id: 'airbnb',
    displayName: 'Airbnb',
    category: 'tools',
    primaryUrl: 'https://airbnb.com',
    primaryDomain: 'airbnb.com',
    domains: ['airbnb.com'],
    aliases: []
  },
  {
    id: 'booking',
    displayName: 'Booking.com',
    category: 'tools',
    primaryUrl: 'https://booking.com',
    primaryDomain: 'booking.com',
    domains: ['booking.com'],
    aliases: ['booking']
  },

  // ── Browsers & Web Tools ──
  {
    id: 'opera',
    displayName: 'Opera',
    category: 'tools',
    primaryUrl: 'https://auth.opera.com',
    primaryDomain: 'auth.opera.com',
    domains: ['auth.opera.com', 'opera.com'],
    aliases: []
  },
  {
    id: 'brave',
    displayName: 'Brave',
    category: 'tools',
    primaryUrl: 'https://brave.com',
    primaryDomain: 'brave.com',
    domains: ['brave.com', 'search.brave.com'],
    aliases: []
  },
  {
    id: 'firefox',
    displayName: 'Firefox (Mozilla)',
    category: 'tools',
    primaryUrl: 'https://accounts.firefox.com',
    primaryDomain: 'accounts.firefox.com',
    domains: ['accounts.firefox.com', 'mozilla.org', 'firefox.com'],
    aliases: ['mozilla']
  },
  {
    id: 'duckduckgo',
    displayName: 'DuckDuckGo',
    category: 'tools',
    primaryUrl: 'https://duckduckgo.com',
    primaryDomain: 'duckduckgo.com',
    domains: ['duckduckgo.com'],
    aliases: ['ddg']
  }
];

// ── 2. Normalization Helpers ──

/**
 * Strips punctuation, parentheticals, and common service suffixes.
 */
export function normalizeServiceName(query: string): string {
  return query
    .toLowerCase()
    .replace(/\s*\([^)]*\)|\s*\[[^\]]*\]/g, '') // remove (US), [Work], etc.
    .replace(/[^\w\s.-]/g, '')                   // remove non-alphanumeric except dots/hyphens
    .replace(/\b(login|signin|sign in|account|portal|dashboard|auth|app|inc|llc|official)\b/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Strips protocols and common subdomains from host.
 */
export function extractCleanDomain(input: string): string {
  let cleaned = input.toLowerCase().trim();
  cleaned = cleaned.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const prefixes = [
    'www.', 'app.', 'mail.', 'accounts.', 'account.', 'login.', 'signin.',
    'auth.', 'm.', 'dashboard.', 'portal.', 'api.', 'sso.', 'my.', 'web.',
    'id.', 'secure.', 'identity.', 'admin.'
  ];
  for (const p of prefixes) {
    if (cleaned.startsWith(p)) {
      cleaned = cleaned.slice(p.length);
      break;
    }
  }
  return cleaned;
}

// ── 3. Core Domain Resolver ──

/**
 * Given a user-entered service title (e.g. "GitHub", "Google", "AWS", "Netflix"),
 * resolves all canonical domains, primary URL, and display metadata.
 */
export function resolveServiceDomains(rawTitle: string): ServiceDomainInfo | null {
  if (!rawTitle) return null;
  const normalized = normalizeServiceName(rawTitle);
  if (!normalized || normalized.length < 2) return null;

  // 1. Check if user typed an explicit URL or domain (e.g. "github.com", "https://netflix.com")
  if (rawTitle.includes('.') || rawTitle.startsWith('http://') || rawTitle.startsWith('https://')) {
    const fromUrl = resolveServiceFromUrl(rawTitle);
    if (fromUrl) {
      const match = KNOWN_SERVICES.find(s => s.id === fromUrl.serviceId);
      if (match) {
        return {
          serviceId: match.id,
          displayName: match.displayName,
          primaryUrl: match.primaryUrl,
          primaryDomain: match.primaryDomain,
          domains: match.domains,
          urls: match.domains.map(d => `https://${d}`),
          matchType: 'url_domain'
        };
      }
    }

    // Direct domain inference (e.g. user typed "subdomain.company.io")
    const cleanHost = rawTitle.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (cleanHost.includes('.')) {
      return {
        serviceId: cleanHost.split('.')[0],
        displayName: cleanHost.split('.')[0].charAt(0).toUpperCase() + cleanHost.split('.')[0].slice(1),
        primaryUrl: `https://${cleanHost}`,
        primaryDomain: cleanHost,
        domains: [cleanHost],
        urls: [`https://${cleanHost}`],
        matchType: 'url_domain'
      };
    }
  }

  // 2. Exact match against service ID, displayName, or alias
  for (const s of KNOWN_SERVICES) {
    if (s.id === normalized || s.displayName.toLowerCase() === normalized) {
      return buildInfo(s, 'exact');
    }
    if (s.aliases && s.aliases.some(a => a.toLowerCase() === normalized)) {
      return buildInfo(s, 'alias');
    }
  }

  // 3. Word-boundary or starts-with match (e.g. "Google Work" -> Google, "GitHub Enterprise" -> GitHub)
  for (const s of KNOWN_SERVICES) {
    const sId = s.id.toLowerCase();
    const sName = s.displayName.toLowerCase();
    if (
      normalized.startsWith(sId + ' ') ||
      normalized.endsWith(' ' + sId) ||
      normalized.startsWith(sName + ' ') ||
      normalized.endsWith(' ' + sName)
    ) {
      return buildInfo(s, 'prefix');
    }
    if (s.aliases) {
      for (const a of s.aliases) {
        const al = a.toLowerCase();
        if (normalized.startsWith(al + ' ') || normalized.endsWith(' ' + al)) {
          return buildInfo(s, 'alias');
        }
      }
    }
  }

  // 4. Prefix match (e.g. typing "git" -> GitHub, "spot" -> Spotify, "micro" -> Microsoft)
  if (normalized.length >= 3) {
    const prefixMatch = KNOWN_SERVICES.find(s => {
      if (s.id.startsWith(normalized)) return true;
      if (s.displayName.toLowerCase().startsWith(normalized)) return true;
      if (s.aliases && s.aliases.some(a => a.toLowerCase().startsWith(normalized))) return true;
      return false;
    });
    if (prefixMatch) {
      return buildInfo(prefixMatch, 'prefix');
    }
  }

  // 5. Smart Heuristic Fallback for clean single-word brands (e.g. "airbnb" -> https://airbnb.com)
  if (!normalized.includes(' ') && normalized.length >= 3 && /^[a-z0-9-]+$/.test(normalized)) {
    const domain = `${normalized}.com`;
    return {
      serviceId: normalized,
      displayName: normalized.charAt(0).toUpperCase() + normalized.slice(1),
      primaryUrl: `https://${domain}`,
      primaryDomain: domain,
      domains: [domain],
      urls: [`https://${domain}`],
      matchType: 'heuristic'
    };
  }

  return null;
}

function buildInfo(service: ServiceDefinition, matchType: ServiceDomainInfo['matchType']): ServiceDomainInfo {
  return {
    serviceId: service.id,
    displayName: service.displayName,
    primaryUrl: service.primaryUrl,
    primaryDomain: service.primaryDomain,
    domains: service.domains,
    urls: service.domains.map(d => `https://${d}`),
    matchType
  };
}

// ── 4. Reverse Lookup: Domain to Service ──

/**
 * Given a URL or hostname, resolves which service it belongs to.
 * E.g. "https://gist.github.com" -> GitHub
 */
export function resolveServiceFromUrl(urlOrHost: string): { displayName: string; serviceId: string; domains: string[] } | null {
  if (!urlOrHost) return null;
  const raw = urlOrHost.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const clean = extractCleanDomain(raw);

  // Pass 1: Exact match on full hostname (prioritizes specific subdomains e.g. console.aws.amazon.com -> AWS)
  for (const s of KNOWN_SERVICES) {
    if (s.domains.some(d => d === raw)) {
      return {
        displayName: s.displayName,
        serviceId: s.id,
        domains: s.domains
      };
    }
  }

  // Pass 2: Subdomain suffix match on raw hostname
  for (const s of KNOWN_SERVICES) {
    if (s.domains.some(d => raw.endsWith('.' + d))) {
      return {
        displayName: s.displayName,
        serviceId: s.id,
        domains: s.domains
      };
    }
  }

  // Pass 3: Match on clean base domain
  for (const s of KNOWN_SERVICES) {
    if (s.domains.some(d => d === clean || clean.endsWith('.' + d))) {
      return {
        displayName: s.displayName,
        serviceId: s.id,
        domains: s.domains
      };
    }
  }

  // Fallback to capitalizing clean domain name
  const namePart = clean.split('.')[0];
  if (namePart && namePart.length >= 2) {
    return {
      displayName: namePart.charAt(0).toUpperCase() + namePart.slice(1),
      serviceId: namePart,
      domains: [clean]
    };
  }

  return null;
}

/**
 * Returns all service display names for datalist quick-picks.
 */
export function getAllKnownServiceNames(): string[] {
  return KNOWN_SERVICES.map(s => s.displayName).sort((a, b) => a.localeCompare(b));
}
