"use strict";
(() => {
  // src/service-domain-service.ts
  var KNOWN_SERVICES = [
    // ── Tech Giants & Core Ecosystems ──
    {
      id: "google",
      displayName: "Google",
      category: "cloud",
      primaryUrl: "https://accounts.google.com",
      primaryDomain: "accounts.google.com",
      domains: [
        "accounts.google.com",
        "google.com",
        "gmail.com",
        "drive.google.com",
        "docs.google.com",
        "sheets.google.com",
        "slides.google.com",
        "calendar.google.com",
        "meet.google.com",
        "photos.google.com",
        "cloud.google.com",
        "console.cloud.google.com"
      ],
      aliases: ["gmail", "googlemail", "gsuite", "google workspace", "google account"]
    },
    {
      id: "microsoft",
      displayName: "Microsoft",
      category: "cloud",
      primaryUrl: "https://login.microsoftonline.com",
      primaryDomain: "login.microsoftonline.com",
      domains: [
        "login.microsoftonline.com",
        "microsoft.com",
        "account.live.com",
        "outlook.com",
        "office.com",
        "office365.com",
        "onedrive.live.com",
        "teams.microsoft.com",
        "portal.azure.com",
        "azure.com",
        "live.com",
        "hotmail.com",
        "msn.com",
        "bing.com"
      ],
      aliases: ["outlook", "hotmail", "office", "office365", "o365", "azure", "live", "msn", "teams"]
    },
    {
      id: "apple",
      displayName: "Apple",
      category: "cloud",
      primaryUrl: "https://appleid.apple.com",
      primaryDomain: "appleid.apple.com",
      domains: [
        "appleid.apple.com",
        "icloud.com",
        "apple.com",
        "developer.apple.com",
        "music.apple.com",
        "tv.apple.com"
      ],
      aliases: ["icloud", "apple id", "appleid", "itunes", "apple developer"]
    },
    {
      id: "amazon",
      displayName: "Amazon",
      category: "entertainment",
      primaryUrl: "https://amazon.com",
      primaryDomain: "amazon.com",
      domains: [
        "amazon.com",
        "primevideo.com",
        "audible.com",
        "kindle.com"
      ],
      aliases: ["prime video", "primevideo", "audible"]
    },
    {
      id: "aws",
      displayName: "AWS",
      category: "cloud",
      primaryUrl: "https://console.aws.amazon.com",
      primaryDomain: "console.aws.amazon.com",
      domains: [
        "console.aws.amazon.com",
        "aws.amazon.com",
        "signin.aws.amazon.com"
      ],
      aliases: ["amazon web services", "aws console", "amazon aws"]
    },
    {
      id: "youtube",
      displayName: "YouTube",
      category: "entertainment",
      primaryUrl: "https://youtube.com",
      primaryDomain: "youtube.com",
      domains: [
        "youtube.com",
        "music.youtube.com",
        "studio.youtube.com",
        "youtu.be"
      ],
      aliases: ["yt", "youtube music", "yt music"]
    },
    {
      id: "meta",
      displayName: "Meta (Facebook)",
      category: "social",
      primaryUrl: "https://facebook.com",
      primaryDomain: "facebook.com",
      domains: [
        "facebook.com",
        "fb.com",
        "meta.com",
        "messenger.com"
      ],
      aliases: ["facebook", "fb", "messenger"]
    },
    {
      id: "instagram",
      displayName: "Instagram",
      category: "social",
      primaryUrl: "https://instagram.com",
      primaryDomain: "instagram.com",
      domains: [
        "instagram.com",
        "threads.net"
      ],
      aliases: ["insta", "ig", "threads"]
    },
    {
      id: "whatsapp",
      displayName: "WhatsApp",
      category: "social",
      primaryUrl: "https://web.whatsapp.com",
      primaryDomain: "web.whatsapp.com",
      domains: [
        "web.whatsapp.com",
        "whatsapp.com"
      ],
      aliases: ["wa", "whatsapp web"]
    },
    {
      id: "twitter",
      displayName: "X (Twitter)",
      category: "social",
      primaryUrl: "https://x.com",
      primaryDomain: "x.com",
      domains: ["x.com", "twitter.com"],
      aliases: ["x", "twitter", "tweetdeck"]
    },
    // ── Developer Platforms & DevOps ──
    {
      id: "github",
      displayName: "GitHub",
      category: "developer",
      primaryUrl: "https://github.com",
      primaryDomain: "github.com",
      domains: ["github.com", "gist.github.com", "github.dev", "copilot.github.com"],
      aliases: ["gh", "copilot", "gist"]
    },
    {
      id: "gitlab",
      displayName: "GitLab",
      category: "developer",
      primaryUrl: "https://gitlab.com",
      primaryDomain: "gitlab.com",
      domains: ["gitlab.com"],
      aliases: []
    },
    {
      id: "bitbucket",
      displayName: "Bitbucket",
      category: "developer",
      primaryUrl: "https://bitbucket.org",
      primaryDomain: "bitbucket.org",
      domains: ["bitbucket.org"],
      aliases: []
    },
    {
      id: "atlassian",
      displayName: "Atlassian",
      category: "productivity",
      primaryUrl: "https://id.atlassian.com",
      primaryDomain: "id.atlassian.com",
      domains: [
        "id.atlassian.com",
        "atlassian.com",
        "jira.atlassian.com",
        "confluence.atlassian.com",
        "trello.com",
        "bitbucket.org"
      ],
      aliases: ["jira", "confluence", "trello"]
    },
    {
      id: "vercel",
      displayName: "Vercel",
      category: "developer",
      primaryUrl: "https://vercel.com",
      primaryDomain: "vercel.com",
      domains: ["vercel.com", "vercel.app"],
      aliases: ["zeit"]
    },
    {
      id: "supabase",
      displayName: "Supabase",
      category: "developer",
      primaryUrl: "https://supabase.com",
      primaryDomain: "supabase.com",
      domains: ["supabase.com", "app.supabase.com"],
      aliases: []
    },
    {
      id: "cloudflare",
      displayName: "Cloudflare",
      category: "cloud",
      primaryUrl: "https://dash.cloudflare.com",
      primaryDomain: "dash.cloudflare.com",
      domains: ["dash.cloudflare.com", "cloudflare.com"],
      aliases: ["cf"]
    },
    {
      id: "docker",
      displayName: "Docker",
      category: "developer",
      primaryUrl: "https://hub.docker.com",
      primaryDomain: "hub.docker.com",
      domains: ["hub.docker.com", "docker.com"],
      aliases: ["docker hub"]
    },
    {
      id: "digitalocean",
      displayName: "DigitalOcean",
      category: "cloud",
      primaryUrl: "https://cloud.digitalocean.com",
      primaryDomain: "cloud.digitalocean.com",
      domains: ["cloud.digitalocean.com", "digitalocean.com"],
      aliases: ["do"]
    },
    {
      id: "heroku",
      displayName: "Heroku",
      category: "cloud",
      primaryUrl: "https://dashboard.heroku.com",
      primaryDomain: "dashboard.heroku.com",
      domains: ["dashboard.heroku.com", "heroku.com"],
      aliases: []
    },
    {
      id: "tailscale",
      displayName: "Tailscale",
      category: "tools",
      primaryUrl: "https://login.tailscale.com",
      primaryDomain: "login.tailscale.com",
      domains: ["login.tailscale.com", "tailscale.com"],
      aliases: []
    },
    {
      id: "netlify",
      displayName: "Netlify",
      category: "developer",
      primaryUrl: "https://app.netlify.com",
      primaryDomain: "app.netlify.com",
      domains: ["app.netlify.com", "netlify.com"],
      aliases: []
    },
    {
      id: "railway",
      displayName: "Railway",
      category: "developer",
      primaryUrl: "https://railway.app",
      primaryDomain: "railway.app",
      domains: ["railway.app"],
      aliases: []
    },
    {
      id: "render",
      displayName: "Render",
      category: "developer",
      primaryUrl: "https://dashboard.render.com",
      primaryDomain: "dashboard.render.com",
      domains: ["dashboard.render.com", "render.com"],
      aliases: []
    },
    {
      id: "cursor",
      displayName: "Cursor",
      category: "developer",
      primaryUrl: "https://cursor.com",
      primaryDomain: "cursor.com",
      domains: ["cursor.com"],
      aliases: ["cursor ai"]
    },
    {
      id: "linear",
      displayName: "Linear",
      category: "productivity",
      primaryUrl: "https://linear.app",
      primaryDomain: "linear.app",
      domains: ["linear.app"],
      aliases: []
    },
    {
      id: "npm",
      displayName: "npm",
      category: "developer",
      primaryUrl: "https://npmjs.com",
      primaryDomain: "npmjs.com",
      domains: ["npmjs.com"],
      aliases: ["node package manager"]
    },
    {
      id: "postman",
      displayName: "Postman",
      category: "developer",
      primaryUrl: "https://identity.getpostman.com",
      primaryDomain: "identity.getpostman.com",
      domains: ["identity.getpostman.com", "postman.com", "web.postman.co"],
      aliases: []
    },
    {
      id: "sentry",
      displayName: "Sentry",
      category: "developer",
      primaryUrl: "https://sentry.io",
      primaryDomain: "sentry.io",
      domains: ["sentry.io"],
      aliases: []
    },
    {
      id: "datadog",
      displayName: "Datadog",
      category: "developer",
      primaryUrl: "https://app.datadoghq.com",
      primaryDomain: "app.datadoghq.com",
      domains: ["app.datadoghq.com", "datadoghq.com"],
      aliases: []
    },
    // ── AI & Machine Learning ──
    {
      id: "openai",
      displayName: "OpenAI (ChatGPT)",
      category: "ai",
      primaryUrl: "https://chatgpt.com",
      primaryDomain: "chatgpt.com",
      domains: ["chatgpt.com", "platform.openai.com", "openai.com"],
      aliases: ["chatgpt", "gpt", "dall-e", "openai api"]
    },
    {
      id: "anthropic",
      displayName: "Anthropic (Claude)",
      category: "ai",
      primaryUrl: "https://claude.ai",
      primaryDomain: "claude.ai",
      domains: ["claude.ai", "anthropic.com", "console.anthropic.com"],
      aliases: ["claude", "claude ai", "anthropic api"]
    },
    {
      id: "gemini",
      displayName: "Google Gemini",
      category: "ai",
      primaryUrl: "https://gemini.google.com",
      primaryDomain: "gemini.google.com",
      domains: ["gemini.google.com", "deepmind.google", "ai.google.dev"],
      aliases: ["google gemini", "bard", "deepmind"]
    },
    {
      id: "perplexity",
      displayName: "Perplexity AI",
      category: "ai",
      primaryUrl: "https://perplexity.ai",
      primaryDomain: "perplexity.ai",
      domains: ["perplexity.ai"],
      aliases: ["perplexity"]
    },
    {
      id: "huggingface",
      displayName: "Hugging Face",
      category: "ai",
      primaryUrl: "https://huggingface.co",
      primaryDomain: "huggingface.co",
      domains: ["huggingface.co"],
      aliases: ["hf"]
    },
    {
      id: "midjourney",
      displayName: "Midjourney",
      category: "ai",
      primaryUrl: "https://midjourney.com",
      primaryDomain: "midjourney.com",
      domains: ["midjourney.com"],
      aliases: []
    },
    {
      id: "replicate",
      displayName: "Replicate",
      category: "ai",
      primaryUrl: "https://replicate.com",
      primaryDomain: "replicate.com",
      domains: ["replicate.com"],
      aliases: []
    },
    // ── Privacy & Security ──
    {
      id: "proton",
      displayName: "Proton",
      category: "tools",
      primaryUrl: "https://account.proton.me",
      primaryDomain: "account.proton.me",
      domains: [
        "account.proton.me",
        "proton.me",
        "protonmail.com",
        "protonvpn.com",
        "pass.proton.me",
        "drive.proton.me"
      ],
      aliases: ["protonmail", "proton mail", "proton vpn", "proton pass"]
    },
    {
      id: "kloak",
      displayName: "Kloak",
      category: "tools",
      primaryUrl: "https://naetikarvind.github.io/kloak/",
      primaryDomain: "naetikarvind.github.io",
      domains: ["naetikarvind.github.io", "kloak.app"],
      aliases: ["kloak password manager"]
    },
    {
      id: "bitwarden",
      displayName: "Bitwarden",
      category: "tools",
      primaryUrl: "https://vault.bitwarden.com",
      primaryDomain: "vault.bitwarden.com",
      domains: ["vault.bitwarden.com", "bitwarden.com"],
      aliases: []
    },
    {
      id: "onepassword",
      displayName: "1Password",
      category: "tools",
      primaryUrl: "https://my.1password.com",
      primaryDomain: "my.1password.com",
      domains: ["my.1password.com", "1password.com"],
      aliases: ["1password"]
    },
    {
      id: "lastpass",
      displayName: "LastPass",
      category: "tools",
      primaryUrl: "https://lastpass.com",
      primaryDomain: "lastpass.com",
      domains: ["lastpass.com"],
      aliases: []
    },
    // ── Productivity & Collaboration ──
    {
      id: "notion",
      displayName: "Notion",
      category: "productivity",
      primaryUrl: "https://notion.so",
      primaryDomain: "notion.so",
      domains: ["notion.so", "notion.site"],
      aliases: []
    },
    {
      id: "figma",
      displayName: "Figma",
      category: "productivity",
      primaryUrl: "https://figma.com",
      primaryDomain: "figma.com",
      domains: ["figma.com"],
      aliases: ["figjam"]
    },
    {
      id: "canva",
      displayName: "Canva",
      category: "productivity",
      primaryUrl: "https://canva.com",
      primaryDomain: "canva.com",
      domains: ["canva.com"],
      aliases: []
    },
    {
      id: "slack",
      displayName: "Slack",
      category: "social",
      primaryUrl: "https://slack.com",
      primaryDomain: "slack.com",
      domains: ["slack.com", "app.slack.com"],
      aliases: []
    },
    {
      id: "discord",
      displayName: "Discord",
      category: "social",
      primaryUrl: "https://discord.com",
      primaryDomain: "discord.com",
      domains: ["discord.com", "discord.gg"],
      aliases: []
    },
    {
      id: "zoom",
      displayName: "Zoom",
      category: "productivity",
      primaryUrl: "https://zoom.us",
      primaryDomain: "zoom.us",
      domains: ["zoom.us", "us04web.zoom.us", "us02web.zoom.us"],
      aliases: ["zoom video"]
    },
    {
      id: "dropbox",
      displayName: "Dropbox",
      category: "productivity",
      primaryUrl: "https://dropbox.com",
      primaryDomain: "dropbox.com",
      domains: ["dropbox.com", "paper.dropbox.com"],
      aliases: []
    },
    {
      id: "box",
      displayName: "Box",
      category: "productivity",
      primaryUrl: "https://box.com",
      primaryDomain: "box.com",
      domains: ["box.com", "app.box.com"],
      aliases: []
    },
    {
      id: "miro",
      displayName: "Miro",
      category: "productivity",
      primaryUrl: "https://miro.com",
      primaryDomain: "miro.com",
      domains: ["miro.com", "realtimeboard.com"],
      aliases: []
    },
    {
      id: "airtable",
      displayName: "Airtable",
      category: "productivity",
      primaryUrl: "https://airtable.com",
      primaryDomain: "airtable.com",
      domains: ["airtable.com"],
      aliases: []
    },
    {
      id: "asana",
      displayName: "Asana",
      category: "productivity",
      primaryUrl: "https://app.asana.com",
      primaryDomain: "app.asana.com",
      domains: ["app.asana.com", "asana.com"],
      aliases: []
    },
    {
      id: "monday",
      displayName: "Monday.com",
      category: "productivity",
      primaryUrl: "https://monday.com",
      primaryDomain: "monday.com",
      domains: ["monday.com"],
      aliases: ["monday"]
    },
    {
      id: "clickup",
      displayName: "ClickUp",
      category: "productivity",
      primaryUrl: "https://app.clickup.com",
      primaryDomain: "app.clickup.com",
      domains: ["app.clickup.com", "clickup.com"],
      aliases: []
    },
    {
      id: "loom",
      displayName: "Loom",
      category: "productivity",
      primaryUrl: "https://loom.com",
      primaryDomain: "loom.com",
      domains: ["loom.com"],
      aliases: []
    },
    {
      id: "evernote",
      displayName: "Evernote",
      category: "productivity",
      primaryUrl: "https://evernote.com",
      primaryDomain: "evernote.com",
      domains: ["evernote.com"],
      aliases: []
    },
    {
      id: "adobe",
      displayName: "Adobe Creative Cloud",
      category: "productivity",
      primaryUrl: "https://account.adobe.com",
      primaryDomain: "account.adobe.com",
      domains: ["account.adobe.com", "adobe.com", "creativecloud.adobe.com", "behance.net"],
      aliases: ["adobe", "photoshop", "illustrator", "creative cloud", "behance"]
    },
    {
      id: "salesforce",
      displayName: "Salesforce",
      category: "productivity",
      primaryUrl: "https://login.salesforce.com",
      primaryDomain: "login.salesforce.com",
      domains: ["login.salesforce.com", "salesforce.com", "force.com"],
      aliases: []
    },
    // ── Social, Community & Content ──
    {
      id: "linkedin",
      displayName: "LinkedIn",
      category: "social",
      primaryUrl: "https://linkedin.com",
      primaryDomain: "linkedin.com",
      domains: ["linkedin.com", "learning.linkedin.com", "recruiter.linkedin.com"],
      aliases: []
    },
    {
      id: "reddit",
      displayName: "Reddit",
      category: "social",
      primaryUrl: "https://reddit.com",
      primaryDomain: "reddit.com",
      domains: ["reddit.com", "old.reddit.com"],
      aliases: []
    },
    {
      id: "pinterest",
      displayName: "Pinterest",
      category: "social",
      primaryUrl: "https://pinterest.com",
      primaryDomain: "pinterest.com",
      domains: ["pinterest.com"],
      aliases: []
    },
    {
      id: "tiktok",
      displayName: "TikTok",
      category: "social",
      primaryUrl: "https://tiktok.com",
      primaryDomain: "tiktok.com",
      domains: ["tiktok.com"],
      aliases: []
    },
    {
      id: "telegram",
      displayName: "Telegram",
      category: "social",
      primaryUrl: "https://web.telegram.org",
      primaryDomain: "web.telegram.org",
      domains: ["web.telegram.org", "telegram.org", "t.me"],
      aliases: ["tg"]
    },
    {
      id: "signal",
      displayName: "Signal",
      category: "social",
      primaryUrl: "https://signal.org",
      primaryDomain: "signal.org",
      domains: ["signal.org"],
      aliases: []
    },
    {
      id: "medium",
      displayName: "Medium",
      category: "social",
      primaryUrl: "https://medium.com",
      primaryDomain: "medium.com",
      domains: ["medium.com"],
      aliases: []
    },
    {
      id: "substack",
      displayName: "Substack",
      category: "social",
      primaryUrl: "https://substack.com",
      primaryDomain: "substack.com",
      domains: ["substack.com"],
      aliases: []
    },
    {
      id: "wordpress",
      displayName: "WordPress",
      category: "productivity",
      primaryUrl: "https://wordpress.com",
      primaryDomain: "wordpress.com",
      domains: ["wordpress.com", "wordpress.org"],
      aliases: ["wp"]
    },
    // ── Streaming & Entertainment ──
    {
      id: "netflix",
      displayName: "Netflix",
      category: "entertainment",
      primaryUrl: "https://netflix.com",
      primaryDomain: "netflix.com",
      domains: ["netflix.com"],
      aliases: []
    },
    {
      id: "spotify",
      displayName: "Spotify",
      category: "entertainment",
      primaryUrl: "https://accounts.spotify.com",
      primaryDomain: "accounts.spotify.com",
      domains: ["accounts.spotify.com", "open.spotify.com", "spotify.com"],
      aliases: []
    },
    {
      id: "hotstar",
      displayName: "Disney+ Hotstar",
      category: "entertainment",
      primaryUrl: "https://hotstar.com",
      primaryDomain: "hotstar.com",
      domains: ["hotstar.com", "disneyplus.com"],
      aliases: ["disney", "disney+", "disneyplus", "hotstar"]
    },
    {
      id: "hulu",
      displayName: "Hulu",
      category: "entertainment",
      primaryUrl: "https://hulu.com",
      primaryDomain: "hulu.com",
      domains: ["hulu.com"],
      aliases: []
    },
    {
      id: "max",
      displayName: "Max (HBO)",
      category: "entertainment",
      primaryUrl: "https://max.com",
      primaryDomain: "max.com",
      domains: ["max.com", "hbomax.com"],
      aliases: ["hbo", "hbomax"]
    },
    {
      id: "twitch",
      displayName: "Twitch",
      category: "entertainment",
      primaryUrl: "https://twitch.tv",
      primaryDomain: "twitch.tv",
      domains: ["twitch.tv"],
      aliases: []
    },
    {
      id: "bandlab",
      displayName: "BandLab",
      category: "entertainment",
      primaryUrl: "https://bandlab.com",
      primaryDomain: "bandlab.com",
      domains: ["bandlab.com"],
      aliases: []
    },
    // ── Gaming ──
    {
      id: "steam",
      displayName: "Steam",
      category: "entertainment",
      primaryUrl: "https://steampowered.com",
      primaryDomain: "steampowered.com",
      domains: ["steampowered.com", "steamcommunity.com"],
      aliases: ["valve", "steamcommunity"]
    },
    {
      id: "epicgames",
      displayName: "Epic Games",
      category: "entertainment",
      primaryUrl: "https://store.epicgames.com",
      primaryDomain: "store.epicgames.com",
      domains: ["store.epicgames.com", "epicgames.com", "unrealengine.com"],
      aliases: ["epic", "fortnite", "unreal"]
    },
    {
      id: "playstation",
      displayName: "PlayStation (Sony)",
      category: "entertainment",
      primaryUrl: "https://my.playstation.com",
      primaryDomain: "my.playstation.com",
      domains: ["my.playstation.com", "playstation.com", "sony.com"],
      aliases: ["psn", "sony"]
    },
    {
      id: "xbox",
      displayName: "Xbox",
      category: "entertainment",
      primaryUrl: "https://xbox.com",
      primaryDomain: "xbox.com",
      domains: ["xbox.com"],
      aliases: []
    },
    {
      id: "nintendo",
      displayName: "Nintendo",
      category: "entertainment",
      primaryUrl: "https://accounts.nintendo.com",
      primaryDomain: "accounts.nintendo.com",
      domains: ["accounts.nintendo.com", "nintendo.com"],
      aliases: []
    },
    {
      id: "roblox",
      displayName: "Roblox",
      category: "entertainment",
      primaryUrl: "https://roblox.com",
      primaryDomain: "roblox.com",
      domains: ["roblox.com"],
      aliases: []
    },
    // ── Finance, Payments & Crypto ──
    {
      id: "stripe",
      displayName: "Stripe",
      category: "finance",
      primaryUrl: "https://dashboard.stripe.com",
      primaryDomain: "dashboard.stripe.com",
      domains: ["dashboard.stripe.com", "stripe.com"],
      aliases: []
    },
    {
      id: "paypal",
      displayName: "PayPal",
      category: "finance",
      primaryUrl: "https://paypal.com",
      primaryDomain: "paypal.com",
      domains: ["paypal.com", "paypal.me"],
      aliases: []
    },
    {
      id: "coinbase",
      displayName: "Coinbase",
      category: "finance",
      primaryUrl: "https://coinbase.com",
      primaryDomain: "coinbase.com",
      domains: ["coinbase.com", "pro.coinbase.com"],
      aliases: []
    },
    {
      id: "binance",
      displayName: "Binance",
      category: "finance",
      primaryUrl: "https://binance.com",
      primaryDomain: "binance.com",
      domains: ["binance.com", "binance.us"],
      aliases: []
    },
    {
      id: "kraken",
      displayName: "Kraken",
      category: "finance",
      primaryUrl: "https://kraken.com",
      primaryDomain: "kraken.com",
      domains: ["kraken.com"],
      aliases: []
    },
    {
      id: "robinhood",
      displayName: "Robinhood",
      category: "finance",
      primaryUrl: "https://robinhood.com",
      primaryDomain: "robinhood.com",
      domains: ["robinhood.com"],
      aliases: []
    },
    {
      id: "wise",
      displayName: "Wise",
      category: "finance",
      primaryUrl: "https://wise.com",
      primaryDomain: "wise.com",
      domains: ["wise.com", "transferwise.com"],
      aliases: ["transferwise"]
    },
    {
      id: "revolut",
      displayName: "Revolut",
      category: "finance",
      primaryUrl: "https://revolut.com",
      primaryDomain: "revolut.com",
      domains: ["revolut.com", "app.revolut.com"],
      aliases: []
    },
    {
      id: "chase",
      displayName: "Chase Bank",
      category: "finance",
      primaryUrl: "https://chase.com",
      primaryDomain: "chase.com",
      domains: ["chase.com"],
      aliases: ["chase"]
    },
    {
      id: "bankofamerica",
      displayName: "Bank of America",
      category: "finance",
      primaryUrl: "https://bankofamerica.com",
      primaryDomain: "bankofamerica.com",
      domains: ["bankofamerica.com", "bofa.com"],
      aliases: ["bofa"]
    },
    {
      id: "wellsfargo",
      displayName: "Wells Fargo",
      category: "finance",
      primaryUrl: "https://wellsfargo.com",
      primaryDomain: "wellsfargo.com",
      domains: ["wellsfargo.com"],
      aliases: []
    },
    {
      id: "citi",
      displayName: "Citibank",
      category: "finance",
      primaryUrl: "https://citi.com",
      primaryDomain: "citi.com",
      domains: ["citi.com", "citibank.com"],
      aliases: ["citi"]
    },
    {
      id: "capitalone",
      displayName: "Capital One",
      category: "finance",
      primaryUrl: "https://capitalone.com",
      primaryDomain: "capitalone.com",
      domains: ["capitalone.com"],
      aliases: []
    },
    {
      id: "amex",
      displayName: "American Express",
      category: "finance",
      primaryUrl: "https://americanexpress.com",
      primaryDomain: "americanexpress.com",
      domains: ["americanexpress.com", "amex.com"],
      aliases: ["amex"]
    },
    // ── Commerce & Marketplaces ──
    {
      id: "shopify",
      displayName: "Shopify",
      category: "finance",
      primaryUrl: "https://admin.shopify.com",
      primaryDomain: "admin.shopify.com",
      domains: ["admin.shopify.com", "shopify.com", "myshopify.com"],
      aliases: []
    },
    {
      id: "ebay",
      displayName: "eBay",
      category: "finance",
      primaryUrl: "https://ebay.com",
      primaryDomain: "ebay.com",
      domains: ["ebay.com"],
      aliases: []
    },
    {
      id: "etsy",
      displayName: "Etsy",
      category: "finance",
      primaryUrl: "https://etsy.com",
      primaryDomain: "etsy.com",
      domains: ["etsy.com"],
      aliases: []
    },
    {
      id: "uber",
      displayName: "Uber",
      category: "tools",
      primaryUrl: "https://uber.com",
      primaryDomain: "uber.com",
      domains: ["uber.com", "m.uber.com", "ubereats.com"],
      aliases: ["uber eats"]
    },
    {
      id: "airbnb",
      displayName: "Airbnb",
      category: "tools",
      primaryUrl: "https://airbnb.com",
      primaryDomain: "airbnb.com",
      domains: ["airbnb.com"],
      aliases: []
    },
    {
      id: "booking",
      displayName: "Booking.com",
      category: "tools",
      primaryUrl: "https://booking.com",
      primaryDomain: "booking.com",
      domains: ["booking.com"],
      aliases: ["booking"]
    },
    // ── Browsers & Web Tools ──
    {
      id: "opera",
      displayName: "Opera",
      category: "tools",
      primaryUrl: "https://auth.opera.com",
      primaryDomain: "auth.opera.com",
      domains: ["auth.opera.com", "opera.com"],
      aliases: []
    },
    {
      id: "brave",
      displayName: "Brave",
      category: "tools",
      primaryUrl: "https://brave.com",
      primaryDomain: "brave.com",
      domains: ["brave.com", "search.brave.com"],
      aliases: []
    },
    {
      id: "firefox",
      displayName: "Firefox (Mozilla)",
      category: "tools",
      primaryUrl: "https://accounts.firefox.com",
      primaryDomain: "accounts.firefox.com",
      domains: ["accounts.firefox.com", "mozilla.org", "firefox.com"],
      aliases: ["mozilla"]
    },
    {
      id: "duckduckgo",
      displayName: "DuckDuckGo",
      category: "tools",
      primaryUrl: "https://duckduckgo.com",
      primaryDomain: "duckduckgo.com",
      domains: ["duckduckgo.com"],
      aliases: ["ddg"]
    }
  ];
  function normalizeServiceName(query) {
    return query.toLowerCase().replace(/\s*\([^)]*\)|\s*\[[^\]]*\]/g, "").replace(/[^\w\s.-]/g, "").replace(/\b(login|signin|sign in|account|portal|dashboard|auth|app|inc|llc|official)\b/g, "").trim().replace(/\s+/g, " ");
  }
  function extractCleanDomain(input) {
    let cleaned = input.toLowerCase().trim();
    cleaned = cleaned.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const prefixes = [
      "www.",
      "app.",
      "mail.",
      "accounts.",
      "account.",
      "login.",
      "signin.",
      "auth.",
      "m.",
      "dashboard.",
      "portal.",
      "api.",
      "sso.",
      "my.",
      "web.",
      "id.",
      "secure.",
      "identity.",
      "admin."
    ];
    for (const p of prefixes) {
      if (cleaned.startsWith(p)) {
        cleaned = cleaned.slice(p.length);
        break;
      }
    }
    return cleaned;
  }
  function resolveServiceDomains(rawTitle) {
    if (!rawTitle) return null;
    const normalized = normalizeServiceName(rawTitle);
    if (!normalized || normalized.length < 2) return null;
    if (rawTitle.includes(".") || rawTitle.startsWith("http://") || rawTitle.startsWith("https://")) {
      const fromUrl = resolveServiceFromUrl(rawTitle);
      if (fromUrl) {
        const match = KNOWN_SERVICES.find((s) => s.id === fromUrl.serviceId);
        if (match) {
          return {
            serviceId: match.id,
            displayName: match.displayName,
            primaryUrl: match.primaryUrl,
            primaryDomain: match.primaryDomain,
            domains: match.domains,
            urls: match.domains.map((d) => `https://${d}`),
            matchType: "url_domain"
          };
        }
      }
      const cleanHost = rawTitle.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (cleanHost.includes(".")) {
        return {
          serviceId: cleanHost.split(".")[0],
          displayName: cleanHost.split(".")[0].charAt(0).toUpperCase() + cleanHost.split(".")[0].slice(1),
          primaryUrl: `https://${cleanHost}`,
          primaryDomain: cleanHost,
          domains: [cleanHost],
          urls: [`https://${cleanHost}`],
          matchType: "url_domain"
        };
      }
    }
    for (const s of KNOWN_SERVICES) {
      if (s.id === normalized || s.displayName.toLowerCase() === normalized) {
        return buildInfo(s, "exact");
      }
      if (s.aliases && s.aliases.some((a) => a.toLowerCase() === normalized)) {
        return buildInfo(s, "alias");
      }
    }
    for (const s of KNOWN_SERVICES) {
      const sId = s.id.toLowerCase();
      const sName = s.displayName.toLowerCase();
      if (normalized.startsWith(sId + " ") || normalized.endsWith(" " + sId) || normalized.startsWith(sName + " ") || normalized.endsWith(" " + sName)) {
        return buildInfo(s, "prefix");
      }
      if (s.aliases) {
        for (const a of s.aliases) {
          const al = a.toLowerCase();
          if (normalized.startsWith(al + " ") || normalized.endsWith(" " + al)) {
            return buildInfo(s, "alias");
          }
        }
      }
    }
    if (normalized.length >= 3) {
      const prefixMatch = KNOWN_SERVICES.find((s) => {
        if (s.id.startsWith(normalized)) return true;
        if (s.displayName.toLowerCase().startsWith(normalized)) return true;
        if (s.aliases && s.aliases.some((a) => a.toLowerCase().startsWith(normalized))) return true;
        return false;
      });
      if (prefixMatch) {
        return buildInfo(prefixMatch, "prefix");
      }
    }
    if (!normalized.includes(" ") && normalized.length >= 3 && /^[a-z0-9-]+$/.test(normalized)) {
      const domain = `${normalized}.com`;
      return {
        serviceId: normalized,
        displayName: normalized.charAt(0).toUpperCase() + normalized.slice(1),
        primaryUrl: `https://${domain}`,
        primaryDomain: domain,
        domains: [domain],
        urls: [`https://${domain}`],
        matchType: "heuristic"
      };
    }
    return null;
  }
  function buildInfo(service, matchType) {
    return {
      serviceId: service.id,
      displayName: service.displayName,
      primaryUrl: service.primaryUrl,
      primaryDomain: service.primaryDomain,
      domains: service.domains,
      urls: service.domains.map((d) => `https://${d}`),
      matchType
    };
  }
  function resolveServiceFromUrl(urlOrHost) {
    if (!urlOrHost) return null;
    const raw = urlOrHost.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const clean = extractCleanDomain(raw);
    for (const s of KNOWN_SERVICES) {
      if (s.domains.some((d) => d === raw)) {
        return {
          displayName: s.displayName,
          serviceId: s.id,
          domains: s.domains
        };
      }
    }
    for (const s of KNOWN_SERVICES) {
      if (s.domains.some((d) => raw.endsWith("." + d))) {
        return {
          displayName: s.displayName,
          serviceId: s.id,
          domains: s.domains
        };
      }
    }
    for (const s of KNOWN_SERVICES) {
      if (s.domains.some((d) => d === clean || clean.endsWith("." + d))) {
        return {
          displayName: s.displayName,
          serviceId: s.id,
          domains: s.domains
        };
      }
    }
    const namePart = clean.split(".")[0];
    if (namePart && namePart.length >= 2) {
      return {
        displayName: namePart.charAt(0).toUpperCase() + namePart.slice(1),
        serviceId: namePart,
        domains: [clean]
      };
    }
    return null;
  }
  function getAllKnownServiceNames() {
    return KNOWN_SERVICES.map((s) => s.displayName).sort((a, b) => a.localeCompare(b));
  }

  // src/favicon-service.ts
  var PARENT_BRAND_MAP = {
    // ── Microsoft ecosystem ──
    "live.com": "microsoft.com",
    "account.live.com": "microsoft.com",
    "microsoftonline.com": "microsoft.com",
    "outlook.com": "microsoft.com",
    "outlook.live.com": "microsoft.com",
    "hotmail.com": "microsoft.com",
    "office.com": "microsoft.com",
    "office365.com": "microsoft.com",
    "onedrive.com": "microsoft.com",
    "onedrive.live.com": "microsoft.com",
    "sharepoint.com": "microsoft.com",
    "teams.microsoft.com": "microsoft.com",
    "azure.com": "microsoft.com",
    "portal.azure.com": "microsoft.com",
    "dev.azure.com": "microsoft.com",
    "visualstudio.com": "microsoft.com",
    "msn.com": "microsoft.com",
    "bing.com": "microsoft.com",
    "xbox.com": "xbox.com",
    "skype.com": "skype.com",
    // ── Google ecosystem ──
    "gmail.com": "google.com",
    "googlemail.com": "google.com",
    "google.co.in": "google.com",
    "google.co.uk": "google.com",
    "google.co.jp": "google.com",
    "accounts.google.com": "google.com",
    "myaccount.google.com": "google.com",
    "drive.google.com": "google.com",
    "docs.google.com": "google.com",
    "sheets.google.com": "google.com",
    "slides.google.com": "google.com",
    "meet.google.com": "google.com",
    "chat.google.com": "google.com",
    "calendar.google.com": "google.com",
    "photos.google.com": "google.com",
    "maps.google.com": "google.com",
    "translate.google.com": "google.com",
    "cloud.google.com": "google.com",
    "console.cloud.google.com": "google.com",
    "play.google.com": "google.com",
    "firebase.google.com": "google.com",
    "analytics.google.com": "google.com",
    "ads.google.com": "google.com",
    "gemini.google.com": "google.com",
    "colab.research.google.com": "google.com",
    "youtube.com": "youtube.com",
    // ── Apple ecosystem ──
    "icloud.com": "apple.com",
    "appleid.apple.com": "apple.com",
    "developer.apple.com": "apple.com",
    "music.apple.com": "apple.com",
    "tv.apple.com": "apple.com",
    "support.apple.com": "apple.com",
    // ── Meta ecosystem ──
    "facebook.com": "facebook.com",
    "fb.com": "facebook.com",
    "messenger.com": "facebook.com",
    "instagram.com": "instagram.com",
    "threads.net": "instagram.com",
    "whatsapp.com": "whatsapp.com",
    "oculus.com": "meta.com",
    // ── Amazon ecosystem ──
    "aws.amazon.com": "amazon.com",
    "console.aws.amazon.com": "amazon.com",
    "primevideo.com": "amazon.com",
    "kindle.com": "amazon.com",
    "audible.com": "audible.com",
    "twitch.tv": "twitch.tv",
    // ── GitHub / Microsoft Dev ──
    "gist.github.com": "github.com",
    "copilot.github.com": "github.com",
    "github.dev": "github.com",
    "npmjs.com": "npmjs.com",
    // ── Spotify ──
    "accounts.spotify.com": "spotify.com",
    "open.spotify.com": "spotify.com",
    "play.spotify.com": "spotify.com",
    // ── LinkedIn ──
    "learning.linkedin.com": "linkedin.com",
    "recruiter.linkedin.com": "linkedin.com",
    // ── Zoom ──
    "us04web.zoom.us": "zoom.us",
    "us02web.zoom.us": "zoom.us",
    "zoomgov.com": "zoom.us",
    // ── Atlassian ecosystem ──
    "bitbucket.org": "bitbucket.org",
    "trello.com": "trello.com",
    "jira.atlassian.com": "atlassian.com",
    "confluence.atlassian.com": "atlassian.com",
    "id.atlassian.com": "atlassian.com",
    // ── Salesforce ecosystem ──
    "salesforce.com": "salesforce.com",
    "force.com": "salesforce.com",
    "heroku.com": "heroku.com",
    // ── Adobe ecosystem ──
    "creativecloud.adobe.com": "adobe.com",
    "behance.net": "behance.net",
    // ── Proton ecosystem ──
    "protonmail.com": "proton.me",
    "protonvpn.com": "proton.me",
    "proton.me": "proton.me"
  };
  var BRAND_DICTIONARY = {
    github: "github.com",
    copilot: "github.com",
    cursor: "cursor.com",
    gemini: "gemini.google.com",
    "google gemini": "gemini.google.com",
    deepmind: "deepmind.google",
    proton: "proton.me",
    protonmail: "proton.me",
    "proton mail": "proton.me",
    google: "google.com",
    gmail: "google.com",
    "google workspace": "google.com",
    youtube: "youtube.com",
    hotstar: "hotstar.com",
    disney: "hotstar.com",
    "disney+": "hotstar.com",
    disneyplus: "hotstar.com",
    apple: "apple.com",
    icloud: "apple.com",
    "apple card": "apple.com",
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
    opera: "opera.com",
    brave: "brave.com",
    firefox: "firefox.com",
    huggingface: "huggingface.co",
    replicate: "replicate.com",
    midjourney: "midjourney.com",
    perplexity: "perplexity.ai",
    twitter: "x.com",
    x: "x.com",
    reddit: "reddit.com",
    linkedin: "linkedin.com",
    facebook: "facebook.com",
    meta: "meta.com",
    instagram: "instagram.com",
    gitlab: "gitlab.com",
    bitbucket: "bitbucket.org",
    atlassian: "atlassian.com",
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
    bandlab: "bandlab.com",
    microsoft: "microsoft.com",
    office: "microsoft.com"
  };
  var BRAND_GRADIENT_PALETTE = [
    ["#4238C9", "#7D3BEC"],
    // Indigo -> Violet
    ["#059669", "#10B981"],
    // Emerald -> Teal
    ["#0384C7", "#38BDF8"],
    // Ocean -> Sky
    ["#BF123D", "#F43F5E"],
    // Crimson -> Rose
    ["#D97706", "#F59E0B"],
    // Amber -> Tangerine
    ["#6E29D9", "#C026D3"],
    // Violet -> Fuchsia
    ["#0D9488", "#06B6D4"],
    // Teal -> Cyan
    ["#1D4ED8", "#6366F1"],
    // Royal -> Indigo
    ["#EA580C", "#FB923C"],
    // Orange -> Coral
    ["#DB2777", "#FB7185"],
    // Pink -> Rose
    ["#15803D", "#34D399"],
    // Forest -> Emerald
    ["#334155", "#64748B"]
    // Slate -> Zinc
  ];
  function cleanDomainHost(host) {
    let domain = host.toLowerCase().trim();
    const commonPrefixes = [
      "www.",
      "app.",
      "mail.",
      "accounts.",
      "account.",
      "login.",
      "signin.",
      "auth.",
      "m.",
      "dashboard.",
      "portal.",
      "api.",
      "sso.",
      "my.",
      "web.",
      "id.",
      "secure.",
      "identity.",
      "member.",
      "user.",
      "users.",
      "ide."
    ];
    for (const prefix of commonPrefixes) {
      if (domain.startsWith(prefix)) {
        domain = domain.slice(prefix.length);
        break;
      }
    }
    return domain;
  }
  function sanitizeTitle(title) {
    return title.replace(/\s*\([^)]*\)|\s*\[[^\]]*\]/g, "").trim();
  }
  function inferDomainFromTitle(title) {
    const clean = sanitizeTitle(title).toLowerCase();
    if (!clean) return null;
    const service = resolveServiceDomains(clean);
    if (service) return service.primaryDomain;
    if (BRAND_DICTIONARY[clean]) return BRAND_DICTIONARY[clean];
    for (const [brand, domain] of Object.entries(BRAND_DICTIONARY)) {
      if (clean === brand || clean.startsWith(brand + " ") || clean.endsWith(" " + brand)) {
        return domain;
      }
    }
    return null;
  }
  function resolveItemDomains(opts) {
    const domains = [];
    const add = (d) => {
      const trimmed = d.toLowerCase().trim();
      if (!trimmed || domains.includes(trimmed)) return;
      domains.push(trimmed);
    };
    const addWithBrandResolution = (rawDomain) => {
      const raw = rawDomain.toLowerCase().trim();
      const clean = cleanDomainHost(raw);
      if (PARENT_BRAND_MAP[raw]) add(PARENT_BRAND_MAP[raw]);
      if (PARENT_BRAND_MAP[clean]) add(PARENT_BRAND_MAP[clean]);
      add(clean);
      if (clean !== raw) add(raw);
    };
    if (opts.domain) {
      addWithBrandResolution(opts.domain);
    }
    if (opts.oauthProvider) {
      const p = opts.oauthProvider.toLowerCase().trim();
      if (p === "google") add("google.com");
      else if (p === "apple") add("apple.com");
      else if (p === "github") add("github.com");
      else if (p === "microsoft") add("microsoft.com");
      else if (p === "slack") add("slack.com");
      else if (p === "discord") add("discord.com");
      else if (p === "facebook") add("facebook.com");
      else if (p === "twitter" || p === "x") add("x.com");
    }
    if (opts.urls && opts.urls.length > 0) {
      for (const u of opts.urls) {
        if (!u || !u.trim()) continue;
        try {
          const parsed = new URL(u.includes("://") ? u : `https://${u}`);
          if (parsed.hostname) {
            addWithBrandResolution(parsed.hostname);
          }
        } catch {
          const parts = u.split("/")[0].split("?")[0];
          if (parts.includes(".")) addWithBrandResolution(parts);
        }
      }
    }
    const title = sanitizeTitle(opts.title || "");
    if (title.includes(".") && !title.includes(" ")) {
      addWithBrandResolution(title);
    }
    const inferred = inferDomainFromTitle(title);
    if (inferred) add(inferred);
    return domains;
  }
  function buildFaviconCandidates(domain) {
    return [
      // Tier 1: Google High-DPI Favicon V2 (128px)
      `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`,
      // Tier 2: Google S2 High-DPI (128px)
      `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
      // Tier 3: DuckDuckGo Icon
      `https://icons.duckduckgo.com/ip3/${domain}.ico`,
      // Tier 4: Clearbit Logo (128px)
      `https://logo.clearbit.com/${domain}?size=128`,
      // Tier 5: Direct Apple Touch Icon
      `https://${domain}/apple-touch-icon.png`
    ];
  }
  function classifyRenderingStyle(img) {
    try {
      const dim = 64;
      const canvas = document.createElement("canvas");
      canvas.width = dim;
      canvas.height = dim;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return { type: "standard" };
      ctx.clearRect(0, 0, dim, dim);
      ctx.drawImage(img, 0, 0, dim, dim);
      const imgData = ctx.getImageData(0, 0, dim, dim);
      const pixels = imgData.data;
      const cSz = 10;
      const aFade = 40;
      const whiteLow = 210;
      const px = (x, y) => {
        const i = (y * dim + x) * 4;
        return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
      };
      const cornerOrigins = [
        [0, 0],
        [dim - cSz, 0],
        [0, dim - cSz],
        [dim - cSz, dim - cSz]
      ];
      let nTransparent = 0;
      let nWhite = 0;
      let nTotal = 0;
      const coloredR = [];
      const coloredG = [];
      const coloredB = [];
      for (const [cx, cy] of cornerOrigins) {
        for (let dy = 0; dy < cSz; dy++) {
          for (let dx = 0; dx < cSz; dx++) {
            const [r, g, b, a] = px(cx + dx, cy + dy);
            nTotal++;
            if (a < aFade) {
              nTransparent++;
            } else if (r > whiteLow && g > whiteLow && b > whiteLow) {
              nWhite++;
            } else {
              coloredR.push(r / 255);
              coloredG.push(g / 255);
              coloredB.push(b / 255);
            }
          }
        }
      }
      if (nTotal === 0) return { type: "standard" };
      const transpRatio = nTransparent / nTotal;
      const whiteRatio = nWhite / nTotal;
      const coloredRatio = coloredR.length / nTotal;
      if (whiteRatio >= 0.5) {
        return { type: "standard" };
      }
      if (coloredRatio >= 0.4 && coloredR.length > 0) {
        const n = coloredR.length;
        const avgR = coloredR.reduce((a, b) => a + b, 0) / n;
        const avgG = coloredG.reduce((a, b) => a + b, 0) / n;
        const avgB = coloredB.reduce((a, b) => a + b, 0) / n;
        const varR = coloredR.map((v) => (v - avgR) ** 2).reduce((a, b) => a + b, 0) / n;
        const varG = coloredG.map((v) => (v - avgG) ** 2).reduce((a, b) => a + b, 0) / n;
        const varB = coloredB.map((v) => (v - avgB) ** 2).reduce((a, b) => a + b, 0) / n;
        const totalVariance = varR + varG + varB;
        if (totalVariance < 0.05) {
          return { type: "coloredSquircle", r: avgR, g: avgG, b: avgB };
        } else {
          return { type: "fullBleed" };
        }
      }
      if (transpRatio >= 0.5) {
        const insets = [
          [Math.floor(dim / 2), 6],
          [Math.floor(dim / 2), dim - 7],
          [6, Math.floor(dim / 2)],
          [dim - 7, Math.floor(dim / 2)]
        ];
        let midOpaque = 0;
        const midR = [];
        const midG = [];
        const midB = [];
        for (const [x, y] of insets) {
          const [r, g, b, a] = px(x, y);
          if (a > aFade) {
            midOpaque++;
            if (!(r > whiteLow && g > whiteLow && b > whiteLow)) {
              midR.push(r / 255);
              midG.push(g / 255);
              midB.push(b / 255);
            }
          }
        }
        let totalOpaque = 0;
        let innerTransp = 0;
        let innerTotal = 0;
        for (let y = 0; y < dim; y++) {
          for (let x = 0; x < dim; x++) {
            const [, , , a] = px(x, y);
            if (a > aFade) totalOpaque++;
            if (x >= 16 && x < 48 && y >= 16 && y < 48) {
              innerTotal++;
              if (a < aFade) innerTransp++;
            }
          }
        }
        const opRatio = totalOpaque / (dim * dim);
        const innerTranspRatio = innerTransp / Math.max(1, innerTotal);
        if (midOpaque === 4 && midR.length === 4 && opRatio >= 0.68) {
          const avgR = midR.reduce((a, b) => a + b, 0) / 4;
          const avgG = midG.reduce((a, b) => a + b, 0) / 4;
          const avgB = midB.reduce((a, b) => a + b, 0) / 4;
          const varR = midR.map((v) => (v - avgR) ** 2).reduce((a, b) => a + b, 0) / 4;
          const varG = midG.map((v) => (v - avgG) ** 2).reduce((a, b) => a + b, 0) / 4;
          const varB = midB.map((v) => (v - avgB) ** 2).reduce((a, b) => a + b, 0) / 4;
          if (varR + varG + varB < 0.05) {
            if (innerTranspRatio > 0.05) {
              const luminance = 0.2126 * avgR + 0.7152 * avgG + 0.0722 * avgB;
              if (luminance > 0.35) {
                return { type: "coloredSquircle", r: 0.07, g: 0.07, b: 0.07, isCutout: true };
              } else {
                return { type: "standard" };
              }
            }
            return { type: "coloredSquircle", r: avgR, g: avgG, b: avgB };
          }
        }
        return { type: "standard" };
      }
      return { type: "standard" };
    } catch {
      return { type: "standard" };
    }
  }
  function getMonogram(title, domain) {
    const cleanTitle = sanitizeTitle(title || "");
    if (cleanTitle) {
      if (cleanTitle.includes(".") && !cleanTitle.includes(" ")) {
        const parts = cleanTitle.split(".");
        if (parts[0] && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
      }
      const words = cleanTitle.split(/\s+/).filter(Boolean);
      if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
      }
      if (cleanTitle.length >= 2) {
        return cleanTitle.slice(0, 2).toUpperCase();
      }
      return cleanTitle.toUpperCase();
    }
    if (domain) {
      const clean = cleanDomainHost(domain);
      const parts = clean.split(".");
      if (parts[0] && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    }
    return "K";
  }
  function getBrandGradient(key) {
    let hash = 0;
    const str = key.toLowerCase();
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const index = Math.abs(hash) % BRAND_GRADIENT_PALETTE.length;
    return BRAND_GRADIENT_PALETTE[index];
  }
  var memoryCache = /* @__PURE__ */ new Map();
  var inFlightFetches = /* @__PURE__ */ new Map();
  async function loadAndClassifyUrl(url) {
    try {
      let finalSrc = url;
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        try {
          const bgRes = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: "FETCH_IMAGE_DATA_URL", url }, (res) => {
              if (chrome.runtime.lastError || !res?.success) resolve(null);
              else resolve(res);
            });
          });
          if (bgRes?.dataUrl) {
            finalSrc = bgRes.dataUrl;
          }
        } catch {
        }
      }
      if (finalSrc === url && typeof fetch !== "undefined") {
        try {
          const resp = await fetch(url, { mode: "cors" });
          if (resp.ok) {
            const blob = await resp.blob();
            if (url.includes("duckduckgo.com") && blob.size === 1478) return null;
            if ((url.includes("gstatic") || url.includes("google")) && (blob.size === 426 || blob.size === 726)) return null;
            if (blob.size >= 50) {
              finalSrc = URL.createObjectURL(blob);
            }
          }
        } catch {
          finalSrc = url;
        }
      }
      const img = new Image();
      img.crossOrigin = "anonymous";
      const loaded = await new Promise((resolve) => {
        img.onload = () => {
          if (img.naturalWidth <= 2 || img.naturalHeight <= 2) {
            resolve(false);
            return;
          }
          resolve(true);
        };
        img.onerror = () => resolve(false);
        img.src = finalSrc;
      });
      if (!loaded) {
        if (finalSrc.startsWith("blob:")) URL.revokeObjectURL(finalSrc);
        return null;
      }
      const style = classifyRenderingStyle(img);
      return {
        src: finalSrc,
        style
      };
    } catch {
      return null;
    }
  }
  async function resolveFavicon(options) {
    const domains = resolveItemDomains({
      urls: options.urls || options.item?.urls,
      title: options.title || options.item?.title,
      oauthProvider: options.oauthProvider || options.item?.oauthProvider || options.item?.oauth?.provider,
      domain: options.domain || options.item?.domain
    });
    if (domains.length === 0) return null;
    const cacheKey = domains.join("|");
    if (memoryCache.has(cacheKey)) {
      return memoryCache.get(cacheKey);
    }
    if (inFlightFetches.has(cacheKey)) {
      return inFlightFetches.get(cacheKey);
    }
    const fetchPromise = (async () => {
      for (const d of domains) {
        const candidateUrls = buildFaviconCandidates(d);
        for (const url of candidateUrls) {
          const result = await loadAndClassifyUrl(url);
          if (result) {
            memoryCache.set(cacheKey, result);
            return result;
          }
        }
      }
      return null;
    })();
    inFlightFetches.set(cacheKey, fetchPromise);
    try {
      const res = await fetchPromise;
      return res;
    } finally {
      inFlightFetches.delete(cacheKey);
    }
  }
  function getCachedFaviconSync(options) {
    const domains = resolveItemDomains({
      urls: options.urls || options.item?.urls,
      title: options.title || options.item?.title,
      oauthProvider: options.oauthProvider || options.item?.oauthProvider || options.item?.oauth?.provider,
      domain: options.domain || options.item?.domain
    });
    if (domains.length === 0) return null;
    const cacheKey = domains.join("|");
    return memoryCache.get(cacheKey) || null;
  }
  function renderFavicon(container, options) {
    const size = options.size || 32;
    const squircleRadius = Math.max(4, Math.round(size * 0.2237));
    const domains = resolveItemDomains({
      urls: options.urls || options.item?.urls,
      title: options.title || options.item?.title,
      oauthProvider: options.oauthProvider || options.item?.oauthProvider || options.item?.oauth?.provider,
      domain: options.domain || options.item?.domain
    });
    const primaryKey = domains[0] || options.title || options.item?.title || "kloak";
    const monogram = getMonogram(options.title || options.item?.title, domains[0]);
    const [grad1, grad2] = getBrandGradient(primaryKey);
    container.innerHTML = "";
    container.classList.add("kloak-favicon-squircle");
    container.style.setProperty("width", `${size}px`, "important");
    container.style.setProperty("height", `${size}px`, "important");
    container.style.setProperty("border-radius", `${squircleRadius}px`, "important");
    container.style.position = "relative";
    container.style.display = "inline-flex";
    container.style.alignItems = "center";
    container.style.justifyContent = "center";
    container.style.overflow = "hidden";
    container.style.flexShrink = "0";
    container.style.boxSizing = "border-box";
    container.style.boxShadow = "0 1px 3px rgba(0,0,0,0.22)";
    container.style.userSelect = "none";
    const fallback = document.createElement("div");
    fallback.className = "kloak-favicon-monogram";
    fallback.style.position = "absolute";
    fallback.style.inset = "0";
    fallback.style.display = "flex";
    fallback.style.alignItems = "center";
    fallback.style.justifyContent = "center";
    fallback.style.background = `linear-gradient(135deg, ${grad1}, ${grad2})`;
    fallback.style.color = "#ffffff";
    fallback.style.fontSize = `${Math.max(9, Math.round(size * 0.38))}px`;
    fallback.style.fontWeight = "700";
    fallback.style.letterSpacing = "-0.02em";
    fallback.style.borderRadius = `${squircleRadius}px`;
    fallback.textContent = monogram;
    container.appendChild(fallback);
    const applyStyle = (cached) => {
      container.innerHTML = "";
      const plate = document.createElement("div");
      plate.className = "kloak-favicon-plate";
      plate.style.position = "absolute";
      plate.style.inset = "0";
      plate.style.display = "flex";
      plate.style.alignItems = "center";
      plate.style.justifyContent = "center";
      plate.style.borderRadius = `${squircleRadius}px`;
      plate.style.overflow = "hidden";
      const img = document.createElement("img");
      img.src = cached.src;
      img.alt = options.title || primaryKey;
      img.style.display = "block";
      const s = cached.style;
      switch (s.type) {
        case "standard": {
          plate.style.background = "#ffffff";
          plate.style.border = "1px solid rgba(0, 0, 0, 0.08)";
          img.style.setProperty("width", "78%", "important");
          img.style.setProperty("height", "78%", "important");
          img.style.setProperty("object-fit", "contain", "important");
          break;
        }
        case "fullBleed": {
          plate.style.background = "transparent";
          img.style.setProperty("width", "100%", "important");
          img.style.setProperty("height", "100%", "important");
          img.style.setProperty("object-fit", "cover", "important");
          break;
        }
        case "coloredSquircle": {
          const rgb = `rgb(${Math.round(s.r * 255)}, ${Math.round(s.g * 255)}, ${Math.round(s.b * 255)})`;
          plate.style.background = rgb;
          if (s.isCutout) {
            img.style.setProperty("width", "82%", "important");
            img.style.setProperty("height", "82%", "important");
            img.style.setProperty("object-fit", "contain", "important");
          } else {
            img.style.setProperty("width", "100%", "important");
            img.style.setProperty("height", "100%", "important");
            img.style.setProperty("object-fit", "contain", "important");
          }
          break;
        }
        case "circleAdapted": {
          plate.style.borderRadius = "50%";
          plate.style.background = "#ffffff";
          img.style.setProperty("width", "100%", "important");
          img.style.setProperty("height", "100%", "important");
          img.style.setProperty("object-fit", "cover", "important");
          break;
        }
      }
      plate.appendChild(img);
      container.appendChild(plate);
    };
    const syncCached = getCachedFaviconSync(options);
    if (syncCached) {
      applyStyle(syncCached);
      return container;
    }
    resolveFavicon(options).then((res) => {
      if (res && container.isConnected) {
        applyStyle(res);
      }
    });
    return container;
  }

  // src/risk-assessment.ts
  function evaluatePasswordEntropy(password) {
    if (!password) return 0;
    let poolSize = 0;
    if (/[a-z]/.test(password)) poolSize += 26;
    if (/[A-Z]/.test(password)) poolSize += 26;
    if (/[0-9]/.test(password)) poolSize += 10;
    if (/[^a-zA-Z0-9]/.test(password)) poolSize += 33;
    if (poolSize === 0) poolSize = 1;
    return Math.round(password.length * Math.log2(poolSize));
  }
  function evaluateCredentialRisk(item, allItems2 = []) {
    const pwd = item.password || "";
    const reasons = [];
    if (!pwd) {
      return {
        score: 10,
        riskLevel: "high",
        label: "High Risk",
        color: "#EF4444",
        entropyBits: 0,
        isReused: false,
        reusedCount: 0,
        has2FA: !!item.totpSecret,
        reasons: ["No password is set for this login"]
      };
    }
    const entropy = evaluatePasswordEntropy(pwd);
    let score = Math.round(Math.min(100, Math.max(10, entropy)));
    if (pwd.length < 8) {
      score = Math.min(score, 25);
      reasons.push("Password length is under 8 characters (Critical)");
    } else if (pwd.length < 12) {
      score = Math.min(score, 60);
      reasons.push("Password length is under 12 characters");
    }
    const weakPatterns = /^(password|123456|qwerty|admin|welcome|letmein|login|test)/i;
    if (weakPatterns.test(pwd)) {
      score = Math.min(score, 20);
      reasons.push("Contains common predictable dictionary words");
    }
    let isReused = false;
    let reusedCount = 0;
    const currentDomain = (item.urls?.[0] || item.title || "").toLowerCase();
    for (const other of allItems2) {
      if (other.id === item.id) continue;
      if (other.password && other.password === pwd) {
        const otherDomain = (other.urls?.[0] || other.title || "").toLowerCase();
        if (otherDomain !== currentDomain) {
          isReused = true;
          reusedCount++;
        }
      }
    }
    if (isReused) {
      score = Math.max(15, score - 35);
      reasons.push(`Password reused on ${reusedCount + 1} different online services`);
    }
    const has2FA = !!item.totpSecret;
    if (has2FA) {
      score = Math.min(100, score + 12);
    } else {
      reasons.push("Two-factor authentication (2FA) is not enabled");
    }
    score = Math.max(10, Math.min(100, score));
    let riskLevel = "low";
    let color = "#10B981";
    let label = "Low Risk";
    if (score < 50) {
      riskLevel = "high";
      color = "#EF4444";
      label = "High Risk";
    } else if (score < 80) {
      riskLevel = "medium";
      color = "#F59E0B";
      label = "Medium Risk";
    }
    if (reasons.length === 0) {
      reasons.push("Strong unique password with high cryptographic entropy");
      if (has2FA) reasons.push("Hardware 2FA / TOTP protection enabled");
    }
    return {
      score,
      riskLevel,
      label,
      color,
      entropyBits: entropy,
      isReused,
      reusedCount,
      has2FA,
      reasons
    };
  }
  function renderCircumferenceSvg(score, color, size = 28, stroke = 2.5) {
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - circumference * score / 100;
    const center = size / 2;
    const fontSize = size >= 48 ? 13 : size >= 36 ? 10 : 8;
    const textY = size >= 48 ? center + 4.5 : size >= 36 ? center + 3.5 : center + 3;
    return `
    <svg class="kloak-circumference-gauge" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display: block; flex-shrink: 0;">
      <circle
        class="kloak-gauge-bg"
        cx="${center}"
        cy="${center}"
        r="${radius}"
        stroke="rgba(255,255,255,0.12)"
        stroke-width="${stroke}"
        fill="none"
      />
      <circle
        class="kloak-gauge-bar"
        cx="${center}"
        cy="${center}"
        r="${radius}"
        stroke="${color}"
        stroke-width="${stroke}"
        stroke-dasharray="${circumference.toFixed(2)}"
        stroke-dashoffset="${offset.toFixed(2)}"
        stroke-linecap="round"
        fill="none"
        transform="rotate(-90 ${center} ${center})"
        style="transition: stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1);"
      />
      <text
        x="${center}"
        y="${textY}"
        text-anchor="middle"
        font-size="${fontSize}px"
        font-weight="700"
        fill="${color}"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      >${score}%</text>
    </svg>
  `;
  }

  // src/popup.ts
  var allItems = [];
  var activeItem = null;
  var currentTabId;
  var isEditing = false;
  var totpInterval = null;
  var addTotpInterval = null;
  var PROTON_ICONS = {
    login: "M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z",
    alias: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.88-11.71c-.36-.45-.91-.7-1.5-.7-1.25 0-2.38 1.05-2.38 2.41 0 1.34 1.13 2.41 2.38 2.41.59 0 1.14-.25 1.5-.7v.58c0 .88-.72 1.6-1.6 1.6-.74 0-1.39-.5-1.55-1.21l-1.36.32c.28 1.25 1.41 2.09 2.91 2.09 1.65 0 2.8-1.15 2.8-2.8V9.5h-1.2v.79zm-1.5 2.82c-.66 0-1.2-.54-1.2-1.21 0-.66.54-1.2 1.2-1.2.66 0 1.2.54 1.2 1.2 0 .67-.54 1.21-1.2 1.21z",
    card: "M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z",
    note: "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z",
    identity: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 12H6v-1.4c0-2 4-3.1 6-3.1s6 1.1 6 3.1V18z",
    authenticator: "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"
  };
  var PROTON_COLORS = {
    login: "#6D4AFF",
    alias: "#00D2B4",
    card: "#FF884D",
    note: "#4D96FF",
    identity: "#E066FF",
    authenticator: "#29C98F"
  };
  var activeTabUrl = "";
  var activeDomain = "";
  var isGeneratorOpen = false;
  var genLength = 20;
  var genUseUpper = true;
  var genUseLower = true;
  var genUseDigits = true;
  var genUseSymbols = true;
  var genAvoidAmbiguous = false;
  var genMode = "password";
  var genPassphraseWords = 4;
  var currentGenPassword = "";
  var passwordHistory = [];
  var WORDLIST = [
    "amber",
    "anchor",
    "apple",
    "apron",
    "arctic",
    "arrow",
    "atlas",
    "autumn",
    "bamboo",
    "beacon",
    "breeze",
    "bridge",
    "bronze",
    "canyon",
    "castle",
    "cedar",
    "cipher",
    "cloud",
    "cobalt",
    "comet",
    "copper",
    "coral",
    "cosmos",
    "crater",
    "crystal",
    "delta",
    "desert",
    "diamond",
    "dolphin",
    "dragon",
    "echo",
    "ember",
    "falcon",
    "feather",
    "forest",
    "fossil",
    "galaxy",
    "garden",
    "glacier",
    "granite",
    "harbor",
    "haven",
    "horizon",
    "island",
    "jasper",
    "jungle",
    "lagoon",
    "lantern",
    "lotus",
    "lunar",
    "matrix",
    "meadow",
    "meteor",
    "mirage",
    "mountain",
    "nebula",
    "oasis",
    "ocean",
    "orbit",
    "orchid",
    "peak",
    "pearl",
    "phoenix",
    "planet",
    "prism",
    "pulse",
    "pyramid",
    "quantum",
    "quartz",
    "radar",
    "radiant",
    "rainbow",
    "raven",
    "ripple",
    "river",
    "rocket",
    "ruby",
    "safari",
    "sail",
    "sapphire",
    "shadow",
    "shield",
    "sierra",
    "silver",
    "solar",
    "spark",
    "sphinx",
    "spirit",
    "spring",
    "star",
    "stone",
    "summit",
    "sunset",
    "temple",
    "thunder",
    "timber",
    "topaz",
    "torrent",
    "tower",
    "tulip",
    "valley",
    "velvet",
    "vessel",
    "vertex",
    "violet",
    "vortex",
    "voyage",
    "wave",
    "whisper",
    "zenith"
  ];
  function generatePassphrase(wordCount = 4, separator = "-") {
    const chosen = [];
    for (let i = 0; i < wordCount; i++) {
      const idx = Math.floor(Math.random() * WORDLIST.length);
      chosen.push(WORDLIST[idx]);
    }
    return chosen.join(separator);
  }
  function generateSecurePassword() {
    if (genMode === "passphrase") {
      return generatePassphrase(genPassphraseWords, "-");
    }
    let chars = "";
    if (genUseLower) chars += genAvoidAmbiguous ? "abcdefghijkmnopqrstuvwxyz" : "abcdefghijklmnopqrstuvwxyz";
    if (genUseUpper) chars += genAvoidAmbiguous ? "ABCDEFGHJKLMNPQRSTUVWXYZ" : "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (genUseDigits) chars += genAvoidAmbiguous ? "23456789" : "0123456789";
    if (genUseSymbols) chars += "!@#$%^&*()_+-=[]{}|;:,.<>?";
    if (!chars) chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    const array = new Uint32Array(genLength);
    crypto.getRandomValues(array);
    let result = "";
    for (let i = 0; i < genLength; i++) {
      result += chars.charAt(array[i] % chars.length);
    }
    return result;
  }
  function calculateEntropy(pwd) {
    if (!pwd) return { bits: 0, label: "None", score: 0, color: "#F54A4A" };
    let poolSize = 0;
    if (/[a-z]/.test(pwd)) poolSize += 26;
    if (/[A-Z]/.test(pwd)) poolSize += 26;
    if (/[0-9]/.test(pwd)) poolSize += 10;
    if (/[^a-zA-Z0-9]/.test(pwd)) poolSize += 32;
    if (poolSize === 0) poolSize = 26;
    const bits = Math.round(pwd.length * Math.log2(poolSize));
    let label = "Weak";
    let score = 1;
    let color = "#F54A4A";
    if (bits >= 90) {
      label = "Very Strong";
      score = 4;
      color = "#29C98F";
    } else if (bits >= 65) {
      label = "Strong";
      score = 3;
      color = "#29C98F";
    } else if (bits >= 45) {
      label = "Good";
      score = 2;
      color = "#FFB800";
    }
    return { bits, label, score, color };
  }
  document.addEventListener("DOMContentLoaded", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTabId = tab?.id;
    activeTabUrl = tab?.url || "";
    try {
      if (activeTabUrl.startsWith("http")) {
        activeDomain = new URL(activeTabUrl).hostname.replace("www.", "");
      }
    } catch {
    }
    setupSearch();
    setupAddDropdown();
    setupSortDropdown();
    setupFilters();
    setupUnlockView();
    setupLockBtn();
    setupAccountRetrievalModal();
    const urlParams = new URLSearchParams(window.location.search);
    const requestedTab = urlParams.get("tab");
    const stored = await chrome.storage?.local?.get(["defaultTab"]);
    const storedTab = stored?.defaultTab;
    if (storedTab) {
      await chrome.storage?.local?.remove("defaultTab");
    }
    await loadLogins();
    if (requestedTab === "generator" || storedTab === "generator") {
      showGeneratorView();
    }
  });
  var currentSortMode = "recent";
  function setupSearch() {
    const searchInput = document.getElementById("search-input");
    searchInput?.addEventListener("input", () => {
      if (isGeneratorOpen) {
        isGeneratorOpen = false;
        document.getElementById("filter-generator")?.classList.remove("active");
        document.getElementById("filter-all")?.classList.add("active");
      }
      applyFilterAndSort();
    });
  }
  function setupFilters() {
    const filterAllBtn = document.getElementById("filter-all");
    const filterGenBtn = document.getElementById("filter-generator");
    const headerGenBtn = document.getElementById("btn-header-gen");
    filterAllBtn?.addEventListener("click", () => {
      isGeneratorOpen = false;
      const searchInput = document.getElementById("search-input");
      if (searchInput) searchInput.value = "";
      filterAllBtn.classList.add("active");
      filterGenBtn?.classList.remove("active");
      applyFilterAndSort();
      if (allItems.length > 0) {
        selectItem(allItems[0]);
      } else {
        const container = document.getElementById("detail-pane");
        if (container) container.innerHTML = '<div class="detail-empty">Select an item to view details</div>';
      }
    });
    filterGenBtn?.addEventListener("click", () => {
      showGeneratorView();
    });
    headerGenBtn?.addEventListener("click", () => {
      showGeneratorView();
    });
  }
  function setupSortDropdown() {
    const btnSort = document.getElementById("btn-sort");
    const sortDropdown = document.getElementById("sort-dropdown");
    const sortWrapper = document.getElementById("sort-wrapper");
    if (!btnSort || !sortDropdown) return;
    btnSort.addEventListener("click", (e) => {
      e.stopPropagation();
      document.getElementById("add-dropdown")?.classList.remove("open");
      const isOpen = sortDropdown.classList.toggle("open");
      sortWrapper?.classList.toggle("open", isOpen);
    });
    document.addEventListener("click", () => {
      sortDropdown.classList.remove("open");
      sortWrapper?.classList.remove("open");
    });
    const titles = {
      recent: "Sort: Recently used",
      alpha: "Sort: Alphabetical (A to Z)",
      newest: "Sort: Newest to oldest",
      oldest: "Sort: Oldest to newest"
    };
    const sortIcons = {
      recent: '<path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>',
      alpha: '<path d="M9.25 5l-4.5 12h2.09l.94-2.75h4.44l.94 2.75h2.09L10.75 5h-1.5zm-.53 7.42l1.53-4.5 1.53 4.5H8.72zM15 15h6v1.75h-6V15zm0-3.5h6v1.75h-6V11.5zm0-3.5h6v1.75h-6V8z"/>',
      newest: '<path d="M19 15l-1.41-1.41L13 18.17V2h-2v16.17l-4.59-4.59L5 15l7 7 7-7z"/>',
      oldest: '<path d="M5 9l1.41 1.41L11 5.83V22h2V5.83l4.59 4.59L19 9l-7-7-7 7z"/>'
    };
    sortDropdown.querySelectorAll(".sort-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const sort = item.dataset.sort;
        if (sort) {
          currentSortMode = sort;
          sortDropdown.querySelectorAll(".sort-item").forEach((si) => si.classList.remove("active"));
          item.classList.add("active");
          btnSort.title = titles[sort] || "Sort items";
          const btnIcon = document.getElementById("sort-btn-icon");
          if (btnIcon && sortIcons[sort]) btnIcon.innerHTML = sortIcons[sort];
          sortDropdown.classList.remove("open");
          sortWrapper?.classList.remove("open");
          applyFilterAndSort();
        }
      });
    });
  }
  function sortItems(items) {
    const copy = [...items];
    switch (currentSortMode) {
      case "alpha":
        return copy.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
      case "newest":
        return copy.sort((a, b) => new Date(b.createdAt || b.updatedAt || 0).getTime() - new Date(a.createdAt || a.updatedAt || 0).getTime());
      case "oldest":
        return copy.sort((a, b) => new Date(a.createdAt || a.updatedAt || 0).getTime() - new Date(b.createdAt || b.updatedAt || 0).getTime());
      case "recent":
      default:
        return copy.sort((a, b) => {
          const timeA = new Date(a.lastUsedAt || a.updatedAt || a.createdAt || 0).getTime();
          const timeB = new Date(b.lastUsedAt || b.updatedAt || b.createdAt || 0).getTime();
          return timeB - timeA;
        });
    }
  }
  function applyFilterAndSort() {
    const searchInput = document.getElementById("search-input");
    const query = (searchInput?.value || "").toLowerCase();
    let filtered = allItems;
    if (query) {
      filtered = allItems.filter(
        (item) => (item.title || "").toLowerCase().includes(query) || (item.username || "").toLowerCase().includes(query) || (item.urls || []).some((u) => u.toLowerCase().includes(query))
      );
    }
    const sorted = sortItems(filtered);
    renderSidebarList(sorted);
  }
  function setupAddDropdown() {
    const btn = document.getElementById("btn-add");
    const dropdown = document.getElementById("add-dropdown");
    if (!btn || !dropdown) return;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("open");
    });
    document.addEventListener("click", () => {
      dropdown.classList.remove("open");
    });
    dropdown.querySelectorAll(".add-dropdown-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const type = item.dataset.type || "login";
        dropdown.classList.remove("open");
        showAddForm(type);
      });
    });
  }
  function showAddForm(type, initialValues) {
    const container = document.getElementById("detail-pane");
    if (!container) return;
    isGeneratorOpen = false;
    document.getElementById("filter-generator")?.classList.remove("active");
    document.getElementById("filter-all")?.classList.add("active");
    if (totpInterval) {
      clearInterval(totpInterval);
      totpInterval = null;
    }
    if (addTotpInterval) {
      clearInterval(addTotpInterval);
      addTotpInterval = null;
    }
    const typeConfig = {
      login: { title: "New login", icon: PROTON_ICONS.login, color: PROTON_COLORS.login },
      alias: { title: "New alias", icon: PROTON_ICONS.alias, color: PROTON_COLORS.alias },
      card: { title: "New credit card", icon: PROTON_ICONS.card, color: PROTON_COLORS.card },
      note: { title: "New encrypted note", icon: PROTON_ICONS.note, color: PROTON_COLORS.note },
      identity: { title: "New identity", icon: PROTON_ICONS.identity, color: PROTON_COLORS.identity },
      authenticator: { title: "New Authenticator (2FA)", icon: PROTON_ICONS.authenticator, color: PROTON_COLORS.authenticator }
    };
    const cfg = typeConfig[type] || typeConfig.login;
    let formHtml = `
    <div class="creation-header">
      <div class="creation-title-group">
        <button class="btn-back" id="btn-cancel-create" title="Back">
          <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        </button>
        <div class="detail-title" style="font-size: 16px;">${cfg.title}</div>
      </div>
      <div class="detail-actions">
        <button class="btn-pill" id="btn-save-create" style="background: var(--accent); color: #fff; font-weight: 600;">
          <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          Save
        </button>
      </div>
    </div>

    <div class="vault-selector-badge">
      <svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
      <span>Personal Vault</span>
    </div>
  `;
    if (type === "login") {
      formHtml += `
      <!-- Title & Favicon -->
      <div class="card">
        <div class="card-row">
          <div class="card-icon" id="title-avatar-box" style="color: ${cfg.color};">
            <svg viewBox="0 0 24 24"><path d="${cfg.icon}"/></svg>
          </div>
          <div class="card-content">
            <div class="card-label">Title / Service</div>
            <input type="text" class="edit-input" id="field-title" placeholder="e.g. GitHub, Google, Netflix" list="kloak-services-datalist" autocomplete="off">
            <datalist id="kloak-services-datalist"></datalist>
          </div>
        </div>
      </div>

      <!-- Credentials Card -->
      <div class="card">
        <!-- Username/Email -->
        <div class="card-row">
          <div class="card-icon">
            <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          </div>
          <div class="card-content">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div class="card-label">Username or email</div>
              <span id="btn-gen-alias" style="font-size: 10px; color: var(--color-alias); cursor: pointer; font-weight: 500;">+ Generate alias</span>
            </div>
            <input type="text" class="edit-input" id="field-username" placeholder="user@example.com">
          </div>
        </div>

        <!-- Password -->
        <div class="card-row" style="flex-direction: column; align-items: stretch;">
          <div style="display: flex; align-items: center; width: 100%;">
            <div class="card-icon" style="color: var(--color-login);">
              <svg viewBox="0 0 24 24"><path d="${PROTON_ICONS.login}"/></svg>
            </div>
            <div class="card-content" style="margin-right: 8px;">
              <div class="card-label">Password</div>
              <input type="password" class="edit-input" id="field-password" placeholder="Enter or generate password">
            </div>
            <div class="card-actions">
              <div class="action-icon" id="btn-toggle-create-pwd" title="Toggle visibility">
                <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
              </div>
              <div class="action-icon" id="btn-toggle-gen-panel" title="Password generator" style="color: var(--accent);">
                <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM7 7h2v2H7V7zm0 4h2v2H7v-2zm0 4h2v2H7v-2zm10 2h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z"/></svg>
              </div>
            </div>
          </div>

          <!-- Password Strength Meter -->
          <div class="strength-wrapper" id="strength-box" style="display: none;">
            <div class="strength-bars">
              <div class="strength-segment" id="str-1"></div>
              <div class="strength-segment" id="str-2"></div>
              <div class="strength-segment" id="str-3"></div>
              <div class="strength-segment" id="str-4"></div>
            </div>
            <div class="strength-label" id="str-label">Strength</div>
          </div>

          <!-- Inline Proton Pass Style Generator Panel -->
          <div class="inline-gen-panel" id="gen-panel" style="display: none;">
            <div class="gen-row">
              <span style="font-weight: 500; color: var(--text-main);">Length</span>
              <div class="gen-slider-container">
                <input type="range" class="gen-slider" id="gen-length-slider" min="8" max="64" value="20">
                <span id="gen-length-num" style="font-weight: 600; color: var(--accent); min-width: 20px;">20</span>
              </div>
            </div>
            <div class="gen-options-row">
              <label class="gen-chip active" id="chip-upper"><input type="checkbox" checked id="chk-upper"> A-Z</label>
              <label class="gen-chip active" id="chip-lower"><input type="checkbox" checked id="chk-lower"> a-z</label>
              <label class="gen-chip active" id="chip-digits"><input type="checkbox" checked id="chk-digits"> 0-9</label>
              <label class="gen-chip active" id="chip-symbols"><input type="checkbox" checked id="chk-symbols"> !@#$%</label>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
              <button class="btn-pill" id="btn-regen-pwd" style="height: 24px; font-size: 11px;">
                <svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                Regenerate
              </button>
              <button class="btn-pill" id="btn-apply-pwd" style="height: 24px; font-size: 11px; background: var(--accent); color: #fff;">Use Password</button>
            </div>
          </div>
        </div>

        <!-- 2FA (TOTP) Secret Key -->
        <div class="card-row">
          <div class="card-icon" style="color: var(--color-note);">
            <svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
          </div>
          <div class="card-content">
            <div class="card-label">2FA Secret Key (TOTP)</div>
            <input type="text" class="edit-input" id="field-totp" placeholder="Base32 key (e.g. JBSWY3DPEHPK3PXP)">
            <div id="totp-preview-container" style="display: none;">
              <div class="totp-inline-preview" id="totp-live-badge">
                <span>Code: </span><span id="totp-live-code">------</span>
                <span id="totp-live-timer" style="font-size: 10px; opacity: 0.8;">\u23F1 30s</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Websites Card -->
      <div class="card">
        <div class="card-row" style="flex-direction: column; align-items: stretch;">
          <div class="card-label" style="margin-bottom: 6px;">Websites</div>
          <div id="url-inputs-container">
            <div class="multi-url-row">
              <div class="card-icon" style="margin-right: 6px;">
                <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
              </div>
              <input type="text" class="edit-input url-input" placeholder="https://example.com">
            </div>
          </div>
          <!-- Smart Domain Suggestions -->
          <div class="domain-suggestions-box" id="domain-suggestions-box" style="display: none;">
            <div class="domain-suggestions-header">
              <div class="domain-suggestions-title">
                <svg viewBox="0 0 24 24" class="sparkle-svg"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/></svg>
                <span id="domain-suggestions-label">Suggested Domains:</span>
              </div>
              <span class="domain-suggestions-count" id="domain-suggestions-count">0</span>
            </div>
            <div class="domain-chips-container" id="domain-chips-container"></div>
          </div>
          <button class="btn-add-inline" id="btn-add-more-url">
            <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            Add another website
          </button>
        </div>
      </div>

      <!-- Notes Card -->
      <div class="card">
        <div class="card-row">
          <div class="card-icon" style="color: var(--color-note);">
            <svg viewBox="0 0 24 24"><path d="${PROTON_ICONS.note}"/></svg>
          </div>
          <div class="card-content">
            <div class="card-label">Note</div>
            <textarea class="edit-input" id="field-notes" rows="3" placeholder="Security questions, recovery codes, or notes..."></textarea>
          </div>
        </div>
      </div>
    `;
    } else if (type === "alias") {
      const randomAlias = `kloak.${Math.random().toString(36).substring(2, 7)}@kloak.link`;
      formHtml += `
      <div class="card">
        <div class="card-row">
          <div class="card-icon" style="color: var(--color-alias);">
            <svg viewBox="0 0 24 24"><path d="${PROTON_ICONS.alias}"/></svg>
          </div>
          <div class="card-content">
            <div class="card-label">Title / Purpose</div>
            <input type="text" class="edit-input" id="field-title" placeholder="e.g. Online Shopping, Newsletter">
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-row">
          <div class="card-content">
            <div class="card-label">Generated Alias Email</div>
            <input type="text" class="edit-input" id="field-username" value="${randomAlias}">
          </div>
          <div class="card-actions">
            <div class="action-icon" id="btn-refresh-alias" title="Generate another alias" style="color: var(--color-alias);">
              <svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
            </div>
          </div>
        </div>
        <div class="card-row">
          <div class="card-content">
            <div class="card-label">Forward To Real Email</div>
            <input type="text" class="edit-input" id="field-forward" placeholder="your.real.email@example.com">
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-row">
          <div class="card-content">
            <div class="card-label">Notes</div>
            <textarea class="edit-input" id="field-notes" rows="3" placeholder="Notes..."></textarea>
          </div>
        </div>
      </div>
    `;
    } else if (type === "card") {
      formHtml += `
      <div class="card">
        <div class="card-row">
          <div class="card-icon" style="color: var(--color-card);">
            <svg viewBox="0 0 24 24"><path d="${PROTON_ICONS.card}"/></svg>
          </div>
          <div class="card-content">
            <div class="card-label">Card Title</div>
            <input type="text" class="edit-input" id="field-title" placeholder="e.g. Personal Visa, Corporate Amex">
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-row">
          <div class="card-content">
            <div class="card-label">Cardholder Name</div>
            <input type="text" class="edit-input" id="field-cardholder" placeholder="Name on card">
          </div>
        </div>
        <div class="card-row">
          <div class="card-content">
            <div class="card-label">Card Number</div>
            <input type="text" class="edit-input" id="field-cardnumber" placeholder="0000 0000 0000 0000" maxlength="19">
          </div>
        </div>
        <div class="card-row" style="gap: 12px;">
          <div class="card-content">
            <div class="card-label">Expiration (MM/YY)</div>
            <input type="text" class="edit-input" id="field-expiry" placeholder="MM/YY" maxlength="5">
          </div>
          <div class="card-content">
            <div class="card-label">Security Code (CVV)</div>
            <input type="password" class="edit-input" id="field-cvv" placeholder="CVV" maxlength="4">
          </div>
        </div>
        <div class="card-row">
          <div class="card-content">
            <div class="card-label">Card PIN</div>
            <input type="password" class="edit-input" id="field-pin" placeholder="PIN" maxlength="6">
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-row">
          <div class="card-content">
            <div class="card-label">Notes</div>
            <textarea class="edit-input" id="field-notes" rows="2" placeholder="Bank phone, billing zip, etc."></textarea>
          </div>
        </div>
      </div>
    `;
    } else if (type === "note") {
      formHtml += `
      <div class="card">
        <div class="card-row">
          <div class="card-icon" style="color: var(--color-note);">
            <svg viewBox="0 0 24 24"><path d="${PROTON_ICONS.note}"/></svg>
          </div>
          <div class="card-content">
            <div class="card-label">Title</div>
            <input type="text" class="edit-input" id="field-title" placeholder="Note title...">
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-row">
          <div class="card-content">
            <div class="card-label">Content</div>
            <textarea class="edit-input" id="field-notes" rows="8" placeholder="Type your secure note here..." style="font-family: inherit; font-size: 13px; min-height: 140px;"></textarea>
          </div>
        </div>
      </div>
    `;
    } else if (type === "identity") {
      formHtml += `
      <div class="card">
        <div class="card-row">
          <div class="card-icon" style="color: var(--color-identity);">
            <svg viewBox="0 0 24 24"><path d="${PROTON_ICONS.identity}"/></svg>
          </div>
          <div class="card-content">
            <div class="card-label">Identity Title</div>
            <input type="text" class="edit-input" id="field-title" placeholder="e.g. My Passport, Personal Info">
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-row" style="gap: 12px;">
          <div class="card-content">
            <div class="card-label">First Name</div>
            <input type="text" class="edit-input" id="field-firstname" placeholder="First Name">
          </div>
          <div class="card-content">
            <div class="card-label">Last Name</div>
            <input type="text" class="edit-input" id="field-lastname" placeholder="Last Name">
          </div>
        </div>
        <div class="card-row">
          <div class="card-content">
            <div class="card-label">Email</div>
            <input type="email" class="edit-input" id="field-email" placeholder="Email">
          </div>
        </div>
        <div class="card-row">
          <div class="card-content">
            <div class="card-label">Phone Number</div>
            <input type="tel" class="edit-input" id="field-phone" placeholder="Phone">
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-row">
          <div class="card-content">
            <div class="card-label">Address</div>
            <input type="text" class="edit-input" id="field-address" placeholder="Street Address" style="margin-bottom: 6px;">
            <div style="display: flex; gap: 8px;">
              <input type="text" class="edit-input" id="field-city" placeholder="City">
              <input type="text" class="edit-input" id="field-zip" placeholder="ZIP" style="max-width: 80px;">
            </div>
          </div>
        </div>
      </div>
    `;
    } else if (type === "authenticator") {
      formHtml += `
      <div class="card">
        <div class="card-row">
          <div class="card-icon" style="color: var(--color-alias);">
            <svg viewBox="0 0 24 24"><path d="${PROTON_ICONS.authenticator}"/></svg>
          </div>
          <div class="card-content">
            <div class="card-label">Account / Service Title</div>
            <input type="text" class="edit-input" id="field-title" placeholder="e.g. AWS Root Account, GitHub 2FA">
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-row">
          <div class="card-content">
            <div class="card-label">Issuer / Service Name</div>
            <input type="text" class="edit-input" id="field-auth-issuer" placeholder="e.g. Amazon Web Services, GitHub">
          </div>
        </div>
        <div class="card-row">
          <div class="card-content">
            <div class="card-label">Secret Key (Base32 or otpauth://)</div>
            <input type="text" class="edit-input" id="field-auth-secret" placeholder="JBSWY3DPEHPK3PXP" style="font-family: monospace;">
          </div>
        </div>
        <div class="card-row" style="gap: 8px;">
          <div class="card-content">
            <div class="card-label">Algorithm</div>
            <select class="edit-input" id="field-auth-algo" style="background: var(--bg-input);">
              <option value="TOTP">TOTP (Time)</option>
              <option value="HOTP">HOTP (Counter)</option>
            </select>
          </div>
          <div class="card-content">
            <div class="card-label">Digits</div>
            <select class="edit-input" id="field-auth-digits" style="background: var(--bg-input);">
              <option value="6">6 digits</option>
              <option value="8">8 digits</option>
            </select>
          </div>
          <div class="card-content">
            <div class="card-label">Period</div>
            <select class="edit-input" id="field-auth-period" style="background: var(--bg-input);">
              <option value="30">30s</option>
              <option value="60">60s</option>
            </select>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-row">
          <div class="card-content">
            <div class="card-label">Notes (Optional)</div>
            <textarea class="edit-input" id="field-notes" rows="2" placeholder="Additional recovery details..."></textarea>
          </div>
        </div>
      </div>
    `;
    }
    container.innerHTML = formHtml;
    document.getElementById("btn-cancel-create")?.addEventListener("click", () => {
      if (addTotpInterval) {
        clearInterval(addTotpInterval);
        addTotpInterval = null;
      }
      if (activeItem) renderDetailPane(activeItem);
      else container.innerHTML = '<div class="detail-empty">Select an item to view details</div>';
    });
    if (type === "login") {
      let getCurrentUrls2 = function() {
        const inputs = urlContainer?.querySelectorAll(".url-input");
        if (!inputs) return [];
        const list = [];
        inputs.forEach((inp) => {
          const val = inp.value.trim();
          if (val) list.push(val);
        });
        return list;
      }, isDomainAdded2 = function(domain) {
        const cleanTarget = domain.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
        const current = getCurrentUrls2();
        return current.some((u) => {
          const clean = u.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
          return clean === cleanTarget || clean.endsWith("." + cleanTarget) || cleanTarget.endsWith("." + clean);
        });
      }, applyDomainToForm2 = function(domain) {
        const targetUrl = domain.startsWith("http://") || domain.startsWith("https://") ? domain : `https://${domain}`;
        const inputs = urlContainer?.querySelectorAll(".url-input");
        let applied = false;
        if (inputs) {
          for (let i = 0; i < inputs.length; i++) {
            const inp = inputs[i];
            if (!inp.value.trim()) {
              inp.value = targetUrl;
              inp.dataset.autofilled = "true";
              applied = true;
              break;
            }
          }
        }
        if (!applied) {
          addUrlInputRow2(targetUrl);
        }
        if (titleInput) {
          updateDomainSuggestions2(titleInput.value, false);
        }
      }, addUrlInputRow2 = function(initialVal = "") {
        if (!urlContainer) return;
        const row = document.createElement("div");
        row.className = "multi-url-row";
        row.innerHTML = `
        <div class="card-icon" style="margin-right: 6px;">
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
        </div>
        <input type="text" class="edit-input url-input" placeholder="https://" value="${escHtml(initialVal)}">
        <div class="action-icon btn-del-url" style="color: var(--danger);"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></div>
      `;
        const urlInput = row.querySelector(".url-input");
        if (initialVal) {
          urlInput.dataset.autofilled = "true";
        }
        bindUrlInput2(urlInput);
        row.querySelector(".btn-del-url")?.addEventListener("click", () => {
          row.remove();
          if (titleInput) updateDomainSuggestions2(titleInput.value, false);
        });
        urlContainer.appendChild(row);
      }, bindUrlInput2 = function(input) {
        input.addEventListener("input", () => {
          delete input.dataset.autofilled;
          const val = input.value.trim();
          if (val && titleInput && (!titleInput.value.trim() || titleInput.dataset.autoinferred === "true")) {
            const rev = resolveServiceFromUrl(val);
            if (rev) {
              titleInput.value = rev.displayName;
              titleInput.dataset.autoinferred = "true";
              const avatarBox = document.getElementById("title-avatar-box");
              if (avatarBox) {
                renderFavicon(avatarBox, { title: rev.displayName, size: 24 });
              }
              updateDomainSuggestions2(rev.displayName, false);
              return;
            }
          }
          if (titleInput && titleInput.value.trim()) {
            updateDomainSuggestions2(titleInput.value, false);
          }
        });
      }, updateDomainSuggestions2 = function(query, autoFillPrimary = true) {
        if (!suggestionsBox || !chipsContainer) return;
        const clean = query.trim();
        if (!clean) {
          suggestionsBox.style.display = "none";
          chipsContainer.innerHTML = "";
          return;
        }
        const match = resolveServiceDomains(clean);
        if (!match || !match.domains || match.domains.length === 0) {
          suggestionsBox.style.display = "none";
          chipsContainer.innerHTML = "";
          return;
        }
        if (autoFillPrimary) {
          const firstUrlInput = urlContainer?.querySelector(".url-input");
          if (firstUrlInput) {
            const curVal = firstUrlInput.value.trim();
            if (!curVal || firstUrlInput.dataset.autofilled === "true") {
              firstUrlInput.value = match.primaryUrl;
              firstUrlInput.dataset.autofilled = "true";
            }
          }
        }
        if (suggestionsLabel) {
          suggestionsLabel.textContent = `${match.displayName} Domains:`;
        }
        if (suggestionsCount) {
          suggestionsCount.textContent = `${match.domains.length}`;
        }
        chipsContainer.innerHTML = "";
        match.domains.forEach((domain) => {
          const added = isDomainAdded2(domain);
          const chip = document.createElement("div");
          chip.className = `domain-chip ${added ? "active" : ""}`;
          chip.title = added ? `Already added (${domain})` : `Click to add ${domain}`;
          chip.innerHTML = `
          <span class="chip-symbol">${added ? "\u2713" : "+"}</span>
          <span class="chip-text">${escHtml(domain)}</span>
        `;
          if (!added) {
            chip.addEventListener("click", (e) => {
              e.stopPropagation();
              applyDomainToForm2(domain);
            });
          }
          chipsContainer.appendChild(chip);
        });
        suggestionsBox.style.display = "block";
      }, generateAndSetPreview2 = function() {
        const len = parseInt(slider?.value || "20", 10);
        const upper = document.getElementById("chk-upper")?.checked;
        const lower = document.getElementById("chk-lower")?.checked;
        const digits = document.getElementById("chk-digits")?.checked;
        const symbols = document.getElementById("chk-symbols")?.checked;
        let chars = "";
        if (upper) chars += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        if (lower) chars += "abcdefghijklmnopqrstuvwxyz";
        if (digits) chars += "0123456789";
        if (symbols) chars += "!@#$%^&*()_+-=[]{}|;:,.<>?";
        if (!chars) chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        let pwd = "";
        for (let i = 0; i < len; i++) {
          pwd += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        if (pwdInput) {
          pwdInput.value = pwd;
          if (strengthBox) strengthBox.style.display = "flex";
          updateStrengthMeter(pwd);
        }
      };
      var getCurrentUrls = getCurrentUrls2, isDomainAdded = isDomainAdded2, applyDomainToForm = applyDomainToForm2, addUrlInputRow = addUrlInputRow2, bindUrlInput = bindUrlInput2, updateDomainSuggestions = updateDomainSuggestions2, generateAndSetPreview = generateAndSetPreview2;
      const titleInput = document.getElementById("field-title");
      const pwdInput = document.getElementById("field-password");
      const strengthBox = document.getElementById("strength-box");
      const genPanel = document.getElementById("gen-panel");
      const datalist = document.getElementById("kloak-services-datalist");
      if (datalist) {
        datalist.innerHTML = getAllKnownServiceNames().map((name) => `<option value="${name}"></option>`).join("");
      }
      const suggestionsBox = document.getElementById("domain-suggestions-box");
      const suggestionsLabel = document.getElementById("domain-suggestions-label");
      const suggestionsCount = document.getElementById("domain-suggestions-count");
      const chipsContainer = document.getElementById("domain-chips-container");
      const urlContainer = document.getElementById("url-inputs-container");
      urlContainer?.querySelectorAll(".url-input").forEach((inp) => bindUrlInput2(inp));
      if (initialValues?.title && titleInput) {
        titleInput.value = initialValues.title;
        const avatarBox = document.getElementById("title-avatar-box");
        if (avatarBox) {
          renderFavicon(avatarBox, {
            title: initialValues.title,
            urls: initialValues.url ? [initialValues.url] : [],
            size: 24
          });
        }
        updateDomainSuggestions2(initialValues.title, !initialValues.url);
      } else if (initialValues?.url) {
        const urlInput = document.querySelector(".url-input");
        if (urlInput) urlInput.value = initialValues.url;
        const rev = resolveServiceFromUrl(initialValues.url);
        if (rev && titleInput) {
          titleInput.value = rev.displayName;
          titleInput.dataset.autoinferred = "true";
          const avatarBox = document.getElementById("title-avatar-box");
          if (avatarBox) {
            renderFavicon(avatarBox, { title: rev.displayName, size: 24 });
          }
          updateDomainSuggestions2(rev.displayName, false);
        }
      }
      if (initialValues?.username) {
        const userInput = document.getElementById("field-username");
        if (userInput) userInput.value = initialValues.username;
      }
      if (initialValues?.password && pwdInput) {
        pwdInput.value = initialValues.password;
        if (strengthBox) strengthBox.style.display = "flex";
        updateStrengthMeter(initialValues.password);
      }
      titleInput?.addEventListener("input", () => {
        delete titleInput.dataset.autoinferred;
        const val = titleInput.value.trim();
        const avatarBox = document.getElementById("title-avatar-box");
        if (avatarBox && val.length >= 2) {
          renderFavicon(avatarBox, { title: val, size: 24 });
        }
        updateDomainSuggestions2(val, true);
      });
      document.getElementById("btn-gen-alias")?.addEventListener("click", () => {
        const userInput = document.getElementById("field-username");
        if (userInput) {
          const t = titleInput?.value ? titleInput.value.toLowerCase().replace(/[^a-z0-9]/g, "") : "user";
          userInput.value = `${t}.${Math.random().toString(36).substring(2, 6)}@kloak.link`;
        }
      });
      document.getElementById("btn-toggle-create-pwd")?.addEventListener("click", () => {
        if (pwdInput) pwdInput.type = pwdInput.type === "password" ? "text" : "password";
      });
      pwdInput?.addEventListener("input", () => {
        const p = pwdInput.value;
        if (!p) {
          if (strengthBox) strengthBox.style.display = "none";
          return;
        }
        if (strengthBox) strengthBox.style.display = "flex";
        updateStrengthMeter(p);
      });
      document.getElementById("btn-toggle-gen-panel")?.addEventListener("click", () => {
        if (genPanel) {
          const isOpen = genPanel.style.display !== "none";
          genPanel.style.display = isOpen ? "none" : "flex";
          if (!isOpen) generateAndSetPreview2();
        }
      });
      const slider = document.getElementById("gen-length-slider");
      const numDisplay = document.getElementById("gen-length-num");
      slider?.addEventListener("input", () => {
        if (numDisplay) numDisplay.textContent = slider.value;
        generateAndSetPreview2();
      });
      ["chk-upper", "chk-lower", "chk-digits", "chk-symbols"].forEach((id) => {
        const el = document.getElementById(id);
        el?.addEventListener("change", () => {
          el.parentElement?.classList.toggle("active", el.checked);
          generateAndSetPreview2();
        });
      });
      document.getElementById("btn-regen-pwd")?.addEventListener("click", generateAndSetPreview2);
      document.getElementById("btn-apply-pwd")?.addEventListener("click", () => {
        if (genPanel) genPanel.style.display = "none";
      });
      const totpInput = document.getElementById("field-totp");
      const totpPreviewBox = document.getElementById("totp-preview-container");
      totpInput?.addEventListener("input", () => {
        const key = totpInput.value.trim().replace(/\s+/g, "");
        if (key.length >= 8) {
          if (totpPreviewBox) totpPreviewBox.style.display = "block";
          startAddTotpLivePreview(key);
        } else {
          if (totpPreviewBox) totpPreviewBox.style.display = "none";
          if (addTotpInterval) {
            clearInterval(addTotpInterval);
            addTotpInterval = null;
          }
        }
      });
      document.getElementById("btn-add-more-url")?.addEventListener("click", () => {
        addUrlInputRow2("");
      });
    }
    if (type === "alias") {
      document.getElementById("btn-refresh-alias")?.addEventListener("click", () => {
        const aliasInput = document.getElementById("field-username");
        if (aliasInput) {
          aliasInput.value = `kloak.${Math.random().toString(36).substring(2, 7)}@kloak.link`;
        }
      });
    }
    if (type === "card") {
      const cardInput = document.getElementById("field-cardnumber");
      cardInput?.addEventListener("input", () => {
        let v = cardInput.value.replace(/\D/g, "").substring(0, 16);
        cardInput.value = v.replace(/(\d{4})/g, "$1 ").trim();
      });
      const expInput = document.getElementById("field-expiry");
      expInput?.addEventListener("input", () => {
        let v = expInput.value.replace(/\D/g, "").substring(0, 4);
        if (v.length >= 2) expInput.value = `${v.substring(0, 2)}/${v.substring(2)}`;
        else expInput.value = v;
      });
    }
    document.getElementById("btn-save-create")?.addEventListener("click", () => {
      if (addTotpInterval) {
        clearInterval(addTotpInterval);
        addTotpInterval = null;
      }
      const title = document.getElementById("field-title")?.value || "Untitled";
      const notes = document.getElementById("field-notes")?.value || "";
      const newItem = {
        title,
        notes,
        urls: [],
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (type === "login") {
        newItem.type = "login";
        newItem.username = document.getElementById("field-username")?.value || "";
        newItem.password = document.getElementById("field-password")?.value || "";
        const totp = document.getElementById("field-totp")?.value || "";
        if (totp) newItem.totpSecret = totp.replace(/\s+/g, "");
        const urlInputs = document.querySelectorAll(".url-input");
        urlInputs.forEach((u) => {
          if (u.value.trim()) newItem.urls.push(u.value.trim());
        });
      } else if (type === "alias") {
        const aliasMail = document.getElementById("field-username")?.value || "";
        const fwd = document.getElementById("field-forward")?.value || "";
        newItem.type = "email_alias";
        newItem.username = aliasMail;
        newItem.alias = {
          aliasEmail: aliasMail,
          forwardTo: fwd,
          provider: "DuckDuckGo"
        };
        newItem.notes = fwd ? `Forwarding to: ${fwd}
${notes}` : notes;
      } else if (type === "card") {
        const cardNum = document.getElementById("field-cardnumber")?.value || "";
        const cardHolder = document.getElementById("field-cardholder")?.value || "";
        const expiry = document.getElementById("field-expiry")?.value || "";
        const cvv = document.getElementById("field-cvv")?.value || "";
        const pin = document.getElementById("field-pin")?.value || "";
        const [expM, expY] = expiry.split("/");
        newItem.type = "card";
        newItem.username = cardHolder ? `${cardHolder} (\u2022\u2022\u2022\u2022 ${cardNum.slice(-4)})` : `\u2022\u2022\u2022\u2022 ${cardNum.slice(-4)}`;
        newItem.password = cvv;
        newItem.card = {
          cardholderName: cardHolder,
          number: cardNum.replace(/\s+/g, ""),
          brand: "visa",
          expMonth: expM,
          expYear: expY,
          cvv
        };
        newItem.notes = `Card: ${cardNum}
Expiry: ${expiry}
CVV: ${cvv}${pin ? "\nPIN: " + pin : ""}
${notes}`;
      } else if (type === "identity") {
        const fn = document.getElementById("field-firstname")?.value || "";
        const ln = document.getElementById("field-lastname")?.value || "";
        const em = document.getElementById("field-email")?.value || "";
        const ph = document.getElementById("field-phone")?.value || "";
        const addr = document.getElementById("field-address")?.value || "";
        const city = document.getElementById("field-city")?.value || "";
        const zip = document.getElementById("field-zip")?.value || "";
        newItem.type = "identity";
        newItem.username = `${fn} ${ln}`.trim() || em;
        newItem.email = em;
        newItem.identity = {
          firstName: fn,
          lastName: ln,
          email: em,
          phone: ph,
          address1: addr,
          city,
          zip
        };
        newItem.notes = `Phone: ${ph}
Address: ${addr}, ${city} ${zip}
${notes}`;
      } else if (type === "authenticator") {
        const issuer = document.getElementById("field-auth-issuer")?.value || "";
        const secret = document.getElementById("field-auth-secret")?.value || "";
        const algo = document.getElementById("field-auth-algo")?.value || "TOTP";
        const digits = parseInt(document.getElementById("field-auth-digits")?.value || "6", 10);
        const period = parseInt(document.getElementById("field-auth-period")?.value || "30", 10);
        newItem.type = "authenticator";
        newItem.username = issuer || void 0;
        newItem.totpSecret = secret.replace(/\s+/g, "") || void 0;
        newItem.authenticatorDetails = {
          issuer: issuer || void 0,
          algorithm: algo,
          digits,
          period
        };
      } else if (type === "note") {
        newItem.type = "secure_note";
      }
      chrome.runtime.sendMessage({ type: "ADD_ITEM", item: newItem }, (res) => {
        if (res?.success) {
          const created = res.item || newItem;
          allItems.push(created);
          renderSidebarList(allItems);
          selectItem(created);
        }
      });
    });
  }
  function updateStrengthMeter(pwd) {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 14) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/\d/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score++;
    const colors = ["#F54A4A", "#FF884D", "#FFB800", "#29C98F"];
    const labels = ["Weak", "Fair", "Good", "Strong"];
    for (let i = 1; i <= 4; i++) {
      const seg = document.getElementById(`str-${i}`);
      if (seg) {
        seg.style.background = i <= score ? colors[score - 1] : "#312E40";
      }
    }
    const lbl = document.getElementById("str-label");
    if (lbl) {
      lbl.textContent = score > 0 ? labels[score - 1] : "Very weak";
      lbl.style.color = score > 0 ? colors[score - 1] : "var(--text-muted)";
    }
  }
  function startAddTotpLivePreview(secret) {
    if (addTotpInterval) clearInterval(addTotpInterval);
    const update = () => {
      const code = generateTOTP(secret);
      const codeEl = document.getElementById("totp-live-code");
      const timerEl = document.getElementById("totp-live-timer");
      if (codeEl) codeEl.textContent = `${code.slice(0, 3)} ${code.slice(3)}`;
      if (timerEl) {
        const remaining = 30 - Math.floor(Date.now() / 1e3) % 30;
        timerEl.textContent = `\u23F1 ${remaining}s`;
      }
    };
    update();
    addTotpInterval = window.setInterval(update, 1e3);
  }
  function showGeneratorView() {
    const container = document.getElementById("detail-pane");
    if (!container) return;
    if (totpInterval) {
      clearInterval(totpInterval);
      totpInterval = null;
    }
    if (addTotpInterval) {
      clearInterval(addTotpInterval);
      addTotpInterval = null;
    }
    isGeneratorOpen = true;
    activeItem = null;
    document.getElementById("filter-all")?.classList.remove("active");
    document.getElementById("filter-generator")?.classList.add("active");
    document.querySelectorAll(".list-item").forEach((el) => el.classList.remove("active"));
    if (!currentGenPassword) {
      currentGenPassword = generateSecurePassword();
    }
    renderGeneratorUI(container);
  }
  function formatPasswordHtml(pwd, mode) {
    if (mode === "passphrase") {
      return pwd.split("-").map((w) => `<span class="char-upper">${w}</span>`).join('<span class="char-symbol">-</span>');
    }
    let html = "";
    for (let i = 0; i < pwd.length; i++) {
      const char = pwd[i];
      if (/[0-9]/.test(char)) {
        html += `<span class="char-digit">${char}</span>`;
      } else if (/[A-Z]/.test(char)) {
        html += `<span class="char-upper">${char}</span>`;
      } else if (/[^a-zA-Z0-9]/.test(char)) {
        html += `<span class="char-symbol">${char}</span>`;
      } else {
        html += `<span>${char}</span>`;
      }
    }
    return html;
  }
  function renderGeneratorUI(container) {
    const entropy = calculateEntropy(currentGenPassword);
    const formattedPasswordHtml = formatPasswordHtml(currentGenPassword, genMode);
    container.innerHTML = `
    <div class="generator-view">
      <div class="detail-header" style="margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="card-icon" style="color: var(--accent); margin-right: 0;">
            <svg viewBox="0 0 24 24"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
          </div>
          <div>
            <div class="detail-title" style="font-size: 16px;">Password Generator</div>
            <div style="font-size: 11px; color: var(--text-muted);">High-entropy random key generator</div>
          </div>
        </div>
      </div>

      <!-- Main Result & Strength Card -->
      <div class="gen-main-card">
        <div class="gen-display-row">
          <div class="gen-password-text" id="gen-live-text">${formattedPasswordHtml}</div>
          <div class="gen-actions-group">
            <button class="gen-btn-round" id="btn-view-regen" title="Regenerate Password">
              <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: currentColor;"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
            </button>
            <button class="gen-btn-round" id="btn-view-copy" title="Copy to clipboard">
              <svg viewBox="0 0 24 24" style="width: 15px; height: 15px; fill: currentColor;"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
            </button>
          </div>
        </div>

        <div class="gen-strength-meter">
          <div class="gen-strength-header">
            <span class="gen-strength-label" id="gen-strength-label-text" style="color: ${entropy.color};">${entropy.label}</span>
            <span class="gen-strength-entropy" id="gen-strength-entropy-text">${entropy.bits} bits of entropy</span>
          </div>
          <div class="gen-strength-track">
            <div class="gen-strength-seg" id="gen-str-seg-1" style="background: ${entropy.score >= 1 ? entropy.color : "rgba(255,255,255,0.08)"};"></div>
            <div class="gen-strength-seg" id="gen-str-seg-2" style="background: ${entropy.score >= 2 ? entropy.color : "rgba(255,255,255,0.08)"};"></div>
            <div class="gen-strength-seg" id="gen-str-seg-3" style="background: ${entropy.score >= 3 ? entropy.color : "rgba(255,255,255,0.08)"};"></div>
            <div class="gen-strength-seg" id="gen-str-seg-4" style="background: ${entropy.score >= 4 ? entropy.color : "rgba(255,255,255,0.08)"};"></div>
          </div>
        </div>
      </div>

      <!-- Main Action Buttons -->
      <div class="gen-actions-row">
        <button class="btn-gen-primary" id="btn-view-fill">
          <svg viewBox="0 0 24 24" style="width: 15px; height: 15px; fill: currentColor;"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>
          Fill on Active Page
        </button>
        <div class="gen-sub-actions">
          <button class="btn-gen-sub" id="btn-view-copy-full">
            \u{1F4CB} Copy Password
          </button>
          <button class="btn-gen-sub" id="btn-view-save-login">
            \u2795 Save as New Login
          </button>
        </div>
      </div>

      <!-- Config Card -->
      <div class="gen-config-card">
        <div class="gen-mode-toggle">
          <button class="gen-mode-btn ${genMode === "password" ? "active" : ""}" id="mode-btn-pwd">Password</button>
          <button class="gen-mode-btn ${genMode === "passphrase" ? "active" : ""}" id="mode-btn-phrase">Passphrase</button>
        </div>

        <!-- Password Controls -->
        <div id="gen-controls-pwd" style="display: ${genMode === "password" ? "flex" : "none"}; flex-direction: column; gap: 12px;">
          <div class="gen-slider-wrapper">
            <div class="gen-slider-head">
              <span>Password Length</span>
              <span class="gen-len-val" id="gen-view-len-num">${genLength}</span>
            </div>
            <input type="range" class="gen-slider" id="gen-view-slider" min="8" max="64" value="${genLength}">
            <div class="gen-presets-row" id="gen-pwd-presets">
              <span class="gen-preset-chip ${genLength === 16 ? "active" : ""}" data-len="16">16</span>
              <span class="gen-preset-chip ${genLength === 20 ? "active" : ""}" data-len="20">20</span>
              <span class="gen-preset-chip ${genLength === 24 ? "active" : ""}" data-len="24">24</span>
              <span class="gen-preset-chip ${genLength === 32 ? "active" : ""}" data-len="32">32</span>
              <span class="gen-preset-chip ${genLength === 48 ? "active" : ""}" data-len="48">48</span>
            </div>
          </div>

          <div class="gen-options-row" style="margin-top: 4px;">
            <label class="gen-chip ${genUseUpper ? "active" : ""}" id="chip-v-upper"><input type="checkbox" ${genUseUpper ? "checked" : ""} id="chk-v-upper"> A-Z</label>
            <label class="gen-chip ${genUseLower ? "active" : ""}" id="chip-v-lower"><input type="checkbox" ${genUseLower ? "checked" : ""} id="chk-v-lower"> a-z</label>
            <label class="gen-chip ${genUseDigits ? "active" : ""}" id="chip-v-digits"><input type="checkbox" ${genUseDigits ? "checked" : ""} id="chk-v-digits"> 0-9</label>
            <label class="gen-chip ${genUseSymbols ? "active" : ""}" id="chip-v-symbols"><input type="checkbox" ${genUseSymbols ? "checked" : ""} id="chk-v-symbols"> !@#$%</label>
            <label class="gen-chip ${genAvoidAmbiguous ? "active" : ""}" id="chip-v-ambig" title="Avoid 1, l, I, 0, O"><input type="checkbox" ${genAvoidAmbiguous ? "checked" : ""} id="chk-v-ambig"> Avoid Ambiguous</label>
          </div>
        </div>

        <!-- Passphrase Controls -->
        <div id="gen-controls-phrase" style="display: ${genMode === "passphrase" ? "flex" : "none"}; flex-direction: column; gap: 12px;">
          <div class="gen-slider-wrapper">
            <div class="gen-slider-head">
              <span>Number of Words</span>
              <span class="gen-len-val" id="gen-view-words-num">${genPassphraseWords}</span>
            </div>
            <input type="range" class="gen-slider" id="gen-view-words-slider" min="3" max="8" value="${genPassphraseWords}">
            <div class="gen-presets-row" id="gen-phrase-presets">
              <span class="gen-preset-chip ${genPassphraseWords === 3 ? "active" : ""}" data-words="3">3 words</span>
              <span class="gen-preset-chip ${genPassphraseWords === 4 ? "active" : ""}" data-words="4">4 words</span>
              <span class="gen-preset-chip ${genPassphraseWords === 5 ? "active" : ""}" data-words="5">5 words</span>
              <span class="gen-preset-chip ${genPassphraseWords === 6 ? "active" : ""}" data-words="6">6 words</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Password History Card Placeholder -->
      <div id="gen-history-card-wrap"></div>
    </div>
  `;
    bindGeneratorEvents(container);
    updateHistoryUI(container);
  }
  function updateGeneratorDisplay(container) {
    const liveText = container.querySelector("#gen-live-text");
    if (liveText) {
      liveText.innerHTML = formatPasswordHtml(currentGenPassword, genMode);
    }
    const entropy = calculateEntropy(currentGenPassword);
    const labelText = container.querySelector("#gen-strength-label-text");
    if (labelText) {
      labelText.textContent = entropy.label;
      labelText.style.color = entropy.color;
    }
    const entropyText = container.querySelector("#gen-strength-entropy-text");
    if (entropyText) {
      entropyText.textContent = `${entropy.bits} bits of entropy`;
    }
    for (let i = 1; i <= 4; i++) {
      const seg = container.querySelector(`#gen-str-seg-${i}`);
      if (seg) {
        seg.style.background = entropy.score >= i ? entropy.color : "rgba(255,255,255,0.08)";
      }
    }
    const lenNum = container.querySelector("#gen-view-len-num");
    if (lenNum) lenNum.textContent = String(genLength);
    const wordsNum = container.querySelector("#gen-view-words-num");
    if (wordsNum) wordsNum.textContent = String(genPassphraseWords);
    container.querySelectorAll("#gen-pwd-presets .gen-preset-chip").forEach((chip) => {
      const len = chip.dataset.len;
      chip.classList.toggle("active", len === String(genLength));
    });
    container.querySelectorAll("#gen-phrase-presets .gen-preset-chip").forEach((chip) => {
      const words = chip.dataset.words;
      chip.classList.toggle("active", words === String(genPassphraseWords));
    });
  }
  function updateHistoryUI(container) {
    const wrap = container.querySelector("#gen-history-card-wrap");
    if (!wrap) return;
    if (passwordHistory.length === 0) {
      wrap.innerHTML = "";
      return;
    }
    wrap.innerHTML = `
    <div class="gen-history-card">
      <div class="gen-history-head">
        <span>Recent Passwords</span>
        <span style="font-size: 9px; cursor: pointer; color: var(--text-muted);" id="btn-clear-history">Clear</span>
      </div>
      <div class="gen-history-list">
        ${passwordHistory.slice(0, 4).map((h) => `
          <div class="gen-history-item">
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 250px;">${h.password}</span>
            <button class="kloak-mini-btn btn-copy-hist" data-pwd="${h.password}" title="Copy">\u{1F4CB}</button>
          </div>
        `).join("")}
      </div>
    </div>
  `;
    wrap.querySelector("#btn-clear-history")?.addEventListener("click", () => {
      passwordHistory = [];
      updateHistoryUI(container);
    });
    wrap.querySelectorAll(".btn-copy-hist").forEach((b) => {
      b.addEventListener("click", async (e) => {
        e.stopPropagation();
        const pwd = b.dataset.pwd;
        if (pwd) {
          await copyToClipboardText(pwd);
          b.textContent = "\u2713";
          setTimeout(() => {
            b.textContent = "\u{1F4CB}";
          }, 1200);
        }
      });
    });
  }
  function bindGeneratorEvents(container) {
    const regenBtn = container.querySelector("#btn-view-regen");
    const copyBtn = container.querySelector("#btn-view-copy");
    const copyFullBtn = container.querySelector("#btn-view-copy-full");
    const fillBtn = container.querySelector("#btn-view-fill");
    const saveLoginBtn = container.querySelector("#btn-view-save-login");
    const doRegenerate = () => {
      if (currentGenPassword && !passwordHistory.some((h) => h.password === currentGenPassword)) {
        passwordHistory.unshift({ password: currentGenPassword, timestamp: Date.now() });
        if (passwordHistory.length > 10) passwordHistory.pop();
      }
      currentGenPassword = generateSecurePassword();
      if (regenBtn) {
        regenBtn.classList.add("spinning");
        setTimeout(() => regenBtn.classList.remove("spinning"), 400);
      }
      updateGeneratorDisplay(container);
      updateHistoryUI(container);
    };
    regenBtn?.addEventListener("click", doRegenerate);
    const doCopy = async (btn) => {
      if (currentGenPassword) {
        await copyToClipboardText(currentGenPassword);
        if (btn) {
          const orig = btn.innerHTML;
          btn.innerHTML = `\u2713 Copied!`;
          setTimeout(() => {
            btn.innerHTML = orig;
          }, 1500);
        }
      }
    };
    copyBtn?.addEventListener("click", () => doCopy(copyBtn));
    copyFullBtn?.addEventListener("click", () => doCopy(copyFullBtn));
    fillBtn?.addEventListener("click", async () => {
      if (currentGenPassword) {
        await copyToClipboardText(currentGenPassword);
        if (currentTabId) {
          chrome.tabs.sendMessage(currentTabId, {
            type: "INJECT_GENERATED_PASSWORD",
            password: currentGenPassword
          }).catch(() => null);
        }
        if (fillBtn) {
          const orig = fillBtn.innerHTML;
          fillBtn.innerHTML = `\u2713 Filled into page & copied!`;
          fillBtn.style.background = "#29C98F";
          setTimeout(() => {
            fillBtn.innerHTML = orig;
            fillBtn.style.background = "";
          }, 1800);
        }
      }
    });
    saveLoginBtn?.addEventListener("click", () => {
      const formattedTitle = activeDomain ? activeDomain.charAt(0).toUpperCase() + activeDomain.slice(1).split(".")[0] : "New Login";
      showAddForm("login", {
        title: formattedTitle,
        password: currentGenPassword,
        url: activeTabUrl
      });
    });
    const modePwdBtn = container.querySelector("#mode-btn-pwd");
    const modePhraseBtn = container.querySelector("#mode-btn-phrase");
    const pwdControls = container.querySelector("#gen-controls-pwd");
    const phraseControls = container.querySelector("#gen-controls-phrase");
    modePwdBtn?.addEventListener("click", () => {
      if (genMode !== "password") {
        genMode = "password";
        modePwdBtn.classList.add("active");
        modePhraseBtn?.classList.remove("active");
        if (pwdControls) pwdControls.style.display = "flex";
        if (phraseControls) phraseControls.style.display = "none";
        currentGenPassword = generateSecurePassword();
        updateGeneratorDisplay(container);
      }
    });
    modePhraseBtn?.addEventListener("click", () => {
      if (genMode !== "passphrase") {
        genMode = "passphrase";
        modePhraseBtn.classList.add("active");
        modePwdBtn?.classList.remove("active");
        if (pwdControls) pwdControls.style.display = "none";
        if (phraseControls) phraseControls.style.display = "flex";
        currentGenPassword = generateSecurePassword();
        updateGeneratorDisplay(container);
      }
    });
    const slider = container.querySelector("#gen-view-slider");
    slider?.addEventListener("input", () => {
      genLength = parseInt(slider.value, 10);
      currentGenPassword = generateSecurePassword();
      updateGeneratorDisplay(container);
    });
    const wordsSlider = container.querySelector("#gen-view-words-slider");
    wordsSlider?.addEventListener("input", () => {
      genPassphraseWords = parseInt(wordsSlider.value, 10);
      currentGenPassword = generateSecurePassword();
      updateGeneratorDisplay(container);
    });
    container.querySelectorAll("#gen-pwd-presets .gen-preset-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const len = chip.dataset.len;
        if (len) {
          genLength = parseInt(len, 10);
          if (slider) slider.value = String(genLength);
          currentGenPassword = generateSecurePassword();
          updateGeneratorDisplay(container);
        }
      });
    });
    container.querySelectorAll("#gen-phrase-presets .gen-preset-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const words = chip.dataset.words;
        if (words) {
          genPassphraseWords = parseInt(words, 10);
          if (wordsSlider) wordsSlider.value = String(genPassphraseWords);
          currentGenPassword = generateSecurePassword();
          updateGeneratorDisplay(container);
        }
      });
    });
    const bindCheck = (id, propSetter) => {
      const chk = container.querySelector(`#${id}`);
      chk?.addEventListener("change", () => {
        chk.parentElement?.classList.toggle("active", chk.checked);
        propSetter(chk.checked);
        if (!genUseUpper && !genUseLower && !genUseDigits && !genUseSymbols) {
          genUseLower = true;
          const lowerChk = container.querySelector("#chk-v-lower");
          if (lowerChk) {
            lowerChk.checked = true;
            lowerChk.parentElement?.classList.add("active");
          }
        }
        currentGenPassword = generateSecurePassword();
        updateGeneratorDisplay(container);
      });
    };
    bindCheck("chk-v-upper", (v) => genUseUpper = v);
    bindCheck("chk-v-lower", (v) => genUseLower = v);
    bindCheck("chk-v-digits", (v) => genUseDigits = v);
    bindCheck("chk-v-symbols", (v) => genUseSymbols = v);
    bindCheck("chk-v-ambig", (v) => genAvoidAmbiguous = v);
  }
  async function copyToClipboardText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
  function renderSmartSuggestions(items) {
    const container = document.getElementById("suggested-container");
    const titleEl = document.getElementById("suggested-title");
    const listEl = document.getElementById("suggested-list");
    if (!container || !titleEl || !listEl) return;
    if (!activeDomain) {
      container.style.display = "none";
      return;
    }
    const cleanDomain = activeDomain.toLowerCase();
    const domainPrefix = cleanDomain.split(".")[0];
    const matched = items.filter((item) => {
      const titleMatch = (item.title || "").toLowerCase().includes(domainPrefix);
      const urlMatch = (item.urls || []).some((u) => {
        try {
          return new URL(u).hostname.replace("www.", "").toLowerCase() === cleanDomain;
        } catch {
          return u.toLowerCase().includes(cleanDomain);
        }
      });
      return titleMatch || urlMatch;
    });
    if (matched.length === 0) {
      container.style.display = "none";
      return;
    }
    container.style.display = "flex";
    titleEl.textContent = `SUGGESTED FOR ${activeDomain.toUpperCase()}`;
    listEl.innerHTML = "";
    matched.slice(0, 3).forEach((item) => {
      const row = document.createElement("div");
      row.className = "suggested-row";
      const avatar = document.createElement("div");
      avatar.className = "item-avatar";
      renderItemAvatar(avatar, item, 26);
      const info = document.createElement("div");
      info.className = "item-info";
      const titleDiv = document.createElement("div");
      titleDiv.className = "item-title";
      titleDiv.textContent = item.title || activeDomain;
      const subDiv = document.createElement("div");
      subDiv.className = "item-subtitle";
      subDiv.textContent = item.username || "no username";
      info.appendChild(titleDiv);
      info.appendChild(subDiv);
      const btn = document.createElement("button");
      btn.className = "btn-suggested-action";
      btn.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
      <span>Copy Pass</span>
    `;
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (item.password) {
          await copyToClipboardText(item.password);
          btn.classList.add("copied");
          btn.innerHTML = `
          <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          <span>Copied</span>
        `;
          if (currentTabId) {
            chrome.tabs.sendMessage(currentTabId, {
              type: "INJECT_CREDENTIALS",
              username: item.username,
              password: item.password
            }).catch(() => null);
          }
          setTimeout(() => {
            btn.classList.remove("copied");
            btn.innerHTML = `
            <svg viewBox="0 0 24 24"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
            <span>Copy Pass</span>
          `;
          }, 1800);
        }
      });
      row.appendChild(avatar);
      row.appendChild(info);
      row.appendChild(btn);
      row.addEventListener("click", () => selectItem(item));
      listEl.appendChild(row);
    });
  }
  async function fetchVaultItemsDirect() {
    try {
      const statusRes = await fetch("http://127.0.0.1:53152/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "vault.status" })
      });
      if (!statusRes.ok) return null;
      const statusData = await statusRes.json();
      if (!statusData?.result?.isUnlocked) {
        return { isUnlocked: false, items: [] };
      }
      const itemsRes = await fetch("http://127.0.0.1:53152/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "vault.getItems" })
      });
      if (!itemsRes.ok) return { isUnlocked: true, items: [] };
      const itemsData = await itemsRes.json();
      return {
        isUnlocked: true,
        items: Array.isArray(itemsData?.result) ? itemsData.result : []
      };
    } catch {
      return null;
    }
  }
  async function unlockVaultDirect(password) {
    try {
      const res = await fetch("http://127.0.0.1:53152/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "vault.unlock",
          params: { masterPassword: password }
        })
      });
      if (!res.ok) return { success: false, error: "HTTP error " + res.status };
      const data = await res.json();
      if (data.error) {
        return { success: false, error: data.error.message || "Incorrect master password" };
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message || "Connection failed" };
    }
  }
  async function lockVaultDirect() {
    try {
      const res = await fetch("http://127.0.0.1:53152/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "vault.lock"
        })
      });
      return res.ok;
    } catch {
      return false;
    }
  }
  function showUnlockView(statusMessage) {
    const unlockView = document.getElementById("unlock-view");
    if (unlockView) {
      unlockView.style.display = "flex";
    }
    const pwdInput = document.getElementById("unlock-password");
    if (pwdInput) {
      pwdInput.value = "";
      setTimeout(() => pwdInput.focus(), 60);
    }
    const errorEl = document.getElementById("unlock-error");
    if (errorEl) errorEl.style.display = "none";
    const statusEl = document.getElementById("unlock-daemon-status");
    if (statusEl) {
      statusEl.textContent = statusMessage || "Connected to local Kloak daemon";
    }
  }
  function hideUnlockView() {
    const unlockView = document.getElementById("unlock-view");
    if (unlockView) {
      unlockView.style.display = "none";
    }
  }
  function setupUnlockView() {
    const form = document.getElementById("unlock-form");
    const pwdInput = document.getElementById("unlock-password");
    const toggleBtn = document.getElementById("btn-toggle-unlock-pwd");
    const eyeIcon = document.getElementById("eye-icon-unlock");
    const errorEl = document.getElementById("unlock-error");
    const submitBtn = document.getElementById("btn-submit-unlock");
    const btnText = document.getElementById("unlock-btn-text");
    const spinner = document.getElementById("unlock-spinner");
    if (toggleBtn && pwdInput) {
      toggleBtn.addEventListener("click", () => {
        const isPassword = pwdInput.type === "password";
        pwdInput.type = isPassword ? "text" : "password";
        if (eyeIcon) {
          eyeIcon.innerHTML = isPassword ? '<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.44-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>' : '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>';
        }
      });
    }
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const password = pwdInput?.value || "";
        if (!password) {
          if (errorEl) {
            errorEl.textContent = "Please enter your master password.";
            errorEl.style.display = "block";
          }
          return;
        }
        if (submitBtn) submitBtn.disabled = true;
        if (btnText) btnText.textContent = "Unlocking...";
        if (spinner) spinner.style.display = "inline-block";
        if (errorEl) errorEl.style.display = "none";
        try {
          let unlockSuccess = false;
          let errorMessage = "";
          const directRes = await unlockVaultDirect(password);
          if (directRes.success) {
            unlockSuccess = true;
          } else {
            errorMessage = directRes.error || "";
            const bgRes = await new Promise((resolve) => {
              chrome.runtime.sendMessage({ type: "UNLOCK_VAULT", password }, (response) => {
                resolve(response);
              });
            });
            if (bgRes && bgRes.success) {
              unlockSuccess = true;
            } else if (bgRes && bgRes.error) {
              errorMessage = bgRes.error;
            }
          }
          if (unlockSuccess) {
            hideUnlockView();
            if (pwdInput) pwdInput.value = "";
            await loadLogins();
          } else {
            if (errorEl) {
              errorEl.textContent = errorMessage || "Incorrect master password. Please try again.";
              errorEl.style.display = "block";
            }
            if (pwdInput) {
              pwdInput.select();
              pwdInput.focus();
            }
          }
        } catch (err) {
          if (errorEl) {
            errorEl.textContent = err.message || "Unlock failed. Ensure Kloak is running.";
            errorEl.style.display = "block";
          }
        } finally {
          if (submitBtn) submitBtn.disabled = false;
          if (btnText) btnText.textContent = "Unlock Vault";
          if (spinner) spinner.style.display = "none";
        }
      });
    }
  }
  function setupLockBtn() {
    const lockBtn = document.getElementById("btn-lock");
    if (lockBtn) {
      lockBtn.addEventListener("click", async () => {
        await lockVaultDirect();
        chrome.runtime.sendMessage({ type: "LOCK_VAULT" }).catch(() => null);
        allItems = [];
        activeItem = null;
        const sidebarList = document.getElementById("sidebar-list");
        if (sidebarList) sidebarList.innerHTML = "";
        const detailPane = document.getElementById("detail-pane");
        if (detailPane) detailPane.innerHTML = '<div class="detail-empty">Vault locked</div>';
        showUnlockView();
      });
    }
  }
  async function loadLogins(retryCount = 0) {
    const direct = await fetchVaultItemsDirect();
    if (direct) {
      if (direct.isUnlocked) {
        hideUnlockView();
        allItems = direct.items;
        renderSmartSuggestions(allItems);
        applyFilterAndSort();
        const sorted = sortItems(allItems);
        if (sorted.length > 0 && !activeItem && !isGeneratorOpen) selectItem(sorted[0]);
        return;
      } else {
        showUnlockView();
        return;
      }
    }
    chrome.runtime.sendMessage({ type: "SEARCH_VAULT", query: "" }, (searchRes) => {
      if (searchRes && searchRes.isUnlocked) {
        hideUnlockView();
        allItems = searchRes.items || [];
        renderSmartSuggestions(allItems);
        applyFilterAndSort();
        const sorted = sortItems(allItems);
        if (sorted.length > 0 && !activeItem && !isGeneratorOpen) selectItem(sorted[0]);
      } else {
        chrome.runtime.sendMessage({ type: "GET_STATUS" }, (statusRes) => {
          if (statusRes && statusRes.isUnlocked && retryCount < 2) {
            setTimeout(() => loadLogins(retryCount + 1), 300);
          } else {
            showUnlockView();
          }
        });
      }
    });
  }
  function renderItemAvatar(avatarEl, item, size = 32) {
    avatarEl.innerHTML = "";
    avatarEl.classList.remove("has-image");
    const domains = resolveItemDomains({
      urls: item.urls,
      title: item.title,
      oauthProvider: item.oauthProvider || item.oauth?.provider,
      domain: item.domain
    });
    if (domains.length === 0 && item.type && item.type !== "login" && PROTON_ICONS[item.type]) {
      avatarEl.classList.add("kloak-category-avatar");
      avatarEl.innerHTML = `<svg viewBox="0 0 24 24" style="width: ${Math.round(size * 0.5)}px; height: ${Math.round(size * 0.5)}px; fill: currentColor;"><path d="${PROTON_ICONS[item.type]}"/></svg>`;
      avatarEl.style.color = PROTON_COLORS[item.type] || "var(--text-muted)";
      avatarEl.style.width = `${size}px`;
      avatarEl.style.height = `${size}px`;
      avatarEl.style.borderRadius = `${Math.max(4, Math.round(size * 0.2237))}px`;
      avatarEl.style.display = "inline-flex";
      avatarEl.style.alignItems = "center";
      avatarEl.style.justifyContent = "center";
      avatarEl.style.background = "var(--bg-card)";
      return;
    }
    renderFavicon(avatarEl, { item, size });
  }
  function renderSidebarList(items) {
    const container = document.getElementById("sidebar-list");
    if (!container) return;
    if (items.length === 0) {
      container.innerHTML = '<div style="padding: 16px; color: var(--text-muted); text-align: center; font-size: 11px;">No items found.</div>';
      return;
    }
    container.innerHTML = "";
    const groupHeader = document.createElement("div");
    groupHeader.className = "list-group-header";
    groupHeader.textContent = "All items";
    container.appendChild(groupHeader);
    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = `list-item ${activeItem?.id === item.id ? "active" : ""}`;
      const avatar = document.createElement("div");
      avatar.className = "item-avatar";
      renderItemAvatar(avatar, item, 32);
      const info = document.createElement("div");
      info.className = "item-info";
      const titleEl = document.createElement("div");
      titleEl.className = "item-title";
      titleEl.textContent = item.title || "Untitled";
      const subEl = document.createElement("div");
      subEl.className = "item-subtitle";
      const subText = item.username || item.identity?.fullName || item.card?.cardholderName || item.alias?.aliasEmail || item.authenticatorDetails?.issuer || (item.type === "secure_note" ? "Encrypted Note" : "no username");
      subEl.textContent = subText;
      info.appendChild(titleEl);
      info.appendChild(subEl);
      row.appendChild(avatar);
      row.appendChild(info);
      if (item.type === "login" && item.password) {
        const risk = evaluateCredentialRisk(item, items);
        const gaugeWrap = document.createElement("div");
        gaugeWrap.className = "sidebar-risk-wrap";
        gaugeWrap.title = `${risk.label}: ${risk.score}% (${risk.entropyBits} bits entropy)`;
        gaugeWrap.innerHTML = renderCircumferenceSvg(risk.score, risk.color, 20, 2.2);
        row.appendChild(gaugeWrap);
      }
      row.addEventListener("click", () => selectItem(item));
      container.appendChild(row);
    });
  }
  function selectItem(item) {
    isGeneratorOpen = false;
    activeItem = item;
    document.getElementById("filter-generator")?.classList.remove("active");
    document.getElementById("filter-all")?.classList.add("active");
    if (totpInterval) {
      clearInterval(totpInterval);
      totpInterval = null;
    }
    if (addTotpInterval) {
      clearInterval(addTotpInterval);
      addTotpInterval = null;
    }
    renderSidebarList(allItems);
    renderDetailPane(item);
  }
  function renderDetailPane(item) {
    const container = document.getElementById("detail-pane");
    if (!container) return;
    isEditing = false;
    if (!item) {
      container.innerHTML = '<div class="detail-empty">Select an item to view details</div>';
      return;
    }
    const title = item.title || "Untitled";
    const username = item.username || "";
    const email = item.email || "";
    const hasTotp = !!item.totpSecret;
    const notes = item.notes || "";
    const urls = item.urls || [];
    container.innerHTML = "";
    const header = document.createElement("div");
    header.className = "detail-header";
    const titleGroup = document.createElement("div");
    titleGroup.style.display = "flex";
    titleGroup.style.alignItems = "center";
    titleGroup.style.gap = "10px";
    titleGroup.style.minWidth = "0";
    titleGroup.style.flex = "1";
    const headerAvatar = document.createElement("div");
    headerAvatar.className = "item-avatar";
    headerAvatar.style.width = "32px";
    headerAvatar.style.height = "32px";
    headerAvatar.style.marginRight = "0";
    renderItemAvatar(headerAvatar, item, 32);
    const titleEl = document.createElement("div");
    titleEl.className = "detail-title";
    titleEl.textContent = title;
    titleGroup.appendChild(headerAvatar);
    titleGroup.appendChild(titleEl);
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "detail-actions";
    actionsDiv.innerHTML = `
    <button class="btn-pill" id="btn-autofill">
      <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 9h-2V7h-2v5H6v2h2v5h2v-5h2v-2z"/></svg>
      Fill
    </button>
    <button class="btn-pill" id="btn-edit">
      <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
      Edit
    </button>
  `;
    header.appendChild(titleGroup);
    header.appendChild(actionsDiv);
    container.appendChild(header);
    const card1 = document.createElement("div");
    card1.className = "card";
    if (username) {
      card1.innerHTML += `
      <div class="card-row">
        <div class="card-icon">
          <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
        </div>
        <div class="card-content">
          <div class="card-label">Username</div>
          <div class="card-value" id="user-val"></div>
        </div>
        <div class="card-actions">
          <div class="action-icon" id="copy-user" title="Copy">
            <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
          </div>
        </div>
      </div>
    `;
    }
    if (email && email !== username) {
      card1.innerHTML += `
      <div class="card-row">
        <div class="card-icon" style="color: var(--color-alias);">
          <svg viewBox="0 0 24 24"><path d="${PROTON_ICONS.alias}"/></svg>
        </div>
        <div class="card-content">
          <div class="card-label">Email</div>
          <div class="card-value" id="email-val"></div>
        </div>
        <div class="card-actions">
          <div class="action-icon" id="copy-email" title="Copy">
            <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
          </div>
        </div>
      </div>
    `;
    }
    if (item.password) {
      card1.innerHTML += `
      <div class="card-row">
        <div class="card-icon" style="color: var(--color-login);">
          <svg viewBox="0 0 24 24"><path d="${PROTON_ICONS.login}"/></svg>
        </div>
        <div class="card-content">
          <div class="card-label">Password</div>
          <div class="card-value" id="pwd-val" style="letter-spacing: 2px;">\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022</div>
        </div>
        <div class="card-actions">
          <div class="action-icon" id="toggle-pwd" title="Reveal">
            <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
          </div>
          <div class="action-icon" id="copy-pwd" title="Copy">
            <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
          </div>
        </div>
      </div>
    `;
    }
    container.appendChild(card1);
    const userVal = document.getElementById("user-val");
    if (userVal) userVal.textContent = username;
    const emailVal = document.getElementById("email-val");
    if (emailVal) emailVal.textContent = email;
    if (item.type === "login" && item.password) {
      const risk = evaluateCredentialRisk(item, allItems);
      const riskCard = document.createElement("div");
      riskCard.className = "card risk-detail-card";
      const circumferenceSvg = renderCircumferenceSvg(risk.score, risk.color, 52, 4.5);
      riskCard.innerHTML = `
      <div class="risk-card-inner">
        <div class="risk-gauge-container">
          ${circumferenceSvg}
        </div>
        <div class="risk-info-column">
          <div class="risk-header-row">
            <span class="risk-title">Security & Risk Health</span>
            <span class="risk-status-pill" style="background: ${risk.color}22; color: ${risk.color}; border: 1px solid ${risk.color}55;">
              ${risk.label}
            </span>
          </div>
          <div class="risk-chips-wrap">
            <span class="risk-chip">\u{1F510} ${risk.entropyBits} bits entropy</span>
            <span class="risk-chip ${risk.isReused ? "alert" : ""}">${risk.isReused ? `\u26A0\uFE0F Reused on ${risk.reusedCount + 1} sites` : "\u2713 Unique password"}</span>
            <span class="risk-chip ${risk.has2FA ? "success" : ""}">${risk.has2FA ? "\u{1F6E1}\uFE0F 2FA Active" : "\u26A0\uFE0F No 2FA"}</span>
          </div>
          ${item.passwordHistory && item.passwordHistory.length > 0 ? `
            <div class="risk-history-info">
              <span>\u{1F552} ${item.passwordHistory.length} previous password${item.passwordHistory.length > 1 ? "s" : ""} archived in history</span>
            </div>
          ` : ""}
          ${item.importSource ? `
            <div class="risk-source-info">
              <span>\u{1F4E5} Source: <strong>${item.importSource}</strong></span>
            </div>
          ` : ""}
        </div>
      </div>
    `;
      container.appendChild(riskCard);
    }
    if (item.totpSecret) {
      const totpCard = document.createElement("div");
      totpCard.className = "totp-container";
      totpCard.innerHTML = `
      <div class="totp-header">
        <div class="totp-label-group">
          <div class="totp-shield-icon">
            <svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
          </div>
          <span class="totp-title">Authenticator</span>
        </div>
        <div class="totp-countdown-pill" id="totp-countdown-pill">
          <svg class="totp-countdown-svg" viewBox="0 0 24 24">
            <circle class="totp-svg-bg" cx="12" cy="12" r="9"></circle>
            <circle class="totp-svg-progress" id="totp-svg-progress" cx="12" cy="12" r="9"></circle>
          </svg>
          <span id="totp-timer-text">30s</span>
        </div>
      </div>
      <div class="totp-body-row" id="copy-totp-row" title="Click to copy code">
        <div class="totp-code-display" id="totp-code">------</div>
        <button class="totp-copy-btn" id="copy-totp-btn">
          <svg class="copy-icon-svg" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
          <span id="totp-copy-text">Copy</span>
        </button>
      </div>
    `;
      container.appendChild(totpCard);
      const handleCopy = async (e) => {
        e.stopPropagation();
        const codeEl = document.getElementById("totp-code");
        const rawCode = (codeEl?.textContent || "").replace(/\s+/g, "");
        if (!rawCode || rawCode === "------") return;
        await copyToClipboardText(rawCode);
        const copyBtn = document.getElementById("copy-totp-btn");
        const copyText = document.getElementById("totp-copy-text");
        if (copyBtn && copyText) {
          copyBtn.classList.add("copied");
          copyText.textContent = "Copied!";
          setTimeout(() => {
            copyBtn.classList.remove("copied");
            copyText.textContent = "Copy";
          }, 1800);
        }
      };
      totpCard.querySelector("#copy-totp-row")?.addEventListener("click", handleCopy);
      totpCard.querySelector("#copy-totp-btn")?.addEventListener("click", handleCopy);
      startTotpCounter(item.totpSecret);
    }
    if (urls.length > 0) {
      const urlCard = document.createElement("div");
      urlCard.className = "card";
      let urlHtml = '<div class="card-row"><div class="card-icon"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg></div><div class="card-content"><div class="card-label">Websites</div><div class="card-value">';
      urls.forEach((u) => {
        urlHtml += `<a class="url-pill" href="${u}" target="_blank" style="margin-right: 4px;">${u}</a>`;
      });
      urlHtml += "</div></div></div>";
      urlCard.innerHTML = urlHtml;
      container.appendChild(urlCard);
    }
    if (notes) {
      const noteCard = document.createElement("div");
      noteCard.className = "card";
      noteCard.innerHTML = `
      <div class="card-row">
        <div class="card-icon" style="color: var(--color-note);">
          <svg viewBox="0 0 24 24"><path d="${PROTON_ICONS.note}"/></svg>
        </div>
        <div class="card-content">
          <div class="card-label">Notes</div>
          <div class="card-value multiline" id="notes-val"></div>
        </div>
      </div>
    `;
      container.appendChild(noteCard);
      const notesVal = document.getElementById("notes-val");
      if (notesVal) notesVal.textContent = notes;
    }
    if (item.createdAt || item.updatedAt) {
      const metaCard = document.createElement("div");
      metaCard.className = "card";
      if (item.createdAt) {
        const row = document.createElement("div");
        row.className = "meta-row";
        row.innerHTML = `<span>Created</span><span>${new Date(item.createdAt).toLocaleDateString()}</span>`;
        metaCard.appendChild(row);
      }
      if (item.updatedAt) {
        const row = document.createElement("div");
        row.className = "meta-row";
        row.innerHTML = `<span>Modified</span><span>${new Date(item.updatedAt).toLocaleDateString()}</span>`;
        metaCard.appendChild(row);
      }
      container.appendChild(metaCard);
    }
    const copyIconSvg = '<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';
    const checkIconSvg = '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="#29C98F"/></svg>';
    async function copyToClipboard(text, btn) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          throw new Error("fallback");
        }
      } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      btn.innerHTML = checkIconSvg;
      setTimeout(() => {
        btn.innerHTML = copyIconSvg;
      }, 1500);
    }
    let revealed = false;
    document.getElementById("toggle-pwd")?.addEventListener("click", () => {
      revealed = !revealed;
      const pwdEl = document.getElementById("pwd-val");
      if (!pwdEl) return;
      if (revealed) {
        pwdEl.textContent = item.password || "";
        pwdEl.style.letterSpacing = "normal";
      } else {
        pwdEl.textContent = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
        pwdEl.style.letterSpacing = "2px";
      }
    });
    document.getElementById("copy-pwd")?.addEventListener("click", (e) => {
      copyToClipboard(item.password || "", e.currentTarget);
    });
    document.getElementById("copy-user")?.addEventListener("click", (e) => {
      copyToClipboard(item.username || "", e.currentTarget);
    });
    document.getElementById("copy-email")?.addEventListener("click", (e) => {
      copyToClipboard(item.email || "", e.currentTarget);
    });
    document.getElementById("copy-totp")?.addEventListener("click", (e) => {
      const code = document.getElementById("totp-code")?.textContent || "";
      copyToClipboard(code, e.currentTarget);
    });
    document.getElementById("btn-autofill")?.addEventListener("click", async () => {
      if (currentTabId) {
        await chrome.tabs.sendMessage(currentTabId, {
          type: "INJECT_CREDENTIALS",
          username: item.username,
          password: item.password
        });
      }
    });
    document.getElementById("btn-edit")?.addEventListener("click", () => {
      enterEditMode(item);
    });
  }
  function enterEditMode(item) {
    const container = document.getElementById("detail-pane");
    if (!container) return;
    isEditing = true;
    const currentUrls = item.urls && item.urls.length > 0 ? item.urls : [""];
    container.innerHTML = `
    <div class="creation-header">
      <div class="creation-title-group">
        <button class="btn-back" id="btn-cancel-edit" title="Back">
          <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        </button>
        <div class="detail-title" style="font-size: 16px;">Edit Item</div>
      </div>
      <div class="detail-actions">
        <button class="btn-pill" id="btn-save-edit" style="background: var(--accent); color: #fff; font-weight: 600;">
          <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          Save
        </button>
      </div>
    </div>
    <div class="card">
      <div class="card-row">
        <div class="card-content">
          <div class="card-label">Title / Service</div>
          <input type="text" class="edit-input" id="edit-title" value="${escHtml(item.title || "")}" list="kloak-edit-services-datalist" autocomplete="off">
          <datalist id="kloak-edit-services-datalist"></datalist>
        </div>
      </div>
      <div class="card-row">
        <div class="card-content">
          <div class="card-label">Username / Email</div>
          <input type="text" class="edit-input" id="edit-username" value="${escHtml(item.username || "")}">
        </div>
      </div>
      <div class="card-row">
        <div class="card-content">
          <div class="card-label">Password</div>
          <input type="text" class="edit-input" id="edit-password" value="${escHtml(item.password || "")}">
        </div>
      </div>
      <div class="card-row">
        <div class="card-content">
          <div class="card-label">2FA Secret Key (TOTP)</div>
          <input type="text" class="edit-input" id="edit-totp" value="${escHtml(item.totpSecret || "")}" placeholder="Base32 key">
        </div>
      </div>
      <div class="card-row" style="flex-direction: column; align-items: stretch;">
        <div class="card-label" style="margin-bottom: 6px;">Websites</div>
        <div id="edit-urls-container">
          ${currentUrls.map((u, i) => `
            <div class="multi-url-row" style="margin-bottom: 6px;">
              <div class="card-icon" style="margin-right: 6px;">
                <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
              </div>
              <input type="text" class="edit-input edit-url-input" placeholder="https://" value="${escHtml(u)}">
              ${i > 0 ? `<div class="action-icon btn-del-edit-url" style="color: var(--danger);"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></div>` : ""}
            </div>
          `).join("")}
        </div>
        <!-- Smart Domain Suggestions in Edit Mode -->
        <div class="domain-suggestions-box" id="edit-domain-suggestions-box" style="display: none;">
          <div class="domain-suggestions-header">
            <div class="domain-suggestions-title">
              <svg viewBox="0 0 24 24" class="sparkle-svg"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/></svg>
              <span id="edit-domain-suggestions-label">Suggested Domains:</span>
            </div>
            <span class="domain-suggestions-count" id="edit-domain-suggestions-count">0</span>
          </div>
          <div class="domain-chips-container" id="edit-domain-chips-container"></div>
        </div>
        <button class="btn-add-inline" id="btn-edit-add-more-url">
          <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Add another website
        </button>
      </div>
      <div class="card-row">
        <div class="card-content">
          <div class="card-label">Notes</div>
          <textarea class="edit-input" id="edit-notes" rows="3" style="resize: vertical;">${escHtml(item.notes || "")}</textarea>
        </div>
      </div>
    </div>
  `;
    const editDatalist = document.getElementById("kloak-edit-services-datalist");
    if (editDatalist) {
      editDatalist.innerHTML = getAllKnownServiceNames().map((name) => `<option value="${name}"></option>`).join("");
    }
    const editTitleInput = document.getElementById("edit-title");
    const editUrlsContainer = document.getElementById("edit-urls-container");
    const editSuggestionsBox = document.getElementById("edit-domain-suggestions-box");
    const editSuggestionsLabel = document.getElementById("edit-domain-suggestions-label");
    const editSuggestionsCount = document.getElementById("edit-domain-suggestions-count");
    const editChipsContainer = document.getElementById("edit-domain-chips-container");
    function getEditUrls() {
      const inputs = editUrlsContainer?.querySelectorAll(".edit-url-input");
      if (!inputs) return [];
      const list = [];
      inputs.forEach((inp) => {
        const val = inp.value.trim();
        if (val) list.push(val);
      });
      return list;
    }
    function isEditDomainAdded(domain) {
      const cleanTarget = domain.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      const current = getEditUrls();
      return current.some((u) => {
        const clean = u.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
        return clean === cleanTarget || clean.endsWith("." + cleanTarget) || cleanTarget.endsWith("." + clean);
      });
    }
    function applyDomainToEditForm(domain) {
      const targetUrl = domain.startsWith("http://") || domain.startsWith("https://") ? domain : `https://${domain}`;
      const inputs = editUrlsContainer?.querySelectorAll(".edit-url-input");
      let applied = false;
      if (inputs) {
        for (let i = 0; i < inputs.length; i++) {
          const inp = inputs[i];
          if (!inp.value.trim()) {
            inp.value = targetUrl;
            applied = true;
            break;
          }
        }
      }
      if (!applied) {
        addEditUrlInputRow(targetUrl);
      }
      if (editTitleInput) {
        updateEditDomainSuggestions(editTitleInput.value);
      }
    }
    function addEditUrlInputRow(initialVal = "") {
      if (!editUrlsContainer) return;
      const row = document.createElement("div");
      row.className = "multi-url-row";
      row.style.marginBottom = "6px";
      row.innerHTML = `
      <div class="card-icon" style="margin-right: 6px;">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
      </div>
      <input type="text" class="edit-input edit-url-input" placeholder="https://" value="${escHtml(initialVal)}">
      <div class="action-icon btn-del-edit-url" style="color: var(--danger);"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></div>
    `;
      const urlInput = row.querySelector(".edit-url-input");
      bindEditUrlInput(urlInput);
      row.querySelector(".btn-del-edit-url")?.addEventListener("click", () => {
        row.remove();
        if (editTitleInput) updateEditDomainSuggestions(editTitleInput.value);
      });
      editUrlsContainer.appendChild(row);
    }
    function bindEditUrlInput(input) {
      input.addEventListener("input", () => {
        const val = input.value.trim();
        if (val && editTitleInput && !editTitleInput.value.trim()) {
          const rev = resolveServiceFromUrl(val);
          if (rev) {
            editTitleInput.value = rev.displayName;
            updateEditDomainSuggestions(rev.displayName);
            return;
          }
        }
        if (editTitleInput && editTitleInput.value.trim()) {
          updateEditDomainSuggestions(editTitleInput.value);
        }
      });
    }
    function updateEditDomainSuggestions(query) {
      if (!editSuggestionsBox || !editChipsContainer) return;
      const clean = query.trim();
      if (!clean) {
        editSuggestionsBox.style.display = "none";
        editChipsContainer.innerHTML = "";
        return;
      }
      const match = resolveServiceDomains(clean);
      if (!match || !match.domains || match.domains.length === 0) {
        editSuggestionsBox.style.display = "none";
        editChipsContainer.innerHTML = "";
        return;
      }
      if (editSuggestionsLabel) {
        editSuggestionsLabel.textContent = `${match.displayName} Domains:`;
      }
      if (editSuggestionsCount) {
        editSuggestionsCount.textContent = `${match.domains.length}`;
      }
      editChipsContainer.innerHTML = "";
      match.domains.forEach((domain) => {
        const added = isEditDomainAdded(domain);
        const chip = document.createElement("div");
        chip.className = `domain-chip ${added ? "active" : ""}`;
        chip.title = added ? `Already added (${domain})` : `Click to add ${domain}`;
        chip.innerHTML = `
        <span class="chip-symbol">${added ? "\u2713" : "+"}</span>
        <span class="chip-text">${escHtml(domain)}</span>
      `;
        if (!added) {
          chip.addEventListener("click", (e) => {
            e.stopPropagation();
            applyDomainToEditForm(domain);
          });
        }
        editChipsContainer.appendChild(chip);
      });
      editSuggestionsBox.style.display = "block";
    }
    editUrlsContainer?.querySelectorAll(".edit-url-input").forEach((inp) => bindEditUrlInput(inp));
    editUrlsContainer?.querySelectorAll(".btn-del-edit-url").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.currentTarget.closest(".multi-url-row")?.remove();
        if (editTitleInput) updateEditDomainSuggestions(editTitleInput.value);
      });
    });
    document.getElementById("btn-edit-add-more-url")?.addEventListener("click", () => {
      addEditUrlInputRow("");
    });
    editTitleInput?.addEventListener("input", () => {
      updateEditDomainSuggestions(editTitleInput.value);
    });
    if (item.title) {
      updateEditDomainSuggestions(item.title);
    }
    document.getElementById("btn-cancel-edit")?.addEventListener("click", () => {
      renderDetailPane(item);
    });
    document.getElementById("btn-save-edit")?.addEventListener("click", () => {
      const editUrlInputs = Array.from(document.querySelectorAll(".edit-url-input"));
      const urls = editUrlInputs.map((i) => i.value.trim()).filter(Boolean);
      const updated = {
        ...item,
        title: document.getElementById("edit-title").value,
        username: document.getElementById("edit-username").value,
        password: document.getElementById("edit-password").value,
        totpSecret: document.getElementById("edit-totp").value.trim().replace(/\s+/g, "") || void 0,
        urls,
        notes: document.getElementById("edit-notes").value,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      chrome.runtime.sendMessage({ type: "UPDATE_ITEM", item: updated }, (res) => {
        if (res?.success) {
          const idx = allItems.findIndex((i) => i.id === item.id);
          if (idx !== -1) allItems[idx] = updated;
          activeItem = updated;
          renderSidebarList(allItems);
          renderDetailPane(updated);
        }
      });
    });
  }
  function escHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function startTotpCounter(secret) {
    if (totpInterval) clearInterval(totpInterval);
    const update = () => {
      const code = generateTOTP(secret);
      const codeEl = document.getElementById("totp-code");
      const timerTextEl = document.getElementById("totp-timer-text");
      const pillEl = document.getElementById("totp-countdown-pill");
      const progressEl = document.getElementById("totp-svg-progress");
      if (codeEl) codeEl.textContent = `${code.slice(0, 3)}  ${code.slice(3)}`;
      const remaining = 30 - Math.floor(Date.now() / 1e3) % 30;
      if (timerTextEl) timerTextEl.textContent = `${remaining}s`;
      if (progressEl) {
        const circumference = 2 * Math.PI * 9;
        const offset = circumference * (1 - remaining / 30);
        progressEl.style.strokeDashoffset = `${offset}`;
      }
      if (pillEl) {
        pillEl.classList.toggle("warn", remaining <= 10 && remaining > 5);
        pillEl.classList.toggle("danger", remaining <= 5);
      }
    };
    update();
    totpInterval = window.setInterval(update, 1e3);
  }
  function generateTOTP(secret) {
    const epoch = Math.floor(Date.now() / 1e3);
    const timeStep = Math.floor(epoch / 30);
    let hash = 0;
    const combined = secret + timeStep.toString();
    for (let i = 0; i < combined.length; i++) {
      const chr = combined.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0;
    }
    const code = Math.abs(hash % 1e6);
    return code.toString().padStart(6, "0");
  }
  function setupAccountRetrievalModal() {
    const modal = document.getElementById("account-retrieve-modal");
    const btnOpenHeader = document.getElementById("btn-retrieve-accounts");
    const menuRetrieve = document.getElementById("menu-retrieve-accounts");
    const btnClose = document.getElementById("btn-close-retrieve-modal");
    const btnDone = document.getElementById("btn-merge-report-done");
    if (!modal) return;
    const openModal = () => {
      modal.style.display = "flex";
      document.getElementById("add-dropdown")?.classList.remove("open");
      switchTab("google");
      const reportPanel = document.getElementById("merge-report-panel");
      if (reportPanel) reportPanel.style.display = "none";
    };
    const closeModal = () => {
      modal.style.display = "none";
    };
    btnOpenHeader?.addEventListener("click", (e) => {
      e.stopPropagation();
      openModal();
    });
    menuRetrieve?.addEventListener("click", (e) => {
      e.stopPropagation();
      openModal();
    });
    btnClose?.addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
    btnDone?.addEventListener("click", async () => {
      closeModal();
      await loadLogins();
    });
    const tabs = modal.querySelectorAll(".modal-tab");
    const panels = {
      google: document.getElementById("panel-google"),
      microsoft: document.getElementById("panel-microsoft"),
      opera: document.getElementById("panel-opera"),
      apple: document.getElementById("panel-apple"),
      universal: document.getElementById("panel-universal")
    };
    function switchTab(tabKey) {
      tabs.forEach((t) => {
        const isMatch = t.getAttribute("data-tab") === tabKey;
        t.classList.toggle("active", isMatch);
      });
      Object.keys(panels).forEach((k) => {
        if (panels[k]) {
          panels[k].style.display = k === tabKey ? "flex" : "none";
        }
      });
      const reportPanel = document.getElementById("merge-report-panel");
      if (reportPanel) reportPanel.style.display = "none";
    }
    tabs.forEach((t) => {
      t.addEventListener("click", () => {
        const tabKey = t.getAttribute("data-tab") || "google";
        switchTab(tabKey);
      });
    });
    document.getElementById("btn-open-google-passwords")?.addEventListener("click", () => {
      chrome.tabs.create({ url: "https://passwords.google.com" });
    });
    document.getElementById("btn-open-ms-passwords")?.addEventListener("click", () => {
      chrome.tabs.create({ url: "https://account.microsoft.com" });
    });
    document.getElementById("btn-open-opera-passwords")?.addEventListener("click", () => {
      chrome.tabs.create({ url: "https://auth.opera.com" });
    });
    const setupDropZone = (dropZoneId, fileInputId, browseBtnId, format) => {
      const dropZone = document.getElementById(dropZoneId);
      const fileInput = document.getElementById(fileInputId);
      const browseBtn = document.getElementById(browseBtnId);
      if (!dropZone || !fileInput) return;
      browseBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        fileInput.click();
      });
      dropZone.addEventListener("click", () => {
        fileInput.click();
      });
      dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("dragover");
      });
      dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("dragover");
      });
      dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("dragover");
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          processFile(files[0], format);
        }
      });
      fileInput.addEventListener("change", () => {
        if (fileInput.files && fileInput.files.length > 0) {
          processFile(fileInput.files[0], format);
        }
      });
    };
    setupDropZone("drop-zone-google", "file-input-google", "btn-browse-google", "google-csv");
    setupDropZone("drop-zone-microsoft", "file-input-microsoft", "btn-browse-microsoft", "microsoft-csv");
    setupDropZone("drop-zone-opera", "file-input-opera", "btn-browse-opera", "opera-csv");
    setupDropZone("drop-zone-apple", "file-input-apple", "btn-browse-apple", "apple-csv");
    setupDropZone("drop-zone-universal", "file-input-universal", "btn-browse-universal", "auto");
    async function processFile(file, format) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result;
        if (!content) return;
        chrome.runtime.sendMessage(
          {
            type: "IMPORT_PASSWORDS",
            content,
            format,
            options: { autoMerge: true }
          },
          async (response) => {
            if (response?.success && response.result?.mergeReport) {
              displayMergeReport(response.result.mergeReport);
            } else if (response?.success) {
              displayMergeReport({
                totalProcessed: response.result.imported || 1,
                exactDuplicatesMerged: 0,
                updatedPasswordsMerged: 0,
                newItemsAdded: response.result.imported || 1,
                reusedPasswordGroups: []
              });
            } else {
              alert("Import error: " + (response?.error || "Failed to parse file"));
            }
          }
        );
      };
      reader.readAsText(file);
    }
    function displayMergeReport(report) {
      Object.keys(panels).forEach((k) => {
        if (panels[k]) panels[k].style.display = "none";
      });
      const reportPanel = document.getElementById("merge-report-panel");
      const statsGrid = document.getElementById("report-stats-grid");
      if (!reportPanel || !statsGrid) return;
      statsGrid.innerHTML = `
      <div class="report-stat-card">
        <div class="report-stat-num" style="color: #6D4AFF;">${report.totalProcessed || report.newItemsAdded + report.exactDuplicatesMerged + report.updatedPasswordsMerged}</div>
        <div class="report-stat-label">Total Accounts Processed</div>
      </div>
      <div class="report-stat-card">
        <div class="report-stat-num" style="color: #10B981;">${report.exactDuplicatesMerged || 0}</div>
        <div class="report-stat-label">Exact Duplicates Auto-Merged</div>
      </div>
      <div class="report-stat-card">
        <div class="report-stat-num" style="color: #00D2B4;">${report.updatedPasswordsMerged || 0}</div>
        <div class="report-stat-label">Updated Passwords Merged (History Kept)</div>
      </div>
      <div class="report-stat-card">
        <div class="report-stat-num" style="color: #FF884D;">${report.newItemsAdded || 0}</div>
        <div class="report-stat-label">New Accounts Added to Vault</div>
      </div>
    `;
      if (report.reusedPasswordGroups && report.reusedPasswordGroups.length > 0) {
        statsGrid.innerHTML += `
        <div class="report-stat-card" style="grid-column: span 2; border-color: rgba(245, 74, 74, 0.4); background: rgba(245, 74, 74, 0.08);">
          <div class="report-stat-num" style="color: #EF4444; font-size: 13px;">
            \u26A0\uFE0F ${report.reusedPasswordGroups.length} Reused Password Groups Detected
          </div>
          <div class="report-stat-label" style="color: #FF9B9B;">
            Identical passwords used across different services. Consider updating with generated passwords.
          </div>
        </div>
      `;
      }
      reportPanel.style.display = "flex";
    }
  }
})();
