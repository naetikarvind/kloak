/**
 * Kloak Daemon — WebExtensions Native Messaging Host
 * Implements standard 32-bit length-prefixed stdin/stdout messaging for Chrome, Brave, Edge, Firefox.
 */
export declare const NATIVE_HOST_NAME = "app.kloak.native";
export declare class NativeMessagingHost {
    private fallbackVault;
    private fallbackServer;
    private getFallbackServer;
    run(): void;
    private handleMessage;
    private tryForwardToDaemon;
    private spawnBackgroundDaemon;
    private sendMessage;
    static installManifests(extensionIds?: string[]): string[];
}
//# sourceMappingURL=host.d.ts.map