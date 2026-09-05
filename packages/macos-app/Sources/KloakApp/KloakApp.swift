import SwiftUI
import AppKit

public final class AppDelegate: NSObject, NSApplicationDelegate {
    public func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
        // macOS automatically resolves and renders AppIcon.icon from Info.plist & bundle resources

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            if let window = NSApp.windows.first {
                window.makeKeyAndOrderFront(nil)
            }
        }
    }

    public func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return false
    }
}

@main
public struct KloakApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var vaultStore = VaultStore.shared

    public init() {
        IPCServer.shared.start()
    }

    public var body: some Scene {
        WindowGroup {
            Group {
                if !vaultStore.hasVault {
                    SetupView()
                        .onAppear {
                            WindowSizeManager.shared.resize(to: .setup)
                        }
                } else if vaultStore.isUnlocked {
                    VaultMainView(
                        isUnlocked: $vaultStore.isUnlocked,
                        items: $vaultStore.items,
                        folders: vaultStore.folders,
                        settings: $vaultStore.settings,
                        onLock: {
                            vaultStore.lock()
                        },
                        onSaveItem: { updatedItem in
                            vaultStore.saveItem(updatedItem)
                        },
                        onDeleteItem: { id in
                            vaultStore.deleteItem(id: id)
                        },
                        onSaveSettings: { newSettings in
                            vaultStore.updateSettings(newSettings)
                        },
                        onImport: { content, format in
                            let parsedItems = parseImportContent(content, format: format)
                            return vaultStore.bulkImport(parsedItems)
                        },
                        onExport: { format, password in
                            return vaultStore.exportVault(format: format, password: password)
                        },
                        onChangeMasterPassword: { oldP, newP in
                            var success = false
                            let semaphore = DispatchSemaphore(value: 0)
                            Task {
                                success = await vaultStore.changeMasterPassword(oldPassword: oldP, newPassword: newP)
                                semaphore.signal()
                            }
                            _ = semaphore.wait(timeout: .now() + 5.0)
                            return success
                        }
                    )
                    .onAppear {
                        WindowSizeManager.shared.resize(to: .vaultItems)
                    }
                } else {
                    UnlockView(
                        isUnlocked: $vaultStore.isUnlocked,
                        onUnlock: { password in
                            await vaultStore.unlock(password: password)
                        },
                        onBiometricUnlock: {
                            await vaultStore.unlockWithBiometrics()
                        }
                    )
                    .onAppear {
                        WindowSizeManager.shared.resize(to: .unlock)
                    }
                }
            }
            .onChange(of: vaultStore.isUnlocked) { _, isUnlocked in
                if !isUnlocked {
                    WindowSizeManager.shared.resize(to: .unlock)
                } else {
                    WindowSizeManager.shared.resize(to: .vaultItems)
                }
            }
            .frame(minWidth: 420, minHeight: 480)
            .background(.ultraThinMaterial)
        }
        .windowStyle(.hiddenTitleBar)
        .windowToolbarStyle(.unified)
        .commands {
            CommandGroup(replacing: .appInfo) {
                Button("About Kloak") {
                    NSApp.orderFrontStandardAboutPanel(nil)
                }
            }
            CommandGroup(after: .windowSize) {
                Button("Auto-Fit Window Size") {
                    if !vaultStore.isUnlocked {
                        WindowSizeManager.shared.resize(to: .unlock)
                    } else {
                        WindowSizeManager.shared.resize(to: .vaultItems)
                    }
                }
                .keyboardShortcut("0", modifiers: [.command, .option])
            }
            CommandGroup(replacing: .pasteboard) {
                Button("Cut") {
                    NSApp.sendAction(#selector(NSText.cut(_:)), to: nil, from: nil)
                }
                .keyboardShortcut("x", modifiers: .command)

                Button("Copy") {
                    NSApp.sendAction(#selector(NSText.copy(_:)), to: nil, from: nil)
                }
                .keyboardShortcut("c", modifiers: .command)

                Button("Paste") {
                    NSApp.sendAction(#selector(NSText.paste(_:)), to: nil, from: nil)
                }
                .keyboardShortcut("v", modifiers: .command)

                Button("Select All") {
                    NSApp.sendAction(#selector(NSText.selectAll(_:)), to: nil, from: nil)
                }
                .keyboardShortcut("a", modifiers: .command)
            }
            CommandGroup(replacing: .undoRedo) {
                Button("Undo") {
                    NSApp.sendAction(Selector(("undo:")), to: nil, from: nil)
                }
                .keyboardShortcut("z", modifiers: .command)

                Button("Redo") {
                    NSApp.sendAction(Selector(("redo:")), to: nil, from: nil)
                }
                .keyboardShortcut("z", modifiers: [.command, .shift])
            }
        }

        MenuBarExtra("Kloak", systemImage: vaultStore.isUnlocked ? "shield.lefthalf.filled.badge.checkmark" : "lock.shield.fill") {
            MenuBarView(vaultStore: vaultStore)
        }
        .menuBarExtraStyle(.window)
    }
}

/// Lightweight CSV/text parser for file imports.
/// Handles the most common export formats from major password managers.
private func parseImportContent(_ content: String, format: String) -> [VaultItem] {
    var results: [VaultItem] = []
    let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)

    // Try JSON first
    if trimmed.hasPrefix("{") || trimmed.hasPrefix("[") {
        if let data = trimmed.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let jsonItems = json["items"] as? [[String: Any]] {
            for entry in jsonItems {
                let name = entry["name"] as? String ?? ""
                var username = ""
                var password = ""
                var urls: [String] = []
                var totp: String? = nil
                let notes = entry["notes"] as? String

                if let login = entry["login"] as? [String: Any] {
                    username = login["username"] as? String ?? ""
                    password = login["password"] as? String ?? ""
                    totp = login["totp"] as? String
                    if let uriList = login["uris"] as? [[String: Any]] {
                        urls = uriList.compactMap { $0["uri"] as? String }
                    }
                }

                let itemType: ItemType
                if let typeNum = entry["type"] as? Int {
                    itemType = typeNum == 2 ? .secureNote : typeNum == 3 ? .card : .login
                } else {
                    itemType = .login
                }

                results.append(VaultItem(
                    type: itemType,
                    title: name.isEmpty ? "Imported Item" : name,
                    username: username.isEmpty ? nil : username,
                    password: password.isEmpty ? nil : password,
                    urls: urls,
                    notes: notes,
                    totpSecret: totp,
                    tags: []
                ))
            }
            return results
        }
    }

    // CSV parsing
    let lines = trimmed.components(separatedBy: .newlines)
    guard lines.count > 1 else { return results }

    let headers = parseCSVRow(lines[0])
    let headerLower = headers.map { $0.lowercased().trimmingCharacters(in: .whitespaces) }

    // Find column indices by matching common header names
    let titleIdx = headerLower.firstIndex(where: { ["title", "name", "entry"].contains($0) })
    let urlIdx = headerLower.firstIndex(where: { ["url", "login_uri", "website", "domain"].contains($0) })
    let userIdx = headerLower.firstIndex(where: { ["username", "login_username", "user name", "email"].contains($0) })
    let passIdx = headerLower.firstIndex(where: { ["password", "login_password"].contains($0) })
    let notesIdx = headerLower.firstIndex(where: { ["notes", "extra", "comments", "note"].contains($0) })
    let totpIdx = headerLower.firstIndex(where: { ["totp", "login_totp", "otpauth", "otp", "otpsecret"].contains($0) })

    for i in 1..<lines.count {
        let line = lines[i].trimmingCharacters(in: .whitespacesAndNewlines)
        if line.isEmpty { continue }

        let cols = parseCSVRow(line)

        let title = safeCol(cols, titleIdx) ?? safeCol(cols, urlIdx) ?? "Imported Item"
        let url = safeCol(cols, urlIdx)
        let user = safeCol(cols, userIdx)
        let pass = safeCol(cols, passIdx)
        let note = safeCol(cols, notesIdx)
        var totpSecret: String? = nil

        if let raw = safeCol(cols, totpIdx), !raw.isEmpty {
            // Extract secret from otpauth:// URI if present
            if raw.lowercased().hasPrefix("otpauth://") {
                if let urlComp = URLComponents(string: raw),
                   let secretParam = urlComp.queryItems?.first(where: { $0.name == "secret" })?.value {
                    totpSecret = secretParam
                }
            } else {
                totpSecret = raw
            }
        }

        if (user != nil && !user!.isEmpty) || (pass != nil && !pass!.isEmpty) || !title.isEmpty {
            results.append(VaultItem(
                type: .login,
                title: title,
                username: user,
                password: pass,
                urls: url != nil && !url!.isEmpty ? [url!] : [],
                notes: note,
                totpSecret: totpSecret,
                tags: []
            ))
        }
    }

    return results
}

/// Parse a single CSV row, respecting quoted fields with commas inside.
private func parseCSVRow(_ row: String) -> [String] {
    var fields: [String] = []
    var current = ""
    var inQuotes = false

    for ch in row {
        if ch == "\"" {
            inQuotes.toggle()
        } else if ch == "," && !inQuotes {
            fields.append(current)
            current = ""
        } else {
            current.append(ch)
        }
    }
    fields.append(current)
    return fields
}

private func safeCol(_ cols: [String], _ idx: Int?) -> String? {
    guard let i = idx, i < cols.count else { return nil }
    let val = cols[i].trimmingCharacters(in: .whitespaces)
    return val.isEmpty ? nil : val
}
