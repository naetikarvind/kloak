import Foundation
import CommonCrypto

public struct TOTPResult: Sendable {
    public var token: String
    public var secondsRemaining: Int
    public var period: Int
}

public final class TOTPEngine: @unchecked Sendable {
    public static let shared = TOTPEngine()
    private let alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

    public func decodeBase32(_ base32: String) -> Data? {
        let cleaned = base32.uppercased().replacingOccurrences(of: "[^A-Z2-7]", with: "", options: .regularExpression)
        guard !cleaned.isEmpty else { return nil }

        var bits = 0
        var value = 0
        var bytes = [UInt8]()

        for char in cleaned {
            guard let idx = alphabet.firstIndex(of: char) else { return nil }
            let val = alphabet.distance(from: alphabet.startIndex, to: idx)

            value = (value << 5) | val
            bits += 5

            if bits >= 8 {
                bytes.append(UInt8((value >> (bits - 8)) & 0xFF))
                bits -= 8
            }
        }

        return Data(bytes)
    }

    public func generate(secretBase32: String, period: Int = 30, digits: Int = 6, date: Date = Date()) -> TOTPResult? {
        guard let keyData = decodeBase32(secretBase32) else { return nil }

        let timeInterval = Int(date.timeIntervalSince1970)
        let timeStep = UInt64(timeInterval / period)
        let secondsRemaining = period - (timeInterval % period)

        var bigEndianTime = timeStep.bigEndian
        let timeData = Data(bytes: &bigEndianTime, count: 8)

        var hmac = [UInt8](repeating: 0, count: Int(CC_SHA1_DIGEST_LENGTH))
        keyData.withUnsafeBytes { keyBytes in
            timeData.withUnsafeBytes { dataBytes in
                CCHmac(
                    CCHmacAlgorithm(kCCHmacAlgSHA1),
                    keyBytes.baseAddress,
                    keyData.count,
                    dataBytes.baseAddress,
                    timeData.count,
                    &hmac
                )
            }
        }

        let offset = Int(hmac[hmac.count - 1] & 0x0F)
        let binaryCode =
            ((UInt32(hmac[offset] & 0x7F) << 24) |
             (UInt32(hmac[offset + 1] & 0xFF) << 16) |
             (UInt32(hmac[offset + 2] & 0xFF) << 8) |
             (UInt32(hmac[offset + 3] & 0xFF)))

        let modulo = UInt32(pow(10.0, Double(digits)))
        let tokenInt = binaryCode % modulo
        let token = String(format: "%0\(digits)d", tokenInt)

        return TOTPResult(token: token, secondsRemaining: secondsRemaining, period: period)
    }
}
