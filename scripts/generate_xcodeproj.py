import os
import uuid

def gen_id():
    return uuid.uuid4().hex[:24].upper()

files = [
    ("LiquidGlassTheme.swift", "Sources/KloakApp/UI/LiquidGlassTheme.swift", "sourcecode.swift"),
    ("FaviconView.swift", "Sources/KloakApp/UI/FaviconView.swift", "sourcecode.swift"),
    ("VaultModels.swift", "Sources/KloakApp/Models/VaultModels.swift", "sourcecode.swift"),
    ("KloakApp.swift", "Sources/KloakApp/KloakApp.swift", "sourcecode.swift"),
    ("SetupView.swift", "Sources/KloakApp/Views/SetupView.swift", "sourcecode.swift"),
    ("GeneratorView.swift", "Sources/KloakApp/Views/GeneratorView.swift", "sourcecode.swift"),
    ("SettingsView.swift", "Sources/KloakApp/Views/SettingsView.swift", "sourcecode.swift"),
    ("ItemDetailView.swift", "Sources/KloakApp/Views/ItemDetailView.swift", "sourcecode.swift"),
    ("MenuBarView.swift", "Sources/KloakApp/Views/MenuBarView.swift", "sourcecode.swift"),
    ("VaultMainView.swift", "Sources/KloakApp/Views/VaultMainView.swift", "sourcecode.swift"),
    ("SidebarView.swift", "Sources/KloakApp/Views/SidebarView.swift", "sourcecode.swift"),
    ("ImportExportView.swift", "Sources/KloakApp/Views/ImportExportView.swift", "sourcecode.swift"),
    ("KloakLogoView.swift", "Sources/KloakApp/Views/KloakLogoView.swift", "sourcecode.swift"),
    ("ItemListView.swift", "Sources/KloakApp/Views/ItemListView.swift", "sourcecode.swift"),
    ("UnlockView.swift", "Sources/KloakApp/Views/UnlockView.swift", "sourcecode.swift"),
    ("TOTPRingView.swift", "Sources/KloakApp/Views/TOTPRingView.swift", "sourcecode.swift"),
    ("WindowSizeManager.swift", "Sources/KloakApp/Services/WindowSizeManager.swift", "sourcecode.swift"),
    ("CertificateInspectorService.swift", "Sources/KloakApp/Services/CertificateInspectorService.swift", "sourcecode.swift"),
    ("KeychainManager.swift", "Sources/KloakApp/Services/KeychainManager.swift", "sourcecode.swift"),
    ("BiometricAuth.swift", "Sources/KloakApp/Services/BiometricAuth.swift", "sourcecode.swift"),
    ("LogoService.swift", "Sources/KloakApp/Services/LogoService.swift", "sourcecode.swift"),
    ("IPCServer.swift", "Sources/KloakApp/Services/IPCServer.swift", "sourcecode.swift"),
    ("DomainIntelService.swift", "Sources/KloakApp/Services/DomainIntelService.swift", "sourcecode.swift"),
    ("TOTPEngine.swift", "Sources/KloakApp/Services/TOTPEngine.swift", "sourcecode.swift"),
    ("VaultStore.swift", "Sources/KloakApp/Services/VaultStore.swift", "sourcecode.swift"),
    ("ActiveContextService.swift", "Sources/KloakApp/Services/ActiveContextService.swift", "sourcecode.swift"),
    ("CryptoEngine.swift", "Sources/KloakApp/Services/CryptoEngine.swift", "sourcecode.swift"),
    ("ThreatDetectorService.swift", "Sources/KloakApp/Services/ThreatDetectorService.swift", "sourcecode.swift"),
    ("Assets.xcassets", "Assets.xcassets", "folder.assetcatalog"),
    ("AppIcon.icon", "AppIcon.icon", "folder"),
    ("Info.plist", "Info.plist", "text.plist.xml"),
    ("Kloak.entitlements", "Kloak.entitlements", "text.plist.entitlements")
]

file_refs = {}
build_files = {}

for name, path, ftype in files:
    fid = gen_id()
    bid = gen_id()
    file_refs[name] = (fid, path, ftype)
    build_files[name] = bid

proj_id = gen_id()
target_id = gen_id()
sources_build_phase = gen_id()
resources_build_phase = gen_id()
frameworks_build_phase = gen_id()
main_group_id = gen_id()
sources_group_id = gen_id()
product_ref_id = gen_id()
products_group_id = gen_id()
config_list_id = gen_id()
target_config_list_id = gen_id()
proj_debug_cfg = gen_id()
proj_release_cfg = gen_id()
target_debug_cfg = gen_id()
target_release_cfg = gen_id()

out = []
out.append("// !$*UTF8*$!")
out.append("{\n\tarchiveVersion = 1;\n\tclasses = {\n\t};\n\tobjectVersion = 56;\n\tobjects = {")

