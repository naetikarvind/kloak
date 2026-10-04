import SwiftUI
import AppKit

// MARK: - Floating Non-Activating NSPanel

public final class AccessibilityAutofillPanel: NSPanel {
    public init(contentRect: NSRect) {
        super.init(
            contentRect: contentRect,
            styleMask: [.nonactivatingPanel, .borderless, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        self.isFloatingPanel = true
        self.level = .popUpMenu
        self.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .transient]
        self.isOpaque = false
        self.backgroundColor = .clear
        self.hasShadow = true
        self.isMovableByWindowBackground = false
        self.hidesOnDeactivate = false
    }

    public override var canBecomeKey: Bool {
        return true
    }

    public override var canBecomeMain: Bool {
        return false
    }

    public override func cancelOperation(_ sender: Any?) {
        AccessibilityAutofillService.shared.hidePanel()
    }
}

// MARK: - Panel Manager

@MainActor
public final class AccessibilityAutofillPanelManager {
    public static let shared = AccessibilityAutofillPanelManager()

    public private(set) var panel: AccessibilityAutofillPanel? = nil
    private var hostingView: NSHostingView<AccessibilityAutofillPopupView>? = nil

    private let panelWidth: CGFloat = 360
    private let panelHeight: CGFloat = 430

    private init() {}

    public func show(anchoredTo rect: NSRect?, targetAppName: String) {
        let panelRect = calculateFrame(anchoredTo: rect)

        if panel == nil {
            let newPanel = AccessibilityAutofillPanel(contentRect: panelRect)
            let view = AccessibilityAutofillPopupView()
            let hosting = NSHostingView(rootView: view)
            hosting.frame = NSRect(x: 0, y: 0, width: panelWidth, height: panelHeight)
            newPanel.contentView = hosting

            self.panel = newPanel
            self.hostingView = hosting
        }

        guard let p = panel else { return }

        p.setFrame(panelRect, display: true, animate: false)
        p.orderFront(nil)
        p.makeKey()
    }

    public func hide() {
        panel?.orderOut(nil)
    }

    private func calculateFrame(anchoredTo targetRect: NSRect?) -> NSRect {
        let screens = NSScreen.screens
        let primaryScreen = screens.first ?? NSScreen.main!

        if let rect = targetRect {
            // Find which display contains the target field
            let screen = screens.first(where: { NSPointInRect(rect.origin, $0.frame) }) ?? primaryScreen
            let screenFrame = screen.visibleFrame

            var x = rect.origin.x
            // Default position: 8pt directly below the focused input field
            var y = rect.origin.y - panelHeight - 8

            // Flip above if panel would clip bottom of screen
            if y < screenFrame.minY {
                y = rect.origin.y + rect.height + 8
            }

            // Keep within horizontal screen bounds
            if x + panelWidth > screenFrame.maxX {
                x = screenFrame.maxX - panelWidth - 12
            }
            if x < screenFrame.minX {
                x = screenFrame.minX + 12
            }

            return NSRect(x: x, y: y, width: panelWidth, height: panelHeight)
        } else {
            // Fallback: place below mouse pointer or centered on screen
            let mouse = NSEvent.mouseLocation
            let screen = screens.first(where: { NSPointInRect(mouse, $0.frame) }) ?? primaryScreen
            let screenFrame = screen.visibleFrame

            var x = mouse.x - (panelWidth / 2)
            var y = mouse.y - panelHeight - 12

            if y < screenFrame.minY {
                y = mouse.y + 16
            }

            x = min(max(x, screenFrame.minX + 12), screenFrame.maxX - panelWidth - 12)
            y = min(max(y, screenFrame.minY + 12), screenFrame.maxY - panelHeight - 12)

            return NSRect(x: x, y: y, width: panelWidth, height: panelHeight)
        }
    }
}

// MARK: - SwiftUI Overlay Popup View

public struct AccessibilityAutofillPopupView: View {
    @ObservedObject private var autofillService = AccessibilityAutofillService.shared
    @ObservedObject private var vaultStore = VaultStore.shared

    @State private var searchText: String = ""
    @State private var unlockPassword: String = ""
    @State private var unlockError: String? = nil
    @State private var isUnlocking: Bool = false
    @State private var copiedNotice: String? = nil

    public init() {}

