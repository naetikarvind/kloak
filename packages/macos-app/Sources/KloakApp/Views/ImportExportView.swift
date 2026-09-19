import SwiftUI

public struct ImportExportView: View {
    @Binding var items: [VaultItem]
    var onImport: (String, String) -> (Int, [String])
    var onExport: (String, String?) -> String
    var onSaveItem: ((VaultItem) -> Void)?

    @State private var selectedSource: String = "Bitwarden (JSON / CSV)"
    @State private var importStatus: String?
    @State private var importWarnings: [String] = []
    @State private var exportFormat: String = "kloak-encrypted"
    @State private var exportPassword: String = ""
    @State private var exportResultText: String?
    @State private var keychainStatusText: String?
    @State private var isShowingFilePicker: Bool = false
    @State private var pendingComparison: FileImportComparisonResult? = nil

    let sources = [
        "Bitwarden (JSON / CSV)",
        "1Password (.1pux / .1pif)",
        "Apple Passwords / Safari (CSV)",
        "Google Chrome / Brave / Edge (CSV)",
        "LastPass (CSV)",
        "KeePass (XML / CSV)",
        "Proton Pass (CSV / JSON)",
        "Dashlane (CSV)",
        "Generic CSV (Auto-Mapped)"
    ]

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Section 1: Apple Keychain Native Two-Way Integration
                VStack(alignment: .leading, spacing: 14) {
                    Label("Keychain Sync", systemImage: "apple.logo")
                        .font(.system(size: 14, weight: .bold))
                        .fixedSize()

                    Text("Two-way native integration with Apple Keychain via Security.framework.")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)

                    HStack(spacing: 10) {
                        Button(action: importDirectFromKeychain) {
                            Label("Import", systemImage: "key.fill")
                        }
                        .buttonStyle(GlassCapsuleButton(isPrimary: true))

                        Button(action: mirrorToKeychain) {
                            Label("Mirror", systemImage: "arrow.triangle.2.circlepath")
                        }
                        .buttonStyle(GlassCapsuleButton(isPrimary: false))
                    }

