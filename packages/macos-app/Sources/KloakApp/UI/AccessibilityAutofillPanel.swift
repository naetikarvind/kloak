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
        self.tabbingMode = .disallowed
    }

    public override var canBecomeKey: Bool {
        // Non-activating panel must NOT steal key-window focus from the target app.
        // Returning false keeps the target field focused so AX coordinate lookup
        // (done before show()) operated on the correct window.
        return false
    }

    public override var canBecomeMain: Bool {
        return false
    }

    public override func cancelOperation(_ sender: Any?) {
        AccessibilityAutofillService.shared.hidePanel()
        if let target = AccessibilityAutofillService.shared.currentTargetApp {
            target.activate()
        }
    }
}

// MARK: - Panel Manager

@MainActor
public final class AccessibilityAutofillPanelManager {
    public static let shared = AccessibilityAutofillPanelManager()

    public private(set) var panel: AccessibilityAutofillPanel? = nil
    private var hostingView: NSHostingView<AccessibilityAutofillPopupView>? = nil

    private let panelWidth: CGFloat = 360
    private var currentHeight: CGFloat = 320
    private var currentAnchorRect: NSRect? = nil

    private init() {}

    public func show(anchoredTo rect: NSRect?, targetAppName: String) {
        self.currentAnchorRect = rect
        let panelRect = calculateFrame(anchoredTo: rect, height: currentHeight)

        if panel == nil {
            let newPanel = AccessibilityAutofillPanel(contentRect: panelRect)
            let view = AccessibilityAutofillPopupView()
            let hosting = NSHostingView(rootView: view)
            hosting.frame = NSRect(x: 0, y: 0, width: panelWidth, height: currentHeight)
            newPanel.contentView = hosting

            self.panel = newPanel
            self.hostingView = hosting
        }

        guard let p = panel else { return }

        p.setFrame(panelRect, display: true, animate: false)
        p.orderFrontRegardless()
    }

