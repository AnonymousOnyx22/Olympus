# Code signing and notarization

Olympus is distributed as signed installers for three platforms. This file is the
shortest path from "it builds on my machine" to "a customer can install it without
a scary warning".

**Nothing here can be done by a build script.** Signing requires certificates that
must be purchased, and notarization requires an Apple account. What *is* automated
is everything around them: the CI workflow already reads the secrets, so once the
certificates exist, signing turns on with no code change.

---

## 1. What each platform needs

| Platform | Requirement | Without it |
|---|---|---|
| macOS | Developer ID certificate + notarization | Gatekeeper blocks the app; users must right-click → Open and may be blocked entirely on Sequoia |
| Windows | OV or EV code-signing certificate | SmartScreen shows "Windows protected your PC"; reputation builds slowly or not at all |
| Linux | Nothing | AppImage/Deb are unsigned by convention |

---

## 2. macOS

### Buy
An Apple Developer Program membership, $99/year, at
https://developer.apple.com/programs/. This gives you the Developer ID Application
certificate that macOS requires. There is no free path.

### Export
1. Xcode → Settings → Accounts → Manage Certificates → **Developer ID Application**
   → right-click → **Export**, choose a `.p12`, set a password.
2. Base64 it (one line, no line breaks):

   ```bash
   base64 -i "Developer ID Application.p12" | tr -d '\n' > cert.p12.b64
   ```

### Configure (GitHub → Settings → Secrets and variables → Actions)

| Secret | Value |
|---|---|
| `CSC_LINK` | the base64 from step 2 |
| `CSC_KEY_PASSWORD` | the password you set on the export |
| `APPLE_ID` | your Apple account email |
| `APPLE_APP_SPECIFIC_PASSWORD` | an app-specific password from appleid.apple.com |
| `APPLE_TEAM_ID` | from the Developer account, 10 characters |

`CSC_LINK` / `CSC_KEY_PASSWORD` are read by electron-builder automatically. No
config change needed.

### Turn notarization on

This is the one manual edit, and it is one word.

`lantern/electron-builder.yml`:

```yaml
mac:
  notarize: false      # -> true
```

It is `false` by default so that a build on a machine without credentials still
succeeds. Flip it to `true` for the first public release, in the same commit that
adds the secrets. With `notarize: true`, electron-builder uploads the build to
Apple, waits for the result, and staples the ticket to the binary — there is no
separate `xcrun notarytool` step to remember.

Verify afterwards with:

```bash
spctl -a -vvv -t install "dist/Olympus-0.1.0-arm64.dmg"
```

---

## 3. Windows

### Buy
An OV or EV code-signing certificate from a CA accepted by SmartScreen, or Azure
Trusted Signing, which uses a signing service rather than a certificate file.
Budget roughly $200–400/year. For a product sold on trust, buy it.

### Export
Export the certificate as a `.pfx` with a password, then base64 it the same way.

### Configure

| Secret | Value |
|---|---|
| `CSC_LINK` | base64 of the `.pfx` |
| `CSC_KEY_PASSWORD` | the `.pfx` password |

No config change. The `win:` block in `electron-builder.yml` already points at
`build/icon.ico`, which was regenerated at 1024×1024.

SmartScreen reputation is earned over time and over download volume. A first
release signed with a fresh OV certificate still shows a warning to some users;
that is expected and it fades.

---

## 4. Auto-update

Not yet implemented, and it is the last thing standing between a customer and a
patch. `electron-updater` is not currently a dependency.

When it is added, an `update` block in `electron-builder.yml` plus a static
`latest.yml` is all it needs, and GitHub Releases is a supported provider. The
`publish` block is already pointed at a GitHub provider with a `TODO` repository
slug that should be set to the real `owner/repo` at the same time as the other
placeholders in `site.config.json`.

Until then, every release is a manual download for the user. That is acceptable
at zero users and not acceptable at one thousand.

---

## 5. The licence signing key

Unrelated to platform code signing, and easy to confuse with it.

`lantern/electron/license.ts` verifies customer licence keys with HMAC-SHA256
using a secret in the environment variable `OLYMPUS_LICENSE_SECRET`.

- Set it once, as a repository secret, before issuing a single key.
- **Changing it later invalidates every key already issued.** There is no
  re-issue path. Treat it as permanent.
- With no secret set, activation cannot succeed. The app still runs as a trial
  because enforcement is deliberately not wired in — see the comment above
  `handle('license:state', ...)` in `electron/main.ts`.

---

## 6. Checklist before the first public release

- [ ] `site.config.json` filled in; `npm run site:build` passes its gate
- [ ] `publish.owner` / `publish.repo` set in `electron-builder.yml`
- [ ] `OLYMPUS_LICENSE_SECRET` set, and recorded somewhere you will not lose it
- [ ] macOS: certificate exported, four secrets set, `notarize: true`, `spctl` passes
- [ ] Windows: certificate exported, two secrets set
- [ ] Four binaries uploaded to the release host named in `site.config.json`
- [ ] Auto-update implemented, or the changelog states plainly that it is manual
- [ ] A refund request you would honour, tested end to end, before the first sale
