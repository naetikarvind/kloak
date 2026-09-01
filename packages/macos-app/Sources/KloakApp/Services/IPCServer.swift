import Foundation
import Network
import Combine

public struct JsonRpcRequest: Codable {
    public var jsonrpc: String?
    public var id: AnyCodableValue?
    public var method: String
    public var params: [String: AnyCodableValue]?
}

public struct JsonRpcResponse: Codable {
    public var jsonrpc: String = "2.0"
    public var id: AnyCodableValue?
    public var result: AnyCodableValue?
    public var error: JsonRpcError?
}

public struct JsonRpcError: Codable {
    public var code: Int
    public var message: String
}

public enum AnyCodableValue: Codable, Sendable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)
    case array([AnyCodableValue])
    case dictionary([String: AnyCodableValue])
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let b = try? container.decode(Bool.self) {
            self = .bool(b)
        } else if let i = try? container.decode(Int.self) {
            self = .int(i)
        } else if let d = try? container.decode(Double.self) {
            self = .double(d)
        } else if let s = try? container.decode(String.self) {
            self = .string(s)
        } else if let arr = try? container.decode([AnyCodableValue].self) {
            self = .array(arr)
        } else if let dict = try? container.decode([String: AnyCodableValue].self) {
            self = .dictionary(dict)
        } else {
            self = .null
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let s): try container.encode(s)
        case .int(let i): try container.encode(i)
        case .double(let d): try container.encode(d)
        case .bool(let b): try container.encode(b)
        case .array(let arr): try container.encode(arr)
        case .dictionary(let dict): try container.encode(dict)
        case .null: try container.encodeNil()
        }
    }

    public var stringValue: String? {
        if case .string(let s) = self { return s }
        return nil
    }

    public var boolValue: Bool? {
        if case .bool(let b) = self { return b }
        return nil
    }

    public var intValue: Int? {
        if case .int(let i) = self { return i }
        return nil
    }
}

@MainActor
public final class IPCServer: ObservableObject {
    public static let shared = IPCServer()

    public static let defaultPort: UInt16 = 53152
    private var tcpListener: NWListener?
    @Published public var isRunning: Bool = false
    @Published public var connectedClientsCount: Int = 0

    public init() {}

    public func start(port: UInt16 = IPCServer.defaultPort) {
        guard tcpListener == nil else { return }

        do {
            let nwPort = NWEndpoint.Port(rawValue: port) ?? NWEndpoint.Port(integerLiteral: IPCServer.defaultPort)
            let params = NWParameters.tcp
            params.allowLocalEndpointReuse = true

            let listener = try NWListener(using: params, on: nwPort)
            self.tcpListener = listener

            listener.stateUpdateHandler = { [weak self] (state: NWListener.State) in
                Task { @MainActor [weak self] in
                    guard let self = self else { return }
                    switch state {
                    case .ready:
                        self.isRunning = true
                        print("[Kloak IPC] TCP Server listening on 127.0.0.1:\(port)")
                    case .failed(let err):
                        self.isRunning = false
                        print("[Kloak IPC] TCP Server failed: \(err)")
                    case .cancelled:
                        self.isRunning = false
                    default:
                        break
                    }
                }
            }

            listener.newConnectionHandler = { [weak self] connection in
                Task { @MainActor [weak self] in
                    self?.handleConnection(connection)
                }
            }

            listener.start(queue: DispatchQueue.main)
        } catch {
            print("[Kloak IPC] Failed to start IPC TCP server: \(error)")
        }
    }

    public func stop() {
        tcpListener?.cancel()
        tcpListener = nil
        isRunning = false
    }

    private func handleConnection(_ connection: NWConnection) {
        connection.start(queue: .main)
        self.connectedClientsCount += 1

        receiveNextMessage(on: connection, buffer: Data())
    }