    public func updateHeight(_ newHeight: CGFloat) {
        let clamped = max(200, min(500, newHeight))
        guard let p = panel, abs(currentHeight - clamped) > 3 else { return }
        currentHeight = clamped
        let newFrame = calculateFrame(anchoredTo: currentAnchorRect, height: clamped)
        if let h = hostingView {
            h.frame = NSRect(x: 0, y: 0, width: panelWidth, height: clamped)
        }
        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.22
            context.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
            p.animator().setFrame(newFrame, display: true)
        }
    }

    public func hide() {
        panel?.orderOut(nil)
    }

    private func calculateFrame(anchoredTo targetRect: NSRect?, height: CGFloat? = nil) -> NSRect {
        let activeHeight = height ?? currentHeight
        let screens = NSScreen.screens
        let primaryScreen = screens.first ?? NSScreen.main!

        if let rect = targetRect {
            // Find which display contains the target field
            let screen = screens.first(where: { NSPointInRect(rect.origin, $0.frame) }) ?? primaryScreen
            let screenFrame = screen.visibleFrame

            var x = rect.origin.x
            // Default position: 8pt directly below the focused input field
            var y = rect.origin.y - activeHeight - 8

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

            return NSRect(x: x, y: y, width: panelWidth, height: activeHeight)
        } else {
            // Fallback: place below mouse pointer or centered on screen
            let mouse = NSEvent.mouseLocation
            let screen = screens.first(where: { NSPointInRect(mouse, $0.frame) }) ?? primaryScreen
            let screenFrame = screen.visibleFrame

            var x = mouse.x - (panelWidth / 2)
            var y = mouse.y - activeHeight - 12

            if y < screenFrame.minY {
                y = mouse.y + 16
            }

            x = min(max(x, screenFrame.minX + 12), screenFrame.maxX - panelWidth - 12)
            y = min(max(y, screenFrame.minY + 12), screenFrame.maxY - activeHeight - 12)

            return NSRect(x: x, y: y, width: panelWidth, height: activeHeight)
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
    @FocusState private var isSearchFocused: Bool

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
        let trimmed = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            return all
        }
        let terms = trimmed.lowercased().components(separatedBy: .whitespacesAndNewlines).filter { !$0.isEmpty }
        return all.filter { item in
            let title = item.title.lowercased()
            let username = item.username?.lowercased() ?? ""
            let urls = item.urls.map { $0.lowercased() }
            let tags = item.tags.map { $0.lowercased() }
            return terms.allSatisfy { term in
                title.contains(term) ||
                username.contains(term) ||
                urls.contains { $0.contains(term) } ||
                tags.contains { $0.contains(term) }
            }
        }
    }

    private var displayedSuggestions: [VaultItem] {
        if !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return []
        }
        return autofillService.smartSuggestions
    }

    @State private var revealedPasswords: Set<String> = []

    private var smartCalculatedHeight: CGFloat {
        if !vaultStore.isUnlocked {
            return 225
        }
        let trimmed = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty {
            return 440
        }
        if let top = displayedSuggestions.first {
            var h: CGFloat = 265
            if top.totpSecret != nil && !top.totpSecret!.isEmpty {
                h += 38
            }
            if top.isRecoveryCode || top.recoveryCodesCount > 0 {
                h += 42
            }
            if displayedSuggestions.count > 1 {
                h = min(450, h + CGFloat(displayedSuggestions.count - 1) * 75)
            }
            return min(460, max(245, h))
        }
        return 280
    }

    public var body: some View {
        VStack(spacing: 0) {
            headerBar

            Divider().opacity(0.15)

            if !vaultStore.isUnlocked {
                lockedVaultView
            } else {
                searchAndContentView
            }

            footerBar
        }
        .frame(width: 360, height: smartCalculatedHeight)
        .onChange(of: smartCalculatedHeight) { _, newH in
            AccessibilityAutofillPanelManager.shared.updateHeight(newH)
        }
        .onAppear {
            AccessibilityAutofillPanelManager.shared.updateHeight(smartCalculatedHeight)
        }
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
        .onExitCommand {
            autofillService.hidePanel()
            if let target = autofillService.currentTargetApp {
                target.activate()
            }
        }
        .onReceive(Timer.publish(every: 1.0, on: .main, in: .common).autoconnect()) { _ in
            autofillService.checkAccessibilityPermission()
        }
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
                    .focused($isSearchFocused)
                    .onSubmit {
                        if let first = (!displayedSuggestions.isEmpty ? displayedSuggestions.first : filteredItems.first) {
                            autofillService.performAutofill(item: first, mode: .all)
                        }
                    }

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

            if !autofillService.isAccessibilityTrusted {
                accessibilityNoticeBanner
            }

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
                    let others = searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
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
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                isSearchFocused = true
            }
        }
    }

    // MARK: - Individual Item Bento Card

    @ViewBuilder
    private func autofillItemCard(_ item: VaultItem, isHighlighted: Bool) -> some View {
        VStack(spacing: 6) {
            // Bento Header Compartment
            HStack(spacing: 8) {
                FaviconView(urls: item.urls, title: item.title, itemType: item.type, size: 24)

                VStack(alignment: .leading, spacing: 1) {
                    Text(item.title)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.white)
                        .lineLimit(1)

                    if let domain = item.urls.first {
                        let cleanHost = domain.replacingOccurrences(of: "https://", with: "")
                            .replacingOccurrences(of: "http://", with: "")
                            .components(separatedBy: "/").first ?? ""
                        Text("• \(cleanHost)")
                            .font(.system(size: 9.5))
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }
                }

                Spacer()

                // Primary 1-Click Master Fill All
                Button(action: {
                    autofillService.performAutofill(item: item, mode: .all)
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: "bolt.fill")
                            .font(.system(size: 9))
                        Text("Fill All")
                            .font(.system(size: 10, weight: .bold))
                    }
                    .padding(.horizontal, 9)
                    .padding(.vertical, 4)
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
            }
            .padding(.bottom, 2)

            // Horizontal Bento Compartments (User, Password, 2FA OTP, Recovery)
            VStack(spacing: 4) {
                // USER Compartment
                if let user = item.username, !user.isEmpty {
                    bentoCompartmentRow(
                        label: "USER",
                        value: user,
                        isMono: false,
                        onFill: { autofillService.performAutofill(item: item, mode: .usernameOnly) },
                        onCopy: { copyString(user) }
                    )
                }

                // PASS Compartment
                if let pass = item.password, !pass.isEmpty {
                    let isRevealed = revealedPasswords.contains(item.id)
                    bentoCompartmentRow(
                        label: "PASS",
                        value: isRevealed ? pass : "••••••••••••",
                        isMono: true,
                        revealAction: {
                            if isRevealed { revealedPasswords.remove(item.id) }
                            else { revealedPasswords.insert(item.id) }
                        },
                        isRevealed: isRevealed,
                        onFill: { autofillService.performAutofill(item: item, mode: .passwordOnly) },
                        onCopy: { copyString(pass) }
                    )
                }

                // 2FA OTP Compartment
                if let secret = item.totpSecret, !secret.isEmpty {
                    if let totp = TOTPEngine.shared.generate(secretBase32: secret) {
                        bentoTotpRow(
                            code: totp.token,
                            remainingSeconds: totp.secondsRemaining,
                            onFill: { autofillService.performAutofill(item: item, mode: .totpOnly) },
                            onCopy: { copyString(totp.token) }
                        )
                    }
                }

                // RECOVERY CODES Compartment
                if item.isRecoveryCode || item.recoveryCodesCount > 0 {
                    bentoRecoveryCodesRow(item: item)
                }
            }
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 11, style: .continuous)
                .fill(isHighlighted ? Color.white.opacity(0.06) : Color.white.opacity(0.03))
                .overlay(
                    RoundedRectangle(cornerRadius: 11, style: .continuous)
                        .stroke(isHighlighted ? LiquidGlassTheme.primaryAccent.opacity(0.4) : Color.white.opacity(0.08), lineWidth: 1)
                )
        )
    }

    @ViewBuilder
    private func bentoCompartmentRow(
        label: String,
        value: String,
        isMono: Bool,
        revealAction: (() -> Void)? = nil,
        isRevealed: Bool = false,
        onFill: @escaping () -> Void,
        onCopy: @escaping () -> Void
    ) -> some View {
        HStack(spacing: 6) {
            Text(label)
                .font(.system(size: 8.5, weight: .bold))
                .foregroundColor(.secondary.opacity(0.8))
                .frame(width: 32, alignment: .leading)

            Text(value)
                .font(isMono ? .system(size: 11.5, weight: .medium, design: .monospaced) : .system(size: 11.5))
                .foregroundColor(.white)
                .lineLimit(1)
                .truncationMode(.middle)

            Spacer()

            if let rev = revealAction {
                Button(action: rev) {
                    Image(systemName: isRevealed ? "eye.slash" : "eye")
                        .font(.system(size: 10))
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
            }

            Button(action: onFill) {
                Text("⚡ Fill")
                    .font(.system(size: 9.5, weight: .semibold))
                    .foregroundColor(LiquidGlassTheme.primaryAccent)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background(LiquidGlassTheme.primaryAccent.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 4))
            }
            .buttonStyle(.plain)

            Button(action: onCopy) {
                Image(systemName: "doc.on.doc")
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)
            }
            .buttonStyle(.plain)
        }
        .padding(6)
        .background(Color.black.opacity(0.25))
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    @ViewBuilder
    private func bentoTotpRow(
        code: String,
        remainingSeconds: Int,
        onFill: @escaping () -> Void,
        onCopy: @escaping () -> Void
    ) -> some View {
        HStack(spacing: 6) {
            Text("2FA OTP")
                .font(.system(size: 8, weight: .bold))
                .foregroundColor(LiquidGlassTheme.amberAccent)
                .padding(.horizontal, 4)
                .padding(.vertical, 2)
                .background(LiquidGlassTheme.amberAccent.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 3))

            Text(code)
                .font(.system(size: 12, weight: .bold, design: .monospaced))
                .foregroundColor(LiquidGlassTheme.amberAccent)

            Text("⏳ \(remainingSeconds)s")
                .font(.system(size: 9.5))
                .foregroundColor(.secondary)

            Spacer()

            Button(action: onFill) {
                Text("⚡ Fill")
                    .font(.system(size: 9.5, weight: .semibold))
                    .foregroundColor(LiquidGlassTheme.amberAccent)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background(LiquidGlassTheme.amberAccent.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 4))
            }
            .buttonStyle(.plain)

            Button(action: onCopy) {
                Image(systemName: "doc.on.doc")
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)
            }
            .buttonStyle(.plain)
        }
        .padding(6)
        .background(Color.black.opacity(0.25))
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    @ViewBuilder
    private func bentoRecoveryCodesRow(item: VaultItem) -> some View {
        let codes = item.recoveryCodesList
        let nextIndex = codes.indices.first(where: { !item.usedRecoveryCodes.contains($0) }) ?? 0
        let nextCode = codes.indices.contains(nextIndex) ? codes[nextIndex] : ""
        let isAllUsed = !codes.isEmpty && item.usedRecoveryCodes.count >= codes.count

        HStack(spacing: 6) {
            Text("2FA REC")
                .font(.system(size: 8, weight: .bold))
                .foregroundColor(LiquidGlassTheme.emeraldAccent)
                .padding(.horizontal, 4)
                .padding(.vertical, 2)
                .background(LiquidGlassTheme.emeraldAccent.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 3))

            if !nextCode.isEmpty && !isAllUsed {
                Text("#\(nextIndex + 1): \(nextCode)")
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundColor(.white)
                    .lineLimit(1)
            } else {
                Text(isAllUsed ? "All codes used" : "Recovery codes")
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)
            }

            Spacer()

            if !nextCode.isEmpty && !isAllUsed {
                Button(action: {
                    VaultStore.shared.toggleRecoveryCodeUsed(itemId: item.id, index: nextIndex)
                }) {
                    Image(systemName: "checkmark.circle")
                        .font(.system(size: 11))
                        .foregroundColor(LiquidGlassTheme.emeraldAccent)
                }
                .buttonStyle(.plain)
                .help("Mark code as used")

                Button(action: {
                    copyString(nextCode)
                    VaultStore.shared.toggleRecoveryCodeUsed(itemId: item.id, index: nextIndex)
                }) {
                    Text("⚡ Fill")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(LiquidGlassTheme.emeraldAccent)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(LiquidGlassTheme.emeraldAccent.opacity(0.15))
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(6)
        .background(Color.black.opacity(0.25))
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    private func copyString(_ text: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
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

            let queryForDisplay = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
            Text("No saved passwords found for \"\(queryForDisplay.isEmpty ? targetAppName : queryForDisplay)\". Use the search bar above to find any item in your vault.")
                .font(.system(size: 11))
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 16)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
    }

    // MARK: - Accessibility Notice Banner

    private var accessibilityNoticeBanner: some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(LiquidGlassTheme.amberAccent)
                .font(.system(size: 13))

            VStack(alignment: .leading, spacing: 1) {
                Text("Accessibility not active")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.white)
                Text("Auto-typing disabled. Click any item to copy.")
                    .font(.system(size: 9))
                    .foregroundColor(.secondary)
            }

            Spacer()

            Button(action: {
                autofillService.requestAccessibilityPermission()
            }) {
                Text("Enable")
                    .font(.system(size: 10, weight: .bold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(LiquidGlassTheme.primaryAccent)
                    .foregroundColor(.white)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)

            Button(action: {
                autofillService.checkAccessibilityPermission()
            }) {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(.white.opacity(0.85))
                    .padding(4)
                    .background(Color.white.opacity(0.12))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .help("Recheck accessibility status")
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(LiquidGlassTheme.amberAccent.opacity(0.15))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(LiquidGlassTheme.amberAccent.opacity(0.35), lineWidth: 0.8)
        )
        .padding(.horizontal, 12)
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
                Text("Shortcut: \(vaultStore.settings.autofillHotkeyDisplay)  •  Esc to cancel")
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
