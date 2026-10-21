/**
 * Kloak — UpdaterService
 * Automatically checks GitHub Releases for new updates and downloads DMG installer packages.
 * Repository: https://github.com/naetikarvind/kloak
 */

import Foundation
import SwiftUI
import AppKit

// MARK: - GitHub Release Models

public struct GitHubRelease: Codable, Sendable {
    public let tagName: String
    public let name: String?
    public let body: String?
    public let htmlUrl: String
    public let prerelease: Bool
    public let assets: [GitHubAsset]

    enum CodingKeys: String, CodingKey {
        case tagName = "tag_name"
        case name, body
        case htmlUrl = "html_url"
        case prerelease, assets
    }

    public var cleanVersion: String {
        var v = tagName.trimmingCharacters(in: .whitespacesAndNewlines)
        if v.lowercased().hasPrefix("v") {
            v.removeFirst()
        }
        return v
    }

    public var dmgAsset: GitHubAsset? {
        assets.first { $0.name.lowercased().hasSuffix(".dmg") }
    }

    public var packageAsset: GitHubAsset? {
        assets.first { $0.name.lowercased().hasSuffix(".dmg") || $0.name.lowercased().hasSuffix(".pkg") }
    }
}

public struct GitHubAsset: Codable, Sendable {
    public let name: String
    public let browserDownloadUrl: String
    public let size: Int

    enum CodingKeys: String, CodingKey {
        case name
        case browserDownloadUrl = "browser_download_url"
        case size
    }
}

// MARK: - Update Status

public enum UpdateStatus: Equatable, Sendable {
    case idle
    case checking
    case upToDate(currentVersion: String)
    case available(release: GitHubRelease, currentVersion: String)
    case downloading(progress: Double, bytesReceived: Int64, totalBytes: Int64)
    case readyToInstall(dmgURL: URL, release: GitHubRelease)
    case error(message: String)

    public static func == (lhs: UpdateStatus, rhs: UpdateStatus) -> Bool {
        switch (lhs, rhs) {
        case (.idle, .idle), (.checking, .checking):
            return true
        case (.upToDate(let a), .upToDate(let b)):
            return a == b
        case (.available(let r1, let v1), .available(let r2, let v2)):
            return r1.tagName == r2.tagName && v1 == v2
        case (.downloading(let p1, _, _), .downloading(let p2, _, _)):
            return abs(p1 - p2) < 0.001
        case (.readyToInstall(let u1, let r1), .readyToInstall(let u2, let r2)):
            return u1 == u2 && r1.tagName == r2.tagName
        case (.error(let m1), .error(let m2)):
            return m1 == m2
        default:
            return false
        }
    }
}

// MARK: - UpdaterService

@MainActor
public final class UpdaterService: NSObject, ObservableObject, URLSessionDownloadDelegate {
    public static let shared = UpdaterService()

    @Published public var status: UpdateStatus = .idle
    @Published public var showUpdateSheet: Bool = false

    private let repoOwner = "naetikarvind"
    private let repoName = "kloak"
    private let apiEndpoint = "https://api.github.com/repos/naetikarvind/kloak/releases/latest"

    private var activeDownloadTask: URLSessionDownloadTask?
    private var pendingRelease: GitHubRelease?
    private lazy var downloadSession: URLSession = {
        let config = URLSessionConfiguration.default
        return URLSession(configuration: config, delegate: self, delegateQueue: .main)
    }()

