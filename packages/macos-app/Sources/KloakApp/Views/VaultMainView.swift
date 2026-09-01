import SwiftUI

public struct VaultMainView: View {
    @Binding var isUnlocked: Bool
    @Binding var items: [VaultItem]
    var folders: [VaultFolder]
    var settings: VaultSettings
    var onLock: () -> Void
    var onSaveItem: (VaultItem) -> Void
    var onDeleteItem: (String) -> Void
    var onImport: (String, String) -> (Int, [String])
    var onExport: (String, String?) -> String
    var onChangeMasterPassword: (String, String) -> Bool

    @State private var selection: NavigationSection = .allItems
    @State private var selectedItemId: String? = nil
    @State private var searchText: String = ""
    @State private var isShowingNewItemSheet: Bool = false
    @State private var columnVisibility: NavigationSplitViewVisibility = .all

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
        self.folders = folders
        self.settings = settings
        self.onLock = onLock
        self.onSaveItem = onSaveItem
        self.onDeleteItem = onDeleteItem
        self.onImport = onImport
        self.onExport = onExport
        self.onChangeMasterPassword = onChangeMasterPassword
    }

    private var filteredItems: [VaultItem] {
        let base: [VaultItem]
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
                ($0.identity?.fullName?.lowercased().contains(q) ?? false) ||
                ($0.identity?.email?.lowercased().contains(q) ?? false) ||
                ($0.card?.cardholderName?.lowercased().contains(q) ?? false) ||
                ($0.alias?.aliasEmail?.lowercased().contains(q) ?? false) ||
                ($0.alias?.forwardTo?.lowercased().contains(q) ?? false) ||
                ($0.authenticatorDetails?.issuer?.lowercased().contains(q) ?? false) ||
                $0.urls.contains { $0.lowercased().contains(q) } ||
                ($0.notes?.lowercased().contains(q) ?? false)
            }
        }
        return base
    }

    @ViewBuilder
    private var mainColumnView: some View {
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
                settings: .constant(settings),
                onSaveSettings: { _ in },
                onChangeMasterPassword: onChangeMasterPassword
            )
        default:
            ItemListView(
                items: filteredItems,
                selectedItemId: $selectedItemId,
                searchText: $searchText,
                onToggleFavorite: { id in
                    if let idx = items.firstIndex(where: { $0.id == id }) {
                        items[idx].favorite.toggle()
                        items[idx].updatedAt = ISO8601DateFormatter().string(from: Date())
                        onSaveItem(items[idx])
                    }
                },
                onAddItem: { isShowingNewItemSheet = true }
            )
        }
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
            mainColumnView
                .navigationSplitViewColumnWidth(min: 240, ideal: 280, max: 360)
        } detail: {
            if let selId = selectedItemId, let itemBinding = binding(for: selId) {
                ItemDetailView(
                    item: itemBinding,
                    onSave: { updated in
                        if let idx = items.firstIndex(where: { $0.id == updated.id }) {
                            items[idx] = updated
                            onSaveItem(updated)
                        }
                    },
                    onDelete: { id in
                        if let idx = items.firstIndex(where: { $0.id == id }) {
                            items[idx].trashed = true
                            items[idx].updatedAt = ISO8601DateFormatter().string(from: Date())
                            onDeleteItem(id)
                            selectedItemId = nil
                        }
                    }
                )
            } else {
                VStack(spacing: 12) {
                    KloakLogoView(size: 56, glow: true)
                    Text("No Item Selected")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.secondary)
                    Text("Choose a credential from the list or press + to create one.")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary.opacity(0.7))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .sheet(isPresented: $isShowingNewItemSheet) {
            NewItemSheet(
                initialType: {
                    if case .category(let t) = selection { return t }
                    return .login
                }(),
                onAdd: { newItem in
                    items.append(newItem)
                    onSaveItem(newItem)
                    selectedItemId = newItem.id
                    isShowingNewItemSheet = false
                },
                onCancel: {
                    isShowingNewItemSheet = false
                }
            )
        }
    }

    private func binding(for id: String) -> Binding<VaultItem>? {
        guard let index = items.firstIndex(where: { $0.id == id }) else { return nil }
        return Binding(
            get: { self.items[index] },
            set: { self.items[index] = $0 }
        )
    }
}

public struct NewItemSheet: View {
    var initialType: ItemType = .login
    var onAdd: (VaultItem) -> Void
    var onCancel: () -> Void

