import Foundation
import LocalAuthentication

public final class BiometricAuth: @unchecked Sendable {
    public static let shared = BiometricAuth()

    public func canAuthenticateWithBiometrics() -> Bool {
        let context = LAContext()
        var error: NSError?
        return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    }

    public func authenticate(reason: String = "Unlock your Kloak Vault", completion: @escaping @Sendable (Bool, String?) -> Void) {
        let context = LAContext()
        var error: NSError?

        if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
            context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, authError in
                DispatchQueue.main.async {
                    if success {
                        completion(true, nil)
                    } else {
                        completion(false, authError?.localizedDescription ?? "Authentication failed")
                    }
                }
            }
        } else {
            completion(false, error?.localizedDescription ?? "Biometrics unavailable on this device")
        }
    }
}
