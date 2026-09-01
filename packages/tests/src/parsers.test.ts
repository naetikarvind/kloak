import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  importFromContent,
  exportVault,
  parseBitwardenJson,
  parseBitwardenCsv,
  parseApplePasswordsCsv,
  parseChromeCsv,
  parseLastPassCsv,
  parseKeePassXml,
  parseProtonPassCsv,
  parseDashlaneCsv,
  DEFAULT_SETTINGS
} from '@kloak/core';

describe('Kloak Import & Export Parsers', () => {
  it('parses Bitwarden JSON export', () => {
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

    const res = parseBitwardenJson(json);
    assert.strictEqual(res.items.length, 2);
    assert.strictEqual(res.items[0].title, 'GitHub Account');
    assert.strictEqual(res.items[0].username, 'dev@github.com');
    assert.strictEqual(res.items[0].totpSecret, 'JBSWY3DPEHPK3PXP');
    assert.strictEqual(res.items[1].type, 'secure_note');
  });

  it('parses Bitwarden CSV export', () => {
    const csv = `folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp
Work,1,login,AWS Console,,Amazon Cloud,,https://console.aws.amazon.com,admin,AwsPassword123!,HXDMVJECJJWSRB3H`;

    const res = parseBitwardenCsv(csv);
    assert.strictEqual(res.items.length, 1);
    assert.strictEqual(res.items[0].title, 'AWS Console');
    assert.strictEqual(res.items[0].favorite, true);
    assert.strictEqual(res.items[0].username, 'admin');
  });

  it('parses Apple Passwords / Safari CSV export with OTPAuth', () => {
    const csv = `Title,URL,Username,Password,Notes,OTPAuth
GitHub,https://github.com,alex@github.com,ApplePassword99!,,otpauth://totp/GitHub:alex?secret=JBSWY3DPEHPK3PXP&issuer=GitHub`;

    const res = parseApplePasswordsCsv(csv);
    assert.strictEqual(res.items.length, 1);
    assert.strictEqual(res.items[0].title, 'GitHub');
    assert.strictEqual(res.items[0].username, 'alex@github.com');
    assert.strictEqual(res.items[0].totpSecret, 'JBSWY3DPEHPK3PXP');
  });

  it('parses Google Chrome / Chromium CSV export', () => {
    const csv = `name,url,username,password,note
Netflix,https://netflix.com/login,netflix_user@gmail.com,NetflixPwd1234,Family profile`;

    const res = parseChromeCsv(csv);
    assert.strictEqual(res.items.length, 1);
    assert.strictEqual(res.items[0].title, 'Netflix');
    assert.strictEqual(res.items[0].username, 'netflix_user@gmail.com');
  });

  it('parses LastPass CSV export', () => {
    const csv = `url,username,password,totp,extra,name,grouping,fav
https://lastpass.com,lp_user,LpSecret123!,,My notes,LastPass Portal,Personal,1`;

    const res = parseLastPassCsv(csv);
    assert.strictEqual(res.items.length, 1);
    assert.strictEqual(res.items[0].title, 'LastPass Portal');
    assert.strictEqual(res.items[0].favorite, true);
  });

  it('parses KeePass XML export', () => {
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

    const res = parseKeePassXml(xml);
    assert.strictEqual(res.items.length, 1);
    assert.strictEqual(res.items[0].title, 'Proton');
    assert.strictEqual(res.items[0].password, 'ProtonKeePassSecret!');
  });

  it('auto-detects source formats seamlessly in importFromContent', () => {
    const appleCsv = `Title,URL,Username,Password,Notes,OTPAuth\nStripe,https://stripe.com,admin@stripe.com,Stripe123!,,`;
    const res = importFromContent(appleCsv, 'auto');
    assert.strictEqual(res.items.length, 1);
    assert.strictEqual(res.items[0].title, 'Stripe');
  });

  it('exports vault in Kloak encrypted, standard JSON, and Bitwarden-compatible formats', () => {
    const payload = {
      version: 1,
      items: [{
        id: '1',
        type: 'login' as const,
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
      settings: DEFAULT_SETTINGS,
      updatedAt: new Date().toISOString()
    };

    // 1. Encrypted export
    const encRes = exportVault(payload, { format: 'kloak-encrypted', password: 'BackupPassword123!' });
    assert.ok(encRes.data.includes('wrappedVaultKey'));

    // 2. Standard JSON
    const jsonRes = exportVault(payload, { format: 'kloak-json' });
    assert.ok(jsonRes.data.includes('Twitter / X'));

    // 3. Bitwarden JSON
    const bwRes = exportVault(payload, { format: 'bitwarden-json' });
    assert.ok(bwRes.data.includes('login'));

    // 4. CSV
    const csvRes = exportVault(payload, { format: 'kloak-csv' });
    assert.ok(csvRes.data.includes('Twitter / X'));
  });
});
