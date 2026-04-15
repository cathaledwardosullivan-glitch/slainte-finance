import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Download,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Globe,
  Key
} from 'lucide-react';
import COLORS from '../../../utils/colors';

/**
 * CertificateSection — View and manage HTTPS certificates for LAN access.
 * Only visible on desktop (Electron) — companion devices don't manage certs.
 */
const CertificateSection = () => {
  const [certInfo, setCertInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [exportResult, setExportResult] = useState(null);
  const [regenResult, setRegenResult] = useState(null);

  const isElectron = !!window.electronAPI?.certs;

  useEffect(() => {
    loadCertInfo();
  }, []);

  const loadCertInfo = async () => {
    if (!isElectron) { setLoading(false); return; }
    try {
      const info = await window.electronAPI.certs.getInfo();
      setCertInfo(info);
    } catch (err) {
      console.error('[CertSection] Failed to load cert info:', err);
    }
    setLoading(false);
  };

  const handleExport = async () => {
    setExportResult(null);
    try {
      const result = await window.electronAPI.certs.export();
      if (result.canceled) return;
      setExportResult(result.success ? 'success' : 'error');
    } catch {
      setExportResult('error');
    }
    setTimeout(() => setExportResult(null), 3000);
  };

  const handleRegenerate = async () => {
    if (!window.confirm('Regenerate the server certificate? Companion devices will need to reconnect.')) return;
    setRegenerating(true);
    setRegenResult(null);
    try {
      const result = await window.electronAPI.certs.regenerateServer();
      setRegenResult(result.success ? 'success' : 'error');
      if (result.success) await loadCertInfo();
    } catch {
      setRegenResult('error');
    }
    setRegenerating(false);
    setTimeout(() => setRegenResult(null), 4000);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown';
    try {
      return new Date(dateStr).toLocaleDateString('en-IE', {
        day: 'numeric', month: 'short', year: 'numeric'
      });
    } catch { return dateStr; }
  };

  const formatFingerprint = (fp) => {
    if (!fp) return '';
    // Show first 24 chars of SHA-256 fingerprint
    return fp.substring(0, 23) + '...';
  };

  if (!isElectron) {
    return (
      <div style={{ padding: '1rem', color: COLORS.textSecondary, fontSize: '0.9rem' }}>
        Certificate management is only available on the desktop app.
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '1rem', color: COLORS.textSecondary, fontSize: '0.9rem' }}>
        Loading certificate info...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Header */}
      <div>
        <h3 style={{
          fontSize: '1.125rem', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          color: COLORS.textPrimary, margin: '0 0 0.25rem 0'
        }}>
          <ShieldCheck size={20} color={COLORS.slainteBlue} />
          HTTPS Certificates
        </h3>
        <p style={{ fontSize: '0.85rem', color: COLORS.textSecondary, margin: 0 }}>
          Certificates that secure the connection between this computer and companion devices on your network.
        </p>
      </div>

      {/* CA Certificate Card */}
      {certInfo?.caExists && (
        <div style={{
          padding: '1.25rem',
          borderRadius: '0.5rem',
          border: `1px solid ${COLORS.borderLight}`,
          backgroundColor: COLORS.white
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Key size={16} color={COLORS.slainteBlue} />
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>CA Certificate</h4>
            <span style={{
              marginLeft: 'auto',
              fontSize: '0.75rem',
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: 'rgba(78, 205, 196, 0.1)',
              color: COLORS.incomeColor,
              fontWeight: 600
            }}>Active</span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.5rem 1.5rem',
            fontSize: '0.85rem',
            marginBottom: '1rem'
          }}>
            <div>
              <span style={{ color: COLORS.textSecondary }}>Subject: </span>
              <span style={{ color: COLORS.textPrimary }}>{certInfo.caSubject?.replace('CN=', '')}</span>
            </div>
            <div>
              <span style={{ color: COLORS.textSecondary }}>Expires: </span>
              <span style={{ color: COLORS.textPrimary }}>{formatDate(certInfo.caExpiry)}</span>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={{ color: COLORS.textSecondary }}>Fingerprint: </span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: COLORS.textPrimary }}>
                {formatFingerprint(certInfo.caFingerprint)}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleExport}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 500,
                color: COLORS.slainteBlue,
                backgroundColor: COLORS.white,
                border: `1px solid ${COLORS.slainteBlue}`,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <Download size={14} />
              Export CA Certificate
            </button>
            {exportResult === 'success' && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', color: COLORS.incomeColor }}>
                <CheckCircle size={14} /> Saved
              </span>
            )}
          </div>

          <p style={{
            fontSize: '0.8rem', color: COLORS.textSecondary,
            margin: '0.75rem 0 0 0', lineHeight: 1.5
          }}>
            Install this certificate on companion devices (Chromebooks, phones) so they trust the
            secure connection. Each device only needs to install it once.
          </p>
        </div>
      )}

      {/* Server Certificate Card */}
      {certInfo?.serverExists && (
        <div style={{
          padding: '1.25rem',
          borderRadius: '0.5rem',
          border: `1px solid ${COLORS.borderLight}`,
          backgroundColor: COLORS.white
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Globe size={16} color={COLORS.slainteBlue} />
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Server Certificate</h4>
            <span style={{
              marginLeft: 'auto',
              fontSize: '0.75rem',
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: 'rgba(78, 205, 196, 0.1)',
              color: COLORS.incomeColor,
              fontWeight: 600
            }}>Active</span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.5rem 1.5rem',
            fontSize: '0.85rem',
            marginBottom: '0.75rem'
          }}>
            <div>
              <span style={{ color: COLORS.textSecondary }}>Expires: </span>
              <span style={{ color: COLORS.textPrimary }}>{formatDate(certInfo.serverExpiry)}</span>
            </div>
            <div>
              <span style={{ color: COLORS.textSecondary }}>IPs: </span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: COLORS.textPrimary }}>
                {(certInfo.serverIPs || []).join(', ')}
              </span>
            </div>
            {certInfo.serverSANs && (
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: COLORS.textSecondary }}>SANs: </span>
                <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: COLORS.textPrimary }}>
                  {certInfo.serverSANs}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              fontSize: '0.85rem',
              fontWeight: 500,
              color: COLORS.textPrimary,
              backgroundColor: COLORS.white,
              border: `1px solid ${COLORS.borderLight}`,
              cursor: regenerating ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              opacity: regenerating ? 0.6 : 1
            }}
          >
            <RefreshCw size={14} style={regenerating ? { animation: 'spin 1s linear infinite' } : {}} />
            {regenerating ? 'Regenerating...' : 'Regenerate Server Certificate'}
          </button>

          {regenResult === 'success' && (
            <div style={{
              marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '0.375rem',
              fontSize: '0.85rem', color: COLORS.incomeColor,
              backgroundColor: 'rgba(78, 205, 196, 0.1)',
              display: 'flex', alignItems: 'center', gap: '0.4rem'
            }}>
              <CheckCircle size={14} /> Certificate regenerated successfully
            </div>
          )}
          {regenResult === 'error' && (
            <div style={{
              marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '0.375rem',
              fontSize: '0.85rem', color: COLORS.expenseColor,
              backgroundColor: 'rgba(255, 107, 107, 0.1)',
              display: 'flex', alignItems: 'center', gap: '0.4rem'
            }}>
              <AlertTriangle size={14} /> Failed to regenerate certificate
            </div>
          )}
        </div>
      )}

      {/* No certs state */}
      {!certInfo?.caExists && !certInfo?.serverExists && (
        <div style={{
          padding: '1.25rem', borderRadius: '0.5rem',
          backgroundColor: 'rgba(255, 210, 60, 0.08)',
          border: '1px solid rgba(255, 210, 60, 0.25)',
          display: 'flex', alignItems: 'center', gap: '0.75rem'
        }}>
          <AlertTriangle size={20} color={COLORS.highlightYellow} />
          <div>
            <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>
              No certificates found
            </p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: COLORS.textSecondary }}>
              Certificates will be generated automatically on next app restart.
            </p>
          </div>
        </div>
      )}

      {/* Setup instructions link */}
      <div style={{
        padding: '1rem 1.25rem',
        borderRadius: '0.5rem',
        backgroundColor: 'rgba(74, 144, 226, 0.05)',
        border: '1px solid rgba(74, 144, 226, 0.15)',
        fontSize: '0.85rem',
        color: COLORS.textSecondary,
        lineHeight: 1.5
      }}>
        <strong style={{ color: COLORS.textPrimary }}>Setting up a new device?</strong> On the companion device,
        open <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
          http://{(certInfo?.serverIPs || [])[0] || '<your-ip>'}:3080
        </span> for
        step-by-step instructions and certificate download.
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default CertificateSection;