    private func receiveNextMessage(on connection: NWConnection, buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, context, isComplete, error in
            Task { @MainActor [weak self] in
                guard let self = self else { return }

                if let error = error {
                    print("[Kloak IPC] Connection error: \(error)")
                    connection.cancel()
                    self.connectedClientsCount = max(0, self.connectedClientsCount - 1)
                    return
                }

                var currentBuffer = buffer
                if let newData = data {
                    currentBuffer.append(newData)
                }

                // Process newline-delimited messages
                while let newlineIndex = currentBuffer.firstIndex(of: UInt8(ascii: "\n")) {
                    let messageData = currentBuffer.subdata(in: 0..<newlineIndex)
                    currentBuffer.removeSubrange(0...newlineIndex)

                    if !messageData.isEmpty {
                        self.processRequest(messageData, on: connection)
                    }
                }

                if isComplete {
                    connection.cancel()
                    self.connectedClientsCount = max(0, self.connectedClientsCount - 1)
                } else {
                    self.receiveNextMessage(on: connection, buffer: currentBuffer)
                }
            }
        }
    }

    private func processRequest(_ data: Data, on connection: NWConnection) {
        guard !data.isEmpty else { return }

        let reqId: AnyCodableValue?
        let method: String
        let params: [String: AnyCodableValue]?

        if let req = try? JSONDecoder().decode(JsonRpcRequest.self, from: data) {
            reqId = req.id
            method = req.method
            params = req.params
        } else if let rawObj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            method = rawObj["method"] as? String ?? ""
            params = nil
            reqId = nil
        } else {
            sendError(on: connection, id: nil, code: -32700, message: "Invalid JSON-RPC request")
            return
        }

        let store = VaultStore.shared

        switch method {
        case "daemon.ping":
            sendResult(on: connection, id: reqId, result: .dictionary([
                "pong": .bool(true),
                "version": .string("1.0.0"),
                "app": .string("Kloak macOS App"),
                "isUnlocked": .bool(store.isUnlocked)
            ]))

        case "vault.status":
            sendResult(on: connection, id: reqId, result: .dictionary([
                "isInitialized": .bool(store.hasVault),
                "isUnlocked": .bool(store.isUnlocked),
                "itemCount": .int(store.items.filter { !$0.trashed }.count),
                "autoLockMinutes": .int(store.settings.autoLockMinutes)
            ]))

        case "vault.getItems":
            guard store.isUnlocked else {
                sendError(on: connection, id: reqId, code: -32001, message: "Vault is locked")
                return
            }
            store.recordUserActivity()
            let exportable = store.items.filter { !$0.trashed }
            if let encodedData = try? JSONEncoder().encode(exportable),
               let codableVal = try? JSONDecoder().decode(AnyCodableValue.self, from: encodedData) {
                sendResult(on: connection, id: reqId, result: codableVal)
            } else {
                sendResult(on: connection, id: reqId, result: .array([]))
            }

        case "vault.matchByUrl":
            guard store.isUnlocked else {
                sendError(on: connection, id: reqId, code: -32001, message: "Vault is locked")
                return
            }
            store.recordUserActivity()
            let urlParam = params?["url"]?.stringValue ?? ""
            let host: String
            if let parsed = URL(string: urlParam)?.host {
                host = parsed.lowercased()
            } else {
                host = urlParam.lowercased()
            }

            let matches = store.items.filter { item in
                guard !item.trashed else { return false }
                for u in item.urls {
                    if let uHost = URL(string: u)?.host?.lowercased() {
                        if uHost == host || host.hasSuffix("." + uHost) || uHost.hasSuffix("." + host) {
                            return true
                        }
                    } else if u.lowercased().contains(host) {
                        return true
                    }
                }
                return false
            }

            if let encodedData = try? JSONEncoder().encode(matches),
               let codableVal = try? JSONDecoder().decode(AnyCodableValue.self, from: encodedData) {
                sendResult(on: connection, id: reqId, result: codableVal)
            } else {
                sendResult(on: connection, id: reqId, result: .array([]))
            }

        case "vault.search":
            guard store.isUnlocked else {
                sendError(on: connection, id: reqId, code: -32001, message: "Vault is locked")
                return
            }
            store.recordUserActivity()
            let q = (params?["query"]?.stringValue ?? "").lowercased()
            let filtered = store.items.filter { item in
                guard !item.trashed else { return false }
                if q.isEmpty { return true }
                if item.title.lowercased().contains(q) { return true }
                if let u = item.username, u.lowercased().contains(q) { return true }
                if item.urls.contains(where: { $0.lowercased().contains(q) }) { return true }
                if item.tags.contains(where: { $0.lowercased().contains(q) }) { return true }
                return false
            }

            if let encodedData = try? JSONEncoder().encode(filtered),
               let codableVal = try? JSONDecoder().decode(AnyCodableValue.self, from: encodedData) {
                sendResult(on: connection, id: reqId, result: codableVal)
            } else {
                sendResult(on: connection, id: reqId, result: .array([]))
            }

        case "vault.getItem":
            guard store.isUnlocked else {
                sendError(on: connection, id: reqId, code: -32001, message: "Vault is locked")
                return
            }
            store.recordUserActivity()
            let id = params?["id"]?.stringValue ?? ""
            if let item = store.items.first(where: { $0.id == id }) {
                var resDict: [String: AnyCodableValue] = [:]
                if let encodedData = try? JSONEncoder().encode(item),
                   let codableItem = try? JSONDecoder().decode(AnyCodableValue.self, from: encodedData) {
                    resDict["item"] = codableItem
                }
                if let secret = item.totpSecret, let totp = TOTPEngine.shared.generate(secretBase32: secret) {
                    resDict["liveTotp"] = .dictionary([
                        "token": .string(totp.token),
                        "secondsRemaining": .int(totp.secondsRemaining),
                        "period": .int(totp.period)
                    ])
                }
                sendResult(on: connection, id: reqId, result: .dictionary(resDict))
            } else {
                sendError(on: connection, id: reqId, code: -32004, message: "Item not found")
            }

        case "vault.generateTotp":
            let secret = params?["secret"]?.stringValue ?? ""
            if let totp = TOTPEngine.shared.generate(secretBase32: secret) {
                sendResult(on: connection, id: reqId, result: .dictionary([
                    "token": .string(totp.token),
                    "secondsRemaining": .int(totp.secondsRemaining),
                    "period": .int(totp.period)
                ]))
            } else {
                sendError(on: connection, id: reqId, code: -32000, message: "Invalid Base32 TOTP secret")
            }

        case "vault.lock":
            store.lock()
            sendResult(on: connection, id: reqId, result: .dictionary(["success": .bool(true)]))

        default:
            sendError(on: connection, id: reqId, code: -32601, message: "Method not found: \(method)")
        }
    }

    private func sendResult(on connection: NWConnection, id: AnyCodableValue?, result: AnyCodableValue) {
        let resp = JsonRpcResponse(jsonrpc: "2.0", id: id, result: result, error: nil)
        if let data = try? JSONEncoder().encode(resp) {
            var fullData = data
            fullData.append(UInt8(ascii: "\n"))
            connection.send(content: fullData, completion: .contentProcessed({ _ in }))
        }
    }

    private func sendError(on connection: NWConnection, id: AnyCodableValue?, code: Int, message: String) {
        let resp = JsonRpcResponse(
            jsonrpc: "2.0",
            id: id,
            result: nil,
            error: JsonRpcError(code: code, message: message)
        )
        if let data = try? JSONEncoder().encode(resp) {
            var fullData = data
            fullData.append(UInt8(ascii: "\n"))
            connection.send(content: fullData, completion: .contentProcessed({ _ in }))
        }
    }
}
