import Foundation

@main
struct TestSessionMonitor {
    @MainActor
    static func main() {
        print("=== Running Session Expiration & Guardrail Tests (macOS) ===")

        let monitor = SessionMonitorService.shared
        let now = Date()
        let iso = ISO8601DateFormatter()

        // 1. Legacy VaultItem & VaultSettings backward-compatible JSON decoding
        print("\n[1] Testing Backward-Compatible Model Decoding...")
        let legacyItemJson = """
        {
          "id": "legacy-1",
          "type": "login",
          "title": "Legacy Site",
          "urls": ["https://legacy.example.com"],
          "tags": [],
          "favorite": false,
          "trashed": false,
          "createdAt": "2026-01-01T00:00:00Z",
          "updatedAt": "2026-01-01T00:00:00Z"
        }
        """.data(using: .utf8)!
        let decodedItem = try! JSONDecoder().decode(VaultItem.self, from: legacyItemJson)
        assert(decodedItem.sessionPolicy == nil, "Legacy VaultItem should decode with nil sessionPolicy")

        let legacySettingsJson = """
        {
          "autoLockMinutes": 10,
          "clearClipboardSeconds": 30,
          "biometricsEnabled": true,
          "defaultPasswordLength": 20,
          "keychainSyncEnabled": false,
          "maliciousSiteShieldEnabled": true,
          "autoMaskUntrustedSites": true,
          "threatSensitivity": "balanced",
          "smartDomainTreeEnabled": true,
          "accessibilityAutofillEnabled": true,
          "autofillHotkeyKeyCode": 42,
          "autofillHotkeyModifiers": 1048576,
          "autofillHotkeyDisplay": "⌘\\\\",
          "hardwareKeyEnabled": false,
          "hardwareKeyUnlockMode": "hardware_only",
          "ignoredHealthIssueIds": []
        }
        """.data(using: .utf8)!
        let decodedSettings = try! JSONDecoder().decode(VaultSettings.self, from: legacySettingsJson)
        assert(decodedSettings.sessionMonitorEnabled == true, "Default sessionMonitorEnabled should be true")
        assert(decodedSettings.defaultSessionWarnMinutes == 5, "Default warn minutes should be 5")
        print("✓ Backward-compatible JSON decoding passed.")

        // 2. Guardrail conflict resolution: password_mfa must never silently auto-login
        print("\n[2] Testing Conflict Guardrail (Never Replay Passwords Unattended)...")
        let passwordItem = VaultItem(
            id: "pw-1",
            type: .login,
            title: "Corporate Portal",
            username: "user@corp.com",
            password: "SecretPassword!",
            urls: ["https://portal.corp.com"],
            sessionPolicy: SessionPolicy(
                enabled: true,
                reauthMode: .autoOAuthRefresh, // Misconfigured auto mode without OAuth refresh token
                authMechanism: .passwordMFA,
                sessionTtlMinutes: 30,
                idleTimeoutMinutes: 15,
                hardMaxLifetimeMinutes: 480,
                notifyLeadMinutes: 5
            )
        )
        let expiredSession = TrackedSession(
            id: "portal.corp.com:pw-1",
            itemId: "pw-1",
            appTitle: "Corporate Portal",
            url: "https://portal.corp.com",
            domain: "portal.corp.com",
            authMechanism: .passwordMFA,
            reauthMode: .autoOAuthRefresh,
            status: .expired,
            source: .loginRedirect,
            startedAt: iso.string(from: now.addingTimeInterval(-1800)),
            lastActivityAt: iso.string(from: now),
            expiresAt: iso.string(from: now.addingTimeInterval(-10))
        )
        let evalPw = monitor.evaluate(session: expiredSession, item: passwordItem, settings: .default, now: now)
        assert(evalPw.canSilentRefresh == false, "Password-only login must never silently auto-refresh")
        assert(evalPw.decision == .promptExpired, "Expired password login must prompt interactively")
        print("✓ Password-only conflict guardrail passed.")

        // 3. OAuth refresh token eligible BEFORE hard max cap, blocked AFTER hard max cap
        print("\n[3] Testing OAuth Refresh Eligibility & Hard-Max Lifetime Cap...")
        let oauthItem = VaultItem(
            id: "oauth-1",
            type: .login,
            title: "Cloud IDE",
            username: "dev@cloud.dev",
            urls: ["https://ide.cloud.dev"],
            oauth: OAuthDetails(
                provider: "google",
                accountEmail: "dev@cloud.dev",
                accessToken: "acc-1",
                refreshToken: "ref-1",
                expiresAt: iso.string(from: now.addingTimeInterval(45))
            ),
            sessionPolicy: SessionPolicy(
                enabled: true,
                reauthMode: .autoOAuthRefresh,
                authMechanism: .oauth2OIDC,
                sessionTtlMinutes: 60,
                idleTimeoutMinutes: 30,
                hardMaxLifetimeMinutes: 480,
                notifyLeadMinutes: 5
            )
        )
        let validOAuthSession = TrackedSession(
            id: "ide.cloud.dev:oauth-1",
            itemId: "oauth-1",
            appTitle: "Cloud IDE",
            url: "https://ide.cloud.dev",
            domain: "ide.cloud.dev",
            authMechanism: .oauth2OIDC,
            reauthMode: .autoOAuthRefresh,
            status: .expiringSoon,
            source: .oauthToken,
            startedAt: iso.string(from: now.addingTimeInterval(-3600)),
            lastActivityAt: iso.string(from: now),
            expiresAt: iso.string(from: now.addingTimeInterval(45))
        )
        let evalOAuthOk = monitor.evaluate(session: validOAuthSession, item: oauthItem, settings: .default, now: now)
        assert(evalOAuthOk.canSilentRefresh == true, "Valid OAuth token inside hard cap should permit silent refresh")
        assert(evalOAuthOk.decision == .autoRefresh, "Near-expiry OAuth session should decide .autoRefresh")

        var cappedSession = validOAuthSession
        cappedSession.startedAt = iso.string(from: now.addingTimeInterval(-(9 * 3600))) // 9h > 8h max
        let evalOAuthCapped = monitor.evaluate(session: cappedSession, item: oauthItem, settings: .default, now: now)
        assert(evalOAuthCapped.hardCapReached == true, "Hard lifetime cap must be flagged")
        assert(evalOAuthCapped.canSilentRefresh == false, "Silent refresh must be blocked after hard max lifetime")
        assert(evalOAuthCapped.decision == .promptExpired, "Hard cap must force interactive prompt")
        print("✓ OAuth silent refresh & hard max lifetime cap passed.")

        // 4. Token reuse detection fails closed
        print("\n[4] Testing Refresh Token Reuse Revocation Guard...")
        var revokedItem = oauthItem
        revokedItem.sessionPolicy?.reuseDetected = true
        let evalRevoked = monitor.evaluate(session: validOAuthSession, item: revokedItem, settings: .default, now: now)
        assert(evalRevoked.decision == .revokeSecurity, "Reuse detection must force security revocation")
        assert(evalRevoked.canSilentRefresh == false, "Revoked token family must forbid silent refresh")
        print("✓ Reuse revocation guard passed.")

        print("\n✅ All SessionMonitor macOS Tests Passed!")
    }
}
