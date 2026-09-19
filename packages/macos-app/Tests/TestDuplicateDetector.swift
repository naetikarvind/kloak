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

        print("\n=======================================================")
        print("🎉 ALL DUPLICATE DETECTION & RESOLUTION TESTS PASSED! 🎉")
        print("=======================================================")
    }
}
