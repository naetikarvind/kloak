/**
 * Kloak Daemon — Platform Utilities
 * Cross-platform abstractions for OS-specific operations.
 */

export const IS_WINDOWS = process.platform === 'win32';
export const IS_MACOS = process.platform === 'darwin';
export const IS_LINUX = process.platform === 'linux';

/**
 * Returns the platform-appropriate IPC path.
 * - Windows: Named Pipe path
 * - macOS/Linux: Unix Domain Socket path
 */
export function getIpcPath(vaultDir: string): string {
  if (IS_WINDOWS) return '\\\\.\\pipe\\kloak';
  const path = require('node:path');
  return path.join(vaultDir, 'kloak.sock');
}

/**
 * Stub for Windows Hello / biometric unlock.
 * On Windows, this would call Windows.Security.Credentials.UI.UserConsentVerifier.
 * Returns false on non-Windows platforms (biometrics handled by macOS app).
 */
export async function requestWindowsHelloVerification(): Promise<boolean> {
  if (!IS_WINDOWS) return false;
  // TODO: Integrate with Windows Hello via node-windows-hello or WinRT bindings
  // For now, return false to fall back to password authentication
  console.warn('[Platform] Windows Hello not yet implemented — falling back to password auth');
  return false;
}

/**
 * Sets the application to run at Windows startup via registry.
 */
export function setWindowsAutoStart(appPath: string, enabled: boolean): void {
  if (!IS_WINDOWS) return;
  const { execSync } = require('node:child_process');
  const key = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
  try {
    if (enabled) {
      execSync(`reg add "${key}" /v Kloak /t REG_SZ /d "${appPath}" /f`, { stdio: 'ignore' });
    } else {
      execSync(`reg delete "${key}" /v Kloak /f`, { stdio: 'ignore' });
    }
  } catch {
    // Ignore registry errors
  }
}
