import Foundation

@main
struct TestDuplicateDetector {
    static func main() {
        print("=== Running Duplicate Detection & Resolution Tests ===")
        let service = DuplicateDetectorService.shared

        // Test 1: Domain & Service Normalization
        print("\n[1] Testing Normalization...")
        assert(service.normalizeDomain("https://www.google.com/login?foo=bar#hash") == "google.com", "Failed normalizeDomain https www")
        assert(service.normalizeDomain("http://github.com:443/repo") == "github.com", "Failed normalizeDomain port")
        assert(service.normalizeDomain("apple.com") == "apple.com", "Failed normalizeDomain plain")
        assert(service.normalizeService("Google Inc.com") == "google inc", "Failed normalizeService")
        assert(service.normalizeUsername(" Naetik.Arvind@gmail.com ") == "naetik.arvind@gmail.com", "Failed normalizeUsername")
        print("✓ Normalization tests passed.")

        // Test 2: In-Vault Exact vs Conflicting Duplicate Detection
        print("\n[2] Testing In-Vault Duplicate Detection...")
        let item1 = VaultItem(
            id: "id_1",
            title: "GitHub",
            username: "naetik",
            password: "password123",
            urls: ["https://github.com/login"]
        )
        let item2 = VaultItem(
            id: "id_2",
            title: "GitHub.com",
            username: "naetik",
            password: "password123", // Exact match
            urls: ["https://github.com"]
        )
        let item3 = VaultItem(
            id: "id_3",
            title: "Google",
            username: "user@gmail.com",
            password: "oldPassword",
            urls: ["https://accounts.google.com"]
        )
        let item4 = VaultItem(
            id: "id_4",
            title: "Google Accounts",
            username: "user@gmail.com",
            password: "newPassword999", // Conflict!
            urls: ["https://google.com"]
        )
        let uniqueItem = VaultItem(
            id: "id_5",
            title: "Slack",
            username: "work@corp.com",
            password: "uniquePassword!",
            urls: ["https://slack.com"]
        )

        let vault = [item1, item2, item3, item4, uniqueItem]
        let duplicateGroups = service.findDuplicateAccounts(in: vault)

        assert(duplicateGroups.count == 2, "Expected 2 duplicate groups, got \(duplicateGroups.count)")
        let exactGroup = duplicateGroups.first(where: { $0.isExactMatch })
        let conflictGroup = duplicateGroups.first(where: { !$0.isExactMatch })

        assert(exactGroup != nil, "Expected an exact match group")
        assert(exactGroup?.items.count == 2, "Exact match group should contain 2 items")
        assert(conflictGroup != nil, "Expected a conflicting duplicate group")
        assert(conflictGroup?.items.count == 2, "Conflict group should contain 2 items")
        print("✓ In-Vault duplicate detection passed.")

        // Test 3: Reused Passwords Detection
        print("\n[3] Testing Reused Passwords Detection...")
        let reused1 = VaultItem(id: "r1", title: "Amazon", username: "u1", password: "SharedSecretPassword123")
        let reused2 = VaultItem(id: "r2", title: "Netflix", username: "u2", password: "SharedSecretPassword123")
        let reused3 = VaultItem(id: "r3", title: "Spotify", username: "u3", password: "SharedSecretPassword123")
        let nonReused = VaultItem(id: "r4", title: "Bank", username: "u4", password: "BankOnlyPassword!456")

        let reusedGroups = service.findReusedPasswords(in: [reused1, reused2, reused3, nonReused])
        assert(reusedGroups.count == 1, "Expected 1 reused group, got \(reusedGroups.count)")
        assert(reusedGroups[0].items.count == 3, "Expected 3 items in reused password group")
        assert(reusedGroups[0].password == "SharedSecretPassword123", "Password mismatch in reused group")
        print("✓ Reused passwords detection passed.")

        // Test 4: Smart Merging
        print("\n[4] Testing Smart Merging...")
        let primaryItem = VaultItem(
            id: "base_1",
            title: "Proton",
            username: "user@pm.me",
            password: "protonPassword!",
            urls: ["https://proton.me"],
            notes: "Personal Proton account",
            tags: ["personal"],
            favorite: false
        )
        let secondaryItem = VaultItem(
            id: "base_2",
            title: "ProtonMail",
            username: "user@pm.me",
            password: "protonPassword!",
            urls: ["https://mail.proton.me"],
            notes: "Recovery email verified",
            totpSecret: "JBSWY3DPEHPK3PXP",
            tags: ["email", "privacy"],
            favorite: true
        )

        let (merged, trashedIds) = service.smartMerge(items: [primaryItem, secondaryItem])
        assert(trashedIds.count == 1, "Expected 1 item marked for trash")
        assert(trashedIds.contains("base_1") || trashedIds.contains("base_2"), "One of the items should be marked for trash")
        assert(!trashedIds.contains(merged.id), "Merged item should not be in trashed list")
        assert(merged.password == "protonPassword!", "Password should be preserved")
        assert(merged.totpSecret == "JBSWY3DPEHPK3PXP", "TOTP secret from secondary item should be merged")
        assert(merged.urls.contains("https://proton.me") && merged.urls.contains("https://mail.proton.me"), "Both URLs should be merged")
        assert(merged.tags.contains("personal") && merged.tags.contains("email") && merged.tags.contains("privacy"), "All tags should be merged")
        assert(merged.favorite == true, "Favorite flag should be true if any item was favorite")
        assert(merged.notes?.contains("Recovery email verified") == true, "Secondary notes should be merged")
        print("✓ Smart merging tests passed.")

        // Test 5: File vs Vault Duplicate Comparison
        print("\n[5] Testing File vs Vault Duplicate Comparison...")
        let fileExact = VaultItem(title: "GitHub", username: "naetik", password: "password123", urls: ["https://github.com"])
        let fileConflict = VaultItem(title: "Google", username: "user@gmail.com", password: "brandNewPassword2026", urls: ["https://google.com"])
        let fileNew = VaultItem(title: "Linear", username: "naetik@kloak.app", password: "linearStrongPassword", urls: ["https://linear.app"])

        let comparison = service.compareFileWithVault(
            fileItems: [fileExact, fileConflict, fileNew],
            vaultItems: vault,
            fileName: "export.csv"
        )

        assert(comparison.items.count == 3, "Comparison should contain 3 items")
        assert(comparison.newCount == 1, "Expected 1 new item, got \(comparison.newCount)")
        assert(comparison.exactMatchCount == 1, "Expected 1 exact match, got \(comparison.exactMatchCount)")
        assert(comparison.conflictCount == 1, "Expected 1 conflict, got \(comparison.conflictCount)")
        print("✓ File vs Vault comparison passed.")

        // Test 6: Import Resolution Strategies
        print("\n[6] Testing Resolution Strategies...")
        // 6A: Update Existing
        let (toAddUpdate, toUpdateUpdate) = service.resolveImport(
            comparison: comparison,
            globalStrategy: .updateExisting,
            overrides: [:]
        )
        assert(toAddUpdate.count == 1 && toAddUpdate[0].title == "Linear", "New item should be added")
        assert(toUpdateUpdate.contains(where: { $0.title == "Google" && $0.password == "brandNewPassword2026" }), "Conflicted vault item should be updated with new password")
        assert(toUpdateUpdate.contains(where: { $0.title == "GitHub" && $0.urls.contains("https://github.com") }), "Exact match should be enriched with new URL")

        // 6B: Skip Duplicates
        let (toAddSkip, toUpdateSkip) = service.resolveImport(
            comparison: comparison,
            globalStrategy: .skipDuplicate,
            overrides: [:]
        )
        assert(toAddSkip.count == 1 && toAddSkip[0].title == "Linear", "Only new item should be added")
        assert(toUpdateSkip.isEmpty, "No vault items should be modified when skipping duplicates")

        // 6C: Keep Both
        let (toAddBoth, toUpdateBoth) = service.resolveImport(
            comparison: comparison,
            globalStrategy: .keepBoth,
            overrides: [:]
        )
        assert(toAddBoth.count == 3, "Keep both should add all 3 items (including copies of duplicates)")
        assert(toAddBoth.contains(where: { $0.title.contains("(Imported)") }), "Duplicate items should have (Imported) suffix")
        assert(toUpdateBoth.isEmpty, "Original vault items untouched in keep both mode")
        print("✓ Import resolution strategies passed.")

        // Test 7: Smart Credential Understander & Strict Cross-Type Combiner
        print("\n[7] Testing Smart Credential Understander & Strict Cross-Type Combiner...")
        let understander = SmartCredentialUnderstander.shared
        let combiner = CredentialCombinerService.shared

        let ghLogin = VaultItem(
            id: "gh-login",
            type: .login,
            title: "GitHub",
            username: "naetik.arvnd@gmail.com",
            password: "ghStrongPassword!",
            urls: ["https://github.com/login"]
        )
        let ghSecondLogin = VaultItem(
            id: "gh-login-2",
            type: .login,
            title: "GitHub Work",
            username: "naetik.work@company.com",
            password: "workPassword!",
            urls: ["https://github.com"]
        )
        let ghRecovery = VaultItem(
            id: "gh-rec",
            type: .secureNote,
            title: "github recovery code",
            notes: "9b7c4e99\n4114fe8a\n8098ddd4\nad031734"
        )
        let ghAuth = VaultItem(
            id: "gh-auth",
            type: .authenticator,
            title: "GitHub 2FA",
            username: "naetik.arvnd@gmail.com",
            totpSecret: "JBSWY3DPEHPK3PXP"
        )
        let ghAuthDuplicate = VaultItem(
            id: "gh-auth-2",
            type: .authenticator,
            title: "GitHub Authenticator",
            totpSecret: "GEZDGNBVGY3TQOJQ"
        )
        let ghLoginWithTotp = VaultItem(
            id: "gh-login-totp",
            type: .login,
            title: "GitHub",
            username: "naetik.arvnd@gmail.com",
            password: "ghStrongPassword!",
            totpSecret: "JBSWY3DPEHPK3PXP"
        )

        // Same-type combinations MUST be rejected
        assert(!understander.validateCombination([ghLogin, ghSecondLogin]).isAllowed, "Must forbid Login + Login")
        assert(!understander.validateCombination([ghAuth, ghAuthDuplicate]).isAllowed, "Must forbid Authenticator + Authenticator")
        assert(!understander.validateCombination([ghLoginWithTotp, ghAuth]).isAllowed, "Must forbid Login (already with 2FA) + Authenticator")
        assert(!understander.canAddItem(ghSecondLogin, to: [ghLogin]).isAllowed, "Picker must disable second Login")

        // Different-type combinations MUST be allowed & smart-matched
        assert(understander.validateCombination([ghLogin, ghRecovery]).isAllowed, "Must allow Login + Recovery Code")
        assert(understander.validateCombination([ghLogin, ghAuth, ghRecovery]).isAllowed, "Must allow Login + Authenticator + Recovery Code")
        assert(understander.validateCombination([ghLoginWithTotp, ghRecovery]).isAllowed, "Must allow Login (with 2FA) + Recovery Code")

        let ghMatch = understander.match(ghLogin, ghRecovery)
        assert(ghMatch != nil && ghMatch!.confidence >= 0.90, "Must smart-match 'GitHub' with 'github recovery code'")

        let groups = combiner.findCombinableGroups(in: [ghLogin, ghSecondLogin, ghRecovery, ghAuth])
        assert(groups.count == 1, "Should produce exactly 1 combinable cross-type group, got \(groups.count)")
        assert(!groups[0].allItems.contains(where: { $0.id == ghSecondLogin.id }), "Must never pull a second Login into combinable group")
        assert(groups[0].hasLogin && groups[0].hasAuthenticator && groups[0].hasRecoveryCodes, "Group must contain Login + Authenticator + Recovery Codes")

        let recs = combiner.findRecommendedCombinations(in: [ghLogin, ghSecondLogin, ghRecovery, ghAuth])
        assert(recs.count == 1 && recs[0].tier == .strong && !recs[0].reasons.isEmpty, "Smart Recommender should produce 1 Strong Match recommendation with explanations")

        let companions = combiner.recommendCompanions(for: [ghLogin], in: [ghLogin, ghSecondLogin, ghRecovery, ghAuth])
        assert(companions.count == 2, "Companion recommender should recommend Authenticator + Recovery (never second Login), got \(companions.count)")
        assert(!companions.contains(where: { $0.item.id == ghSecondLogin.id }), "Companion recommender must exclude same-type items")

        // Test 8: Smart Understander Integration in Import Comparison & Resolution
        print("\n[8] Testing Smart Understander Import Consolidation...")
        let importedRecovery = KeychainManager.createSecureNoteFromText(
            content: "9b7c4e99\n4114fe8a\n8098ddd4\nad031734",
            filename: "github-recovery-codes.txt"
        )
        assert(importedRecovery.isRecoveryCode, "Text file should be classified as recovery codes")
        assert(importedRecovery.tags.contains("Recovery Codes") && importedRecovery.tags.contains("2FA"), "createSecureNoteFromText must preserve Recovery Codes & 2FA tags")

        let smartComparison = service.compareFileWithVault(
            fileItems: [importedRecovery],
            vaultItems: [ghLogin],
            fileName: "github-recovery-codes.txt"
        )
        assert(smartComparison.smartCombineCount == 1, "Expected 1 smartCombine item, got \(smartComparison.smartCombineCount)")

        let (smartAdd, smartUpdate) = service.resolveImport(
            comparison: smartComparison,
            globalStrategy: .updateExisting,
            overrides: [:]
        )
        assert(smartAdd.isEmpty, "Smart combine should update existing login rather than creating orphan note")
        assert(smartUpdate.count == 1 && smartUpdate[0].id == ghLogin.id, "Should merge recovery codes into existing GitHub login")
        assert(smartUpdate[0].isRecoveryCode && smartUpdate[0].recoveryCodesList.count == 4, "Merged login should carry all 4 recovery codes")

        // Redundant re-import of identical recovery codes should match existing merged item as exactMatch
        let mergedGh = smartUpdate[0]
        let redundantComp = service.compareFileWithVault(
            fileItems: [importedRecovery],
            vaultItems: [mergedGh],
            fileName: "github-recovery-codes.txt"
        )
        assert(redundantComp.exactMatchCount == 1 && redundantComp.newCount == 0, "Redundant recovery codes import should be detected as exactMatch, not new")

        // Brand-ecosystem duplicate (Proton with mail.proton.me + TOTP + codes vs Proton duplicate with empty URL + codes)
        let protonPrimary = VaultItem(
            id: "proton-1",
            type: .login,
            title: "Proton",
            username: "naetik.arvind@protonmail.com",
            password: "ProtonPassword1!",
            urls: ["https://mail.proton.me"],
            notes: "9b7c4e99\n4114fe8a\n8098ddd4",
            totpSecret: "JBSWY3DPEHPK3PXP",
            tags: ["Recovery Codes", "2FA"]
        )
        let protonDup = VaultItem(
            id: "proton-2",
            type: .login,
            title: "Proton",
            username: "naetik.arvind@protonmail.com",
            notes: "9b7c4e99\n4114fe8a\n8098ddd4",
            tags: ["Recovery Codes"]
        )
        let protonDups = service.findDuplicateAccounts(in: [protonPrimary, protonDup])
        assert(protonDups.count == 1 && protonDups[0].items.count == 2, "DuplicateDetector must catch brand-ecosystem Proton duplicates")
        let (mergedProton, _) = service.smartMerge(items: [protonPrimary, protonDup])
        assert(mergedProton.recoveryCodesList.count == 3, "smartMerge must not duplicate recovery codes in notes")

        // Github login with hyphenated 16 recovery codes (like 3eb11-073ab) & combined Proton must both classify as recovery codes
        let githubWithHyphenCodes = VaultItem(
            id: "gh-hyphen-rec",
            type: .login,
            title: "Github",
            username: "naetik.arvnd@gmail.com",
            password: "GitHubPassword!",
            urls: ["https://github.com/"],
            notes: "3eb11-073ab\na71f7-5658b\ne995a-ca7ca\n8966f-2ff65\nd6259-68608\n2c3be-dd6c3"
        )
        assert(githubWithHyphenCodes.isRecoveryCode, "Github login with hyphenated recovery codes must have isRecoveryCode == true")
        assert(githubWithHyphenCodes.is2FA, "Github login with recovery codes must appear under 2FA")
        assert(!githubWithHyphenCodes.isAuthenticator, "Github without totpSecret must not appear in Authenticator section")
        let mock2FAItems = [protonPrimary, githubWithHyphenCodes].filter { !$0.trashed && $0.is2FA }
        assert(mock2FAItems.filter { $0.isAuthenticator }.count == 1, "Expected 1 Authenticator (Proton)")
        assert(mock2FAItems.filter { $0.isRecoveryCode }.count == 2, "Expected 2 Recovery Code items (Proton + Github)")
        print("✓ Smart Credential Understander & Import integration tests passed.")

        print("\n=======================================================")
        print("🎉 ALL DUPLICATE DETECTION & RESOLUTION TESTS PASSED! 🎉")
        print("=======================================================")
    }
}
