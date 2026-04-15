# HTTPS Local CA — Implementation Plan

## Problem

Companion devices (Chromebooks, phones, laptops) access the app via `http://192.168.x.x:3001`. Service workers require HTTPS (except localhost), so the SW never registers over plain HTTP. Without a SW, Chrome cannot serve the app shell when offline — closing and reopening the PWA while disconnected shows Chrome's "You're offline" error page. Our JS never loads, so no amount of JS-level caching (localStorage, IndexedDB) can help.

## Solution

Generate a local Certificate Authority on the Electron desktop app. Sign server certificates with it. Serve Express over HTTPS. Users install the CA cert once per companion device — similar to the PCRS certificate workflow they already know.

## Architecture

```
Desktop (Electron)
├── Generates CA cert (10-year validity) on first startup
├── Generates server cert (2-year, auto-renew) signed by CA
├── HTTPS Express server on port 3001 (primary)
└── HTTP Express server on port 3080 (cert download + setup instructions only)

Companion Device
├── User downloads CA cert from http://<ip>:3080 (one-time)
├── Installs CA cert in device trust store (one-time)
├── Connects to https://<ip>:3001 (trusted, SW registers)
└── Full PWA: offline shell, cached data, background sync
```

## Implementation Phases

### Phase 1: Certificate Generation Module

**New file: `electron/certManager.cjs`**
**New dependency: `selfsigned` (pure JS, no native modules)**

Functions:
- `initCerts(userDataPath)` — main entry point, called on app startup
  - Creates `userData/certs/` if missing
  - Generates CA if not present (10-year, CN=Slainte Finance Local CA)
  - Generates server cert if missing/expiring/IPs changed (2-year, signed by CA)
  - Returns `{ serverCert, serverKey, caCert }`
- `getAllLocalIPs()` — returns all private IPv4 addresses from `os.networkInterfaces()`
- `shouldRegenerateServerCert(certsDir)` — checks expiry (<30 days) and IP changes vs `server-ips.json`
- `getCACertPath(userDataPath)` — returns path to `ca.pem`

Files stored in `%APPDATA%/slainte-finance-v2/certs/`:
```
ca.pem          — CA certificate (share with companion devices)
ca-key.pem      — CA private key (never shared)
server.pem      — Server certificate (includes full chain)
server-key.pem  — Server private key
server-ips.json — IPs embedded in current server cert (for change detection)
```

### Phase 2: Switch Express to HTTPS

**File: `electron/main.cjs` (~line 2388)**

Replace:
```js
const server = expressApp.listen(API_PORT, '0.0.0.0', () => { ... });
```

With:
```js
const https = require('https');
const certData = await initCerts(app.getPath('userData'));
const server = https.createServer({
  cert: certData.serverCert,
  key: certData.serverKey
}, expressApp).listen(API_PORT, '0.0.0.0', () => { ... });
```

Also set up a 60-second interval to check for IP changes and hot-swap certs via `server.setSecureContext()`.

### Phase 3: HTTP Landing Page (Port 3080)

**New file: `electron/certLandingPage.cjs`**

Minimal Express app serving a self-contained HTML page with:
- App branding (Slainte logo)
- "Download CA Certificate" button (serves `ca.pem`)
- Platform-specific installation instructions (collapsible sections):
  - ChromeOS: Settings > Security > Manage Certificates > Import
  - Android: Settings > Security > Install certificates
  - iOS: Download profile > Settings > Install > Trust
  - Windows: Double-click > Install Certificate > Trusted Root CAs
  - macOS: Open in Keychain Access > Trust > Always Trust
- "Open App" link pointing to `https://<detected-ip>:3001`

No React — just inline HTML/CSS. This is a bootstrap/onboarding page.

### Phase 4: CORS Updates

**File: `electron/main.cjs` (lines ~820-824)**

Update the three `lanPatterns` regex patterns from `http:\/\/` to `https?:\/\/`:
```js
/^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
/^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
/^https?:\/\/172\.(1[6-9]|2[0-9]|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$/
```

Add `https://localhost:3001` and `https://127.0.0.1:3001` to `allowedOrigins`.

### Phase 5: CA Cert Download Endpoint

**File: `electron/main.cjs`**

New route (no JWT auth required — CA certs are public):
```js
expressApp.get('/api/ca-cert', (req, res) => {
  res.setHeader('Content-Type', 'application/x-pem-file');
  res.setHeader('Content-Disposition', 'attachment; filename="slainte-finance-ca.pem"');
  res.sendFile(getCACertPath(app.getPath('userData')));
});
```

### Phase 6: IPC Bridge + Settings UI

**File: `electron/preload.cjs`** — new IPC methods:
- `getCACertInfo()` — returns cert status (exists, expiry, fingerprint, SANs)
- `exportCACert()` — opens save dialog to export `ca.pem`
- `regenerateServerCert()` — force regeneration + hot-swap

**File: `electron/main.cjs`** — corresponding `ipcMain.handle` handlers

**New file: `src/components/Settings/sections/CertificateSection.jsx`**
- Certificate status display (CA expiry, server cert expiry, current IPs)
- Export CA Certificate button
- Regenerate Server Certificate button
- Installation instructions panel

**File: `src/components/Settings/index.jsx`** — register new section

**File: `src/components/Settings/sections/ConnectedPracticeSection.jsx`** — update LAN IP display to show `https://` URL

### Phase 7: IP Change Handling

On app startup and every 60 seconds at runtime:
1. Call `getAllLocalIPs()`
2. Compare to `server-ips.json`
3. If changed: regenerate server cert, call `server.setSecureContext({ cert, key })`
4. Log the change

## Edge Cases

- **Multiple NICs:** Include ALL private IPs as SANs (Wi-Fi + Ethernet)
- **VPN interfaces:** Include them — no harm, may be useful
- **IPv6:** Skip initially, can add later
- **First startup performance:** Key generation takes 1-3s; run in parallel with window creation (certs only needed for Express, not Electron window)
- **Port 3080 in use:** Fail gracefully with a log warning
- **Existing HTTP companions:** Will stop working; HTTP landing page on 3080 is the migration path
- **Cert chain:** `server.pem` should contain server cert + CA cert concatenated for proper chain validation

## Client-Side Changes

- `src/hooks/useLANMode.js`: `getAPIBaseURL()` already uses `window.location.protocol` — no change needed for LAN. Update localhost fallback from `http://` to protocol-aware.
- `src/main.jsx`: SW registration code already works — it will succeed once page is served over HTTPS
- `public/sw.js`: Uses `location.origin` — already protocol-aware, no changes needed

## Dependencies

- `selfsigned` — pure JS, ~3KB + node-forge (~150KB). No native modules, no build complications.
- `https` — Node.js built-in

## File Change Summary

| File | Change type |
|------|------------|
| `package.json` | Add `selfsigned` dependency |
| `electron/certManager.cjs` | NEW — cert generation module |
| `electron/certLandingPage.cjs` | NEW — HTTP setup page on port 3080 |
| `electron/main.cjs` | HTTPS server, CORS, CA download endpoint, IPC handlers, IP monitoring |
| `electron/preload.cjs` | New IPC methods for cert management |
| `src/components/Settings/sections/CertificateSection.jsx` | NEW — cert management UI |
| `src/components/Settings/index.jsx` | Register CertificateSection |
| `src/components/Settings/sections/ConnectedPracticeSection.jsx` | Show https:// URL |
| `src/hooks/useLANMode.js` | Protocol-aware localhost fallback |
