/**
 * certLandingPage.cjs — Minimal HTTP server on port 3080 serving a self-contained
 * landing page for CA certificate download + installation instructions.
 *
 * This is the only page served over plain HTTP. Its sole purpose is to bootstrap
 * trust so companion devices can connect to the main HTTPS server on port 3001.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const { getAllLocalIPs, getCACertPath } = require('./certManager.cjs');

const LANDING_PORT = 3080;

function buildHTML(lanIP, httpsPort) {
  const appURL = `https://${lanIP}:${httpsPort}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sláinte Finance — Device Setup</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #F8FAFC;
      color: #1E293B;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      padding: 24px 16px;
    }
    .container { max-width: 540px; width: 100%; }
    .header {
      text-align: center;
      padding: 32px 0 24px;
    }
    .logo {
      width: 56px; height: 56px;
      background: #4A90E2;
      border-radius: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
      font-size: 28px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #0F172A;
      margin-bottom: 6px;
    }
    .subtitle {
      font-size: 14px;
      color: #64748B;
      line-height: 1.5;
    }
    .steps {
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      overflow: hidden;
      margin-bottom: 20px;
    }
    .step {
      padding: 20px 24px;
      border-bottom: 1px solid #F1F5F9;
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }
    .step:last-child { border-bottom: none; }
    .step-num {
      width: 28px; height: 28px;
      background: #EFF6FF;
      color: #4A90E2;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 14px;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .step-content h3 {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .step-content p {
      font-size: 13px;
      color: #64748B;
      line-height: 1.5;
    }
    .download-btn {
      display: block;
      width: 100%;
      padding: 14px;
      background: #4A90E2;
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      text-decoration: none;
      margin-bottom: 20px;
      transition: background 0.15s;
    }
    .download-btn:hover { background: #3D7BC7; }
    .open-app-btn {
      display: block;
      width: 100%;
      padding: 14px;
      background: white;
      color: #4A90E2;
      border: 2px solid #4A90E2;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      text-decoration: none;
      margin-bottom: 28px;
      transition: background 0.15s;
    }
    .open-app-btn:hover { background: #EFF6FF; }
    details {
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      margin-bottom: 12px;
      overflow: hidden;
    }
    summary {
      padding: 16px 24px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      list-style: none;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    summary::after {
      content: '+';
      font-size: 18px;
      color: #94A3B8;
      transition: transform 0.2s;
    }
    details[open] summary::after {
      content: '\\2212';
    }
    summary::-webkit-details-marker { display: none; }
    .instructions {
      padding: 0 24px 16px;
      font-size: 13px;
      color: #475569;
      line-height: 1.6;
    }
    .instructions ol {
      padding-left: 20px;
    }
    .instructions li {
      margin-bottom: 6px;
    }
    .instructions code {
      background: #F1F5F9;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 12px;
    }
    .footer {
      text-align: center;
      padding: 16px 0;
      font-size: 12px;
      color: #94A3B8;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">S</div>
      <h1>Device Setup</h1>
      <p class="subtitle">
        Install a security certificate so this device can securely
        connect to Sláinte Finance over your local network.
      </p>
    </div>

    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-content">
          <h3>Download Certificate</h3>
          <p>Tap the button below to download the Sláinte Finance CA certificate.</p>
        </div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-content">
          <h3>Install Certificate</h3>
          <p>Follow the instructions for your device type below to add it as a trusted certificate.</p>
        </div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-content">
          <h3>Open the App</h3>
          <p>Once installed, tap "Open App" to connect securely via HTTPS.</p>
        </div>
      </div>
    </div>

    <a class="download-btn" href="${appURL}/api/ca-cert">
      Download CA Certificate
    </a>
    <p style="text-align:center;font-size:12px;color:#94A3B8;margin:-12px 0 16px;">
      You'll see a security warning — tap <strong>Advanced</strong> then <strong>Proceed</strong>. This is expected before the certificate is installed.
    </p>

    <a class="open-app-btn" href="${appURL}">
      Open Sláinte Finance
    </a>

    <details>
      <summary>ChromeOS (Chromebook)</summary>
      <div class="instructions">
        <ol>
          <li>Tap <strong>Download Certificate</strong> above, then tap <strong>Advanced</strong> &gt; <strong>Proceed</strong> on the warning page</li>
          <li>Open <strong>Settings</strong> &gt; <strong>Privacy and security</strong> &gt; <strong>Security</strong></li>
          <li>Scroll down and tap <strong>Manage certificates</strong></li>
          <li>Go to the <strong>Authorities</strong> tab and tap <strong>Import</strong></li>
          <li>Select the downloaded certificate file</li>
          <li>Tick <strong>"Trust this certificate for identifying websites"</strong> and tap OK</li>
        </ol>
      </div>
    </details>

    <details>
      <summary>Android</summary>
      <div class="instructions">
        <ol>
          <li>Tap <strong>Download Certificate</strong> above</li>
          <li>Open <strong>Settings</strong> &gt; <strong>Security</strong> &gt; <strong>Encryption &amp; credentials</strong></li>
          <li>Tap <strong>Install a certificate</strong> &gt; <strong>CA certificate</strong></li>
          <li>Select the downloaded file and confirm</li>
          <li>You may need to set a screen lock if not already configured</li>
        </ol>
      </div>
    </details>

    <details>
      <summary>iOS / iPadOS</summary>
      <div class="instructions">
        <ol>
          <li>Tap <strong>Download Certificate</strong> above — a "Profile Downloaded" prompt will appear</li>
          <li>Open <strong>Settings</strong> &gt; <strong>General</strong> &gt; <strong>VPN &amp; Device Management</strong></li>
          <li>Tap the <strong>Slainte Finance Local CA</strong> profile and tap <strong>Install</strong></li>
          <li>Then go to <strong>Settings</strong> &gt; <strong>General</strong> &gt; <strong>About</strong> &gt; <strong>Certificate Trust Settings</strong></li>
          <li>Toggle <strong>ON</strong> for "Slainte Finance Local CA"</li>
        </ol>
      </div>
    </details>

    <details>
      <summary>Windows</summary>
      <div class="instructions">
        <ol>
          <li>Download the certificate and double-click the file</li>
          <li>Click <strong>Install Certificate</strong> &gt; <strong>Current User</strong> &gt; Next</li>
          <li>Select <strong>"Place all certificates in the following store"</strong></li>
          <li>Click <strong>Browse</strong> and select <strong>Trusted Root Certification Authorities</strong></li>
          <li>Click Next &gt; Finish and confirm the security warning</li>
        </ol>
      </div>
    </details>

    <details>
      <summary>macOS</summary>
      <div class="instructions">
        <ol>
          <li>Download the certificate and double-click to open in Keychain Access</li>
          <li>It will be added to your <strong>login</strong> keychain</li>
          <li>Find <strong>"Slainte Finance Local CA"</strong> in the list</li>
          <li>Double-click it &gt; expand <strong>Trust</strong> &gt; set to <strong>Always Trust</strong></li>
          <li>Close and enter your password to confirm</li>
        </ol>
      </div>
    </details>

    <div class="footer">
      This page is served over HTTP for initial setup only.<br>
      Once the certificate is installed, all communication is encrypted via HTTPS.
    </div>
  </div>
</body>
</html>`;
}

/**
 * Start the HTTP landing page server on port 3080.
 * @param {string} userDataPath - Electron userData path (for locating ca.pem)
 * @param {number} httpsPort - The HTTPS port (default 3001)
 */