# PBXBuildFile
out.append("\n/* Begin PBXBuildFile section */")
for name, path, ftype in files:
    if ftype == "sourcecode.swift":
        out.append(f"\t\t{build_files[name]} /* {name} in Sources */ = {{isa = PBXBuildFile; fileRef = {file_refs[name][0]} /* {name} */; }};")
    elif ftype in ("folder", "folder.assetcatalog"):
        out.append(f"\t\t{build_files[name]} /* {name} in Resources */ = {{isa = PBXBuildFile; fileRef = {file_refs[name][0]} /* {name} */; }};")
out.append("/* End PBXBuildFile section */\n")

# PBXFileReference
out.append("/* Begin PBXFileReference section */")
for name, (fid, path, ftype) in file_refs.items():
    out.append(f"\t\t{fid} /* {name} */ = {{isa = PBXFileReference; lastKnownFileType = \"{ftype}\"; path = \"{path}\"; sourceTree = \"<group>\"; }};")
out.append(f"\t\t{product_ref_id} /* Kloak.app */ = {{isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = Kloak.app; sourceTree = BUILT_PRODUCTS_DIR; }};")
out.append("/* End PBXFileReference section */\n")

# PBXFrameworksBuildPhase
out.append("/* Begin PBXFrameworksBuildPhase section */")
out.append(f"\t\t{frameworks_build_phase} /* Frameworks */ = {{\n\t\t\tisa = PBXFrameworksBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t}};")
out.append("/* End PBXFrameworksBuildPhase section */\n")

# PBXGroup
out.append("/* Begin PBXGroup section */")
out.append(f"\t\t{main_group_id} = {{\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (")
for name in file_refs:
    out.append(f"\t\t\t\t{file_refs[name][0]} /* {name} */,")
out.append(f"\t\t\t\t{products_group_id} /* Products */,")
out.append("\t\t\t);\n\t\t\tsourceTree = \"<group>\";\n\t\t};")
out.append(f"\t\t{products_group_id} /* Products */ = {{\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = (\n\t\t\t\t{product_ref_id} /* Kloak.app */,\n\t\t\t);\n\t\t\tname = Products;\n\t\t\tsourceTree = \"<group>\";\n\t\t}};")
out.append("/* End PBXGroup section */\n")

# PBXNativeTarget
out.append("/* Begin PBXNativeTarget section */")
out.append(f"\t\t{target_id} /* Kloak */ = {{\n\t\t\tisa = PBXNativeTarget;\n\t\t\tbuildConfigurationList = {target_config_list_id} /* Build configuration list for PBXNativeTarget \"Kloak\" */;\n\t\t\tbuildPhases = (\n\t\t\t\t{sources_build_phase} /* Sources */,\n\t\t\t\t{frameworks_build_phase} /* Frameworks */,\n\t\t\t\t{resources_build_phase} /* Resources */,\n\t\t\t);\n\t\t\tbuildRules = (\n\t\t\t);\n\t\t\tdependencies = (\n\t\t\t);\n\t\t\tname = Kloak;\n\t\t\tproductName = Kloak;\n\t\t\tproductReference = {product_ref_id} /* Kloak.app */;\n\t\t\tproductType = \"com.apple.product-type.application\";\n\t\t}};")
out.append("/* End PBXNativeTarget section */\n")

# PBXProject
out.append("/* Begin PBXProject section */")
out.append(f"\t\t{proj_id} /* Project object */ = {{\n\t\t\tisa = PBXProject;\n\t\t\tattributes = {{\n\t\t\t\tBuildIndependentTargetsInParallel = 1;\n\t\t\t\tLastUpgradeCheck = 1600;\n\t\t\t}};\n\t\t\tbuildConfigurationList = {config_list_id} /* Build configuration list for PBXProject \"Kloak\" */;\n\t\t\tcompatibilityVersion = \"Xcode 14.0\";\n\t\t\tdevelopmentRegion = en;\n\t\t\thasScannedForEncodings = 0;\n\t\t\tknownRegions = (\n\t\t\t\ten,\n\t\t\t\tBase,\n\t\t\t);\n\t\t\tmainGroup = {main_group_id};\n\t\t\tproductRefGroup = {products_group_id} /* Products */;\n\t\t\tprojectDirPath = \"\";\n\t\t\tprojectRoot = \"\";\n\t\t\ttargets = (\n\t\t\t\t{target_id} /* Kloak */,\n\t\t\t);\n\t\t}};")
out.append("/* End PBXProject section */\n")

# PBXResourcesBuildPhase
out.append("/* Begin PBXResourcesBuildPhase section */")
out.append(f"\t\t{resources_build_phase} /* Resources */ = {{\n\t\t\tisa = PBXResourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t\t{build_files['Assets.xcassets']} /* Assets.xcassets in Resources */,\n\t\t\t\t{build_files['AppIcon.icon']} /* AppIcon.icon in Resources */,\n\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t}};")
out.append("/* End PBXResourcesBuildPhase section */\n")

# PBXSourcesBuildPhase
out.append("/* Begin PBXSourcesBuildPhase section */")
out.append(f"\t\t{sources_build_phase} /* Sources */ = {{\n\t\t\tisa = PBXSourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (")
for name, path, ftype in files:
    if ftype == "sourcecode.swift":
        out.append(f"\t\t\t\t{build_files[name]} /* {name} in Sources */,")
