import SwiftUI

public enum NavigationSection: Hashable {
    case allItems
    case favorites
    case category(ItemType)
    case folder(String)
    case trash
    case duplicates
    case generator
    case importExport
    case settings
}

public struct SidebarView: View {
    @Binding var selection: NavigationSection
    var items: [VaultItem]
    var folders: [VaultFolder]
    var onLock: () -> Void
    var onAddItem: () -> Void
    var onCreateFolder: ((String) -> Void)? = nil
    var onDeleteFolder: ((String) -> Void)? = nil

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

                    NavigationLink(value: NavigationSection.favorites) {
                        Label {
                            Text("Favorites")
                        } icon: {
                            Image(systemName: "star.fill").foregroundColor(LiquidGlassTheme.amberAccent)
                        }
                        .badge(items.filter { $0.favorite && !$0.trashed }.count)
                    }
                }

                Section(header: sectionHeader("Categories")) {
                    ForEach(ItemType.allCases) { type in
                        NavigationLink(value: NavigationSection.category(type)) {
                            Label {
                                Text(type.displayName)
                            } icon: {
                                Image(systemName: type.iconName).foregroundColor(.secondary)
                            }
                            .badge(type == .authenticator
                                ? items.filter { !$0.trashed && ($0.type == .authenticator || ($0.type == .login && !($0.totpSecret ?? "").isEmpty)) }.count
                                : items.filter { $0.type == type && !$0.trashed }.count
                            )
                        }
                    }
                }

                Section(header: foldersHeader) {
                    ForEach(folders) { folder in
                        let count = items.filter { item in
                            guard !item.trashed else { return false }
                            if item.tags.contains(folder.id) { return true }
                            if item.tags.contains(where: { $0.lowercased() == folder.name.lowercased() }) { return true }
                            if folder.name.lowercased() == "imported" && item.tags.contains(where: {
                                let lower = $0.lowercased()
                                return lower == "imported" || lower.contains("keychain") || lower.contains("passwords") || lower.contains("import")
                            }) {
                                return true
                            }
                            return false
                        }.count

                        NavigationLink(value: NavigationSection.folder(folder.id)) {
                            Label(folder.name, systemImage: "folder.fill")
                        }
                        .badge(count)
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

                Section(header: sectionHeader("Tools")) {
                    let dupCount = DuplicateDetectorService.shared.findDuplicateAccounts(in: items).count
                    let reusedCount = DuplicateDetectorService.shared.findReusedPasswords(in: items).count
                    let totalHealthIssues = dupCount + reusedCount

                    NavigationLink(value: NavigationSection.duplicates) {
                        Label {
                            Text("Duplicates")
                        } icon: {
                            Image(systemName: "doc.on.doc.fill")
                                .foregroundColor(totalHealthIssues > 0 ? LiquidGlassTheme.amberAccent : .secondary)
                        }
                        .badge(totalHealthIssues)
                    }

                    NavigationLink(value: NavigationSection.generator) {
                        Label("Password Generator", systemImage: "dice.fill")
                    }

                    NavigationLink(value: NavigationSection.importExport) {
                        Label("Import & Export", systemImage: "arrow.triangle.2.circlepath")
                    }

                    NavigationLink(value: NavigationSection.settings) {
                        Label("Settings", systemImage: "gearshape.fill")
                    }

                    NavigationLink(value: NavigationSection.trash) {
                        Label("Trash", systemImage: "trash.fill")
                            .badge(items.filter { $0.trashed }.count)
                    }
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
