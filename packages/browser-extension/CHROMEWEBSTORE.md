# Chrome Web Store Listing — Kloak Password Manager

## Store Metadata

- **Name**: Kloak Password Manager
- **Version**: 1.0.0
- **Category**: Productivity / Privacy & Security
- **Short Description** (128 / 132 chars max):
  Local-first password manager with instant autofill, built-in 2FA authenticator, phishing protection, and desktop vault sync.
- **Single Purpose Statement** (Developer Dashboard):
  Autofills saved login credentials and two-factor authentication codes from your local Kloak vault into web forms with built-in phishing defense.

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

