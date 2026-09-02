import SwiftUI

public enum NavigationSection: Hashable {
    case allItems
    case favorites
    case category(ItemType)
    case folder(String)
    case trash
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

    public var body: some View {
        VStack(spacing: 0) {
            List(selection: $selection) {
                Section("Vault") {
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

                Section("Categories") {
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

                if !folders.isEmpty {
                    Section("Folders") {
                        ForEach(folders) { folder in
                            NavigationLink(value: NavigationSection.folder(folder.id)) {
                                Label(folder.name, systemImage: "folder.fill")
                            }
                        }
                    }
                }

                Section("Tools") {
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
    }
}
