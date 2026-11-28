import SwiftUI
import AppKit

// MARK: - Floating Non-Activating Dynamic Island NSPanel

public final class AccessibilityAutofillPanel: NSPanel {
    public init(contentRect: NSRect) {
        super.init(
            contentRect: contentRect,
            styleMask: [.nonactivatingPanel, .borderless, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        self.isFloatingPanel = true
        self.becomesKeyOnlyIfNeeded = false
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
        // Returning true lets TextField / SecureField inside this non-activating NSPanel
        // accept keyboard focus and search typing without activating Kloak's main window.
        return true
    }

    public override var canBecomeMain: Bool {
        return false
    }

    public override func sendEvent(_ event: NSEvent) {
        // Ensure any click inside the floating island grants key status to its responder chain
        // so the search bar or password unlock field receives typing immediately.
        if event.type == .leftMouseDown && !self.isKeyWindow {
            self.makeKey()
        }
        super.sendEvent(event)
    }

    public override func cancelOperation(_ sender: Any?) {
        AccessibilityAutofillService.shared.hidePanel()
        if let target = AccessibilityAutofillService.shared.currentTargetApp {
            target.activate()
        }
    }

    public override func performKeyEquivalent(with event: NSEvent) -> Bool {
        // Non-activating panels can bypass standard app Edit-menu shortcuts when NSApp is inactive.
        // Forward Cmd+A/C/V/X/Z directly to the active field editor so search typing works seamlessly.
        let mods = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
        if mods == .command, let chars = event.charactersIgnoringModifiers?.lowercased() {
            let selector: Selector? = switch chars {
            case "a": #selector(NSText.selectAll(_:))
            case "c": #selector(NSText.copy(_:))
            case "v": #selector(NSText.paste(_:))
            case "x": #selector(NSText.cut(_:))
            case "z": Selector(("undo:"))
            default: nil
            }
            if let action = selector {
                if let responder = self.firstResponder, responder.tryToPerform(action, with: self) {
                    return true
                }
                if NSApp.sendAction(action, to: nil, from: self) {
                    return true
                }
            }
        }
        return super.performKeyEquivalent(with: event)
    }
}

// MARK: - Panel Manager

@MainActor
public final class AccessibilityAutofillPanelManager {
    public static let shared = AccessibilityAutofillPanelManager()

    public private(set) var panel: AccessibilityAutofillPanel? = nil
    private var hostingView: NSHostingView<AccessibilityAutofillPopupView>? = nil

    private let panelWidth: CGFloat = 360
    private var currentHeight: CGFloat = 500
    private var currentAnchorRect: NSRect? = nil

    private init() {}

    public func show(anchoredTo rect: NSRect?, targetAppName: String) {
        self.currentAnchorRect = rect

        let initialHeight = recommendedInitialHeight()
        self.currentHeight = initialHeight
        let panelRect = calculateFrame(anchoredTo: rect, height: initialHeight)

        if panel == nil {
            let newPanel = AccessibilityAutofillPanel(contentRect: panelRect)
            let view = AccessibilityAutofillPopupView()
            let hosting = NSHostingView(rootView: view)
            hosting.frame = NSRect(x: 0, y: 0, width: panelWidth, height: initialHeight)
            hosting.autoresizingMask = [.width, .height]
            newPanel.contentView = hosting

            self.panel = newPanel
            self.hostingView = hosting
        }

        guard let p = panel else { return }
        if let h = hostingView {
            h.frame = NSRect(x: 0, y: 0, width: panelWidth, height: initialHeight)
        }
        p.setFrame(panelRect, display: true, animate: false)
        p.orderFrontRegardless()
        p.makeKey()
    }

    public func updateHeight(_ newHeight: CGFloat) {
        let maxAllowed = maxScreenPanelHeight(for: currentAnchorRect)
        let clamped = max(310, min(maxAllowed, newHeight))
        guard let p = panel else { return }

        if abs(currentHeight - clamped) <= 3 && abs(p.frame.height - clamped) <= 3 {
            return
        }

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
        panel?.resignKey()
        panel?.orderOut(nil)
    }

    private func recommendedInitialHeight() -> CGFloat {
        let maxAllowed = maxScreenPanelHeight(for: currentAnchorRect)
        if !VaultStore.shared.isUnlocked {
            return min(340, maxAllowed)
        }
        return min(510, maxAllowed)
    }

    private func maxScreenPanelHeight(for targetRect: NSRect?) -> CGFloat {
        let screens = NSScreen.screens
        let primaryScreen = screens.first ?? NSScreen.main!
        let screen: NSScreen
        if let rect = targetRect {
            screen = screens.first(where: { NSPointInRect(rect.origin, $0.frame) }) ?? primaryScreen
        } else {
            let mouse = NSEvent.mouseLocation
            screen = screens.first(where: { NSPointInRect(mouse, $0.frame) }) ?? primaryScreen
        }
        return max(360, min(540, screen.visibleFrame.height - 28))
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
            if y < screenFrame.minY + 8 {
                let aboveY = rect.origin.y + rect.height + 8
                if aboveY + activeHeight <= screenFrame.maxY - 8 {
                    y = aboveY
                } else {
                    y = max(screenFrame.minY + 12, screenFrame.maxY - activeHeight - 12)
                }
            }

            x = min(max(x, screenFrame.minX + 12), screenFrame.maxX - panelWidth - 12)
            y = min(max(y, screenFrame.minY + 12), screenFrame.maxY - activeHeight - 12)

            return NSRect(x: x, y: y, width: panelWidth, height: activeHeight)
        } else {
            // Fallback: place below mouse pointer or cleanly inside visible screen
            let mouse = NSEvent.mouseLocation
            let screen = screens.first(where: { NSPointInRect(mouse, $0.frame) }) ?? primaryScreen
            let screenFrame = screen.visibleFrame

            var x = mouse.x - (panelWidth / 2)
            var y = mouse.y - activeHeight - 12

            if y < screenFrame.minY + 8 {
                y = mouse.y + 16
            }

            x = min(max(x, screenFrame.minX + 12), screenFrame.maxX - panelWidth - 12)
            y = min(max(y, screenFrame.minY + 12), screenFrame.maxY - activeHeight - 12)

            return NSRect(x: x, y: y, width: panelWidth, height: activeHeight)
        }
    }
}

// MARK: - AppKit Frosted Glass Backing View

private struct DynamicIslandGlassBackdrop: NSViewRepresentable {
    func makeNSView(context: Context) -> NSVisualEffectView {
        let view = NSVisualEffectView()
        view.material = .popover
        view.blendingMode = .behindWindow
        view.state = .active
        view.appearance = NSAppearance(named: .darkAqua)
        return view
    }

