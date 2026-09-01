import SwiftUI

public struct VaultMainView: View {
    @Binding var isUnlocked: Bool
    @Binding var items: [VaultItem]
    @State private var selection: NavigationSection = .allItems
    @State private var selectedItemId: String?
    @State private var searchText: String = ""
    @State private var folders: [VaultFolder] = []
    @State private var settings: VaultSettings = .default
    @State private var isShowingNewItemSheet: Bool = false
    @State private var columnVisibility: NavigationSplitViewVisibility = .all

    // Callbacks passed from app
    var onLock: () -> Void
    var onSaveItem: (VaultItem) -> Void
    var onDeleteItem: (String) -> Void
    var onImport: (String, String) -> (Int, [String])
    var onExport: (String, String?) -> String
    var onChangeMasterPassword: (String, String) -> Bool

    public init(
        isUnlocked: Binding<Bool>,
        items: Binding<[VaultItem]>,
        folders: [VaultFolder],
        settings: VaultSettings,
        onLock: @escaping () -> Void,
        onSaveItem: @escaping (VaultItem) -> Void,
        onDeleteItem: @escaping (String) -> Void,
        onImport: @escaping (String, String) -> (Int, [String]),
        onExport: @escaping (String, String?) -> String,
        onChangeMasterPassword: @escaping (String, String) -> Bool
    ) {
        self._isUnlocked = isUnlocked
        self._items = items
        self._folders = State(initialValue: folders)
        self._settings = State(initialValue: settings)
        self.onLock = onLock
        self.onSaveItem = onSaveItem
        self.onDeleteItem = onDeleteItem
        self.onImport = onImport
        self.onExport = onExport
        self.onChangeMasterPassword = onChangeMasterPassword
    }

    private var filteredItems: [VaultItem] {
        var base: [VaultItem] = []
        switch selection {
        case .allItems:
            base = items.filter { !$0.trashed }
        case .favorites:
            base = items.filter { $0.favorite && !$0.trashed }
        case .category(let type):
            base = items.filter { $0.type == type && !$0.trashed }
        case .folder(let folderId):
            base = items.filter { $0.tags.contains(folderId) && !$0.trashed }
        case .trash:
            base = items.filter { $0.trashed }
        case .generator, .importExport, .settings:
            base = []
        }

        if !searchText.isEmpty {
            let q = searchText.lowercased()
            return base.filter {
                $0.title.lowercased().contains(q) ||
                ($0.username?.lowercased().contains(q) ?? false) ||
                ($0.oauth?.accountEmail?.lowercased().contains(q) ?? false) ||
                $0.urls.contains { $0.lowercased().contains(q) } ||
                ($0.notes?.lowercased().contains(q) ?? false)
            }
        }
        return base
    }

    public var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            SidebarView(
                selection: $selection,
                items: items,
                folders: folders,
                onLock: onLock,
                onAddItem: { isShowingNewItemSheet = true }
            )
            .navigationSplitViewColumnWidth(min: 190, ideal: 220, max: 280)
        } content: {
            Group {
                switch selection {
                case .generator:
                    GeneratorView()
                case .importExport:
                    ImportExportView(
                        items: $items,
                        onImport: onImport,
                        onExport: onExport,
                        onSaveItem: onSaveItem
                    )
                case .settings:
                    SettingsView(
                        settings: $settings,
                        onSaveSettings: { _ in },
                        onChangeMasterPassword: onChangeMasterPassword
                    )
                default:
                    ItemListView(
                        items: filteredItems,
                        selectedItemId: $selectedItemId,
                        searchText: $searchText,
                        onToggleFavorite: toggleFavorite
                    )
                }
            }
            .navigationSplitViewColumnWidth(min: 240, ideal: 310, max: 420)
        } detail: {
            if let id = selectedItemId, let itemIndex = items.firstIndex(where: { $0.id == id }) {
                ItemDetailView(
                    item: $items[itemIndex],
                    onSave: { updated in
                        items[itemIndex] = updated
                        onSaveItem(updated)
                    },
                    onDelete: { itemId in
                        onDeleteItem(itemId)
                        items.removeAll { $0.id == itemId }
                        selectedItemId = nil
                    }
                )
                .frame(minWidth: 360)
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "lock.shield")
                        .font(.system(size: 40))
                        .foregroundColor(.secondary.opacity(0.35))
                    Text("Select an item to view credentials")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationSplitViewStyle(.balanced)
        .background(
            GeometryReader { proxy in
                Color.clear
                    .preference(key: VaultWindowWidthPreferenceKey.self, value: proxy.size.width)
            }
        )
        .onPreferenceChange(VaultWindowWidthPreferenceKey.self) { currentWidth in
            handleWindowResize(width: currentWidth)
        }
        .sheet(isPresented: $isShowingNewItemSheet) {
            NewItemSheet(onAdd: { newItem in
                items.append(newItem)
                onSaveItem(newItem)
                selectedItemId = newItem.id
                isShowingNewItemSheet = false
            }, onCancel: {
                isShowingNewItemSheet = false
            })
        }
    }

    private func toggleFavorite(id: String) {
        if let idx = items.firstIndex(where: { $0.id == id }) {
            items[idx].favorite.toggle()
            onSaveItem(items[idx])
        }
    }

    private func handleWindowResize(width: CGFloat) {
        guard width > 100 else { return }
        let collapseThreshold: CGFloat = 760

        if width < collapseThreshold {
            if columnVisibility != .doubleColumn {
                withAnimation(.easeInOut(duration: 0.18)) {
                    columnVisibility = .doubleColumn
                }
            }
        } else {
            if columnVisibility != .all {
                withAnimation(.easeInOut(duration: 0.18)) {
                    columnVisibility = .all
                }
            }
        }
    }
}

