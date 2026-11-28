import Foundation
import AppKit
import UserNotifications

// MARK: - Session Evaluation & Guardrail Engine

public enum SessionEvaluationDecision: String, Sendable {
    case healthy = "HEALTHY"
    case autoRefresh = "AUTO_REFRESH"
    case warnPreExpiry = "WARN_PRE_EXPIRY"
    case promptExpired = "PROMPT_EXPIRED"
    case revokeSecurity = "REVOKE_SECURITY"
}

public struct SessionEvaluationResult: Sendable {
    public let decision: SessionEvaluationDecision
    public let secondsRemaining: Int
    public let hardCapReached: Bool
    public let idleExceeded: Bool
    public let canSilentRefresh: Bool
    public let reason: String
}

public struct SessionRefreshOutcome: Sendable {
    public let ok: Bool
    public let rotated: Bool
    public let newExpiresAt: String?
    public let reuseDetected: Bool
    public let requiresPrompt: Bool
    public let reason: String
}

public struct SessionAuditEntry: Identifiable, Sendable {
    public let id = UUID().uuidString
    public let timestamp: Date
    public let appTitle: String
    public let domain: String
    public let event: String
    public let detail: String
}

@MainActor
public final class SessionMonitorService: ObservableObject {
    public static let shared = SessionMonitorService()

    @Published public private(set) var trackedSessions: [TrackedSession] = []
    @Published public private(set) var activeAlerts: [SessionExpiryAlert] = []
    @Published public private(set) var auditLog: [SessionAuditEntry] = []
    @Published public var isMonitoring: Bool = false

    private var monitorTimer: Timer?
    private var refreshLocks: Set<String> = []
    private var deliveredNotificationIds: Set<String> = []
    private let iso = ISO8601DateFormatter()

    private init() {}

    // MARK: - Lifecycle