    func updateNSView(_ nsView: NSVisualEffectView, context: Context) {
        nsView.material = .popover
        nsView.blendingMode = .behindWindow
        nsView.state = .active
    }
}

// MARK: - Reliable AppKit Search Input for Non-Activating NSPanel

private final class IslandSearchNSTextField: NSTextField {
    override var acceptsFirstResponder: Bool { true }

    override func mouseDown(with event: NSEvent) {
        if let panel = self.window, !panel.isKeyWindow {
            panel.makeKey()
        }
        super.mouseDown(with: event)
        self.window?.makeFirstResponder(self)
    }
}

private struct DynamicIslandSearchField: NSViewRepresentable {
    @Binding var text: String
    @Binding var isFocused: Bool
    var focusSessionId: UUID
    var placeholder: String
    var onMoveUp: () -> Void
    var onMoveDown: () -> Void
    var onSubmit: () -> Void
    var onEscape: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeNSView(context: Context) -> NSTextField {
        let field = IslandSearchNSTextField()
        field.delegate = context.coordinator
        field.isBordered = false
        field.isBezeled = false
        field.drawsBackground = false
        field.backgroundColor = .clear
        field.focusRingType = .none
        field.font = NSFont.systemFont(ofSize: 13, weight: .regular)
        field.textColor = .white
        field.maximumNumberOfLines = 1
        field.cell?.wraps = false
        field.cell?.isScrollable = true
        field.placeholderAttributedString = NSAttributedString(
            string: placeholder,
            attributes: [
                .foregroundColor: NSColor.white.withAlphaComponent(0.42),
                .font: NSFont.systemFont(ofSize: 13, weight: .regular)
            ]
        )
        return field
    }

