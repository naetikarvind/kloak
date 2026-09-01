/**
 * Kloak Daemon — IPC Socket Server
 * Provides Unix Domain Socket & TCP fallback server for Raycast, CLI, and apps.
 */
import { VaultManager } from '@kloak/core';
export declare const SOCKET_PATH: string;
export declare const TCP_PORT = 53152;
export declare const TCP_HOST = "127.0.0.1";
export interface JsonRpcRequest {
    jsonrpc?: '2.0';
    id?: string | number;
    method: string;
    params?: any;
}
export interface JsonRpcResponse {
    jsonrpc: '2.0';
    id?: string | number | null;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}
export declare class IpcSocketServer {
    private vaultManager;
    private unixServer;
    private tcpServer;
    constructor(vaultManager: VaultManager);
    start(): Promise<void>;
    stop(): Promise<void>;
    private handleClient;
    dispatch(req: JsonRpcRequest): Promise<JsonRpcResponse>;
    private handleMethod;
}
//# sourceMappingURL=socket-server.d.ts.map