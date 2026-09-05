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

    public func extractSecret(from input: String) -> (secret: String, period: Int, digits: Int) {
        var trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        var period = 30
        var digits = 6

        if trimmed.lowercased().hasPrefix("otpauth://") || trimmed.contains("secret=") {
            if let components = URLComponents(string: trimmed) {
                if let sec = components.queryItems?.first(where: { $0.name.lowercased() == "secret" })?.value {
                    trimmed = sec
                }
                if let perStr = components.queryItems?.first(where: { $0.name.lowercased() == "period" })?.value, let p = Int(perStr), p > 0 {
                    period = p
                }
                if let digStr = components.queryItems?.first(where: { $0.name.lowercased() == "digits" })?.value, let d = Int(digStr), d >= 6 && d <= 8 {
                    digits = d
                }
            } else if let match = trimmed.range(of: "(?i)secret=([A-Z2-7=]+)", options: .regularExpression) {
                let sub = String(trimmed[match])
                if let val = sub.components(separatedBy: "=").last {
                    trimmed = val
                }
            }
        }

        let cleaned = trimmed.uppercased().replacingOccurrences(of: "[^A-Z2-7]", with: "", options: .regularExpression)
        return (cleaned, period, digits)
    }

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
        let extracted = extractSecret(from: secretBase32)
        let actualPeriod = extracted.period != 30 ? extracted.period : period
        let actualDigits = extracted.digits != 6 ? extracted.digits : digits
        guard let keyData = decodeBase32(extracted.secret) else { return nil }

        let timeInterval = Int(date.timeIntervalSince1970)
        let timeStep = UInt64(timeInterval / actualPeriod)
        let secondsRemaining = actualPeriod - (timeInterval % actualPeriod)

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

        let modulo = UInt32(pow(10.0, Double(actualDigits)))
        let tokenInt = binaryCode % modulo
        let token = String(format: "%0\(actualDigits)d", tokenInt)

        return TOTPResult(token: token, secondsRemaining: secondsRemaining, period: actualPeriod)
    }
}
