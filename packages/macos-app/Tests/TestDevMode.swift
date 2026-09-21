import Foundation

@main
struct TestDevMode {
    @MainActor
    static func main() {
        print("=== Running Kloak Developer Mode & Immutable Master Password Tests ===")
        let manager = DevModeManager.shared

        // Test 1: Verify Immutability of Master Passwords
        print("\n[1] Verifying Immutable Developer Passwords...")
        assert(DevModeManager.immutableMasterPassword == "KloakDev2026!", "Immutable password mismatch")
        assert(DevModeManager.alternativePassword == "kloakdev", "Alternative developer password mismatch")
        print("✓ Immutable master passwords match specifications ('KloakDev2026!' and 'kloakdev').")

        // Test 2: Authentication with Canonical Developer Password
        print("\n[2] Testing Authentication with Canonical Password...")
        manager.lock()
        assert(!manager.isUnlocked, "Manager should start locked")
        assert(manager.authError == nil, "Auth error should initially be nil")

        let authSuccess = manager.authenticate(password: "KloakDev2026!")
        assert(authSuccess == true, "Canonical password authentication failed")
        assert(manager.isUnlocked == true, "Manager should be unlocked after successful auth")
        assert(manager.authError == nil, "Auth error should be nil after successful auth")
        print("✓ Canonical developer password authentication passed.")

        // Test 3: Lock State Reset
        print("\n[3] Testing Lock State Reset...")
        manager.lock()
        assert(manager.isUnlocked == false, "Manager should be locked after lock()")
        print("✓ Lock state reset passed.")

        // Test 4: Shorthand Alias Password with Whitespace Trimming
        print("\n[4] Testing Shorthand Alias with Whitespace Trimming...")
        let aliasSuccess = manager.authenticate(password: "  kloakdev \n\t")
        assert(aliasSuccess == true, "Alternative password with whitespace should succeed")
        assert(manager.isUnlocked == true, "Manager should be unlocked after alias auth")
        print("✓ Shorthand alias authentication passed.")

        // Test 5: Rejection of Invalid Passwords & Normal Vault Passwords
        print("\n[5] Testing Rejection of Invalid / Non-Dev Passwords...")
        manager.lock()
        let fail1 = manager.authenticate(password: "IncorrectPassword123")
        assert(fail1 == false, "Incorrect password should fail")
        assert(manager.isUnlocked == false, "Manager must remain locked on failed auth")
        assert(manager.authError != nil, "Auth error message must be populated on failure")

        let fail2 = manager.authenticate(password: "Admin12345!")
        assert(fail2 == false, "Arbitrary vault password must not unlock dev mode")
        assert(manager.isUnlocked == false, "Manager must remain locked")

        let fail3 = manager.authenticate(password: "")
        assert(fail3 == false, "Empty password must fail")
        print("✓ Invalid and arbitrary passwords correctly rejected.")

        // Test 6: Diagnostics Generation
        print("\n[6] Testing Developer Diagnostics Inspection...")
        let diag = manager.getDiagnostics()
        assert(diag["Vault Path"] != nil, "Diagnostics missing 'Vault Path'")
        assert(diag["Vault Exists"] != nil, "Diagnostics missing 'Vault Exists'")
        assert(diag["Vault Unlocked"] != nil, "Diagnostics missing 'Vault Unlocked'")
        assert(diag["macOS Version"] != nil, "Diagnostics missing 'macOS Version'")
        assert(diag["IPC Port"] == "\(IPCServer.defaultPort)", "Diagnostics IPC Port mismatch")

        let formattedText = manager.formattedDiagnosticsText()
        assert(formattedText.contains("=== KLOAK DEVELOPER DIAGNOSTICS ==="), "Formatted text missing header")
        assert(formattedText.contains("macOS Version:"), "Formatted text missing OS version")
        print("✓ Diagnostics generation passed.")

        // Test 7: Dev Mode Sheet Presentation Control
        print("\n[7] Testing Dev Mode Presentation State...")
        manager.showSheet = true
        assert(manager.showSheet == true, "showSheet should be settable")
        manager.lock()
        manager.showSheet = false
        assert(manager.showSheet == false, "showSheet should be closable")
        print("✓ Dev Mode presentation state passed.")

        print("\n=======================================================")
        print("🎉 ALL DEVELOPER MODE TESTS COMPLETED SUCCESSFULLY! 🎉")
        print("=======================================================")
    }
}
