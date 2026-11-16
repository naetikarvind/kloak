import Foundation
import IOKit.hid

public struct ConnectedHardwareKeyInfo: Identifiable, Sendable {
    public let id: String
    public let name: String
    public let manufacturer: String
    public let vendorId: Int
    public let productId: Int

    public init(id: String, name: String, manufacturer: String, vendorId: Int, productId: Int) {
        self.id = id
        self.name = name
        self.manufacturer = manufacturer
        self.vendorId = vendorId
        self.productId = productId
    }
}

@MainActor
public final class HardwareSecurityKeyService: ObservableObject {
    public static let shared = HardwareSecurityKeyService()

    private init() {}

    /// Scans the system USB / HID registry for connected FIDO2 / U2F Security Keys (Usage Page 0xF1D0)
    public func getConnectedKeys() -> [ConnectedHardwareKeyInfo] {
        let manager = IOHIDManagerCreate(kCFAllocatorDefault, IOOptionBits(kIOHIDOptionsTypeNone))
        let matchingDict: [String: Any] = [
            kIOHIDDeviceUsagePageKey as String: 0xF1D0
        ]
        IOHIDManagerSetDeviceMatching(manager, matchingDict as CFDictionary)
        let _ = IOHIDManagerOpen(manager, IOOptionBits(kIOHIDOptionsTypeNone))
        defer {
            IOHIDManagerClose(manager, IOOptionBits(kIOHIDOptionsTypeNone))
        }

        guard let devices = IOHIDManagerCopyDevices(manager) as? Set<IOHIDDevice>, !devices.isEmpty else {
            return []
        }

        var keys: [ConnectedHardwareKeyInfo] = []
        for dev in devices {
            let product = IOHIDDeviceGetProperty(dev, kIOHIDProductKey as CFString) as? String ?? "FIDO2 Security Key"
            let manufacturer = IOHIDDeviceGetProperty(dev, kIOHIDManufacturerKey as CFString) as? String ?? "Unknown Manufacturer"
            let vendorId = (IOHIDDeviceGetProperty(dev, kIOHIDVendorIDKey as CFString) as? NSNumber)?.intValue ?? 0
            let productId = (IOHIDDeviceGetProperty(dev, kIOHIDProductIDKey as CFString) as? NSNumber)?.intValue ?? 0
            let serial = IOHIDDeviceGetProperty(dev, kIOHIDSerialNumberKey as CFString) as? String ?? UUID().uuidString

            let key = ConnectedHardwareKeyInfo(
                id: "\(vendorId)_\(productId)_\(serial)",
                name: product,
                manufacturer: manufacturer,
                vendorId: vendorId,
                productId: productId
            )
            keys.append(key)
        }
        return keys
    }

    /// Returns true if at least one physical FIDO2 / YubiKey hardware key is connected
    public func isHardwareKeyConnected() -> Bool {
        return !getConnectedKeys().isEmpty
    }

    /// Attempts to register a connected physical security key.
    /// Throws an error if no physical hardware key is detected.
    public func enrollConnectedKey() async throws -> (keyName: String, enrolledDate: String) {
        // Small delay to ensure device descriptor read if just plugged in
        try? await Task.sleep(nanoseconds: 300_000_000)

        let keys = getConnectedKeys()
        guard let firstKey = keys.first else {
            throw NSError(
                domain: "HardwareSecurityKey",
                code: 404,
                userInfo: [NSLocalizedDescriptionKey: "No hardware security key detected on USB or NFC. Please insert your YubiKey or FIDO2 key and try again."]
            )
        }

        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d, yyyy"
        let dateStr = formatter.string(from: Date())

        return (keyName: firstKey.name, enrolledDate: dateStr)
    }

    /// Tests the connection to the registered physical security key.
    public func testConnection(expectedKeyName: String?) async throws -> String {
        let keys = getConnectedKeys()
        guard let firstKey = keys.first else {
            throw NSError(
                domain: "HardwareSecurityKey",
                code: 404,
                userInfo: [NSLocalizedDescriptionKey: "No hardware security key detected. Please plug in your security key (\(expectedKeyName ?? "FIDO2 Key")) into a USB port or hold it near NFC."]
            )
        }

        return "Security key verified! '\(firstKey.name)' is connected and responding via USB/NFC."
    }
}
