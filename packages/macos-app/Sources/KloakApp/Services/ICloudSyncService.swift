/**
 * Kloak — ICloudSyncService
 * Manages zero-knowledge vault synchronization across multiple devices via iCloud Drive.
 *
 * Vault files are encrypted using Argon2id and authenticated AES-256-GCM before write.
 * Syncing via iCloud Drive is 100% Zero-Knowledge and End-to-End Encrypted.
 */

import Foundation
import Combine
import SwiftUI

public enum ICloudSyncStatus: Equatable {
    case disabled
    case synced(Date)
    case syncing
    case error(String)
}

@MainActor
public final class ICloudSyncService: ObservableObject {
    public static let shared = ICloudSyncService()

    @Published public var isSyncEnabled: Bool {
        didSet {
            UserDefaults.standard.set(isSyncEnabled, forKey: "kloak.iCloudSyncEnabled")
        }
    }
    @Published public var status: ICloudSyncStatus = .disabled
    @Published public var lastSyncDate: Date? = nil
    @Published public var isAvailable: Bool = false

    private var fileMonitorSource: DispatchSourceFileSystemObject?
    private var fileMonitorFD: CInt = -1

    public var iCloudDirectoryURL: URL? {
        let home = FileManager.default.homeDirectoryForCurrentUser
        let cloudDocs = home.appendingPathComponent("Library/Mobile Documents/com~apple~CloudDocs", isDirectory: true)
        if FileManager.default.fileExists(atPath: cloudDocs.path) {
            return cloudDocs.appendingPathComponent("Kloak", isDirectory: true)
        }
        return nil
    }

    public var iCloudVaultFileURL: URL? {
        return iCloudDirectoryURL?.appendingPathComponent("vault.kloak", isDirectory: false)
    }

    public var localVaultFileURL: URL {
        let home = FileManager.default.homeDirectoryForCurrentUser
        return home.appendingPathComponent(".kloak/vault.kloak", isDirectory: false)
    }

    public var backupsDirectoryURL: URL {
        let home = FileManager.default.homeDirectoryForCurrentUser
        return home.appendingPathComponent(".kloak/backups", isDirectory: true)
    }

    private init() {
        let stored = UserDefaults.standard.bool(forKey: "kloak.iCloudSyncEnabled")
        self.isSyncEnabled = stored

        let home = FileManager.default.homeDirectoryForCurrentUser
        let cloudDocs = home.appendingPathComponent("Library/Mobile Documents/com~apple~CloudDocs", isDirectory: true)
        self.isAvailable = FileManager.default.fileExists(atPath: cloudDocs.path)

        if stored && isAvailable {
            self.status = .synced(Date())
            startObserving()
        } else {
            self.status = .disabled
        }
    }

    public func checkAvailability() {
        let home = FileManager.default.homeDirectoryForCurrentUser
        let cloudDocs = home.appendingPathComponent("Library/Mobile Documents/com~apple~CloudDocs", isDirectory: true)
        self.isAvailable = FileManager.default.fileExists(atPath: cloudDocs.path)
    }

    // MARK: - Auto-Discovery for Other Devices
    public var hasCloudVaultAvailable: Bool {
        guard let cloudFile = iCloudVaultFileURL else { return false }
        let fm = FileManager.default
        if fm.fileExists(atPath: cloudFile.path) {
            return true
        }
        // Check for iCloud dataless placeholder (.vault.kloak.icloud)
        if let dir = iCloudDirectoryURL {
            let placeholder = dir.appendingPathComponent(".vault.kloak.icloud")
            if fm.fileExists(atPath: placeholder.path) {
                // Request download from iCloud
                try? fm.startDownloadingUbiquitousItem(at: cloudFile)
                return true
            }
        }
        return false
    }

    @discardableResult
    public func connectToExistingCloudVault() -> Bool {
        guard let cloudFile = iCloudVaultFileURL, let cloudDir = iCloudDirectoryURL else { return false }
        let fm = FileManager.default

        // If file is not yet downloaded locally from iCloud, trigger download
        if !fm.fileExists(atPath: cloudFile.path) {
            let placeholder = cloudDir.appendingPathComponent(".vault.kloak.icloud")
            if fm.fileExists(atPath: placeholder.path) {
                try? fm.startDownloadingUbiquitousItem(at: cloudFile)
            }
        }

        let localDir = localVaultFileURL.deletingLastPathComponent()
        try? fm.createDirectory(at: localDir, withIntermediateDirectories: true)

        // Remove any non-symlink empty local file if present
        if fm.fileExists(atPath: localVaultFileURL.path) {
            let attrs = try? fm.attributesOfItem(atPath: localVaultFileURL.path)
            if (attrs?[.type] as? FileAttributeType) != .typeSymbolicLink {
                createBackup()
                try? fm.removeItem(at: localVaultFileURL)
            }
        }

        if !fm.fileExists(atPath: localVaultFileURL.path) {
            try? fm.createSymbolicLink(at: localVaultFileURL, withDestinationURL: cloudFile)
        }

        self.isSyncEnabled = true
        self.lastSyncDate = Date()
        self.status = .synced(Date())
        startObserving()
        return true
    }

