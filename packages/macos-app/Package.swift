// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "Kloak",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "Kloak", targets: ["KloakApp"])
    ],
    dependencies: [],
    targets: [
        .executableTarget(
            name: "KloakApp",
            dependencies: [],
            path: "Sources/KloakApp",
            resources: [
                .process("Resources")
            ]
        )
    ]
)
