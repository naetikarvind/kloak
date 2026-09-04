import SwiftUI

public struct ItemDetailView: View {
    @Binding var item: VaultItem
    var onSave: (VaultItem) -> Void
    var onDelete: (String) -> Void

    @State private var revealPassword: Bool = false
    @State private var revealCvv: Bool = false
    @State private var revealCardNumber: Bool = false
    @State private var revealSsn: Bool = false
    @State private var revealPassport: Bool = false
    @State private var revealTotpSecret: Bool = false
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

    // Card Edit States
    @State private var editCardholderName: String = ""
    @State private var editCardNumber: String = ""
    @State private var editCardBrand: String = "visa"
    @State private var editExpMonth: String = ""
    @State private var editExpYear: String = ""
    @State private var editCvv: String = ""
    @State private var editBillingAddress: String = ""

    // Identity Edit States
    @State private var editFirstName: String = ""
    @State private var editLastName: String = ""
    @State private var editIdentityEmail: String = ""
    @State private var editPhone: String = ""
    @State private var editAddress1: String = ""
    @State private var editCity: String = ""
    @State private var editState: String = ""
    @State private var editZip: String = ""
    @State private var editCountry: String = ""
    @State private var editDateOfBirth: String = ""
    @State private var editPassportNumber: String = ""
    @State private var editSsn: String = ""

    // Alias Edit States
    @State private var editAliasEmail: String = ""
    @State private var editForwardTo: String = ""
    @State private var editAliasProvider: String = "DuckDuckGo"

    // Authenticator Edit States
    @State private var editAuthIssuer: String = ""
    @State private var editAuthAlgorithm: String = "TOTP"
    @State private var editAuthDigits: Int = 6
    @State private var editAuthPeriod: Int = 30

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
                                .font(.system(size: 15, weight: .bold))
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
                                .lineLimit(2)
                                .truncationMode(.tail)
                                .minimumScaleFactor(0.85)
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

                            if let tag = item.tags.first(where: { $0.lowercased() != "imported" }) {
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

                    Spacer(minLength: 8)

                    if isEditing {
                        HStack(spacing: 8) {
                            Button(action: cancelEditing) {
                                Text("Cancel")
                                    .font(.system(size: 12, weight: .medium))
                                    .lineLimit(1)
                                    .fixedSize()
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
                                        .lineLimit(1)
                                        .fixedSize()
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
                        .fixedSize()
                    } else {
                        HStack(spacing: 8) {
                            Button(action: startEditing) {
                                Image(systemName: "pencil")
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundColor(.primary)
                                    .frame(width: 32, height: 32)
                                    .background(Color.white.opacity(0.08))
                                    .clipShape(Circle())
                                    .overlay(
                                        Circle()
                                            .stroke(Color.white.opacity(0.12), lineWidth: 1)
                                    )
                            }
                            .buttonStyle(.plain)
                            .help("Edit Item")

                            Button(action: {
                                withAnimation(.spring(response: 0.35, dampingFraction: 0.6)) {
                                    item.favorite.toggle()
                                }
                                onSave(item)
                            }) {
                                Image(systemName: item.favorite ? "star.fill" : "star")
                                    .font(.system(size: 14))
                                    .foregroundColor(item.favorite ? LiquidGlassTheme.amberAccent : .secondary)
                                    .scaleEffect(item.favorite ? 1.15 : 1.0)
                                    .frame(width: 32, height: 32)
                                    .background(Color.white.opacity(0.06))
                                    .clipShape(Circle())
                                    .overlay(
                                        Circle()
                                            .stroke(Color.white.opacity(0.08), lineWidth: 1)
                                    )
                            }
                            .buttonStyle(.plain)
                            .help(item.favorite ? "Remove from Favorites" : "Add to Favorites")
                        }
                        .fixedSize()
                    }
                }
                .padding(16)
                .glassEffect(cornerRadius: 14)

                // EDIT MODE FORM
                if isEditing {
                    VStack(spacing: 16) {
                        switch item.type {
                        case .login:
                            loginEditSection
                        case .card:
                            cardEditSection
                        case .identity:
                            identityEditSection
                        case .emailAlias:
                            aliasEditSection
                        case .authenticator:
                            authenticatorEditSection
                        case .secureNote:
                            EmptyView()
                        }

                        // Notes section (common to all items)
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
                    VStack(spacing: 14) {
                        switch item.type {
                        case .login:
                            loginViewSection
                        case .card:
                            cardViewSection
                        case .identity:
                            identityViewSection
                        case .emailAlias:
                            aliasViewSection
                        case .authenticator:
                            authenticatorViewSection
                        case .secureNote:
                            secureNoteViewSection
                        }

                        // Notes in view mode
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

    // MARK: - Login View & Edit Sections

    @ViewBuilder
    private var loginViewSection: some View {
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
                    } else {
                        Text(String(repeating: "•", count: min(16, password.count)))
                            .font(.system(size: 13, weight: .heavy))
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .frame(height: 18)
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
                            if copiedField == "password" {
                                Text("Copied").font(.system(size: 11, weight: .bold))
                            }
                        }
                        .foregroundColor(copiedField == "password" ? LiquidGlassTheme.emeraldAccent : .secondary)
                        .padding(6)
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
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(10)
                    .background(Color.black.opacity(0.25))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
        }

        // Live Authenticator (if attached to login)
        if let totp = item.totpSecret, !totp.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Text("AUTHENTICATOR (2FA)")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.secondary)

                TOTPRingView(secret: totp)
            }
        }
    }