    @State private var type: ItemType = .login
    @State private var title: String = ""
    @State private var notes: String = ""

    // Login fields
    @State private var username: String = ""
    @State private var password: String = ""
    @State private var url: String = ""
    @State private var totpSecret: String = ""
    @State private var showPassword: Bool = false

    // Payment Card fields
    @State private var cardholderName: String = ""
    @State private var cardNumber: String = ""
    @State private var cardBrand: String = "visa"
    @State private var expMonth: String = ""
    @State private var expYear: String = ""
    @State private var cvv: String = ""
    @State private var billingAddress: String = ""

    // Identity fields
    @State private var firstName: String = ""
    @State private var lastName: String = ""
    @State private var identityEmail: String = ""
    @State private var phone: String = ""
    @State private var address1: String = ""
    @State private var city: String = ""
    @State private var state: String = ""
    @State private var zip: String = ""
    @State private var country: String = "United States"
    @State private var dateOfBirth: String = ""
    @State private var passportNumber: String = ""
    @State private var ssn: String = ""

    // Alias fields
    @State private var aliasEmail: String = ""
    @State private var forwardTo: String = ""
    @State private var aliasProvider: String = "DuckDuckGo"

    // Authenticator fields
    @State private var authIssuer: String = ""
    @State private var authAlgorithm: String = "TOTP"
    @State private var authDigits: Int = 6
    @State private var authPeriod: Int = 30

    @FocusState private var isTitleFocused: Bool

    public init(
        initialType: ItemType = .login,
        onAdd: @escaping (VaultItem) -> Void,
        onCancel: @escaping () -> Void
    ) {
        self.initialType = initialType
        self.onAdd = onAdd
        self.onCancel = onCancel
        self._type = State(initialValue: initialType)
    }

    public var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack(spacing: 12) {
                FaviconView(
                    urls: url.isEmpty ? [] : [url],
                    title: title,
                    itemType: type,
                    size: 36
                )

                VStack(alignment: .leading, spacing: 2) {
                    Text(title.isEmpty ? "New \(type.displayName)" : title)
                        .font(.system(size: 15, weight: .bold))
                        .lineLimit(1)
                    Text("Add credential to secure encrypted vault")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                }

                Spacer()
            }
            .padding(16)
            .background(Color.black.opacity(0.2))

            Divider().opacity(0.15)

