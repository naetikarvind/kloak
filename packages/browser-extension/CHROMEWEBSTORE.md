# Chrome Web Store Listing — Kloak Password Manager

## Store Metadata

- **Name**: Kloak Password Manager
- **Version**: 1.0.0
- **Category**: Productivity / Privacy & Security
- **Short Description** (128 / 132 chars max):
  Local-first password manager with instant autofill, built-in 2FA authenticator, phishing protection, and desktop vault sync.
- **Single Purpose Statement (Concise — Recommended for Dashboard input field)**:
  Securely autofill and manage login credentials and two-factor authentication codes from the local Kloak vault into web forms.

- **Single Purpose Description (Detailed / Reviewer Explanation)**:
  The single purpose of Kloak Password Manager is to securely autofill login credentials, passkeys, and two-factor authentication (TOTP) codes from the user's local, encrypted vault directly into website login fields. All features—including 1-click autofill, credential lookup, secure password generation for registration forms, and anti-phishing domain verification—exist solely to facilitate and protect this singular credential filling flow.

---

## Detailed Description (Store-Facing Plain Text)

Kloak is a fast, local-first password manager and authenticator designed for speed, privacy, and seamless autofill. Powered by your native Kloak desktop vault, Kloak keeps your passwords, passkeys, and two-factor codes securely on your own device—never on third-party cloud servers.

Enjoy instant, intelligent credential autofill on any website, built-in TOTP two-factor authentication countdowns, anti-phishing domain verification, and high-entropy password generation directly within Google Chrome.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KEY FEATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• LOCAL-FIRST & ZERO-KNOWLEDGE
Your master password and encryption keys never leave your machine. Your vault is encrypted locally with military-grade AES-256-GCM. No cloud accounts, no tracking, and zero remote data exposure.

• INTELLIGENT 1-CLICK AUTOFILL
Instantly detects login, registration, and payment forms. Automatically fills usernames, secure passwords, and credit card details with one click or keyboard shortcut.

• INTEGRATED 2FA TOTP AUTHENTICATOR
Eliminate the need for separate authenticator mobile apps. Kloak generates standard RFC 6238 two-factor codes with live visual countdown timers and automatically pastes them into 2FA verification prompts.

• ADVANCED PHISHING & SPOOFING DEFENSE
Protects you against counterfeit websites, lookalike domains, and homograph attacks. Kloak verifies the strict authenticated domain before suggesting credentials, ensuring you never accidentally leak a password to a fraudulent site.

• CONVENIENT CHROME SIDE PANEL & QUICK POPUP
Access your entire credential vault right alongside your browsing tab via Chrome's native Side Panel, or use the lightweight toolbar popup for lightning-fast credential lookups.

• HIGH-ENTROPY PASSWORD GENERATOR
Create unbreakable passwords, alphanumeric PINs, and memorable EFF multi-word passphrases with custom rules, character sets, and instant copy.

• CONNECTED ECOSYSTEM & SSO TREE
Smart domain recognition connects related subdomains and Single Sign-On (SSO) services (such as Google, Apple, Microsoft, and Roblox ecosystems) so you always have the right login ready without duplicate entries.

• NATIVE MAC DESKTOP & TOUCH ID INTEGRATION
Seamlessly bridges with the Kloak macOS desktop application. Unlock with Touch ID or Apple Watch on compatible Macs and enjoy synchronized credential updates in real-time.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO USE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Install the Kloak Chrome Extension.
2. Open the Kloak macOS desktop application and unlock your vault.
3. Browse to any website—Kloak will display matching credentials for that domain.
4. Click the Kloak badge in any login field or press the extension icon in the toolbar to autofill your username and password.
5. When a website asks for two-factor verification, Kloak automatically copies or fills your 6-digit TOTP code.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRIVACY & DATA SAFETY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• Zero Remote Tracking: Kloak does not collect, transmit, store, or sell any personal data, usage analytics, or browsing history.
• No Third-Party Cloud Servers: Your credentials remain encrypted exclusively on your local computer.
• Offline Capability: All encryption, credential lookups, and TOTP generation happen entirely offline on your device.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PERMISSIONS TRANSPARENCY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

We believe in complete transparency. Here is why Kloak requests each browser permission:

• "Read and change data on all websites" (<all_urls>): Allows the autofill engine to detect input fields and securely insert your saved credentials and 2FA codes on the websites you visit.
• "Read browsing history" (tabs): Used solely to identify the current tab's active domain to find matching logins and protect against phishing attempts. Your browsing history is never logged or stored.
• "Access current tab" (activeTab): Used to interact with login fields when you explicitly click the extension action.
• "Manage side panel" (sidePanel): Allows you to view and manage your credential vault side-by-side with web pages.
• "Communicate with cooperating native applications" (nativeMessaging): Connects the browser extension to your local Kloak desktop app over local inter-process communication.
• "Modify clipboard" (clipboardWrite): Allows you to copy generated passwords and TOTP codes with a single click.
• "Storage" (storage): Stores extension preferences (such as auto-lock timer and visual theme) locally in your browser.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORT & COMMUNITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• Live Privacy Policy (Web Store Submission URL): https://naetikarvind.github.io/kloak/privacy.html
• Open Source Repository: https://github.com/naetikarvind/kloak
• Issues & Feedback: https://github.com/naetikarvind/kloak/issues
• Requires: Google Chrome 116+ and the Kloak macOS App (or companion native host).

---

## Permissions Justification (For Google Review Team)

