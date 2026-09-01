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

    public var body: some View {
        HStack(spacing: 10) {
            // High-resolution logo or fallback icon
            FaviconView(
                urls: item.urls,
                title: item.title,
                oauthProvider: item.oauth?.provider,
                itemType: item.type,
                size: 28
            )

            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.primary)
                    .lineLimit(1)

                Text(item.username ?? item.oauth?.accountEmail ?? item.urls.first ?? item.type.displayName)
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            HStack(spacing: 4) {
                // Type specific badges
                if item.type == .oauth {
                    Text("OAuth")
                        .font(.system(size: 8, weight: .bold))
                        .fixedSize()
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(LiquidGlassTheme.purpleAccent.opacity(0.15))
                        .foregroundColor(LiquidGlassTheme.purpleAccent)
                        .clipShape(Capsule())
                } else if item.type == .card {
                    Text("card")
                        .font(.system(size: 8, weight: .bold))
                        .fixedSize()
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(Color.blue.opacity(0.15))
                        .foregroundColor(Color.blue)
                        .clipShape(Capsule())
                } else if item.type == .identity {
                    Text("identity")
                        .font(.system(size: 8, weight: .bold))
                        .fixedSize()
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(Color.cyan.opacity(0.15))
                        .foregroundColor(Color.cyan)
                        .clipShape(Capsule())
                } else if item.type == .secureNote {
                    Text("note")
                        .font(.system(size: 8, weight: .bold))
                        .fixedSize()
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(Color.yellow.opacity(0.15))
                        .foregroundColor(Color.yellow)
                        .clipShape(Capsule())
                }

                // Status & Security badges
                if hasNoUsername {
                    Text("no username")
                        .font(.system(size: 8, weight: .bold))
                        .fixedSize()
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(Color.orange.opacity(0.15))
                        .foregroundColor(Color.orange)
                        .clipShape(Capsule())
                }

                if isWeakPassword {
                    Text("weak password")
                        .font(.system(size: 8, weight: .bold))
                        .fixedSize()
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(LiquidGlassTheme.roseAccent.opacity(0.15))
                        .foregroundColor(LiquidGlassTheme.roseAccent)
                        .clipShape(Capsule())
                }

                if item.totpSecret != nil && !item.totpSecret!.isEmpty {
                    Text("authenticator")
                        .font(.system(size: 8, weight: .bold))
                        .fixedSize()
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(LiquidGlassTheme.emeraldAccent.opacity(0.15))
                        .foregroundColor(LiquidGlassTheme.emeraldAccent)
                        .clipShape(Capsule())
                }

                if item.favorite {
                    Image(systemName: "star.fill")
                        .font(.system(size: 10))
                        .foregroundColor(LiquidGlassTheme.amberAccent)
                }
            }
        }
        .padding(.vertical, 3)
    }
}