    public func startMonitoring() {
        guard monitorTimer == nil else { return }
        isMonitoring = true
        requestNotificationAuthorizationIfBundled()
        seedFromVaultItems()
        evaluateAllSessions()

        monitorTimer = Timer.scheduledTimer(withTimeInterval: 10.0, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.evaluateAllSessions()
            }
        }
    }

    public func stopMonitoring() {
        monitorTimer?.invalidate()
        monitorTimer = nil
        isMonitoring = false
        trackedSessions.removeAll()
        activeAlerts.removeAll()
        refreshLocks.removeAll()
    }

    public func syncWithVault() {
        guard VaultStore.shared.isUnlocked else {
            stopMonitoring()
            return
        }
        if !isMonitoring {
            startMonitoring()
        } else {
            seedFromVaultItems()
            evaluateAllSessions()
        }
    }

    // MARK: - Domain & Endpoint Helpers

    public nonisolated static func extractDomain(from urlString: String) -> String {
        if let host = URL(string: urlString)?.host?.lowercased() {
            return host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
        }
        let cleaned = urlString
            .replacingOccurrences(of: "https://", with: "", options: .caseInsensitive)
            .replacingOccurrences(of: "http://", with: "", options: .caseInsensitive)
            .split(separator: "/")
            .first
            .map(String.init) ?? urlString
        let lower = cleaned.lowercased()
        return lower.hasPrefix("www.") ? String(lower.dropFirst(4)) : lower
    }

    public nonisolated static func resolveTokenEndpoint(for item: VaultItem?, policy: SessionPolicy?) -> String? {
        if let custom = policy?.tokenEndpoint?.trimmingCharacters(in: .whitespacesAndNewlines), !custom.isEmpty {
            return custom
        }
        guard let provider = item?.oauth?.provider.lowercased() else { return nil }
        switch provider {
        case "google": return "https://oauth2.googleapis.com/token"
        case "microsoft": return "https://login.microsoftonline.com/common/oauth2/v2.0/token"
        case "github": return "https://github.com/login/oauth/access_token"
        case "gitlab": return "https://gitlab.com/oauth/token"
        case "apple": return "https://appleid.apple.com/auth/token"
        case "slack": return "https://slack.com/api/oauth.v2.access"
        case "proton": return "https://account.proton.me/api/auth/refresh"
        default: return nil
        }
    }

    // MARK: - Conflict Guardrail Evaluation (Security Prioritized)

    public func evaluate(session: TrackedSession, item: VaultItem?, settings: VaultSettings, now: Date = Date()) -> SessionEvaluationResult {
        let policy = item?.sessionPolicy

        if policy?.reuseDetected == true || session.status == .revoked {
            return SessionEvaluationResult(
                decision: .revokeSecurity,
                secondsRemaining: 0,
                hardCapReached: true,
                idleExceeded: false,
                canSilentRefresh: false,
                reason: "Token reuse or revocation detected; interactive sign-in required."
            )
        }

        let startedDate = iso.date(from: session.startedAt) ?? now
        let lastActiveDate = iso.date(from: session.lastActivityAt) ?? startedDate

        let hardMaxMin = policy?.hardMaxLifetimeMinutes ?? settings.defaultHardMaxLifetimeMinutes
        let idleMaxMin = policy?.idleTimeoutMinutes ?? 0
        let warnMin = policy?.notifyLeadMinutes ?? settings.defaultSessionWarnMinutes

        let hardDeadline: Date? = {
            if let explicit = session.hardDeadlineAt, let d = iso.date(from: explicit) {
                return d
            }
            return hardMaxMin > 0 ? startedDate.addingTimeInterval(Double(hardMaxMin * 60)) : nil
        }()

        let idleDeadline: Date? = idleMaxMin > 0 ? lastActiveDate.addingTimeInterval(Double(idleMaxMin * 60)) : nil

        let hardCapReached = hardDeadline.map { now >= $0 } ?? false
        let idleExceeded = idleDeadline.map { now >= $0 } ?? false

        var expiresDate: Date? = session.expiresAt.flatMap { iso.date(from: $0) }
        if expiresDate == nil, let ttl = policy?.sessionTtlMinutes, ttl > 0 {
            let base = (session.lastRefreshedAt.flatMap { iso.date(from: $0) }) ?? startedDate
            expiresDate = base.addingTimeInterval(Double(ttl * 60))
        }

        let secondsRemaining: Int = expiresDate.map { max(0, Int($0.timeIntervalSince(now).rounded())) } ?? -1
        let isExplicitlyExpired =
            session.status == .expired ||
            session.source == .http401 ||
            session.source == .loginRedirect ||
            (expiresDate != nil && now >= expiresDate!)

        let effectiveMode = policy?.reauthMode ?? session.reauthMode
        let hasOAuthGrant = !(item?.oauth?.refreshToken ?? "").isEmpty &&
            Self.resolveTokenEndpoint(for: item, policy: policy) != nil

        // Conflict Guardrail: unattended refresh is ONLY allowed with valid OAuth refresh grant within caps
        let canSilentRefresh =
            settings.autoOAuthRefreshEnabled &&
            effectiveMode == .autoOAuthRefresh &&
            !hardCapReached &&
            !idleExceeded &&
            hasOAuthGrant

        if hardCapReached {
            return SessionEvaluationResult(
                decision: .promptExpired,
                secondsRemaining: 0,
                hardCapReached: true,
                idleExceeded: idleExceeded,
                canSilentRefresh: false,
                reason: "Maximum allowed session lifetime reached; enforcing interactive authentication."
            )
        }

        if canSilentRefresh && (isExplicitlyExpired || (secondsRemaining >= 0 && secondsRemaining <= 90)) {
            return SessionEvaluationResult(
                decision: .autoRefresh,
                secondsRemaining: max(0, secondsRemaining),
                hardCapReached: false,
                idleExceeded: false,
                canSilentRefresh: true,
                reason: "OAuth/OIDC refresh token eligible for silent rotation."
            )
        }

        if isExplicitlyExpired {
            return SessionEvaluationResult(
                decision: .promptExpired,
                secondsRemaining: 0,
                hardCapReached: false,
                idleExceeded: idleExceeded,
                canSilentRefresh: canSilentRefresh,
                reason: (effectiveMode == .autoOAuthRefresh && !hasOAuthGrant)
                    ? "Session expired without OAuth refresh token; prompting interactive login."
                    : "Session expired; interactive re-authentication required."
            )
        }

        if secondsRemaining >= 0 && secondsRemaining <= max(60, warnMin * 60) {
            return SessionEvaluationResult(
                decision: .warnPreExpiry,
                secondsRemaining: secondsRemaining,
                hardCapReached: false,
                idleExceeded: idleExceeded,
                canSilentRefresh: canSilentRefresh,
                reason: "Session expires in \(max(1, Int(ceil(Double(secondsRemaining) / 60.0))))m."
            )
        }

        return SessionEvaluationResult(
            decision: .healthy,
            secondsRemaining: secondsRemaining,
            hardCapReached: false,
            idleExceeded: idleExceeded,
            canSilentRefresh: canSilentRefresh,
            reason: "Session is active."
        )
    }

    // MARK: - Event Reporting & Vault Seeding

    public func seedFromVaultItems() {
        let store = VaultStore.shared
        guard store.isUnlocked, store.settings.sessionMonitorEnabled else { return }
        let nowIso = iso.string(from: Date())

        for item in store.items where !item.trashed {
            let hasPolicy = item.sessionPolicy?.enabled == true
            let hasOAuthExpiry = !(item.oauth?.expiresAt ?? "").isEmpty || !(item.oauth?.refreshToken ?? "").isEmpty
            guard hasPolicy || hasOAuthExpiry else { continue }

            let url = item.sessionPolicy?.loginUrl ?? item.urls.first ?? ""
            let domain = Self.extractDomain(from: url.isEmpty ? item.title : url)
            let sid = "\(domain):\(item.id)"

            if !trackedSessions.contains(where: { $0.id == sid }) {
                let policy = item.sessionPolicy
                let ttl = policy?.sessionTtlMinutes ?? store.settings.defaultSessionTtlMinutes
                var expiresAt = item.oauth?.expiresAt
                if expiresAt == nil, ttl > 0 {
                    let base = (policy?.lastAuthenticatedAt.flatMap { iso.date(from: $0) }) ?? Date()
                    expiresAt = iso.string(from: base.addingTimeInterval(Double(ttl * 60)))
                }
                let hardMax = policy?.hardMaxLifetimeMinutes ?? store.settings.defaultHardMaxLifetimeMinutes
                let started = policy?.lastAuthenticatedAt ?? nowIso
                let hardDeadline = hardMax > 0
                    ? iso.string(from: (iso.date(from: started) ?? Date()).addingTimeInterval(Double(hardMax * 60)))
                    : nil

                let session = TrackedSession(
                    id: sid,
                    itemId: item.id,
                    appTitle: BrandTitleService.cleanTitle(item.title, url: item.urls.first),
                    url: url,
                    domain: domain,
                    authMechanism: policy?.authMechanism ?? ((item.oauth?.refreshToken != nil) ? .oauth2OIDC : .cookieTimer),
                    reauthMode: policy?.reauthMode ?? .notifyOnly,
                    status: .active,
                    source: (item.oauth?.refreshToken != nil) ? .oauthToken : .itemTimer,
                    startedAt: started,
                    lastActivityAt: nowIso,
                    expiresAt: expiresAt,
                    hardDeadlineAt: hardDeadline
                )
                trackedSessions.append(session)
            }
        }
    }

    @discardableResult
    public func reportEvent(
        sessionId: String? = nil,
        itemId: String? = nil,
        appTitle: String? = nil,
        url: String,
        domain: String? = nil,
        authMechanism: SessionAuthMechanism? = nil,
        reauthMode: SessionReauthMode? = nil,
        status: SessionStatus? = nil,
        source: SessionSignalSource = .cookieExpiry,
        expiresAt: String? = nil,
        ttlSeconds: Int? = nil,
        lastActivityAt: String? = nil,
        error: String? = nil
    ) -> (session: TrackedSession, evaluation: SessionEvaluationResult) {
        let store = VaultStore.shared
        let now = Date()
        let nowIso = iso.string(from: now)
        let resolvedDomain = (domain ?? Self.extractDomain(from: url)).lowercased()

        let matchedItem = itemId.flatMap { id in store.items.first(where: { $0.id == id && !$0.trashed }) }
            ?? store.items.first(where: { item in
                !item.trashed && item.urls.contains(where: { Self.extractDomain(from: $0) == resolvedDomain })
            })

        let sid = sessionId ?? "\(resolvedDomain):\(matchedItem?.id ?? "site")"
        let existingIdx = trackedSessions.firstIndex(where: { $0.id == sid })
        let existing = existingIdx.map { trackedSessions[$0] }
        let policy = matchedItem?.sessionPolicy

        var effectiveExpires = expiresAt
        if effectiveExpires == nil, let ttl = ttlSeconds, ttl > 0 {
            effectiveExpires = iso.string(from: now.addingTimeInterval(Double(ttl)))
        } else if effectiveExpires == nil, status != .expired, let prevExp = existing?.expiresAt {
            effectiveExpires = prevExp
        } else if effectiveExpires == nil, status != .expired, let pTtl = policy?.sessionTtlMinutes, pTtl > 0 {
            effectiveExpires = iso.string(from: now.addingTimeInterval(Double(pTtl * 60)))
        }

        let startedAt: String = (status == .active && existing?.status == .expired) ? nowIso : (existing?.startedAt ?? nowIso)
        let hardMax = policy?.hardMaxLifetimeMinutes ?? store.settings.defaultHardMaxLifetimeMinutes
        let hardDeadlineAt: String? = {
            if let existingHard = existing?.hardDeadlineAt, !(status == .active && existing?.status == .expired) {
                return existingHard
            }
            guard hardMax > 0 else { return nil }
            let base = iso.date(from: startedAt) ?? now
            return iso.string(from: base.addingTimeInterval(Double(hardMax * 60)))
        }()

        var session = TrackedSession(
            id: sid,
            itemId: matchedItem?.id ?? existing?.itemId,
            appTitle: appTitle ?? (matchedItem.map { BrandTitleService.cleanTitle($0.title, url: $0.urls.first) }) ?? existing?.appTitle ?? resolvedDomain,
            url: url.isEmpty ? (existing?.url ?? matchedItem?.urls.first ?? "") : url,
            domain: resolvedDomain,
            authMechanism: authMechanism ?? policy?.authMechanism ?? existing?.authMechanism ?? .cookieTimer,
            reauthMode: reauthMode ?? policy?.reauthMode ?? existing?.reauthMode ?? .notifyOnly,
            status: status ?? existing?.status ?? .active,
            source: source,
            startedAt: startedAt,
            lastActivityAt: lastActivityAt ?? nowIso,
            expiresAt: effectiveExpires,
            hardDeadlineAt: hardDeadlineAt,
            lastRefreshedAt: existing?.lastRefreshedAt,
            refreshCount: existing?.refreshCount ?? 0,
            lastError: error
        )

        let eval = evaluate(session: session, item: matchedItem, settings: store.settings, now: now)
        switch eval.decision {
        case .revokeSecurity:
            session.status = .revoked
        case .promptExpired:
            session.status = .expired
        case .warnPreExpiry:
            session.status = .expiringSoon
        case .autoRefresh:
            session.status = .expiringSoon
        case .healthy:
            if session.status != .expired && session.status != .revoked {
                session.status = .active
            }
        }

        if let idx = existingIdx {
            trackedSessions[idx] = session
        } else {
            trackedSessions.insert(session, at: 0)
        }

        applyEvaluationSideEffects(session: session, item: matchedItem, eval: eval, nowIso: nowIso)
        return (session, eval)
    }

    public func recordHeartbeat(sessionId: String) -> TrackedSession? {
        guard let idx = trackedSessions.firstIndex(where: { $0.id == sessionId }) else { return nil }
        trackedSessions[idx].lastActivityAt = iso.string(from: Date())
        return trackedSessions[idx]
    }

    public func dismissAlert(id: String) {
        if let idx = activeAlerts.firstIndex(where: { $0.id == id }) {
            activeAlerts[idx].dismissed = true
        }
    }

    public func evaluateAllSessions() {
        let store = VaultStore.shared
        guard store.isUnlocked, store.settings.sessionMonitorEnabled else { return }
        let now = Date()
        let nowIso = iso.string(from: now)

        for idx in trackedSessions.indices {
            var session = trackedSessions[idx]
            let matchedItem = session.itemId.flatMap { id in store.items.first(where: { $0.id == id && !$0.trashed }) }
            let eval = evaluate(session: session, item: matchedItem, settings: store.settings, now: now)

            switch eval.decision {
            case .revokeSecurity:
                session.status = .revoked
            case .promptExpired:
                session.status = .expired
            case .warnPreExpiry, .autoRefresh:
                if session.status != .refreshing {
                    session.status = .expiringSoon
                }
            case .healthy:
                if session.status != .expired && session.status != .revoked {
                    session.status = .active
                }
            }
            trackedSessions[idx] = session
            applyEvaluationSideEffects(session: session, item: matchedItem, eval: eval, nowIso: nowIso)

            if eval.decision == .autoRefresh, let item = matchedItem, !refreshLocks.contains(session.id) {
                Task { @MainActor in
                    _ = await self.refreshOAuthSession(sessionId: session.id, item: item)
                }
            }
        }
    }

    private func applyEvaluationSideEffects(session: TrackedSession, item: VaultItem?, eval: SessionEvaluationResult, nowIso: String) {
        switch eval.decision {
        case .warnPreExpiry, .promptExpired, .revokeSecurity:
            let severity = eval.decision == .revokeSecurity
                ? "security_revoked"
                : (eval.decision == .promptExpired ? "expired" : "warning")
            let alertId = "\(session.id):\(severity)"
            let loginUrl = item?.sessionPolicy?.loginUrl ?? item?.urls.first ?? session.url
            let message: String = {
                switch eval.decision {
                case .revokeSecurity:
                    return "\(session.appTitle) token was revoked or reused. Interactive sign-in required."
                case .promptExpired:
                    return "\(session.appTitle) session has expired. Click to sign back in."
                default:
                    return "\(session.appTitle) session expires in \(max(1, Int(ceil(Double(eval.secondsRemaining) / 60.0))))m."
                }
            }()

            if !activeAlerts.contains(where: { $0.id == alertId }) {
                let alert = SessionExpiryAlert(
                    id: alertId,
                    sessionId: session.id,
                    itemId: session.itemId,
                    appTitle: session.appTitle,
                    domain: session.domain,
                    loginUrl: loginUrl,
                    severity: severity,
                    message: message,
                    secondsRemaining: eval.secondsRemaining,
                    createdAt: nowIso,
                    dismissed: false
                )
                activeAlerts.insert(alert, at: 0)
                appendAudit(appTitle: session.appTitle, domain: session.domain, event: severity.uppercased(), detail: message)
                sendDesktopNotificationIfNeeded(alert: alert)
            }
        case .healthy:
            activeAlerts.removeAll { $0.sessionId == session.id && !$0.dismissed }
        case .autoRefresh:
            break
        }
    }

    // MARK: - Single-Flight OAuth Refresh Token Rotation

    public func refreshOAuthSession(sessionId: String, item: VaultItem? = nil) async -> SessionRefreshOutcome {
        let store = VaultStore.shared
        guard store.isUnlocked else {
            return SessionRefreshOutcome(ok: false, rotated: false, newExpiresAt: nil, reuseDetected: false, requiresPrompt: true, reason: "Vault is locked")
        }
        guard !refreshLocks.contains(sessionId) else {
            return SessionRefreshOutcome(ok: false, rotated: false, newExpiresAt: nil, reuseDetected: false, requiresPrompt: false, reason: "Refresh already in progress")
        }

        let targetItem = item
            ?? trackedSessions.first(where: { $0.id == sessionId })?.itemId.flatMap { id in store.items.first(where: { $0.id == id && !$0.trashed }) }

        guard let resolvedItem = targetItem else {
            return SessionRefreshOutcome(ok: false, rotated: false, newExpiresAt: nil, reuseDetected: false, requiresPrompt: true, reason: "Matching vault item not found")
        }

        let session = trackedSessions.first(where: { $0.id == sessionId }) ?? TrackedSession(
            id: sessionId,
            itemId: resolvedItem.id,
            appTitle: BrandTitleService.cleanTitle(resolvedItem.title, url: resolvedItem.urls.first),
            url: resolvedItem.urls.first ?? "",
            domain: Self.extractDomain(from: resolvedItem.urls.first ?? resolvedItem.title),
            authMechanism: .oauth2OIDC,
            reauthMode: resolvedItem.sessionPolicy?.reauthMode ?? .autoOAuthRefresh,
            status: .expiringSoon,
            source: .oauthToken,
            expiresAt: resolvedItem.oauth?.expiresAt
        )

        let eval = evaluate(session: session, item: resolvedItem, settings: store.settings)
        guard eval.canSilentRefresh else {
            return SessionRefreshOutcome(ok: false, rotated: false, newExpiresAt: nil, reuseDetected: false, requiresPrompt: true, reason: eval.reason)
        }

        guard let tokenUrlStr = Self.resolveTokenEndpoint(for: resolvedItem, policy: resolvedItem.sessionPolicy),
              let tokenUrl = URL(string: tokenUrlStr),
              let refreshToken = resolvedItem.oauth?.refreshToken, !refreshToken.isEmpty else {
            return SessionRefreshOutcome(ok: false, rotated: false, newExpiresAt: nil, reuseDetected: false, requiresPrompt: true, reason: "Missing OAuth token endpoint or refresh token")
        }

        refreshLocks.insert(sessionId)
        defer { refreshLocks.remove(sessionId) }

        if let idx = trackedSessions.firstIndex(where: { $0.id == sessionId }) {
            trackedSessions[idx].status = .refreshing
        }

        do {
            var request = URLRequest(url: tokenUrl)
            request.httpMethod = "POST"
            request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
            request.setValue("application/json", forHTTPHeaderField: "Accept")
            request.timeoutInterval = 12

            var params: [String] = [
                "grant_type=refresh_token",
                "refresh_token=\(refreshToken.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? refreshToken)"
            ]
            if let clientId = resolvedItem.oauth?.clientId, !clientId.isEmpty {
                params.append("client_id=\(clientId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? clientId)")
            }
            request.httpBody = params.joined(separator: "&").data(using: .utf8)

            let (data, urlResp) = try await URLSession.shared.data(for: request)
            let httpStatus = (urlResp as? HTTPURLResponse)?.statusCode ?? 0
            let json = (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]

            if !(200...299).contains(httpStatus) || (json["access_token"] as? String ?? "").isEmpty {
                let errCode = (json["error"] as? String ?? "").lowercased()
                let isReuse = errCode == "invalid_grant" || httpStatus == 400 || httpStatus == 401

                if isReuse {
                    var updated = resolvedItem
                    updated.oauth?.accessToken = nil
                    updated.oauth?.refreshToken = nil
                    var policy = updated.sessionPolicy ?? SessionPolicy(reauthMode: .notifyOnly, authMechanism: .oauth2OIDC)
                    policy.tokenFamilyId = policy.tokenFamilyId ?? UUID().uuidString
                    policy.reuseDetected = true
                    updated.sessionPolicy = policy
                    updated.updatedAt = iso.string(from: Date())
                    store.saveItem(updated)

                    if let idx = trackedSessions.firstIndex(where: { $0.id == sessionId }) {
                        trackedSessions[idx].status = .revoked
                        trackedSessions[idx].lastError = errCode.isEmpty ? "HTTP \(httpStatus)" : errCode
                    }
                    appendAudit(appTitle: session.appTitle, domain: session.domain, event: "TOKEN_REVOKED", detail: "OAuth refresh token rejected/reused; token family cleared.")
                    return SessionRefreshOutcome(ok: false, rotated: false, newExpiresAt: nil, reuseDetected: true, requiresPrompt: true, reason: "Refresh token rejected; interactive login required.")
                }

                if let idx = trackedSessions.firstIndex(where: { $0.id == sessionId }) {
                    trackedSessions[idx].status = .expired
                    trackedSessions[idx].lastError = "HTTP \(httpStatus)"
                }
                return SessionRefreshOutcome(ok: false, rotated: false, newExpiresAt: nil, reuseDetected: false, requiresPrompt: true, reason: "Token refresh failed (HTTP \(httpStatus)).")
            }

            let newAccess = json["access_token"] as! String
            let rotatedRefresh = json["refresh_token"] as? String
            let expiresIn = (json["expires_in"] as? Int) ?? 3600
            let nowIso = iso.string(from: Date())
            let newExpiresIso = iso.string(from: Date().addingTimeInterval(TimeInterval(max(60, expiresIn))))
            let didRotate = rotatedRefresh != nil && rotatedRefresh != refreshToken

            var updated = resolvedItem
            var oauth = updated.oauth ?? OAuthDetails(provider: "custom")
            oauth.accessToken = newAccess
            oauth.refreshToken = rotatedRefresh ?? refreshToken
            oauth.expiresAt = newExpiresIso
            updated.oauth = oauth

            var policy = updated.sessionPolicy ?? SessionPolicy(reauthMode: .autoOAuthRefresh, authMechanism: .oauth2OIDC)
            policy.lastRefreshedAt = nowIso
            policy.tokenFamilyId = policy.tokenFamilyId ?? UUID().uuidString
            policy.reuseDetected = false
            updated.sessionPolicy = policy
            updated.updatedAt = nowIso
            store.saveItem(updated)

            if let idx = trackedSessions.firstIndex(where: { $0.id == sessionId }) {
                trackedSessions[idx].status = .active
                trackedSessions[idx].expiresAt = newExpiresIso
                trackedSessions[idx].lastRefreshedAt = nowIso
                trackedSessions[idx].refreshCount += 1
                trackedSessions[idx].lastError = nil
            }
            activeAlerts.removeAll { $0.sessionId == sessionId }
            appendAudit(appTitle: session.appTitle, domain: session.domain, event: "OAUTH_REFRESHED", detail: didRotate ? "Refresh token rotated cleanly." : "Access token renewed.")

            return SessionRefreshOutcome(
                ok: true,
                rotated: didRotate,
                newExpiresAt: newExpiresIso,
                reuseDetected: false,
                requiresPrompt: false,
                reason: didRotate ? "OAuth token refreshed and rotated." : "OAuth token refreshed."
            )
        } catch {
            if let idx = trackedSessions.firstIndex(where: { $0.id == sessionId }) {
                trackedSessions[idx].status = .expired
                trackedSessions[idx].lastError = error.localizedDescription
            }
            return SessionRefreshOutcome(ok: false, rotated: false, newExpiresAt: nil, reuseDetected: false, requiresPrompt: true, reason: error.localizedDescription)
        }
    }

    // MARK: - Helpers & Notifications

    private func appendAudit(appTitle: String, domain: String, event: String, detail: String) {
        auditLog.insert(SessionAuditEntry(timestamp: Date(), appTitle: appTitle, domain: domain, event: event, detail: detail), at: 0)
        if auditLog.count > 50 {
            auditLog = Array(auditLog.prefix(50))
        }
    }

    private func isRunningInAppBundle() -> Bool {
        return Bundle.main.bundlePath.hasSuffix(".app") && Bundle.main.bundleIdentifier != nil
    }

    private func requestNotificationAuthorizationIfBundled() {
        guard isRunningInAppBundle(), VaultStore.shared.settings.sessionDesktopNotificationsEnabled else { return }
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
    }

    private func sendDesktopNotificationIfNeeded(alert: SessionExpiryAlert) {
        guard isRunningInAppBundle(), VaultStore.shared.settings.sessionDesktopNotificationsEnabled else { return }
        guard !deliveredNotificationIds.contains(alert.id) else { return }
        deliveredNotificationIds.insert(alert.id)

        let content = UNMutableNotificationContent()
        content.title = alert.severity == "warning"
            ? "\(alert.appTitle) Session Expiring Soon"
            : (alert.severity == "security_revoked" ? "\(alert.appTitle) Security Re-Auth Required" : "\(alert.appTitle) Session Expired")
        content.body = alert.message
        content.sound = .default

        let req = UNNotificationRequest(identifier: "kloak.session.\(alert.id)", content: content, trigger: nil)
        UNUserNotificationCenter.current().add(req, withCompletionHandler: nil)
    }

    public func openLoginUrl(_ urlString: String) {
        var normalized = urlString.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return }
        if !normalized.lowercased().hasPrefix("http://") && !normalized.lowercased().hasPrefix("https://") {
            normalized = "https://\(normalized)"
        }
        if let url = URL(string: normalized), let scheme = url.scheme?.lowercased(), scheme == "https" || scheme == "http" {
            NSWorkspace.shared.open(url)
        }
    }
}
