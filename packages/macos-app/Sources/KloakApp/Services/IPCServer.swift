import Foundation
import Network
import Combine

// MARK: - Notification Names
extension Notification.Name {
    static let kloakBrowserUrlChanged = Notification.Name("app.kloak.browserUrlChanged")
}

// MARK: - eTLD+1 Helper
/// Returns the registrable domain (eTLD+1) for a given URL string.
/// e.g. "https://login.github.com" → "github.com", "https://bbc.co.uk" → "bbc.co.uk"
func registrableDomain(from urlString: String) -> String? {
    guard let url = URL(string: urlString), let host = url.host?.lowercased() else { return nil }
    let labels = host.components(separatedBy: ".")
    guard labels.count >= 2 else { return nil }
    // Known two-part eTLD qualifiers (second level is non-descriptive)
    let twoPartQualifiers: Set<String> = ["co", "com", "net", "org", "edu", "gov", "ac", "ne", "or", "mil", "int"]
    if labels.count >= 3 && twoPartQualifiers.contains(labels[labels.count - 2]) {
        return labels.suffix(3).joined(separator: ".")
    }
    return labels.suffix(2).joined(separator: ".")
}

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

                // Check for HTTP requests (OPTIONS / POST / GET)
                if let str = String(data: currentBuffer, encoding: .utf8), (str.hasPrefix("OPTIONS ") || str.hasPrefix("POST ") || str.hasPrefix("GET ")) {
                    if str.hasPrefix("OPTIONS ") {
                        let httpResp = "HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: POST, GET, OPTIONS\r\nAccess-Control-Allow-Headers: *\r\nContent-Length: 0\r\n\r\n"
                        if let respData = httpResp.data(using: .utf8) {
                            connection.send(content: respData, completion: .contentProcessed({ _ in }))
                        }
                        currentBuffer = Data()
                    } else if currentBuffer.range(of: "\r\n\r\n".data(using: .utf8)!) != nil {
                        self.processRequest(currentBuffer, on: connection, isHttp: true)
                        currentBuffer = Data()
                    }
                } else {
                    // Process newline-delimited messages
                    while let newlineIndex = currentBuffer.firstIndex(of: UInt8(ascii: "\n")) {
                        let messageData = currentBuffer.subdata(in: 0..<newlineIndex)
                        currentBuffer.removeSubrange(0...newlineIndex)

                        if !messageData.isEmpty {
                            self.processRequest(messageData, on: connection, isHttp: false)
                        }
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

    private func processRequest(_ data: Data, on connection: NWConnection, isHttp: Bool = false) {
        guard !data.isEmpty else { return }

        var payloadData = data
        if isHttp {
            if let separatorRange = data.range(of: "\r\n\r\n".data(using: .utf8)!) {
                payloadData = data.subdata(in: separatorRange.upperBound..<data.count)
            }
        }

        let reqId: AnyCodableValue?
        let method: String
        let params: [String: AnyCodableValue]?

        if let req = try? JSONDecoder().decode(JsonRpcRequest.self, from: payloadData) {
            reqId = req.id
            method = req.method
            params = req.params
        } else if let rawObj = try? JSONSerialization.jsonObject(with: payloadData) as? [String: Any] {
            method = rawObj["method"] as? String ?? ""
            params = nil
            reqId = nil
        } else {
            sendError(on: connection, id: nil, code: -32700, message: "Invalid JSON-RPC request", isHttp: isHttp)
            return
        }

        Task { @MainActor in
            self.handleMainActorRequest(method: method, reqId: reqId, params: params, on: connection, isHttp: isHttp)
        }
    }

    @MainActor
    private func handleMainActorRequest(method: String, reqId: AnyCodableValue?, params: [String: AnyCodableValue]?, on connection: NWConnection, isHttp: Bool = false) {
        let store = VaultStore.shared

        func reply(_ result: AnyCodableValue) {
            self.sendResult(on: connection, id: reqId, result: result, isHttp: isHttp)
        }

        func replyError(_ code: Int, _ message: String) {
            self.sendError(on: connection, id: reqId, code: code, message: message, isHttp: isHttp)
        }

        switch method {
        case "daemon.ping":
            reply(.dictionary([
                "pong": .bool(true),
                "version": .string("1.0.0"),
                "app": .string("Kloak macOS App"),
                "isUnlocked": .bool(store.isUnlocked)
            ]))

        case "vault.status":
            reply(.dictionary([
                "isInitialized": .bool(store.hasVault),
                "isUnlocked": .bool(store.isUnlocked),
                "itemCount": .int(store.items.filter { !$0.trashed }.count),
                "autoLockMinutes": .int(store.settings.autoLockMinutes)
            ]))

        case "vault.getItems":
            guard store.isUnlocked else {
                replyError(-32001, "Vault is locked")
                return
            }
            store.recordUserActivity()
            let exportable = store.items.filter { !$0.trashed }
            if let encodedData = try? JSONEncoder().encode(exportable),
               let codableVal = try? JSONDecoder().decode(AnyCodableValue.self, from: encodedData) {
                reply(codableVal)
            } else {
                reply(.array([]))
            }

        case "vault.matchByUrl":
            guard store.isUnlocked else {
                replyError(-32001, "Vault is locked")
                return
            }
            store.recordUserActivity()
            let urlParam = params?["url"]?.stringValue ?? ""
            let pageRD = registrableDomain(from: urlParam)
            let pageHost = URL(string: urlParam)?.host?.lowercased()

            let scoredMatches: [(item: VaultItem, score: Int)] = store.items.compactMap { item in
                guard !item.trashed else { return nil }
                var bestScore = 0
                for u in item.urls {
                    let itemHost = URL(string: u)?.host?.lowercased() ?? ""
                    let itemRD = registrableDomain(from: u)
                    // Exact host match
                    if let ph = pageHost, ph == itemHost { bestScore = max(bestScore, 100); continue }
                    // eTLD+1 match
                    if let prd = pageRD, let ird = itemRD, prd == ird { bestScore = max(bestScore, 80); continue }
                }
                guard bestScore > 0 else { return nil }
                var score = bestScore
                if item.favorite { score += 20 }
                return (item, score)
            }

            let matches = scoredMatches.sorted { $0.score > $1.score }.map { $0.item }

            if let encodedData = try? JSONEncoder().encode(matches),
               let codableVal = try? JSONDecoder().decode(AnyCodableValue.self, from: encodedData) {
                reply(codableVal)
            } else {
                reply(.array([]))
            }

        case "extension.activeUrlChanged":
            // Browser extension pushes current page URL so the menubar can show live suggestions
            let urlParam = params?["url"]?.stringValue ?? ""
            let tabIdParam = params?["tabId"]?.intValue ?? -1
            if !urlParam.isEmpty {
                DispatchQueue.main.async {
                    NotificationCenter.default.post(
                        name: .kloakBrowserUrlChanged,
                        object: nil,
                        userInfo: ["url": urlParam, "tabId": tabIdParam]
                    )
                }
            }
            reply(.dictionary(["success": .bool(true)]))

        case "vault.search":
            guard store.isUnlocked else {
                replyError(-32001, "Vault is locked")
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
                reply(codableVal)
            } else {
                reply(.array([]))
            }

        case "vault.getItem":
            guard store.isUnlocked else {
                replyError(-32001, "Vault is locked")
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
                reply(.dictionary(resDict))
            } else {
                replyError(-32004, "Item not found")
            }

        case "vault.generateTotp":
            let secret = params?["secret"]?.stringValue ?? ""
            if let totp = TOTPEngine.shared.generate(secretBase32: secret) {
                reply(.dictionary([
                    "token": .string(totp.token),
                    "secondsRemaining": .int(totp.secondsRemaining),
                    "period": .int(totp.period)
                ]))
            } else {
                replyError(-32000, "Invalid Base32 TOTP secret")
            }

        case "shield.inspectUrl":
            let url = params?["url"]?.stringValue ?? ""
            let analysis = ThreatDetectorService.shared.analyzeUrl(url)
            var reasonsCodable: [AnyCodableValue] = []
            for r in analysis.reasons {
                reasonsCodable.append(.string(r))
            }
            reply(.dictionary([
                "isSuspicious": .bool(analysis.isSuspicious),
                "riskScore": .int(analysis.riskScore),
                "targetDomain": .string(analysis.targetDomain ?? ""),
                "reasons": .array(reasonsCodable),
                "suggestedAction": .string(analysis.suggestedAction),
                "suggestedAliasEmail": .string(analysis.suggestedAliasEmail ?? "")
            ]))

        case "shield.generateProtectedAlias":
            let url = params?["url"]?.stringValue ?? ""
            let targetDomain = params?["domain"]?.stringValue ?? (URL(string: url)?.host ?? "untrusted-site")
            let generatedEmail = ThreatDetectorService.shared.generateMaskedAlias(for: targetDomain)
            let forwardDestination = store.settings.customForwardingEmail ?? store.settings.connectedAccountEmail ?? "naetik.arvind@gmail.com"
            let providerName = (store.settings.connectedAccountProvider ?? "google").capitalized

            let newAliasItem = VaultItem(
                type: .emailAlias,
                title: "Shield Alias (\(targetDomain))",
                username: generatedEmail,
                urls: url.isEmpty ? [] : [url],
                notes: "Kloak Threat Shield: Auto-generated disposable alias for \(targetDomain). Emails forward to \(forwardDestination).",
                alias: AliasDetails(
                    aliasEmail: generatedEmail,
                    forwardTo: forwardDestination,
                    provider: "Kloak Shield (\(providerName))"
                ),
                tags: ["Shield", "Protected Alias"]
            )

            store.saveItem(newAliasItem)

            reply(.dictionary([
                "aliasEmail": .string(generatedEmail),
                "forwardTo": .string(forwardDestination),
                "provider": .string("Kloak Shield"),
                "itemId": .string(newAliasItem.id),
                "success": .bool(true)
            ]))

        case "shield.getConnectedAccount":
            reply(.dictionary([
                "provider": .string(store.settings.connectedAccountProvider ?? "google"),
                "email": .string(store.settings.connectedAccountEmail ?? "naetik.arvind@gmail.com"),
                "customForwardingEmail": .string(store.settings.customForwardingEmail ?? ""),
                "shieldEnabled": .bool(store.settings.maliciousSiteShieldEnabled),
                "autoMaskUntrusted": .bool(store.settings.autoMaskUntrustedSites)
            ]))

        case "vault.lock":
            store.lock()
            reply(.dictionary(["success": .bool(true)]))

        default:
            sendError(on: connection, id: reqId, code: -32601, message: "Method not found: \(method)", isHttp: isHttp)
        }
    }

    private func sendResult(on connection: NWConnection, id: AnyCodableValue?, result: AnyCodableValue, isHttp: Bool = false) {
        let resp = JsonRpcResponse(jsonrpc: "2.0", id: id, result: result, error: nil)
        if let data = try? JSONEncoder().encode(resp) {
            if isHttp {
                let header = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: POST, GET, OPTIONS\r\nAccess-Control-Allow-Headers: *\r\nContent-Length: \(data.count)\r\nConnection: close\r\n\r\n"
                var fullData = header.data(using: .utf8) ?? Data()
                fullData.append(data)
                connection.send(content: fullData, completion: .contentProcessed({ _ in
                    connection.cancel()
                }))
            } else {
                var fullData = data
                fullData.append(UInt8(ascii: "\n"))
                connection.send(content: fullData, completion: .contentProcessed({ _ in }))
            }
        }
    }

    private func sendError(on connection: NWConnection, id: AnyCodableValue?, code: Int, message: String, isHttp: Bool = false) {
        let resp = JsonRpcResponse(
            jsonrpc: "2.0",
            id: id,
            result: nil,
            error: JsonRpcError(code: code, message: message)
        )
        if let data = try? JSONEncoder().encode(resp) {
            if isHttp {
                let header = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: POST, GET, OPTIONS\r\nAccess-Control-Allow-Headers: *\r\nContent-Length: \(data.count)\r\nConnection: close\r\n\r\n"
                var fullData = header.data(using: .utf8) ?? Data()
                fullData.append(data)
                connection.send(content: fullData, completion: .contentProcessed({ _ in
                    connection.cancel()
                }))
            } else {
                var fullData = data
                fullData.append(UInt8(ascii: "\n"))
                connection.send(content: fullData, completion: .contentProcessed({ _ in }))
            }
        }
    }
}