    func updateNSView(_ nsView: NSTextField, context: Context) {
        context.coordinator.parent = self
        if nsView.stringValue != text {
            nsView.stringValue = text
        }

        if context.coordinator.lastSessionId != focusSessionId {
            context.coordinator.lastSessionId = focusSessionId
            DispatchQueue.main.async {
                if let win = nsView.window {
                    if !win.isKeyWindow { win.makeKey() }
                    win.makeFirstResponder(nsView)
                }
            }
        }
    }

    final class Coordinator: NSObject, NSTextFieldDelegate {
        var parent: DynamicIslandSearchField
        var lastSessionId: UUID? = nil

        init(_ parent: DynamicIslandSearchField) {
            self.parent = parent
        }

        func controlTextDidBeginEditing(_ obj: Notification) {
            DispatchQueue.main.async {
                self.parent.isFocused = true
            }
        }

        func controlTextDidEndEditing(_ obj: Notification) {
            DispatchQueue.main.async {
                self.parent.isFocused = false
            }
        }

        func controlTextDidChange(_ obj: Notification) {
            guard let field = obj.object as? NSTextField else { return }
            let newVal = field.stringValue
            if self.parent.text != newVal {
                DispatchQueue.main.async {
                    self.parent.text = newVal
                }
            }
        }

        func control(_ control: NSControl, textView: NSTextView, doCommandBy commandSelector: Selector) -> Bool {
            if commandSelector == #selector(NSResponder.moveUp(_:)) {
                parent.onMoveUp()
                return true
            }
            if commandSelector == #selector(NSResponder.moveDown(_:)) {
                parent.onMoveDown()
                return true
            }
            if commandSelector == #selector(NSResponder.insertNewline(_:)) {
                parent.onSubmit()
                return true
            }
            if commandSelector == #selector(NSResponder.cancelOperation(_:)) {
                parent.onEscape()
                return true
            }
            return false
        }
    }
}

// MARK: - SwiftUI Overlay Popup View (Expanded iPhone Dynamic Island)

public struct AccessibilityAutofillPopupView: View {
    @ObservedObject private var autofillService = AccessibilityAutofillService.shared
    @ObservedObject private var vaultStore = VaultStore.shared

    @State private var searchText: String = ""
    @State private var isSearchFocused: Bool = false
    @State private var selectedIndex: Int = 0
    @State private var unlockPassword: String = ""
    @State private var unlockError: String? = nil
    @State private var isUnlocking: Bool = false
    @State private var revealedPasswords: Set<String> = []
    @State private var totpTick: Int = 0

    private let islandRadius: CGFloat = 28

    public init() {}

    private var targetAppName: String {
        autofillService.currentTargetApp?.localizedName ??
        autofillService.currentContext?.appName ??
        "Active App"
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
        let matching = all.filter { item in
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

        // Prioritize title prefix and favorite accounts first when searching
        let queryLower = trimmed.lowercased()
        return matching.sorted { a, b in
            let aStarts = a.title.lowercased().hasPrefix(queryLower)
            let bStarts = b.title.lowercased().hasPrefix(queryLower)
            if aStarts != bStarts { return aStarts }
            if a.favorite != b.favorite { return a.favorite }
            return a.title.localizedCaseInsensitiveCompare(b.title) == .orderedAscending
        }
    }

    private var displayedSuggestions: [VaultItem] {
        if !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return []
        }
        return autofillService.smartSuggestions
    }

