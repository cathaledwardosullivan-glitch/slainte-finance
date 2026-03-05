import React, { useState } from 'react';
import { Wifi, CheckCircle, AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import COLORS from '../../utils/colors';

// Same localStorage keys as ConnectedPracticeSection
const CONNECTED_ADDRESS = 'connected_practice_address';
const CONNECTED_TOKEN = 'connected_practice_token';
const CONNECTED_NAME = 'connected_practice_name';
const CONNECTED_LAST_REFRESH = 'connected_practice_last_refresh';
const CONNECTED_DATA_SUMMARY = 'connected_practice_data_summary';

/**
 * QuickConnectSetup — Onboarding step for connecting to an existing practice computer.
 * Authenticates, pulls all data (including practice profile), and completes onboarding.
 */
export default function QuickConnectSetup({ onComplete, onBack }) {
  const {
    setTransactions,
    setUnidentifiedTransactions,
    setCategoryMapping,
    setPaymentAnalysisData
  } = useAppContext();

  const [hubAddress, setHubAddress] = useState('');
  const [password, setPassword] = useState('');
  const [isPulling, setIsPulling] = useState(false);
  const [error, setError] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  const buildBaseURL = (address) => {
    const addr = address.trim();
    const withPort = addr.includes(':') ? addr : `${addr}:3001`;
    return `http://${withPort}`;
  };

  const handleTestConnection = async () => {
    if (!hubAddress.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const response = await fetch(`${buildBaseURL(hubAddress)}/api/health`, {
        signal: AbortSignal.timeout(5000)
      });
      setTestResult(response.ok ? 'success' : 'error');
      if (!response.ok) setError(`Server responded with status ${response.status}`);
    } catch {
      setTestResult('error');
      setError('Could not reach that address. Check the IP and ensure the main computer is running.');
    } finally {
      setIsTesting(false);
    }
  };

  const handleConnect = async () => {
    if (!hubAddress.trim() || !password) return;
    setIsPulling(true);
    setError(null);

    try {
      // 1. Authenticate
      const authResponse = await fetch(`${buildBaseURL(hubAddress)}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        signal: AbortSignal.timeout(10000)
      });

      const authData = await authResponse.json();
      if (!authData.success || !authData.token) {
        throw new Error(authData.error || 'Authentication failed. Check your password.');
      }

      // 2. Pull all data
      const syncResponse = await fetch(`${buildBaseURL(hubAddress)}/api/sync/data`, {
        headers: {
          'Authorization': `Bearer ${authData.token}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(30000)
      });

      if (!syncResponse.ok) {
        throw new Error(`Failed to pull data (status ${syncResponse.status})`);
      }

      const syncResult = await syncResponse.json();
      const data = syncResult.data;

      if (!data) {
        throw new Error('No data returned from the practice computer.');
      }

      // 3. Apply data (same pattern as ConnectedPracticeSection & BackupRestoreSection)
      setTransactions(data.transactions || []);
      setUnidentifiedTransactions(data.unidentifiedTransactions || []);
      if (data.categoryMapping) setCategoryMapping(data.categoryMapping);
      if (data.paymentAnalysisData) setPaymentAnalysisData(data.paymentAnalysisData);

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

      // 4. Save connection config
      let practiceName = 'Practice';
      if (data.practiceProfile) {
        const profile = typeof data.practiceProfile === 'string'
          ? JSON.parse(data.practiceProfile)
          : data.practiceProfile;
        practiceName = profile?.practiceDetails?.practiceName || profile?.practiceName || 'Practice';
      }

      const now = new Date().toISOString();
      localStorage.setItem(CONNECTED_ADDRESS, hubAddress.trim());
      localStorage.setItem(CONNECTED_TOKEN, authData.token);
      localStorage.setItem(CONNECTED_NAME, practiceName);
      localStorage.setItem(CONNECTED_LAST_REFRESH, now);
      localStorage.setItem(CONNECTED_DATA_SUMMARY, JSON.stringify({
        transactions: (data.transactions || []).length,
        pcrs: (data.paymentAnalysisData || []).length,
        reports: (data.savedReports || []).length
      }));

      // 5. Complete onboarding
      onComplete({ practiceName });

    } catch (err) {
      console.error('[QuickConnect] Error:', err);
      setError(err.message);
    } finally {
      setIsPulling(false);
    }
  };

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '1rem' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          backgroundColor: `${COLORS.slainteBlue}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1rem'
        }}>
          <Wifi size={32} color={COLORS.slainteBlue} />
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: COLORS.darkGray, marginBottom: '0.5rem' }}>
          Connect to Your Practice
        </h2>
        <p style={{ fontSize: '0.95rem', color: COLORS.mediumGray, lineHeight: 1.6 }}>
          Enter the IP address of the main practice computer to pull all your practice data automatically.
        </p>
      </div>

      {/* Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.375rem', color: COLORS.darkGray }}>
            Practice Computer IP Address
          </label>
          <input
            type="text"
            value={hubAddress}
            onChange={(e) => { setHubAddress(e.target.value); setTestResult(null); setError(null); }}
            placeholder="e.g. 192.168.1.100"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: `1px solid ${COLORS.lightGray}`,
              borderRadius: '0.5rem',
              fontSize: '1rem',
              boxSizing: 'border-box'
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleTestConnection()}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.375rem', color: COLORS.darkGray }}>
            Partner Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            placeholder="Same as the mobile access password"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: `1px solid ${COLORS.lightGray}`,
              borderRadius: '0.5rem',
              fontSize: '1rem',
              boxSizing: 'border-box'
            }}
            onKeyDown={(e) => e.key === 'Enter' && hubAddress.trim() && password && handleConnect()}
          />
        </div>

        {/* Status messages */}
        {testResult === 'success' && (
          <div style={{
            padding: '0.625rem 0.75rem',
            borderRadius: '0.5rem',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'rgba(78, 205, 196, 0.1)',
            color: COLORS.incomeColor,
            border: `1px solid ${COLORS.incomeColor}`
          }}>
            <CheckCircle size={16} />
            Connection successful — enter your password and connect.
          </div>
        )}

        {error && (
          <div style={{
            padding: '0.625rem 0.75rem',
            borderRadius: '0.5rem',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'rgba(255, 107, 107, 0.1)',
            color: COLORS.expenseColor,
            border: `1px solid ${COLORS.expenseColor}`
          }}>
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button
            onClick={handleTestConnection}
            disabled={!hubAddress.trim() || isTesting}
            style={{
              padding: '0.75rem 1.25rem',
              borderRadius: '0.5rem',
              fontSize: '0.9rem',
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
            onClick={handleConnect}
            disabled={!hubAddress.trim() || !password || isPulling}
            style={{
              flex: 1,
              padding: '0.75rem 1.25rem',
              borderRadius: '0.5rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: COLORS.white,
              backgroundColor: (!hubAddress.trim() || !password || isPulling) ? COLORS.lightGray : COLORS.slainteBlue,
              border: 'none',
              cursor: (!hubAddress.trim() || !password || isPulling) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <RefreshCw size={16} style={isPulling ? { animation: 'spin 1s linear infinite' } : {}} />
            {isPulling ? 'Connecting & pulling data...' : 'Connect & Pull Data'}
          </button>
        </div>

        {/* Back button */}
        <button
          onClick={onBack}
          disabled={isPulling}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0',
            border: 'none',
            background: 'none',
            cursor: isPulling ? 'not-allowed' : 'pointer',
            color: COLORS.mediumGray,
            fontSize: '0.875rem',
            marginTop: '0.5rem'
          }}
        >
          <ArrowLeft size={14} />
          Back to options
        </button>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
