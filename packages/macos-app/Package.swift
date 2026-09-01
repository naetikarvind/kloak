// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "Kloak",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "KloakApp", targets: ["KloakApp"])
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
