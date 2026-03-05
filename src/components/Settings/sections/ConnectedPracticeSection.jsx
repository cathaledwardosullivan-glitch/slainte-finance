import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../../context/AppContext';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Link2,
  Unlink,
  Monitor,
  Clock
} from 'lucide-react';
import COLORS from '../../../utils/colors';

// localStorage keys for connection config
const CONNECTED_ADDRESS = 'connected_practice_address';
const CONNECTED_TOKEN = 'connected_practice_token';
const CONNECTED_NAME = 'connected_practice_name';
const CONNECTED_LAST_REFRESH = 'connected_practice_last_refresh';
const CONNECTED_DATA_SUMMARY = 'connected_practice_data_summary';

/**
 * Format a relative time string from an ISO timestamp
 */
function formatRelativeTime(isoString) {
  if (!isoString) return 'Never';
  const then = new Date(isoString);
  const now = new Date();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

/**
 * Check if last refresh is stale (>24 hours)
 */
function isStale(isoString) {
  if (!isoString) return true;
  return (new Date() - new Date(isoString)) > 24 * 60 * 60 * 1000;
}

/**
 * ConnectedPracticeSection — Connect to another Sláinte Finance install on the LAN
 * and pull practice data on demand.
 */
const ConnectedPracticeSection = () => {
  const {
    setTransactions,
    setUnidentifiedTransactions,
    setCategoryMapping,
    setPaymentAnalysisData
  } = useAppContext();

  // Connection config (from localStorage)
  const [hubAddress, setHubAddress] = useState('');
  const [password, setPassword] = useState('');
  const [connectedAddress, setConnectedAddress] = useState(null);
  const [connectedToken, setConnectedToken] = useState(null);
  const [connectedName, setConnectedName] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [dataSummary, setDataSummary] = useState(null);

  // UI state
  const [isTesting, setIsTesting] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [testResult, setTestResult] = useState(null); // 'success' | 'error' | null
  const [testError, setTestError] = useState(null);
  const [pullError, setPullError] = useState(null);
  const [hubReachable, setHubReachable] = useState(null); // null = unchecked, true/false
  const [lanIP, setLanIP] = useState(null);

  // Load saved connection config on mount
  useEffect(() => {
    setConnectedAddress(localStorage.getItem(CONNECTED_ADDRESS));
    setConnectedToken(localStorage.getItem(CONNECTED_TOKEN));
    setConnectedName(localStorage.getItem(CONNECTED_NAME));
    setLastRefresh(localStorage.getItem(CONNECTED_LAST_REFRESH));
    const summary = localStorage.getItem(CONNECTED_DATA_SUMMARY);
    if (summary) {
      try { setDataSummary(JSON.parse(summary)); } catch { /* ignore */ }
    }
  }, []);

  // Check hub reachability when connected (on mount)
  useEffect(() => {
    if (connectedAddress && connectedToken) {
      checkHubReachable();
    }
  }, [connectedAddress, connectedToken]);

  // Try to get LAN IP from Electron for the "sharing" card
  useEffect(() => {
    if (window.electronAPI?.getLanIP) {
      window.electronAPI.getLanIP().then(ip => setLanIP(ip)).catch(() => {});
    }
  }, []);

  const buildBaseURL = (address) => {
    const addr = address.trim();
    // Add port if not specified
    const withPort = addr.includes(':') ? addr : `${addr}:3001`;
    return `http://${withPort}`;
  };

  const checkHubReachable = async () => {
    try {
      const response = await fetch(`${buildBaseURL(connectedAddress)}/api/health`, {
        signal: AbortSignal.timeout(3000)
      });
      setHubReachable(response.ok);
    } catch {
      setHubReachable(false);
    }
  };

  /**
   * Test connection to a hub address
   */
  const handleTestConnection = async () => {
    if (!hubAddress.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    setTestError(null);

    try {
      const response = await fetch(`${buildBaseURL(hubAddress)}/api/health`, {
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        setTestResult('success');
      } else {
        setTestResult('error');
        setTestError(`Server responded with status ${response.status}`);
      }
    } catch (err) {
      setTestResult('error');
      setTestError('Could not reach that address. Check the IP and ensure the main computer is running Sláinte Finance.');
    } finally {
      setIsTesting(false);
    }
  };

  /**
   * Authenticate and pull all data from the hub
   */
  const handleConnectAndPull = async (address, pwd) => {
    const targetAddress = address || connectedAddress;
    const targetToken = pwd ? null : connectedToken;
    setPullError(null);
    setIsPulling(true);

    try {
      let token = targetToken;

      // Authenticate if we don't have a token (or have a password to use)
      if (!token || pwd) {
        const authResponse = await fetch(`${buildBaseURL(targetAddress)}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pwd }),
          signal: AbortSignal.timeout(10000)
        });

        const authData = await authResponse.json();

        if (!authData.success || !authData.token) {
          throw new Error(authData.error || 'Authentication failed');
        }
        token = authData.token;
      }

      // Pull all data
      const syncResponse = await fetch(`${buildBaseURL(targetAddress)}/api/sync/data`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(30000)
      });

      if (syncResponse.status === 401 || syncResponse.status === 403) {
        throw new Error('Authentication expired. Please re-enter your password.');
      }

      if (!syncResponse.ok) {
        throw new Error(`Failed to pull data (status ${syncResponse.status})`);
      }

      const syncResult = await syncResponse.json();
      const data = syncResult.data;

      if (!data) {
        throw new Error('No data returned from hub');
      }

      // Apply data — same pattern as BackupRestoreSection restore
      setTransactions(data.transactions || []);
      setUnidentifiedTransactions(data.unidentifiedTransactions || []);
      if (data.categoryMapping) setCategoryMapping(data.categoryMapping);
      if (data.paymentAnalysisData) setPaymentAnalysisData(data.paymentAnalysisData);

      // Write items that aren't in AppContext directly
      if (data.savedReports) {
        localStorage.setItem('gp_finance_saved_reports', JSON.stringify(data.savedReports));
      }
      if (data.learnedIdentifiers) {
        localStorage.setItem('gp_finance_learned_patterns', JSON.stringify(data.learnedIdentifiers));
      }
      if (data.practiceProfile) {
        localStorage.setItem('slainte_practice_profile',
          typeof data.practiceProfile === 'string'
            ? data.practiceProfile
            : JSON.stringify(data.practiceProfile)
        );
      }
      if (data.settings) {
        localStorage.setItem('gp_finance_settings', JSON.stringify({ data: data.settings, timestamp: new Date().toISOString(), version: '1.0' }));
      }

      // Build data summary for display
      const summary = {
        transactions: (data.transactions || []).length,
        pcrs: (data.paymentAnalysisData || []).length,
        reports: (data.savedReports || []).length
      };

      // Extract practice name from profile
      let practiceName = 'Practice';
      if (data.practiceProfile) {
        const profile = typeof data.practiceProfile === 'string'
          ? JSON.parse(data.practiceProfile)
          : data.practiceProfile;
        practiceName = profile?.practiceDetails?.practiceName || profile?.practiceName || 'Practice';
      }

      // Save connection config
      const now = new Date().toISOString();
      localStorage.setItem(CONNECTED_ADDRESS, targetAddress.trim());
      localStorage.setItem(CONNECTED_TOKEN, token);
      localStorage.setItem(CONNECTED_NAME, practiceName);
      localStorage.setItem(CONNECTED_LAST_REFRESH, now);
      localStorage.setItem(CONNECTED_DATA_SUMMARY, JSON.stringify(summary));

      // Update local state
      setConnectedAddress(targetAddress.trim());
      setConnectedToken(token);
      setConnectedName(practiceName);
      setLastRefresh(now);
      setDataSummary(summary);
      setHubReachable(true);
      setPassword('');

      // Reload to pick up all changes cleanly (practice profile, settings, etc.)
      alert(`Data pulled successfully from ${practiceName}. The page will now reload.`);
      window.location.reload();

    } catch (err) {
      console.error('[ConnectedPractice] Pull error:', err);
      // If auth expired, clear the token so user re-enters password
      if (err.message.includes('Authentication expired') || err.message.includes('Authentication failed')) {
        localStorage.removeItem(CONNECTED_TOKEN);
        setConnectedToken(null);
      }
      setPullError(err.message);
    } finally {
      setIsPulling(false);
    }
  };

  /**
   * Disconnect — clear all connection config
   */
  const handleDisconnect = () => {
    if (!window.confirm('Disconnect from the practice computer? Your cached data will remain, but you won\'t receive further updates.')) {
      return;
    }
    localStorage.removeItem(CONNECTED_ADDRESS);
    localStorage.removeItem(CONNECTED_TOKEN);
    localStorage.removeItem(CONNECTED_NAME);
    localStorage.removeItem(CONNECTED_LAST_REFRESH);
    localStorage.removeItem(CONNECTED_DATA_SUMMARY);
    setConnectedAddress(null);
    setConnectedToken(null);
    setConnectedName(null);
    setLastRefresh(null);
    setDataSummary(null);
    setHubReachable(null);
  };

  const isConnected = connectedAddress && connectedToken;
  const needsReauth = connectedAddress && !connectedToken;

  // ===== RENDER =====

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* === CONNECTED STATE === */}
      {isConnected && (
        <>
          {/* Status Card */}
          <div style={{
            padding: '1.25rem',
            borderRadius: '0.5rem',
            border: `2px solid ${hubReachable === false ? COLORS.highlightYellow : COLORS.incomeColor}`,
            backgroundColor: hubReachable === false ? 'rgba(255, 210, 60, 0.05)' : 'rgba(78, 205, 196, 0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {hubReachable === false ? (
                  <WifiOff size={24} color={COLORS.highlightYellow} />
                ) : (
                  <Wifi size={24} color={COLORS.incomeColor} />
                )}
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                    Connected to {connectedName || 'Practice'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: COLORS.mediumGray }}>
                    {connectedAddress}
                    {hubReachable === false && ' — Hub offline, using cached data'}
                  </p>
                </div>
              </div>
              <CheckCircle size={20} color={COLORS.incomeColor} />
            </div>

            {/* Data summary & freshness */}
            <div style={{
              display: 'flex',
              gap: '1.5rem',
              flexWrap: 'wrap',
              marginBottom: '1rem',
              padding: '0.75rem',
              backgroundColor: COLORS.white,
              borderRadius: '0.375rem',
              border: `1px solid ${COLORS.lightGray}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={14} color={isStale(lastRefresh) ? COLORS.highlightYellow : COLORS.mediumGray} />
                <span style={{
                  fontSize: '0.85rem',
                  fontWeight: isStale(lastRefresh) ? 600 : 400,
                  color: isStale(lastRefresh) ? COLORS.highlightYellow : COLORS.darkGray
                }}>
                  Last refreshed: {formatRelativeTime(lastRefresh)}
                </span>
              </div>
              {dataSummary && (
                <>
                  <span style={{ fontSize: '0.85rem', color: COLORS.mediumGray }}>
                    {dataSummary.transactions} transactions
                  </span>
                  <span style={{ fontSize: '0.85rem', color: COLORS.mediumGray }}>
                    {dataSummary.pcrs} PCRS records
                  </span>
                  {dataSummary.reports > 0 && (
                    <span style={{ fontSize: '0.85rem', color: COLORS.mediumGray }}>
                      {dataSummary.reports} reports
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleConnectAndPull()}
                disabled={isPulling || hubReachable === false}
                style={{
                  padding: '0.625rem 1rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: COLORS.white,
                  backgroundColor: (isPulling || hubReachable === false) ? COLORS.lightGray : COLORS.slainteBlue,
                  border: 'none',
                  cursor: (isPulling || hubReachable === false) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <RefreshCw size={14} style={isPulling ? { animation: 'spin 1s linear infinite' } : {}} />
                {isPulling ? 'Pulling data...' : 'Refresh Now'}
              </button>

              <button
                onClick={() => checkHubReachable()}
                style={{
                  padding: '0.625rem 1rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: COLORS.darkGray,
                  backgroundColor: COLORS.white,
                  border: `1px solid ${COLORS.lightGray}`,
                  cursor: 'pointer'
                }}
              >
                Check Connection
              </button>

              <button
                onClick={handleDisconnect}
                style={{
                  padding: '0.625rem 1rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: COLORS.expenseColor,
                  backgroundColor: COLORS.white,
                  border: `1px solid ${COLORS.expenseColor}`,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <Unlink size={14} />
                Disconnect
              </button>
            </div>

            {pullError && (
              <div style={{
                marginTop: '0.75rem',
                padding: '0.625rem 0.75rem',
                borderRadius: '0.375rem',
                backgroundColor: 'rgba(255, 107, 107, 0.1)',
                border: `1px solid ${COLORS.expenseColor}`,
                color: COLORS.expenseColor,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <AlertTriangle size={14} />
                {pullError}
              </div>
            )}
          </div>

          {/* Re-auth card if token expired */}
          {needsReauth && (
            <ReauthCard
              address={connectedAddress}
              onReauth={(pwd) => handleConnectAndPull(connectedAddress, pwd)}
              isPulling={isPulling}
              error={pullError}
            />
          )}
        </>
      )}

      {/* === RE-AUTH STATE (address saved but token cleared) === */}
      {needsReauth && !isConnected && (
        <ReauthCard
          address={connectedAddress}
          onReauth={(pwd) => handleConnectAndPull(connectedAddress, pwd)}
          isPulling={isPulling}
          error={pullError}
        />
      )}

      {/* === NOT CONNECTED STATE === */}
      {!isConnected && !needsReauth && (
        <div style={{
          backgroundColor: COLORS.white,
          padding: '1.5rem',
          borderRadius: '0.5rem',
          border: `1px solid ${COLORS.lightGray}`
        }}>
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: COLORS.darkGray,
            marginTop: 0,
            marginBottom: '0.25rem'
          }}>
            <Link2 size={18} color={COLORS.slainteBlue} />
            Connect to Practice Computer
          </h3>
          <p style={{ fontSize: '0.85rem', color: COLORS.mediumGray, marginTop: 0, marginBottom: '1.25rem' }}>
            Pull practice data from another computer running Sláinte Finance on your network.
            Enter the IP address shown on that computer's Settings page.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '400px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.375rem', color: COLORS.darkGray }}>
                Hub IP Address
              </label>
              <input
                type="text"
                value={hubAddress}
                onChange={(e) => { setHubAddress(e.target.value); setTestResult(null); }}
                placeholder="e.g. 192.168.1.100"
                style={{
                  width: '100%',
                  padding: '0.625rem 0.75rem',
                  border: `1px solid ${COLORS.lightGray}`,
                  borderRadius: '0.375rem',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.375rem', color: COLORS.darkGray }}>
                Partner Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Same as mobile access password"
                style={{
                  width: '100%',
                  padding: '0.625rem 0.75rem',
                  border: `1px solid ${COLORS.lightGray}`,
                  borderRadius: '0.375rem',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Test result indicator */}
            {testResult && (
              <div style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: testResult === 'success' ? 'rgba(78, 205, 196, 0.1)' : 'rgba(255, 107, 107, 0.1)',
                color: testResult === 'success' ? COLORS.incomeColor : COLORS.expenseColor,
                border: `1px solid ${testResult === 'success' ? COLORS.incomeColor : COLORS.expenseColor}`
              }}>
                {testResult === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                {testResult === 'success' ? 'Connection successful' : testError}
              </div>
            )}

            {pullError && (
              <div style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: 'rgba(255, 107, 107, 0.1)',
                color: COLORS.expenseColor,
                border: `1px solid ${COLORS.expenseColor}`
              }}>
                <AlertTriangle size={14} />
                {pullError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
              <button
                onClick={handleTestConnection}
                disabled={!hubAddress.trim() || isTesting}
                style={{
                  padding: '0.625rem 1rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: COLORS.darkGray,
                  backgroundColor: COLORS.white,
                  border: `1px solid ${COLORS.lightGray}`,
                  cursor: !hubAddress.trim() || isTesting ? 'not-allowed' : 'pointer',
                  opacity: !hubAddress.trim() ? 0.5 : 1
                }}
              >
                {isTesting ? 'Testing...' : 'Test Connection'}
              </button>

              <button
                onClick={() => handleConnectAndPull(hubAddress, password)}
                disabled={!hubAddress.trim() || !password || isPulling}
                style={{
                  padding: '0.625rem 1rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: COLORS.white,
                  backgroundColor: (!hubAddress.trim() || !password || isPulling) ? COLORS.lightGray : COLORS.slainteBlue,
                  border: 'none',
                  cursor: (!hubAddress.trim() || !password || isPulling) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <RefreshCw size={14} style={isPulling ? { animation: 'spin 1s linear infinite' } : {}} />
                {isPulling ? 'Connecting...' : 'Connect & Pull Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === SHARING INFO CARD (shown when not connected — this machine is likely the hub) === */}
      {!isConnected && !needsReauth && (
        <div style={{
          backgroundColor: 'rgba(74, 144, 226, 0.05)',
          padding: '1.25rem',
          borderRadius: '0.5rem',
          border: `1px solid rgba(74, 144, 226, 0.2)`
        }}>
          <h3 style={{
            fontSize: '1rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: COLORS.darkGray,
            marginTop: 0,
            marginBottom: '0.5rem'
          }}>
            <Monitor size={16} color={COLORS.slainteBlue} />
            Sharing This Computer's Data
          </h3>
          <p style={{ fontSize: '0.85rem', color: COLORS.mediumGray, margin: '0 0 0.75rem 0' }}>
            Other computers on your practice network can connect to this machine to pull your practice data.
          </p>

          {lanIP ? (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.75rem',
              backgroundColor: COLORS.white,
              borderRadius: '0.375rem',
              border: `1px solid ${COLORS.lightGray}`,
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: COLORS.darkGray
            }}>
              <Wifi size={14} color={COLORS.slainteBlue} />
              {lanIP}
            </div>
          ) : (
            <p style={{ fontSize: '0.85rem', color: COLORS.mediumGray, margin: 0 }}>
              Your LAN IP address is available on the practice network (port 3001).
            </p>
          )}

          <p style={{ fontSize: '0.8rem', color: COLORS.mediumGray, margin: '0.75rem 0 0 0' }}>
            A partner password must be set up first — see Backup & Restore section for Security Password.
          </p>

          <div style={{
            marginTop: '0.75rem',
            padding: '0.625rem 0.75rem',
            borderRadius: '0.375rem',
            backgroundColor: 'rgba(255, 210, 60, 0.08)',
            border: '1px solid rgba(255, 210, 60, 0.25)',
            fontSize: '0.8rem',
            color: '#8B6914',
            lineHeight: 1.5
          }}>
            <strong>Important:</strong> If this is the computer where you upload bank statements and PCRS data,
            do not use the connect feature above. This machine is your source of truth — other computers
            should connect to it, not the other way around.
          </div>
        </div>
      )}

      {/* Spin animation keyframes */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

/**
 * Small sub-component for re-authentication when token has expired
 */
const ReauthCard = ({ address, onReauth, isPulling, error }) => {
  const [pwd, setPwd] = useState('');

  return (
    <div style={{
      backgroundColor: 'rgba(255, 210, 60, 0.08)',
      padding: '1.25rem',
      borderRadius: '0.5rem',
      border: `1px solid ${COLORS.highlightYellow}`
    }}>
      <h3 style={{
        fontSize: '1rem',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        color: COLORS.darkGray,
        marginTop: 0,
        marginBottom: '0.5rem'
      }}>
        <AlertTriangle size={16} color={COLORS.highlightYellow} />
        Session Expired
      </h3>
      <p style={{ fontSize: '0.85rem', color: COLORS.mediumGray, margin: '0 0 0.75rem 0' }}>
        Your connection to {address} has expired. Re-enter the partner password to reconnect.
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', maxWidth: '400px' }}>
        <input
          type="password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          placeholder="Partner password"
          style={{
            flex: 1,
            padding: '0.625rem 0.75rem',
            border: `1px solid ${COLORS.lightGray}`,
            borderRadius: '0.375rem',
            fontSize: '0.9rem'
          }}
        />
        <button
          onClick={() => onReauth(pwd)}
          disabled={!pwd || isPulling}
          style={{
            padding: '0.625rem 1rem',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: COLORS.white,
            backgroundColor: (!pwd || isPulling) ? COLORS.lightGray : COLORS.slainteBlue,
            border: 'none',
            cursor: (!pwd || isPulling) ? 'not-allowed' : 'pointer'
          }}
        >
          {isPulling ? 'Reconnecting...' : 'Reconnect'}
        </button>
      </div>

      {error && (
        <div style={{
          marginTop: '0.75rem',
          padding: '0.5rem 0.75rem',
          borderRadius: '0.375rem',
          fontSize: '0.85rem',
          color: COLORS.expenseColor,
          backgroundColor: 'rgba(255, 107, 107, 0.1)',
          border: `1px solid ${COLORS.expenseColor}`,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <AlertTriangle size={14} />
          {error}
        </div>
      )}
    </div>
  );
};

export default ConnectedPracticeSection;
