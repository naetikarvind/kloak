import SwiftUI

public struct ItemDetailView: View {
    @Binding var item: VaultItem
    var onSave: (VaultItem) -> Void
    var onDelete: (String) -> Void

    @State private var revealPassword: Bool = false
    @State private var copiedField: String?
    @State private var isShowingDeleteConfirm: Bool = false

    // Edit Mode States
    @State private var isEditing: Bool = false
    @State private var editTitle: String = ""
    @State private var editUsername: String = ""
    @State private var editPassword: String = ""
    @State private var editUrls: [String] = []
    @State private var editTotpSecret: String = ""
    @State private var editNotes: String = ""
    @State private var showEditPassword: Bool = false

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                // Header Card
                HStack(spacing: 14) {
                    FaviconView(
                        urls: isEditing ? editUrls : item.urls,
                        title: isEditing ? editTitle : item.title,
                        oauthProvider: item.oauth?.provider,
                        itemType: item.type,
                        size: 46
                    )

                    VStack(alignment: .leading, spacing: 4) {
                        if isEditing {
                            TextField("Item Title", text: $editTitle)
                                .font(.system(size: 16, weight: .bold))
                                .textFieldStyle(.plain)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.black.opacity(0.3))
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 6)
                                        .stroke(LiquidGlassTheme.primaryAccent.opacity(0.5), lineWidth: 1)
                                )
                        } else {
                            Text(item.title)
                                .font(.system(size: 18, weight: .bold))
                                .lineLimit(1)
                                .truncationMode(.tail)
                                .minimumScaleFactor(0.8)
                        }

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

                    if isEditing {
                        HStack(spacing: 8) {
                            Button(action: cancelEditing) {
                                Text("Cancel")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundColor(.secondary)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(Color.white.opacity(0.08))
                                    .clipShape(Capsule())
                            }
                            .buttonStyle(.plain)

                            Button(action: saveEditing) {
                                HStack(spacing: 4) {
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 11, weight: .bold))
                                    Text("Save")
                                        .font(.system(size: 12, weight: .bold))
                                }
                                .foregroundColor(.white)
                                .padding(.horizontal, 14)
                                .padding(.vertical, 6)
                                .background(LiquidGlassTheme.primaryAccent)
                                .clipShape(Capsule())
                                .shadow(color: LiquidGlassTheme.primaryAccent.opacity(0.4), radius: 6, x: 0, y: 2)
                            }
                            .buttonStyle(.plain)
                        }
                    } else {
                        HStack(spacing: 8) {
                            Button(action: startEditing) {
                                HStack(spacing: 4) {
                                    Image(systemName: "pencil")
                                        .font(.system(size: 11, weight: .semibold))
                                    Text("Edit")
                                        .font(.system(size: 12, weight: .semibold))
                                }
                                .foregroundColor(.primary)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(Color.white.opacity(0.08))
                                .clipShape(Capsule())
                                .overlay(
                                    Capsule()
                                        .stroke(Color.white.opacity(0.12), lineWidth: 1)
                                )
                            }
                            .buttonStyle(.plain)

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
                    }
                }
                .padding(16)
                .glassEffect(cornerRadius: 14)

                // EDIT MODE FORM
                if isEditing {
                    VStack(spacing: 16) {
                        // Username / Email
                        VStack(alignment: .leading, spacing: 6) {
                            Text("USERNAME / EMAIL")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.secondary)

                            HStack(spacing: 8) {
                                Image(systemName: "person.fill")
                                    .font(.system(size: 12))
                                    .foregroundColor(LiquidGlassTheme.primaryAccent)

                                TextField("Username or email", text: $editUsername)
                                    .textFieldStyle(.plain)
                                    .font(.system(size: 13))

                                if !editUsername.isEmpty {
                                    Button(action: { editUsername = "" }) {
                                        Image(systemName: "xmark.circle.fill")
                                            .font(.system(size: 11))
                                            .foregroundColor(.secondary)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(10)
                            .background(Color.black.opacity(0.3))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color.white.opacity(0.08), lineWidth: 1)
                            )
                        }

                        // Password with live generator & strength meter
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text("PASSWORD")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(.secondary)

                                Spacer()

                                if !editPassword.isEmpty {
                                    Text(passwordStrengthText)
                                        .font(.system(size: 10, weight: .bold))
                                        .foregroundColor(passwordStrengthColor)
                                }
                            }

                            HStack(spacing: 8) {
                                Image(systemName: "key.fill")
                                    .font(.system(size: 12))
                                    .foregroundColor(LiquidGlassTheme.primaryAccent)

                                if showEditPassword {
                                    TextField("Password", text: $editPassword)
                                        .textFieldStyle(.plain)
                                        .font(.system(size: 13, design: .monospaced))
                                } else {
                                    SecureField("Password", text: $editPassword)
                                        .textFieldStyle(.plain)
                                        .font(.system(size: 13))
                                }

                                Button(action: {
                                    withAnimation(.easeInOut(duration: 0.15)) {
                                        showEditPassword.toggle()
                                    }
                                }) {
                                    Image(systemName: showEditPassword ? "eye.slash" : "eye")
                                        .font(.system(size: 12))
                                        .foregroundColor(.secondary)
                                        .padding(4)
                                }
                                .buttonStyle(.plain)

                                Button(action: generatePassword) {
                                    HStack(spacing: 3) {
                                        Image(systemName: "dice.fill")
                                            .font(.system(size: 11))
                                        Text("Generate")
                                            .font(.system(size: 10, weight: .bold))
                                    }
                                    .foregroundColor(LiquidGlassTheme.primaryAccent)
                                    .padding(.horizontal, 7)
                                    .padding(.vertical, 4)
                                    .background(LiquidGlassTheme.primaryAccent.opacity(0.15))
                                    .clipShape(RoundedRectangle(cornerRadius: 6))
                                }
                                .buttonStyle(.plain)
                                .help("Generate high-entropy password")
                            }
                            .padding(10)
                            .background(Color.black.opacity(0.3))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color.white.opacity(0.08), lineWidth: 1)
                            )

                            // Password Strength Bar
                            if !editPassword.isEmpty {
                                HStack(spacing: 4) {
                                    ForEach(1...4, id: \.self) { seg in
                                        RoundedRectangle(cornerRadius: 2)
                                            .fill(seg <= passwordStrengthScore ? passwordStrengthColor : Color.white.opacity(0.1))
                                            .frame(height: 3)
                                    }
                                }
                                .padding(.top, 2)
                            }
                        }

                        // Websites / URLs
                        VStack(alignment: .leading, spacing: 6) {
                            Text("WEBSITES / URLS")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.secondary)

                            ForEach(Array(editUrls.enumerated()), id: \.offset) { index, _ in
                                HStack(spacing: 8) {
                                    Image(systemName: "safari")
                                        .font(.system(size: 12))
                                        .foregroundColor(LiquidGlassTheme.primaryAccent)

                                    TextField("https://example.com", text: Binding(
                                        get: { editUrls.indices.contains(index) ? editUrls[index] : "" },
                                        set: { if editUrls.indices.contains(index) { editUrls[index] = $0 } }
                                    ))
                                    .textFieldStyle(.plain)
                                    .font(.system(size: 12))

                                    Button(action: {
                                        if editUrls.indices.contains(index) {
                                            editUrls.remove(at: index)
                                        }
                                    }) {
                                        Image(systemName: "minus.circle.fill")
                                            .font(.system(size: 12))
                                            .foregroundColor(LiquidGlassTheme.roseAccent)
                                    }
                                    .buttonStyle(.plain)
                                }
                                .padding(8)
                                .background(Color.black.opacity(0.3))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                                )
                            }

                            Button(action: { editUrls.append("") }) {
                                HStack(spacing: 4) {
                                    Image(systemName: "plus.circle.fill")
                                        .font(.system(size: 11))
                                    Text("Add another website")
                                        .font(.system(size: 11, weight: .medium))
                                }
                                .foregroundColor(LiquidGlassTheme.primaryAccent)
                                .padding(.vertical, 4)
                            }
                            .buttonStyle(.plain)
                        }

                        // 2FA TOTP Secret
                        VStack(alignment: .leading, spacing: 6) {
                            Text("2FA SECRET KEY (TOTP)")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.secondary)

                            HStack(spacing: 8) {
                                Image(systemName: "lock.shield")
                                    .font(.system(size: 12))
                                    .foregroundColor(LiquidGlassTheme.primaryAccent)

                                TextField("Base32 Key (e.g. JBSWY3DPEHPK3PXP)", text: $editTotpSecret)
                                    .textFieldStyle(.plain)
                                    .font(.system(size: 12, design: .monospaced))

                                if !editTotpSecret.isEmpty {
                                    Button(action: { editTotpSecret = "" }) {
                                        Image(systemName: "xmark.circle.fill")
                                            .font(.system(size: 11))
                                            .foregroundColor(.secondary)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(10)
                            .background(Color.black.opacity(0.3))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color.white.opacity(0.08), lineWidth: 1)
                            )

                            if !editTotpSecret.isEmpty {
                                TOTPRingView(secret: editTotpSecret.replacingOccurrences(of: " ", with: ""))
                                    .padding(8)
                                    .glassEffect(cornerRadius: 8)
                            }
                        }

                        // Notes
                        VStack(alignment: .leading, spacing: 6) {
                            Text("NOTES")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.secondary)

                            TextEditor(text: $editNotes)
                                .font(.system(size: 12))
                                .frame(minHeight: 70)
                                .padding(6)
                                .background(Color.black.opacity(0.3))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                                )
                        }
                    }
                    .padding(16)
                    .glassEffect(cornerRadius: 14)
                } else {
                    // VIEW MODE DETAILS
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
                                            .lineLimit(1)
                                            .frame(maxWidth: .infinity, alignment: .leading)
                                            .frame(height: 18)
                                            .transition(.opacity)
                                    } else {
                                        Text(String(repeating: "•", count: min(16, password.count)))
                                            .font(.system(size: 13, weight: .heavy))
                                            .frame(maxWidth: .infinity, alignment: .leading)
                                            .frame(height: 18)
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
            }
            .padding(20)
        }
        .animation(.easeInOut(duration: 0.22), value: item.id)
        .onChange(of: item.id) {
            isEditing = false
        }
    }

    private func startEditing() {
        editTitle = item.title
        editUsername = item.username ?? item.oauth?.accountEmail ?? ""
        editPassword = item.password ?? ""
        editUrls = item.urls.isEmpty ? [""] : item.urls
        editTotpSecret = item.totpSecret ?? ""
        editNotes = item.notes ?? ""
        showEditPassword = false
        withAnimation(.easeInOut(duration: 0.22)) {
            isEditing = true
        }
    }

    private func cancelEditing() {
        withAnimation(.easeInOut(duration: 0.22)) {
            isEditing = false
        }
    }

    private func saveEditing() {
        var updated = item
        let trimmedTitle = editTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        updated.title = trimmedTitle.isEmpty ? "Untitled" : trimmedTitle
        let trimmedUser = editUsername.trimmingCharacters(in: .whitespacesAndNewlines)
        updated.username = trimmedUser.isEmpty ? nil : trimmedUser
        updated.password = editPassword.isEmpty ? nil : editPassword
        updated.urls = editUrls.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        let trimmedTotp = editTotpSecret.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: " ", with: "")
        updated.totpSecret = trimmedTotp.isEmpty ? nil : trimmedTotp
        let trimmedNotes = editNotes.trimmingCharacters(in: .whitespacesAndNewlines)
        updated.notes = trimmedNotes.isEmpty ? nil : trimmedNotes
        updated.updatedAt = ISO8601DateFormatter().string(from: Date())

        onSave(updated)
        withAnimation(.easeInOut(duration: 0.22)) {
            isEditing = false
        }
    }

    private func generatePassword() {
        let pool = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"
        var res = ""
        for _ in 0..<20 {
            if let ch = pool.randomElement() {
                res.append(ch)
            }
        }
        withAnimation(.easeInOut(duration: 0.2)) {
            editPassword = res
            showEditPassword = true
        }
    }

    private var passwordStrengthScore: Int {
        var score = 0
        if editPassword.count >= 8 { score += 1 }
        if editPassword.count >= 14 { score += 1 }
        if editPassword.rangeOfCharacter(from: .uppercaseLetters) != nil &&
           editPassword.rangeOfCharacter(from: .lowercaseLetters) != nil { score += 1 }
        if editPassword.rangeOfCharacter(from: .decimalDigits) != nil &&
           editPassword.rangeOfCharacter(from: .punctuationCharacters.union(.symbols)) != nil { score += 1 }
        return score
    }

    private var passwordStrengthColor: Color {
        switch passwordStrengthScore {
        case 0, 1: return LiquidGlassTheme.roseAccent
        case 2: return LiquidGlassTheme.amberAccent
        case 3: return Color.yellow
        case 4: return LiquidGlassTheme.emeraldAccent
        default: return .secondary
        }
    }

    private var passwordStrengthText: String {
        switch passwordStrengthScore {
        case 0, 1: return "Weak"
        case 2: return "Fair"
        case 3: return "Good"
        case 4: return "Strong"
        default: return ""
        }
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