function startCertLandingServer(userDataPath, httpsPort = 3001) {
  const caCertPath = getCACertPath(userDataPath);

  const server = http.createServer((req, res) => {
    // Serve the CA certificate in DER format with MIME type that triggers
    // Chrome's native cert import dialog (bypasses "insecure download" block)
    if (req.url === '/ca-cert') {
      if (!fs.existsSync(caCertPath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('CA certificate not found. Please restart the desktop app.');
        return;
      }
      // Convert PEM to DER (binary) — Chrome expects DER for x-x509-ca-cert
      const pem = fs.readFileSync(caCertPath, 'utf-8');
      const b64 = pem.replace(/-----BEGIN CERTIFICATE-----/g, '')
                      .replace(/-----END CERTIFICATE-----/g, '')
                      .replace(/\s/g, '');
      const der = Buffer.from(b64, 'base64');
      res.writeHead(200, {
        'Content-Type': 'application/x-x509-ca-cert',
        'Content-Length': der.length
      });
      res.end(der);
      return;
    }

    // Serve the landing page
    const ips = getAllLocalIPs();
    const lanIP = ips[0] || '127.0.0.1';
    const html = buildHTML(lanIP, httpsPort);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(html)
    });
    res.end(html);
  });

  server.listen(LANDING_PORT, '0.0.0.0', () => {
    console.log(`[Cert Landing] Setup page available at http://0.0.0.0:${LANDING_PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Cert Landing] Port ${LANDING_PORT} already in use — landing page disabled`);
    } else {
      console.error('[Cert Landing] Server error:', err);
    }
  });

  return server;
}

module.exports = { startCertLandingServer };
