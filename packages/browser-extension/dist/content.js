"use strict";
(() => {
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

  // src/content.ts
  var shadowHost = null;
  var shadowRoot = null;
  var activePopup = null;
  var currentTargetInput = null;
  var cachedCredentialsForSite = [];
  var hasFetchedCredentials = false;
  var currentPasswordLength = 18;
  var currentGeneratedPassword = "";
  var isRevealingPasswordMap = {};
  var cachedAiEvaluation = null;
  var isAiDrawerExpanded = false;
  function pushActiveUrl() {
    chrome.runtime.sendMessage({
      type: "PUSH_ACTIVE_URL",
      url: window.location.href,
      tabId: -1
    });
  }
  window.addEventListener("load", pushActiveUrl);
  window.addEventListener("focus", pushActiveUrl);
  function isVisible(el) {
    return el.offsetParent !== null && el.getBoundingClientRect().height > 0 && window.getComputedStyle(el).visibility !== "hidden" && window.getComputedStyle(el).display !== "none";
  }
  function isSearchOrNonCredentialInput(input) {
    const type = (input.type || "").toLowerCase();
    const nonCredentialTypes = ["search", "number", "date", "datetime-local", "time", "file", "range", "color", "checkbox", "radio", "submit", "button", "reset", "image", "hidden"];
    if (nonCredentialTypes.includes(type)) return true;
    const role = (input.getAttribute("role") || "").toLowerCase();
    if (role === "search" || role === "searchbox") return true;
    const autocomplete = (input.autocomplete || "").toLowerCase();
    if (autocomplete === "off" && input.name === "q") return true;
    if (["postal-code", "country", "street-address", "cc-csc", "cc-exp"].includes(autocomplete)) return true;
    const nameIdPlaceholder = ((input.name || "") + " " + (input.id || "") + " " + (input.placeholder || "") + " " + (input.getAttribute("aria-label") || "")).toLowerCase();
    if (/user|login|email|pass|auth|usr|uid|uname|admission|roll|student/i.test(nameIdPlaceholder)) {
      return false;
    }
    const pattern = /search|query|find|filter|coupon|promo|discount|voucher|postal|zipcode|captcha|sms|cvv|cvc|comment|chat|quantity|amount|qty/i;
    if (pattern.test(nameIdPlaceholder)) {
      if (type !== "password") return true;
    }
    return false;
  }
  function isCredentialField(input) {
    if (!input || input.disabled || input.readOnly) return false;
    if (!isVisible(input)) return false;
    if (isSearchOrNonCredentialInput(input)) return false;
    const type = (input.type || "text").toLowerCase();
    const autocomplete = (input.autocomplete || "").toLowerCase();
    if (type === "password") return true;
    if (["username", "email", "current-password", "new-password"].includes(autocomplete)) return true;
    const allPasswords = Array.from(document.querySelectorAll('input[type="password"]')).filter((el) => isVisible(el));
    if (allPasswords.length > 0) {
      const textLike = ["text", "email", "tel", ""];
      if (textLike.includes(type)) return true;
    }
    const identifierPattern = /user|email|login|account|identifier|admission|roll|uid|uname|member|student|id|usr/i;
    const nameIdPlaceholder = (input.name || "") + " " + (input.id || "") + " " + (input.placeholder || "") + " " + (input.getAttribute("aria-label") || "") + " " + (input.className || "");
    if (identifierPattern.test(nameIdPlaceholder)) {
      return true;
    }
    return false;
  }
  function getAllCredentialInputs() {
    const inputs = Array.from(document.querySelectorAll("input"));
    return inputs.filter((i) => isCredentialField(i));
  }
  function scoreUsernameField(input) {
    let score = 0;
    const type = (input.type || "").toLowerCase();
    const name = (input.name || "").toLowerCase();
    const id = (input.id || "").toLowerCase();
    const autocomplete = (input.autocomplete || "").toLowerCase();
    const placeholder = (input.placeholder || "").toLowerCase();
    if (autocomplete === "username" || autocomplete === "email") score += 100;
    if (type === "email") score += 50;
    const pattern = /user|email|login|account|mail|handle|identifier/i;
    if (pattern.test(name) || pattern.test(id)) score += 30;
    if (pattern.test(placeholder)) score += 20;
    return score;
  }
  function scorePasswordField(input) {
    let score = 0;
    const autocomplete = (input.autocomplete || "").toLowerCase();
    if (input.type === "password") score += 1e3;
    if (autocomplete === "current-password" || autocomplete === "new-password") score += 100;
    return score;
  }
  function analyzeFormContext(focusedInput) {
    const form = focusedInput.form || focusedInput.closest("form") || null;
    const container = form || focusedInput.closest('div[class*="login"], div[class*="auth"]') || document.body;
    const allInputs = Array.from(container.querySelectorAll("input")).filter((el) => isVisible(el));
    const usernameFields = allInputs.filter((i) => {
      const type = (i.type || "").toLowerCase();
      return type !== "password" && type !== "hidden" && type !== "submit" && type !== "button" && type !== "checkbox" && type !== "radio" && !isSearchOrNonCredentialInput(i);
    }).sort((a, b) => scoreUsernameField(b) - scoreUsernameField(a));
    const passwordFields = allInputs.filter((i) => (i.type || "").toLowerCase() === "password").sort((a, b) => scorePasswordField(b) - scorePasswordField(a));
    const submitButtons = Array.from(container.querySelectorAll('button[type="submit"], input[type="submit"], button:not([type="button"])'));
    const isMultiStep = allInputs.length === 1;
    const isEmailFirst = usernameFields.length > 0 && passwordFields.length === 0;
    return {
      form,
      usernameFields,
      passwordFields,
      submitButtons,
      isMultiStep,
      isEmailFirst
    };
  }
  function setInputValue(input, value) {
    try {
      input.focus();
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
      if (descriptor && descriptor.set) {
        descriptor.set.call(input, value);
      } else {
        input.value = value;
      }
      const valueTracker = input._valueTracker;
      if (valueTracker) {
        valueTracker.setValue(value);
      }
      input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, composed: true, key: "a" }));
      input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, composed: true, key: "a" }));
      input.dispatchEvent(new Event("blur", { bubbles: true, composed: true }));
    } catch {
      input.value = value;
    }
  }
  function injectCredentials(username, password, targetInput, totpSecret) {
    const activeInput = targetInput || currentTargetInput || document.activeElement;
    const context = activeInput ? analyzeFormContext(activeInput) : {
      form: null,
      usernameFields: [],
      passwordFields: [],
      submitButtons: [],
      isMultiStep: false,
      isEmailFirst: false
    };
    let filledUsername = false;
    let filledPassword = false;
    let userField = context.usernameFields[0];
    let passField = context.passwordFields[0];
    if (!userField || !passField) {
      const allDocInputs = getAllCredentialInputs();
      if (!userField) {
        userField = allDocInputs.find((i) => i.type !== "password" && isCredentialField(i));
      }
      if (!passField) {
        passField = allDocInputs.find((i) => i.type === "password");
      }
    }
    if (activeInput && activeInput.type !== "password") {
      userField = activeInput;
    } else if (activeInput && activeInput.type === "password") {
      passField = activeInput;
    }
    if (username && userField) {
      setInputValue(userField, username);
      filledUsername = true;
    }
    if (password && passField) {
      setInputValue(passField, password);
      filledPassword = true;
    }
    if (targetInput) {
      if (password && !filledPassword && targetInput.type === "password") {
        setInputValue(targetInput, password);
      } else if (username && !filledUsername && targetInput.type !== "password") {
        setInputValue(targetInput, username);
      }
    }
    if (username && password) {
      showToastNotification(`\u2728 Filled username (${username}) and password!`);
    } else if (username) {
      showToastNotification(`\u{1F464} Filled username (${username})`);
    } else if (password) {
      showToastNotification(`\u{1F511} Filled password`);
    }
    handleTotpSync(totpSecret);
  }
  function handleTotpSync(totpSecret) {
    if (!totpSecret) return;
    chrome.runtime.sendMessage({ type: "GET_TOTP", secret: totpSecret }, (res) => {
      if (res && res.success && res.token) {
        try {
          navigator.clipboard.writeText(res.token);
          showToastNotification(`\u2728 Filled & copied 2FA (${res.token})!`);
        } catch {
        }
      }
    });
  }
  function ensureShadowRoot() {
    if (!shadowHost) {
      shadowHost = document.createElement("div");
      shadowHost.id = "kloak-autofill-root";
      shadowHost.style.cssText = "all: initial; position: absolute; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;";
      document.documentElement.appendChild(shadowHost);
      shadowRoot = shadowHost.attachShadow({ mode: "open" });
    }
    return shadowRoot;
  }
  function generateRandomPassword(length = 18) {
    const lower = "abcdefghijkmnopqrstuvwxyz";
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const digits = "23456789";
    const symbols = "!@#$%^&*()-_=+[]{}|;:,.<>?";
    const charset = lower + upper + digits + symbols;
    const randomBytes = new Uint8Array(length);
    crypto.getRandomValues(randomBytes);
    let pwd = "";
    for (let i = 0; i < length; i++) {
      pwd += charset[randomBytes[i] % charset.length];
    }
    return pwd;
  }
  var POPUP_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  
  .kloak-popup {
    position: fixed;
    background: #14121F;
    border: 1px solid rgba(109, 74, 255, 0.4);
    border-radius: 10px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.65), 0 0 20px rgba(109, 74, 255, 0.18);
    color: #FFFFFF;
    z-index: 2147483647;
    font-size: 12px;
    backdrop-filter: blur(20px);
    overflow: hidden;
    animation: kloakPop 0.14s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    width: 285px;
    transition: top 0.12s ease, left 0.12s ease;
  }

  @keyframes kloakPop {
    0% { opacity: 0; transform: translateY(-3px) scale(0.98); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }

  .kloak-field-badge {
    position: fixed;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    background: #14121F;
    border: 1px solid rgba(109, 74, 255, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 2147483646;
    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    transition: transform 0.15s ease, background 0.15s ease;
  }
  .kloak-field-badge:hover {
    transform: scale(1.1);
    background: #242135;
    border-color: #6D4AFF;
  }

  .kloak-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 10px;
    background: #1C1929;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .kloak-brand {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 700;
    color: #A5A1B2;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .kloak-brand-icon {
    width: 12px;
    height: 12px;
    fill: #6D4AFF;
  }

  .kloak-close-btn {
    background: transparent;
    border: none;
    color: #9E9AA8;
    cursor: pointer;
    font-size: 11px;
    line-height: 1;
    padding: 2px 4px;
    border-radius: 3px;
    transition: all 0.15s;
  }
  .kloak-close-btn:hover { color: #FFFFFF; background: rgba(255,255,255,0.12); }

  .kloak-body {
    display: flex;
    flex-direction: column;
    max-height: 380px;
    overflow-y: auto;
  }

  .kloak-section {
    display: flex;
    flex-direction: column;
  }

  .kloak-section-title {
    font-size: 9px;
    font-weight: 700;
    color: #7A758B;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 6px 10px 3px 10px;
  }

  .kloak-notice-badge {
    margin: 6px 10px 0 10px;
    padding: 4px 8px;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.35);
    border-radius: 5px;
    color: #34D399;
    font-size: 10px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  /* \u2500\u2500 Compact Account Items \u2500\u2500 */
  .kloak-card {
    padding: 6px 10px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: transparent;
    transition: background 0.15s;
  }
  .kloak-card:hover {
    background: rgba(109, 74, 255, 0.08);
  }

  .kloak-card-top {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .kloak-item-avatar {
    width: 24px;
    height: 24px;
    border-radius: 5px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }

  .kloak-item-info {
    flex: 1;
    overflow: hidden;
    cursor: pointer;
  }
  .kloak-item-username {
    font-size: 11px;
    font-weight: 600;
    color: #FFFFFF;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kloak-item-title {
    font-size: 9px;
    color: #9E9AA8;
  }

  .kloak-btn-fill {
    background: #6D4AFF;
    color: #FFFFFF;
    border: none;
    border-radius: 5px;
    padding: 3px 10px;
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    box-shadow: 0 1px 4px rgba(109, 74, 255, 0.3);
  }
  .kloak-btn-fill:hover {
    background: #7C5CFF;
    transform: scale(1.02);
  }

  .kloak-pwd-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(0,0,0,0.25);
    border-radius: 5px;
    padding: 3px 6px;
    font-size: 10px;
  }
  .kloak-pwd-label {
    color: #7A758B;
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
  }
  .kloak-pwd-value {
    font-family: 'SF Mono', 'Fira Code', monospace;
    color: #D1CFDA;
    letter-spacing: 0.5px;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 10px;
  }
  .kloak-pwd-value.revealed {
    color: #00D2B4;
    letter-spacing: 0;
  }

  .kloak-pwd-actions {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .kloak-mini-btn {
    background: transparent;
    border: none;
    color: #9E9AA8;
    cursor: pointer;
    padding: 1px 3px;
    border-radius: 3px;
    font-size: 11px;
    display: flex;
    align-items: center;
    transition: all 0.15s;
  }
  .kloak-mini-btn:hover {
    color: #FFFFFF;
    background: rgba(255,255,255,0.12);
  }

  /* \u2500\u2500 Compact Password Generator Button \u2500\u2500 */
  .kloak-gen-btn-box {
    padding: 6px 8px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    background: rgba(109, 74, 255, 0.04);
  }

  .kloak-btn-generator {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #252233;
    border: 1px solid rgba(109, 74, 255, 0.35);
    border-radius: 6px;
    padding: 6px 8px;
    color: #FFFFFF;
    cursor: pointer;
    transition: all 0.16s ease;
    font-family: inherit;
    text-align: left;
    box-sizing: border-box;
  }
  .kloak-btn-generator:hover {
    background: #2E2942;
    border-color: #6D4AFF;
    box-shadow: 0 2px 8px rgba(109, 74, 255, 0.25);
    transform: translateY(-1px);
  }
  .kloak-btn-generator:active {
    transform: translateY(0);
  }

  .kloak-gen-btn-left {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .kloak-gen-key-icon {
    width: 20px;
    height: 20px;
    border-radius: 5px;
    background: rgba(109, 74, 255, 0.2);
    color: #A78BFA;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    flex-shrink: 0;
  }
  .kloak-gen-btn-texts {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .kloak-gen-btn-title {
    font-size: 11px;
    font-weight: 600;
    color: #F3F4F6;
  }
  .kloak-gen-btn-sub {
    font-size: 9px;
    color: #9E9AA8;
  }
  .kloak-gen-btn-arrow {
    font-size: 11px;
    color: #A78BFA;
    font-weight: 600;
    opacity: 0.8;
  }

  /* \u2500\u2500 Compact AI Certificate & Owner Inspector \u2500\u2500 */
  .kloak-ai-inspector-section {
    border-bottom: 1px solid rgba(255,255,255,0.06);
    background: #181528;
  }

  .kloak-ai-toggle-btn {
    width: 100%;
    background: transparent;
    border: none;
    padding: 6px 10px;
    color: #FFFFFF;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    font-size: 10px;
    font-weight: 600;
    transition: background 0.15s;
  }
  .kloak-ai-toggle-btn:hover {
    background: rgba(109, 74, 255, 0.12);
  }

  .kloak-ai-toggle-left {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .kloak-ai-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #10B981;
    box-shadow: 0 0 5px #10B981;
  }
  .kloak-ai-dot.amber { background: #F59E0B; box-shadow: 0 0 5px #F59E0B; }
  .kloak-ai-dot.red { background: #EF4444; box-shadow: 0 0 5px #EF4444; }

  .kloak-ai-status-badge {
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 3px;
    font-weight: 700;
    background: rgba(16, 185, 129, 0.15);
    color: #34D399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }
  .kloak-ai-status-badge.amber {
    background: rgba(245, 158, 11, 0.15);
    color: #FBBF24;
    border-color: rgba(245, 158, 11, 0.3);
  }
  .kloak-ai-status-badge.red {
    background: rgba(239, 68, 68, 0.15);
    color: #F87171;
    border-color: rgba(239, 68, 68, 0.3);
  }

  .kloak-ai-drawer {
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: #131120;
    border-top: 1px solid rgba(255,255,255,0.04);
    animation: kloakPop 0.14s ease;
  }

  .kloak-ai-summary-card {
    background: rgba(109, 74, 255, 0.08);
    border: 1px solid rgba(109, 74, 255, 0.25);
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 10px;
    line-height: 1.35;
    color: #D1CFDA;
  }

  .kloak-ai-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }

  .kloak-ai-metric-card {
    background: #1C1929;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 5px;
    padding: 4px 6px;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .kloak-ai-metric-label {
    font-size: 8px;
    font-weight: 700;
    color: #7A758B;
    text-transform: uppercase;
  }
  .kloak-ai-metric-value {
    font-size: 10px;
    font-weight: 600;
    color: #FFFFFF;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .kloak-ai-chips-wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    margin-top: 1px;
  }

  .kloak-ai-chip {
    font-size: 8px;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 3px;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.25);
    color: #34D399;
  }
  .kloak-ai-chip.alert {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.25);
    color: #F87171;
  }

  /* \u2500\u2500 Compact Custom Alias Footer (ALWAYS PRESENT) \u2500\u2500 */
  .kloak-alias-footer {
    padding: 6px 10px;
    background: #181624;
    border-top: 1px solid rgba(255,255,255,0.06);
  }

  .kloak-btn-alias {
    width: 100%;
    background: rgba(0, 210, 180, 0.08);
    border: 1px solid rgba(0, 210, 180, 0.3);
    border-radius: 6px;
    padding: 5px 8px;
    color: #FFFFFF;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: all 0.15s ease;
    text-align: left;
  }
  .kloak-btn-alias:hover {
    background: rgba(0, 210, 180, 0.16);
    border-color: #00D2B4;
  }

  .kloak-alias-btn-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .kloak-alias-icon {
    font-size: 12px;
    line-height: 1;
  }

  .kloak-alias-text-wrap {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .kloak-alias-title {
    font-size: 10px;
    font-weight: 600;
    color: #00D2B4;
  }

  .kloak-alias-sub {
    font-size: 8px;
    color: #9E9AA8;
  }

  .kloak-alias-arrow {
    font-size: 11px;
    font-weight: 700;
    color: #00D2B4;
  }

  /* \u2500\u2500 Toast Notification \u2500\u2500 */
  .kloak-toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #14121F;
    border: 1px solid #10B981;
    border-radius: 6px;
    padding: 8px 12px;
    color: #FFFFFF;
    font-size: 11px;
    font-weight: 500;
    box-shadow: 0 8px 24px rgba(0,0,0,0.6);
    z-index: 2147483647;
    animation: kloakPop 0.15s ease;
  }
`;
  function showToastNotification(text) {
    const root = ensureShadowRoot();
    const existing = root.getElementById("kloak-toast-msg");
    if (existing) existing.remove();
    const toast = document.createElement("div");
    toast.id = "kloak-toast-msg";
    toast.className = "kloak-toast";
    toast.textContent = text;
    root.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3500);
  }
  function isRegistrationOrSignupPage() {
    const url = window.location.href.toLowerCase();
    const signupUrlPatterns = ["signup", "sign-up", "register", "registration", "create-account", "join", "new-user", "get-started", "enroll", "auth/register", "new_account", "password_reset", "reset_password"];
    if (signupUrlPatterns.some((p) => url.includes(p))) return true;
    const pageText = (document.title + " " + (document.querySelector('h1, h2, h3, h4, form, [role="form"], main, #app, #root')?.textContent || "")).toLowerCase();
    const signupTextPatterns = ["create account", "create your account", "create an account", "sign up", "signup", "register", "registration", "new to", "join today", "set up your password", "create new password", "new password"];
    if (signupTextPatterns.some((p) => pageText.includes(p))) return true;
    const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]')).filter((i) => isVisible(i));
    if (passwordInputs.length >= 2) return true;
    if (passwordInputs.some((p) => (p.autocomplete || "").toLowerCase() === "new-password" || (p.name || "").toLowerCase().includes("confirm") || (p.id || "").toLowerCase().includes("confirm"))) return true;
    return false;
  }
  function calculatePopupPosition(rect, estimatedHeight = 200) {
    const popupWidth = 285;
    let left = rect.left;
    if (left + popupWidth > window.innerWidth - 10) {
      left = window.innerWidth - popupWidth - 10;
    }
    if (left < 10) left = 10;
    let top = rect.bottom + 4;
    if (top + estimatedHeight > window.innerHeight && rect.top - estimatedHeight > 10) {
      top = rect.top - estimatedHeight - 4;
    }
    return { top, left };
  }
  function updateActivePopupPosition() {
    if (!activePopup || !currentTargetInput) return;
    const rect = currentTargetInput.getBoundingClientRect();
    const height = activePopup.offsetHeight || 200;
    const { top, left } = calculatePopupPosition(rect, height);
    activePopup.style.top = `${top}px`;
    activePopup.style.left = `${left}px`;
  }
  function buildPopupUI(items, input) {
    currentTargetInput = input;
    const root = ensureShadowRoot();
    if (activePopup) {
      activePopup.remove();
      activePopup = null;
    }
    const container = document.createElement("div");
    container.className = "kloak-popup";
    const rect = input.getBoundingClientRect();
    const isSignup = isRegistrationOrSignupPage();
    const { top, left } = calculatePopupPosition(rect, items.length > 0 && !isSignup ? 240 : 180);
    container.style.top = `${top}px`;
    container.style.left = `${left}px`;
    if (!root.querySelector("style")) {
      const styleTag = document.createElement("style");
      styleTag.textContent = POPUP_STYLES;
      root.appendChild(styleTag);
    }
    const hostname = window.location.hostname.replace(/^www\./, "");
    if (!currentGeneratedPassword) {
      currentGeneratedPassword = generateRandomPassword(currentPasswordLength);
    }
    const header = document.createElement("div");
    header.className = "kloak-header";
    header.innerHTML = `
    <div class="kloak-brand">
      <svg class="kloak-brand-icon" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
      <span>Kloak (${hostname})</span>
    </div>
    <button class="kloak-close-btn" id="kloak-btn-close" title="Close Popup (Esc)">\u2715</button>
  `;
    container.appendChild(header);
    header.querySelector("#kloak-btn-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      container.remove();
      activePopup = null;
    });
    const bodyContainer = document.createElement("div");
    bodyContainer.className = "kloak-body";
    if (items.length > 0 && !isSignup) {
      const savedSection = document.createElement("div");
      savedSection.className = "kloak-section";
      savedSection.innerHTML = `<div class="kloak-section-title">Saved Login${items.length > 1 ? "s" : ""}</div>`;
      items.forEach((item, idx) => {
        const card = document.createElement("div");
        card.className = "kloak-card";
        const itemId = item.id || `item-${idx}`;
        const isRevealed = !!isRevealingPasswordMap[itemId];
        const avatarLetter = (item.title || item.username || "?").charAt(0).toUpperCase();
        const domainForIcon = item.urls?.[0] ? new URL(item.urls[0]).hostname : hostname;
        const displayPassword = item.password || "";
        const maskedPassword = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
        card.innerHTML = `
        <div class="kloak-card-top">
          <div class="kloak-item-avatar"></div>
          <div class="kloak-item-info">
            <div class="kloak-item-username" title="${item.username || "No Username"}">${item.username || "No Username"}</div>
            <div class="kloak-item-title">${item.title || hostname} ${item.totpSecret ? '<span style="color: #10B981; font-weight: 600;">\u2022 2FA</span>' : ""}</div>
          </div>
          <button class="kloak-btn-fill" id="fill-btn-${itemId}">Fill</button>
        </div>

        <div class="kloak-pwd-row">
          <span class="kloak-pwd-label">Pass</span>
          <span class="kloak-pwd-value ${isRevealed ? "revealed" : ""}" id="pwd-val-${itemId}">
            ${isRevealed ? displayPassword : maskedPassword}
          </span>
          <div class="kloak-pwd-actions">
            <button class="kloak-mini-btn" id="reveal-btn-${itemId}" title="${isRevealed ? "Hide Password" : "Show Password"}">
              ${isRevealed ? "\u{1F648}" : "\u{1F441}\uFE0F"}
            </button>
            <button class="kloak-mini-btn" id="copy-pwd-btn-${itemId}" title="Copy Password">
              \u{1F4CB}
            </button>
            <button class="kloak-mini-btn" id="copy-user-btn-${itemId}" title="Copy Username">
              \u{1F464}
            </button>
          </div>
        </div>
      `;
        const avatarBox = card.querySelector(".kloak-item-avatar");
        if (avatarBox) {
          renderFavicon(avatarBox, { item, size: 24 });
        }
        card.querySelector(`#fill-btn-${itemId}`)?.addEventListener("click", (e) => {
          e.stopPropagation();
          injectCredentials(item.username, item.password, input, item.totpSecret);
          container.remove();
          activePopup = null;
        });
        card.querySelector(".kloak-item-info")?.addEventListener("click", (e) => {
          e.stopPropagation();
          injectCredentials(item.username, item.password, input, item.totpSecret);
          container.remove();
          activePopup = null;
        });
        card.querySelector(`#reveal-btn-${itemId}`)?.addEventListener("click", (e) => {
          e.stopPropagation();
          isRevealingPasswordMap[itemId] = !isRevealingPasswordMap[itemId];
          const valEl = card.querySelector(`#pwd-val-${itemId}`);
          const btnEl = card.querySelector(`#reveal-btn-${itemId}`);
          if (isRevealingPasswordMap[itemId]) {
            valEl.textContent = displayPassword;
            valEl.classList.add("revealed");
            btnEl.textContent = "\u{1F648}";
            btnEl.title = "Hide Password";
          } else {
            valEl.textContent = maskedPassword;
            valEl.classList.remove("revealed");
            btnEl.textContent = "\u{1F441}\uFE0F";
            btnEl.title = "Show Password";
          }
        });
        card.querySelector(`#copy-pwd-btn-${itemId}`)?.addEventListener("click", (e) => {
          e.stopPropagation();
          if (displayPassword) {
            navigator.clipboard.writeText(displayPassword);
            showToastNotification("\u{1F4CB} Password copied to clipboard!");
          }
        });
        card.querySelector(`#copy-user-btn-${itemId}`)?.addEventListener("click", (e) => {
          e.stopPropagation();
          if (item.username) {
            navigator.clipboard.writeText(item.username);
            showToastNotification("\u{1F464} Username copied to clipboard!");
          }
        });
        savedSection.appendChild(card);
      });
      bodyContainer.appendChild(savedSection);
    }
    if (isSignup) {
      const banner = document.createElement("div");
      banner.className = "kloak-notice-badge";
      banner.innerHTML = `<span>\u2728 Create Account Detected</span> \u2022 Fill password`;
      bodyContainer.appendChild(banner);
    }
    const genSection = document.createElement("div");
    genSection.className = "kloak-gen-btn-box";
    const genTitle = items.length === 0 ? "Generate Strong Password" : isSignup ? "New Account Password" : "Password Generator";
    genSection.innerHTML = `
    <button class="kloak-btn-generator" id="kloak-btn-open-gen" title="Open Password Generator tab in Kloak Extension">
      <div class="kloak-gen-btn-left">
        <span class="kloak-gen-key-icon">\u26A1</span>
        <div class="kloak-gen-btn-texts">
          <div class="kloak-gen-btn-title">${genTitle}</div>
          <div class="kloak-gen-btn-sub">Open Generator in Kloak App</div>
        </div>
      </div>
      <span class="kloak-gen-btn-arrow">\u2197</span>
    </button>
  `;
    bodyContainer.appendChild(genSection);
    genSection.querySelector("#kloak-btn-open-gen")?.addEventListener("click", (e) => {
      e.stopPropagation();
      try {
        chrome.runtime.sendMessage({
          type: "OPEN_EXTENSION_GENERATOR",
          domain: window.location.hostname
        });
      } catch {
      }
      container.remove();
      activePopup = null;
    });
    const aiSection = document.createElement("div");
    aiSection.className = "kloak-ai-inspector-section";
    aiSection.innerHTML = `
    <button class="kloak-ai-toggle-btn" id="kloak-ai-toggle-btn">
      <div class="kloak-ai-toggle-left">
        <span class="kloak-ai-dot" id="kloak-ai-dot"></span>
        <span>\u{1F9E0} AI Security Inspector</span>
      </div>
      <span class="kloak-ai-status-badge" id="kloak-ai-badge">Analyzing...</span>
    </button>
    <div class="kloak-ai-drawer" id="kloak-ai-drawer" style="display: ${isAiDrawerExpanded ? "flex" : "none"};">
      <div class="kloak-ai-summary-card" id="kloak-ai-summary">
        Fetching TLS certificate and domain owner records...
      </div>
      <div class="kloak-ai-grid" id="kloak-ai-grid" style="display: none;">
        <div class="kloak-ai-metric-card">
          <span class="kloak-ai-metric-label">\u{1F512} Certificate</span>
          <span class="kloak-ai-metric-value" id="kloak-ai-cert-val">-</span>
        </div>
        <div class="kloak-ai-metric-card">
          <span class="kloak-ai-metric-label">\u{1F3E2} Domain</span>
          <span class="kloak-ai-metric-value" id="kloak-ai-owner-val">-</span>
        </div>
      </div>
      <div class="kloak-ai-chips-wrap" id="kloak-ai-chips"></div>
    </div>
  `;
    bodyContainer.appendChild(aiSection);
    const toggleBtn = aiSection.querySelector("#kloak-ai-toggle-btn");
    const drawerEl = aiSection.querySelector("#kloak-ai-drawer");
    const dotEl = aiSection.querySelector("#kloak-ai-dot");
    const badgeEl = aiSection.querySelector("#kloak-ai-badge");
    const summaryEl = aiSection.querySelector("#kloak-ai-summary");
    const gridEl = aiSection.querySelector("#kloak-ai-grid");
    const certValEl = aiSection.querySelector("#kloak-ai-cert-val");
    const ownerValEl = aiSection.querySelector("#kloak-ai-owner-val");
    const chipsEl = aiSection.querySelector("#kloak-ai-chips");
    toggleBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      isAiDrawerExpanded = !isAiDrawerExpanded;
      if (drawerEl) {
        drawerEl.style.display = isAiDrawerExpanded ? "flex" : "none";
      }
    });
    const renderAiEvaluation = (evalData) => {
      if (!evalData) return;
      const isSafe = evalData.threatLevel === "VERIFIED_SAFE" || evalData.riskScore < 30;
      const isCaution = evalData.threatLevel === "CAUTION_SUSPICIOUS" || evalData.riskScore >= 30 && evalData.riskScore < 60;
      if (dotEl && badgeEl) {
        if (isSafe) {
          dotEl.className = "kloak-ai-dot";
          badgeEl.className = "kloak-ai-status-badge";
          badgeEl.textContent = "\u{1F7E2} 0% Risk \u2022 Safe";
        } else if (isCaution) {
          dotEl.className = "kloak-ai-dot amber";
          badgeEl.className = "kloak-ai-status-badge amber";
          badgeEl.textContent = `\u{1F7E1} ${evalData.riskScore}% Risk \u2022 Caution`;
        } else {
          dotEl.className = "kloak-ai-dot red";
          badgeEl.className = "kloak-ai-status-badge red";
          badgeEl.textContent = `\u{1F6A8} ${evalData.riskScore}% Risk \u2022 Threat`;
        }
      }
      if (summaryEl) {
        summaryEl.textContent = evalData.aiSummary || "Security evaluation complete.";
      }
      if (gridEl) gridEl.style.display = "grid";
      if (certValEl && evalData.certificate) {
        const certTier = evalData.certificate.validationLevel ? `(${evalData.certificate.validationLevel})` : "";
        certValEl.textContent = `${evalData.certificate.issuerOrg || evalData.certificate.issuerName || "Verified CA"} ${certTier}`;
        certValEl.title = evalData.certificateVerdict || "";
      }
      if (ownerValEl && evalData.domainIntel) {
        const ageStr = evalData.domainIntel.domainAgeYears ? `${evalData.domainIntel.domainAgeYears} yrs` : `${evalData.domainIntel.domainAgeDays}d`;
        ownerValEl.textContent = `${evalData.domainIntel.registrantOrg || evalData.domainIntel.registrarName} \u2022 ${ageStr}`;
        ownerValEl.title = evalData.ownerVerdict || "";
      }
      if (chipsEl) {
        chipsEl.innerHTML = "";
        const allChips = [...evalData.trustBadges || [], ...evalData.redFlags || []];
        allChips.forEach((chipText) => {
          const chip = document.createElement("span");
          const isRed = chipText.includes("\u{1F6A8}") || chipText.includes("\u26A0\uFE0F") || chipText.includes("discrepancy");
          chip.className = `kloak-ai-chip ${isRed ? "alert" : ""}`;
          chip.textContent = chipText;
          chipsEl.appendChild(chip);
        });
      }
    };
    if (cachedAiEvaluation) {
      renderAiEvaluation(cachedAiEvaluation);
    } else {
      chrome.runtime.sendMessage({ type: "AI_INSPECT_WEBSITE", url: window.location.href }, (res) => {
        if (res && res.evaluation) {
          cachedAiEvaluation = res.evaluation;
          renderAiEvaluation(res.evaluation);
        }
      });
    }
    const aliasSection = document.createElement("div");
    aliasSection.className = "kloak-alias-footer";
    aliasSection.innerHTML = `
    <button class="kloak-btn-alias" id="kloak-btn-custom-alias">
      <div class="kloak-alias-btn-left">
        <span class="kloak-alias-icon">\u{1F6E1}\uFE0F</span>
        <div class="kloak-alias-text-wrap">
          <div class="kloak-alias-title">Generate Custom Alias for ${hostname}</div>
          <div class="kloak-alias-sub">Masks real email \u2022 Auto-forwards to inbox</div>
        </div>
      </div>
      <span class="kloak-alias-arrow">\u2192</span>
    </button>
  `;
    aliasSection.querySelector("#kloak-btn-custom-alias")?.addEventListener("click", (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({
        type: "GENERATE_PROTECTED_ALIAS",
        url: window.location.href,
        domain: hostname
      }, (res) => {
        if (res && res.success) {
          const allInputs = Array.from(document.querySelectorAll("input")).filter((el) => isVisible(el));
          let targetField = null;
          if (input.type !== "password") {
            targetField = input;
          } else {
            const userCandidate = allInputs.find((i) => i.type !== "password" && isCredentialField(i));
            if (userCandidate) targetField = userCandidate;
          }
          if (targetField) {
            setInputValue(targetField, res.aliasEmail);
          }
          try {
            navigator.clipboard.writeText(res.aliasEmail);
          } catch {
          }
          showToastNotification(`\u{1F6E1}\uFE0F Created alias (${res.aliasEmail}) forwarding to ${res.forwardTo}!`);
          container.remove();
          activePopup = null;
        }
      });
    });
    bodyContainer.appendChild(aliasSection);
    container.appendChild(bodyContainer);
    root.appendChild(container);
    activePopup = container;
    const handleKeyDown = (e) => {
      if (!activePopup) {
        document.removeEventListener("keydown", handleKeyDown);
        return;
      }
      if (e.key === "Escape") {
        activePopup.remove();
        activePopup = null;
        document.removeEventListener("keydown", handleKeyDown);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    const handleOutsideClick = (e) => {
      const target = e.target;
      if (target !== input && !shadowHost?.contains(target)) {
        if (activePopup) {
          activePopup.remove();
          activePopup = null;
        }
        document.removeEventListener("mousedown", handleOutsideClick);
      }
    };
    setTimeout(() => {
      document.addEventListener("mousedown", handleOutsideClick);
    }, 100);
  }
  function triggerCredentialPopupForInput(input) {
    if (!isCredentialField(input)) return;
    currentTargetInput = input;
    chrome.runtime.sendMessage({ type: "GET_CREDENTIALS", url: window.location.href }, (response) => {
      if (response && Array.isArray(response.items)) {
        cachedCredentialsForSite = response.items;
      } else {
        cachedCredentialsForSite = [];
      }
      hasFetchedCredentials = true;
      buildPopupUI(cachedCredentialsForSite, input);
    });
  }
  document.addEventListener("focusin", (e) => {
    const target = e.target;
    if (target && target.tagName === "INPUT" && isCredentialField(target)) {
      triggerCredentialPopupForInput(target);
    }
  });
  document.addEventListener("click", (e) => {
    const target = e.target;
    if (target && target.tagName === "INPUT" && isCredentialField(target)) {
      triggerCredentialPopupForInput(target);
    }
  });
  function updateInFieldIcons() {
    const fields = getAllCredentialInputs();
    const root = ensureShadowRoot();
    fields.forEach((field) => {
      let fieldId = field.getAttribute("data-kloak-id");
      if (!fieldId) {
        fieldId = `field-${Math.random().toString(36).substring(2, 9)}`;
        field.setAttribute("data-kloak-id", fieldId);
      }
      let iconEl = root.getElementById(`kloak-icon-${fieldId}`);
      if (!iconEl) {
        iconEl = document.createElement("div");
        iconEl.id = `kloak-icon-${fieldId}`;
        iconEl.className = "kloak-field-badge";
        iconEl.title = "Kloak: Click to autofill or generate credentials";
        iconEl.innerHTML = `
        <svg viewBox="0 0 24 24" width="11" height="11" fill="#6D4AFF">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
        </svg>
      `;
        iconEl.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          field.focus();
          triggerCredentialPopupForInput(field);
        });
        root.appendChild(iconEl);
      }
      const rect = field.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && isVisible(field)) {
        iconEl.style.display = "flex";
        const iconSize = 18;
        const top = rect.top + (rect.height - iconSize) / 2;
        const left = rect.right - iconSize - 5;
        iconEl.style.top = `${top}px`;
        iconEl.style.left = `${left}px`;
      } else {
        iconEl.style.display = "none";
      }
    });
  }
  window.addEventListener("scroll", () => {
    if (activePopup && currentTargetInput) {
      requestAnimationFrame(updateActivePopupPosition);
    }
    requestAnimationFrame(updateInFieldIcons);
  }, { passive: true });
  window.addEventListener("resize", () => {
    if (activePopup && currentTargetInput) {
      requestAnimationFrame(updateActivePopupPosition);
    }
    requestAnimationFrame(updateInFieldIcons);
  }, { passive: true });
  function checkThreatShield() {
    chrome.runtime.sendMessage({ type: "CHECK_THREAT", url: window.location.href, includeAi: true }, (res) => {
      if (res && (res.analysis?.isSuspicious || res.aiEvaluation && res.aiEvaluation.riskScore >= 40)) {
        showThreatBanner(res.analysis, res.aiEvaluation, res.connectedAccount);
      }
    });
  }
  function showThreatBanner(analysis, aiEvaluation, connectedAccount) {
    if (document.getElementById("kloak-threat-banner")) return;
    const banner = document.createElement("div");
    banner.id = "kloak-threat-banner";
    banner.style.cssText = `
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483647;
    background: linear-gradient(135deg, rgba(24, 16, 16, 0.96), rgba(38, 20, 20, 0.96));
    border: 1px solid rgba(239, 68, 68, 0.6);
    backdrop-filter: blur(16px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(239, 68, 68, 0.25);
    border-radius: 10px;
    padding: 10px 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #f3f4f6;
    max-width: 90vw;
    width: auto;
  `;
    const domainDisplay = analysis?.targetDomain || aiEvaluation?.domain || window.location.hostname;
    const riskScore = aiEvaluation?.riskScore || analysis?.riskScore || 65;
    const certDetail = aiEvaluation?.certificate ? `Cert: ${aiEvaluation.certificate.issuerOrg}` : "";
    const domainAge = aiEvaluation?.domainIntel ? `Age: ${aiEvaluation.domainIntel.domainAgeDays}d` : "";
    const reasonSummary = aiEvaluation?.aiSummary || analysis?.reasons?.[0] || "Potential phishing or unverified login form";
    banner.innerHTML = `
    <div style="font-size: 20px; line-height: 1;">\u26A0\uFE0F</div>
    <div style="display: flex; flex-direction: column; gap: 2px;">
      <div style="font-size: 12px; font-weight: 700; color: #fca5a5; display: flex; align-items: center; gap: 6px;">
        Kloak AI Threat Shield (${domainDisplay})
        <span style="font-size: 9px; background: rgba(239, 68, 68, 0.25); border: 1px solid rgba(239, 68, 68, 0.5); padding: 1px 5px; border-radius: 99px; color: #f87171;">Risk: ${riskScore}%</span>
        ${certDetail ? `<span style="font-size: 9px; background: rgba(255,255,255,0.1); padding: 1px 5px; border-radius: 4px; color: #d1d5db;">${certDetail}</span>` : ""}
        ${domainAge ? `<span style="font-size: 9px; background: rgba(255,255,255,0.1); padding: 1px 5px; border-radius: 4px; color: #d1d5db;">${domainAge}</span>` : ""}
      </div>
      <div style="font-size: 10px; color: #d1d5db;">
        ${reasonSummary}
      </div>
    </div>
    <button id="kloak-btn-protect" style="
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      box-shadow: 0 2px 6px rgba(16, 185, 129, 0.4);
    ">\u{1F6E1}\uFE0F Masked Alias</button>
    <button id="kloak-threat-close" style="
      background: transparent;
      border: none;
      color: #9ca3af;
      font-size: 14px;
      cursor: pointer;
      padding: 3px;
    ">\u2715</button>
  `;
    document.body.appendChild(banner);
    banner.querySelector("#kloak-threat-close")?.addEventListener("click", () => {
      banner.remove();
    });
    banner.querySelector("#kloak-btn-protect")?.addEventListener("click", () => {
      chrome.runtime.sendMessage({
        type: "GENERATE_PROTECTED_ALIAS",
        url: window.location.href,
        domain: domainDisplay
      }, (res) => {
        if (res && res.success) {
          injectCredentials(res.aliasEmail, void 0, currentTargetInput || void 0);
          showToastNotification(`\u{1F6E1}\uFE0F Protected alias (${res.aliasEmail}) autofilled!`);
          banner.remove();
        }
      });
    });
  }
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "INJECT_CREDENTIALS") {
      injectCredentials(message.username, message.password);
      sendResponse({ success: true });
    } else if (message.type === "INJECT_GENERATED_PASSWORD") {
      if (message.password) {
        const pwds = Array.from(document.querySelectorAll('input[type="password"]')).filter((el) => isVisible(el));
        if (pwds.length > 0) {
          pwds.forEach((p) => setInputValue(p, message.password));
        } else if (currentTargetInput) {
          setInputValue(currentTargetInput, message.password);
        }
        showToastNotification("\u26A1 Generated password filled into page!");
      }
      sendResponse({ success: true });
    } else if (message.type === "THREAT_DETECTED") {
      showThreatBanner(message.analysis, message.aiEvaluation, message.connectedAccount);
      sendResponse({ success: true });
    }
  });
  checkThreatShield();
  var domObserver = new MutationObserver(() => {
    updateInFieldIcons();
  });
  if (document.body) {
    domObserver.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      if (document.body) {
        domObserver.observe(document.body, { childList: true, subtree: true });
      }
    });
  }
  setTimeout(updateInFieldIcons, 300);
  setTimeout(updateInFieldIcons, 1e3);
  setInterval(updateInFieldIcons, 2500);
})();
