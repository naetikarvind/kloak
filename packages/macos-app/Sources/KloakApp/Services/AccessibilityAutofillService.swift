import Foundation
import AppKit
import ApplicationServices
import Carbon.HIToolbox

public enum AutofillMode: Sendable {
    case all             // Fill Username, Tab, Fill Password
    case usernameOnly    // Fill Username only
    case passwordOnly    // Fill Password only
    case totpOnly        // Copy 2FA TOTP code to pasteboard
}

/// System-Wide Accessibility-Powered Autofill Service.
/// Detects frontmost native applications and browser fields, calculates coordinates using
/// macOS Accessibility APIs (AXUIElement), and presents a floating non-activating overlay
/// with one-click credential injection and keyboard shortcuts (⌘\).
public final class AccessibilityAutofillService: ObservableObject, @unchecked Sendable {
    public static let shared = AccessibilityAutofillService()

    // MARK: - Published State
    @Published public var isPanelVisible: Bool = false
    @Published public var currentTargetApp: NSRunningApplication? = nil
    @Published public var currentContext: ActiveContext? = nil
    @Published public var smartSuggestions: [VaultItem] = []
    @Published public var isAccessibilityTrusted: Bool = false
    @Published public var focusedFieldRole: String? = nil
    @Published public var toastMessage: String? = nil

    // MARK: - Event Monitors & Carbon HotKey
    private var globalEventMonitor: Any? = nil
    private var localEventMonitor: Any? = nil
    private var mouseClickMonitor: Any? = nil

    // Carbon Global HotKey
    private var carbonHotKeyRef: EventHotKeyRef?
    private var carbonHotKeyRefISO: EventHotKeyRef?
    private var carbonEventHandler: EventHandlerRef?
    private let hotKeySignature: OSType = 0x4B4C4F41 // 'KLOA'
    private let hotKeyIDNumber: UInt32 = 1
    private var lastTriggerTime: Date = .distantPast

    // Cached hotkey settings to avoid cross-actor access during event monitoring
    public private(set) var cachedHotkeyKeyCode: Int = 42
    public private(set) var cachedHotkeyModifiers: UInt = 1048576
    public private(set) var cachedAutofillEnabled: Bool = true

    public func updateHotkeyConfig(keyCode: Int, modifiers: UInt, enabled: Bool) {
        self.cachedHotkeyKeyCode = keyCode
        self.cachedHotkeyModifiers = modifiers
        self.cachedAutofillEnabled = enabled

        DispatchQueue.main.async { [weak self] in
            self?.registerCarbonHotKey()
        }
    }

    public static func isProcessTrusted() -> Bool {
        let options = ["AXTrustedCheckOptionPrompt": false] as CFDictionary
        return AXIsProcessTrustedWithOptions(options) || AXIsProcessTrusted()
    }

    private init() {
        self.isAccessibilityTrusted = Self.isProcessTrusted()
    }

    // MARK: - Service Lifecycle

    public func start() {
        self.isAccessibilityTrusted = Self.isProcessTrusted()
        registerHotkeyMonitors()
        registerCarbonHotKey()
        Task { @MainActor in
            let s = VaultStore.shared.settings
            self.updateHotkeyConfig(
                keyCode: s.autofillHotkeyKeyCode,
                modifiers: s.autofillHotkeyModifiers,
                enabled: s.accessibilityAutofillEnabled
            )
        }
    }

    public func stop() {
        unregisterCarbonHotKey()
        if let h = carbonEventHandler {
            RemoveEventHandler(h)
            carbonEventHandler = nil
        }
        if let d = carbonDispatcherHandler {
            RemoveEventHandler(d)
            carbonDispatcherHandler = nil
        }
        if let g = globalEventMonitor { NSEvent.removeMonitor(g); globalEventMonitor = nil }
        if let l = localEventMonitor { NSEvent.removeMonitor(l); localEventMonitor = nil }
        if let m = mouseClickMonitor { NSEvent.removeMonitor(m); mouseClickMonitor = nil }
    }

    // MARK: - Accessibility Permissions

    @discardableResult
    public func checkAccessibilityPermission() -> Bool {
        let trusted = Self.isProcessTrusted()
        DispatchQueue.main.async {
            if self.isAccessibilityTrusted != trusted {
                self.isAccessibilityTrusted = trusted
            }
        }
        return trusted
    }