    private var displayedOthers: [VaultItem] {
        let trimmed = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            return filteredItems.filter { item in !displayedSuggestions.contains(where: { $0.id == item.id }) }
        }
        return filteredItems
    }

    private var visibleOrderedItems: [VaultItem] {
        displayedSuggestions + displayedOthers
    }

    private var smartCalculatedHeight: CGFloat {
        if !vaultStore.isUnlocked {
            return 340
        }
        let totalVisible = visibleOrderedItems.count
        if totalVisible == 0 {
            return 410
        }
        if totalVisible == 1 {
            return 460
        }
        return 515
    }

    public var body: some View {
        ZStack {
            // Unified full-capsule frosted glass backdrop fading linearly from pure OLED black at top
            // into clear translucent Liquid Glass at the bottom.
            DynamicIslandGlassBackdrop()

            LinearGradient(
                stops: [
                    .init(color: .black, location: 0.0),
                    .init(color: .black, location: 0.56),
                    .init(color: Color.black.opacity(0.05), location: 1.0)
                ],
                startPoint: .top,
                endPoint: .bottom
            )

            VStack(spacing: 0) {
                blackDynamicIslandHeader

                if !vaultStore.isUnlocked {
                    lockedVaultView
                } else {
                    searchAndContentView
                }

                footerBar
            }
        }
        .frame(width: 360, height: smartCalculatedHeight)
        .clipShape(RoundedRectangle(cornerRadius: islandRadius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: islandRadius, style: .continuous)
                .stroke(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.18),
                            Color.white.opacity(0.08),
                            Color.white.opacity(0.28)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    ),
                    lineWidth: 0.9
                )
        )
        .shadow(color: Color.black.opacity(0.55), radius: 26, x: 0, y: 12)
        .onChange(of: smartCalculatedHeight) { _, newH in
            AccessibilityAutofillPanelManager.shared.updateHeight(newH)
        }
        .onChange(of: autofillService.panelSessionId) { _, _ in
            searchText = ""
            selectedIndex = 0
            AccessibilityAutofillPanelManager.shared.updateHeight(smartCalculatedHeight)
        }
        .onChange(of: searchText) { _, _ in
            selectedIndex = 0
        }
        .onAppear {
            AccessibilityAutofillPanelManager.shared.updateHeight(smartCalculatedHeight)
        }
        .onExitCommand {
            dismissToTargetApp()
        }
        .onReceive(Timer.publish(every: 1.0, on: .main, in: .common).autoconnect()) { _ in
            totpTick &+= 1
            autofillService.checkAccessibilityPermission()
        }
    }

    private func dismissToTargetApp() {
        autofillService.hidePanel()
        if let target = autofillService.currentTargetApp {
            target.activate()
        }
    }

    // MARK: - Above Part: Pitch Black Dynamic Island Crown

    private var blackDynamicIslandHeader: some View {
        VStack(spacing: 6) {
            // Iconic Dynamic Island top sensor/grabber pill
            Capsule()
                .fill(Color.white.opacity(0.16))
                .frame(width: 36, height: 3.5)
                .padding(.top, 7)

            HStack(spacing: 10) {
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [LiquidGlassTheme.purpleAccent, LiquidGlassTheme.primaryAccent],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 28, height: 28)

                    Image(systemName: "lock.shield.fill")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.white)
                }
                .shadow(color: LiquidGlassTheme.purpleAccent.opacity(0.45), radius: 6, x: 0, y: 2)

                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 5) {
                        Text("Kloak")
                            .font(.system(size: 12.5, weight: .bold, design: .rounded))
                            .foregroundColor(.white)

                        Circle()
                            .fill(LiquidGlassTheme.emeraldAccent)
                            .frame(width: 5, height: 5)

                        Text(targetAppName)
                            .font(.system(size: 11.5, weight: .semibold))
                            .foregroundColor(Color.white.opacity(0.88))
                            .lineLimit(1)
                    }

                    if let domain = targetDomain, !domain.isEmpty {
                        Text(domain)
                            .font(.system(size: 10, weight: .medium))
                            .foregroundColor(Color.white.opacity(0.55))
                            .lineLimit(1)
                    } else if let role = autofillService.focusedFieldRole {
                        Text("Field: \(role.replacingOccurrences(of: "AX", with: ""))")
                            .font(.system(size: 9.5, weight: .medium))
                            .foregroundColor(Color.white.opacity(0.55))
                            .lineLimit(1)
                    } else {
                        Text("All-App Quick Autofill")
                            .font(.system(size: 9.5, weight: .medium))
                            .foregroundColor(Color.white.opacity(0.50))
                    }
                }

                Spacer()

                if vaultStore.isUnlocked {
                    let matchCount = displayedSuggestions.count
                    if matchCount > 0 && searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        Text("\(matchCount) match\(matchCount == 1 ? "" : "es")")
                            .font(.system(size: 9.5, weight: .bold))
                            .foregroundColor(LiquidGlassTheme.emeraldAccent)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 3)
                            .background(LiquidGlassTheme.emeraldAccent.opacity(0.16))
                            .clipShape(Capsule())
                    }
                }

                Button(action: dismissToTargetApp) {
                    Image(systemName: "xmark")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.white.opacity(0.65))
                        .frame(width: 24, height: 24)
                        .background(Color.white.opacity(0.12))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .help("Close (Esc)")
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 10)
        }
    }

    // MARK: - Bottom Part: Search & Glass Content View

    private var searchAndContentView: some View {
        VStack(spacing: 10) {
            // Working AppKit-backed Frosted Glass Search Pill
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundColor(isSearchFocused ? LiquidGlassTheme.primaryAccent : Color.white.opacity(0.55))

                DynamicIslandSearchField(
                    text: $searchText,
                    isFocused: $isSearchFocused,
                    focusSessionId: autofillService.panelSessionId,
                    placeholder: "Search accounts, emails, or URLs...",
                    onMoveUp: {
                        let count = visibleOrderedItems.count
                        guard count > 0 else { return }
                        selectedIndex = (selectedIndex - 1 + count) % count
                    },
                    onMoveDown: {
                        let count = visibleOrderedItems.count
                        guard count > 0 else { return }
                        selectedIndex = (selectedIndex + 1) % count
                    },
                    onSubmit: {
                        let ordered = visibleOrderedItems
                        if ordered.indices.contains(selectedIndex) {
                            autofillService.performAutofill(item: ordered[selectedIndex], mode: .all)
                        } else if let first = ordered.first {
                            autofillService.performAutofill(item: first, mode: .all)
                        }
                    },
                    onEscape: {
                        if !searchText.isEmpty {
                            searchText = ""
                        } else {
                            dismissToTargetApp()
                        }
                    }
                )
                .frame(height: 20)

                if !searchText.isEmpty {
                    Text("\(filteredItems.count)")
                        .font(.system(size: 10, weight: .semibold, design: .monospaced))
                        .foregroundColor(.white.opacity(0.55))

                    Button(action: { searchText = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 12))
                            .foregroundColor(.white.opacity(0.55))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.white.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(
                        isSearchFocused ? LiquidGlassTheme.primaryAccent.opacity(0.75) : Color.white.opacity(0.14),
                        lineWidth: isSearchFocused ? 1.2 : 0.8
                    )
            )
            .padding(.horizontal, 14)
            .padding(.top, 12)

            if !autofillService.isAccessibilityTrusted {
                accessibilityNoticeBanner
            }

            // Items List
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 8) {
                        let suggestions = displayedSuggestions
                        let others = displayedOthers
                        let ordered = visibleOrderedItems
                        let selectedId = ordered.indices.contains(selectedIndex) ? ordered[selectedIndex].id : nil

                        if !suggestions.isEmpty {
                            VStack(alignment: .leading, spacing: 6) {
                                HStack(spacing: 5) {
                                    Image(systemName: "sparkles")
                                        .font(.system(size: 10, weight: .bold))
                                        .foregroundColor(LiquidGlassTheme.purpleAccent)
                                    Text("MATCHED FOR \(targetAppName.uppercased())")
                                        .font(.system(size: 10, weight: .bold))
                                        .foregroundColor(Color.white.opacity(0.65))
                                }
                                .padding(.horizontal, 4)

                                ForEach(suggestions) { item in
                                    autofillItemCard(
                                        item,
                                        isHighlighted: true,
                                        isSelected: item.id == selectedId
                                    )
                                    .id(item.id)
                                }
                            }
                        }

                        if !others.isEmpty {
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text(searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                        ? (suggestions.isEmpty ? "ALL ACCOUNTS (\(others.count))" : "OTHER ACCOUNTS (\(others.count))")
                                        : "SEARCH RESULTS (\(others.count))")
                                        .font(.system(size: 10, weight: .bold))
                                        .foregroundColor(Color.white.opacity(0.55))
                                    Spacer()
                                }
                                .padding(.horizontal, 4)
                                .padding(.top, suggestions.isEmpty ? 0 : 6)

                                ForEach(others) { item in
                                    autofillItemCard(
                                        item,
                                        isHighlighted: false,
                                        isSelected: item.id == selectedId
                                    )
                                    .id(item.id)
                                }
                            }
                        }

                        if suggestions.isEmpty && others.isEmpty {
                            emptyStateView
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.bottom, 8)
                }
                .onChange(of: selectedIndex) { _, newIdx in
                    let ordered = visibleOrderedItems
                    if ordered.indices.contains(newIdx) {
                        withAnimation(.easeOut(duration: 0.14)) {
                            proxy.scrollTo(ordered[newIdx].id, anchor: .center)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Individual Item Glass Bento Card

    @ViewBuilder
    private func autofillItemCard(_ item: VaultItem, isHighlighted: Bool, isSelected: Bool) -> some View {
        let _ = totpTick // refresh live TOTP countdown once per second

        VStack(spacing: 7) {
            // Bento Header Compartment
            HStack(spacing: 9) {
                FaviconView(urls: item.urls, title: item.title, itemType: item.type, size: 26)

                VStack(alignment: .leading, spacing: 1.5) {
                    HStack(spacing: 4) {
                        Text(item.title)
                            .font(.system(size: 12.5, weight: .bold))
                            .foregroundColor(.white)
                            .lineLimit(1)

                        if item.favorite {
                            Image(systemName: "star.fill")
                                .font(.system(size: 9))
                                .foregroundColor(LiquidGlassTheme.amberAccent)
                        }
                    }

                    if let domain = item.urls.first {
                        let cleanHost = domain.replacingOccurrences(of: "https://", with: "")
                            .replacingOccurrences(of: "http://", with: "")
                            .components(separatedBy: "/").first ?? ""
                        Text(cleanHost)
                            .font(.system(size: 10))
                            .foregroundColor(Color.white.opacity(0.58))
                            .lineLimit(1)
                    } else if let user = item.username, !user.isEmpty {
                        Text(user)
                            .font(.system(size: 10))
                            .foregroundColor(Color.white.opacity(0.58))
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
                            .font(.system(size: 10.5, weight: .bold))
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(
                        LinearGradient(
                            colors: [LiquidGlassTheme.purpleAccent, LiquidGlassTheme.primaryAccent],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .foregroundColor(.white)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }

            // Horizontal Bento Compartments (User, Password, 2FA OTP, Recovery)
            VStack(spacing: 5) {
                if let user = item.username, !user.isEmpty {
                    bentoCompartmentRow(
                        label: "USER",
                        value: user,
                        isMono: false,
                        onFill: { autofillService.performAutofill(item: item, mode: .usernameOnly) },
                        onCopy: { copyString(user) }
                    )
                }

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

                if item.isRecoveryCode || item.recoveryCodesCount > 0 {
                    bentoRecoveryCodesRow(item: item)
                }
            }
        }
        .padding(11)
        .background(
            RoundedRectangle(cornerRadius: 15, style: .continuous)
                .fill(
                    isSelected
                        ? Color.white.opacity(0.11)
                        : (isHighlighted ? Color.white.opacity(0.08) : Color.black.opacity(0.24))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 15, style: .continuous)
                        .stroke(
                            isSelected
                                ? LiquidGlassTheme.primaryAccent.opacity(0.75)
                                : (isHighlighted ? LiquidGlassTheme.purpleAccent.opacity(0.45) : Color.white.opacity(0.10)),
                            lineWidth: isSelected ? 1.25 : 0.9
                        )
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
                .foregroundColor(Color.white.opacity(0.50))
                .frame(width: 34, alignment: .leading)

            Text(value)
                .font(isMono ? .system(size: 11.5, weight: .medium, design: .monospaced) : .system(size: 11.5))
                .foregroundColor(.white)
                .lineLimit(1)
                .truncationMode(.middle)

            Spacer()

            if let rev = revealAction {
                Button(action: rev) {
                    Image(systemName: isRevealed ? "eye.slash" : "eye")
                        .font(.system(size: 10.5))
                        .foregroundColor(.white.opacity(0.6))
                }
                .buttonStyle(.plain)
            }

            Button(action: onFill) {
                Text("⚡ Fill")
                    .font(.system(size: 9.5, weight: .semibold))
                    .foregroundColor(LiquidGlassTheme.primaryAccent)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2.5)
                    .background(LiquidGlassTheme.primaryAccent.opacity(0.15))
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)

            Button(action: onCopy) {
                Image(systemName: "doc.on.doc")
                    .font(.system(size: 10))
                    .foregroundColor(.white.opacity(0.6))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(Color.black.opacity(0.28))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
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
                .padding(.horizontal, 5)
                .padding(.vertical, 2)
                .background(LiquidGlassTheme.amberAccent.opacity(0.14))
                .clipShape(RoundedRectangle(cornerRadius: 4))

            Text(code)
                .font(.system(size: 12, weight: .bold, design: .monospaced))
                .foregroundColor(LiquidGlassTheme.amberAccent)

            Text("\(remainingSeconds)s")
                .font(.system(size: 9.5, weight: .medium, design: .monospaced))
                .foregroundColor(.white.opacity(0.6))

            Spacer()

            Button(action: onFill) {
                Text("⚡ Fill")
                    .font(.system(size: 9.5, weight: .semibold))
                    .foregroundColor(LiquidGlassTheme.amberAccent)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2.5)
                    .background(LiquidGlassTheme.amberAccent.opacity(0.15))
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)

            Button(action: onCopy) {
                Image(systemName: "doc.on.doc")
                    .font(.system(size: 10))
                    .foregroundColor(.white.opacity(0.6))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(Color.black.opacity(0.28))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
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
                .padding(.horizontal, 5)
                .padding(.vertical, 2)
                .background(LiquidGlassTheme.emeraldAccent.opacity(0.14))
                .clipShape(RoundedRectangle(cornerRadius: 4))

            if !nextCode.isEmpty && !isAllUsed {
                Text("#\(nextIndex + 1): \(nextCode)")
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundColor(.white)
                    .lineLimit(1)
            } else {
                Text(isAllUsed ? "All codes used" : "Recovery codes")
                    .font(.system(size: 11))
                    .foregroundColor(.white.opacity(0.6))
            }

            Spacer()

            if !nextCode.isEmpty && !isAllUsed {
                Button(action: {
                    VaultStore.shared.toggleRecoveryCodeUsed(itemId: item.id, index: nextIndex)
                }) {
                    Image(systemName: "checkmark.circle")
                        .font(.system(size: 11.5))
                        .foregroundColor(LiquidGlassTheme.emeraldAccent)
                }
                .buttonStyle(.plain)
                .help("Mark code as used")

                Button(action: {
                    copyString(nextCode)
                    VaultStore.shared.toggleRecoveryCodeUsed(itemId: item.id, index: nextIndex)
                }) {
                    Text("⚡ Fill")
                        .font(.system(size: 9.5, weight: .bold))
                        .foregroundColor(LiquidGlassTheme.emeraldAccent)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2.5)
                        .background(LiquidGlassTheme.emeraldAccent.opacity(0.15))
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(Color.black.opacity(0.28))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }

    private func copyString(_ text: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: 10) {
            Spacer(minLength: 28)

            Image(systemName: "magnifyingglass")
                .font(.system(size: 28, weight: .light))
                .foregroundColor(.white.opacity(0.45))

            Text("No Matching Logins")
                .font(.system(size: 13.5, weight: .bold))
                .foregroundColor(.white)

            let queryForDisplay = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
            Text("No saved credentials found for \"\(queryForDisplay.isEmpty ? targetAppName : queryForDisplay)\".")
                .font(.system(size: 11.5))
                .foregroundColor(.white.opacity(0.60))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 20)

            if !queryForDisplay.isEmpty {
                Button(action: { searchText = "" }) {
                    Text("Clear Search")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 5)
                        .background(Color.white.opacity(0.12))
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }

            Spacer(minLength: 28)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
    }

    // MARK: - Accessibility Notice Banner

    private var accessibilityNoticeBanner: some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(LiquidGlassTheme.amberAccent)
                .font(.system(size: 13))

            VStack(alignment: .leading, spacing: 1) {
                Text("Accessibility not active")
                    .font(.system(size: 10.5, weight: .bold))
                    .foregroundColor(.white)
                Text("Auto-typing disabled. Click items to copy.")
                    .font(.system(size: 9.5))
                    .foregroundColor(.white.opacity(0.65))
            }

            Spacer()

            Button(action: {
                autofillService.requestAccessibilityPermission()
            }) {
                Text("Enable")
                    .font(.system(size: 10, weight: .bold))
                    .padding(.horizontal, 9)
                    .padding(.vertical, 4)
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
                    .padding(5)
                    .background(Color.white.opacity(0.12))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .help("Recheck accessibility status")
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(LiquidGlassTheme.amberAccent.opacity(0.14))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(LiquidGlassTheme.amberAccent.opacity(0.35), lineWidth: 0.8)
        )
        .padding(.horizontal, 14)
    }

    // MARK: - Locked Vault View

    private var lockedVaultView: some View {
        VStack(spacing: 14) {
            Spacer()

            ZStack {
                Circle()
                    .fill(Color.white.opacity(0.10))
                    .frame(width: 48, height: 48)

                Image(systemName: "lock.fill")
                    .font(.system(size: 20))
                    .foregroundColor(.white)
            }

            VStack(spacing: 4) {
                Text("Vault Locked")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.white)

                Text("Unlock to autofill in \(targetAppName)")
                    .font(.system(size: 11))
                    .foregroundColor(.white.opacity(0.6))
            }

            SecureField("Enter Master Password", text: $unlockPassword)
                .textFieldStyle(.plain)
                .font(.system(size: 12.5))
                .foregroundColor(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 9)
                .background(Color.white.opacity(0.10))
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(Color.white.opacity(0.16), lineWidth: 0.8)
                )
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
                    HStack(spacing: 5) {
                        if isUnlocking {
                            ProgressView()
                                .scaleEffect(0.6)
                                .frame(width: 12, height: 12)
                        } else {
                            Image(systemName: "lock.open.fill")
                        }
                        Text("Unlock & Autofill")
                    }
                    .font(.system(size: 11.5, weight: .bold))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(
                        LinearGradient(
                            colors: [LiquidGlassTheme.purpleAccent, LiquidGlassTheme.primaryAccent],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
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
                            .font(.system(size: 17))
                            .foregroundColor(.white)
                            .padding(8)
                            .background(Color.white.opacity(0.12))
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .help("Unlock with Touch ID")
                }
            }

            Spacer()
        }
        .padding(.horizontal, 16)
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

    // MARK: - Glass Footer Bar

    private var footerBar: some View {
        HStack {
            if let toast = autofillService.toastMessage {
                HStack(spacing: 5) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(LiquidGlassTheme.emeraldAccent)
                    Text(toast)
                        .foregroundColor(LiquidGlassTheme.emeraldAccent)
                }
                .font(.system(size: 10.5, weight: .semibold))
            } else {
                Text("↑↓ Select  ·  ↵ Fill  ·  Esc Close")
                    .font(.system(size: 10, weight: .medium, design: .monospaced))
                    .foregroundColor(.white.opacity(0.75))
                    .shadow(color: .black.opacity(0.6), radius: 2, y: 1)
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
                .font(.system(size: 10.5, weight: .semibold))
                .foregroundColor(.white.opacity(0.92))
                .padding(.horizontal, 9)
                .padding(.vertical, 4)
                .background(Color.white.opacity(0.14))
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 12)
    }
}
