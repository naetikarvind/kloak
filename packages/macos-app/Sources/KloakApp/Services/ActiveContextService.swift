import Foundation
import AppKit

public struct ActiveContext: Sendable {
    public let appName: String
    public let bundleIdentifier: String?
    public let activeDomain: String?
    public let activeUrl: String?

    public var isBrowser: Bool {
        guard let bundleId = bundleIdentifier?.lowercased() else { return false }
        return bundleId.contains("chrome") ||
               bundleId.contains("safari") ||
               bundleId.contains("brave") ||
               bundleId.contains("edge") ||
               bundleId.contains("arc") ||
               bundleId.contains("firefox") ||
               bundleId.contains("opera")
    }

    public var displayContext: String {
        if let domain = activeDomain, !domain.isEmpty {
            return domain
        }
        return appName
    }
}

public final class ActiveContextService: @unchecked Sendable {
    public static let shared = ActiveContextService()

    private init() {}

    /// Detects the user's active frontmost application and browser URL.
    public func getActiveContext() -> ActiveContext {
        // Find frontmost application that is not Kloak itself
        let runningApps = NSWorkspace.shared.runningApplications
        let nonKloakApps = runningApps.filter {
            $0.isActive &&
            $0.bundleIdentifier != Bundle.main.bundleIdentifier &&
            $0.bundleIdentifier != "app.kloak.macos" &&
            $0.activationPolicy == .regular
        }

        guard let frontApp = nonKloakApps.first ?? NSWorkspace.shared.frontmostApplication else {
            return ActiveContext(appName: "Finder", bundleIdentifier: "com.apple.finder", activeDomain: nil, activeUrl: nil)
        }

        let appName = frontApp.localizedName ?? "App"
        let bundleId = frontApp.bundleIdentifier?.lowercased() ?? ""

        var activeUrl: String? = nil
        var activeDomain: String? = nil

        // Query active tab URL for Chromium-based browsers & Safari via AppleScript
        if bundleId.contains("chrome") || bundleId.contains("brave") || bundleId.contains("edge") || bundleId.contains("arc") || bundleId.contains("chromium") {
            let scriptSource = """
            tell application id "\(frontApp.bundleIdentifier!)"
                if (count of windows) > 0 then
                    return URL of active tab of front window
                end if
            end tell
            """
            activeUrl = executeAppleScript(scriptSource)
        } else if bundleId.contains("safari") {
            let scriptSource = """
            tell application "Safari"
                if (count of windows) > 0 then
                    return URL of front document
                end if
            end tell
            """
            activeUrl = executeAppleScript(scriptSource)
        }

        if let rawUrl = activeUrl, !rawUrl.isEmpty, let urlObj = URL(string: rawUrl), let host = urlObj.host {
            activeDomain = host.replacingOccurrences(of: "www.", with: "").lowercased()
        }

        return ActiveContext(
            appName: appName,
            bundleIdentifier: frontApp.bundleIdentifier,
            activeDomain: activeDomain,
            activeUrl: activeUrl
        )
    }

    /// Finds matching vault items for the active context using strict eTLD+1-based matching.
    /// NEVER falls back to title-keyword matching — an item must have a URL that shares the
    /// same registrable domain (eTLD+1) as the active browser page.
    public func findSmartSuggestions(in items: [VaultItem], context: ActiveContext) -> [VaultItem] {
        let activeItems = items.filter { !$0.trashed }
        var suggestions: [(item: VaultItem, score: Int)] = []

        for item in activeItems {
            var score = 0

            // ── 1. Browser Domain Matching (Strict eTLD+1) ──
            if let activeUrl = context.activeUrl, !activeUrl.isEmpty {
                let pageRD = registrableDomain(from: activeUrl)
                let pageHost = URL(string: activeUrl)?.host?.lowercased()

                for itemUrl in item.urls {
                    let itemHost = URL(string: itemUrl)?.host?.lowercased() ?? ""
                    let itemRD = registrableDomain(from: itemUrl)

                    // Exact full-host match (e.g. api.github.com == api.github.com)
                    if let ph = pageHost, ph == itemHost {
                        score = max(score, 100)
                        continue
                    }
                    // eTLD+1 match (e.g. github.com stored, login.github.com visited)
                    if let prd = pageRD, let ird = itemRD, prd == ird {
                        score = max(score, 80)
                        continue
                    }
                    // NEVER use title fuzzy matching as a suggestion qualifier
                }
            }

            // ── 2. Native Desktop App Match (non-browser: Slack, Figma, etc.) ──
            if !context.isBrowser || context.activeDomain == nil {
                let cleanAppName = context.appName.lowercased().replacingOccurrences(of: ".app", with: "")
                // App name must appear in item title or tags (no URL needed for native apps)
                if item.title.lowercased() == cleanAppName || cleanAppName.contains(item.title.lowercased()) {
                    score = max(score, 60)
                }
                if item.tags.contains(where: { $0.lowercased() == cleanAppName }) {
                    score = max(score, 40)
                }
            }

            // ── 3. Quality Boosts ──
            if score > 0 {
                if item.favorite { score += 20 }
                if !item.updatedAt.isEmpty { score += 10 }
                suggestions.append((item, score))
            }
        }

        // Sort by relevance descending
        return suggestions.sorted { $0.score > $1.score }.map { $0.item }
        // NOTE: No fallback to favorites/all-items when there are no URL matches.
        // An empty result means "no credentials for this site" — show that clearly.
    }

    private func executeAppleScript(_ source: String) -> String? {
        guard let script = NSAppleScript(source: source) else { return nil }
        var error: NSDictionary?
        let result = script.executeAndReturnError(&error)
        if error == nil {
            return result.stringValue
        }
        return nil
    }
}
