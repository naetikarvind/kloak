import SwiftUI

public enum TwoFASubtype: String, Hashable, CaseIterable, Sendable {
    case all = "All 2FA"
    case authenticator = "Authenticator"
    case recoveryCodes = "Recovery Codes"
}

public enum NavigationSection: Hashable {
    case allItems
    case favorites
    case category(ItemType)
    case twoFASubtype(TwoFASubtype)
    case folder(String)
    case duplicates
    case passwordHealth
    case sessions
    case generator
    case combineCredentials
    case importExport
    case settings
    case trash
}

public struct SidebarView: View {
    @Binding var selection: NavigationSection
    var items: [VaultItem]
    @Binding var folders: [VaultFolder]
    @ObservedObject private var sessionMonitor = SessionMonitorService.shared
    var onLock: () -> Void
    var onAddItem: () -> Void
    var onCreateFolder: ((String) -> Void)? = nil
    var onDeleteFolder: ((String) -> Void)? = nil
    var onSelectTwoFASubtype: ((TwoFASubtype) -> Void)? = nil

    @State private var isShowingNewFolderAlert: Bool = false
    @State private var newFolderName: String = ""

    private func sectionHeader(_ title: String) -> some View {
        Text(title.uppercased())
            .font(.system(size: 10, weight: .bold))
            .foregroundColor(.secondary.opacity(0.75))
            .padding(.leading, 8)
    }

