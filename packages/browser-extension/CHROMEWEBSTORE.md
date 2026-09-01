# Chrome Web Store Listing — Kloak Password Manager

## Extension Details
- **Name**: Kloak Password Manager
- **Version**: 1.0.0
- **Short Description**: Zero-knowledge, local-first password manager with instant autofill, TOTP authenticator, and phishing defense.
- **Category**: Productivity / Security

## Detailed Description
Kloak is a modern, zero-knowledge, local-first password manager designed with unmatched security and native speed.

### Key Features:
- **Zero-Knowledge Security**: Your master password and derived keys never leave your machine.
- **Intelligent Autofill**: Auto-detects login forms, injects credentials safely, and defends against lookalike/phishing domains.
- **Built-in TOTP Authenticator**: Generates RFC 6238 two-factor authentication codes directly in your browser with real-time countdowns.
- **High-Entropy Password Generator**: Create ultra-strong random passwords and EFF passphrases with instant clipboard copy.
- **Native Host Bridge**: Integrates with the native Kloak macOS helper and desktop app via length-prefixed Native Messaging.

## Permissions Justification
- `storage`: Required to cache domain-matching states locally and persist user UI preferences across sessions.
- `tabs`: Required to inspect the current tab URL to match credentials against the domain and protect against phishing attempts.
- `activeTab`: Grants temporary script execution permissions to autofill credentials directly when the user clicks the autofill button.
- `nativeMessaging`: Required to communicate with the local Kloak desktop daemon (`app.kloak.native`) over local IPC.
- `sidePanel`: Required to allow users to view their entire vault alongside web pages in the Chrome side panel.
- `<all_urls>` (host_permissions): Required so the autofill content script can detect login inputs and inject saved passwords on any web domain the user visits.

## Privacy & Data Disclosure
- **Zero Remote Data Collection**: Kloak does NOT collect, track, send, or sell any personal data, analytics, or telemetry.
- **Local Storage Only**: All credentials reside on your device inside an AES-256-GCM encrypted envelope.
