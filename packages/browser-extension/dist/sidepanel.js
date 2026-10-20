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

  // src/sidepanel.ts
  var cachedSideItems = [];
  async function checkDirectStatus() {
    try {
      const res = await fetch("http://127.0.0.1:53152/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "vault.getItems"
        })
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.error) {
        if (data.error.message && data.error.message.includes("locked")) {
          return { isUnlocked: false };
        }
        return null;
      }
      if (Array.isArray(data.result)) {
        return { isUnlocked: true, items: data.result };
      }
      return null;
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
      if (!res.ok) {
        return { success: false, error: "Could not connect to Kloak daemon" };
      }
      const data = await res.json();
      if (data.error) {
        return { success: false, error: data.error.message || "Incorrect master password" };
      }
      if (data.result && (data.result.success || data.result.status?.isUnlocked)) {
        return { success: true };
      }
      return { success: false, error: "Unlock failed" };
    } catch (err) {
      return { success: false, error: err.message };
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
  document.addEventListener("DOMContentLoaded", () => {
    const unlockView = document.getElementById("side-unlock-view");
    const unlockedView = document.getElementById("side-unlocked-view");
    const unlockForm = document.getElementById("side-unlock-form");
    const pwdInput = document.getElementById("side-unlock-password");
    const togglePwdBtn = document.getElementById("btn-side-toggle-pwd");
    const eyeIcon = document.getElementById("side-eye-icon");
    const unlockError = document.getElementById("side-unlock-error");
    const submitBtn = document.getElementById("btn-side-submit-unlock");
    const submitBtnText = document.getElementById("side-unlock-btn-text");
    const spinner = document.getElementById("side-unlock-spinner");
    const lockBtn = document.getElementById("btn-side-lock");
    const searchInput = document.getElementById("side-search");
    const container = document.getElementById("side-items");
    togglePwdBtn?.addEventListener("click", () => {
      const isPassword = pwdInput.type === "password";
      pwdInput.type = isPassword ? "text" : "password";
      if (eyeIcon) {
        eyeIcon.innerHTML = isPassword ? '<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.44-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>' : '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>';
      }
    });
    const showLocked = () => {
      if (unlockView) unlockView.style.display = "flex";
      if (unlockedView) unlockedView.style.display = "none";
      if (lockBtn) lockBtn.style.display = "none";
      if (unlockError) unlockError.style.display = "none";
      if (pwdInput) {
        pwdInput.value = "";
        setTimeout(() => pwdInput.focus(), 60);
      }
    };
    const showUnlocked = (items) => {
      if (unlockView) unlockView.style.display = "none";
      if (unlockedView) unlockedView.style.display = "flex";
      if (lockBtn) lockBtn.style.display = "flex";
      cachedSideItems = items;
      renderItems(items);
    };
    const renderItems = (items) => {
      if (!container) return;
      container.innerHTML = "";
      if (items.length === 0) {
        container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
          <span>No passwords found</span>
        </div>
      `;
        return;
      }
      items.forEach((item) => {
        const card = document.createElement("div");
        card.className = "item-card";
        card.innerHTML = `
        <div class="item-top">
          <div class="item-title-group">
            <div class="item-favicon-box"></div>
            <div style="overflow: hidden;">
              <div class="item-title">${item.title || "Untitled"}</div>
              <div class="item-username">${item.username || "No username"}</div>
            </div>
          </div>
        </div>
        <div class="item-actions">
          <button class="btn-card-action btn-fill" data-id="${item.id}" title="Autofill credentials">
            <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            <span>Fill</span>
          </button>
          <button class="btn-card-action btn-copy-user" title="Copy username">
            <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
            <span>User</span>
          </button>
          <button class="btn-card-action btn-copy-pwd" title="Copy password">
            <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
            <span>Pass</span>
          </button>
        </div>
      `;
        const favBox = card.querySelector(".item-favicon-box");
        if (favBox) {
          renderFavicon(favBox, { item, size: 28 });
        }
        card.querySelector(".btn-fill")?.addEventListener("click", async (e) => {
          e.stopPropagation();
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, {
              type: "INJECT_CREDENTIALS",
              username: item.username || "",
              password: item.password || ""
            });
          }
          const btn = card.querySelector(".btn-fill");
          if (btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = "<span>Filled!</span>";
            setTimeout(() => {
              btn.innerHTML = orig;
            }, 1200);
          }
        });
        card.querySelector(".btn-copy-user")?.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (item.username) {
            await navigator.clipboard.writeText(item.username);
            const btn = card.querySelector(".btn-copy-user");
            if (btn) {
              const orig = btn.innerHTML;
              btn.innerHTML = "<span>Copied!</span>";
              setTimeout(() => {
                btn.innerHTML = orig;
              }, 1200);
            }
          }
        });
        card.querySelector(".btn-copy-pwd")?.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (item.password) {
            await navigator.clipboard.writeText(item.password);
            const btn = card.querySelector(".btn-copy-pwd");
            if (btn) {
              const orig = btn.innerHTML;
              btn.innerHTML = "<span>Copied!</span>";
              setTimeout(() => {
                btn.innerHTML = orig;
              }, 1200);
            }
          }
        });
        container.appendChild(card);
      });
    };
    const loadVault = async () => {
      const direct = await checkDirectStatus();
      if (direct) {
        if (direct.isUnlocked) {
          showUnlocked(direct.items || []);
          return;
        } else {
          showLocked();
          return;
        }
      }
      chrome.runtime.sendMessage({ type: "SEARCH_VAULT", query: "" }, (res) => {
        if (res && res.isUnlocked) {
          showUnlocked(res.items || []);
        } else {
          showLocked();
        }
      });
    };
    unlockForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const password = pwdInput?.value || "";
      if (!password) {
        if (unlockError) {
          unlockError.textContent = "Please enter your master password.";
          unlockError.style.display = "block";
        }
        return;
      }
      if (submitBtn) submitBtn.disabled = true;
      if (submitBtnText) submitBtnText.textContent = "Unlocking...";
      if (spinner) spinner.style.display = "inline-block";
      if (unlockError) unlockError.style.display = "none";
      try {
        let success = false;
        let errMsg = "";
        const directRes = await unlockVaultDirect(password);
        if (directRes.success) {
          success = true;
        } else {
          errMsg = directRes.error || "";
          const bgRes = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: "UNLOCK_VAULT", password }, (response) => {
              resolve(response);
            });
          });
          if (bgRes && bgRes.success) {
            success = true;
          } else if (bgRes && bgRes.error) {
            errMsg = bgRes.error;
          }
        }
        if (success) {
          if (pwdInput) pwdInput.value = "";
          await loadVault();
        } else {
          if (unlockError) {
            unlockError.textContent = errMsg || "Incorrect master password. Please try again.";
            unlockError.style.display = "block";
          }
          if (pwdInput) {
            pwdInput.select();
            pwdInput.focus();
          }
        }
      } catch (err) {
        if (unlockError) {
          unlockError.textContent = err.message || "Unlock failed. Ensure Kloak is running.";
          unlockError.style.display = "block";
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (submitBtnText) submitBtnText.textContent = "Unlock Vault";
        if (spinner) spinner.style.display = "none";
      }
    });
    lockBtn?.addEventListener("click", async () => {
      await lockVaultDirect();
      chrome.runtime.sendMessage({ type: "LOCK_VAULT" }).catch(() => null);
      cachedSideItems = [];
      showLocked();
    });
    searchInput?.addEventListener("input", () => {
      const q = searchInput.value.toLowerCase().trim();
      if (!q) {
        renderItems(cachedSideItems);
        return;
      }
      const filtered = cachedSideItems.filter(
        (item) => (item.title || "").toLowerCase().includes(q) || (item.username || "").toLowerCase().includes(q) || (item.urls || []).some((u) => u.toLowerCase().includes(q))
      );
      renderItems(filtered);
    });
    loadVault();
  });
})();