                    if let kStatus = keychainStatusText {
                        Text(kStatus)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(LiquidGlassTheme.emeraldAccent)
                            .padding(.top, 2)
                    }
                }
                .padding(16)
                .glassEffect(cornerRadius: 14)

                // Section 2: File Import
                VStack(alignment: .leading, spacing: 14) {
                    Label("Import File", systemImage: "square.and.arrow.down.fill")
                        .font(.system(size: 14, weight: .bold))

                    Text("Migrate from 10+ password managers (Bitwarden, 1Password, Apple, Chrome, LastPass, KeePass).")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)

                    VStack(alignment: .leading, spacing: 10) {
                        Picker("Format", selection: $selectedSource) {
                            ForEach(sources, id: \.self) { s in
                                Text(s).tag(s)
                            }
                        }
                        .pickerStyle(.menu)

                        HStack {
                            Button(action: selectAndImportFile) {
                                Label("Choose File", systemImage: "doc.badge.plus")
                            }
                            .buttonStyle(GlassCapsuleButton(isPrimary: true))

                            Spacer()
                        }

                        if let status = importStatus {
                            Text(status)
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(LiquidGlassTheme.emeraldAccent)
                                .padding(.top, 2)
                        }

                        if !importWarnings.isEmpty {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("Warnings:")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(LiquidGlassTheme.amberAccent)
                                ForEach(importWarnings.prefix(3), id: \.self) { w in
                                    Text("• \(w)")
                                        .font(.system(size: 10))
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                    }
                    .padding(12)
                    .background(Color.black.opacity(0.2))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .padding(16)
                .glassEffect(cornerRadius: 14)

                // Section 3: Export
                VStack(alignment: .leading, spacing: 14) {
                    Label("Export Vault", systemImage: "square.and.arrow.up.fill")
                        .font(.system(size: 14, weight: .bold))

                    Text("Create encrypted backups (.kloak) or export in standard JSON and CSV.")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)

                    VStack(alignment: .leading, spacing: 12) {
                        Picker("Format", selection: $exportFormat) {
                            Text("Kloak Encrypted (.kloak)").tag("kloak-encrypted")
                            Text("Bitwarden JSON").tag("bitwarden-json")
                            Text("Standard JSON").tag("kloak-json")
                            Text("CSV Spreadsheet").tag("kloak-csv")
                        }
                        .pickerStyle(.radioGroup)

                        if exportFormat == "kloak-encrypted" {
                            SecureField("Backup Password", text: $exportPassword)
                                .textFieldStyle(.roundedBorder)
                        }

                        Button(action: runExport) {
                            Label("Export", systemImage: "square.and.arrow.up")
                        }
                        .buttonStyle(GlassCapsuleButton(isPrimary: false))

                        if let result = exportResultText {
                            Text(result)
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(LiquidGlassTheme.emeraldAccent)
                        }
                    }
                    .padding(12)
                    .background(Color.black.opacity(0.2))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .padding(16)
                .glassEffect(cornerRadius: 14)
            }
            .padding(20)
        }
        .sheet(item: $pendingComparison) { comp in
            ImportDuplicateResolverSheet(
                comparison: comp,
                onConfirm: { globalStrat, overrides in
                    let (toAdd, toUpdate) = DuplicateDetectorService.shared.resolveImport(
                        comparison: comp,
                        globalStrategy: globalStrat,
                        overrides: overrides
                    )
                    let resolvedCount = VaultStore.shared.bulkImportWithResolution(toAdd: toAdd, toUpdate: toUpdate)
                    importStatus = "Imported & resolved \(resolvedCount) items from \(comp.fileName ?? "file")!"
                    pendingComparison = nil
                },
                onCancel: {
                    pendingComparison = nil
                }
            )
        }
    }

    private func importDirectFromKeychain() {
        let keychainItems = KeychainManager.shared.importFromKeychain()
        if keychainItems.isEmpty {
            keychainStatusText = "No website or app logins found in Keychain (system & developer tokens excluded)."
        } else {
            for var item in keychainItems {
                if !item.tags.contains("Imported") {
                    item.tags.append("Imported")
                }
                items.append(item)
                onSaveItem?(item)
            }
            keychainStatusText = "Imported \(keychainItems.count) logins from Apple Keychain!"
        }
    }

    private func mirrorToKeychain() {
        let count = KeychainManager.shared.mirrorAllLoginsToKeychain(items)
        keychainStatusText = "Mirrored \(count) logins to Apple Keychain!"
    }

    private func selectAndImportFile() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.canCreateDirectories = false
        panel.allowedContentTypes = [.json, .commaSeparatedText, .xml, .plainText]

        if panel.runModal() == .OK, let url = panel.url {
            do {
                var (parsedItems, _) = try KeychainManager.shared.importFromFile(url: url)
                if parsedItems.isEmpty {
                    let content = try String(contentsOf: url, encoding: .utf8)
                    let (res, _) = KeychainManager.shared.importFromContent(content, filename: url.lastPathComponent, provider: nil)
                    parsedItems = res
                }

                guard !parsedItems.isEmpty else {
                    importStatus = "No valid credentials found in \(url.lastPathComponent)."
                    return
                }

                // Run comparison against existing vault
                let comparison = DuplicateDetectorService.shared.compareFileWithVault(
                    fileItems: parsedItems,
                    vaultItems: items,
                    fileName: url.lastPathComponent
                )

                if comparison.duplicateCount > 0 {
                    // Present resolution sheet for duplicate review
                    pendingComparison = comparison
                } else {
                    // Direct import as all items are new
                    let added = VaultStore.shared.bulkImportWithResolution(toAdd: parsedItems, toUpdate: [])
                    importStatus = "Successfully imported \(added) new items from \(url.lastPathComponent)!"
                }
            } catch {
                importStatus = "Failed to import file: \(error.localizedDescription)"
            }
        }
    }

    private func runExport() {
        let savePanel = NSSavePanel()
        let ext = exportFormat == "kloak-csv" ? "csv" : exportFormat == "kloak-encrypted" ? "kloak" : "json"
        savePanel.nameFieldStringValue = "kloak-export.\(ext)"
        savePanel.canCreateDirectories = true

        if savePanel.runModal() == .OK, let url = savePanel.url {
            let data = onExport(exportFormat, exportPassword.isEmpty ? nil : exportPassword)
            do {
                try data.write(to: url, atomically: true, encoding: .utf8)
                exportResultText = "Exported to \(url.lastPathComponent)!"
            } catch {
                exportResultText = "Export failed: \(error.localizedDescription)"
            }
        }
    }
}