public struct VaultWindowWidthPreferenceKey: PreferenceKey {
    public static let defaultValue: CGFloat = 1000
    public static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

public struct NewItemSheet: View {
    var onAdd: (VaultItem) -> Void
    var onCancel: () -> Void

    @State private var title: String = ""
    @State private var type: ItemType = .login
    @State private var username: String = ""
    @State private var password: String = ""
    @State private var url: String = ""
    @State private var totpSecret: String = ""
    @State private var notes: String = ""

    // OAuth specific
    @State private var oauthProvider: String = "Google"
    @State private var oauthEmail: String = ""
    @State private var oauthClientId: String = ""

    let oauthProviders = ["Google", "Apple", "GitHub", "Microsoft", "GitLab", "Slack", "Custom"]

    @FocusState private var isTitleFocused: Bool

    public var body: some View {
        VStack(spacing: 16) {
            HStack(spacing: 12) {
                FaviconView(
                    urls: url.isEmpty ? [] : [url],
                    title: title,
                    oauthProvider: type == .oauth ? oauthProvider : nil,
                    itemType: type,
                    size: 38
                )

                VStack(alignment: .leading, spacing: 2) {
                    Text(title.isEmpty ? "New \(type.displayName)" : title)
                        .font(.system(size: 15, weight: .bold))
                        .lineLimit(1)
                    Text("Live brand logo resolution")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                }

                Spacer()
            }
            .padding(.horizontal)
            .padding(.top, 4)

            Form {
                Picker("Item Type", selection: $type) {
                    ForEach(ItemType.allCases) { t in
                        Text(t.displayName).tag(t)
                    }
                }

                TextField("Title / Service Name", text: $title)
                    .focused($isTitleFocused)

                if type == .oauth {
                    Picker("OAuth Provider", selection: $oauthProvider) {
                        ForEach(oauthProviders, id: \.self) { p in
                            Text(p).tag(p)
                        }
                    }
                    TextField("Connected Account Email", text: $oauthEmail)
                    TextField("Client ID (optional)", text: $oauthClientId)
                    TextField("Redirect URI / App URL", text: $url)
                } else if type == .login {
                    TextField("Username / Email", text: $username)
                    TextField("Password", text: $password)
                    TextField("Website URL", text: $url)
                    TextField("TOTP Secret (optional)", text: $totpSecret)
                } else if type == .card {
                    TextField("Cardholder Name", text: $username)
                    TextField("Card Number", text: $password)
                }

                TextField("Notes", text: $notes)
            }
            .padding(.horizontal)

            HStack(spacing: 12) {
                Button(action: onCancel) {
                    Label("Cancel", systemImage: "xmark")
                }
                .buttonStyle(GlassCapsuleButton(isPrimary: false))

                Button(action: {
                    var oauthObj: OAuthDetails? = nil
                    if type == .oauth {
                        oauthObj = OAuthDetails(
                            provider: oauthProvider,
                            providerDisplayName: oauthProvider,
                            accountEmail: oauthEmail.isEmpty ? nil : oauthEmail,
                            clientId: oauthClientId.isEmpty ? nil : oauthClientId
                        )
                    }

                    let item = VaultItem(
                        type: type,
                        title: title.isEmpty ? (type == .oauth ? "\(oauthProvider) SSO" : "Untitled") : title,
                        username: username.isEmpty ? (type == .oauth ? oauthEmail : nil) : username,
                        password: password.isEmpty ? nil : password,
                        urls: url.isEmpty ? [] : [url],
                        notes: notes.isEmpty ? nil : notes,
                        totpSecret: totpSecret.isEmpty ? nil : totpSecret,
                        oauth: oauthObj,
                        tags: type == .oauth ? ["OAuth", oauthProvider] : []
                    )
                    onAdd(item)
                }) {
                    Label("Save", systemImage: "checkmark")
                }
                .buttonStyle(GlassCapsuleButton(isPrimary: true))
                .disabled(title.isEmpty && username.isEmpty && password.isEmpty && oauthEmail.isEmpty)
            }
        }
        .padding(20)
        .frame(width: 440)
    }
}