    public func requestAccessibilityPermission() {
        let options = ["AXTrustedCheckOptionPrompt": true] as CFDictionary
        let trusted = AXIsProcessTrustedWithOptions(options) || AXIsProcessTrusted()
        DispatchQueue.main.async {
            self.isAccessibilityTrusted = trusted
        }
        if !trusted {
            if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility") {
                NSWorkspace.shared.open(url)
            }
        }
    }

    // MARK: - Carbon Global HotKey Registration

    private var carbonDispatcherHandler: EventHandlerRef?

    private func installCarbonEventHandlerIfNeeded() {
        guard carbonEventHandler == nil && carbonDispatcherHandler == nil else { return }

        var eventType = EventTypeSpec(
            eventClass: OSType(kEventClassKeyboard),
            eventKind: UInt32(kEventHotKeyPressed)
        )

        let hotKeyCallback: EventHandlerUPP = { (nextHandler: EventHandlerCallRef?, theEvent: EventRef?, userData: UnsafeMutableRawPointer?) -> OSStatus in
            guard let theEvent = theEvent else { return noErr }
            var hkID = EventHotKeyID()
            let err = GetEventParameter(
                theEvent,
                EventParamName(kEventParamDirectObject),
                EventParamType(typeEventHotKeyID),
                nil,
                MemoryLayout<EventHotKeyID>.size,
                nil,
                &hkID
            )

            if err == noErr && hkID.signature == OSType(0x4B4C4F41) && (hkID.id == 1 || hkID.id == 2) {
                DispatchQueue.main.async {
                    AccessibilityAutofillService.shared.toggleAutofill()
                }
                return noErr
            }
            return CallNextEventHandler(nextHandler, theEvent)
        }

        // Install on Event Dispatcher Target (receives global hotkeys from system)
        _ = InstallEventHandler(
            GetEventDispatcherTarget(),
            hotKeyCallback,
            1,
            &eventType,
            nil,
            &carbonDispatcherHandler
        )

        // Also install on Application Event Target as fallback
        _ = InstallEventHandler(
            GetApplicationEventTarget(),
            hotKeyCallback,
            1,
            &eventType,
            nil,
            &carbonEventHandler
        )
    }

    private func carbonModifiers(from cocoaModifiers: UInt) -> UInt32 {
        let flags = NSEvent.ModifierFlags(rawValue: cocoaModifiers)
        var carbonFlags: UInt32 = 0
        if flags.contains(.command) { carbonFlags |= UInt32(cmdKey) }
        if flags.contains(.option) { carbonFlags |= UInt32(optionKey) }
        if flags.contains(.control) { carbonFlags |= UInt32(controlKey) }
        if flags.contains(.shift) { carbonFlags |= UInt32(shiftKey) }
        return carbonFlags
    }

    public func registerCarbonHotKey() {
        unregisterCarbonHotKey()

        guard cachedAutofillEnabled else { return }

        installCarbonEventHandlerIfNeeded()

        var carbonMods = carbonModifiers(from: cachedHotkeyModifiers)
        // If no modifiers specified on letter/number key, require cmdKey to prevent hijacking typing
        if carbonMods == 0 && cachedHotkeyKeyCode < 90 {
            carbonMods = UInt32(cmdKey)
        }

        let hkID = EventHotKeyID(signature: hotKeySignature, id: hotKeyIDNumber)

        // Register with GetApplicationEventTarget as primary (Carbon standard for application hotkeys)
        var regStatus = RegisterEventHotKey(
            UInt32(cachedHotkeyKeyCode),
            carbonMods,
            hkID,
            GetApplicationEventTarget(),
            0,
            &carbonHotKeyRef
        )

        if regStatus != noErr {
            NSLog("[Kloak] RegisterEventHotKey on ApplicationEventTarget returned %d. Trying Dispatcher target...", regStatus)
            regStatus = RegisterEventHotKey(
                UInt32(cachedHotkeyKeyCode),
                carbonMods,
                hkID,
                GetEventDispatcherTarget(),
                0,
                &carbonHotKeyRef
            )
        }

        if regStatus == noErr {
            NSLog("[Kloak] Successfully registered Carbon system-wide hotkey (code: %d, mods: %u)", cachedHotkeyKeyCode, carbonMods)
        } else {
            NSLog("[Kloak] Warning: Carbon hotkey registration failed with status: %d", regStatus)
        }

        // On ISO keyboard layouts (e.g. ABC-India / UK), register keycode 10 as alternate backslash
        if cachedHotkeyKeyCode == 42 {
            let hkID_ISO = EventHotKeyID(signature: hotKeySignature, id: 2)
            _ = RegisterEventHotKey(
                10,
                carbonMods,
                hkID_ISO,
                GetApplicationEventTarget(),
                0,
                &carbonHotKeyRefISO
            )
        }
    }

    public func unregisterCarbonHotKey() {
        if let ref = carbonHotKeyRef {
            UnregisterEventHotKey(ref)
            carbonHotKeyRef = nil
        }
        if let refISO = carbonHotKeyRefISO {
            UnregisterEventHotKey(refISO)
            carbonHotKeyRefISO = nil
        }
    }

    // MARK: - Hotkey Event Monitors (Local & Fallback)

    private func registerHotkeyMonitors() {
        if let g = globalEventMonitor { NSEvent.removeMonitor(g); globalEventMonitor = nil }
        if let l = localEventMonitor { NSEvent.removeMonitor(l); localEventMonitor = nil }

        // Global monitor fallback: receives events when another application is active
        globalEventMonitor = NSEvent.addGlobalMonitorForEvents(matching: .keyDown) { [weak self] event in
            self?.handleKeyEvent(event)
        }

        // Local monitor: receives events when Kloak itself is active
        localEventMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            if let self = self, self.isHotkeyMatch(event) {
                self.toggleAutofill()
                return nil // Consume event
            }
            return event
        }
    }

    private func isHotkeyMatch(_ event: NSEvent) -> Bool {
        guard cachedAutofillEnabled else { return false }

        let keyMatches: Bool
        if event.keyCode == UInt16(cachedHotkeyKeyCode) {
            keyMatches = true
        } else if cachedHotkeyKeyCode == 42 {
            // Support ISO backslash key (10) and charactersIgnoringModifiers == "\"
            keyMatches = (event.keyCode == 10 || event.charactersIgnoringModifiers == "\\")
        } else {
            keyMatches = false
        }
        guard keyMatches else { return false }

        let eventModifiers = event.modifierFlags.intersection([.command, .option, .control, .shift])
        let targetModifiers = NSEvent.ModifierFlags(rawValue: cachedHotkeyModifiers).intersection([.command, .option, .control, .shift])

        if targetModifiers.isEmpty {
            return eventModifiers == .command
        }
        return eventModifiers == targetModifiers
    }

    private func handleKeyEvent(_ event: NSEvent) {
        if isHotkeyMatch(event) {
            DispatchQueue.main.async { [weak self] in
                self?.toggleAutofill()
            }
        }
    }

    // MARK: - Trigger Autofill

    public func toggleAutofill() {
        let now = Date()
        guard now.timeIntervalSince(lastTriggerTime) > 0.25 else { return }
        lastTriggerTime = now

        if isPanelVisible {
            hidePanel()
        } else {
            triggerAutofill()
        }
    }

    public func triggerAutofill(preferredApp: NSRunningApplication? = nil) {
        checkAccessibilityPermission()

        // 1. Identify target external application
        let targetApp: NSRunningApplication? = {
            if let preferred = preferredApp {
                return preferred
            }
            let front = NSWorkspace.shared.frontmostApplication
            let myBundleId = Bundle.main.bundleIdentifier ?? "com.kloak.app"
            if let f = front, f.bundleIdentifier != myBundleId && f.bundleIdentifier != "app.kloak.macos" && f.activationPolicy == .regular {
                return f
            }
            return ActiveContextService.shared.lastExternalApp ?? ActiveContextService.shared.getTargetExternalApplication()
        }()

        self.currentTargetApp = targetApp

        // 2. Query Context and Smart Suggestions
        let context = ActiveContextService.shared.getActiveContext()
        self.currentContext = context

        Task { @MainActor in
            let items = VaultStore.shared.items
            let matches = ActiveContextService.shared.findSmartSuggestions(in: items, context: context)
            self.smartSuggestions = matches
        }

        // 3. Inspect Focused Accessibility Element Coordinates
        var targetRect: NSRect? = nil
        var fieldRole: String? = nil

        if let app = targetApp, Self.isProcessTrusted() {
            let pid = app.processIdentifier
            let appElement = AXUIElementCreateApplication(pid)

            var focusedElementRef: CFTypeRef?
            let axErr = AXUIElementCopyAttributeValue(appElement, kAXFocusedUIElementAttribute as CFString, &focusedElementRef)

            if axErr == .success, let focusedRef = focusedElementRef {
                let focusedElement = focusedRef as! AXUIElement

                // Extract Role
                var roleRef: CFTypeRef?
                if AXUIElementCopyAttributeValue(focusedElement, kAXRoleAttribute as CFString, &roleRef) == .success,
                   let r = roleRef as? String {
                    fieldRole = r
                }

                // Extract Position & Size
                var posRef: CFTypeRef?
                var sizeRef: CFTypeRef?
                var point = CGPoint.zero
                var size = CGSize.zero

                if AXUIElementCopyAttributeValue(focusedElement, kAXPositionAttribute as CFString, &posRef) == .success,
                   let pRef = posRef, AXValueGetType(pRef as! AXValue) == .cgPoint {
                    AXValueGetValue(pRef as! AXValue, .cgPoint, &point)
                }

                if AXUIElementCopyAttributeValue(focusedElement, kAXSizeAttribute as CFString, &sizeRef) == .success,
                   let sRef = sizeRef, AXValueGetType(sRef as! AXValue) == .cgSize {
                    AXValueGetValue(sRef as! AXValue, .cgSize, &size)
                }

                if size.width > 0 && size.height > 0 {
                    // Convert AX top-left coordinates to Cocoa screen bottom-left coordinates
                    let primaryHeight = NSScreen.screens.first?.frame.height ?? 1080
                    let cocoaY = primaryHeight - point.y - size.height
                    targetRect = NSRect(x: point.x, y: cocoaY, width: size.width, height: size.height)
                }
            }
        }

        self.focusedFieldRole = fieldRole

        // 4. Show Floating Panel
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            AccessibilityAutofillPanelManager.shared.show(anchoredTo: targetRect, targetAppName: targetApp?.localizedName ?? context.appName)
            self.isPanelVisible = true
            self.startClickOutsideMonitor()
        }
    }

    public func hidePanel() {
        DispatchQueue.main.async {
            AccessibilityAutofillPanelManager.shared.hide()
            self.isPanelVisible = false
        }
        if let m = mouseClickMonitor {
            NSEvent.removeMonitor(m)
            mouseClickMonitor = nil
        }
    }

    private func startClickOutsideMonitor() {
        if let m = mouseClickMonitor { NSEvent.removeMonitor(m) }
        mouseClickMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown]) { [weak self] _ in
            guard let self = self, self.isPanelVisible else { return }
            let mouseLoc = NSEvent.mouseLocation
            DispatchQueue.main.async {
                if let panel = AccessibilityAutofillPanelManager.shared.panel {
                    if !NSPointInRect(mouseLoc, panel.frame) {
                        self.hidePanel()
                    }
                }
            }
        }
    }

    // MARK: - Input Injection & Autofill Execution

    public func performAutofill(item: VaultItem, mode: AutofillMode) {
        let front = NSWorkspace.shared.frontmostApplication
        let resolvedTarget: NSRunningApplication? = {
            if let curr = currentTargetApp { return curr }
            if let f = front,
               let bid = f.bundleIdentifier,
               bid != Bundle.main.bundleIdentifier,
               bid != "com.kloak.app",
               bid != "app.kloak.macos",
               bid != "com.raycast.macos" {
                return f
            }
            return ActiveContextService.shared.getTargetExternalApplication() ?? ActiveContextService.shared.lastExternalApp
        }()

        guard let targetApp = resolvedTarget else {
            showToast("No target application selected")
            hidePanel()
            return
        }

        // Check if accessibility permission is trusted; if not, fallback to copying credentials to clipboard
        if !Self.isProcessTrusted() {
            let pasteboard = NSPasteboard.general
            pasteboard.clearContents()
            var message = ""

            switch mode {
            case .all:
                if let pass = item.password, !pass.isEmpty {
                    pasteboard.setString(pass, forType: .string)
                    message = "Password copied to clipboard (Enable Accessibility to auto-type)"
                } else if let user = item.username, !user.isEmpty {
                    pasteboard.setString(user, forType: .string)
                    message = "Username copied to clipboard"
                }
            case .usernameOnly:
                if let user = item.username, !user.isEmpty {
                    pasteboard.setString(user, forType: .string)
                    message = "Username copied to clipboard"
                }
            case .passwordOnly:
                if let pass = item.password, !pass.isEmpty {
                    pasteboard.setString(pass, forType: .string)
                    message = "Password copied to clipboard"
                }
            case .totpOnly:
                if let secret = item.totpSecret,
                   let totp = TOTPEngine.shared.generate(secretBase32: secret) {
                    pasteboard.setString(totp.token, forType: .string)
                    message = "2FA code \(totp.token) copied to clipboard"
                }
            }

            self.showToast(message)
            hidePanel()
            targetApp.activate()
            return
        }

        // Hide panel immediately to restore clear view of the target app
        hidePanel()

        // Reactivate target app
        targetApp.activate()

        // Perform keyboard injection on interactive background thread
        DispatchQueue.global(qos: .userInteractive).asyncAfter(deadline: .now() + 0.12) { [weak self] in
            guard let self = self else { return }

            switch mode {
            case .all:
                let hasUsername = (item.username?.isEmpty == false)
                let hasPassword = (item.password?.isEmpty == false)

                if hasUsername, let user = item.username {
                    self.pasteString(user)
                    if hasPassword, let pass = item.password {
                        // Wait for username to register, then send Tab to advance to password field
                        usleep(110_000) // 110ms
                        self.postKeyEvent(keyCode: 0x30) // Tab
                        usleep(130_000) // 130ms
                        self.pasteString(pass)
                    }
                } else if hasPassword, let pass = item.password {
                    self.pasteString(pass)
                }

                self.showToast("Credentials filled into \(targetApp.localizedName ?? "app")")

            case .usernameOnly:
                if let user = item.username, !user.isEmpty {
                    self.pasteString(user)
                    self.showToast("Username filled")
                }

            case .passwordOnly:
                if let pass = item.password, !pass.isEmpty {
                    self.pasteString(pass)
                    self.showToast("Password filled")
                }

            case .totpOnly:
                if let secret = item.totpSecret,
                   let totp = TOTPEngine.shared.generate(secretBase32: secret) {
                    DispatchQueue.main.async {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(totp.token, forType: .string)
                    }
                    self.showToast("2FA code \(totp.token) copied to clipboard")
                }
            }
        }
    }

    // MARK: - Low-Level CGEvent Keyboard Simulation

    private func pasteString(_ string: String) {
        let pasteboard = NSPasteboard.general
        let previousString = pasteboard.string(forType: .string)

        pasteboard.clearContents()
        pasteboard.setString(string, forType: .string)

        // Simulate Cmd+V (virtual key 0x09)
        postKeyEvent(keyCode: 0x09, flags: .maskCommand)

        // Clean up clipboard for passwords to prevent leakage
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) {
            if pasteboard.string(forType: .string) == string {
                pasteboard.clearContents()
                if let prev = previousString {
                    pasteboard.setString(prev, forType: .string)
                }
            }
        }
    }

    private func postKeyEvent(keyCode: CGKeyCode, flags: CGEventFlags = []) {
        let source = CGEventSource(stateID: .hidSystemState)

        if let keyDown = CGEvent(keyboardEventSource: source, virtualKey: keyCode, keyDown: true) {
            keyDown.flags = flags
            keyDown.post(tap: .cghidEventTap)
        }

        usleep(20_000) // 20ms key down duration

        if let keyUp = CGEvent(keyboardEventSource: source, virtualKey: keyCode, keyDown: false) {
            keyUp.flags = flags
            keyUp.post(tap: .cghidEventTap)
        }
    }

    private func showToast(_ message: String) {
        DispatchQueue.main.async {
            self.toastMessage = message
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
                if self.toastMessage == message {
                    self.toastMessage = nil
                }
            }
        }
    }
}
