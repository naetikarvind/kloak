import SwiftUI
import AppKit

public struct ItemListView: View {
    var items: [VaultItem]
    var folders: [VaultFolder] = []
    var currentSection: NavigationSection = .allItems
    @Binding var selectedItemId: String?
    @Binding var searchText: String
    var onToggleFavorite: (String) -> Void
    var onAddItem: (() -> Void)? = nil
    var onMoveToFolder: ((VaultItem, VaultFolder?) -> Void)? = nil
    var onDeleteItem: ((String) -> Void)? = nil
    var onRestoreItem: ((String) -> Void)? = nil
    var onDeletePermanently: ((String) -> Void)? = nil
    var onEmptyTrash: (() -> Void)? = nil

    @State private var isShowingEmptyTrashConfirm: Bool = false

    private var is2FASection: Bool {
        if case .category(let t) = currentSection, t == .authenticator { return true }
        if case .twoFASubtype = currentSection { return true }
        return false
    }

    private var current2FASubtype: TwoFASubtype {
        if case .twoFASubtype(let s) = currentSection { return s }
        return .all
    }

    private var authenticatorItems: [VaultItem] {
        items.filter { $0.isAuthenticator }
    }

    private var recoveryItems: [VaultItem] {
        items.filter { $0.isRecoveryCode }
    }

    private func twoFASectionHeader(title: String, count: Int, icon: String, color: Color) -> some View {
        HStack(spacing: 5) {
            Image(systemName: icon)
                .font(.system(size: 9, weight: .bold))
                .foregroundColor(color)
            Text(title)
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(.secondary)
            Spacer()
            Text("\(count)")
                .font(.system(size: 9, weight: .bold))
                .foregroundColor(.secondary.opacity(0.8))
                .padding(.horizontal, 5)
                .padding(.vertical, 1)
                .background(Color.white.opacity(0.06))
                .clipShape(Capsule())
        }
        .padding(.vertical, 3)
    }

    private func twoFAPillButton(_ title: String, count: Int, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: {
            withAnimation(.spring(response: 0.28, dampingFraction: 0.76)) {
                action()
            }
        }) {
            HStack(spacing: 4) {
                Text(title)
                    .font(.system(size: 11, weight: isSelected ? .bold : .medium))
                if count > 0 {
                    Text("\(count)")
                        .font(.system(size: 10, weight: .semibold))
                        .opacity(isSelected ? 0.95 : 0.6)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(isSelected ? LiquidGlassTheme.primaryAccent.opacity(0.2) : Color.white.opacity(0.05))
            .foregroundColor(isSelected ? LiquidGlassTheme.primaryAccent : .secondary)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(isSelected ? LiquidGlassTheme.primaryAccent.opacity(0.4) : Color.white.opacity(0.08), lineWidth: 0.75)
            )
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func itemRow(_ item: VaultItem) -> some View {
        ItemRowView(
            item: item,
            folders: folders,
            currentSection: currentSection,
            onToggleFavorite: {
                withAnimation(.spring(response: 0.35, dampingFraction: 0.72)) {
                    onToggleFavorite(item.id)
                }
            },
            onMoveToFolder: onMoveToFolder,
            onDeleteItem: onDeleteItem,
            onRestoreItem: onRestoreItem,
            onDeletePermanently: onDeletePermanently
        )
        .tag(item.id)
        .transition(
            .asymmetric(
                insertion: .opacity.combined(with: .offset(y: 8)),
                removal: .opacity.combined(with: .offset(y: -8))
            )
        )
    }

    public var body: some View {
        VStack(spacing: 0) {
            // Search field & Actions bar
            HStack(spacing: 8) {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.secondary)
                        .font(.system(size: 12))

                    TextField(currentSection == .trash ? "Search trash..." : "Search credentials, logins, URLs...", text: $searchText)
                        .textFieldStyle(.plain)
                        .font(.system(size: 12))

                    if !searchText.isEmpty {
                        Button(action: { searchText = "" }) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.secondary)
                                .font(.system(size: 12))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(8)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.black.opacity(0.3))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color.white.opacity(0.1), lineWidth: 0.75)
                        )
                )