    private var targetAppName: String {
        autofillService.currentTargetApp?.localizedName ??
        autofillService.currentContext?.appName ??
        "Active Application"
    }

    private var targetDomain: String? {
        autofillService.currentContext?.activeDomain
    }

    private var filteredItems: [VaultItem] {
        let all = vaultStore.items.filter { !$0.trashed }
        if searchText.trimmingCharacters(in: .whitespaces).isEmpty {
            return all
        }
        let q = searchText.lowercased()
        return all.filter {
            $0.title.lowercased().contains(q) ||
            ($0.username?.lowercased().contains(q) ?? false) ||
            $0.urls.contains(where: { $0.lowercased().contains(q) }) ||
            $0.tags.contains(where: { $0.lowercased().contains(q) })
        }
    }

    private var displayedSuggestions: [VaultItem] {
        if !searchText.isEmpty {
            return []
        }
        return autofillService.smartSuggestions
    }

    public var body: some View {
        VStack(spacing: 0) {
            headerBar

            Divider().opacity(0.15)

            if !vaultStore.isUnlocked {
                lockedVaultView
            } else if !autofillService.isAccessibilityTrusted {
                accessibilityPermissionView
            } else {
                searchAndContentView
            }

            footerBar
        }
        .frame(width: 360, height: 430)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(red: 0.07, green: 0.09, blue: 0.15).opacity(0.96))
                .background(.ultraThinMaterial)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.white.opacity(0.14), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.45), radius: 20, x: 0, y: 10)
    }

    // MARK: - Header Bar

    private var headerBar: some View {
        HStack(spacing: 8) {
            ZStack {
                Circle()
                    .fill(LinearGradient(colors: [LiquidGlassTheme.primaryAccent, Color.blue], startPoint: .topLeading, endPoint: .bottomTrailing))
                    .frame(width: 24, height: 24)

                Image(systemName: "lock.shield.fill")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.white)
            }

            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 5) {
                    Text("Kloak Autofill")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.white)

                    Text("•")
                        .font(.system(size: 10))
                        .foregroundColor(.secondary)

                    Text(targetAppName)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(LiquidGlassTheme.emeraldAccent)
                        .lineLimit(1)
                }

                if let domain = targetDomain, !domain.isEmpty {
                    Text(domain)
                        .font(.system(size: 10))
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                } else if let role = autofillService.focusedFieldRole {
                    Text("Focused: \(role)")
                        .font(.system(size: 9))
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            Button(action: {
                autofillService.hidePanel()
            }) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 16))
                    .foregroundColor(.white.opacity(0.4))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(Color.white.opacity(0.03))
    }

    // MARK: - Search & Content View

    private var searchAndContentView: some View {
        VStack(spacing: 8) {
            // Search Input
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)

                TextField("Search all logins & credentials...", text: $searchText)
                    .textFieldStyle(.plain)
                    .font(.system(size: 12))
                    .foregroundColor(.white)

                if !searchText.isEmpty {
                    Button(action: { searchText = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 11))
                            .foregroundColor(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(Color.black.opacity(0.35))
            .clipShape(RoundedRectangle(cornerRadius: 9))
            .overlay(
                RoundedRectangle(cornerRadius: 9)
                    .stroke(Color.white.opacity(0.10), lineWidth: 0.75)
            )
            .padding(.horizontal, 12)
            .padding(.top, 8)

            // Items List
            ScrollView {
                LazyVStack(spacing: 8) {
                    if !displayedSuggestions.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(spacing: 4) {
                                Image(systemName: "sparkles")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(LiquidGlassTheme.primaryAccent)
                                Text("MATCHED FOR \(targetAppName.uppercased())")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(.secondary)
                            }
                            .padding(.horizontal, 4)

                            ForEach(displayedSuggestions) { item in
                                autofillItemCard(item, isHighlighted: true)
                            }
                        }
                    }

                    // All Items or Search Results
                    let others = searchText.isEmpty
                        ? filteredItems.filter { item in !displayedSuggestions.contains(where: { $0.id == item.id }) }
                        : filteredItems

                    if !others.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            if !displayedSuggestions.isEmpty {
                                HStack(spacing: 4) {
                                    Text("OTHER ACCOUNTS")
                                        .font(.system(size: 10, weight: .bold))
                                        .foregroundColor(.secondary)
                                }
                                .padding(.horizontal, 4)
                                .padding(.top, 6)
                            }

                            ForEach(others) { item in
                                autofillItemCard(item, isHighlighted: false)
                            }
                        }
                    }

                    if displayedSuggestions.isEmpty && others.isEmpty {
                        emptyStateView
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 4)
            }
        }
    }

    // MARK: - Individual Item Card

    @ViewBuilder
    private func autofillItemCard(_ item: VaultItem, isHighlighted: Bool) -> some View {
        VStack(spacing: 8) {
            HStack(spacing: 10) {
                FaviconView(urls: item.urls, title: item.title, itemType: item.type, size: 28)

                VStack(alignment: .leading, spacing: 2) {
                    Text(item.title)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.white)
                        .lineLimit(1)

                    if let user = item.username, !user.isEmpty {
                        Text(user)
                            .font(.system(size: 11))
                            .foregroundColor(.white.opacity(0.75))
                            .lineLimit(1)
                    }
                }

                Spacer()

                // Primary Autofill Button
                Button(action: {
                    autofillService.performAutofill(item: item, mode: .all)
                }) {
                    HStack(spacing: 5) {
                        Image(systemName: "bolt.fill")
                            .font(.system(size: 10))
                        Text("Autofill")
                            .font(.system(size: 11, weight: .bold))
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(
                        LinearGradient(
                            colors: isHighlighted
                                ? [LiquidGlassTheme.primaryAccent, Color.blue]
                                : [Color.white.opacity(0.18), Color.white.opacity(0.10)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .foregroundColor(.white)
                    .clipShape(Capsule())
                    .overlay(
                        Capsule()
                            .stroke(Color.white.opacity(isHighlighted ? 0.35 : 0.15), lineWidth: 0.75)
                    )
                }
                .buttonStyle(.plain)
            }

            // Quick Actions: Username / Password / 2FA
            HStack(spacing: 6) {
                if let user = item.username, !user.isEmpty {
                    quickActionPill(icon: "person.fill", label: "User") {
                        autofillService.performAutofill(item: item, mode: .usernameOnly)
                    }
                }

                if let pass = item.password, !pass.isEmpty {
                    quickActionPill(icon: "key.fill", label: "Password") {
                        autofillService.performAutofill(item: item, mode: .passwordOnly)
                    }
                }

                if let secret = item.totpSecret, !secret.isEmpty {
                    if let totp = TOTPEngine.shared.generate(secretBase32: secret) {
                        quickActionPill(icon: "clock.badge.checkmark.fill", label: "\(totp.token) (\(totp.secondsRemaining)s)") {
                            autofillService.performAutofill(item: item, mode: .totpOnly)
                        }
                    }
                }

                Spacer()
            }
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 11, style: .continuous)
                .fill(isHighlighted ? Color.white.opacity(0.06) : Color.white.opacity(0.03))
                .overlay(
                    RoundedRectangle(cornerRadius: 11, style: .continuous)
                        .stroke(
                            isHighlighted ? LiquidGlassTheme.primaryAccent.opacity(0.4) : Color.white.opacity(0.07),
                            lineWidth: 1
                        )
                )
        )
    }

    private func quickActionPill(icon: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 9))
                Text(label)
                    .font(.system(size: 10, weight: .medium))
            }
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(Color.black.opacity(0.35))
            .foregroundColor(.white.opacity(0.85))
            .clipShape(RoundedRectangle(cornerRadius: 5))
            .overlay(
                RoundedRectangle(cornerRadius: 5)
                    .stroke(Color.white.opacity(0.10), lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 26))
                .foregroundColor(.secondary.opacity(0.6))
                .padding(.top, 24)

            Text("No Matching Logins")
                .font(.system(size: 13, weight: .bold))
                .foregroundColor(.white)

            Text("No saved passwords found for \"\(searchText.isEmpty ? targetAppName : searchText)\". Use the search bar above to find any item in your vault.")
                .font(.system(size: 11))
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 16)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
    }

    // MARK: - Accessibility Permission Required View

    private var accessibilityPermissionView: some View {
        VStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(LiquidGlassTheme.amberAccent.opacity(0.18))
                    .frame(width: 44, height: 44)

                Image(systemName: "hand.raised.fill")
                    .font(.system(size: 20))
                    .foregroundColor(LiquidGlassTheme.amberAccent)
            }
            .padding(.top, 14)

            Text("Accessibility Permission Required")
                .font(.system(size: 13, weight: .bold))
                .foregroundColor(.white)

            Text("To detect active inputs and autofill passwords in Slack, Spotify, Discord, Chrome, and native apps, Kloak requires macOS Accessibility permission.")
                .font(.system(size: 11))
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 14)

            Button(action: {
                autofillService.requestAccessibilityPermission()
            }) {
                HStack(spacing: 6) {
                    Image(systemName: "gearshape.fill")
                        .font(.system(size: 11))
                    Text("Grant in Privacy & Security")
                        .font(.system(size: 11, weight: .bold))
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(
                    LinearGradient(
                        colors: [LiquidGlassTheme.primaryAccent, Color.blue],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .foregroundColor(.white)
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)

            Text("After granting, toggle this popup anytime using ⌘\\")
                .font(.system(size: 10, design: .monospaced))
                .foregroundColor(.secondary.opacity(0.8))
                .padding(.top, 4)

            Spacer()
        }
        .padding(16)
    }

    // MARK: - Locked Vault View

    private var lockedVaultView: some View {
        VStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(Color.white.opacity(0.08))
                    .frame(width: 44, height: 44)

                Image(systemName: "lock.fill")
                    .font(.system(size: 20))
                    .foregroundColor(.white)
            }
            .padding(.top, 14)

            Text("Vault Locked")
                .font(.system(size: 13, weight: .bold))
                .foregroundColor(.white)

            SecureField("Enter Master Password to unlock", text: $unlockPassword)
                .textFieldStyle(.roundedBorder)
                .font(.system(size: 12))
                .padding(.horizontal, 24)
                .onSubmit {
                    attemptUnlock()
                }

            if let err = unlockError {
                Text(err)
                    .font(.system(size: 11))
                    .foregroundColor(LiquidGlassTheme.roseAccent)
            }

            HStack(spacing: 10) {
                Button(action: attemptUnlock) {
                    HStack(spacing: 4) {
                        if isUnlocking {
                            ProgressView()
                                .scaleEffect(0.6)
                                .frame(width: 12, height: 12)
                        } else {
                            Image(systemName: "lock.open.fill")
                        }
                        Text("Unlock & Autofill")
                    }
                    .font(.system(size: 11, weight: .bold))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 6)
                    .background(LiquidGlassTheme.primaryAccent)
                    .foregroundColor(.white)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .disabled(unlockPassword.isEmpty || isUnlocking)

                if BiometricAuth.shared.canAuthenticateWithBiometrics() {
                    Button(action: {
                        Task {
                            let ok = await vaultStore.unlockWithBiometrics()
                            if ok {
                                autofillService.triggerAutofill()
                            }
                        }
                    }) {
                        Image(systemName: "touchid")
                            .font(.system(size: 16))
                            .foregroundColor(LiquidGlassTheme.primaryAccent)
                            .padding(6)
                            .background(Color.white.opacity(0.08))
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                }
            }

            Spacer()
        }
        .padding(16)
    }

    private func attemptUnlock() {
        guard !unlockPassword.isEmpty else { return }
        isUnlocking = true
        unlockError = nil

        Task {
            let ok = await vaultStore.unlock(password: unlockPassword)
            isUnlocking = false
            if ok {
                unlockPassword = ""
                autofillService.triggerAutofill()
            } else {
                unlockError = "Incorrect password."
            }
        }
    }

    // MARK: - Footer Bar

    private var footerBar: some View {
        HStack {
            if let toast = autofillService.toastMessage {
                HStack(spacing: 4) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(LiquidGlassTheme.emeraldAccent)
                    Text(toast)
                        .foregroundColor(LiquidGlassTheme.emeraldAccent)
                }
                .font(.system(size: 10, weight: .medium))
            } else {
                Text("Shortcut: ⌘\\  •  Esc to cancel")
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundColor(.secondary)
            }

            Spacer()

            Button(action: {
                autofillService.hidePanel()
                NSApp.activate(ignoringOtherApps: true)
                if let w = NSApp.windows.first {
                    w.makeKeyAndOrderFront(nil)
                }
            }) {
                HStack(spacing: 3) {
                    Text("Open Kloak")
                    Image(systemName: "arrow.up.right")
                }
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(LiquidGlassTheme.primaryAccent)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(Color.black.opacity(0.3))
    }
}