    private var foldersHeader: some View {
        HStack {
            Text("FOLDERS")
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(.secondary.opacity(0.75))
                .padding(.leading, 8)
            Spacer()
            Button(action: {
                newFolderName = ""
                isShowingNewFolderAlert = true
            }) {
                Image(systemName: "plus")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.secondary)
                    .padding(.trailing, 4)
            }
            .buttonStyle(.plain)
            .help("Add New Folder")
        }
    }

    private var twoFASidebarSection: some View {
        let authCount = items.filter { !$0.trashed && $0.isAuthenticator }.count
        let recoveryCount = items.filter { !$0.trashed && $0.isRecoveryCode }.count
        let totalCount = items.filter { !$0.trashed && $0.is2FA }.count

        return Group {
            NavigationLink(value: NavigationSection.category(.authenticator)) {
                Label {
                    Text("2FA")
                } icon: {
                    Image(systemName: "lock.shield.fill").foregroundColor(LiquidGlassTheme.primaryAccent)
                }
                .badge(totalCount)
            }
            .tag(NavigationSection.category(.authenticator))
            .simultaneousGesture(TapGesture().onEnded {
                onSelectTwoFASubtype?(.all)
            })

            NavigationLink(value: NavigationSection.twoFASubtype(.authenticator)) {
                HStack(spacing: 7) {
                    Image(systemName: "timer")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(LiquidGlassTheme.primaryAccent)
                        .frame(width: 14)
                    Text("Authenticator")
                        .font(.system(size: 11))
                }
                .padding(.leading, 10)
            }
            .badge(authCount)
            .tag(NavigationSection.twoFASubtype(.authenticator))
            .simultaneousGesture(TapGesture().onEnded {
                onSelectTwoFASubtype?(.authenticator)
            })

            NavigationLink(value: NavigationSection.twoFASubtype(.recoveryCodes)) {
                HStack(spacing: 7) {
                    Image(systemName: "key.horizontal.fill")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(LiquidGlassTheme.emeraldAccent)
                        .frame(width: 14)
                    Text("Recovery Codes")
                        .font(.system(size: 11))
                }
                .padding(.leading, 10)
            }
            .badge(recoveryCount)
            .tag(NavigationSection.twoFASubtype(.recoveryCodes))
            .simultaneousGesture(TapGesture().onEnded {
                onSelectTwoFASubtype?(.recoveryCodes)
            })
        }
    }

    public var body: some View {
        VStack(spacing: 0) {
            // Traffic lights clearance for hiddenTitleBar window style
            Color.clear
                .frame(height: 28)

            List(selection: $selection) {
                Section(header: sectionHeader("Vault")) {
                    NavigationLink(value: NavigationSection.allItems) {
                        Label {
                            Text("All Items")
                        } icon: {
                            Image(systemName: "tray.full.fill").foregroundColor(LiquidGlassTheme.primaryAccent)
                        }
                        .badge(items.filter { !$0.trashed }.count)
                    }
                    .tag(NavigationSection.allItems)

                    NavigationLink(value: NavigationSection.favorites) {
                        Label {
                            Text("Favorites")
                        } icon: {
                            Image(systemName: "star.fill").foregroundColor(LiquidGlassTheme.amberAccent)
                        }
                        .badge(items.filter { $0.favorite && !$0.trashed }.count)
                    }
                    .tag(NavigationSection.favorites)
                }

                Section(header: sectionHeader("Categories")) {
                    ForEach(ItemType.allCases) { type in
                        if type == .authenticator {
                            twoFASidebarSection
                        } else {
                            NavigationLink(value: NavigationSection.category(type)) {
                                Label {
                                    Text(type == .login ? "Logins" : type.displayName)
                                } icon: {
                                    Image(systemName: type.iconName).foregroundColor(.secondary)
                                }
                                .badge(type == .secureNote
                                    ? items.filter { $0.type == .secureNote && !$0.trashed && !$0.isRecoveryCode }.count
                                    : items.filter { $0.type == type && !$0.trashed }.count
                                )
                            }
                            .tag(NavigationSection.category(type))
                        }
                    }
                }

                Section(header: foldersHeader) {
                    ForEach(folders) { folder in
                        let count = items.filter { $0.belongsTo(folder: folder, allFolders: folders) }.count

                        NavigationLink(value: NavigationSection.folder(folder.id)) {
                            Label(folder.name, systemImage: "folder.fill")
                        }
                        .badge(count)
                        .tag(NavigationSection.folder(folder.id))
                        .contextMenu {
                            Button(role: .destructive) {
                                onDeleteFolder?(folder.id)
                            } label: {
                                Label("Delete Folder", systemImage: "trash")
                            }
                        }
                    }

                    Button(action: {
                        newFolderName = ""
                        isShowingNewFolderAlert = true
                    }) {
                        Label("Add Folder...", systemImage: "folder.badge.plus")
                            .font(.system(size: 12))
                            .foregroundColor(LiquidGlassTheme.primaryAccent)
                    }
                    .buttonStyle(.plain)
                }

                Section(header: sectionHeader("Security")) {
                    let dupCount = DuplicateDetectorService.shared.findDuplicateAccounts(in: items).count
                    let reusedCount = DuplicateDetectorService.shared.findReusedPasswords(in: items)
                        .filter { !VaultStore.shared.ignoredHealthIssueIds.contains($0.id) }
                        .count
                    let weakCount = DuplicateDetectorService.shared.findWeakPasswords(in: items)
                        .filter { !VaultStore.shared.ignoredHealthIssueIds.contains($0.id) && !VaultStore.shared.ignoredHealthIssueIds.contains($0.item.id) }
                        .count
                    let totalHealthIssues = reusedCount + weakCount

                    NavigationLink(value: NavigationSection.duplicates) {
                        Label {
                            Text("Duplicate Accounts")
                        } icon: {
                            Image(systemName: "doc.on.doc.fill")
                                .foregroundColor(dupCount > 0 ? LiquidGlassTheme.amberAccent : .secondary)
                        }
                        .badge(dupCount)
                    }
                    .tag(NavigationSection.duplicates)

                    NavigationLink(value: NavigationSection.passwordHealth) {
                        Label {
                            Text("Password Health")
                        } icon: {
                            Image(systemName: "shield.lefthalf.filled")
                                .foregroundColor(totalHealthIssues > 0 ? Color.red.opacity(0.85) : LiquidGlassTheme.emeraldAccent)
                        }
                        .badge(totalHealthIssues)
                    }
                    .tag(NavigationSection.passwordHealth)

                    let alertCount = sessionMonitor.activeAlerts.filter { !$0.dismissed }.count
                    NavigationLink(value: NavigationSection.sessions) {
                        Label {
                            Text("Session Watch")
                        } icon: {
                            Image(systemName: "clock.badge.exclamationmark.fill")
                                .foregroundColor(alertCount > 0 ? LiquidGlassTheme.amberAccent : LiquidGlassTheme.cyanAccent)
                        }
                        .badge(alertCount > 0 ? alertCount : sessionMonitor.trackedSessions.count)
                    }
                    .tag(NavigationSection.sessions)
                }

                Section(header: sectionHeader("Tools")) {
                    NavigationLink(value: NavigationSection.generator) {
                        Label("Password Generator", systemImage: "dice.fill")
                    }
                    .tag(NavigationSection.generator)

                    let recommendedCount = CredentialCombinerService.shared.findRecommendedCombinations(in: items).count
                    NavigationLink(value: NavigationSection.combineCredentials) {
                        Label("Combine Credentials", systemImage: "arrow.triangle.merge")
                            .badge(recommendedCount)
                    }
                    .tag(NavigationSection.combineCredentials)

                    NavigationLink(value: NavigationSection.importExport) {
                        Label("Import & Export", systemImage: "arrow.triangle.2.circlepath")
                    }
                    .tag(NavigationSection.importExport)
                }

                Section(header: sectionHeader("Manage")) {
                    NavigationLink(value: NavigationSection.settings) {
                        Label("Settings", systemImage: "gearshape.fill")
                    }
                    .tag(NavigationSection.settings)

                    NavigationLink(value: NavigationSection.trash) {
                        Label("Trash", systemImage: "trash.fill")
                            .badge(items.filter { $0.trashed }.count)
                    }
                    .tag(NavigationSection.trash)
                }
            }
            .listStyle(.sidebar)
            .safeAreaPadding(.leading, 4)

            // Pinned Bottom Lock Vault Button
            VStack(spacing: 0) {
                Divider().opacity(0.15)

                Button(action: onLock) {
                    HStack(spacing: 7) {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 11, weight: .bold))
                        Text("Lock Vault")
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(Color.white.opacity(0.06))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.white.opacity(0.08), lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
            }
        }
        .alert("New Folder", isPresented: $isShowingNewFolderAlert) {
            TextField("Folder Name", text: $newFolderName)
            Button("Cancel", role: .cancel) {}
            Button("Create") {
                let trimmed = newFolderName.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty {
                    onCreateFolder?(trimmed)
                }
            }
        } message: {
            Text("Enter a name for the new folder to organize your credentials.")
        }
    }
}