                if currentSection == .trash {
                    if !items.isEmpty {
                        Button(action: { isShowingEmptyTrashConfirm = true }) {
                            HStack(spacing: 4) {
                                Image(systemName: "trash.slash.fill")
                                    .font(.system(size: 11))
                                Text("Empty")
                                    .font(.system(size: 11, weight: .bold))
                            }
                            .foregroundColor(LiquidGlassTheme.roseAccent)
                            .padding(.horizontal, 9)
                            .padding(.vertical, 7)
                            .background(LiquidGlassTheme.roseAccent.opacity(0.12))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(LiquidGlassTheme.roseAccent.opacity(0.25), lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                        .help("Empty All Trash Permanently")
                        .confirmationDialog("Empty Trash?", isPresented: $isShowingEmptyTrashConfirm, titleVisibility: .visible) {
                            Button("Empty Trash Permanently", role: .destructive) {
                                onEmptyTrash?()
                            }
                            Button("Cancel", role: .cancel) {}
                        } message: {
                            Text("All \(items.count) items in the Trash will be permanently deleted. This cannot be undone.")
                        }
                    }
                } else if let onAdd = onAddItem {
                    Button(action: onAdd) {
                        Image(systemName: "plus")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.white)
                            .frame(width: 30, height: 30)
                            .background(LiquidGlassTheme.primaryAccent)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                    .help("Add New Item (⌘N)")
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)

            Divider().opacity(0.12)

            // Items List
            if items.isEmpty {
                VStack(spacing: 12) {
                    Spacer()
                    Image(systemName: currentSection == .trash ? "trash" : "lock.slash")
                        .font(.system(size: 32))
                        .foregroundColor(.secondary.opacity(0.5))

                    let trimmedSearch = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
                    Text(currentSection == .trash
                         ? (trimmedSearch.isEmpty ? "Trash is Empty" : "No trash matches for \"\(trimmedSearch)\"")
                         : (trimmedSearch.isEmpty ? "No items in this section" : "No matches for \"\(trimmedSearch)\""))
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.secondary)

                    if currentSection == .trash && trimmedSearch.isEmpty {
                        Text("Deleted credentials will be kept here until permanently purged.")
                            .font(.system(size: 11))
                            .foregroundColor(.secondary.opacity(0.6))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 20)
                    }

                    Spacer()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .transition(.opacity)
            } else {
                ScrollViewReader { proxy in
                    List(selection: $selectedItemId) {
                        if currentSection == .twoFASubtype(.authenticator) {
                            Section {
                                ForEach(items) { item in
                                    itemRow(item)
                                }
                            } header: {
                                twoFASectionHeader(title: "AUTHENTICATOR", count: items.count, icon: "timer", color: LiquidGlassTheme.primaryAccent)
                            }
                        } else if currentSection == .twoFASubtype(.recoveryCodes) {
                            Section {
                                ForEach(items) { item in
                                    itemRow(item)
                                }
                            } header: {
                                twoFASectionHeader(title: "RECOVERY CODES", count: items.count, icon: "key.horizontal.fill", color: LiquidGlassTheme.emeraldAccent)
                            }
                        } else if is2FASection && (!authenticatorItems.isEmpty || !recoveryItems.isEmpty) {
                            if !authenticatorItems.isEmpty {
                                Section {
                                    ForEach(authenticatorItems) { item in
                                        itemRow(item)
                                    }
                                } header: {
                                    twoFASectionHeader(title: "AUTHENTICATOR", count: authenticatorItems.count, icon: "timer", color: LiquidGlassTheme.primaryAccent)
                                        .id("section_authenticator")
                                }
                            }

                            if !recoveryItems.isEmpty {
                                Section {
                                    ForEach(recoveryItems) { item in
                                        itemRow(item)
                                    }
                                } header: {
                                    twoFASectionHeader(title: "RECOVERY CODES", count: recoveryItems.count, icon: "key.horizontal.fill", color: LiquidGlassTheme.emeraldAccent)
                                        .id("section_recovery")
                                }
                            }
                        } else {
                            ForEach(items) { item in
                                itemRow(item)
                            }
                        }
                    }
                    .listStyle(.inset)
                    .tint(LiquidGlassTheme.primaryAccent)
                    .accentColor(LiquidGlassTheme.primaryAccent)
                    .animation(.spring(response: 0.36, dampingFraction: 0.76), value: items)
                    .onChange(of: currentSection) { _, newSection in
                        if case .twoFASubtype(let sub) = newSection {
                            withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                                if sub == .recoveryCodes {
                                    proxy.scrollTo("section_recovery", anchor: .top)
                                } else if sub == .authenticator {
                                    proxy.scrollTo("section_authenticator", anchor: .top)
                                }
                            }
                        }
                    }
                    .onAppear {
                        if case .twoFASubtype(let sub) = currentSection {
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                                withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                                    if sub == .recoveryCodes {
                                        proxy.scrollTo("section_recovery", anchor: .top)
                                    } else if sub == .authenticator {
                                        proxy.scrollTo("section_authenticator", anchor: .top)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        .animation(.spring(response: 0.36, dampingFraction: 0.76), value: items.isEmpty)
    }
}

public struct ItemRowView: View {
    let item: VaultItem
    var folders: [VaultFolder] = []
    var currentSection: NavigationSection = .allItems
    var onToggleFavorite: () -> Void
    var onMoveToFolder: ((VaultItem, VaultFolder?) -> Void)? = nil
    var onDeleteItem: ((String) -> Void)? = nil
    var onRestoreItem: ((String) -> Void)? = nil
    var onDeletePermanently: ((String) -> Void)? = nil

    private var currentFolder: VaultFolder? {
        item.currentFolder(in: folders)
    }

    private var isWeakPassword: Bool {
        guard let p = item.password, !p.isEmpty else { return false }
        if p.count < 8 { return true }
        var score = 0
        if p.count >= 12 { score += 1 }
        if p.rangeOfCharacter(from: .uppercaseLetters) != nil && p.rangeOfCharacter(from: .lowercaseLetters) != nil { score += 1 }
        if p.rangeOfCharacter(from: .decimalDigits) != nil { score += 1 }
        if p.rangeOfCharacter(from: .punctuationCharacters.union(.symbols)) != nil { score += 1 }
        return score <= 1
    }

    private var subtitleText: String {
        if currentSection == .twoFASubtype(.recoveryCodes) {
            let count = item.recoveryCodesCount
            let countStr = count > 0 ? "\(count) Recovery Codes" : "Recovery Codes"
            if let u = item.username, !u.isEmpty {
                return "\(u) • \(countStr)"
            }
            return countStr
        }

        switch item.type {
        case .identity:
            return item.identity?.fullName ?? item.identity?.email ?? item.username ?? "Identity Profile"
        case .card:
            if let card = item.card {
                let holder = card.cardholderName ?? ""
                let brand = (card.brand ?? "Card").capitalized
                return holder.isEmpty ? brand : "\(holder) • \(brand)"
            }
            return item.username ?? "Payment Card"
        case .emailAlias:
            if let alias = item.alias {
                let email = alias.aliasEmail ?? item.username ?? ""
                let fwd = alias.forwardTo ?? ""
                return fwd.isEmpty ? email : "\(email) → \(fwd)"
            }
            return item.username ?? "Email Alias"
        case .authenticator:
            return item.authenticatorDetails?.issuer ?? item.username ?? "2FA Code"
        case .secureNote:
            if item.isRecoveryCode {
                let count = item.recoveryCodesCount
                return count > 0 ? "\(count) Recovery Codes" : (item.notes?.components(separatedBy: .newlines).first ?? "Recovery Codes")
            }
            return item.notes?.components(separatedBy: .newlines).first ?? "Secure Note"
        case .login:
            return item.username ?? item.urls.first ?? item.type.displayName
        }
    }

    private var displayTitle: String {
        let t = item.title.trimmingCharacters(in: .whitespacesAndNewlines)
        if !t.isEmpty {
            return BrandTitleService.cleanTitle(t, url: item.urls.first)
        }
        if let u = item.username, !u.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return u }
        if let url = item.urls.first, !url.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return BrandTitleService.cleanTitle(url)
        }
        return item.type.displayName
    }

    private var shouldShowTypeBadge: Bool {
        guard item.type != .login else { return false }
        if case .category(let selectedCategory) = currentSection {
            if selectedCategory == item.type && selectedCategory != .authenticator {
                return false
            }
        }
        return true
    }

    public var body: some View {
        HStack(spacing: 11) {
            // Advanced high-fidelity Apple squircle favicon (32px)
            FaviconView(
                urls: item.urls,
                title: displayTitle,
                oauthProvider: item.oauth?.provider,
                itemType: item.type,
                size: 32
            )

            VStack(alignment: .leading, spacing: 2) {
                Text(displayTitle)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(item.trashed ? .secondary : .primary)
                    .lineLimit(1)
                    .truncationMode(.tail)

                Text(subtitleText)
                    .font(.system(size: 10))
                    .foregroundColor(.secondary.opacity(0.8))
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .layoutPriority(1)

            HStack(spacing: 6) {
                if currentSection == .twoFASubtype(.recoveryCodes) {
                    HStack(spacing: 3) {
                        Image(systemName: "key.horizontal.fill")
                            .font(.system(size: 8))
                        Text("\(item.recoveryCodesCount)")
                            .font(.system(size: 9, weight: .bold))
                    }
                    .foregroundColor(LiquidGlassTheme.emeraldAccent)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background(LiquidGlassTheme.emeraldAccent.opacity(0.12))
                    .clipShape(Capsule())
                } else if let totp = item.totpSecret, !totp.isEmpty {
                    MiniTOTPRowView(secret: totp)
                } else if item.isRecoveryCode {
                    HStack(spacing: 3) {
                        Image(systemName: "key.horizontal.fill")
                            .font(.system(size: 8))
                        Text("\(item.recoveryCodesCount)")
                            .font(.system(size: 9, weight: .bold))
                    }
                    .foregroundColor(LiquidGlassTheme.emeraldAccent)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background(LiquidGlassTheme.emeraldAccent.opacity(0.12))
                    .clipShape(Capsule())
                } else if isWeakPassword && !item.trashed {
                    Text("weak")
                        .font(.system(size: 8, weight: .bold))
                        .lineLimit(1)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(LiquidGlassTheme.roseAccent.opacity(0.15))
                        .foregroundColor(LiquidGlassTheme.roseAccent)
                        .clipShape(Capsule())
                } else if shouldShowTypeBadge {
                    Text(item.type.displayName.lowercased())
                        .font(.system(size: 8, weight: .bold))
                        .lineLimit(1)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(Color.white.opacity(0.1))
                        .foregroundColor(.secondary)
                        .clipShape(Capsule())
                }

                if item.favorite && !item.trashed {
                    Image(systemName: "star.fill")
                        .font(.system(size: 10))
                        .foregroundColor(LiquidGlassTheme.amberAccent)
                }
            }
            .fixedSize(horizontal: true, vertical: false)
        }
        .padding(.vertical, 3)
        .contextMenu {
            if item.trashed || currentSection == .trash {
                Button(action: { onRestoreItem?(item.id) }) {
                    Label("Restore Credential", systemImage: "arrow.uturn.backward")
                }

                Divider()

                Button(role: .destructive, action: { onDeletePermanently?(item.id) }) {
                    Label("Delete Permanently", systemImage: "trash.slash.fill")
                }
            } else {
                if !folders.isEmpty {
                    Menu {
                        Button(action: { onMoveToFolder?(item, nil) }) {
                            HStack {
                                Text("No Folder (General)")
                                if currentFolder == nil {
                                    Image(systemName: "checkmark")
                                }
                            }
                        }

                        Divider()

                        ForEach(folders) { f in
                            Button(action: { onMoveToFolder?(item, f) }) {
                                HStack {
                                    Text(f.name)
                                    if currentFolder?.id == f.id {
                                        Image(systemName: "checkmark")
                                    }
                                }
                            }
                        }
                    } label: {
                        Label("Move to Folder", systemImage: "folder")
                    }

                    Divider()
                }

                if let user = item.username, !user.isEmpty {
                    Button(action: {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(user, forType: .string)
                    }) {
                        Label("Copy Username", systemImage: "person")
                    }
                }

                if let pass = item.password, !pass.isEmpty {
                    Button(action: {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(pass, forType: .string)
                    }) {
                        Label("Copy Password", systemImage: "key")
                    }
                }

                Divider()

                Button(action: onToggleFavorite) {
                    Label(item.favorite ? "Unfavorite" : "Favorite", systemImage: item.favorite ? "star.slash" : "star")
                }

                if onDeleteItem != nil {
                    Divider()

                    Button(role: .destructive, action: { onDeleteItem?(item.id) }) {
                        Label("Move to Trash", systemImage: "trash")
                    }
                }
            }
        }
    }
}