    @ViewBuilder
    private var loginEditSection: some View {
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
            }
            .padding(10)
            .background(Color.black.opacity(0.3))
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }

        // Password with generator
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

                Button(action: { showEditPassword.toggle() }) {
                    Image(systemName: showEditPassword ? "eye.slash" : "eye")
                        .font(.system(size: 12))
                        .foregroundColor(.secondary)
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
            }
            .padding(10)
            .background(Color.black.opacity(0.3))
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }

        // URLs
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
                        if editUrls.indices.contains(index) { editUrls.remove(at: index) }
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

        // Authenticator
        VStack(alignment: .leading, spacing: 6) {
            Text("AUTHENTICATOR (2FA SECRET KEY)")
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(.secondary)

            HStack(spacing: 8) {
                Image(systemName: "lock.shield")
                    .font(.system(size: 12))
                    .foregroundColor(LiquidGlassTheme.primaryAccent)

                TextField("Base32 Key (e.g. JBSWY3DPEHPK3PXP)", text: $editTotpSecret)
                    .textFieldStyle(.plain)
                    .font(.system(size: 12, design: .monospaced))
            }
            .padding(10)
            .background(Color.black.opacity(0.3))
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }

    // MARK: - Payment Card View & Edit Sections

    @ViewBuilder
    private var cardViewSection: some View {
        let card = item.card ?? CardDetails()

        if let holder = card.cardholderName, !holder.isEmpty {
            DetailFieldRow(
                label: "CARDHOLDER NAME",
                value: holder,
                isCopied: copiedField == "cardholder",
                onCopy: { copyToClipboard(holder, "cardholder") }
            )
        }

        if let num = card.number, !num.isEmpty {
            VStack(alignment: .leading, spacing: 4) {
                Text("CARD NUMBER")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.secondary)

                HStack {
                    if revealCardNumber {
                        Text(num)
                            .font(.system(size: 13, design: .monospaced))
                            .textSelection(.enabled)
                    } else {
                        let masked = "•••• •••• •••• " + (num.replacingOccurrences(of: " ", with: "").suffix(4))
                        Text(masked)
                            .font(.system(size: 13, design: .monospaced))
                    }

                    Spacer()

                    Button(action: { revealCardNumber.toggle() }) {
                        Image(systemName: revealCardNumber ? "eye.slash" : "eye")
                            .font(.system(size: 12))
                            .foregroundColor(.secondary)
                    }
                    .buttonStyle(.plain)

                    Button(action: { copyToClipboard(num.replacingOccurrences(of: " ", with: ""), "card_num") }) {
                        Image(systemName: copiedField == "card_num" ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 12))
                            .foregroundColor(copiedField == "card_num" ? LiquidGlassTheme.emeraldAccent : .secondary)
                    }
                    .buttonStyle(.plain)
                }
                .padding(10)
                .background(Color.black.opacity(0.25))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }

        HStack(spacing: 12) {
            let brand = card.brand ?? "visa"
            DetailFieldRow(
                label: "CARD BRAND",
                value: brand.capitalized,
                isCopied: false,
                onCopy: nil
            )

            let exp = "\(card.expMonth ?? "MM") / \(card.expYear ?? "YYYY")"
            DetailFieldRow(
                label: "EXPIRATION",
                value: exp,
                isCopied: copiedField == "exp",
                onCopy: { copyToClipboard(exp, "exp") }
            )

            if let cvv = card.cvv, !cvv.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("CVV")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.secondary)

                    HStack {
                        Text(revealCvv ? cvv : "•••")
                            .font(.system(size: 12, design: .monospaced))

                        Spacer()

                        Button(action: { revealCvv.toggle() }) {
                            Image(systemName: revealCvv ? "eye.slash" : "eye")
                                .font(.system(size: 11))
                                .foregroundColor(.secondary)
                        }
                        .buttonStyle(.plain)

                        Button(action: { copyToClipboard(cvv, "cvv") }) {
                            Image(systemName: copiedField == "cvv" ? "checkmark" : "doc.on.doc")
                                .font(.system(size: 11))
                                .foregroundColor(copiedField == "cvv" ? LiquidGlassTheme.emeraldAccent : .secondary)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(10)
                    .background(Color.black.opacity(0.25))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
        }

        if let billing = card.billingAddress, !billing.isEmpty {
            DetailFieldRow(
                label: "BILLING ADDRESS",
                value: billing,
                isCopied: copiedField == "billing",
                onCopy: { copyToClipboard(billing, "billing") }
            )
        }
    }

    @ViewBuilder
    private var cardEditSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("CARDHOLDER NAME")
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(.secondary)
            TextField("Name on card", text: $editCardholderName)
                .textFieldStyle(.plain)
                .padding(8)
                .background(Color.black.opacity(0.3))
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }

        VStack(alignment: .leading, spacing: 6) {
            Text("CARD NUMBER")
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(.secondary)
            TextField("4532 •••• •••• 8890", text: $editCardNumber)
                .textFieldStyle(.plain)
                .font(.system(size: 12, design: .monospaced))
                .padding(8)
                .background(Color.black.opacity(0.3))
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }

        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 6) {
                Text("BRAND")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.secondary)
                Picker("", selection: $editCardBrand) {
                    Text("Visa").tag("visa")
                    Text("Mastercard").tag("mastercard")
                    Text("Amex").tag("amex")
                    Text("Discover").tag("discover")
                    Text("Other").tag("other")
                }
                .labelsHidden()
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("EXP MONTH")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.secondary)
                TextField("MM", text: $editExpMonth)
                    .textFieldStyle(.plain)
                    .padding(8)
                    .background(Color.black.opacity(0.3))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("EXP YEAR")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.secondary)
                TextField("YYYY", text: $editExpYear)
                    .textFieldStyle(.plain)
                    .padding(8)
                    .background(Color.black.opacity(0.3))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("CVV")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.secondary)
                TextField("123", text: $editCvv)
                    .textFieldStyle(.plain)
                    .padding(8)
                    .background(Color.black.opacity(0.3))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }

        VStack(alignment: .leading, spacing: 6) {
            Text("BILLING ADDRESS")
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(.secondary)
            TextField("123 Main St, Springfield, OR", text: $editBillingAddress)
                .textFieldStyle(.plain)
                .padding(8)
                .background(Color.black.opacity(0.3))
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }

    // MARK: - Identity View & Edit Sections

    @ViewBuilder
    private var identityViewSection: some View {
        let ident = item.identity ?? IdentityDetails()

        // Personal Information
        Text("CONTACT & IDENTITY")
            .font(.system(size: 11, weight: .bold))
            .foregroundColor(Color.cyan)

        if let fn = ident.fullName, !fn.isEmpty {
            DetailFieldRow(label: "FULL NAME", value: fn, isCopied: copiedField == "id_name", onCopy: { copyToClipboard(fn, "id_name") })
        }

        if let em = ident.email, !em.isEmpty {
            DetailFieldRow(label: "EMAIL ADDRESS", value: em, isCopied: copiedField == "id_email", onCopy: { copyToClipboard(em, "id_email") })
        }

        if let ph = ident.phone, !ph.isEmpty {
            DetailFieldRow(label: "PHONE NUMBER", value: ph, isCopied: copiedField == "id_phone", onCopy: { copyToClipboard(ph, "id_phone") })
        }

        if let dob = ident.dateOfBirth, !dob.isEmpty {
            DetailFieldRow(label: "DATE OF BIRTH", value: dob, isCopied: copiedField == "id_dob", onCopy: { copyToClipboard(dob, "id_dob") })
        }

        // Physical Address
        if let fullAddr = ident.fullAddress, !fullAddr.isEmpty {
            Text("PHYSICAL ADDRESS")
                .font(.system(size: 11, weight: .bold))
                .foregroundColor(Color.cyan)
                .padding(.top, 4)

            DetailFieldRow(label: "ADDRESS", value: fullAddr, isCopied: copiedField == "id_addr", onCopy: { copyToClipboard(fullAddr, "id_addr") })
        }

        // Government IDs
        if (ident.passportNumber != nil && !ident.passportNumber!.isEmpty) || (ident.ssn != nil && !ident.ssn!.isEmpty) {
            Text("GOVERNMENT IDENTIFIERS")
                .font(.system(size: 11, weight: .bold))
                .foregroundColor(Color.cyan)
                .padding(.top, 4)

            if let passport = ident.passportNumber, !passport.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("PASSPORT NUMBER")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.secondary)
                    HStack {
                        Text(revealPassport ? passport : "••••••••••")
                            .font(.system(size: 12, design: .monospaced))
                        Spacer()
                        Button(action: { revealPassport.toggle() }) {
                            Image(systemName: revealPassport ? "eye.slash" : "eye")
                                .font(.system(size: 11))
                                .foregroundColor(.secondary)
                        }
                        .buttonStyle(.plain)
                        Button(action: { copyToClipboard(passport, "passport") }) {
                            Image(systemName: copiedField == "passport" ? "checkmark" : "doc.on.doc")
                                .font(.system(size: 11))
                                .foregroundColor(copiedField == "passport" ? LiquidGlassTheme.emeraldAccent : .secondary)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(10)
                    .background(Color.black.opacity(0.25))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }

            if let ssn = ident.ssn, !ssn.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("SSN / NATIONAL ID")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.secondary)
                    HStack {
                        Text(revealSsn ? ssn : "•••-••-••••")
                            .font(.system(size: 12, design: .monospaced))
                        Spacer()
                        Button(action: { revealSsn.toggle() }) {
                            Image(systemName: revealSsn ? "eye.slash" : "eye")
                                .font(.system(size: 11))
                                .foregroundColor(.secondary)
                        }
                        .buttonStyle(.plain)
                        Button(action: { copyToClipboard(ssn, "ssn") }) {
                            Image(systemName: copiedField == "ssn" ? "checkmark" : "doc.on.doc")
                                .font(.system(size: 11))
                                .foregroundColor(copiedField == "ssn" ? LiquidGlassTheme.emeraldAccent : .secondary)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(10)
                    .background(Color.black.opacity(0.25))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
        }
    }

    @ViewBuilder
    private var identityEditSection: some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 4) {
                Text("FIRST NAME").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                TextField("First Name", text: $editFirstName).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("LAST NAME").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                TextField("Last Name", text: $editLastName).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
            }
        }

        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 4) {
                Text("EMAIL").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                TextField("Email", text: $editIdentityEmail).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("PHONE").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                TextField("Phone", text: $editPhone).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
            }
        }

        VStack(alignment: .leading, spacing: 4) {
            Text("STREET ADDRESS").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
            TextField("123 Main St, Apt 4B", text: $editAddress1).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
        }

        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 4) {
                Text("CITY").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                TextField("City", text: $editCity).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("STATE").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                TextField("State", text: $editState).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("ZIP").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                TextField("ZIP", text: $editZip).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
            }
        }

        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 4) {
                Text("COUNTRY").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                TextField("Country", text: $editCountry).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("DATE OF BIRTH").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                TextField("YYYY-MM-DD", text: $editDateOfBirth).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
            }
        }

        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 4) {
                Text("PASSPORT NUMBER").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                TextField("Passport Number", text: $editPassportNumber).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("SSN / ID NUMBER").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                TextField("SSN / National ID", text: $editSsn).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
            }
        }
    }

    // MARK: - Email Alias View & Edit Sections

    @ViewBuilder
    private var aliasViewSection: some View {
        let alias = item.alias ?? AliasDetails()

        if let em = alias.aliasEmail ?? item.username, !em.isEmpty {
            DetailFieldRow(label: "ALIAS EMAIL ADDRESS", value: em, isCopied: copiedField == "alias_em", onCopy: { copyToClipboard(em, "alias_em") })
        }

        if let fwd = alias.forwardTo, !fwd.isEmpty {
            DetailFieldRow(label: "FORWARDS TO", value: fwd, isCopied: copiedField == "alias_fwd", onCopy: { copyToClipboard(fwd, "alias_fwd") })
        }

        if let prov = alias.provider, !prov.isEmpty {
            DetailFieldRow(label: "ALIAS PROVIDER", value: prov, isCopied: false, onCopy: nil)
        }
    }

    @ViewBuilder
    private var aliasEditSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("ALIAS EMAIL ADDRESS").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
            TextField("alias_xyz123@duck.com", text: $editAliasEmail).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
        }

        VStack(alignment: .leading, spacing: 4) {
            Text("FORWARD TO").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
            TextField("real.email@example.com", text: $editForwardTo).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
        }

        VStack(alignment: .leading, spacing: 4) {
            Text("PROVIDER").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
            Picker("", selection: $editAliasProvider) {
                Text("DuckDuckGo").tag("DuckDuckGo")
                Text("SimpleLogin").tag("SimpleLogin")
                Text("Firefox Relay").tag("Firefox Relay")
                Text("iCloud Hide My Email").tag("iCloud")
                Text("Custom").tag("Custom")
            }
            .labelsHidden()
        }
    }

    // MARK: - Authenticator View & Edit Sections

    @ViewBuilder
    private var authenticatorViewSection: some View {
        let auth = item.authenticatorDetails ?? AuthenticatorDetails()

        if let secret = item.totpSecret, !secret.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Text("LIVE 2FA PASSCODE")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.secondary)

                TOTPRingView(secret: secret)
            }
        }

        if let issuer = auth.issuer, !issuer.isEmpty {
            DetailFieldRow(label: "ISSUER / SERVICE", value: issuer, isCopied: false, onCopy: nil)
        }

        HStack(spacing: 12) {
            DetailFieldRow(label: "ALGORITHM", value: auth.algorithm ?? "TOTP", isCopied: false, onCopy: nil)
            DetailFieldRow(label: "DIGITS", value: "\(auth.digits ?? 6)", isCopied: false, onCopy: nil)
            DetailFieldRow(label: "PERIOD", value: "\(auth.period ?? 30)s", isCopied: false, onCopy: nil)
        }

        if let secret = item.totpSecret, !secret.isEmpty {
            VStack(alignment: .leading, spacing: 4) {
                Text("SECRET KEY")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.secondary)

                HStack {
                    Text(revealTotpSecret ? secret : "••••••••••••••••")
                        .font(.system(size: 12, design: .monospaced))
                    Spacer()
                    Button(action: { revealTotpSecret.toggle() }) {
                        Image(systemName: revealTotpSecret ? "eye.slash" : "eye")
                            .font(.system(size: 11))
                            .foregroundColor(.secondary)
                    }
                    .buttonStyle(.plain)
                    Button(action: { copyToClipboard(secret, "totp_secret") }) {
                        Image(systemName: copiedField == "totp_secret" ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 11))
                            .foregroundColor(copiedField == "totp_secret" ? LiquidGlassTheme.emeraldAccent : .secondary)
                    }
                    .buttonStyle(.plain)
                }
                .padding(10)
                .background(Color.black.opacity(0.25))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    @ViewBuilder
    private var authenticatorEditSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("ISSUER / SERVICE").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
            TextField("e.g. GitHub, AWS, Google", text: $editAuthIssuer).textFieldStyle(.plain).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
        }

        VStack(alignment: .leading, spacing: 4) {
            Text("SECRET KEY (BASE32 OR OTPAUTH://)").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
            TextField("JBSWY3DPEHPK3PXP", text: $editTotpSecret).textFieldStyle(.plain).font(.system(size: 12, design: .monospaced)).padding(8).background(Color.black.opacity(0.3)).clipShape(RoundedRectangle(cornerRadius: 6))
        }

        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("ALGORITHM").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                Picker("", selection: $editAuthAlgorithm) {
                    Text("TOTP (Time-based)").tag("TOTP")
                    Text("HOTP (Counter-based)").tag("HOTP")
                }
                .labelsHidden()
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("DIGITS").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                Picker("", selection: $editAuthDigits) {
                    Text("6 digits").tag(6)
                    Text("8 digits").tag(8)
                }
                .labelsHidden()
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("PERIOD").font(.system(size: 10, weight: .bold)).foregroundColor(.secondary)
                Picker("", selection: $editAuthPeriod) {
                    Text("30s").tag(30)
                    Text("60s").tag(60)
                }
                .labelsHidden()
            }
        }
    }

    // MARK: - Secure Note View Section

    @ViewBuilder
    private var secureNoteViewSection: some View {
        if let notes = item.notes, !notes.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("ENCRYPTED CONTENT")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.secondary)
                    Spacer()
                    Button(action: { copyToClipboard(notes, "note_content") }) {
                        HStack(spacing: 4) {
                            Image(systemName: copiedField == "note_content" ? "checkmark" : "doc.on.doc")
                            Text("Copy Note")
                        }
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(LiquidGlassTheme.primaryAccent)
                    }
                    .buttonStyle(.plain)
                }

                Text(notes)
                    .font(.system(size: 13))
                    .textSelection(.enabled)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.black.opacity(0.3))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    // MARK: - Edit State Management

    private func startEditing() {
        editTitle = item.title
        editUsername = item.username ?? ""
        editPassword = item.password ?? ""
        editUrls = item.urls.isEmpty ? [""] : item.urls
        editTotpSecret = item.totpSecret ?? ""
        editNotes = item.notes ?? ""
        showEditPassword = false

        // Card
        if let card = item.card {
            editCardholderName = card.cardholderName ?? ""
            editCardNumber = card.number ?? ""
            editCardBrand = card.brand ?? "visa"
            editExpMonth = card.expMonth ?? ""
            editExpYear = card.expYear ?? ""
            editCvv = card.cvv ?? ""
            editBillingAddress = card.billingAddress ?? ""
        }

        // Identity
        if let id = item.identity {
            editFirstName = id.firstName ?? ""
            editLastName = id.lastName ?? ""
            editIdentityEmail = id.email ?? ""
            editPhone = id.phone ?? ""
            editAddress1 = id.address1 ?? ""
            editCity = id.city ?? ""
            editState = id.state ?? ""
            editZip = id.zip ?? ""
            editCountry = id.country ?? ""
            editDateOfBirth = id.dateOfBirth ?? ""
            editPassportNumber = id.passportNumber ?? ""
            editSsn = id.ssn ?? ""
        }

        // Alias
        if let alias = item.alias {
            editAliasEmail = alias.aliasEmail ?? ""
            editForwardTo = alias.forwardTo ?? ""
            editAliasProvider = alias.provider ?? "DuckDuckGo"
        }

        // Authenticator
        if let auth = item.authenticatorDetails {
            editAuthIssuer = auth.issuer ?? ""
            editAuthAlgorithm = auth.algorithm ?? "TOTP"
            editAuthDigits = auth.digits ?? 6
            editAuthPeriod = auth.period ?? 30
        }

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
        let trimmedNotes = editNotes.trimmingCharacters(in: .whitespacesAndNewlines)
        updated.notes = trimmedNotes.isEmpty ? nil : trimmedNotes

        switch item.type {
        case .login:
            let trimmedUser = editUsername.trimmingCharacters(in: .whitespacesAndNewlines)
            updated.username = trimmedUser.isEmpty ? nil : trimmedUser
            updated.password = editPassword.isEmpty ? nil : editPassword
            updated.urls = editUrls.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
            let trimmedTotp = editTotpSecret.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: " ", with: "")
            updated.totpSecret = trimmedTotp.isEmpty ? nil : trimmedTotp

        case .card:
            updated.username = editCardholderName.isEmpty ? nil : editCardholderName
            updated.password = editCvv.isEmpty ? nil : editCvv
            updated.card = CardDetails(
                cardholderName: editCardholderName.isEmpty ? nil : editCardholderName,
                number: editCardNumber.isEmpty ? nil : editCardNumber,
                brand: editCardBrand,
                expMonth: editExpMonth.isEmpty ? nil : editExpMonth,
                expYear: editExpYear.isEmpty ? nil : editExpYear,
                cvv: editCvv.isEmpty ? nil : editCvv,
                billingAddress: editBillingAddress.isEmpty ? nil : editBillingAddress
            )

        case .identity:
            let fn = [editFirstName, editLastName].filter { !$0.isEmpty }.joined(separator: " ")
            updated.username = fn.isEmpty ? (editIdentityEmail.isEmpty ? nil : editIdentityEmail) : fn
            updated.identity = IdentityDetails(
                firstName: editFirstName.isEmpty ? nil : editFirstName,
                lastName: editLastName.isEmpty ? nil : editLastName,
                email: editIdentityEmail.isEmpty ? nil : editIdentityEmail,
                phone: editPhone.isEmpty ? nil : editPhone,
                address1: editAddress1.isEmpty ? nil : editAddress1,
                city: editCity.isEmpty ? nil : editCity,
                state: editState.isEmpty ? nil : editState,
                zip: editZip.isEmpty ? nil : editZip,
                country: editCountry.isEmpty ? nil : editCountry,
                dateOfBirth: editDateOfBirth.isEmpty ? nil : editDateOfBirth,
                passportNumber: editPassportNumber.isEmpty ? nil : editPassportNumber,
                ssn: editSsn.isEmpty ? nil : editSsn
            )

        case .emailAlias:
            updated.username = editAliasEmail.isEmpty ? nil : editAliasEmail
            updated.alias = AliasDetails(
                aliasEmail: editAliasEmail.isEmpty ? nil : editAliasEmail,
                forwardTo: editForwardTo.isEmpty ? nil : editForwardTo,
                provider: editAliasProvider
            )

        case .authenticator:
            let trimmedTotp = editTotpSecret.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: " ", with: "")
            updated.totpSecret = trimmedTotp.isEmpty ? nil : trimmedTotp
            updated.username = editAuthIssuer.isEmpty ? nil : editAuthIssuer
            updated.authenticatorDetails = AuthenticatorDetails(
                issuer: editAuthIssuer.isEmpty ? nil : editAuthIssuer,
                algorithm: editAuthAlgorithm,
                digits: editAuthDigits,
                period: editAuthPeriod
            )

        case .secureNote:
            break
        }

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
