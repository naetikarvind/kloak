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
                        .badge(items.filter { $0.type == type && !$0.trashed }.count)
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
        .safeAreaInset(edge: .bottom) {
            HStack {
                Button(action: onLock) {
                    Label("Lock", systemImage: "lock.fill")
                }
                .buttonStyle(GlassCapsuleButton(isPrimary: false))

                Spacer()

                Button(action: onAddItem) {
                    Image(systemName: "plus")
                        .font(.system(size: 14, weight: .bold))
                }
                .buttonStyle(GlassCapsuleButton(isPrimary: true))
            }
            .padding(12)
            .background(.ultraThinMaterial)
        }
    }
}