            // Form Content
            ScrollView {
                VStack(spacing: 14) {
                    // Type selector
                    VStack(alignment: .leading, spacing: 6) {
                        Text("ITEM TYPE")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(.secondary)

                        Picker("Item Type", selection: $type) {
                            ForEach(ItemType.allCases) { t in
                                Label(t.displayName, systemImage: t.iconName).tag(t)
                            }
                        }
                        .pickerStyle(.segmented)
                    }

                    // Title
                    VStack(alignment: .leading, spacing: 6) {
                        Text("TITLE")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(.secondary)

                        TextField(titlePlaceholder, text: $title)
                            .textFieldStyle(.plain)
                            .font(.system(size: 13))
                            .padding(9)
                            .background(Color.black.opacity(0.3))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .focused($isTitleFocused)
                    }

                    // Type-specific input fields
                    switch type {
                    case .login:
                        loginFields
                    case .card:
                        cardFields
                    case .identity:
                        identityFields
                    case .emailAlias:
                        aliasFields
                    case .authenticator:
                        authenticatorFields
                    case .secureNote:
                        EmptyView()
                    }

                    // Notes
                    VStack(alignment: .leading, spacing: 6) {
                        Text("NOTES")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(.secondary)

                        TextEditor(text: $notes)
                            .font(.system(size: 12))
                            .frame(minHeight: type == .secureNote ? 120 : 60)
                            .padding(6)
                            .background(Color.black.opacity(0.3))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }
                .padding(16)
            }

            Divider().opacity(0.15)

            // Actions Footer
            HStack(spacing: 12) {
                Button(action: onCancel) {
                    Label("Cancel", systemImage: "xmark")
                }
                .buttonStyle(GlassCapsuleButton(isPrimary: false))

                Spacer()

                Button(action: handleSave) {
                    Label("Save to Vault", systemImage: "checkmark")
                }
                .buttonStyle(GlassCapsuleButton(isPrimary: true))
                .disabled(!canSave)
            }
            .padding(16)
            .background(Color.black.opacity(0.2))
        }
        .frame(width: 480, height: 560)
        .background(.ultraThinMaterial)
    }

    private var titlePlaceholder: String {
        switch type {
        case .login: return "e.g. GitHub, Google, Netflix"
        case .card: return "e.g. Personal Visa, Apple Card"
        case .identity: return "e.g. Personal Profile, Work Identity"
        case .emailAlias: return "e.g. Shopping Alias, Newsletter Mailbox"
        case .authenticator: return "e.g. AWS Root Account, GitHub 2FA"
        case .secureNote: return "e.g. Server Recovery Keys, Wi-Fi Passwords"
        }
    }

    private var canSave: Bool {
        if !title.trimmingCharacters(in: .whitespaces).isEmpty { return true }
        switch type {
        case .login: return !username.isEmpty || !url.isEmpty
        case .card: return !cardholderName.isEmpty || !cardNumber.isEmpty
        case .identity: return !firstName.isEmpty || !identityEmail.isEmpty
        case .emailAlias: return !aliasEmail.isEmpty
        case .authenticator: return !totpSecret.isEmpty || !authIssuer.isEmpty
        case .secureNote: return !notes.isEmpty
        }
    }

    // MARK: - Login Fields

    @ViewBuilder
    private var loginFields: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("USERNAME / EMAIL").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
            TextField("user@example.com", text: $username)
                .textFieldStyle(.plain)
                .padding(8)
                .background(Color.black.opacity(0.3))
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }

        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("PASSWORD").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                Spacer()
                Button(action: generateSecurePassword) {
                    HStack(spacing: 3) {
                        Image(systemName: "dice.fill")
                        Text("Generate")
                    }
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(LiquidGlassTheme.primaryAccent)
                }
                .buttonStyle(.plain)
            }

            HStack {
                if showPassword {
                    TextField("Password", text: $password)
                        .textFieldStyle(.plain)
                        .font(.system(size: 12, design: .monospaced))
                } else {
                    SecureField("Password", text: $password)
                        .textFieldStyle(.plain)
                        .font(.system(size: 12))
                }

                Button(action: { showPassword.toggle() }) {
                    Image(systemName: showPassword ? "eye.slash" : "eye")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
            }
            .padding(8)
            .background(Color.black.opacity(0.3))
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }

        VStack(alignment: .leading, spacing: 6) {
            Text("WEBSITE URL").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
            TextField("https://example.com", text: $url)
                .textFieldStyle(.plain)
                .padding(8)
                .background(Color.black.opacity(0.3))
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }

        VStack(alignment: .leading, spacing: 6) {
            Text("2FA SECRET KEY (TOTP)").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
            TextField("JBSWY3DPEHPK3PXP (Base32)", text: $totpSecret)
                .textFieldStyle(.plain)
                .font(.system(size: 12, design: .monospaced))
                .padding(8)
                .background(Color.black.opacity(0.3))
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }

    // MARK: - Card Fields

    @ViewBuilder
    private var cardFields: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("CARDHOLDER NAME").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
            TextField("John Doe", text: $cardholderName)
                .textFieldStyle(.plain)
                .padding(8)
                .background(Color.black.opacity(0.3))
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }

        VStack(alignment: .leading, spacing: 6) {
            Text("CARD NUMBER").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
            TextField("4532 •••• •••• 8890", text: $cardNumber)
                .textFieldStyle(.plain)
                .font(.system(size: 12, design: .monospaced))
                .padding(8)
                .background(Color.black.opacity(0.3))
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }

        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 4) {
                Text("BRAND").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                Picker("", selection: $cardBrand) {
                    Text("Visa").tag("visa")
                    Text("Mastercard").tag("mastercard")
                    Text("Amex").tag("amex")
                    Text("Discover").tag("discover")
                    Text("Other").tag("other")
                }
                .labelsHidden()
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("EXP MM").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                TextField("MM", text: $expMonth)
                    .textFieldStyle(.plain)
                    .padding(8)
                    .background(Color.black.opacity(0.3))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("EXP YYYY").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                TextField("YYYY", text: $expYear)
                    .textFieldStyle(.plain)
                    .padding(8)
                    .background(Color.black.opacity(0.3))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("CVV").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                TextField("123", text: $cvv)
                    .textFieldStyle(.plain)
                    .padding(8)
                    .background(Color.black.opacity(0.3))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
            }
        }

        VStack(alignment: .leading, spacing: 6) {
            Text("BILLING ADDRESS").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
            TextField("123 Main St, Springfield, OR 97477", text: $billingAddress)
                .textFieldStyle(.plain)
                .padding(8)
                .background(Color.black.opacity(0.3))
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }

    // MARK: - Identity Fields

    @ViewBuilder
    private var identityFields: some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 4) {
                Text("FIRST NAME").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                TextField("First Name", text: $firstName).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("LAST NAME").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                TextField("Last Name", text: $lastName).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
            }
        }

        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 4) {
                Text("EMAIL").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                TextField("john.doe@example.com", text: $identityEmail).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("PHONE").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                TextField("+1 (555) 019-2834", text: $phone).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
            }
        }

        VStack(alignment: .leading, spacing: 4) {
            Text("STREET ADDRESS").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
            TextField("123 Main St, Apt 4B", text: $address1).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
        }

        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 4) {
                Text("CITY").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                TextField("San Francisco", text: $city).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("STATE").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                TextField("CA", text: $state).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("ZIP").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                TextField("94105", text: $zip).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
            }
        }

        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 4) {
                Text("COUNTRY").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                TextField("United States", text: $country).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("DATE OF BIRTH").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                TextField("YYYY-MM-DD", text: $dateOfBirth).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
            }
        }

        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 4) {
                Text("PASSPORT NUMBER").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                TextField("Optional", text: $passportNumber).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("SSN / ID NUMBER").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                TextField("Optional", text: $ssn).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
            }
        }
    }

    // MARK: - Alias Fields

    @ViewBuilder
    private var aliasFields: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("ALIAS EMAIL ADDRESS").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
            TextField("alias_xyz123@duck.com", text: $aliasEmail).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
        }

        VStack(alignment: .leading, spacing: 4) {
            Text("FORWARD TO REAL EMAIL").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
            TextField("real.address@example.com", text: $forwardTo).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
        }

        VStack(alignment: .leading, spacing: 4) {
            Text("ALIAS PROVIDER").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
            Picker("", selection: $aliasProvider) {
                Text("DuckDuckGo").tag("DuckDuckGo")
                Text("SimpleLogin").tag("SimpleLogin")
                Text("Firefox Relay").tag("Firefox Relay")
                Text("iCloud Hide My Email").tag("iCloud")
                Text("Custom").tag("Custom")
            }
            .labelsHidden()
        }
    }

    // MARK: - Authenticator Fields

    @ViewBuilder
    private var authenticatorFields: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("ISSUER / SERVICE NAME").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
            TextField("e.g. AWS, GitHub, Google", text: $authIssuer).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
        }

        VStack(alignment: .leading, spacing: 4) {
            Text("SECRET KEY (BASE32 OR OTPAUTH://)").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
            TextField("JBSWY3DPEHPK3PXP", text: $totpSecret).textFieldStyle(.plain).font(.system(size: 12, design: .monospaced)).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
        }

        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("ALGORITHM").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                Picker("", selection: $authAlgorithm) {
                    Text("TOTP (Time-based)").tag("TOTP")
                    Text("HOTP (Counter-based)").tag("HOTP")
                }
                .labelsHidden()
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("DIGITS").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                Picker("", selection: $authDigits) {
                    Text("6 digits").tag(6)
                    Text("8 digits").tag(8)
                }
                .labelsHidden()
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("PERIOD").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                Picker("", selection: $authPeriod) {
                    Text("30s").tag(30)
                    Text("60s").tag(60)
                }
                .labelsHidden()
            }
        }
    }

    private func generateSecurePassword() {
        let pool = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"
        var res = ""
        for _ in 0..<20 {
            if let ch = pool.randomElement() {
                res.append(ch)
            }
        }
        password = res
        showPassword = true
    }

    private func handleSave() {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let finalTitle = trimmedTitle.isEmpty ? (type == .card ? "Payment Card" : type == .identity ? "Identity Profile" : "Untitled") : trimmedTitle
        let trimmedNotes = notes.trimmingCharacters(in: .whitespacesAndNewlines)

        var cardObj: CardDetails? = nil
        var idObj: IdentityDetails? = nil
        var aliasObj: AliasDetails? = nil
        var authObj: AuthenticatorDetails? = nil
        var itemUsername: String? = nil
        var itemPassword: String? = nil
        var itemUrls: [String] = []
        var itemTotp: String? = nil

        switch type {
        case .login:
            itemUsername = username.isEmpty ? nil : username.trimmingCharacters(in: .whitespacesAndNewlines)
            itemPassword = password.isEmpty ? nil : password
            if !url.isEmpty { itemUrls = [url.trimmingCharacters(in: .whitespacesAndNewlines)] }
            let t = totpSecret.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: " ", with: "")
            itemTotp = t.isEmpty ? nil : t

        case .card:
            itemUsername = cardholderName.isEmpty ? nil : cardholderName.trimmingCharacters(in: .whitespacesAndNewlines)
            itemPassword = cvv.isEmpty ? nil : cvv.trimmingCharacters(in: .whitespacesAndNewlines)
            cardObj = CardDetails(
                cardholderName: cardholderName.isEmpty ? nil : cardholderName.trimmingCharacters(in: .whitespacesAndNewlines),
                number: cardNumber.isEmpty ? nil : cardNumber.trimmingCharacters(in: .whitespacesAndNewlines),
                brand: cardBrand,
                expMonth: expMonth.isEmpty ? nil : expMonth.trimmingCharacters(in: .whitespacesAndNewlines),
                expYear: expYear.isEmpty ? nil : expYear.trimmingCharacters(in: .whitespacesAndNewlines),
                cvv: cvv.isEmpty ? nil : cvv.trimmingCharacters(in: .whitespacesAndNewlines),
                billingAddress: billingAddress.isEmpty ? nil : billingAddress.trimmingCharacters(in: .whitespacesAndNewlines)
            )

        case .identity:
            let fn = [firstName, lastName].map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }.joined(separator: " ")
            itemUsername = fn.isEmpty ? (identityEmail.isEmpty ? nil : identityEmail) : fn
            idObj = IdentityDetails(
                firstName: firstName.isEmpty ? nil : firstName.trimmingCharacters(in: .whitespacesAndNewlines),
                lastName: lastName.isEmpty ? nil : lastName.trimmingCharacters(in: .whitespacesAndNewlines),
                email: identityEmail.isEmpty ? nil : identityEmail.trimmingCharacters(in: .whitespacesAndNewlines),
                phone: phone.isEmpty ? nil : phone.trimmingCharacters(in: .whitespacesAndNewlines),
                address1: address1.isEmpty ? nil : address1.trimmingCharacters(in: .whitespacesAndNewlines),
                city: city.isEmpty ? nil : city.trimmingCharacters(in: .whitespacesAndNewlines),
                state: state.isEmpty ? nil : state.trimmingCharacters(in: .whitespacesAndNewlines),
                zip: zip.isEmpty ? nil : zip.trimmingCharacters(in: .whitespacesAndNewlines),
                country: country.isEmpty ? nil : country.trimmingCharacters(in: .whitespacesAndNewlines),
                dateOfBirth: dateOfBirth.isEmpty ? nil : dateOfBirth.trimmingCharacters(in: .whitespacesAndNewlines),
                passportNumber: passportNumber.isEmpty ? nil : passportNumber.trimmingCharacters(in: .whitespacesAndNewlines),
                ssn: ssn.isEmpty ? nil : ssn.trimmingCharacters(in: .whitespacesAndNewlines)
            )

        case .emailAlias:
            itemUsername = aliasEmail.isEmpty ? nil : aliasEmail.trimmingCharacters(in: .whitespacesAndNewlines)
            aliasObj = AliasDetails(
                aliasEmail: aliasEmail.isEmpty ? nil : aliasEmail.trimmingCharacters(in: .whitespacesAndNewlines),
                forwardTo: forwardTo.isEmpty ? nil : forwardTo.trimmingCharacters(in: .whitespacesAndNewlines),
                provider: aliasProvider
            )

        case .authenticator:
            let t = totpSecret.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: " ", with: "")
            itemTotp = t.isEmpty ? nil : t
            itemUsername = authIssuer.isEmpty ? nil : authIssuer.trimmingCharacters(in: .whitespacesAndNewlines)
            authObj = AuthenticatorDetails(
                issuer: authIssuer.isEmpty ? nil : authIssuer.trimmingCharacters(in: .whitespacesAndNewlines),
                algorithm: authAlgorithm,
                digits: authDigits,
                period: authPeriod
            )

        case .secureNote:
            break
        }

        let item = VaultItem(
            type: type,
            title: finalTitle,
            username: itemUsername,
            password: itemPassword,
            urls: itemUrls,
            notes: trimmedNotes.isEmpty ? nil : trimmedNotes,
            totpSecret: itemTotp,
            card: cardObj,
            identity: idObj,
            alias: aliasObj,
            authenticatorDetails: authObj
        )

        onAdd(item)
    }
}