| Permission | Review Justification |
|---|---|
| `<all_urls>` | Required so the autofill content script can detect username, password, and 2FA input elements on login pages across arbitrary websites visited by the user and fill credentials upon user request. |
| `tabs` | Required to retrieve the URL/hostname of the active tab to query the local vault for matching credentials and prevent credential submission to phishing/lookalike domains. |
| `activeTab` | Grants temporary execution permission to autofill login forms when the user triggers autofill via the extension popup or context menu. |
| `nativeMessaging` | Required to exchange encrypted messages with the local Kloak desktop daemon (`app.kloak.native`) running on macOS, ensuring all passwords stay stored on-device. |
| `sidePanel` | Enables the side panel UI so users can search, view, and manage vault credentials in a persistent side view alongside their active webpage. |
| `clipboardWrite` | Enables users to copy generated passwords, usernames, and 2FA TOTP codes to the system clipboard with a single click. |
| `storage` | Required to store user UI preferences (theme, default view, auto-lock timeouts) locally within the browser. |

---

## User Data Privacy Compliance (Purple Nickel Resolution)

### Required Sections Checklist
Google Chrome Web Store User Data Policy mandates that the privacy policy explicitly detail all four stages of user data treatment without omission:
1. **User Data Collection**: Explicitly covers Authentication Information, Website Content & Input Fields, Active Tab Domain (URLs), Financial Info, and lists non-collected categories (no analytics, no communications, no location, no device IDs).
2. **User Data Handling & Purpose**: Confines all data processing strictly to the single purpose (credential autofill and password security). Contains required negative declarations: no unrelated usage, no advertising, no creditworthiness/lending, no profiling.
3. **User Data Storage, Retention & Security**: Discloses local-only storage (`~/.kloak/vault.kloak` and `chrome.storage.local`), AES-256-GCM encryption, Argon2id key derivation, ephemeral memory handling for URLs, and complete local deletion/wipe mechanisms. **Section 4.4 explicitly guarantees that neither the app nor the extension ever shares any data back, keeping all found data 100% natively on the local operating system.**
4. **User Data Sharing & Disclosure**: Explicitly declares zero third-party sharing, zero data monetization/sales, and transparently details the read-only public DNS/RDAP queries used for anti-phishing domain checks. **Section 5 strictly guarantees that neither the app nor the extension shares any data back to developers or servers, with all found data confined to the local OS.**

- **Live Privacy Policy URL**: `https://naetikarvind.github.io/kloak/privacy.html`
- **Fallback URL**: `https://naetikarvind.github.io/kloak/privacy`

---

## Chrome Web Store Appeal / Re-Submission Response

When submitting an Appeal or new revision in the **Chrome Web Store Developer Dashboard**:

### Action in Dashboard:
1. Navigate to your item: **Kloak Password Manager** (`hajgkgmajepndkhjhcgjenjnfojlphod`).
2. Go to **Privacy practices** tab:
   - Verify the Privacy Policy URL is set to: `https://naetikarvind.github.io/kloak/privacy.html`
   - In **Data usage**, verify that the declared data categories match (Authentication info, Website content).
   - In **Certification**, ensure all required compliance checkboxes are checked:
     - [x] "I do not sell user data to third parties"
     - [x] "I do not use or transfer user data for purposes unrelated to my item's core functionality"
     - [x] "I do not use or transfer user data to determine creditworthiness or for lending purposes"
3. Go to **Build > Status** and click **Appeal** (or submit a new review):
   - Paste the following response text:

### Appeal / Reviewer Notes Template:
```text
Dear Chrome Web Store Review Team,

Thank you for your review and feedback regarding our item "Kloak Password Manager" (ID: hajgkgmajepndkhjhcgjenjnfojlphod).

We have thoroughly updated our publicly accessible Privacy Policy (available at https://naetikarvind.github.io/kloak/privacy.html) to strictly rectify the User Data Privacy "Purple Nickel" notice and address all four required sections without omission:

1. User Data Collection (Section 2): Explicitly details every data category accessed (Authentication Information, Website Form Elements, Active Tab Domain URLs, and UI Preferences), source of collection, and explicitly enumerates all data categories that are NEVER collected (no personal communications, no location data, no browsing history logs, no telemetry/analytics). Section 2.2 clarifies that detected form elements are processed 100% natively in local volatile memory and never transmitted or phoned home.

2. User Data Handling and Purpose (Section 3): Confines all data handling strictly to the item's single purpose (credential autofill and 2FA assistance) and explicitly affirms all mandatory policy statements: no unrelated usage, no personalized advertising, no creditworthiness/lending use, and no surveillance/profiling.

3. User Data Storage, Retention, and Security (Section 4): Discloses that 100% of user vault data is stored on-device (~/.kloak/vault.kloak) and browser settings in chrome.storage.local with zero cloud databases, protected by authenticated AES-256-GCM encryption and Argon2id. Section 4.4 explicitly states that neither the app nor the extension ever shares any data back to our developers or servers, and keeps all found, inspected, or managed data strictly and natively within the user's local operating system. Retention schedules and one-click user deletion/wipe procedures are detailed.

4. User Data Sharing, Transfer, and Disclosure (Section 5): Explicitly declares an absolute ban on selling, leasing, or sharing user data with third parties, data brokers, or advertising networks. It explicitly affirms that neither the desktop app nor the browser extension shares any data back to developers or remote servers. Read-only domain reputation queries (Cloudflare DoH / RDAP) for anti-phishing protection are transparently documented with strict safeguards ensuring no personal data is transmitted.

Furthermore, our Chrome Web Store Developer Console "Privacy practices" declarations and certification checkboxes have been verified to match our published Privacy Policy.

We kindly request a re-review of our extension. Please let us know if any further information is needed.

Sincerely,
Kloak Development Team
privacy@kloak.app
```



