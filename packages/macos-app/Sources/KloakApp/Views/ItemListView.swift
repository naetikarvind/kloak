import SwiftUI

public struct ItemListView: View {
    var items: [VaultItem]
    @Binding var selectedItemId: String?
    @Binding var searchText: String
    var onToggleFavorite: (String) -> Void
    var onAddItem: (() -> Void)? = nil

    public var body: some View {
        VStack(spacing: 0) {
            // Search field & Add button
            HStack(spacing: 8) {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.secondary)
                        .font(.system(size: 12))

                    TextField("Search credentials, logins, URLs...", text: $searchText)
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

                if let onAdd = onAddItem {
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
                    Image(systemName: "lock.slash")
                        .font(.system(size: 32))
                        .foregroundColor(.secondary.opacity(0.5))
                    Text(searchText.isEmpty ? "No items in this section" : "No matches for \"\(searchText)\"")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.secondary)
                    Spacer()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .transition(.opacity)
            } else {
                List(selection: $selectedItemId) {
                    ForEach(items) { item in
                        ItemRowView(item: item, onToggleFavorite: {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                                onToggleFavorite(item.id)
                            }
                        })
                        .tag(item.id)
                    }
                }
                .listStyle(.inset)
                .animation(.spring(response: 0.35, dampingFraction: 0.75), value: items)
            }
        }
    }
}

public struct ItemRowView: View {
    let item: VaultItem
    var onToggleFavorite: () -> Void

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

    private var hasNoUsername: Bool {
        guard item.type == .login else { return false }
        let u = item.username?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let e = item.oauth?.accountEmail?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return u.isEmpty && e.isEmpty
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

    public var body: some View {
        HStack(spacing: 10) {
            // High-resolution logo or fallback icon
            FaviconView(
                urls: item.urls,
                title: displayTitle,
                oauthProvider: item.oauth?.provider,
                itemType: item.type,
                size: 28
            )

            VStack(alignment: .leading, spacing: 2) {
                Text(displayTitle)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.primary)
                    .lineLimit(1)
                    .truncationMode(.tail)

                Text(subtitleText)
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .layoutPriority(1)

            HStack(spacing: 4) {
                if isWeakPassword {
                    Text("weak")
                        .font(.system(size: 8, weight: .bold))
                        .lineLimit(1)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(LiquidGlassTheme.roseAccent.opacity(0.15))
                        .foregroundColor(LiquidGlassTheme.roseAccent)
                        .clipShape(Capsule())
                } else if item.totpSecret != nil && !item.totpSecret!.isEmpty {
                    Text("2FA")
                        .font(.system(size: 8, weight: .bold))
                        .lineLimit(1)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(LiquidGlassTheme.emeraldAccent.opacity(0.15))
                        .foregroundColor(LiquidGlassTheme.emeraldAccent)
                        .clipShape(Capsule())
                } else if item.type != .login {
                    Text(item.type.displayName.lowercased())
                        .font(.system(size: 8, weight: .bold))
                        .lineLimit(1)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(Color.white.opacity(0.1))
                        .foregroundColor(.secondary)
                        .clipShape(Capsule())
                }

                if item.favorite {
                    Image(systemName: "star.fill")
                        .font(.system(size: 10))
                        .foregroundColor(LiquidGlassTheme.amberAccent)
                }
            }
            .fixedSize(horizontal: true, vertical: false)
        }
        .padding(.vertical, 3)
    }
}