    public func enableSync() throws {
        guard let cloudDir = iCloudDirectoryURL, let cloudFile = iCloudVaultFileURL else {
            throw NSError(domain: "KloakSync", code: 1, userInfo: [NSLocalizedDescriptionKey: "iCloud Drive is not available or enabled on this Mac."])
        }

        self.status = .syncing

        // 1. Ensure Kloak directory exists in iCloud Drive
        try FileManager.default.createDirectory(at: cloudDir, withIntermediateDirectories: true)

        // 2. Pre-sync snapshot backup
        createBackup()

        let fm = FileManager.default
        let localExists = fm.fileExists(atPath: localVaultFileURL.path)
        let cloudExists = fm.fileExists(atPath: cloudFile.path)

        // 3. Move/Copy to iCloud if not already present
        if localExists && !cloudExists {
            try fm.copyItem(at: localVaultFileURL, to: cloudFile)
        }

        // 4. Create transparent symlink from ~/.kloak/vault.kloak -> iCloud Drive/Kloak/vault.kloak
        if localExists {
            let attrs = try? fm.attributesOfItem(atPath: localVaultFileURL.path)
            if (attrs?[.type] as? FileAttributeType) != .typeSymbolicLink {
                try? fm.removeItem(at: localVaultFileURL)
                try? fm.createSymbolicLink(at: localVaultFileURL, withDestinationURL: cloudFile)
            }
        } else if cloudExists {
            try? fm.createSymbolicLink(at: localVaultFileURL, withDestinationURL: cloudFile)
        }

        self.isSyncEnabled = true
        self.lastSyncDate = Date()
        self.status = .synced(Date())
        startObserving()
    }

    public func disableSync() throws {
        self.status = .syncing
        stopObserving()

        let fm = FileManager.default
        if let cloudFile = iCloudVaultFileURL, fm.fileExists(atPath: cloudFile.path) {
            createBackup()
            try? fm.removeItem(at: localVaultFileURL)
            try fm.copyItem(at: cloudFile, to: localVaultFileURL)
        }

        self.isSyncEnabled = false
        self.status = .disabled
    }

    public func forceSync() async -> Bool {
        guard isSyncEnabled, let cloudFile = iCloudVaultFileURL else { return false }
        self.status = .syncing
        checkAvailability()

        if let attrs = try? FileManager.default.attributesOfItem(atPath: cloudFile.path),
           let modDate = attrs[.modificationDate] as? Date {
            self.lastSyncDate = modDate
            self.status = .synced(modDate)
            return true
        }

        self.status = .synced(Date())
        return true
    }

    private func createBackup() {
        let fm = FileManager.default
        try? fm.createDirectory(at: backupsDirectoryURL, withIntermediateDirectories: true)
        let timestamp = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-")
        let backupFile = backupsDirectoryURL.appendingPathComponent("vault-backup-\(timestamp).kloak")
        if fm.fileExists(atPath: localVaultFileURL.path) {
            try? fm.copyItem(at: localVaultFileURL, to: backupFile)
        }
    }

    public func revealInFinder() {
        if let dir = iCloudDirectoryURL {
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            NSWorkspace.shared.open(dir)
        }
    }

    // MARK: - File Monitoring for Remote Sync
    private func startObserving() {
        guard let targetURL = iCloudVaultFileURL, FileManager.default.fileExists(atPath: targetURL.path) else { return }
        stopObserving()

        let fd = open(targetURL.path, O_EVTONLY)
        guard fd >= 0 else { return }
        self.fileMonitorFD = fd

        let source = DispatchSource.makeFileSystemObjectSource(
            fileDescriptor: fd,
            eventMask: [.write, .extend, .attrib],
            queue: DispatchQueue.main
        )

        source.setEventHandler { [weak self] in
            guard let self = self else { return }
            self.handleRemoteChangeDetected()
        }

        source.setCancelHandler {
            close(fd)
        }

        self.fileMonitorSource = source
        source.resume()
    }

    private func stopObserving() {
        fileMonitorSource?.cancel()
        fileMonitorSource = nil
        fileMonitorFD = -1
    }

    private func handleRemoteChangeDetected() {
        self.lastSyncDate = Date()
        self.status = .synced(Date())
        NotificationCenter.default.post(name: NSNotification.Name("KloakVaultRemoteChangeNotification"), object: nil)
    }
}