out.append("\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};")
out.append("/* End PBXSourcesBuildPhase section */\n")

# XCBuildConfiguration
out.append("/* Begin XCBuildConfiguration section */")
out.append(f"""\t\t{proj_debug_cfg} /* Debug */ = {{
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {{
\t\t\t\tALWAYS_SEARCH_USER_PATHS = NO;
\t\t\t\tCLANG_ANALYZER_NONNULL = YES;
\t\t\t\tMACOSX_DEPLOYMENT_TARGET = 14.0;
\t\t\t\tSDKROOT = macosx;
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t}};
\t\t\tname = Debug;
\t\t}};""")

out.append(f"""\t\t{proj_release_cfg} /* Release */ = {{
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {{
\t\t\t\tALWAYS_SEARCH_USER_PATHS = NO;
\t\t\t\tCLANG_ANALYZER_NONNULL = YES;
\t\t\t\tMACOSX_DEPLOYMENT_TARGET = 14.0;
\t\t\t\tSDKROOT = macosx;
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t}};
\t\t\tname = Release;
\t\t}};""")

out.append(f"""\t\t{target_debug_cfg} /* Debug */ = {{
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {{
\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
\t\t\t\tPRIMARY_ICON_NAME = AppIcon;
\t\t\t\tCODE_SIGN_ENTITLEMENTS = Kloak.entitlements;
\t\t\t\tCODE_SIGN_IDENTITY = "-";
\t\t\t\tCODE_SIGN_STYLE = Manual;
\t\t\t\tCOMBINE_HIDPI_IMAGES = YES;
\t\t\t\tGENERATE_INFOPLIST_FILE = NO;
\t\t\t\tINFOPLIST_FILE = Info.plist;
\t\t\t\tINFOPLIST_KEY_CFBundleIconName = AppIcon;
\t\t\t\tINFOPLIST_KEY_CFBundleIconFile = AppIcon;
\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (
\t\t\t\t\t"$(inherited)",
\t\t\t\t\t"@executable_path/../Frameworks",
\t\t\t\t);
\t\t\t\tMACOSX_DEPLOYMENT_TARGET = 14.0;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.kloak.app;
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t}};
\t\t\tname = Debug;
\t\t}};""")

out.append(f"""\t\t{target_release_cfg} /* Release */ = {{
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {{
\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
\t\t\t\tPRIMARY_ICON_NAME = AppIcon;
\t\t\t\tCODE_SIGN_ENTITLEMENTS = Kloak.entitlements;
\t\t\t\tCODE_SIGN_IDENTITY = "-";
\t\t\t\tCODE_SIGN_STYLE = Manual;
\t\t\t\tCOMBINE_HIDPI_IMAGES = YES;
\t\t\t\tGENERATE_INFOPLIST_FILE = NO;
\t\t\t\tINFOPLIST_FILE = Info.plist;
\t\t\t\tINFOPLIST_KEY_CFBundleIconName = AppIcon;
\t\t\t\tINFOPLIST_KEY_CFBundleIconFile = AppIcon;
\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (
\t\t\t\t\t"$(inherited)",
\t\t\t\t\t"@executable_path/../Frameworks",
\t\t\t\t);
\t\t\t\tMACOSX_DEPLOYMENT_TARGET = 14.0;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.kloak.app;
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t}};
\t\t\tname = Release;
\t\t}};""")
out.append("/* End XCBuildConfiguration section */\n")

# XCConfigurationList
out.append("/* Begin XCConfigurationList section */")
out.append(f"""\t\t{config_list_id} /* Build configuration list for PBXProject "Kloak" */ = {{
\t\t\tisa = XCConfigurationList;
\t\t\tbuildConfigurations = (
\t\t\t\t{proj_debug_cfg} /* Debug */,
\t\t\t\t{proj_release_cfg} /* Release */,
\t\t\t);
\t\t\tdefaultConfigurationIsVisible = 0;
\t\t\tdefaultConfigurationName = Release;
\t\t}};""")

out.append(f"""\t\t{target_config_list_id} /* Build configuration list for PBXNativeTarget "Kloak" */ = {{
\t\t\tisa = XCConfigurationList;
\t\t\tbuildConfigurations = (
\t\t\t\t{target_debug_cfg} /* Debug */,
\t\t\t\t{target_release_cfg} /* Release */,
\t\t\t);
\t\t\tdefaultConfigurationIsVisible = 0;
\t\t\tdefaultConfigurationName = Release;
\t\t}};""")
out.append("/* End XCConfigurationList section */\n")

out.append("\t};\n\trootObject = " + proj_id + " /* Project object */;\n}")

proj_dir = "packages/macos-app/Kloak.xcodeproj"
os.makedirs(proj_dir, exist_ok=True)
with open(os.path.join(proj_dir, "project.pbxproj"), "w") as f:
    f.write("\n".join(out))

print(f"Generated {proj_dir}/project.pbxproj with Assets.xcassets and AppIcon.icon successfully!")
