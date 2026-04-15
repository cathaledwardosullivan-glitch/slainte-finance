/**
 * certManager.cjs — Local CA + server certificate generation for HTTPS LAN access.
 *
 * Generates a local CA (10-year) on first startup, then signs server certs (2-year)
 * with all local private IPs as SANs. Companion devices install the CA cert once
 * to trust the HTTPS connection.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const selfsigned = require('selfsigned');

const CA_VALIDITY_DAYS = 3650;      // 10 years
const SERVER_VALIDITY_DAYS = 730;   // 2 years
const RENEWAL_THRESHOLD_DAYS = 30;  // Regenerate when <30 days remaining

/**
 * Get all private IPv4 addresses from network interfaces.
 */
function getAllLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips.sort();
}

/**
 * Check if the server cert needs regeneration (expiry or IP changes).
 */
function shouldRegenerateServerCert(certsDir) {
  const certPath = path.join(certsDir, 'server.pem');
  const ipsPath = path.join(certsDir, 'server-ips.json');

  if (!fs.existsSync(certPath) || !fs.existsSync(ipsPath)) {
    return { needed: true, reason: 'missing' };
  }

  // Check IP changes
  try {
    const savedIPs = JSON.parse(fs.readFileSync(ipsPath, 'utf-8'));
    const currentIPs = getAllLocalIPs();
    if (JSON.stringify(savedIPs) !== JSON.stringify(currentIPs)) {
      return { needed: true, reason: 'ip-changed' };
    }
  } catch {
    return { needed: true, reason: 'ip-file-corrupt' };
  }

  // Check expiry using Node's built-in X509Certificate
  try {
    const certPem = fs.readFileSync(certPath, 'utf-8');
    const x509 = new crypto.X509Certificate(certPem);
    const notAfter = new Date(x509.validTo);
    const daysRemaining = (notAfter - new Date()) / (1000 * 60 * 60 * 24);
    if (daysRemaining < RENEWAL_THRESHOLD_DAYS) {
      return { needed: true, reason: `expiring-in-${Math.floor(daysRemaining)}-days` };
    }
  } catch {
    return { needed: true, reason: 'cert-parse-error' };
  }

  return { needed: false };
}

/**
 * Generate the CA certificate and private key.
 */
async function generateCA(certsDir) {
  console.log('[CertManager] Generating new CA certificate (10-year validity)...');

  const attrs = [{ name: 'commonName', value: 'Slainte Finance Local CA' }];
  const extensions = [
    { name: 'basicConstraints', cA: true, critical: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true }
  ];

  const result = await selfsigned.generate(attrs, {
    keySize: 2048,
    days: CA_VALIDITY_DAYS,
    extensions
  });

  fs.writeFileSync(path.join(certsDir, 'ca.pem'), result.cert, 'utf-8');
  fs.writeFileSync(path.join(certsDir, 'ca-key.pem'), result.private, 'utf-8');

  console.log('[CertManager] CA certificate generated successfully');
  return { cert: result.cert, key: result.private };
}

/**
 * Generate a server certificate signed by the local CA.
 */
async function generateServerCert(certsDir, caCert, caKey) {
  const ips = getAllLocalIPs();
  console.log(`[CertManager] Generating server certificate for IPs: ${ips.join(', ')}`);

  // Build SAN list: all local IPs + localhost
  const altNames = [
    { type: 2, value: 'localhost' },          // DNS
    { type: 7, ip: '127.0.0.1' }             // IP
  ];
  for (const ip of ips) {
    altNames.push({ type: 7, ip });           // IP SAN
  }

  const attrs = [{ name: 'commonName', value: 'Slainte Finance Server' }];
  const extensions = [
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
    { name: 'extKeyUsage', serverAuth: true },
    { name: 'subjectAltName', altNames }
  ];

  const result = await selfsigned.generate(attrs, {
    keySize: 2048,
    days: SERVER_VALIDITY_DAYS,
    extensions,
    ca: { cert: caCert, key: caKey }
  });

  // Full chain: server cert + CA cert (for proper chain validation)
  const fullChain = result.cert + '\n' + caCert;

  fs.writeFileSync(path.join(certsDir, 'server.pem'), fullChain, 'utf-8');
  fs.writeFileSync(path.join(certsDir, 'server-key.pem'), result.private, 'utf-8');
  fs.writeFileSync(path.join(certsDir, 'server-ips.json'), JSON.stringify(ips), 'utf-8');

  console.log('[CertManager] Server certificate generated successfully');
  return { cert: fullChain, key: result.private };
}

/**
 * Main entry point — call on app startup.
 * Returns { serverCert, serverKey, caCert } for use with https.createServer().
 */
async function initCerts(userDataPath) {
  const certsDir = path.join(userDataPath, 'certs');

  // Ensure certs directory exists
  if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir, { recursive: true });
    console.log('[CertManager] Created certs directory:', certsDir);
  }

  // Generate CA if not present
  let caCert, caKey;
  const caCertPath = path.join(certsDir, 'ca.pem');
  const caKeyPath = path.join(certsDir, 'ca-key.pem');

  if (fs.existsSync(caCertPath) && fs.existsSync(caKeyPath)) {
    console.log('[CertManager] Loading existing CA certificate');
    caCert = fs.readFileSync(caCertPath, 'utf-8');
    caKey = fs.readFileSync(caKeyPath, 'utf-8');
  } else {
    const ca = await generateCA(certsDir);
    caCert = ca.cert;
    caKey = ca.key;
  }

  // Generate or regenerate server cert as needed
  let serverCert, serverKey;
  const check = shouldRegenerateServerCert(certsDir);

  if (check.needed) {
    console.log(`[CertManager] Server cert regeneration needed: ${check.reason}`);
    const server = await generateServerCert(certsDir, caCert, caKey);
    serverCert = server.cert;
    serverKey = server.key;
  } else {
    console.log('[CertManager] Loading existing server certificate');
    serverCert = fs.readFileSync(path.join(certsDir, 'server.pem'), 'utf-8');
    serverKey = fs.readFileSync(path.join(certsDir, 'server-key.pem'), 'utf-8');
  }

  return { serverCert, serverKey, caCert };
}

/**
 * Returns the path to the CA certificate file.
 */
function getCACertPath(userDataPath) {
  return path.join(userDataPath, 'certs', 'ca.pem');
}

module.exports = {
  initCerts,
  getAllLocalIPs,
  shouldRegenerateServerCert,
  getCACertPath
};
