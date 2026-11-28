import SwiftUI

public struct SessionMonitorView: View {
    @ObservedObject var monitor: SessionMonitorService = .shared
    @ObservedObject var vaultStore: VaultStore = .shared
    var onSelectItem: ((String) -> Void)? = nil

    @State private var nowTick: Date = Date()
    @State private var statusBannerText: String? = nil

    public init(onSelectItem: ((String) -> Void)? = nil) {
        self.onSelectItem = onSelectItem
    }

    private let iso = ISO8601DateFormatter()

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                headerCard
                securityGuardrailStrip

                if !activeAlertsList.isEmpty {
                    alertsSection
                }

                sessionsSection

                if !monitor.auditLog.isEmpty {
                    auditSection
                }
            }
            .padding(20)
        }
        .onAppear {
            monitor.syncWithVault()
        }
        .onReceive(Timer.publish(every: 1.0, on: .main, in: .common).autoconnect()) { date in
            nowTick = date
        }
    }

    private var activeAlertsList: [SessionExpiryAlert] {
        monitor.activeAlerts.filter { !$0.dismissed }
    }

    private var headerCard: some View {
        let activeCount = monitor.trackedSessions.filter { $0.status == .active }.count
        let warnCount = monitor.trackedSessions.filter { $0.status == .expiringSoon || $0.status == .refreshing }.count
        let expiredCount = monitor.trackedSessions.filter { $0.status == .expired || $0.status == .revoked }.count

        return HStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(LiquidGlassTheme.primaryAccent.opacity(0.18))
                    .frame(width: 44, height: 44)
                Image(systemName: "clock.badge.exclamationmark.fill")
                    .font(.system(size: 19, weight: .bold))
                    .foregroundColor(LiquidGlassTheme.primaryAccent)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text("Session Expiration & Auto-Reauth")
                    .font(.system(size: 17, weight: .bold))
                Text("Monitors website cookies, web-app hooks, and OAuth token lifetimes across connected tabs.")
                    .font(.system(size: 11.5))
                    .foregroundColor(.secondary)
            }

            Spacer()

            HStack(spacing: 8) {
                summaryChip(label: "Active", count: activeCount, color: LiquidGlassTheme.emeraldAccent)
                summaryChip(label: "Expiring", count: warnCount, color: LiquidGlassTheme.amberAccent)
                summaryChip(label: "Expired", count: expiredCount, color: LiquidGlassTheme.roseAccent)
            }

            Button(action: {
                monitor.syncWithVault()
                statusBannerText = "Refreshed session watch state."
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.2) { statusBannerText = nil }
            }) {
                HStack(spacing: 5) {
                    Image(systemName: "arrow.clockwise")
                    Text("Sync")
                }
            }
            .buttonStyle(GlassCapsuleButton(isPrimary: false))
        }
        .padding(16)
        .glassEffect(cornerRadius: 14)
    }

    private var securityGuardrailStrip: some View {
        HStack(spacing: 10) {
            Image(systemName: "checkmark.shield.fill")
                .foregroundColor(LiquidGlassTheme.emeraldAccent)
                .font(.system(size: 13))

            Text("Security Policy Active: Passwords are never replayed silently unattended. Silent re-auth uses OAuth refresh rotation only within configured max lifetimes; MFA, password-only logins, and revoked tokens always fail closed to interactive prompts.")
                .font(.system(size: 11))
                .foregroundColor(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            Spacer()

            if let banner = statusBannerText {
                Text(banner)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(LiquidGlassTheme.emeraldAccent)
            }
        }
        .padding(12)
        .background(LiquidGlassTheme.emeraldAccent.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(LiquidGlassTheme.emeraldAccent.opacity(0.22), lineWidth: 1)
        )
    }

    private var alertsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("ALERTS REQUIRING ATTENTION (\(activeAlertsList.count))")
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(.secondary)

            ForEach(activeAlertsList) { alert in
                let isRevoked = alert.severity == "security_revoked"
                let isExpired = alert.severity == "expired"
                let accentColor = isRevoked || isExpired ? LiquidGlassTheme.roseAccent : LiquidGlassTheme.amberAccent

                HStack(spacing: 12) {
                    Image(systemName: isRevoked ? "exclamationmark.shield.fill" : (isExpired ? "lock.trianglebadge.exclamationmark.fill" : "timer"))
                        .font(.system(size: 16))
                        .foregroundColor(accentColor)

                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 6) {
                            Text(alert.appTitle)
                                .font(.system(size: 13, weight: .bold))
                            Text(alert.domain)
                                .font(.system(size: 11))
                                .foregroundColor(.secondary)
                        }
                        Text(alert.message)
                            .font(.system(size: 11.5))
                            .foregroundColor(.secondary)
                    }

                    Spacer()

                    if !alert.loginUrl.isEmpty {
                        Button("Open Login") {
                            monitor.openLoginUrl(alert.loginUrl)
                        }
                        .buttonStyle(GlassCapsuleButton(isPrimary: true, tintColor: accentColor))
                    }

                    Button("Dismiss") {
                        monitor.dismissAlert(id: alert.id)
                    }
                    .buttonStyle(GlassCapsuleButton(isPrimary: false))
                }
                .padding(12)
                .background(accentColor.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(accentColor.opacity(0.3), lineWidth: 1)
                )
            }
        }
        .padding(14)
        .glassEffect(cornerRadius: 14)
    }

    private var sessionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("TRACKED WEBSITE & WEB APP SESSIONS (\(monitor.trackedSessions.count))")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.secondary)
                Spacer()
                Text(vaultStore.settings.sessionMonitorEnabled ? "Monitor Running" : "Monitor Paused in Settings")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(vaultStore.settings.sessionMonitorEnabled ? LiquidGlassTheme.emeraldAccent : LiquidGlassTheme.amberAccent)
            }

            if monitor.trackedSessions.isEmpty {
                VStack(spacing: 10) {
                    Image(systemName: "safari")
                        .font(.system(size: 28))
                        .foregroundColor(.secondary.opacity(0.5))
                    Text("No active website or web app sessions tracked yet")
                        .font(.system(size: 13, weight: .semibold))
                    Text("Open any site in your browser with the Kloak extension, dispatch a `kloak:session` web-app event, or enable Session Monitor on a saved Login item.")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 460)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 32)
            } else {
                ForEach(monitor.trackedSessions) { session in
                    sessionRow(session)
                }
            }
        }
        .padding(16)
        .glassEffect(cornerRadius: 14)
    }

    private func sessionRow(_ session: TrackedSession) -> some View {
        let statusColor: Color = {
            switch session.status {
            case .active: return LiquidGlassTheme.emeraldAccent
            case .expiringSoon, .refreshing: return LiquidGlassTheme.amberAccent
            case .expired, .revoked: return LiquidGlassTheme.roseAccent
            }
        }()

        return HStack(spacing: 12) {
            Circle()
                .fill(statusColor)
                .frame(width: 9, height: 9)

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Text(session.appTitle)
                        .font(.system(size: 13, weight: .bold))
                    Text(session.domain)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundColor(.secondary)
                    Text(session.reauthMode.shortLabel)
                        .font(.system(size: 9.5, weight: .semibold))
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2)
                        .background(LiquidGlassTheme.primaryAccent.opacity(0.16))
                        .foregroundColor(LiquidGlassTheme.primaryAccent)
                        .clipShape(Capsule())
                    Text(sourceLabel(session.source))
                        .font(.system(size: 9.5, weight: .medium))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.white.opacity(0.07))
                        .foregroundColor(.secondary)
                        .clipShape(Capsule())
                }

                HStack(spacing: 12) {
                    Text(countdownLabel(for: session))
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(statusColor)
                    if let hard = session.hardDeadlineAt, let hardDate = iso.date(from: hard) {
                        Text("Hard max: \(relativeIntervalString(until: hardDate))")
                            .font(.system(size: 10.5))
                            .foregroundColor(.secondary)
                    }
                    if session.refreshCount > 0 {
                        Text("Refreshes: \(session.refreshCount)")
                            .font(.system(size: 10.5))
                            .foregroundColor(.secondary)
                    }
                }
            }

            Spacer()

            HStack(spacing: 8) {
                if session.reauthMode == .autoOAuthRefresh, session.itemId != nil {
                    Button("Refresh") {
                        Task {
                            let res = await monitor.refreshOAuthSession(sessionId: session.id)
                            statusBannerText = res.reason
                            DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) { statusBannerText = nil }
                        }
                    }
                    .buttonStyle(GlassCapsuleButton(isPrimary: false))
                }

                if !session.url.isEmpty {
                    Button("Open Site") {
                        monitor.openLoginUrl(session.url)
                    }
                    .buttonStyle(GlassCapsuleButton(isPrimary: session.status == .expired || session.status == .revoked))
                }

                if let itemId = session.itemId, let onSelect = onSelectItem {
                    Button("Policy") {
                        onSelect(itemId)
                    }
                    .buttonStyle(GlassCapsuleButton(isPrimary: false))
                }
            }
        }
        .padding(12)
        .background(Color.black.opacity(0.24))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private var auditSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("RECENT SESSION AUDIT TRAIL (REDACTED)")
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(.secondary)

            ForEach(monitor.auditLog.prefix(8)) { entry in
                HStack(spacing: 10) {
                    Text(entry.event)
                        .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                        .foregroundColor(LiquidGlassTheme.cyanAccent)
                        .frame(width: 118, alignment: .leading)
                    Text("\(entry.appTitle) (\(entry.domain))")
                        .font(.system(size: 11, weight: .semibold))
                    Text(entry.detail)
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                    Spacer()
                    Text(entry.timestamp.formatted(date: .omitted, time: .shortened))
                        .font(.system(size: 10))
                        .foregroundColor(.secondary)
                }
                .padding(.vertical, 4)
            }
        }
        .padding(14)
        .glassEffect(cornerRadius: 14)
    }

    private func summaryChip(label: String, count: Int, color: Color) -> some View {
        HStack(spacing: 4) {
            Text("\(count)")
                .font(.system(size: 11, weight: .bold))
                .foregroundColor(color)
            Text(label)
                .font(.system(size: 10.5))
                .foregroundColor(.secondary)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 4)
        .background(color.opacity(0.1))
        .clipShape(Capsule())
    }

    private func sourceLabel(_ source: SessionSignalSource) -> String {
        switch source {
        case .cookieExpiry: return "Cookie Expiry"
        case .jwtClaim: return "JWT Token"
        case .webAppHook: return "Web App SDK"
        case .http401: return "HTTP 401"
        case .loginRedirect: return "Login Redirect"
        case .itemTimer: return "Item Policy"
        case .oauthToken: return "OAuth Token"
        }
    }

    private func countdownLabel(for session: TrackedSession) -> String {
        switch session.status {
        case .revoked:
            return "Revoked — sign-in required"
        case .expired:
            return "Expired — sign-in required"
        case .refreshing:
            return "Refreshing OAuth grant…"
        case .active, .expiringSoon:
            if let exp = session.expiresAt, let d = iso.date(from: exp) {
                let sec = Int(d.timeIntervalSince(nowTick))
                if sec <= 0 { return "Expired" }
                return "Expires in \(relativeIntervalString(until: d))"
            }
            return "Active (watching redirects / 401s)"
        }
    }

    private func relativeIntervalString(until date: Date) -> String {
        let secs = max(0, Int(date.timeIntervalSince(nowTick)))
        if secs < 60 { return "\(secs)s" }
        let mins = secs / 60
        if mins < 60 { return "\(mins)m \(secs % 60)s" }
        let hrs = mins / 60
        return "\(hrs)h \(mins % 60)m"
    }
}
