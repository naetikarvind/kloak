import SwiftUI

public struct ItemDetailView: View {
    @Binding var item: VaultItem
    var onSave: (VaultItem) -> Void
    var onDelete: (String) -> Void

    @State private var revealPassword: Bool = false
    @State private var copiedField: String?
    @State private var isShowingDeleteConfirm: Bool = false

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                // Header Card
                HStack(spacing: 14) {
                    FaviconView(
                        urls: item.urls,
                        title: item.title,
                        oauthProvider: item.oauth?.provider,
                        itemType: item.type,
                        size: 46
                    )

                    VStack(alignment: .leading, spacing: 3) {
                        Text(item.title)
                            .font(.system(size: 18, weight: .bold))
                            .lineLimit(1)
                            .truncationMode(.tail)
                            .minimumScaleFactor(0.8)

                        HStack(spacing: 6) {
                            Text(item.type.displayName)
                                .font(.system(size: 11, weight: .medium))
                                .lineLimit(1)
                                .fixedSize()
                                .padding(.horizontal, 7)
                                .padding(.vertical, 2)
                                .background(Color.white.opacity(0.08))
                                .foregroundColor(.secondary)
                                .clipShape(Capsule())

                            if let tag = item.tags.first {
                                Text(tag)
                                    .font(.system(size: 11, weight: .medium))
                                    .lineLimit(1)
                                    .fixedSize()
                                    .padding(.horizontal, 7)
                                    .padding(.vertical, 2)
                                    .background(LiquidGlassTheme.primaryAccent.opacity(0.12))
                                    .foregroundColor(LiquidGlassTheme.primaryAccent)
                                    .clipShape(Capsule())
                            }
                        }
                    }

                    Spacer()

                    Button(action: {
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.6)) {
                            item.favorite.toggle()
                        }
                        onSave(item)
                    }) {
                        Image(systemName: item.favorite ? "star.fill" : "star")
                            .font(.system(size: 15))
                            .foregroundColor(item.favorite ? LiquidGlassTheme.amberAccent : .secondary)
                            .scaleEffect(item.favorite ? 1.15 : 1.0)
                            .padding(8)
                            .background(Color.white.opacity(0.06))
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                }
                .padding(16)
                .glassEffect(cornerRadius: 14)

                // OAuth SSO Connected Account Details
                if item.type == .oauth || item.oauth != nil {
                    VStack(alignment: .leading, spacing: 12) {
                        Label("OAuth 2.0 / SSO Connected Account", systemImage: "link.badge.plus")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(LiquidGlassTheme.purpleAccent)

                        if let oauth = item.oauth {
                            DetailFieldRow(
                                label: "PROVIDER",
                                value: oauth.providerDisplayName ?? oauth.provider,
                                isCopied: false,
                                onCopy: nil
                            )

                            if let email = oauth.accountEmail, !email.isEmpty {
                                DetailFieldRow(
                                    label: "LINKED ACCOUNT EMAIL",
                                    value: email,
                                    isCopied: copiedField == "oauth_email",
                                    onCopy: { copyToClipboard(email, "oauth_email") }
                                )
                            }

                            if let clientId = oauth.clientId, !clientId.isEmpty {
                                DetailFieldRow(
                                    label: "CLIENT ID",
                                    value: clientId,
                                    isCopied: copiedField == "client_id",
                                    onCopy: { copyToClipboard(clientId, "client_id") }
                                )
                            }

                            if let scopes = oauth.scopes, !scopes.isEmpty {
                                DetailFieldRow(
                                    label: "AUTHORIZED SCOPES",
                                    value: scopes.joined(separator: ", "),
                                    isCopied: false,
                                    onCopy: nil
                                )
                            }
                        }
                    }
                    .padding(16)
                    .glassEffect(cornerRadius: 14)
                }

                // Credentials Panel
                VStack(spacing: 12) {
                    if let username = item.username, !username.isEmpty {
                        DetailFieldRow(
                            label: "USERNAME / EMAIL",
                            value: username,
                            isCopied: copiedField == "username",
                            onCopy: { copyToClipboard(username, "username") }
                        )
                    }

                    if let password = item.password, !password.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("PASSWORD")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.secondary)

                            HStack(alignment: .center, spacing: 8) {
                                if revealPassword {
                                    Text(password)
                                        .font(.system(size: 13, design: .monospaced))
                                        .textSelection(.enabled)
                                        .lineLimit(nil)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .fixedSize(horizontal: false, vertical: true)
                                        .transition(.opacity)
                                } else {
                                    Text(String(repeating: "•", count: min(16, password.count)))
                                        .font(.system(size: 14, weight: .heavy))
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .transition(.opacity)
                                }

                                Button(action: {
                                    withAnimation(.easeInOut(duration: 0.2)) {
                                        revealPassword.toggle()
                                    }
                                }) {
                                    Image(systemName: revealPassword ? "eye.slash" : "eye")
                                        .font(.system(size: 12))
                                        .foregroundColor(.secondary)
                                        .padding(6)
                                }
                                .buttonStyle(.plain)

                                Button(action: { copyToClipboard(password, "password") }) {
                                    HStack(spacing: 4) {
                                        Image(systemName: copiedField == "password" ? "checkmark" : "doc.on.doc")
                                            .font(.system(size: 12))
                                            .scaleEffect(copiedField == "password" ? 1.2 : 1.0)
                                        if copiedField == "password" {
                                            Text("Copied").font(.system(size: 11, weight: .bold))
                                                .transition(.opacity.combined(with: .scale))
                                        }
                                    }
                                    .foregroundColor(copiedField == "password" ? LiquidGlassTheme.emeraldAccent : .secondary)
                                    .padding(6)
                                    .animation(.spring(response: 0.3, dampingFraction: 0.7), value: copiedField)
                                }
                                .buttonStyle(.plain)
                            }
                            .padding(10)
                            .background(Color.black.opacity(0.25))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }

                    // URLs
                    if !item.urls.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("WEBSITES / URLS")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.secondary)

                            ForEach(item.urls, id: \.self) { url in
                                HStack {
                                    Link(destination: URL(string: url) ?? URL(string: "https://\(url)")!) {
                                        HStack(spacing: 6) {
                                            Image(systemName: "safari")
                                                .font(.system(size: 11))
                                            Text(url)
                                                .font(.system(size: 12))
                                                .underline()
                                                .lineLimit(1)
                                        }
                                        .foregroundColor(LiquidGlassTheme.primaryAccent)
                                    }

                                    Spacer()

                                    Button(action: { copyToClipboard(url, "url_\(url)") }) {
                                        Image(systemName: copiedField == "url_\(url)" ? "checkmark" : "doc.on.doc")
                                            .font(.system(size: 11))
                                            .foregroundColor(copiedField == "url_\(url)" ? LiquidGlassTheme.emeraldAccent : .secondary)
                                            .scaleEffect(copiedField == "url_\(url)" ? 1.2 : 1.0)
                                            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: copiedField)
                                    }
                                    .buttonStyle(.plain)
                                }
                                .padding(10)
                                .background(Color.black.opacity(0.25))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                        }
                    }

                    // 2FA Secret / TOTP Live Authenticator
                    if let totp = item.totpSecret, !totp.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("AUTHENTICATOR (TOTP)")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.secondary)

                            TOTPRingView(secret: totp)
                                .padding(12)
                                .glassEffect(cornerRadius: 10)
                        }
                    }

                    // Secure Notes
                    if let notes = item.notes, !notes.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("NOTES")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.secondary)

                            Text(notes)
                                .font(.system(size: 12))
                                .textSelection(.enabled)
                                .padding(10)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color.black.opacity(0.25))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }
                }
                .padding(16)
                .glassEffect(cornerRadius: 14)

                // Danger Zone / Delete
                HStack {
                    Spacer()
                    Button(action: { isShowingDeleteConfirm = true }) {
                        HStack(spacing: 6) {
                            Image(systemName: "trash")
                            Text("Delete Item")
                        }
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(LiquidGlassTheme.roseAccent)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(LiquidGlassTheme.roseAccent.opacity(0.12))
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .confirmationDialog("Delete this item?", isPresented: $isShowingDeleteConfirm, titleVisibility: .visible) {
                        Button("Delete Item", role: .destructive) {
                            withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                                onDelete(item.id)
                            }
                        }
                        Button("Cancel", role: .cancel) {}
                    } message: {
                        Text("This item will be moved to trash and permanently deleted according to vault policy.")
                    }
                    Spacer()
                }
                .padding(.top, 8)
            }
            .padding(20)
        }
        .animation(.easeInOut(duration: 0.22), value: item.id)
    }

    private func copyToClipboard(_ text: String, _ field: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
        withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
            copiedField = field
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) {
            withAnimation(.easeInOut(duration: 0.2)) {
                if copiedField == field { copiedField = nil }
            }
        }
    }
}

struct DetailFieldRow: View {
    let label: String
    let value: String
    let isCopied: Bool
    let onCopy: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(.secondary)

            HStack(alignment: .center, spacing: 8) {
                Text(value)
                    .font(.system(size: 12))
                    .textSelection(.enabled)
                    .lineLimit(nil)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .fixedSize(horizontal: false, vertical: true)

                if let copyAction = onCopy {
                    Button(action: copyAction) {
                        HStack(spacing: 4) {
                            Image(systemName: isCopied ? "checkmark" : "doc.on.doc")
                                .font(.system(size: 12))
                                .scaleEffect(isCopied ? 1.2 : 1.0)
                            if isCopied {
                                Text("Copied").font(.system(size: 11, weight: .bold))
                                    .transition(.opacity.combined(with: .scale))
                            }
                        }
                        .foregroundColor(isCopied ? LiquidGlassTheme.emeraldAccent : .secondary)
                        .padding(6)
                        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isCopied)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(10)
            .background(Color.black.opacity(0.25))
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }
}
