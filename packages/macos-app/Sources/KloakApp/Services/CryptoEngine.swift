import Foundation
import CryptoKit
import CommonCrypto

public struct EncryptedContainer: Codable, Sendable {
    public var iv: String
    public var ciphertext: String
    public var tag: String
}

public struct VaultHeader: Codable, Sendable {
    public var kloakVersion: String
    public var formatVersion: Int
    public var kdf: KdfParams
    public var wrappedVaultKey: EncryptedContainer
    public var createdAt: String
}

public struct KdfParams: Codable, Sendable {
    public var algorithm: String
    public var iterations: Int
    public var salt: String
}

public struct VaultFile: Codable, Sendable {
    public var header: VaultHeader
    public var encryptedPayload: EncryptedContainer
}

public final class CryptoEngine: @unchecked Sendable {
    public static let shared = CryptoEngine()

    public func generateSalt(byteCount: Int = 16) -> String {
        var bytes = [UInt8](repeating: 0, count: byteCount)
        _ = SecRandomCopyBytes(kSecRandomDefault, byteCount, &bytes)
        return Data(bytes).hexEncodedString()
    }

    public func generateVaultKey() -> SymmetricKey {
        return SymmetricKey(size: .bits256)
    }

    public func keyToData(_ key: SymmetricKey) -> Data {
        return key.withUnsafeBytes { Data($0) }
    }

    public func keyFromData(_ data: Data) -> SymmetricKey {
        return SymmetricKey(data: data)
    }

    public func deriveKey(password: String, saltHex: String, iterations: Int = 600_000) -> SymmetricKey {
        let passwordData = Data(password.utf8)
        let saltData = Data(hexString: saltHex) ?? Data()
        var derivedKeyData = Data(count: 32)

        _ = derivedKeyData.withUnsafeMutableBytes { derivedKeyBytes in
            passwordData.withUnsafeBytes { passwordBytes in
                saltData.withUnsafeBytes { saltBytes in
                    CCKeyDerivationPBKDF(
                        CCPBKDFAlgorithm(kCCPBKDF2),
                        passwordBytes.baseAddress?.assumingMemoryBound(to: Int8.self),
                        passwordData.count,
                        saltBytes.baseAddress?.assumingMemoryBound(to: UInt8.self),
                        saltData.count,
                        CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),
                        UInt32(iterations),
                        derivedKeyBytes.baseAddress?.assumingMemoryBound(to: UInt8.self),
                        32
                    )
                }
            }
        }

        return SymmetricKey(data: derivedKeyData)
    }

    public func encrypt(key: SymmetricKey, plaintext: Data) throws -> EncryptedContainer {
        let nonce = AES.GCM.Nonce()
        let sealedBox = try AES.GCM.seal(plaintext, using: key, nonce: nonce)

        return EncryptedContainer(
            iv: sealedBox.nonce.withUnsafeBytes { Data($0).hexEncodedString() },
            ciphertext: sealedBox.ciphertext.hexEncodedString(),
            tag: sealedBox.tag.hexEncodedString()
        )
    }

    public func decrypt(key: SymmetricKey, container: EncryptedContainer) throws -> Data {
        guard let ivData = Data(hexString: container.iv),
              let ciphertextData = Data(hexString: container.ciphertext),
              let tagData = Data(hexString: container.tag) else {
            throw NSError(domain: "KloakCrypto", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid hex data in container"])
        }

        let nonce = try AES.GCM.Nonce(data: ivData)
        let sealedBox = try AES.GCM.SealedBox(nonce: nonce, ciphertext: ciphertextData, tag: tagData)
        return try AES.GCM.open(sealedBox, using: key)
    }
}

extension Data {
    public init?(hexString: String) {
        let len = hexString.count / 2
        var data = Data(capacity: len)
        var i = hexString.startIndex
        for _ in 0..<len {
            let nextIndex = hexString.index(i, offsetBy: 2)
            let bytes = hexString[i..<nextIndex]
            if let num = UInt8(bytes, radix: 16) {
                data.append(num)
            } else {
                return nil
            }
            i = nextIndex
        }
        self = data
    }

    public func hexEncodedString() -> String {
        return map { String(format: "%02hhx", $0) }.joined()
    }
}
