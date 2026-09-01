"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const assert = __importStar(require("node:assert"));
const core_1 = require("@kloak/core");
(0, node_test_1.describe)('Kloak Import & Export Parsers', () => {
    (0, node_test_1.it)('parses Bitwarden JSON export', () => {
        const json = JSON.stringify({
            encrypted: false,
            items: [
                {
                    id: 'bw-1',
                    name: 'GitHub Account',
                    notes: 'Important dev account',
                    type: 1,
                    login: {
                        username: 'dev@github.com',
                        password: 'SuperSecretBitwardenPassword!',
                        uris: [{ uri: 'https://github.com/login' }],
                        totp: 'JBSWY3DPEHPK3PXP'
                    }
                },
                {
                    id: 'bw-2',
                    name: 'Wifi Note',
                    notes: 'Wifi password is test',
                    type: 2
                }
            ]
        });
        const res = (0, core_1.parseBitwardenJson)(json);
        assert.strictEqual(res.items.length, 2);
        assert.strictEqual(res.items[0].title, 'GitHub Account');
        assert.strictEqual(res.items[0].username, 'dev@github.com');
        assert.strictEqual(res.items[0].totpSecret, 'JBSWY3DPEHPK3PXP');
        assert.strictEqual(res.items[1].type, 'secure_note');
    });
    (0, node_test_1.it)('parses Bitwarden CSV export', () => {
        const csv = `folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp
Work,1,login,AWS Console,,Amazon Cloud,,https://console.aws.amazon.com,admin,AwsPassword123!,HXDMVJECJJWSRB3H`;
        const res = (0, core_1.parseBitwardenCsv)(csv);
        assert.strictEqual(res.items.length, 1);
        assert.strictEqual(res.items[0].title, 'AWS Console');
        assert.strictEqual(res.items[0].favorite, true);
        assert.strictEqual(res.items[0].username, 'admin');
    });
    (0, node_test_1.it)('parses Apple Passwords / Safari CSV export with OTPAuth', () => {
        const csv = `Title,URL,Username,Password,Notes,OTPAuth
GitHub,https://github.com,alex@github.com,ApplePassword99!,,otpauth://totp/GitHub:alex?secret=JBSWY3DPEHPK3PXP&issuer=GitHub`;
        const res = (0, core_1.parseApplePasswordsCsv)(csv);
        assert.strictEqual(res.items.length, 1);
        assert.strictEqual(res.items[0].title, 'GitHub');
        assert.strictEqual(res.items[0].username, 'alex@github.com');
        assert.strictEqual(res.items[0].totpSecret, 'JBSWY3DPEHPK3PXP');
    });
    (0, node_test_1.it)('parses Google Chrome / Chromium CSV export', () => {
        const csv = `name,url,username,password,note
Netflix,https://netflix.com/login,netflix_user@gmail.com,NetflixPwd1234,Family profile`;
        const res = (0, core_1.parseChromeCsv)(csv);
        assert.strictEqual(res.items.length, 1);
        assert.strictEqual(res.items[0].title, 'Netflix');
        assert.strictEqual(res.items[0].username, 'netflix_user@gmail.com');
    });
    (0, node_test_1.it)('parses LastPass CSV export', () => {
        const csv = `url,username,password,totp,extra,name,grouping,fav
https://lastpass.com,lp_user,LpSecret123!,,My notes,LastPass Portal,Personal,1`;
        const res = (0, core_1.parseLastPassCsv)(csv);
        assert.strictEqual(res.items.length, 1);
        assert.strictEqual(res.items[0].title, 'LastPass Portal');
        assert.strictEqual(res.items[0].favorite, true);
    });
    (0, node_test_1.it)('parses KeePass XML export', () => {
        const xml = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<KeePassFile>
  <Root>
    <Group>
      <Entry>
        <String><Key>Title</Key><Value>Proton</Value></String>
        <String><Key>UserName</Key><Value>proton_user</Value></String>
        <String><Key>Password</Key><Value>ProtonKeePassSecret!</Value></String>
        <String><Key>URL</Key><Value>https://proton.me</Value></String>
      </Entry>
    </Group>
  </Root>
</KeePassFile>`;
        const res = (0, core_1.parseKeePassXml)(xml);
        assert.strictEqual(res.items.length, 1);
        assert.strictEqual(res.items[0].title, 'Proton');
        assert.strictEqual(res.items[0].password, 'ProtonKeePassSecret!');
    });
    (0, node_test_1.it)('auto-detects source formats seamlessly in importFromContent', () => {
        const appleCsv = `Title,URL,Username,Password,Notes,OTPAuth\nStripe,https://stripe.com,admin@stripe.com,Stripe123!,,`;
        const res = (0, core_1.importFromContent)(appleCsv, 'auto');
        assert.strictEqual(res.items.length, 1);
        assert.strictEqual(res.items[0].title, 'Stripe');
    });
    (0, node_test_1.it)('exports vault in Kloak encrypted, standard JSON, and Bitwarden-compatible formats', () => {
        const payload = {
            version: 1,
            items: [{
                    id: '1',
                    type: 'login',
                    title: 'Twitter / X',
                    username: 'tweet_user',
                    password: 'Password999!',
                    urls: ['https://x.com'],
                    tags: [],
                    favorite: true,
                    trashed: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }],
            folders: [{ id: 'f1', name: 'Social' }],
            settings: core_1.DEFAULT_SETTINGS,
            updatedAt: new Date().toISOString()
        };
        // 1. Encrypted export
        const encRes = (0, core_1.exportVault)(payload, { format: 'kloak-encrypted', password: 'BackupPassword123!' });
        assert.ok(encRes.data.includes('wrappedVaultKey'));
        // 2. Standard JSON
        const jsonRes = (0, core_1.exportVault)(payload, { format: 'kloak-json' });
        assert.ok(jsonRes.data.includes('Twitter / X'));
        // 3. Bitwarden JSON
        const bwRes = (0, core_1.exportVault)(payload, { format: 'bitwarden-json' });
        assert.ok(bwRes.data.includes('login'));
        // 4. CSV
        const csvRes = (0, core_1.exportVault)(payload, { format: 'kloak-csv' });
        assert.ok(csvRes.data.includes('Twitter / X'));
    });
});
