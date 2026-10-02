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

                    Text(currentSection == .trash
                         ? (searchText.isEmpty ? "Trash is Empty" : "No trash matches for \"\(searchText)\"")
                         : (searchText.isEmpty ? "No items in this section" : "No matches for \"\(searchText)\""))
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.secondary)

                    if currentSection == .trash && searchText.isEmpty {
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
                List(selection: $selectedItemId) {
                    ForEach(items) { item in
                        ItemRowView(
                            item: item,
                            folders: folders,
                            currentSection: currentSection,
                            onToggleFavorite: {
                                withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                                    onToggleFavorite(item.id)
                                }
                            },
                            onMoveToFolder: onMoveToFolder,
                            onDeleteItem: onDeleteItem,
                            onRestoreItem: onRestoreItem,
                            onDeletePermanently: onDeletePermanently
                        )
                        .tag(item.id)
                    }
                }
                .listStyle(.inset)
                .tint(LiquidGlassTheme.primaryAccent)
                .accentColor(LiquidGlassTheme.primaryAccent)
                .animation(.spring(response: 0.35, dampingFraction: 0.75), value: items)
            }
        }
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
        folders.first(where: { f in
            item.tags.contains(f.id) || item.tags.contains(where: { $0.lowercased() == f.name.lowercased() })
        })
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
            return item.notes?.components(separatedBy: .newlines).first ?? "Secure Note"
        case .login:
            return item.username ?? item.urls.first ?? item.type.displayName
        }
    }

    private var displayTitle: String {
        let t = item.title.trimmingCharacters(in: .whitespacesAndNewlines)
        if !t.isEmpty { return t }
        if let u = item.username, !u.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return u }
        if let url = item.urls.first, !url.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return url }
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
                if let totp = item.totpSecret, !totp.isEmpty {
                    MiniTOTPRowView(secret: totp)
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
