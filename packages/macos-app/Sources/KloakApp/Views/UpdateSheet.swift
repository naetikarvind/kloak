/**
 * Kloak — UpdateSheet
 * Sheet UI displaying update status, real-time download progress, release notes, and install triggers.
 */

import SwiftUI
import AppKit

public struct UpdateSheet: View {
    @ObservedObject var updater = UpdaterService.shared
    @Environment(\.dismiss) private var dismiss

    public init() {}

    public var body: some View {
        VStack(spacing: 0) {
            // Top Bar
            HStack {
                HStack(spacing: 8) {
                    Image(systemName: "arrow.triangle.2.circlepath.circle.fill")
                        .font(.system(size: 16))
                        .foregroundColor(LiquidGlassTheme.primaryAccent)
                    Text("Software Update")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(.white)
                }

                Spacer()

                Button(action: {
                    updater.dismiss()
                    dismiss()
                }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 18))
                        .foregroundColor(.white.opacity(0.4))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 24)
            .padding(.top, 20)
            .padding(.bottom, 16)

            Divider()
                .background(Color.white.opacity(0.1))

            // Main Content Area
            VStack(spacing: 20) {
                // Icon Header
                ZStack {
                    Circle()
                        .fill(LinearGradient(
                            colors: [LiquidGlassTheme.primaryAccent.opacity(0.3), LiquidGlassTheme.primaryAccent.opacity(0.05)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ))
                        .frame(width: 72, height: 72)
                        .overlay(
                            Circle()
                                .stroke(LiquidGlassTheme.primaryAccent.opacity(0.4), lineWidth: 1)
                        )

                    Image(systemName: iconForCurrentStatus)
                        .font(.system(size: 32, weight: .medium))
                        .foregroundColor(colorForCurrentStatus)
                }
                .padding(.top, 10)

                // Title & Subtitle
                VStack(spacing: 6) {
                    Text(titleForCurrentStatus)
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.white)
                        .multilineTextAlignment(.center)

                    Text(subtitleForCurrentStatus)
                        .font(.system(size: 13))
                        .foregroundColor(.white.opacity(0.7))
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, 16)

                // Progress Bar or Notes
                contentForStatus
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 16)

            Spacer(minLength: 12)

            Divider()
                .background(Color.white.opacity(0.1))

            // Bottom Actions Bar
            HStack(spacing: 12) {
                actionButtons
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 16)
        }
        .frame(width: 480, height: 420)
        .background(
            ZStack {
                Color(red: 0.05, green: 0.07, blue: 0.11)
                RadialGradient(
                    colors: [LiquidGlassTheme.primaryAccent.opacity(0.12), Color.clear],
                    center: .top,
                    startRadius: 20,
                    endRadius: 300
                )
            }
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    // MARK: - Dynamic State Views

    @ViewBuilder
    private var contentForStatus: some View {
        switch updater.status {
        case .checking:
            ProgressView()
                .progressViewStyle(.circular)
                .scaleEffect(0.9)
                .padding(.vertical, 8)

        case .downloading(let progress, let received, let total):
            VStack(spacing: 10) {
                ProgressView(value: progress, total: 1.0)
                    .progressViewStyle(.linear)
                    .tint(LiquidGlassTheme.primaryAccent)
                    .frame(maxWidth: .infinity)

                HStack {
                    Text("\(Int(progress * 100))%")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(LiquidGlassTheme.primaryAccent)

                    Spacer()

                    if total > 0 {
                        Text("\(formatBytes(received)) of \(formatBytes(total))")
                            .font(.system(size: 11))
                            .foregroundColor(.white.opacity(0.5))
                    } else {
                        Text(formatBytes(received))
                            .font(.system(size: 11))
                            .foregroundColor(.white.opacity(0.5))
                    }
                }
            }
            .padding(14)
            .background(Color.white.opacity(0.04))
            .cornerRadius(10)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Color.white.opacity(0.08), lineWidth: 1)
            )

        case .available(let release, _):
            if let body = release.body, !body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Release Notes")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(.white.opacity(0.5))

                    ScrollView {
                        Text(body)
                            .font(.system(size: 12))
                            .foregroundColor(.white.opacity(0.85))
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(10)
                    }
                    .frame(height: 100)
                    .background(Color.black.opacity(0.25))
                    .cornerRadius(8)
                }
            }

        case .readyToInstall(_, let release):
            VStack(spacing: 6) {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(LiquidGlassTheme.emeraldAccent)
                    Text("Package Downloaded")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(.white)
                }

                Text("Click below to open the DMG package installer and update Kloak v\(release.cleanVersion).")
                    .font(.system(size: 12))
                    .foregroundColor(.white.opacity(0.6))
                    .multilineTextAlignment(.center)
            }
            .padding(12)
            .background(LiquidGlassTheme.emeraldAccent.opacity(0.1))
            .cornerRadius(10)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(LiquidGlassTheme.emeraldAccent.opacity(0.3), lineWidth: 1)
            )

        case .upToDate:
            HStack(spacing: 8) {
                Image(systemName: "shield.checkerboard")
                    .foregroundColor(LiquidGlassTheme.emeraldAccent)
                Text("Your local vault is running the most secure version.")
                    .font(.system(size: 12))
                    .foregroundColor(.white.opacity(0.7))
            }
            .padding(12)
            .background(Color.white.opacity(0.03))
            .cornerRadius(10)

        case .error(let msg):
            Text(msg)
                .font(.system(size: 12))
                .foregroundColor(LiquidGlassTheme.roseAccent)
                .multilineTextAlignment(.center)
                .padding(10)
                .background(LiquidGlassTheme.roseAccent.opacity(0.1))
                .cornerRadius(8)

        case .idle:
            EmptyView()
        }
    }

    // MARK: - Action Buttons

    @ViewBuilder
    private var actionButtons: some View {
        switch updater.status {
        case .readyToInstall(let dmgURL, _):
            Button(action: {
                updater.dismiss()
                dismiss()
            }) {
                Text("Later")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(.white.opacity(0.7))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
            }
            .buttonStyle(.plain)

            Spacer()

            Button(action: {
                updater.installUpdate(dmgURL: dmgURL)
                updater.dismiss()
                dismiss()
            }) {
                HStack(spacing: 6) {
                    Image(systemName: "arrow.down.app.fill")
                    Text("Open Installer Package")
                }
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(.white)
                .padding(.horizontal, 18)
                .padding(.vertical, 8)
                .background(
                    LinearGradient(
                        colors: [LiquidGlassTheme.emeraldAccent, Color(red: 0.05, green: 0.60, blue: 0.35)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .cornerRadius(8)
            }
            .buttonStyle(.plain)

        case .downloading:
            Spacer()
            Button(action: {
                updater.cancelDownload()
            }) {
                Text("Cancel Download")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(LiquidGlassTheme.roseAccent)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Color.white.opacity(0.05))
                    .cornerRadius(8)
            }
            .buttonStyle(.plain)

        case .available(let release, _):
            Button(action: {
                updater.dismiss()
                dismiss()
            }) {
                Text("Not Now")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(.white.opacity(0.7))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
            }
            .buttonStyle(.plain)

            Spacer()

            Button(action: {
                updater.startDownload(for: release)
            }) {
                HStack(spacing: 6) {
                    Image(systemName: "arrow.down.circle.fill")
                    Text("Download Update (v\(release.cleanVersion))")
                }
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(LiquidGlassTheme.primaryAccent)
                .cornerRadius(8)
            }
            .buttonStyle(.plain)

        case .upToDate, .error, .idle:
            Spacer()
            Button(action: {
                updater.checkForUpdates(userInitiated: true)
            }) {
                HStack(spacing: 6) {
                    Image(systemName: "arrow.clockwise")
                    Text("Check Again")
                }
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(Color.white.opacity(0.1))
                .cornerRadius(8)
            }
            .buttonStyle(.plain)

            Button(action: {
                updater.dismiss()
                dismiss()
            }) {
                Text("Done")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 8)
                    .background(LiquidGlassTheme.primaryAccent)
                    .cornerRadius(8)
            }
            .buttonStyle(.plain)

        case .checking:
            Spacer()
            Button(action: {
                updater.dismiss()
                dismiss()
            }) {
                Text("Cancel")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(.white.opacity(0.7))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Strings & Icons

    private var iconForCurrentStatus: String {
        switch updater.status {
        case .checking:
            return "magnifyingglass.circle.fill"
        case .available:
            return "sparkles.rectangle.stack.fill"
        case .downloading:
            return "arrow.down.circle.fill"
        case .readyToInstall:
            return "shippingbox.fill"
        case .upToDate:
            return "checkmark.seal.fill"
        case .error:
            return "exclamationmark.triangle.fill"
        case .idle:
            return "arrow.triangle.2.circlepath.circle.fill"
        }
    }

    private var colorForCurrentStatus: Color {
        switch updater.status {
        case .readyToInstall, .upToDate:
            return LiquidGlassTheme.emeraldAccent
        case .error:
            return LiquidGlassTheme.roseAccent
        default:
            return LiquidGlassTheme.primaryAccent
        }
    }

    private var titleForCurrentStatus: String {
        switch updater.status {
        case .checking:
            return "Checking for Updates…"
        case .available(let release, _):
            return "Kloak v\(release.cleanVersion) is Available"
        case .downloading:
            return "Downloading Update…"
        case .readyToInstall(_, let release):
            return "Kloak v\(release.cleanVersion) Ready to Install"
        case .upToDate:
            return "Kloak is Up to Date"
        case .error:
            return "Update Check Failed"
        case .idle:
            return "Software Update"
        }
    }

    private var subtitleForCurrentStatus: String {
        switch updater.status {
        case .checking:
            return "Connecting to GitHub Releases to check for the latest package…"
        case .available(let release, let current):
            return "A new release is available (v\(release.cleanVersion)). You are currently running v\(current)."
        case .downloading:
            return "Downloading the latest DMG installer package in the background…"
        case .readyToInstall:
            return "The update has been downloaded. Open the installer package to complete the upgrade."
        case .upToDate(let version):
            return "Kloak v\(version) is currently the newest version available."
        case .error:
            return "Unable to retrieve release information from GitHub. Please check your network connection."
        case .idle:
            return "Version \(updater.currentVersion) (Build \(updater.buildNumber))"
        }
    }

    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useMB, .useKB]
        formatter.countStyle = .file
        return formatter.string(fromByteCount: bytes)
    }
}