    public var currentVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    }

    public var buildNumber: String {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
    }

    private override init() {
        super.init()
    }

    // MARK: - Semantic Version Comparison

    public static func isVersion(_ v1: String, greaterThan v2: String) -> Bool {
        let parts1 = v1.split(separator: ".").compactMap { Int($0) }
        let parts2 = v2.split(separator: ".").compactMap { Int($0) }
        let count = max(parts1.count, parts2.count)
        for i in 0..<count {
            let p1 = i < parts1.count ? parts1[i] : 0
            let p2 = i < parts2.count ? parts2[i] : 0
            if p1 > p2 { return true }
            if p1 < p2 { return false }
        }
        return false
    }

    // MARK: - Check for Updates

    public func checkForUpdates(userInitiated: Bool = false) {
        guard status != .checking else { return }
        status = .checking
        if userInitiated {
            showUpdateSheet = true
        }

        Task {
            do {
                guard let url = URL(string: apiEndpoint) else {
                    status = .error(message: "Invalid update endpoint.")
                    return
                }

                var request = URLRequest(url: url)
                request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
                request.setValue("2022-11-28", forHTTPHeaderField: "X-GitHub-Api-Version")
                request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData

                let (data, response) = try await URLSession.shared.data(for: request)
                guard let httpResponse = response as? HTTPURLResponse else {
                    status = .error(message: "Failed to connect to update server.")
                    return
                }

                if httpResponse.statusCode == 404 {
                    // No GitHub releases published yet
                    status = .upToDate(currentVersion: currentVersion)
                    return
                }

                guard httpResponse.statusCode == 200 else {
                    status = .error(message: "Server returned HTTP \(httpResponse.statusCode)")
                    return
                }

                let release = try JSONDecoder().decode(GitHubRelease.self, from: data)

                // Skip prereleases unless desired
                if release.prerelease {
                    status = .upToDate(currentVersion: currentVersion)
                    return
                }

                let remoteVersion = release.cleanVersion
                if Self.isVersion(remoteVersion, greaterThan: currentVersion) {
                    // Update is available! Automatically start downloading the DMG
                    status = .available(release: release, currentVersion: currentVersion)
                    showUpdateSheet = true
                    startDownload(for: release)
                } else {
                    status = .upToDate(currentVersion: currentVersion)
                }
            } catch {
                status = .error(message: error.localizedDescription)
            }
        }
    }

    // MARK: - Auto Download

    public func startDownload(for release: GitHubRelease) {
        guard let asset = release.packageAsset ?? release.dmgAsset,
              let downloadURL = URL(string: asset.browserDownloadUrl) else {
            status = .error(message: "No package asset found in release v\(release.cleanVersion).")
            return
        }

        pendingRelease = release
        status = .downloading(progress: 0.0, bytesReceived: 0, totalBytes: Int64(asset.size))

        let request = URLRequest(url: downloadURL)
        activeDownloadTask?.cancel()
        activeDownloadTask = downloadSession.downloadTask(with: request)
        activeDownloadTask?.resume()
    }

    public func cancelDownload() {
        activeDownloadTask?.cancel()
        activeDownloadTask = nil
        if let rel = pendingRelease {
            status = .available(release: rel, currentVersion: currentVersion)
        } else {
            status = .idle
        }
    }

    // MARK: - URLSessionDownloadDelegate

    public func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didWriteData bytesWritten: Int64,
        totalBytesWritten: Int64,
        totalBytesExpectedToWrite: Int64
    ) {
        let total = totalBytesExpectedToWrite > 0 ? totalBytesExpectedToWrite : 1
        let progress = min(1.0, max(0.0, Double(totalBytesWritten) / Double(total)))
        Task { @MainActor in
            self.status = .downloading(
                progress: progress,
                bytesReceived: totalBytesWritten,
                totalBytes: totalBytesExpectedToWrite
            )
        }
    }

    public func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didFinishDownloadingTo location: URL
    ) {
        guard let release = pendingRelease else { return }

        // Move the downloaded file into a clean destination in temporary directory
        let ext = (release.packageAsset?.name.hasSuffix(".pkg") == true) ? "pkg" : "dmg"
        let destURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("Kloak-\(release.cleanVersion).\(ext)")

        try? FileManager.default.removeItem(at: destURL)

        do {
            try FileManager.default.moveItem(at: location, to: destURL)
            Task { @MainActor in
                self.status = .readyToInstall(dmgURL: destURL, release: release)
            }
        } catch {
            Task { @MainActor in
                self.status = .error(message: "Could not save update package: \(error.localizedDescription)")
            }
        }
    }

    public func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didCompleteWithError error: Error?
    ) {
        if let error = error as NSError?, error.code != NSURLErrorCancelled {
            Task { @MainActor in
                self.status = .error(message: error.localizedDescription)
            }
        }
    }

    // MARK: - Installation & Open

    public func installUpdate(dmgURL: URL) {
        // Open the DMG file with default handler (macOS DiskImageMounter)
        // This mounts the volume and pops open Finder showing Kloak.app and /Applications symlink
        NSWorkspace.shared.open(dmgURL)
    }

    public func dismiss() {
        showUpdateSheet = false
    }
}
